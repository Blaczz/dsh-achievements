/**
 * Gamification display model: level progression and rarity presentation.
 * Browser-safe and pure (no node/@deepseek-ai runtime imports), so the client
 * bundle can inline it while the Host reuses the same helpers.
 */
import type { AchievementRarity, LocalizedText } from './achievements.ts'

/** XP required to advance one level: level n needs `XP_PER_LEVEL * n` XP. */
export const XP_PER_LEVEL = 100

/** Cumulative XP required to reach `level` (level 1 = 0 XP). */
export function xpForLevel(level: number): number {
  return (XP_PER_LEVEL * (level - 1) * level) / 2
}

export interface LevelInfo {
  level: number
  /** XP accumulated within the current level. */
  current: number
  /** XP needed to advance to the next level. */
  next: number
  /** Progress toward the next level, 0..1. */
  progress: number
}

/** Deterministic level + within-level progress for a total XP. */
export function levelOf(xp: number): LevelInfo {
  let level = 1
  while (xpForLevel(level + 1) <= xp) level += 1
  const current = xp - xpForLevel(level)
  const next = XP_PER_LEVEL * level
  return { level, current, next, progress: Math.min(1, current / next) }
}

export interface RarityMeta {
  label: LocalizedText
  color: string
}

/** Common → legendary visual hierarchy (readable on light and dark themes). */
export const RARITY_META: Record<AchievementRarity, RarityMeta> = {
  common: { label: { zh: '普通', en: 'Common' }, color: '#9ca3af' },
  uncommon: { label: { zh: '罕见', en: 'Uncommon' }, color: '#34d399' },
  rare: { label: { zh: '稀有', en: 'Rare' }, color: '#60a5fa' },
  epic: { label: { zh: '史诗', en: 'Epic' }, color: '#c084fc' },
  legendary: { label: { zh: '传说', en: 'Legendary' }, color: '#fbbf24' },
}
