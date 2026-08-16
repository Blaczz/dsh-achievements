/** Sharing + community layer: card, share text (privacy-safe), wrapped, chains. */
import { describe, expect, it } from 'vitest'
import { BUILTIN_ACHIEVEMENTS, toAchievementView } from '../src/achievements.ts'
import {
  BUILTIN_CHAINS, MILESTONE_CHAINS, SPECIAL_CHAINS, TRAJECTORY_CHAINS, buildAchievementCard, buildAgentWrapped, buildShareText, chainProgressOf,
} from '../src/share.ts'
import { createInitialSessionState, createInitialState } from '../src/state.ts'

const VIEWS = BUILTIN_ACHIEVEMENTS.map(toAchievementView)

describe('buildAchievementCard', () => {
  it('projects a view + unlock timestamp into a card', () => {
    const card = buildAchievementCard(VIEWS[0]!, 1234)
    expect(card.id).toBe('first-turn')
    expect(card.unlockedAt).toBe(1234)
    expect(card.rarity).toBe('common')
  })
})

describe('buildShareText', () => {
  it('sorts unlocked achievements by rarity (legendary first)', () => {
    const state = createInitialState()
    state.profile.xp = 100
    state.profile.unlocked = { 'first-turn': 1, 'streak-7': 2 }
    const text = buildShareText(state, VIEWS)
    expect(text).toContain('Lv.2')
    expect(text).toContain('2/68')
    const legendary = text.indexOf('七日火山')
    const common = text.indexOf('初次登场')
    expect(legendary).toBeGreaterThan(-1)
    expect(common).toBeGreaterThan(-1)
    expect(legendary).toBeLessThan(common)
  })

  it('never leaks file paths or command strings', () => {
    const state = createInitialState()
    state.profile.unlocked = { 'first-turn': 1 }
    state.sessions.s1 = {
      ...createInitialSessionState(),
      filesRead: { '/secret/project/a.ts': 2 },
      filesEdited: { '/secret/project/b.ts': 1 },
      commands: { 'cat /etc/passwd': 3 },
    }
    const text = buildShareText(state, VIEWS)
    expect(text).not.toContain('/secret')
    expect(text).not.toContain('/etc/passwd')
    expect(text).not.toContain('a.ts')
  })
})

describe('buildAgentWrapped', () => {
  it('aggregates persona, level, top and recent unlocks without a cloud account', () => {
    const state = createInitialState()
    state.profile.xp = 100
    state.profile.turns = 7
    state.profile.toolCalls = 30
    state.profile.sessions = 2
    state.profile.longestStreak = 3
    state.profile.toolsByName = { read: 5 }
    state.profile.unlocked = { 'first-turn': 100, 'streak-7': 200 }
    state.sessions.s1 = { ...createInitialSessionState(), filesRead: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`f${i}`, 1])) }
    const wrapped = buildAgentWrapped(state, VIEWS)
    expect(wrapped.level.level).toBe(2)
    expect(wrapped.turns).toBe(7)
    expect(wrapped.favoriteTool).toBe('read')
    expect(wrapped.persona.id).toBe('detective')
    expect(wrapped.topUnlock?.id).toBe('streak-7')
    expect(wrapped.recentUnlock?.id).toBe('streak-7')
  })
})

describe('achievement chains', () => {
  it('computes progress and the next step for the five-tier turns chain', () => {
    const chain = MILESTONE_CHAINS[0]!
    expect(chainProgressOf(chain, {})).toEqual({ chain, completed: 0, total: 5, nextId: 'first-turn', done: false })
    expect(chainProgressOf(chain, { 'first-turn': 1 }).completed).toBe(1)
    expect(chainProgressOf(chain, { 'first-turn': 1, 'turns-25': 2, 'turns-50': 3 }).nextId).toBe('hundred-turns')
    expect(chainProgressOf(chain, { 'first-turn': 1, 'turns-25': 2, 'turns-50': 3, 'hundred-turns': 4, 'turns-500': 5 }).done).toBe(true)
  })

  it('splits seven milestone chains from the special chains', () => {
    expect(MILESTONE_CHAINS).toHaveLength(7)
    expect(SPECIAL_CHAINS.map(c => c.id)).toEqual(['streaks', 'behavior', 'session-marathon', 'turn-depth', 'tool-barrage', 'time-anomaly'])
    expect(BUILTIN_CHAINS).toEqual([...MILESTONE_CHAINS, ...SPECIAL_CHAINS])
  })

  it('exposes the four P7 trajectory chains with five nodes each', () => {
    expect(TRAJECTORY_CHAINS.map(c => c.id)).toEqual(['session-marathon', 'turn-depth', 'tool-barrage', 'time-anomaly'])
    for (const chain of TRAJECTORY_CHAINS) expect(chain.achievementIds).toHaveLength(5)
    // Every trajectory chain is also surfaced as a special-chain progress row.
    for (const chain of TRAJECTORY_CHAINS) expect(SPECIAL_CHAINS).toContain(chain)
  })

  it('only references built-in achievement ids', () => {
    const ids = new Set(VIEWS.map(v => v.id))
    for (const chain of BUILTIN_CHAINS) {
      for (const id of chain.achievementIds) expect(ids.has(id), id).toBe(true)
    }
  })
})
