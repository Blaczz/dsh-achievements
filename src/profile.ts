/**
 * Agent Profile + Session Summary derivations. Browser-safe pure functions —
 * only type imports from state/achievements and the pure `levelOf` from
 * gamification — so the client bundle inlines them without pulling in node
 * or @deepseek-ai runtime code.
 */
import { levelOf, type LevelInfo } from './gamification.ts'
import type { AchievementRarity, AchievementView, LocalizedText } from './achievements.ts'
import type { AchievementState, ProfileState, SessionAchievementState } from './state.ts'

// ---- persona (pure rules, no LLM) ----

export interface Persona {
  id: string
  title: LocalizedText
  description: LocalizedText
}

const PERFECTIONIST: Persona = { id: 'perfectionist', title: { zh: '完美主义', en: 'Perfectionist' }, description: { zh: '反复打磨同一个文件', en: 'Polishes the same file repeatedly' } }
const DETECTIVE: Persona = { id: 'detective', title: { zh: '侦探', en: 'Detective' }, description: { zh: '读得多、改得少', en: 'Reads a lot, edits little' } }
const COWBOY: Persona = { id: 'cowboy', title: { zh: '牛仔', en: 'Cowboy' }, description: { zh: '改得多、测试靠后', en: 'Edits a lot, tests late' } }
const TEST_DRIVEN: Persona = { id: 'test-driven', title: { zh: '测试驱动', en: 'Test-Driven' }, description: { zh: '测试频繁、修改克制', en: 'Tests often, edits carefully' } }
const EXPLORER: Persona = { id: 'explorer', title: { zh: '探索者', en: 'Explorer' }, description: { zh: '刚开始探索', en: 'Just getting started' } }

/** Deterministic persona from one session's behavior. Priority: first match wins. */
export function personaOf(session: SessionAchievementState | undefined): Persona {
  if (session === undefined) return EXPLORER
  const reads = distinctCount(session.filesRead)
  const edits = distinctCount(session.filesEdited)
  const maxSameEdit = maxValue(session.filesEdited)
  const tests = session.tests.runs
  const editsBeforeTest = session.editsBeforeFirstTest

  if (maxSameEdit >= 4) return PERFECTIONIST
  if (reads >= 10 && reads >= edits * 4) return DETECTIVE
  if (edits >= 6 && editsBeforeTest >= 5) return COWBOY
  if (tests >= 4 && edits <= tests) return TEST_DRIVEN
  return EXPLORER
}

// ---- rarity summary / favorite tool ----

export interface RarityCount {
  unlocked: number
  total: number
}

export function raritySummaryOf(
  views: readonly AchievementView[],
  unlocked: Record<string, number>,
): Record<AchievementRarity, RarityCount> {
  const out: Record<AchievementRarity, RarityCount> = {
    common: { unlocked: 0, total: 0 },
    uncommon: { unlocked: 0, total: 0 },
    rare: { unlocked: 0, total: 0 },
    epic: { unlocked: 0, total: 0 },
    legendary: { unlocked: 0, total: 0 },
  }
  for (const view of views) {
    out[view.rarity].total += 1
    if (unlocked[view.id] !== undefined) out[view.rarity].unlocked += 1
  }
  return out
}

export function favoriteToolOf(profile: ProfileState): string | null {
  let best: string | null = null
  let bestCount = 0
  for (const [name, count] of Object.entries(profile.toolsByName)) {
    if (count > bestCount) {
      best = name
      bestCount = count
    }
  }
  return best
}

// ---- profile view model ----

export interface ProfileViewModel {
  level: LevelInfo
  xp: number
  unlockedCount: number
  totalCount: number
  rarity: Record<AchievementRarity, RarityCount>
  favoriteTool: string | null
  persona: Persona
}

/** Assemble the Agent Profile from raw state + views (persona uses the latest session). */
export function buildProfileView(state: AchievementState, views: readonly AchievementView[]): ProfileViewModel {
  const sessionIds = Object.keys(state.sessions)
  const lastId = sessionIds[sessionIds.length - 1]
  const recent = lastId === undefined ? undefined : state.sessions[lastId]
  return {
    level: levelOf(state.profile.xp),
    xp: state.profile.xp,
    unlockedCount: Object.keys(state.profile.unlocked).length,
    totalCount: views.length,
    rarity: raritySummaryOf(views, state.profile.unlocked),
    favoriteTool: favoriteToolOf(state.profile),
    persona: personaOf(recent),
  }
}

// ---- session summary ----

export interface SessionSummary {
  sessionId: string
  /** Distinct closed-step turns in this session (P7 trajectory). */
  turns: number
  /** Total closed steps in this session (P7 trajectory). */
  steps: number
  /** Deepest single-turn step depth observed in this session (P7 trajectory). */
  maxStepsInTurn: number
  toolCalls: number
  filesRead: number
  filesEdited: number
  tests: number
  failures: number
  /** Achievement ids unlocked during this session. */
  unlocked: string[]
  /** XP gained during this session. */
  xpGained: number
  /** Level boundary crossed this session, when any. */
  levelUp: { from: number; to: number } | null
}

/** Compute one session's report; null when the session bucket is absent. */
export function buildSessionSummary(state: AchievementState, sessionId: string): SessionSummary | null {
  const session = state.sessions[sessionId]
  if (session === undefined) return null
  const before = levelOf(state.profile.xp - session.xpGained).level
  const after = levelOf(state.profile.xp).level
  return {
    sessionId,
    turns: session.trajectoryTurns,
    steps: session.steps,
    maxStepsInTurn: session.maxStepsInTurn,
    toolCalls: session.toolCalls,
    filesRead: distinctCount(session.filesRead),
    filesEdited: distinctCount(session.filesEdited),
    tests: session.tests.runs,
    failures: session.tests.failed,
    unlocked: [...session.unlocked],
    xpGained: session.xpGained,
    levelUp: after > before ? { from: before, to: after } : null,
  }
}

function distinctCount(map: Record<string, number>): number {
  return Object.keys(map).length
}

function maxValue(map: Record<string, number>): number {
  let max = 0
  for (const value of Object.values(map)) if (value > max) max = value
  return max
}
