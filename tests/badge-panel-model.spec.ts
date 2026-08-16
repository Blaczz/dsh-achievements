/** Task 22 badge-panel model: status filter + chain-derived grouping + hidden masking boundary. */
import { describe, expect, it } from 'vitest'
import { BUILTIN_ACHIEVEMENTS, toAchievementView, type AchievementView } from '../src/achievements.ts'
import { MILESTONE_CHAINS, SPECIAL_CHAINS } from '../src/share.ts'
import {
  buildMilestoneGroups,
  buildSpecialGroups,
  matchesAchievementStatus,
} from '../src/client/badge-panel-model.ts'

const RARITY_SEQUENCE = ['common', 'uncommon', 'rare', 'epic', 'legendary'] as const

const views: AchievementView[] = BUILTIN_ACHIEVEMENTS.map(toAchievementView)
const milestoneIds = new Set(MILESTONE_CHAINS.flatMap(chain => chain.achievementIds))
const specialChainIds = new Set(SPECIAL_CHAINS.flatMap(chain => chain.achievementIds))

describe('status filter', () => {
  it('all returns both locked and unlocked', () => {
    expect(matchesAchievementStatus(undefined, 'all')).toBe(true)
    expect(matchesAchievementStatus(123, 'all')).toBe(true)
  })

  it('locked returns only undefinitely-unlocked cards', () => {
    expect(matchesAchievementStatus(undefined, 'locked')).toBe(true)
    expect(matchesAchievementStatus(123, 'locked')).toBe(false)
  })

  it('unlocked returns only unlocked cards', () => {
    expect(matchesAchievementStatus(undefined, 'unlocked')).toBe(false)
    expect(matchesAchievementStatus(123, 'unlocked')).toBe(true)
  })
})

describe('milestone group derivation', () => {
  it('derives exactly seven groups, one per MILESTONE_CHAINS entry', () => {
    const groups = buildMilestoneGroups(views, {})
    expect(groups).toHaveLength(7)
    expect(groups.map(g => g.id)).toEqual(MILESTONE_CHAINS.map(c => c.id))
  })

  it('keeps the fixed common → legendary progression order per chain', () => {
    for (const group of buildMilestoneGroups(views, {})) {
      expect(group.defs.map(d => d.rarity)).toEqual([...RARITY_SEQUENCE])
      expect(group.total).toBe(5)
    }
  })

  it('reports real chain progress independent of the filter', () => {
    const unlocked = { 'first-turn': 1, 'turns-25': 2, 'turns-50': 3 }
    const turns = buildMilestoneGroups(views, unlocked).find(g => g.id === 'turns')
    expect(turns?.completed).toBe(3)
    expect(turns?.total).toBe(5)
  })

  it('marks every milestone group as a progression chain (progress bar)', () => {
    for (const group of buildMilestoneGroups(views, {})) {
      expect(group.progression).toBe(true)
    }
  })
})

describe('special group derivation', () => {
  it('residual group comes first, then every SPECIAL_CHAINS group', () => {
    const groups = buildSpecialGroups(views, {})
    expect(groups[0]?.id).toBe('residual-special')
    expect(groups.slice(1).map(g => g.id)).toEqual(SPECIAL_CHAINS.map(c => c.id))
  })

  it('residual group never swallows milestone or special-chain defs', () => {
    const groups = buildSpecialGroups(views, {})
    const residual = groups.find(g => g.id === 'residual-special')
    expect(residual).toBeDefined()
    for (const def of residual!.defs) {
      expect(milestoneIds.has(def.id)).toBe(false)
      expect(specialChainIds.has(def.id)).toBe(false)
    }
  })

  it('third-party unknown achievements fall into the residual group', () => {
    const thirdParty: AchievementView = {
      id: 'third-party-custom',
      icon: '🎖',
      title: { zh: '自定义', en: 'Custom' },
      description: { zh: '第三方', en: 'Third party' },
      rarity: 'rare',
      xp: 10,
      scope: 'session',
      hidden: false,
    }
    const groups = buildSpecialGroups([...views, thirdParty], {})
    const residual = groups.find(g => g.id === 'residual-special')
    expect(residual?.defs.some(d => d.id === 'third-party-custom')).toBe(true)
  })

  it('covers every built-in achievement exactly once', () => {
    const all = [...buildMilestoneGroups(views, {}), ...buildSpecialGroups(views, {})]
    const ids = all.flatMap(g => g.defs.map(d => d.id))
    expect(ids).toHaveLength(views.length)
    expect(new Set(ids).size).toBe(views.length)
  })

  it('shows a progress bar only for five-tier chains, not streaks / behavior / residual', () => {
    const groups = buildSpecialGroups(views, {})
    const byId = new Map(groups.map(g => [g.id, g]))
    expect(byId.get('residual-special')?.progression).toBe(false)
    expect(byId.get('streaks')?.progression).toBe(false)
    expect(byId.get('behavior')?.progression).toBe(false)
    expect(byId.get('session-marathon')?.progression).toBe(true)
    expect(byId.get('turn-depth')?.progression).toBe(true)
    expect(byId.get('tool-barrage')?.progression).toBe(true)
    expect(byId.get('time-anomaly')?.progression).toBe(true)
  })
})

describe('hidden achievement boundary', () => {
  it('grouping only carries the chain title, never a hidden achievement title', () => {
    const groups = buildSpecialGroups(views, {})
    const anomaly = groups.find(g => g.id === 'time-anomaly')
    expect(anomaly).toBeDefined()
    expect(anomaly?.title.zh).toBe('时间异象')
    expect(anomaly?.defs.every(d => d.hidden)).toBe(true)
  })

  it('filter decision reads only the unlock timestamp, not hidden fields', () => {
    const hidden = views.find(d => d.id === 'request-duration-30s')
    expect(hidden).toBeDefined()
    expect(matchesAchievementStatus(undefined, 'locked')).toBe(true)
    expect(matchesAchievementStatus(undefined, 'unlocked')).toBe(false)
  })
})
