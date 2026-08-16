/**
 * Unlock toast: a zero-dependency, self-removing DOM notification. Queued so
 * several unlocks in one refresh stack instead of overlapping. Steam-like:
 * a rarity accent + rarity label, title, description, flavor text, and +XP.
 */
import type { AchievementView } from '../achievements.ts';
/** Show one unlock toast; multiple calls stack into a queue. */
export declare function showUnlockToast(achievement: AchievementView, elapsed: string | null): void;
