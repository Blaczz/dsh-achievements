/**
 * Session behavior reducer: the pure `(state, event) -> nextState` transition
 * that folds standardized `AchievementEvent`s into Profile/Lifetime + Session
 * state. Rules evaluate against the context this module builds; they never see
 * raw Harness tool payloads.
 */
import type { AchievementEvent } from './events.ts';
import { type AchievementState, type ProfileState, type SessionAchievementState } from './state.ts';
/** 'YYYY-MM-DD' one calendar day before `day` (UTC arithmetic, deterministic). */
export declare function yesterdayOf(day: string): string;
/** The read-only view an achievement `evaluate(ctx)` receives. */
export interface AchievementContext {
    profile: ProfileState;
    session: SessionAchievementState;
}
/** Build the evaluation context for one session (missing bucket → empty session). */
export declare function buildContext(state: AchievementState, sessionId: string): AchievementContext;
export declare function reduceState(state: AchievementState, event: AchievementEvent, today: string): AchievementState;
