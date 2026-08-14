import { type AchievementState } from './achievements.ts';
export declare const STATE_FILE = "achievements-state.json";
export declare function stateFilePath(): string;
/** Load the state file, falling back to a fresh state when absent or corrupt. */
export declare function loadState(): AchievementState;
/** Persist the state atomically enough for this purpose (best-effort). */
export declare function saveState(state: AchievementState): void;
