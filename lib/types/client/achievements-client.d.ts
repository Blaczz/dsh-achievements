/** Reactive browser client for the achievements read-only state API. */
import type { AchievementProgressView, AchievementView, AchievementsSettings } from '../achievements.ts';
import type { AchievementState } from '../state.ts';
export interface AchievementsSnapshot {
    settings: AchievementsSettings;
    achievements: AchievementView[];
    state: AchievementState;
    /** Per-achievement progress/target, evaluated host-side against the latest session. */
    progress: Record<string, AchievementProgressView>;
}
export interface AchievementsClient {
    getSnapshot(): AchievementsSnapshot | null;
    subscribe(listener: () => void): () => void;
    refresh(): Promise<void>;
    dispose(): void;
}
export declare class HttpAchievementsClient implements AchievementsClient {
    private snapshot;
    private readonly listeners;
    private readonly abort;
    private disposed;
    getSnapshot: () => AchievementsSnapshot | null;
    subscribe: (listener: () => void) => (() => void);
    refresh(): Promise<void>;
    dispose(): void;
}
