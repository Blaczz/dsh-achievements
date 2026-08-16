/**
 * Badge panel grouping + status filter model (Task 22). Pure, browser-safe,
 * and React-free so it can be unit-tested in Node without jsdom.
 *
 * It only reads the serialized `AchievementView` (no predicate functions) and
 * the browser-safe chain metadata from `share.ts`. It never runtime-imports
 * Host-only `state.ts` / `achievements.ts`, and never reads file paths,
 * command strings, or prompt text.
 */
import type { AchievementView } from '../achievements.ts';
import { type AchievementChain } from '../share.ts';
/** The single lightweight filter offered on the badge wall. */
export type AchievementStatusFilter = 'all' | 'locked' | 'unlocked';
/** Whether a card is visible under the given status filter. */
export declare function matchesAchievementStatus(unlockedAt: number | undefined, filter: AchievementStatusFilter): boolean;
/** One collapsible group rendered on the badge wall. */
export interface AchievementGroup {
    id: string;
    title: AchievementChain['title'];
    /** Cards in stable progression order; never reordered by filter or unlock. */
    defs: AchievementView[];
    /** Formal chain; null for the residual "other / classic" group. */
    chain: AchievementChain | null;
    /** Five-tier chain that renders a progress bar in its header. */
    progression: boolean;
    /** Real progress across the whole group, independent of the status filter. */
    completed: number;
    total: number;
}
/** The seven lifetime milestone chains, one collapsible group each. */
export declare function buildMilestoneGroups(defs: readonly AchievementView[], unlocked: Record<string, number>): AchievementGroup[];
/**
 * Special achievements grouped by `SPECIAL_CHAINS`, plus one residual group
 * holding every def that belongs to neither a milestone chain nor a special
 * chain: the early `ten-turns` bonus, the remaining classic behavior
 * achievements, and any third-party pack achievements.
 */
export declare function buildSpecialGroups(defs: readonly AchievementView[], unlocked: Record<string, number>): AchievementGroup[];
