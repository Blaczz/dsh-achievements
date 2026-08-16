/**
 * Achievement SDK: the public registration surface that turns the hardcoded
 * BUILTIN_ACHIEVEMENTS list into an open, registerable framework. Host plugins
 * call `ctx.achievements.register(...)` / `registerPack(...)`; the engine
 * evaluates everything the registry holds, built-in and third-party alike.
 */
import type { AchievementDef, LocalizedText } from './achievements.ts';
/** A named, versioned bundle of achievements a third-party pack contributes. */
export interface AchievementPack {
    id: string;
    version: string;
    name?: LocalizedText;
    achievements: readonly AchievementDef[];
}
/** The public `ctx.achievements` service (Host side). */
export interface AchievementsSdk {
    /** Register one definition. Throws on a duplicate achievement id. */
    register(def: AchievementDef): void;
    /** Register every definition in a pack. Throws on the first duplicate id. */
    registerPack(pack: AchievementPack): void;
}
/** Internal registry handle: the public service plus the engine's list accessor. */
export interface AchievementRegistry extends AchievementsSdk {
    /** The live definition list, in registration order (read-only view). */
    list(): readonly AchievementDef[];
}
export declare function createAchievementRegistry(): AchievementRegistry;
