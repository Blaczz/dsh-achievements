/** P6 silent lifetime reconciliation: backfill once, never touch session attribution. */
import { describe, expect, it } from 'vitest'
import { BUILTIN_ACHIEVEMENTS, reconcileLifetimeAchievements, type AchievementDef } from '../src/achievements.ts'
import { createInitialSessionState, createInitialState } from '../src/state.ts'

const T = 1_700_000_000_000

const TURNS_IDS = ['first-turn', 'turns-25', 'turns-50', 'hundred-turns', 'turns-500']

function turnsDefs(): AchievementDef[] {
  return TURNS_IDS.map(id => BUILTIN_ACHIEVEMENTS.find(d => d.id === id)!)
}

function stateWithTurns(turns: number) {
  const state = createInitialState()
  state.profile.turns = turns
  return state
}

describe('reconcileLifetimeAchievements', () => {
  it('unlocks every satisfied lifetime milestone and awards XP once', () => {
    const before = stateWithTurns(500)
    const result = reconcileLifetimeAchievements(before, turnsDefs(), T)
    expect(result.newlyUnlocked.map(d => d.id)).toEqual(TURNS_IDS)
    // 10 + 30 + 75 + 200 + 400
    expect(result.xpGained).toBe(715)
    expect(result.state.profile.xp).toBe(715)
    for (const id of TURNS_IDS) expect(result.state.profile.unlocked[id]).toBe(T)
  })

  it('leaves a not-yet-satisfied milestone locked', () => {
    const result = reconcileLifetimeAchievements(stateWithTurns(24), turnsDefs(), T)
    expect(result.newlyUnlocked.map(d => d.id)).toEqual(['first-turn'])
    expect(result.state.profile.unlocked['turns-25']).toBeUndefined()
  })

  it('ignores session-scope defs even when their evaluate holds', () => {
    const sessionDef: AchievementDef = {
      id: 'always', icon: '❓', title: { zh: 'x', en: 'x' }, description: { zh: 'x', en: 'x' },
      rarity: 'common', xp: 10, scope: 'session',
      evaluate: () => ({ unlocked: true }),
    }
    const result = reconcileLifetimeAchievements(createInitialState(), [sessionDef], T)
    expect(result.newlyUnlocked).toHaveLength(0)
    expect(result.xpGained).toBe(0)
    expect(result.state.profile.unlocked['always']).toBeUndefined()
  })

  it('is idempotent: a second pass adds nothing and keeps timestamps', () => {
    const first = reconcileLifetimeAchievements(stateWithTurns(500), turnsDefs(), T)
    const second = reconcileLifetimeAchievements(first.state, turnsDefs(), T + 1000)
    expect(second.newlyUnlocked).toHaveLength(0)
    expect(second.xpGained).toBe(0)
    expect(second.state.profile.xp).toBe(first.state.profile.xp)
    for (const id of TURNS_IDS) expect(second.state.profile.unlocked[id]).toBe(T)
  })

  it('never mutates session buckets', () => {
    const before = stateWithTurns(500)
    before.sessions.s1 = { ...createInitialSessionState(), toolCalls: 3 }
    const result = reconcileLifetimeAchievements(before, turnsDefs(), T)
    expect(result.state.sessions).toEqual(before.sessions)
  })

  it('does not touch profile counters (turns/toolCalls etc.)', () => {
    const before = stateWithTurns(500)
    const result = reconcileLifetimeAchievements(before, turnsDefs(), T)
    expect(result.state.profile.turns).toBe(500)
    expect(result.state.profile.toolCalls).toBe(0)
    expect(result.state.profile.fileReads).toBe(0)
  })

  it('respects an already-unlocked lifetime achievement (no re-award)', () => {
    const before = stateWithTurns(500)
    before.profile.unlocked['first-turn'] = 111
    before.profile.xp = 10
    const result = reconcileLifetimeAchievements(before, turnsDefs(), T)
    expect(result.newlyUnlocked.map(d => d.id)).toEqual(['turns-25', 'turns-50', 'hundred-turns', 'turns-500'])
    expect(result.state.profile.unlocked['first-turn']).toBe(111)
    expect(result.state.profile.xp).toBe(10 + 30 + 75 + 200 + 400)
  })
})
