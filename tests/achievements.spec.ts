/** Pure achievement-engine tests: unlock rules, streaks, idempotency. */
import { describe, expect, it } from 'vitest'
import {
  applyEvent, BUILTIN_ACHIEVEMENTS, createInitialState, yesterdayOf,
} from '../src/achievements.ts'
import type { AchievementState } from '../src/achievements.ts'

const T = 1_700_000_000_000

function unlockedIds(state: AchievementState): string[] {
  return Object.keys(state.unlocked)
}

describe('achievement engine', () => {
  it('unlocks first-turn on the very first turn-end', () => {
    const result = applyEvent(createInitialState(), { kind: 'turn-end', sessionId: 's1' }, BUILTIN_ACHIEVEMENTS, '2026-01-01', T)
    expect(result.newlyUnlocked.map(d => d.id)).toContain('first-turn')
    expect(result.state.counters.turns).toBe(1)
  })

  it('unlocks ten-turns exactly at 10, not before', () => {
    let state = createInitialState()
    for (let i = 0; i < 9; i += 1) {
      state = applyEvent(state, { kind: 'turn-end', sessionId: 's1' }, BUILTIN_ACHIEVEMENTS, '2026-01-01', T + i).state
    }
    expect(unlockedIds(state)).not.toContain('ten-turns')
    const tenth = applyEvent(state, { kind: 'turn-end', sessionId: 's1' }, BUILTIN_ACHIEVEMENTS, '2026-01-01', T + 9)
    expect(tenth.newlyUnlocked.map(d => d.id)).toContain('ten-turns')
  })

  it('unlocks first-tool at 1 and hundred-tools at 100', () => {
    let state = createInitialState()
    state = applyEvent(state, { kind: 'tool-call' }, BUILTIN_ACHIEVEMENTS, '2026-01-01', T).state
    expect(unlockedIds(state)).toContain('first-tool')
    for (let i = 0; i < 98; i += 1) {
      state = applyEvent(state, { kind: 'tool-call' }, BUILTIN_ACHIEVEMENTS, '2026-01-01', T + i).state
    }
    expect(unlockedIds(state)).not.toContain('hundred-tools')
    state = applyEvent(state, { kind: 'tool-call' }, BUILTIN_ACHIEVEMENTS, '2026-01-01', T + 99).state
    expect(unlockedIds(state)).toContain('hundred-tools')
  })

  it('counts distinct sessions for ten-sessions', () => {
    let state = createInitialState()
    for (let i = 0; i < 10; i += 1) {
      state = applyEvent(state, { kind: 'turn-end', sessionId: `s${i}` }, BUILTIN_ACHIEVEMENTS, '2026-01-01', T + i).state
    }
    expect(state.counters.sessions).toBe(10)
    expect(unlockedIds(state)).toContain('ten-sessions')
  })

  it('does not double-count the same session id', () => {
    let state = createInitialState()
    state = applyEvent(state, { kind: 'turn-end', sessionId: 's1' }, BUILTIN_ACHIEVEMENTS, '2026-01-01', T).state
    state = applyEvent(state, { kind: 'turn-end', sessionId: 's1' }, BUILTIN_ACHIEVEMENTS, '2026-01-01', T + 1).state
    expect(state.counters.sessions).toBe(1)
  })

  it('builds a streak across consecutive days and resets on a gap', () => {
    let state = createInitialState()
    state = applyEvent(state, { kind: 'turn-end', sessionId: 's' }, BUILTIN_ACHIEVEMENTS, '2026-01-01', T).state
    expect(state.counters.streakDays).toBe(1)
    state = applyEvent(state, { kind: 'turn-end', sessionId: 's' }, BUILTIN_ACHIEVEMENTS, '2026-01-02', T + 1).state
    expect(state.counters.streakDays).toBe(2)
    state = applyEvent(state, { kind: 'turn-end', sessionId: 's' }, BUILTIN_ACHIEVEMENTS, '2026-01-03', T + 2).state
    expect(state.counters.streakDays).toBe(3)
    expect(unlockedIds(state)).toContain('streak-3')
    // Gap day resets the streak.
    state = applyEvent(state, { kind: 'turn-end', sessionId: 's' }, BUILTIN_ACHIEVEMENTS, '2026-01-05', T + 3).state
    expect(state.counters.streakDays).toBe(1)
  })

  it('does not grow the streak twice within the same day', () => {
    let state = createInitialState()
    state = applyEvent(state, { kind: 'turn-end', sessionId: 's' }, BUILTIN_ACHIEVEMENTS, '2026-01-01', T).state
    state = applyEvent(state, { kind: 'turn-end', sessionId: 's' }, BUILTIN_ACHIEVEMENTS, '2026-01-01', T + 1).state
    expect(state.counters.streakDays).toBe(1)
  })

  it('returns each achievement exactly once (idempotent)', () => {
    let state = createInitialState()
    state = applyEvent(state, { kind: 'turn-end', sessionId: 's' }, BUILTIN_ACHIEVEMENTS, '2026-01-01', T).state
    const again = applyEvent(state, { kind: 'turn-end', sessionId: 's' }, BUILTIN_ACHIEVEMENTS, '2026-01-01', T + 1)
    expect(again.newlyUnlocked).toHaveLength(0)
  })

  it('unlocks streak-7 at seven consecutive days', () => {
    let state = createInitialState()
    for (let i = 1; i <= 7; i += 1) {
      const day = `2026-01-${String(i).padStart(2, '0')}`
      state = applyEvent(state, { kind: 'turn-end', sessionId: 's' }, BUILTIN_ACHIEVEMENTS, day, T + i).state
    }
    expect(state.counters.streakDays).toBe(7)
    expect(unlockedIds(state)).toContain('streak-7')
  })
})

describe('yesterdayOf', () => {
  it('steps back one calendar day across month and year boundaries', () => {
    expect(yesterdayOf('2026-01-01')).toBe('2025-12-31')
    expect(yesterdayOf('2026-03-01')).toBe('2026-02-28')
    expect(yesterdayOf('2026-01-10')).toBe('2026-01-09')
  })
})
