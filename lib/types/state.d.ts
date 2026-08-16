export declare const STATE_FILE = "achievements-state.json";
/** Schema version stamped into the persisted state. */
export declare const STATE_VERSION: 2;
/** Maximum retained session buckets; the oldest (first-touched) sessions are pruned beyond this. */
export declare const MAX_SESSIONS = 64;
export interface TestCounters {
    runs: number;
    passed: number;
    failed: number;
    /** Outcome of the most recent test run in this session ('pass' | 'fail' | null). */
    lastOutcome: 'pass' | 'fail' | null;
}
export interface ProfileState {
    /** Accumulated XP (filled in by Steamification, P2; 0 for now). */
    xp: number;
    /** Achievement id → unlock epoch-ms. Global: unlocked once, forever. */
    unlocked: Record<string, number>;
    turns: number;
    toolCalls: number;
    /** Lifetime tool-name → call count (favorite-tool / persona input). */
    toolsByName: Record<string, number>;
    /** Distinct sessions that completed at least one turn. */
    sessions: number;
    currentStreak: number;
    longestStreak: number;
    /** 'YYYY-MM-DD' of the most recent turn, drives the streak. */
    lastActiveDay: string | null;
    /** Distinct session ids that completed a turn (single source for `sessions`). */
    seenSessions: string[];
}
export interface SessionAchievementState {
    toolCalls: number;
    toolsByName: Record<string, number>;
    filesRead: Record<string, number>;
    filesEdited: Record<string, number>;
    commands: Record<string, number>;
    tests: TestCounters;
    /** Seq of the first successful file read in this session, or null. */
    firstReadSeq: number | null;
    /** Seq of the first successful file edit in this session, or null. */
    firstEditSeq: number | null;
    /** Seq of the first test run in this session, or null. */
    firstTestSeq: number | null;
    /** Outcome of the first test run in this session ('pass' | 'fail' | null). */
    firstTestOutcome: 'pass' | 'fail' | null;
    /** Total successful file-edit invocations in this session (One Shot). */
    edits: number;
    /** Current run of consecutive successful file reads (reset by any other event). */
    consecutiveReads: number;
    /** Distinct files read before the first edit (frozen at the first edit). */
    readsBeforeFirstEdit: number;
    /** Distinct files edited before the first test run (frozen at the first test). */
    editsBeforeFirstTest: number;
    /** Test command currently failing; null when no failure streak is active. */
    failingCommand: string | null;
    /** Consecutive failures of `failingCommand` (reset by a pass or a different command). */
    failingStreak: number;
    /** Achievement ids unlocked during this session (for the session report). */
    unlocked: string[];
    /** XP gained during this session (for the session report). */
    xpGained: number;
}
export interface AchievementState {
    version: typeof STATE_VERSION;
    profile: ProfileState;
    sessions: Record<string, SessionAchievementState>;
}
export declare function createInitialSessionState(): SessionAchievementState;
export declare function createInitialProfile(): ProfileState;
export declare function createInitialState(): AchievementState;
/**
 * Insert or update one session bucket. Re-inserting moves it to the most-recent
 * slot (so the currently active session is never pruned), then the oldest
 * first-touched buckets beyond `MAX_SESSIONS` are dropped to bound growth.
 */
export declare function touchSession(sessions: Record<string, SessionAchievementState>, sessionId: string, session: SessionAchievementState): Record<string, SessionAchievementState>;
export declare function stateFilePath(): string;
/** Load the state file, migrating or falling back to a fresh v2 state when absent/corrupt. */
export declare function loadState(): AchievementState;
/** Persist the state atomically enough for this purpose (best-effort). */
export declare function saveState(state: AchievementState): void;
/**
 * Coerce any persisted JSON into the current v2 shape:
 * - `version === 2` → normalize (forward-tolerant partial data),
 * - a v1 `{ counters, unlocked, lastActiveDay, seenSessions }` → migrate,
 * - anything else → fresh state.
 */
export declare function migrateState(value: unknown): AchievementState;
