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

export type ToolKind = 'file-read' | 'file-edit' | 'shell-command' | 'test-run' | 'other'

/** Behavior-relevant projection of one tool invocation (no Harness references). */
export interface ToolSummary {
  kind: ToolKind
  /** Original tool name, e.g. `read`, `bash`. */
  name: string
  /** Target path for file-read / file-edit. */
  path?: string
  /** Shell command text for shell-command / test-run. */
  command?: string
}

/**
 * Harness-agnostic token-usage projection. Kept structurally identical to the
 * installed `@deepseek-ai/dsh-llm` `TokenUsage`, but as an achievement-owned
 * type so a `TokenUsage` runtime object never leaks into `AchievementDef` or
 * the browser API.
 */
export interface AchievementTokenUsage {
  inputTokens: number
  outputTokens: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
  reasoningTokens?: number
}

export type AchievementEvent =
  | { kind: 'turn-end'; sessionId: string; seq: number }
  | {
      kind: 'step-start'
      sessionId: string
      seq: number
      /** Unix epoch milliseconds (the durable boundary's `event.time`). */
      time: number
      turn: number
      step: number
    }
  | {
      kind: 'assistant-message'
      sessionId: string
      seq: number
      /** Unix epoch milliseconds of the assembled assistant message. */
      time: number
      turn: number
      step: number
      usage?: AchievementTokenUsage
    }
  | {
      kind: 'step-end'
      sessionId: string
      seq: number
      /** Unix epoch milliseconds (unused by P7 duration, kept for parity). */
      time: number
      turn: number
      step: number
    }
  | { kind: 'tool-call'; sessionId: string; seq: number; callId: string | null; tool: ToolSummary; isError: boolean }

/** Tool names mapped to a file read. */
export const FILE_READ_TOOLS: readonly string[] = ['read']
/** Tool names mapped to a file edit/create. */
export const FILE_EDIT_TOOLS: readonly string[] = ['write', 'edit']
/** Tool names whose invocation is a foreground shell command. */
export const SHELL_TOOLS: readonly string[] = ['bash', 'pwsh']

/**
 * Conservative test-runner detection: a shell command is a test run only when
 * it names a known test runner invocation. A generic `test` substring would
 * over-match (`echo "test"`), so we anchor on runner + `test` token pairs.
 */
const TEST_COMMAND_RE =
  /\b(npm|yarn|pnpm)\s+(run\s+)?test\b|\b(vitest|jest|pytest|unittest|cargo\s+test|go\s+test|dotnet\s+test|mvn\s+test|gradle\s+test|gradlew\s+test)\b/i

/** Whether a shell command string runs a known test runner. */
export function isTestCommand(command: string): boolean {
  return TEST_COMMAND_RE.test(command)
}

/** Directory names treated as third-party dependency roots. */
const DEPENDENCY_DIRS: readonly string[] = ['node_modules', 'site-packages', 'vendor']

/**
 * Path classifier for the Dependency Archaeologist rule: whether a file path
 * lives under a dependency directory (`node_modules` / `site-packages` /
 * `vendor`). Matches the directory as a whole path segment (backslashes are
 * normalized) so a project file merely named `vendor-scripts` does not match.
 */
export function isDependencyPath(path: string): boolean {
  const segments = path.replace(/\\/g, '/').split('/')
  return segments.some(segment => DEPENDENCY_DIRS.includes(segment))
}

/** Classify a settled tool invocation into a behavior projection. */
export function classifyTool(name: string, args: unknown): ToolSummary {
  const record = isRecord(args) ? args : {}
  if (FILE_READ_TOOLS.includes(name)) {
    return { kind: 'file-read', name, path: stringArg(record.file_path) }
  }
  if (FILE_EDIT_TOOLS.includes(name)) {
    return { kind: 'file-edit', name, path: stringArg(record.file_path) }
  }
  if (SHELL_TOOLS.includes(name)) {
    const command = stringArg(record.command)
    if (command !== undefined) {
      return isTestCommand(command)
        ? { kind: 'test-run', name, command }
        : { kind: 'shell-command', name, command }
    }
    return { kind: 'other', name }
  }
  return { kind: 'other', name }
}

/** Parse the raw JSON arguments string from a session `tool/call` event; never throws. */
export function parseToolArguments(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return undefined
  }
}

/**
 * Classify one settled Code Mode sub-dispatch. `tool/code-dispatch` carries
 * `arguments` already JSON-normalized (an object), unlike the native
 * `tool/call` event's raw JSON string; a string payload is still parsed
 * defensively so a malformed value falls back to the same safe classification
 * as a native call. This reuses `classifyTool` — no second read/edit/test rule
 * set — so a Code Mode sub-call and its native equivalent yield the same
 * `ToolSummary`.
 */
export function classifyCodeDispatch(name: string, args: unknown): ToolSummary {
  return classifyTool(name, typeof args === 'string' ? parseToolArguments(args) : args)
}

export function buildTurnEndEvent(sessionId: string, seq: number): AchievementEvent {
  return { kind: 'turn-end', sessionId, seq }
}

export function buildStepStartEvent(
  sessionId: string,
  seq: number,
  time: number,
  turn: number,
  step: number,
): AchievementEvent {
  return { kind: 'step-start', sessionId, seq, time, turn, step }
}

export function buildAssistantMessageEvent(
  sessionId: string,
  seq: number,
  time: number,
  turn: number,
  step: number,
  usage?: AchievementTokenUsage,
): AchievementEvent {
  return { kind: 'assistant-message', sessionId, seq, time, turn, step, usage }
}

export function buildStepEndEvent(
  sessionId: string,
  seq: number,
  time: number,
  turn: number,
  step: number,
): AchievementEvent {
  return { kind: 'step-end', sessionId, seq, time, turn, step }
}

export function buildToolCallEvent(
  sessionId: string,
  seq: number,
  callId: string | null,
  tool: ToolSummary,
  isError: boolean,
): AchievementEvent {
  return { kind: 'tool-call', sessionId, seq, callId, tool, isError }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringArg(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}
