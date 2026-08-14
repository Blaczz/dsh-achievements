/**
 * The achievement engine, extracted as pure functions so the unlock rules are
 * unit-testable without a running harness. The Host half feeds real session /
 * tool events in; this module only maps counters → achievements.
 *
 * State shape:
 * - `counters` — lifetime totals (turns, tool calls, sessions, streak days)
 * - `unlocked` — achievement id → unlock epoch-ms
 * - `lastActiveDay` — 'YYYY-MM-DD' of the most recent turn, drives the streak
 * - `seenSessions` — distinct session ids that completed a turn
 */
export interface AchievementCounters {
    turns: number;
    toolCalls: number;
    sessions: number;
    streakDays: number;
}
export interface LocalizedText {
    zh: string;
    en: string;
}
export interface AchievementDef {
    id: string;
    icon: string;
    title: LocalizedText;
    description: LocalizedText;
    /** Unlocked when this predicate holds for the current counters. */
    condition: (counters: AchievementCounters) => boolean;
}
export interface AchievementState {
    counters: AchievementCounters;
    unlocked: Record<string, number>;
    lastActiveDay: string | null;
    seenSessions: string[];
}
/** One lifecycle event the engine understands. */
export type AchievementEvent = {
    kind: 'turn-end';
    sessionId: string;
} | {
    kind: 'tool-call';
};
export interface AchievementProgress {
    state: AchievementState;
    newlyUnlocked: AchievementDef[];
}
export declare function createInitialState(): AchievementState;
/** Advance the engine by one event; returns the next state and new unlocks. */
export declare function applyEvent(state: AchievementState, event: AchievementEvent, defs: readonly AchievementDef[], today: string, now?: number): AchievementProgress;
/** 'YYYY-MM-DD' one calendar day before `day` (UTC arithmetic, deterministic). */
export declare function yesterdayOf(day: string): string;
/** The built-in achievements (ordered for display). */
export declare const BUILTIN_ACHIEVEMENTS: readonly AchievementDef[];
/** Serialized achievement view the browser half can render (no functions). */
export interface AchievementView {
    id: string;
    icon: string;
    title: LocalizedText;
    description: LocalizedText;
}
/** Strip the predicate so a definition is safe to send to the browser half. */
export declare function toAchievementView(def: AchievementDef): AchievementView;
/** The configured runtime shape the Host exposes to the browser half. */
export interface AchievementsSettings {
    /** Master switch for unlock toasts + badge updates. */
    enabled: boolean;
    /** Show a toast when an achievement unlocks mid-session. */
    toastEnabled: boolean;
}
export declare const DEFAULT_ACHIEVEMENTS_SETTINGS: AchievementsSettings;
