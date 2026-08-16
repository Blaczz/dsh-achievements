/**
 * Sharing + community layer (v1.0): shareable achievement cards, a local
 * "Agent Wrapped" summary, and achievement chains. Everything here is
 * browser-safe and pure, and every export is privacy-safe by construction —
 * it only reads aggregate counters, achievement metadata, and persona/level;
 * it never reads file paths, command strings, or any session detail.
 */
import { type LevelInfo } from './gamification.ts';
import { type Persona } from './profile.ts';
import type { AchievementRarity, AchievementView } from './achievements.ts';
import type { AchievementState } from './state.ts';
export interface AchievementCard {
    id: string;
    icon: string;
    title: AchievementView['title'];
    description: AchievementView['description'];
    rarity: AchievementRarity;
    xp: number;
    unlockedAt: number;
}
export declare function buildAchievementCard(view: AchievementView, unlockedAt: number): AchievementCard;
export interface AgentWrapped {
    persona: Persona;
    level: LevelInfo;
    xp: number;
    unlockedCount: number;
    totalCount: number;
    turns: number;
    toolCalls: number;
    sessions: number;
    longestStreak: number;
    favoriteTool: string | null;
    topUnlock: AchievementCard | null;
    recentUnlock: AchievementCard | null;
}
export declare function buildAgentWrapped(state: AchievementState, views: readonly AchievementView[]): AgentWrapped;
export declare function buildShareText(state: AchievementState, views: readonly AchievementView[], locale?: 'zh' | 'en'): string;
export interface AchievementChain {
    id: string;
    title: AchievementView['title'];
    achievementIds: readonly string[];
}
export interface ChainProgress {
    chain: AchievementChain;
    completed: number;
    total: number;
    /** Next uncompleted achievement id, or null when the chain is complete. */
    nextId: string | null;
    done: boolean;
}
export declare function chainProgressOf(chain: AchievementChain, unlocked: Record<string, number>): ChainProgress;
/**
 * The seven formal five-tier Lifetime progression chains. Each has exactly five
 * nodes ordered common → uncommon → rare → epic → legendary (see Task 17), and
 * drives the Badge Wall's milestone grouping — the UI derives milestone ids from
 * these chains rather than hardcoding them.
 */
export declare const MILESTONE_CHAINS: readonly AchievementChain[];
/** Non-progression special chains: streaks + session behavior. */
export declare const SPECIAL_CHAINS: readonly AchievementChain[];
/** Every built-in chain: seven milestone lines first, then special chains. */
export declare const BUILTIN_CHAINS: readonly AchievementChain[];
