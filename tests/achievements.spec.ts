/** Pure engine tests: legacy counter unlock rules (unchanged behavior) + the v2 context/evaluate model. */
import { describe, expect, it } from 'vitest'
import {
  applyEvent, BUILTIN_ACHIEVEMENTS, computeProgress, fromCounterCondition, toAchievementView,
} from '../src/achievements.ts'
import type { AchievementDef } from '../src/achievements.ts'
import type { AchievementEvent } from '../src/events.ts'
import { buildContext } from '../src/reducer.ts'
import type { AchievementState } from '../src/state.ts'
import { createInitialSessionState, createInitialState } from '../src/state.ts'

const T = 1_700_000_000_000

function unlockedIds(state: AchievementState): string[] {
  return Object.keys(state.profile.unlocked)
}

function turnEnd(sessionId: string, seq: number): AchievementEvent {
  return { kind: 'turn-end', sessionId, seq }
}

function toolCall(sessionId: string, seq: number): AchievementEvent {
  return { kind: 'tool-call', sessionId, seq, callId: null, tool: { kind: 'other', name: 'tool' }, isError: false }
}

function fileRead(sessionId: string, seq: number, path: string): AchievementEvent {
  return { kind: 'tool-call', sessionId, seq, callId: null, tool: { kind: 'file-read', name: 'read', path }, isError: false }
}

describe('achievement engine (legacy counters, v2 model)', () => {
  it('unlocks first-turn on the very first turn-end', () => {
    const result = applyEvent(createInitialState(), turnEnd('s1', 0), BUILTIN_ACHIEVEMENTS, '2026-01-01', T)
    expect(result.newlyUnlocked.map(d => d.id)).toContain('first-turn')
    expect(result.state.profile.turns).toBe(1)
  })

  it('unlocks ten-turns exactly at 10, not before', () => {
    let state = createInitialState()
    for (let i = 0; i < 9; i += 1) {
      state = applyEvent(state, turnEnd('s1', i), BUILTIN_ACHIEVEMENTS, '2026-01-01', T + i).state
    }
    expect(unlockedIds(state)).not.toContain('ten-turns')
    const tenth = applyEvent(state, turnEnd('s1', 9), BUILTIN_ACHIEVEMENTS, '2026-01-01', T + 9)
    expect(tenth.newlyUnlocked.map(d => d.id)).toContain('ten-turns')
  })

  it('unlocks first-tool at 1 and hundred-tools at 100', () => {
    let state = createInitialState()
    state = applyEvent(state, toolCall('s1', 0), BUILTIN_ACHIEVEMENTS, '2026-01-01', T).state
    expect(unlockedIds(state)).toContain('first-tool')
    for (let i = 0; i < 98; i += 1) {
      state = applyEvent(state, toolCall('s1', i + 1), BUILTIN_ACHIEVEMENTS, '2026-01-01', T + i).state
    }
    expect(unlockedIds(state)).not.toContain('hundred-tools')
    state = applyEvent(state, toolCall('s1', 99), BUILTIN_ACHIEVEMENTS, '2026-01-01', T + 99).state
    expect(unlockedIds(state)).toContain('hundred-tools')
  })

  it('counts distinct sessions for ten-sessions', () => {
    let state = createInitialState()
    for (let i = 0; i < 10; i += 1) {
      state = applyEvent(state, turnEnd(`s${i}`, i), BUILTIN_ACHIEVEMENTS, '2026-01-01', T + i).state
    }
    expect(state.profile.sessions).toBe(10)
    expect(unlockedIds(state)).toContain('ten-sessions')
  })

  it('does not double-count the same session id', () => {
    let state = createInitialState()
    state = applyEvent(state, turnEnd('s1', 0), BUILTIN_ACHIEVEMENTS, '2026-01-01', T).state
    state = applyEvent(state, turnEnd('s1', 1), BUILTIN_ACHIEVEMENTS, '2026-01-01', T + 1).state
    expect(state.profile.sessions).toBe(1)
  })

  it('builds a streak across consecutive days and resets on a gap', () => {
    let state = createInitialState()
    state = applyEvent(state, turnEnd('s', 0), BUILTIN_ACHIEVEMENTS, '2026-01-01', T).state
    expect(state.profile.currentStreak).toBe(1)
    state = applyEvent(state, turnEnd('s', 1), BUILTIN_ACHIEVEMENTS, '2026-01-02', T + 1).state
    expect(state.profile.currentStreak).toBe(2)
    state = applyEvent(state, turnEnd('s', 2), BUILTIN_ACHIEVEMENTS, '2026-01-03', T + 2).state
    expect(state.profile.currentStreak).toBe(3)
    expect(unlockedIds(state)).toContain('streak-3')
    // Gap day resets the streak.
    state = applyEvent(state, turnEnd('s', 3), BUILTIN_ACHIEVEMENTS, '2026-01-05', T + 3).state
    expect(state.profile.currentStreak).toBe(1)
    expect(state.profile.longestStreak).toBe(3)
  })

  it('does not grow the streak twice within the same day', () => {
    let state = createInitialState()
    state = applyEvent(state, turnEnd('s', 0), BUILTIN_ACHIEVEMENTS, '2026-01-01', T).state
    state = applyEvent(state, turnEnd('s', 1), BUILTIN_ACHIEVEMENTS, '2026-01-01', T + 1).state
    expect(state.profile.currentStreak).toBe(1)
  })

  it('returns each achievement exactly once (idempotent)', () => {
    let state = createInitialState()
    state = applyEvent(state, turnEnd('s', 0), BUILTIN_ACHIEVEMENTS, '2026-01-01', T).state
    const again = applyEvent(state, turnEnd('s', 1), BUILTIN_ACHIEVEMENTS, '2026-01-01', T + 1)
    expect(again.newlyUnlocked).toHaveLength(0)
  })

  it('unlocks streak-7 at seven consecutive days', () => {
    let state = createInitialState()
    for (let i = 1; i <= 7; i += 1) {
      const day = `2026-01-${String(i).padStart(2, '0')}`
      state = applyEvent(state, turnEnd('s', i), BUILTIN_ACHIEVEMENTS, day, T + i).state
    }
    expect(state.profile.currentStreak).toBe(7)
    expect(unlockedIds(state)).toContain('streak-7')
  })
})

