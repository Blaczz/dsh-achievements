/**
 * Agent Profile + Session Summary derivations. Browser-safe pure functions —
 * only type imports from state/achievements and the pure `levelOf` from
 * gamification — so the client bundle inlines them without pulling in node
 * or @deepseek-ai runtime code.
 */
import { type LevelInfo } from './gamification.ts';
import type { AchievementRarity, AchievementView, LocalizedText } from './achievements.ts';
import type { AchievementState, ProfileState, SessionAchievementState } from './state.ts';
export interface Persona {
    id: string;
    title: LocalizedText;
    description: LocalizedText;
}
/** Deterministic persona from one session's behavior. Priority: first match wins. */
export declare function personaOf(session: SessionAchievementState | undefined): Persona;
export interface RarityCount {
    unlocked: number;
    total: number;
}
export declare function raritySummaryOf(views: readonly AchievementView[], unlocked: Record<string, number>): Record<AchievementRarity, RarityCount>;
export declare function favoriteToolOf(profile: ProfileState): string | null;
export interface ProfileViewModel {
    level: LevelInfo;
    xp: number;
    unlockedCount: number;
    totalCount: number;
    rarity: Record<AchievementRarity, RarityCount>;
    favoriteTool: string | null;
    persona: Persona;
}
/** Assemble the Agent Profile from raw state + views (persona uses the latest session). */
export declare function buildProfileView(state: AchievementState, views: readonly AchievementView[]): ProfileViewModel;
export interface SessionSummary {
    sessionId: string;
    toolCalls: number;
    filesRead: number;
    filesEdited: number;
    tests: number;
    failures: number;
    /** Achievement ids unlocked during this session. */
    unlocked: string[];
    /** XP gained during this session. */
    xpGained: number;
    /** Level boundary crossed this session, when any. */
    levelUp: {
        from: number;
        to: number;
    } | null;
}
/** Compute one session's report; null when the session bucket is absent. */
export declare function buildSessionSummary(state: AchievementState, sessionId: string): SessionSummary | null;
