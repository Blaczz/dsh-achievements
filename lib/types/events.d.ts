/**
 * Event classifier: isolates the achievement engine from raw Harness tool
 * payloads. The Host feeds settled tool invocations and turn boundaries in;
 * this module maps them onto a small standardized event vocabulary.
 *
 * Layering enforced here:
 *
 *   Harness Event → Event Classifier → AchievementEvent → Achievement Engine
 *
 * One `tool-call` event represents one SETTLED tool invocation (classified from
 * the session log's `tool/call` + `tool/result`, correlated by call id). The
 * finer-grained vocabulary from the plan — file-read / file-edit /
 * shell-command / test-run — is carried as `ToolSummary.kind` instead of as
 * separate top-level event kinds, so the reducer counts every invocation
 * exactly once and never has to reconcile overlapping "call vs result" arms.
 */
export type ToolKind = 'file-read' | 'file-edit' | 'shell-command' | 'test-run' | 'other';
/** Behavior-relevant projection of one tool invocation (no Harness references). */
export interface ToolSummary {
    kind: ToolKind;
    /** Original tool name, e.g. `read`, `bash`. */
    name: string;
    /** Target path for file-read / file-edit. */
    path?: string;
    /** Shell command text for shell-command / test-run. */
    command?: string;
}
export type AchievementEvent = {
    kind: 'turn-end';
    sessionId: string;
    seq: number;
} | {
    kind: 'tool-call';
    sessionId: string;
    seq: number;
    callId: string | null;
    tool: ToolSummary;
    isError: boolean;
};
/** Tool names mapped to a file read. */
export declare const FILE_READ_TOOLS: readonly string[];
/** Tool names mapped to a file edit/create. */
export declare const FILE_EDIT_TOOLS: readonly string[];
/** Tool names whose invocation is a foreground shell command. */
export declare const SHELL_TOOLS: readonly string[];
/** Whether a shell command string runs a known test runner. */
export declare function isTestCommand(command: string): boolean;
/**
 * Path classifier for the Dependency Archaeologist rule: whether a file path
 * lives under a dependency directory (`node_modules` / `site-packages` /
 * `vendor`). Matches the directory as a whole path segment (backslashes are
 * normalized) so a project file merely named `vendor-scripts` does not match.
 */
export declare function isDependencyPath(path: string): boolean;
/** Classify a settled tool invocation into a behavior projection. */
export declare function classifyTool(name: string, args: unknown): ToolSummary;
/** Parse the raw JSON arguments string from a session `tool/call` event; never throws. */
export declare function parseToolArguments(raw: string): unknown;
/**
 * Classify one settled Code Mode sub-dispatch. `tool/code-dispatch` carries
 * `arguments` already JSON-normalized (an object), unlike the native
 * `tool/call` event's raw JSON string; a string payload is still parsed
 * defensively so a malformed value falls back to the same safe classification
 * as a native call. This reuses `classifyTool` — no second read/edit/test rule
 * set — so a Code Mode sub-call and its native equivalent yield the same
 * `ToolSummary`.
 */
export declare function classifyCodeDispatch(name: string, args: unknown): ToolSummary;
export declare function buildTurnEndEvent(sessionId: string, seq: number): AchievementEvent;
export declare function buildToolCallEvent(sessionId: string, seq: number, callId: string | null, tool: ToolSummary, isError: boolean): AchievementEvent;