describe('achievement domain model v2', () => {
  it('wraps a v1 counter condition into an evaluate(ctx) definition', () => {
    const def = fromCounterCondition(
      { id: 'x', icon: '❓', title: { zh: 'X', en: 'X' }, description: { zh: 'x', en: 'x' } },
      c => c.turns >= 5,
      { rarity: 'rare', xp: 80, scope: 'lifetime' },
    )
    expect(def.rarity).toBe('rare')
    expect(def.xp).toBe(80)
    expect(def.scope).toBe('lifetime')
    const state = createInitialState()
    const reached = { ...state, profile: { ...state.profile, turns: 5 } }
    expect(def.evaluate({ profile: reached.profile, session: createInitialSessionState() }).unlocked).toBe(true)
  })

  it('lets a session-scoped achievement read ctx.session, not lifetime', () => {
    const def: AchievementDef = {
      id: 'read-twice', icon: '📖', title: { zh: '复读', en: 'Re-read' }, description: { zh: '同一文件读两次', en: 'Read one file twice' },
      rarity: 'uncommon', xp: 30, scope: 'session',
      evaluate: ctx => ({ unlocked: (ctx.session.filesRead['a.txt'] ?? 0) >= 2, progress: ctx.session.filesRead['a.txt'] ?? 0, target: 2 }),
    }
    let state = createInitialState()
    state = applyEvent(state, fileRead('s1', 0, 'a.txt'), [def], '2026-01-01', T).state
    expect(unlockedIds(state)).not.toContain('read-twice')
    const second = applyEvent(state, fileRead('s1', 1, 'a.txt'), [def], '2026-01-01', T + 1)
    expect(second.newlyUnlocked.map(d => d.id)).toContain('read-twice')
  })

  it('surfaces progress/target from evaluate without affecting unlock logic', () => {
    const def: AchievementDef = {
      id: 'prog', icon: '📊', title: { zh: '进度', en: 'Progress' }, description: { zh: 'p', en: 'p' },
      rarity: 'common', xp: 0, scope: 'lifetime',
      evaluate: () => ({ unlocked: false, progress: 3, target: 10 }),
    }
    const state = createInitialState()
    const result = applyEvent(state, turnEnd('s', 0), [def], '2026-01-01', T)
    expect(unlockedIds(result.state)).toHaveLength(0)
  })

  it('strips the evaluate predicate in toAchievementView', () => {
    const view = toAchievementView(BUILTIN_ACHIEVEMENTS[0]!)
    expect('evaluate' in view).toBe(false)
    expect(view.id).toBe('first-turn')
    expect(view.rarity).toBe('common')
    expect(view.scope).toBe('lifetime')
    expect(view.hidden).toBe(false)
  })
})

describe('XP accumulation', () => {
  it('grants XP exactly once per achievement', () => {
    const first = applyEvent(createInitialState(), turnEnd('s1', 0), BUILTIN_ACHIEVEMENTS, '2026-01-01', T)
    expect(first.state.profile.xp).toBe(10) // first-turn = +10
    const second = applyEvent(first.state, turnEnd('s1', 1), BUILTIN_ACHIEVEMENTS, '2026-01-01', T + 1)
    expect(second.newlyUnlocked).toHaveLength(0)
    expect(second.state.profile.xp).toBe(10) // no double XP
  })

  it('accumulates XP across distinct unlocks', () => {
    let state = createInitialState()
    state = applyEvent(state, turnEnd('s1', 0), BUILTIN_ACHIEVEMENTS, '2026-01-01', T).state // +10
    state = applyEvent(state, toolCall('s1', 0), BUILTIN_ACHIEVEMENTS, '2026-01-01', T).state // first-tool +10
    expect(state.profile.xp).toBe(20)
  })

  it('records the session-scoped unlock list and XP delta', () => {
    let state = createInitialState()
    state = applyEvent(state, turnEnd('s1', 0), BUILTIN_ACHIEVEMENTS, '2026-01-01', T).state // first-turn
    state = applyEvent(state, toolCall('s1', 0), BUILTIN_ACHIEVEMENTS, '2026-01-01', T).state // first-tool
    expect(state.sessions.s1?.unlocked).toEqual(['first-turn', 'first-tool'])
    expect(state.sessions.s1?.xpGained).toBe(20)
  })
})

describe('computeProgress', () => {
  it('reports progress/target only for defs that declare them', () => {
    const def: AchievementDef = {
      id: 'prog', icon: '📊', title: { zh: '进度', en: 'Progress' }, description: { zh: 'p', en: 'p' },
      rarity: 'common', xp: 0, scope: 'lifetime',
      evaluate: () => ({ unlocked: false, progress: 3, target: 10 }),
    }
    const counter = fromCounterCondition(
      { id: 'c', icon: '❓', title: { zh: 'C', en: 'C' }, description: { zh: 'c', en: 'c' } },
      () => false,
    )
    const ctx = buildContext(createInitialState(), 's')
    expect(computeProgress([def, counter], ctx)).toEqual({ prog: { progress: 3, target: 10 } })
  })
})
