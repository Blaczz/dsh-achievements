/**
 * Host half of the achievements plugin: feeds real session / tool events into
 * the pure engine, persists the state, exposes a read-only HTTP API for the
 * browser half, and registers a durable settings namespace.
 */
import type { Context } from '@deepseek-ai/cordis';
export { BUILTIN_ACHIEVEMENTS, createInitialState, } from './achievements.ts';
export type { AchievementCounters, AchievementDef, AchievementEvent, AchievementState, AchievementView, AchievementsSettings, } from './achievements.ts';
export { ACHIEVEMENTS_API_PREFIX, ACHIEVEMENTS_STATE_API_PATH } from './api.ts';
export declare const name = "achievements";
export declare const inject: string[];
/** Local calendar day as 'YYYY-MM-DD' (streak arithmetic uses local time). */
export declare function localToday(now?: Date): string;
export declare function apply(ctx: Context): void;
