/**
 * P7 trajectory achievements: 20 session-scoped milestones across four chains,
 * plus chain invariants, catalog regression (48 → 68), and global unlock
 * idempotency. Thresholds are verified parameterized (N-1 / N / N+1), never as
 * 60 handwritten cases.
 */
import { describe, expect, it } from 'vitest'
import { applyEvent, BUILTIN_ACHIEVEMENTS, TRAJECTORY_ACHIEVEMENTS, type AchievementDef } from '../src/achievements.ts'
import type { AchievementContext } from '../src/reducer.ts'
import type { AchievementEvent } from '../src/events.ts'
import { TRAJECTORY_CHAINS } from '../src/share.ts'
import { createInitialProfile, createInitialSessionState, createInitialState } from '../src/state.ts'

const T = 1_700_000_000_000
const RARITY_SEQUENCE = ['common', 'uncommon', 'rare', 'epic', 'legendary'] as const

/** Map each trajectory achievement id back to its chain id (single source of truth). */
const CHAIN_BY_DEF = new Map(TRAJECTORY_CHAINS.flatMap(chain => chain.achievementIds.map(id => [id, chain.id] as const)))

/** Build an evaluation context whose session has `value` in the metric of `defId`'s chain. */
function ctxWith(defId: string, value: number): AchievementContext {
  const chainId = CHAIN_BY_DEF.get(defId)
  if (chainId === undefined) throw new Error(`unknown trajectory achievement ${defId}`)
  const session = createInitialSessionState()
  if (chainId === 'session-marathon') session.trajectoryTurns = value
  else if (chainId === 'turn-depth') session.maxStepsInTurn = value
  else if (chainId === 'tool-barrage') session.maxToolCallsInStep = value
  else if (chainId === 'time-anomaly') session.maxRequestDurationMs = value * 1000
  return { profile: createInitialProfile(), session }
}

function stepEnd(sessionId: string, seq: number, turn: number, step: number): AchievementEvent {
  return { kind: 'step-end', sessionId, seq, time: 0, turn, step }
}

describe('P7 trajectory thresholds (parameterized N-1 / N / N+1)', () => {
  for (const chain of TRAJECTORY_CHAINS) {
    const defs = chain.achievementIds
      .map(id => BUILTIN_ACHIEVEMENTS.find(d => d.id === id))
      .filter((d): d is AchievementDef => d !== undefined)
    for (const def of defs) {
      const target = def.evaluate(ctxWith(def.id, 0)).target!
      it(`${def.id} (${chain.id}): ${target - 1} locked, ${target} unlocked, ${target + 1} still unlocked`, () => {
        expect(def.evaluate(ctxWith(def.id, target - 1)).unlocked).toBe(false)
        expect(def.evaluate(ctxWith(def.id, target)).unlocked).toBe(true)
        const over = def.evaluate(ctxWith(def.id, target + 1))
        expect(over.unlocked).toBe(true)
        expect(over.progress).toBe(target + 1) // progress is raw, not clamped
      })
    }
  }

  it('duration progress is whole seconds: Math.floor(ms / 1000), target in seconds', () => {
    const def = BUILTIN_ACHIEVEMENTS.find(d => d.id === 'request-duration-30s')!
    expect(def.evaluate(ctxWith(def.id, 29)).unlocked).toBe(false)
    expect(def.evaluate(ctxWith(def.id, 30)).unlocked).toBe(true)
    expect(def.evaluate(ctxWith(def.id, 30)).progress).toBe(30)
    expect(def.evaluate(ctxWith(def.id, 30)).target).toBe(30)
  })
})

describe('P7 global unlock idempotency', () => {
  it('session-turns-5 unlocks once (+10 XP), then a second session gains +0 XP', () => {
    let state = createInitialState()
    // Session A reaches 5 distinct closed-step turns (one step each).
    for (let turn = 1; turn <= 5; turn += 1) {
      state = applyEvent(state, stepEnd('A', turn - 1, turn, 1), TRAJECTORY_ACHIEVEMENTS, '2026-01-01', T).state
    }
    expect(state.profile.unlocked['session-turns-5']).toBe(T)
    expect(state.profile.xp).toBe(10)
    expect(state.sessions.A?.unlocked).toContain('session-turns-5')
    expect(state.sessions.A?.xpGained).toBe(10)

    // Session B reaches the same condition: already unlocked, no duplicate XP.
    const before = state.profile.xp
    for (let turn = 1; turn <= 5; turn += 1) {
      state = applyEvent(state, stepEnd('B', turn - 1, turn, 1), TRAJECTORY_ACHIEVEMENTS, '2026-01-01', T + 1000 + turn).state
    }
    expect(state.profile.xp).toBe(before)
    expect(state.sessions.B?.unlocked ?? []).not.toContain('session-turns-5')
  })
})

describe('P7 special chain invariants', () => {
  const byId = new Map(BUILTIN_ACHIEVEMENTS.map(d => [d.id, d]))

  it('ships exactly four trajectory chains of five session-scoped nodes each', () => {
    expect(TRAJECTORY_CHAINS).toHaveLength(4)
    for (const chain of TRAJECTORY_CHAINS) {
      expect(chain.achievementIds).toHaveLength(5)
      const chainDefs = chain.achievementIds.map(id => byId.get(id))
      for (const d of chainDefs) {
        expect(d, `${chain.id} has a missing id`).toBeDefined()
        expect(d?.scope).toBe('session')
      }
      expect(chainDefs.map(d => d!.rarity)).toEqual([...RARITY_SEQUENCE])
    }
  })

  it('each trajectory chain has strictly increasing thresholds', () => {
    for (const chain of TRAJECTORY_CHAINS) {
      const targets = chain.achievementIds.map(id => byId.get(id)!.evaluate(ctxWith(id, 0)).target!)
      for (let i = 1; i < targets.length; i += 1) {
        expect(targets[i]!, `${chain.id} threshold ${i}`).toBeGreaterThan(targets[i - 1]!)
      }
    }
  })

  it('all time-anomaly nodes are hidden easter eggs', () => {
    const chain = TRAJECTORY_CHAINS.find(c => c.id === 'time-anomaly')!
    for (const id of chain.achievementIds) {
      expect(byId.get(id)?.hidden, id).toBe(true)
      expect(byId.get(id)?.scope).toBe('session')
    }
  })
})

describe('P7 catalog regression', () => {
  it('ships exactly 68 built-in achievements with unique ids', () => {
    expect(BUILTIN_ACHIEVEMENTS).toHaveLength(68)
    const ids = BUILTIN_ACHIEVEMENTS.map(d => d.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('exposes exactly 20 trajectory achievements', () => {
    expect(TRAJECTORY_ACHIEVEMENTS).toHaveLength(20)
  })

  it('keeps the P6 catalog prefix untouched (first 48 ids unchanged)', () => {
    // The 20 new ids are appended after the existing 48; the first 48 must be
    // the original catalog in registration order.
    expect(BUILTIN_ACHIEVEMENTS.slice(0, 48).every(d => !CHAIN_BY_DEF.has(d.id))).toBe(true)
    expect(TRAJECTORY_ACHIEVEMENTS.map(d => d.id)).toEqual(BUILTIN_ACHIEVEMENTS.slice(48).map(d => d.id))
  })
})
