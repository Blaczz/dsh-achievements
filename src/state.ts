/**
 * State v2: lifetime/profile state + per-session behavior state, persisted as a
 * JSON file under the DSH home directory. v1 counter state migrates losslessly.
 *
 * Layering:
 * - `profile` — cross-session lifetime facts (counters, streak, unlocks, xp).
 * - `sessions` — per-session behavior buckets, keyed by session id; never
 *   shared across sessions.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'

export const STATE_FILE = 'achievements-state.json'

/** Schema version stamped into the persisted state. */
export const STATE_VERSION = 2 as const

/** Maximum retained session buckets; the oldest (first-touched) sessions are pruned beyond this. */
export const MAX_SESSIONS = 64

export interface TestCounters {
  runs: number
  passed: number
  failed: number
  /** Outcome of the most recent test run in this session ('pass' | 'fail' | null). */
  lastOutcome: 'pass' | 'fail' | null
}

export interface ProfileState {
  /** Accumulated XP (filled in by Steamification, P2; 0 for now). */
  xp: number
  /** Achievement id → unlock epoch-ms. Global: unlocked once, forever. */
  unlocked: Record<string, number>
  turns: number
  toolCalls: number
  /** Lifetime tool-name → call count (favorite-tool / persona input). */
  toolsByName: Record<string, number>
  /** Distinct sessions that completed at least one turn. */
  sessions: number
  currentStreak: number
  longestStreak: number
  /** 'YYYY-MM-DD' of the most recent turn, drives the streak. */
  lastActiveDay: string | null
  /** Distinct session ids that completed a turn (single source for `sessions`). */
  seenSessions: string[]
}

export interface SessionAchievementState {
  toolCalls: number
  toolsByName: Record<string, number>
  filesRead: Record<string, number>
  filesEdited: Record<string, number>
  commands: Record<string, number>
  tests: TestCounters
  /** Seq of the first successful file read in this session, or null. */
  firstReadSeq: number | null
  /** Seq of the first successful file edit in this session, or null. */
  firstEditSeq: number | null
  /** Seq of the first test run in this session, or null. */
  firstTestSeq: number | null
  /** Outcome of the first test run in this session ('pass' | 'fail' | null). */
  firstTestOutcome: 'pass' | 'fail' | null
  /** Total successful file-edit invocations in this session (One Shot). */
  edits: number
  /** Current run of consecutive successful file reads (reset by any other event). */
  consecutiveReads: number
  /** Distinct files read before the first edit (frozen at the first edit). */
  readsBeforeFirstEdit: number
  /** Distinct files edited before the first test run (frozen at the first test). */
  editsBeforeFirstTest: number
  /** Test command currently failing; null when no failure streak is active. */
  failingCommand: string | null
  /** Consecutive failures of `failingCommand` (reset by a pass or a different command). */
  failingStreak: number
  /** Achievement ids unlocked during this session (for the session report). */
  unlocked: string[]
  /** XP gained during this session (for the session report). */
  xpGained: number
}

export interface AchievementState {
  version: typeof STATE_VERSION
  profile: ProfileState
  sessions: Record<string, SessionAchievementState>
}

export function createInitialSessionState(): SessionAchievementState {
  return {
    toolCalls: 0,
    toolsByName: {},
    filesRead: {},
    filesEdited: {},
    commands: {},
    tests: { runs: 0, passed: 0, failed: 0, lastOutcome: null },
    firstReadSeq: null,
    firstEditSeq: null,
    firstTestSeq: null,
    firstTestOutcome: null,
    edits: 0,
    consecutiveReads: 0,
    readsBeforeFirstEdit: 0,
    editsBeforeFirstTest: 0,
    failingCommand: null,
    failingStreak: 0,
    unlocked: [],
    xpGained: 0,
  }
}

export function createInitialProfile(): ProfileState {
  return {
    xp: 0,
    unlocked: {},
    turns: 0,
    toolCalls: 0,
    toolsByName: {},
    sessions: 0,
    currentStreak: 0,
    longestStreak: 0,
    lastActiveDay: null,
    seenSessions: [],
  }
}

export function createInitialState(): AchievementState {
  return { version: STATE_VERSION, profile: createInitialProfile(), sessions: {} }
}

/**
 * Insert or update one session bucket. Re-inserting moves it to the most-recent
 * slot (so the currently active session is never pruned), then the oldest
 * first-touched buckets beyond `MAX_SESSIONS` are dropped to bound growth.
 */
export function touchSession(
  sessions: Record<string, SessionAchievementState>,
  sessionId: string,
  session: SessionAchievementState,
): Record<string, SessionAchievementState> {
  // Delete then re-add so a re-touched session moves to the most-recent slot
  // (object spread alone would keep its original insertion position).
  const next: Record<string, SessionAchievementState> = { ...sessions }
  delete next[sessionId]
  next[sessionId] = session
  const keys = Object.keys(next)
  if (keys.length > MAX_SESSIONS) {
    for (const key of keys.slice(0, keys.length - MAX_SESSIONS)) delete next[key]
  }
  return next
}

// ---- persistence ----

export function stateFilePath(): string {
  return join(resolveDshHome(), STATE_FILE)
}

