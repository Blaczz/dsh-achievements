/**
 * Achievements plugin, browser half: polls the read-only state API, shows an
 * unlock toast when new achievements arrive, exposes `ctx.achievementsState`
 * for other client plugins, and registers the badge panel in the settings page.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
export type { BadgePanelInjected, BadgePanelProps } from './badge-panel.tsx';
export { HttpAchievementsClient } from './achievements-client.ts';
/** Public client-side service other plugins can inject and call. */
export interface AchievementsStateService {
    /** Re-poll the state API. */
    refresh(): Promise<void>;
    /** Currently unlocked achievement ids. */
    unlockedIds(): string[];
}
/** Required services (cordis fiber inject). */
export declare const inject: string[];
declare module '@deepseek-ai/cordis' {
    interface Context {
        /** Client-side state accessor (the Host's `ctx.achievements` is the SDK). */
        achievementsState: AchievementsStateService;
    }
}
/**
 * Client plugin body: one shared HTTP client, an unlock watcher that toasts
 * new achievements, the cross-plugin service, and the settings-page panel.
 * @param ctx - client cordis context.
 */
export declare function apply(ctx: ClientContext): void;
