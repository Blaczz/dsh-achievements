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
/** Tool names mapped to a file read. */
export const FILE_READ_TOOLS = ['read'];
/** Tool names mapped to a file edit/create. */
export const FILE_EDIT_TOOLS = ['write', 'edit'];
/** Tool names whose invocation is a foreground shell command. */
export const SHELL_TOOLS = ['bash', 'pwsh'];
/**
 * Conservative test-runner detection: a shell command is a test run only when
 * it names a known test runner invocation. A generic `test` substring would
 * over-match (`echo "test"`), so we anchor on runner + `test` token pairs.
 */
const TEST_COMMAND_RE = /\b(npm|yarn|pnpm)\s+(run\s+)?test\b|\b(vitest|jest|pytest|unittest|cargo\s+test|go\s+test|dotnet\s+test|mvn\s+test|gradle\s+test|gradlew\s+test)\b/i;
/** Whether a shell command string runs a known test runner. */
export function isTestCommand(command) {
    return TEST_COMMAND_RE.test(command);
}
/** Classify a settled tool invocation into a behavior projection. */
export function classifyTool(name, args) {
    const record = isRecord(args) ? args : {};
    if (FILE_READ_TOOLS.includes(name)) {
        return { kind: 'file-read', name, path: stringArg(record.file_path) };
    }
    if (FILE_EDIT_TOOLS.includes(name)) {
        return { kind: 'file-edit', name, path: stringArg(record.file_path) };
    }
    if (SHELL_TOOLS.includes(name)) {
        const command = stringArg(record.command);
        if (command !== undefined) {
            return isTestCommand(command)
                ? { kind: 'test-run', name, command }
                : { kind: 'shell-command', name, command };
        }
        return { kind: 'other', name };
    }
    return { kind: 'other', name };
}
/** Parse the raw JSON arguments string from a session `tool/call` event; never throws. */
export function parseToolArguments(raw) {
    try {
        return JSON.parse(raw);
    }
    catch {
        return undefined;
    }
}
export function buildTurnEndEvent(sessionId, seq) {
    return { kind: 'turn-end', sessionId, seq };
}
export function buildToolCallEvent(sessionId, seq, callId, tool, isError) {
    return { kind: 'tool-call', sessionId, seq, callId, tool, isError };
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function stringArg(value) {
    return typeof value === 'string' ? value : undefined;
}
