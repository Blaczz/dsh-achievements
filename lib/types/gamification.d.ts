/**
 * Gamification display model: level progression and rarity presentation.
 * Browser-safe and pure (no node/@deepseek-ai runtime imports), so the client
 * bundle can inline it while the Host reuses the same helpers.
 */
import type { AchievementRarity, LocalizedText } from './achievements.ts';
/** XP required to advance one level: level n needs `XP_PER_LEVEL * n` XP. */
export declare const XP_PER_LEVEL = 100;
/** Cumulative XP required to reach `level` (level 1 = 0 XP). */
export declare function xpForLevel(level: number): number;
export interface LevelInfo {
    level: number;
    /** XP accumulated within the current level. */
    current: number;
    /** XP needed to advance to the next level. */
    next: number;
    /** Progress toward the next level, 0..1. */
    progress: number;
}
/** Deterministic level + within-level progress for a total XP. */
export declare function levelOf(xp: number): LevelInfo;
export interface RarityMeta {
    label: LocalizedText;
    color: string;
}
/** Common → legendary visual hierarchy (readable on light and dark themes). */
export declare const RARITY_META: Record<AchievementRarity, RarityMeta>;
