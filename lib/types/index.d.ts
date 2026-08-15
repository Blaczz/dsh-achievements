/**
 * Host half of the achievements plugin: feeds real session events into the
 * event classifier → pure engine, persists v2 state, exposes a read-only HTTP
 * API for the browser half, and registers a durable settings namespace.
 */
import type { Context } from '@deepseek-ai/cordis';
import { type AchievementsSdk } from './sdk.ts';
export { applyEvent, BEHAVIOR_ACHIEVEMENTS, BUILTIN_ACHIEVEMENTS, COUNTER_ACHIEVEMENTS, computeProgress, countersOf, fromCounterCondition, toAchievementView, DEFAULT_ACHIEVEMENTS_SETTINGS, } from './achievements.ts';
export type { AchievementCounters, AchievementDef, AchievementEvaluation, AchievementProgress, AchievementProgressView, AchievementRarity, AchievementScope, AchievementView, AchievementsSettings, LocalizedText, } from './achievements.ts';
export { createInitialProfile, createInitialSessionState, createInitialState, migrateState, MAX_SESSIONS, STATE_VERSION, touchSession, } from './state.ts';
export type { AchievementState, ProfileState, SessionAchievementState, TestCounters } from './state.ts';
export { buildToolCallEvent, buildTurnEndEvent, classifyTool, isTestCommand, parseToolArguments, } from './events.ts';
export type { AchievementEvent, ToolKind, ToolSummary } from './events.ts';
export { buildContext, reduceState, yesterdayOf } from './reducer.ts';
export type { AchievementContext } from './reducer.ts';
export { levelOf, xpForLevel, XP_PER_LEVEL, RARITY_META } from './gamification.ts';
export type { LevelInfo, RarityMeta } from './gamification.ts';
export { buildProfileView, buildSessionSummary, favoriteToolOf, personaOf, raritySummaryOf, } from './profile.ts';
export type { Persona, ProfileViewModel, RarityCount, SessionSummary } from './profile.ts';
export { buildAchievementCard, buildAgentWrapped, buildShareText, chainProgressOf, BUILTIN_CHAINS, } from './share.ts';
export type { AchievementCard, AchievementChain, AgentWrapped, ChainProgress } from './share.ts';
export { ACHIEVEMENTS_API_PREFIX, ACHIEVEMENTS_STATE_API_PATH } from './api.ts';
export { createAchievementRegistry } from './sdk.ts';
export type { AchievementPack, AchievementRegistry, AchievementsSdk } from './sdk.ts';
declare module '@deepseek-ai/cordis' {
    interface Context {
        /** Host-side SDK: register achievement definitions / packs. */
        achievements: AchievementsSdk;
    }
}
export declare const name = "achievements";
export declare const inject: string[];
/** Local calendar day as 'YYYY-MM-DD' (streak arithmetic uses local time). */
export declare function localToday(now?: Date): string;
export declare function apply(ctx: Context): void;
