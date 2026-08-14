/**
 * Unlock toast: a zero-dependency, self-removing DOM notification. Queued so
 * several unlocks in one refresh stack instead of overlapping.
 */
import type { AchievementView } from '../achievements.ts';
/** Show one unlock toast; multiple calls stack into a queue. */
export declare function showUnlockToast(achievement: AchievementView, elapsed: string | null): void;
