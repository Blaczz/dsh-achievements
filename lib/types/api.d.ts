/** Shared API path constants (no @deepseek-ai imports — safe to bundle client-side). */
export declare const ACHIEVEMENTS_API_PREFIX = "/plugins/dsh-achievements/api";
export declare const ACHIEVEMENTS_STATE_API_PATH = "/plugins/dsh-achievements/api/state";
/** Server-sent-events endpoint: the Host pushes unlock notifications here. */
export declare const ACHIEVEMENTS_EVENTS_API_PATH = "/plugins/dsh-achievements/api/events";
/**
 * One SSE frame announcing an unlock. The named `unlock` event carries a JSON
 * payload with the achievement id; the client treats the frame as a refresh
 * signal (it repulls state and lets the unlock tracker dedupe + toast).
 */
export declare function unlockEventFrame(id: string): string;
