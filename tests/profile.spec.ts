/** Agent Profile + Session Summary derivations: persona, rarity, favorite tool, delta. */
import { describe, expect, it } from 'vitest'
import { BUILTIN_ACHIEVEMENTS, toAchievementView } from '../src/achievements.ts'
import {
  buildProfileView, buildSessionSummary, favoriteToolOf, personaOf, raritySummaryOf,
} from '../src/profile.ts'
import type { ProfileState, SessionAchievementState } from '../src/state.ts'
import { createInitialProfile, createInitialSessionState, createInitialState } from '../src/state.ts'

const VIEWS = BUILTIN_ACHIEVEMENTS.map(toAchievementView)

function session(overrides: Partial<SessionAchievementState>): SessionAchievementState {
  return { ...createInitialSessionState(), ...overrides }
}

function fileMap(count: number, prefix = 'f'): Record<string, number> {
  const out: Record<string, number> = {}
  for (let i = 0; i < count; i += 1) out[`${prefix}${i}`] = 1
  return out
}

describe('personaOf', () => {
  it('defaults to Explorer with no session', () => {
    expect(personaOf(undefined).id).toBe('explorer')
  })

  it('Perfectionist: repeatedly edits the same file', () => {
    expect(personaOf(session({ filesEdited: { 'a.ts': 4 } })).id).toBe('perfectionist')
  })

  it('Detective: reads a lot, edits little', () => {
    expect(personaOf(session({ filesRead: fileMap(12), filesEdited: { 'x.ts': 2 } })).id).toBe('detective')
  })

  it('Cowboy: edits a lot before the first test', () => {
    expect(personaOf(session({ filesEdited: fileMap(6, 'e'), editsBeforeFirstTest: 6 })).id).toBe('cowboy')
  })

  it('Test-Driven: tests often, edits carefully', () => {
    const s = session({ filesEdited: { 'a.ts': 1, 'b.ts': 1 }, tests: { runs: 5, passed: 4, failed: 1, lastOutcome: 'pass' } })
    expect(personaOf(s).id).toBe('test-driven')
  })

  it('Explorer: a quiet session matches nothing', () => {
    expect(personaOf(session({})).id).toBe('explorer')
  })
})

describe('raritySummaryOf', () => {
  it('counts totals and unlocked per rarity across the builtins', () => {
    const summary = raritySummaryOf(VIEWS, {})
    expect(summary.common.total).toBe(3)
    expect(summary.uncommon.total).toBe(4)
    expect(summary.rare.total).toBe(3)
    expect(summary.epic.total).toBe(3)
    expect(summary.legendary.total).toBe(1)
    for (const count of Object.values(summary)) expect(count.unlocked).toBe(0)
  })

  it('marks unlocked counts by rarity', () => {
    const summary = raritySummaryOf(VIEWS, { 'first-turn': 1, 'streak-7': 2 })
    expect(summary.common.unlocked).toBe(1)
    expect(summary.legendary.unlocked).toBe(1)
    expect(summary.epic.unlocked).toBe(0)
  })
})

describe('favoriteToolOf', () => {
  it('returns the most-used tool, first-wins on ties', () => {
    const profile: ProfileState = { ...createInitialProfile(), toolsByName: { read: 5, bash: 3 } }
    expect(favoriteToolOf(profile)).toBe('read')
  })

  it('returns null with no tool usage', () => {
    expect(favoriteToolOf(createInitialProfile())).toBeNull()
  })
})

describe('buildSessionSummary', () => {
  it('returns null for an absent session bucket', () => {
    expect(buildSessionSummary(createInitialState(), 'nope')).toBeNull()
  })

  it('summarizes a session and computes its XP delta + level-up', () => {
    const state = createInitialState()
    state.profile.xp = 150
    state.profile.unlocked = { 'first-turn': 1, 'first-tool': 2 }
    state.sessions.s1 = session({
      toolCalls: 10,
      filesRead: { 'a.ts': 2, 'b.ts': 1, 'c.ts': 1 },
      filesEdited: { 'x.ts': 3 },
      tests: { runs: 3, passed: 2, failed: 1, lastOutcome: 'pass' },
      unlocked: ['first-turn', 'first-tool'],
      xpGained: 150,
    })
    const summary = buildSessionSummary(state, 's1')!
    expect(summary.toolCalls).toBe(10)
    expect(summary.filesRead).toBe(3)
    expect(summary.filesEdited).toBe(1)
    expect(summary.tests).toBe(3)
    expect(summary.failures).toBe(1)
    expect(summary.unlocked).toEqual(['first-turn', 'first-tool'])
    expect(summary.xpGained).toBe(150)
    expect(summary.levelUp).toEqual({ from: 1, to: 2 })
  })

  it('reports no level-up when the XP delta stays within one level', () => {
    const state = createInitialState()
    state.profile.xp = 50
    state.sessions.s1 = session({ xpGained: 50, toolCalls: 1 })
    expect(buildSessionSummary(state, 's1')!.levelUp).toBeNull()
  })
})

describe('buildProfileView', () => {
  it('assembles level, counts, rarity, favorite tool, and persona', () => {
    const state = createInitialState()
    state.profile.xp = 100
    state.profile.unlocked = { 'first-turn': 1 }
    state.profile.toolsByName = { read: 7 }
    state.sessions.s1 = session({ filesRead: fileMap(12) })
    const view = buildProfileView(state, VIEWS)
    expect(view.level.level).toBe(2)
    expect(view.unlockedCount).toBe(1)
    expect(view.totalCount).toBe(14)
    expect(view.favoriteTool).toBe('read')
    expect(view.persona.id).toBe('detective')
    expect(view.rarity.common.unlocked).toBe(1)
  })
})
