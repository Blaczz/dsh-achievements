/** Gamification display model: level progression + rarity presentation. */
import { describe, expect, it } from 'vitest'
import { RARITY_META, levelOf, xpForLevel } from '../src/gamification.ts'

describe('levelOf', () => {
  it('starts at level 1 with zero XP', () => {
    expect(levelOf(0)).toEqual({ level: 1, current: 0, next: 100, progress: 0 })
  })

  it('advances exactly at the level boundary', () => {
    expect(levelOf(99).level).toBe(1)
    expect(levelOf(100)).toEqual({ level: 2, current: 0, next: 200, progress: 0 })
  })

  it('reports within-level progress deterministically', () => {
    expect(levelOf(50)).toEqual({ level: 1, current: 50, next: 100, progress: 0.5 })
    expect(levelOf(300)).toEqual({ level: 3, current: 0, next: 300, progress: 0 })
    expect(levelOf(1000)).toEqual({ level: 5, current: 0, next: 500, progress: 0 })
  })

  it('caps progress at 1 even past the next threshold (defensive)', () => {
    expect(levelOf(1000).progress).toBe(0)
    expect(levelOf(1280)).toEqual({ level: 5, current: 280, next: 500, progress: 0.56 })
  })
})

describe('xpForLevel', () => {
  it('is cumulative across levels', () => {
    expect(xpForLevel(1)).toBe(0)
    expect(xpForLevel(2)).toBe(100)
    expect(xpForLevel(3)).toBe(300)
    expect(xpForLevel(5)).toBe(1000)
    expect(xpForLevel(6)).toBe(1500)
  })
})

describe('RARITY_META', () => {
  it('covers all five rarities with a hex color and bilingual labels', () => {
    const rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary'] as const
    for (const rarity of rarities) {
      expect(RARITY_META[rarity].color).toMatch(/^#[0-9a-f]{6}$/)
      expect(RARITY_META[rarity].label.zh.length).toBeGreaterThan(0)
      expect(RARITY_META[rarity].label.en.length).toBeGreaterThan(0)
    }
  })
})
