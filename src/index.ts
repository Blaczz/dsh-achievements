/**
 * Host half of the achievements plugin: feeds real session events into the
 * event classifier → pure engine, persists v2 state, exposes a read-only HTTP
 * API for the browser half, and registers a durable settings namespace.
 */
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-tools'
// dsh-settings branding: newer DSH releases (>= 0.1.5-alpha) removed the
// settingsNamespace() runtime helper — namespaces are plain strings there.
// The brand is compile-time only, so a missing-helper identity fallback keeps
// ONE host code path working across the rc and alpha release lines.
import * as settingsApi from '@deepseek-ai/dsh-settings'
import type { SettingsNamespace } from '@deepseek-ai/dsh-settings'
import {
  applyEvent, BUILTIN_ACHIEVEMENTS, BUILTIN_PACK, computeProgress, DEFAULT_ACHIEVEMENTS_SETTINGS,
  reconcileLifetimeAchievements, toAchievementView,
  type AchievementsSettings, type AchievementDef,
} from './achievements.ts'
import { createAchievementRegistry, type AchievementPack, type AchievementsSdk } from './sdk.ts'
import { buildContext } from './reducer.ts'
import { loadState, saveState, type AchievementState } from './state.ts'
import {
  buildAssistantMessageEvent, buildStepEndEvent, buildStepStartEvent, buildToolCallEvent,
  buildTurnEndEvent, classifyCodeDispatch, classifyTool, parseToolArguments,
  type AchievementEvent, type ToolSummary,
} from './events.ts'
import { ACHIEVEMENTS_API_PREFIX, ACHIEVEMENTS_EVENTS_API_PATH, ACHIEVEMENTS_STATE_API_PATH, unlockEventFrame } from './api.ts'

// Public SDK surface (pure engine + model + classifier + reducer).
export {
  applyEvent, BEHAVIOR_ACHIEVEMENTS, BUILTIN_ACHIEVEMENTS, COUNTER_ACHIEVEMENTS, LIFETIME_ACHIEVEMENTS,
  MILESTONE_ACHIEVEMENTS, TRAJECTORY_ACHIEVEMENTS, reconcileLifetimeAchievements,
  computeProgress, countersOf, fromCounterCondition, toAchievementView, DEFAULT_ACHIEVEMENTS_SETTINGS,
} from './achievements.ts'
export type {
  AchievementCounters, AchievementDef, AchievementEvaluation, AchievementProgress,
  AchievementProgressView, AchievementRarity, AchievementScope, AchievementView, AchievementsSettings,
  LifetimeReconciliation, LocalizedText,
} from './achievements.ts'
export {
  createInitialProfile, createInitialSessionState, createInitialState, migrateState,
  MAX_SESSIONS, STATE_VERSION, touchSession,
} from './state.ts'
export type { AchievementState, ProfileState, SessionAchievementState, TestCounters } from './state.ts'
export {
  buildAssistantMessageEvent, buildStepEndEvent, buildStepStartEvent, buildToolCallEvent,
  buildTurnEndEvent, classifyCodeDispatch, classifyTool, isDependencyPath, isTestCommand, parseToolArguments,
} from './events.ts'
export type { AchievementEvent, AchievementTokenUsage, ToolKind, ToolSummary } from './events.ts'
export { buildContext, reduceState, yesterdayOf } from './reducer.ts'
export type { AchievementContext } from './reducer.ts'
export { levelOf, xpForLevel, XP_PER_LEVEL, RARITY_META } from './gamification.ts'
export type { LevelInfo, RarityMeta } from './gamification.ts'
export {
  buildProfileView, buildSessionSummary, favoriteToolOf, personaOf, raritySummaryOf,
} from './profile.ts'
export type { Persona, ProfileViewModel, RarityCount, SessionSummary } from './profile.ts'
export {
  buildAchievementCard, buildAgentWrapped, buildShareText, chainProgressOf,
  BUILTIN_CHAINS, MILESTONE_CHAINS, SPECIAL_CHAINS, TRAJECTORY_CHAINS,
} from './share.ts'
export type { AchievementCard, AchievementChain, AgentWrapped, ChainProgress } from './share.ts'
export { ACHIEVEMENTS_API_PREFIX, ACHIEVEMENTS_STATE_API_PATH } from './api.ts'
export { createAchievementRegistry } from './sdk.ts'
export type { AchievementPack, AchievementRegistry, AchievementsSdk } from './sdk.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Host-side SDK: register achievement definitions / packs. */
    achievements: AchievementsSdk
  }
}