/** Load the state file, migrating or falling back to a fresh v2 state when absent/corrupt. */
export function loadState(): AchievementState {
  try {
    return migrateState(JSON.parse(readFileSync(stateFilePath(), 'utf8')))
  } catch {
    return createInitialState()
  }
}

/** Persist the state atomically enough for this purpose (best-effort). */
export function saveState(state: AchievementState): void {
  const file = stateFilePath()
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(state, null, 2))
}

// ---- migration / normalization ----

/**
 * Coerce any persisted JSON into the current v2 shape:
 * - `version === 2` → normalize (forward-tolerant partial data),
 * - a v1 `{ counters, unlocked, lastActiveDay, seenSessions }` → migrate,
 * - anything else → fresh state.
 */
export function migrateState(value: unknown): AchievementState {
  if (!isRecord(value)) return createInitialState()
  if (value.version === STATE_VERSION) return normalizeV2(value)
  if (isRecord(value.counters)) return migrateV1(value)
  return createInitialState()
}

function migrateV1(v1: Record<string, unknown>): AchievementState {
  const counters = isRecord(v1.counters) ? v1.counters : {}
  const seenSessions = Array.isArray(v1.seenSessions)
    ? v1.seenSessions.filter((item): item is string => typeof item === 'string')
    : []
  const currentStreak = toNumber(counters.streakDays)
  return {
    version: STATE_VERSION,
    profile: {
      xp: 0,
      unlocked: toStringNumberMap(v1.unlocked),
      turns: toNumber(counters.turns),
      toolCalls: toNumber(counters.toolCalls),
      toolsByName: {},
      sessions: seenSessions.length,
      currentStreak,
      longestStreak: currentStreak,
      lastActiveDay: typeof v1.lastActiveDay === 'string' ? v1.lastActiveDay : null,
      seenSessions,
    },
    sessions: {},
  }
}

function normalizeV2(v2: Record<string, unknown>): AchievementState {
  const profileRaw = isRecord(v2.profile) ? v2.profile : {}
  const profile = createInitialProfile()
  profile.xp = toNumber(profileRaw.xp)
  profile.unlocked = toStringNumberMap(profileRaw.unlocked)
  profile.turns = toNumber(profileRaw.turns)
  profile.toolCalls = toNumber(profileRaw.toolCalls)
  profile.toolsByName = toStringNumberMap(profileRaw.toolsByName)
  profile.sessions = toNumber(profileRaw.sessions)
  profile.currentStreak = toNumber(profileRaw.currentStreak)
  profile.longestStreak = toNumber(profileRaw.longestStreak)
  profile.lastActiveDay = typeof profileRaw.lastActiveDay === 'string' ? profileRaw.lastActiveDay : null
  profile.seenSessions = Array.isArray(profileRaw.seenSessions)
    ? profileRaw.seenSessions.filter((item): item is string => typeof item === 'string')
    : []

  const sessionsRaw = isRecord(v2.sessions) ? v2.sessions : {}
  const sessions: Record<string, SessionAchievementState> = {}
  for (const [id, raw] of Object.entries(sessionsRaw)) {
    if (isRecord(raw)) sessions[id] = normalizeSession(raw)
  }
  const keys = Object.keys(sessions)
  for (const key of keys.slice(0, Math.max(0, keys.length - MAX_SESSIONS))) delete sessions[key]

  return { version: STATE_VERSION, profile, sessions }
}

function normalizeSession(raw: Record<string, unknown>): SessionAchievementState {
  const session = createInitialSessionState()
  session.toolCalls = toNumber(raw.toolCalls)
  session.toolsByName = toStringNumberMap(raw.toolsByName)
  session.filesRead = toStringNumberMap(raw.filesRead)
  session.filesEdited = toStringNumberMap(raw.filesEdited)
  session.commands = toStringNumberMap(raw.commands)
  const tests = isRecord(raw.tests) ? raw.tests : {}
  session.tests = {
    runs: toNumber(tests.runs),
    passed: toNumber(tests.passed),
    failed: toNumber(tests.failed),
    lastOutcome: tests.lastOutcome === 'pass' || tests.lastOutcome === 'fail' ? tests.lastOutcome : null,
  }
  session.firstReadSeq = toNullableNumber(raw.firstReadSeq)
  session.firstEditSeq = toNullableNumber(raw.firstEditSeq)
  session.firstTestSeq = toNullableNumber(raw.firstTestSeq)
  session.firstTestOutcome = raw.firstTestOutcome === 'pass' || raw.firstTestOutcome === 'fail' ? raw.firstTestOutcome : null
  session.edits = toNumber(raw.edits)
  session.consecutiveReads = toNumber(raw.consecutiveReads)
  session.readsBeforeFirstEdit = toNumber(raw.readsBeforeFirstEdit)
  session.editsBeforeFirstTest = toNumber(raw.editsBeforeFirstTest)
  session.failingCommand = typeof raw.failingCommand === 'string' ? raw.failingCommand : null
  session.failingStreak = toNumber(raw.failingStreak)
  session.unlocked = Array.isArray(raw.unlocked)
    ? raw.unlocked.filter((item): item is string => typeof item === 'string')
    : []
  session.xpGained = toNumber(raw.xpGained)
  return session
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function toNullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function toStringNumberMap(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {}
  const out: Record<string, number> = {}
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === 'number' && Number.isFinite(item)) out[key] = item
  }
  return out
}
