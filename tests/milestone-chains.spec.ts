/** P6 catalog invariants: 48 built-ins, seven five-tier chains, legacy metadata lock. */
import { describe, expect, it } from 'vitest'
import { BUILTIN_ACHIEVEMENTS, type AchievementDef } from '../src/achievements.ts'
import { MILESTONE_CHAINS } from '../src/share.ts'
import { createInitialProfile, createInitialSessionState } from '../src/state.ts'

const RARITY_SEQUENCE = ['common', 'uncommon', 'rare', 'epic', 'legendary'] as const

function byId(): Map<string, AchievementDef> {
  return new Map(BUILTIN_ACHIEVEMENTS.map(d => [d.id, d]))
}

function targetOf(def: AchievementDef): number | undefined {
  return def.evaluate({ profile: createInitialProfile(), session: createInitialSessionState() }).target
}

describe('built-in catalog invariants (P6)', () => {
  it('ships exactly 48 built-in achievements with unique ids', () => {
    expect(BUILTIN_ACHIEVEMENTS).toHaveLength(48)
    const ids = BUILTIN_ACHIEVEMENTS.map(d => d.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('has exactly seven milestone chains of five nodes each', () => {
    expect(MILESTONE_CHAINS).toHaveLength(7)
    for (const chain of MILESTONE_CHAINS) expect(chain.achievementIds).toHaveLength(5)
  })

  it('each milestone chain resolves to lifetime defs in the fixed rarity sequence', () => {
    const defs = byId()
    for (const chain of MILESTONE_CHAINS) {
      const chainDefs = chain.achievementIds.map(id => defs.get(id))
      for (const def of chainDefs) {
        expect(def, `${chain.id} has a missing id`).toBeDefined()
        expect(def?.scope).toBe('lifetime')
      }
      expect(chainDefs.map(d => d!.rarity)).toEqual([...RARITY_SEQUENCE])
    }
  })

  it('each milestone chain has strictly increasing thresholds', () => {
    const defs = byId()
    for (const chain of MILESTONE_CHAINS) {
      const targets = chain.achievementIds.map(id => {
        const target = targetOf(defs.get(id)!)
        expect(target, `${chain.id}/${id} target`).toBeTypeOf('number')
        return target!
      })
      for (let i = 1; i < targets.length; i += 1) {
        expect(targets[i]!, `${chain.id} threshold ${i}`).toBeGreaterThan(targets[i - 1]!)
      }
    }
  })

  it('all 35 milestone ids are globally unique', () => {
    const ids = MILESTONE_CHAINS.flatMap(c => c.achievementIds)
    expect(ids).toHaveLength(35)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('legacy metadata lock (P6 must not reprice)', () => {
  const LIFETIME_LEGACY: Record<string, { rarity: string; xp: number; threshold?: number }> = {
    'first-turn': { rarity: 'common', xp: 10, threshold: 1 },
    'ten-turns': { rarity: 'common', xp: 20, threshold: 10 },
    'hundred-turns': { rarity: 'epic', xp: 200, threshold: 100 },
    'first-tool': { rarity: 'common', xp: 10, threshold: 1 },
    'hundred-tools': { rarity: 'rare', xp: 150, threshold: 100 },
    'ten-sessions': { rarity: 'uncommon', xp: 50, threshold: 10 },
    'streak-3': { rarity: 'uncommon', xp: 50, threshold: 3 },
    'streak-7': { rarity: 'legendary', xp: 500, threshold: 7 },
  }

  const BEHAVIOR_LEGACY: Record<string, { rarity: string; xp: number }> = {
    'deja-vu': { rarity: 'uncommon', xp: 30 },
    'rabbit-hole': { rarity: 'rare', xp: 40 },
    'yolo': { rarity: 'epic', xp: 60 },
    'it-works-eventually': { rarity: 'epic', xp: 80 },
    'surely-this-time': { rarity: 'rare', xp: 50 },
    'one-shot': { rarity: 'epic', xp: 50 },
    'librarian': { rarity: 'uncommon', xp: 20 },
    'touch-grass': { rarity: 'uncommon', xp: 30 },
    'dependency-archaeologist': { rarity: 'epic', xp: 50 },
    'gigachad': { rarity: 'legendary', xp: 100 },
  }

  it('preserves all 8 legacy lifetime rarity / XP / threshold / scope', () => {
    const defs = byId()
    for (const [id, meta] of Object.entries(LIFETIME_LEGACY)) {
      const def = defs.get(id)
      expect(def, id).toBeDefined()
      expect(def!.rarity).toBe(meta.rarity)
      expect(def!.xp).toBe(meta.xp)
      expect(def!.scope).toBe('lifetime')
      expect(targetOf(def!)).toBe(meta.threshold)
    }
  })

  it('preserves all 10 behavior rarity / XP / scope', () => {
    const defs = byId()
    for (const [id, meta] of Object.entries(BEHAVIOR_LEGACY)) {
      const def = defs.get(id)
      expect(def, id).toBeDefined()
      expect(def!.rarity).toBe(meta.rarity)
      expect(def!.xp).toBe(meta.xp)
      expect(def!.scope).toBe('session')
    }
  })
})
