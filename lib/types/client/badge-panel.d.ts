import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { AchievementsClient } from './achievements-client.ts';
/** Injected business face: the shared client (see the client apply). */
export interface BadgePanelInjected {
    achievements: AchievementsClient;
}
/** Full component props: settings-section runtime share + injected client. */
export type BadgePanelProps = PropsRuntime<'settings.section'> & BadgePanelInjected;
/** 'X 天前' / '刚刚' from an unlock epoch. */
export declare function elapsedLabel(unlockedAt: number | undefined, now?: number): string;
/** The settings page body. */
export declare function BadgePanel({ achievements }: BadgePanelProps): import("react").JSX.Element;
