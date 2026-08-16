/**
 * Achievement domain model v2 + the pure evaluation engine. Unlock rules moved
 * from `condition(counters)` to `evaluate(ctx)`, so a definition can read both
 * lifetime/profile and session behavior. The Host feeds standardized events in;
 * this module reduces them and evaluates every still-locked achievement.
 */
import { type AchievementEvent } from './events.ts';
import { type AchievementContext } from './reducer.ts';
import { type AchievementState, type ProfileState } from './state.ts';
import type { AchievementPack } from './sdk.ts';
export interface LocalizedText {
    zh: string;
    en: string;
}
export type AchievementRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export type AchievementScope = 'lifetime' | 'session';
export interface AchievementEvaluation {
    unlocked: boolean;
    /** Optional progress toward the target (rendered by Steamification, P2). */
    progress?: number;
    /** Optional target the progress is measured against. */
    target?: number;
}
export type { AchievementContext } from './reducer.ts';
export interface AchievementDef {
    id: string;
    icon: string;
    title: LocalizedText;
    description: LocalizedText;
    flavorText?: LocalizedText;
    rarity: AchievementRarity;
    xp: number;
    scope: AchievementScope;
    hidden?: boolean;
    evaluate(ctx: AchievementContext): AchievementEvaluation;
}
export interface AchievementProgress {
    state: AchievementState;
    newlyUnlocked: AchievementDef[];
}
/**
 * Advance the engine by one standardized event: reduce it into v2 state, build
 * the evaluation context, then unlock every still-locked achievement whose
 * `evaluate` now holds.
 */
export declare function applyEvent(state: AchievementState, event: AchievementEvent, defs: readonly AchievementDef[], today: string, now?: number): AchievementProgress;
/** Serialized progress view of one achievement (progress / target only). */
export interface AchievementProgressView {
    progress?: number;
    target?: number;
}
/** Evaluate every definition and keep only the ones reporting progress/target. */
export declare function computeProgress(defs: readonly AchievementDef[], ctx: AchievementContext): Record<string, AchievementProgressView>;
/** Result of one silent reconciliation pass. */
export interface LifetimeReconciliation {
    state: AchievementState;
    newlyUnlocked: AchievementDef[];
    xpGained: number;
}
/**
 * Silently unlock every still-locked `scope === 'lifetime'` definition whose
 * `evaluate` already holds against the current profile, awarding its XP once.
 *
 * Deliberately NOT `applyEvent`: it runs no reducer, writes no session
 * attribution, and the caller must not broadcast the resulting unlocks. The
 * unlock timestamp is the reconciliation moment (the "system confirmed" time),
 * not a fabricated historical completion date. Idempotent via the same
 * `id in unlocked` guard as the live engine.
 */
export declare function reconcileLifetimeAchievements(state: AchievementState, defs: readonly AchievementDef[], now?: number): LifetimeReconciliation;
/** The v1 counter view, kept so existing counter rules need no rewrite. */
export interface AchievementCounters {
    turns: number;
    toolCalls: number;
    sessions: number;
    streakDays: number;
}
export declare function countersOf(profile: ProfileState): AchievementCounters;
/** Wrap a v1 `condition(counters)` into a v2 `evaluate(ctx)` definition. */
export declare function fromCounterCondition(base: {
    id: string;
    icon: string;
    title: LocalizedText;
    description: LocalizedText;
}, condition: (counters: AchievementCounters) => boolean, overrides?: Partial<Pick<AchievementDef, 'rarity' | 'xp' | 'scope' | 'hidden' | 'flavorText'>>): AchievementDef;
/** Internal spec for one Lifetime threshold milestone (not public SDK surface). */
interface LifetimeMilestoneSpec {
    id: string;
    icon: string;
    title: LocalizedText;
    description: LocalizedText;
    flavorText?: LocalizedText;
    rarity: AchievementRarity;
    xp: number;
    target: number;
    /** Reads the lifetime metric this milestone measures from the profile. */
    value(profile: ProfileState): number;
}
/**
 * Build one Lifetime threshold achievement with a standard
 * `{ unlocked, progress, target }` evaluation. `progress` is the raw metric,
 * not clamped to `target`, so downstream view models keep the true value and
 * the UI caps the bar width itself. Kept internal: third parties may still
 * write their own `evaluate`; this is not added to the public SDK surface.
 */
export declare function createLifetimeMilestone(spec: LifetimeMilestoneSpec): AchievementDef;
/** Legacy lifetime counter achievements (v1), carried into the v2 model. */
export declare const COUNTER_ACHIEVEMENTS: readonly AchievementDef[];
/** P6 lifetime progression milestones (30 new, across 7 five-tier chains). */
export declare const MILESTONE_ACHIEVEMENTS: readonly AchievementDef[];
/** Every built-in Lifetime progression achievement (legacy counters + new milestones). */
export declare const LIFETIME_ACHIEVEMENTS: readonly AchievementDef[];
/**
 * The first batch of behavior achievements (v0.2). Session-scoped: each reads
 * `ctx.session`, which the reducer resets per session, so behavior never leaks
 * across sessions. Thresholds are the literal spec from Task 05.
 */
export declare const BEHAVIOR_ACHIEVEMENTS: readonly AchievementDef[];
/** All built-in achievements: lifetime counters + P6 milestones + behavior batch. */
export declare const BUILTIN_ACHIEVEMENTS: readonly AchievementDef[];
/** The built-in achievements expressed as the default Pack (same registry path). */
export declare const BUILTIN_PACK: AchievementPack;
/** Serialized achievement view the browser half can render (no functions). */
export interface AchievementView {
    id: string;
    icon: string;
    title: LocalizedText;
    description: LocalizedText;
    flavorText?: LocalizedText;
    rarity: AchievementRarity;
    xp: number;
    scope: AchievementScope;
    hidden: boolean;
}
/** Strip the `evaluate` predicate so a definition is safe to send to the browser half. */
export declare function toAchievementView(def: AchievementDef): AchievementView;
export interface AchievementsSettings {
    /** Master switch for unlock toasts + badge updates. */
    enabled: boolean;
    /** Show a toast when an achievement unlocks mid-session. */
    toastEnabled: boolean;
}
export declare const DEFAULT_ACHIEVEMENTS_SETTINGS: AchievementsSettings;