export const name = 'achievements'
export const inject = ['settings', 'webServer']

const SettingsSchema: z<AchievementsSettings> = z.object({
  enabled: z.boolean().default(DEFAULT_ACHIEVEMENTS_SETTINGS.enabled),
  toastEnabled: z.boolean().default(DEFAULT_ACHIEVEMENTS_SETTINGS.toastEnabled),
})

/** Local calendar day as 'YYYY-MM-DD' (streak arithmetic uses local time). */
export function localToday(now = new Date()): string {
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Brand a settings-namespace string across DSH release lines. Newer releases
 * removed `settingsNamespace()`; when it is absent the identity fallback keeps
 * the register/read calls identical (the brand is compile-time only).
 */
const brandSettingsNamespace: (value: string) => SettingsNamespace =
  (settingsApi as { settingsNamespace?: (value: string) => SettingsNamespace }).settingsNamespace
  ?? ((value: string) => value as unknown as SettingsNamespace)

export function apply(ctx: Context): void {
  const settings = ctx.settings.register(brandSettingsNamespace('achievements'), SettingsSchema)
  let state: AchievementState = loadState()

  const persist = (): void => {
    try { saveState(state) } catch { /* persistence is best-effort */ }
  }

  // Achievement registry: built-in + third-party packs share one evaluation path.
  const registry = createAchievementRegistry()

  // Silently unlock lifetime definitions already satisfied by the current
  // profile, award their XP once, and persist. No reducer, no session
  // attribution, no unlock broadcast — so an upgrade never toasts history.
  const reconcile = (defs: readonly AchievementDef[]): void => {
    const result = reconcileLifetimeAchievements(state, defs)
    if (result.newlyUnlocked.length === 0) return
    state = result.state
    persist()
    ctx.logger.info(`[achievements] reconciled ${result.newlyUnlocked.length} lifetime achievements (+${result.xpGained} XP)`)
  }

  registry.registerPack(BUILTIN_PACK)
  reconcile(registry.list())

  // Third-party registrations reconcile immediately too, so a new lifetime
  // pack does not wait for the next live event to unlock.
  ctx.provide('achievements', {
    register: (def: AchievementDef): void => {
      registry.register(def)
      reconcile([def])
    },
    registerPack: (pack: AchievementPack): void => {
      registry.registerPack(pack)
      reconcile(pack.achievements)
    },
  })

  // SSE downlink: unlock events are pushed to every connected browser client
  // (persist → broadcast order guarantees a repull sees the persisted state).
  const sseClients = new Set<import('node:http').ServerResponse>()
  const broadcastUnlock = (id: string): void => {
    if (sseClients.size === 0) return
    const frame = unlockEventFrame(id)
    for (const client of sseClients) client.write(frame)
  }

  const handleUnlocks = (newlyUnlocked: readonly AchievementDef[]): void => {
    for (const def of newlyUnlocked) {
      ctx.logger.info(`[achievements] unlocked: ${def.id} (${def.title.en})`)
      broadcastUnlock(def.id)
    }
  }

  const applyAchievementEvent = (event: AchievementEvent): void => {
    const result = applyEvent(state, event, registry.list(), localToday())
    state = result.state
    persist()
    handleUnlocks(result.newlyUnlocked)
  }

  // call id → classification, so a settled `tool/result` can be correlated
  // with the `tool/call` that carried its name and arguments.
  const pendingCalls = new Map<string, ToolSummary>()

  ctx.on('session/event', (session, event) => {
    if (!settings.get().enabled) return
    const sessionId = String(session.id)
    if (event.type === 'turn/end') {
      applyAchievementEvent(buildTurnEndEvent(sessionId, event.seq))
    } else if (event.type === 'step/start') {
      // Opens one step (model call + its tool executions). Feeds the openStep
      // identity + durable start timestamp for request-duration pairing.
      applyAchievementEvent(buildStepStartEvent(sessionId, event.seq, event.time, event.data.turn, event.data.step))
    } else if (event.type === 'assistant/message') {
      // Assembled assistant message (low-frequency boundary, not a chunk).
      // `usage` is the installed `TokenUsage`; P7 keeps it in the standard event
      // without persisting token metrics yet.
      const data = event.data
      applyAchievementEvent(buildAssistantMessageEvent(sessionId, event.seq, event.time, data.turn, data.step, data.usage))
    } else if (event.type === 'step/end') {
      applyAchievementEvent(buildStepEndEvent(sessionId, event.seq, event.time, event.data.turn, event.data.step))
    } else if (event.type === 'tool/call') {
      const summary = classifyTool(event.data.name, parseToolArguments(event.data.arguments))
      pendingCalls.set(String(event.data.callId), summary)
    } else if (event.type === 'tool/result') {
      const callId = String(event.data.message.source.callId)
      // Fall back to a generic classification if the call was never observed
      // (e.g. a resumed seed) so an unknown tool is still a safe tool-call.
      const summary = pendingCalls.get(callId) ?? { kind: 'other', name: '' }
      const block = event.data.message.content[0]
      const isError = event.data.error !== undefined || block?.isError === true
      applyAchievementEvent(buildToolCallEvent(sessionId, event.seq, callId, summary, isError))
    } else if (event.type === 'tool/code-dispatch') {
      // Code Mode sub-dispatch: one settled child invocation. `tool/code-dispatch`
      // already carries the normalized `arguments` object, the child tool `name`,
      // a deterministic `subCallId`, and a settled `isError`, so it maps directly
      // onto the same settled `tool-call` event the native path produces.
      const data = event.data
      applyAchievementEvent(buildToolCallEvent(
        sessionId,
        event.seq,
        String(data.subCallId),
        classifyCodeDispatch(data.name, data.arguments),
        data.isError === true,
      ))
    }
  })

  // Read-only HTTP API for the browser half (loopback-only).
  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: ACHIEVEMENTS_API_PREFIX,
    handler: async (req, res) => {
      const pathname = new URL(req.url ?? '/', 'http://localhost').pathname
      if (pathname !== ACHIEVEMENTS_STATE_API_PATH) {
        res.statusCode = 404
        res.setHeader('content-type', 'application/json; charset=utf-8')
        res.end(JSON.stringify({ error: 'not-found' }))
        return
      }
      if (!isLoopbackRequest(req)) {
        res.statusCode = 403
        res.setHeader('content-type', 'application/json; charset=utf-8')
        res.end(JSON.stringify({ error: 'forbidden' }))
        return
      }
      res.statusCode = 200
      res.setHeader('content-type', 'application/json; charset=utf-8')
      res.setHeader('cache-control', 'no-store')
      // Progress is evaluated against the most recently touched session so the
      // badge wall can render session-scoped progress too (lifetime rules read
      // the global profile regardless of the session key).
      const sessionIds = Object.keys(state.sessions)
      const defs = registry.list()
      const progress = computeProgress(defs, buildContext(state, sessionIds[sessionIds.length - 1] ?? ''))
      res.end(JSON.stringify({
        settings: settings.get(),
        achievements: defs.map(toAchievementView),
        state,
        progress,
      }))
    },
  }), 'achievements: state API')

  // Real-time unlock push (SSE). Polling stays as the fallback path; this is
  // the primary, immediate notification channel.
  ctx.effect(() => {
    const dispose = ctx.webServer.register({
      kind: 'exact',
      path: ACHIEVEMENTS_EVENTS_API_PATH,
      handler: (req, res) => {
        if (!isLoopbackRequest(req)) {
          res.statusCode = 403
          res.setHeader('content-type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ error: 'forbidden' }))
          return
        }
        res.writeHead(200, {
          'content-type': 'text/event-stream; charset=utf-8',
          'cache-control': 'no-cache, no-transform',
          'connection': 'keep-alive',
        })
        res.write('retry: 5000\n\n')
        sseClients.add(res)
        req.on('close', () => sseClients.delete(res))
      },
    })
    return () => {
      dispose()
      for (const client of sseClients) client.end()
      sseClients.clear()
    }
  }, 'achievements: unlock SSE')
}

function isLoopbackRequest(req: import('node:http').IncomingMessage): boolean {
  const authority = req.headers.host
  if (authority === undefined) return false
  let hostname: string
  try {
    hostname = new URL(`http://${authority}`).hostname
  } catch {
    return false
  }
  hostname = hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname.toLowerCase()
  if (hostname !== 'localhost' && hostname !== '::1' && !/^127(?:\.[0-9]{1,3}){3}$/.test(hostname)) return false
  const site = req.headers['sec-fetch-site']
  if (typeof site === 'string' && site !== 'same-origin' && site !== 'none') return false
  return true
}
