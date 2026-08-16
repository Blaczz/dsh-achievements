/**
 * Session behavior reducer: the pure `(state, event) -> nextState` transition
 * that folds standardized `AchievementEvent`s into Profile/Lifetime + Session
 * state. Rules evaluate against the context this module builds; they never see
 * raw Harness tool payloads.
 */
import type { AchievementEvent } from './events.ts'
import {
  createInitialSessionState, touchSession,
  type AchievementState, type ProfileState, type SessionAchievementState,
} from './state.ts'

/** 'YYYY-MM-DD' one calendar day before `day` (UTC arithmetic, deterministic). */
export function yesterdayOf(day: string): string {
  const [year, month, date] = day.split('-').map(Number)
  const value = new Date(Date.UTC(year!, month! - 1, date! - 1))
  return value.toISOString().slice(0, 10)
}

/** The read-only view an achievement `evaluate(ctx)` receives. */
export interface AchievementContext {
  profile: ProfileState
  session: SessionAchievementState
}

/** Build the evaluation context for one session (missing bucket → empty session). */
export function buildContext(state: AchievementState, sessionId: string): AchievementContext {
  return {
    profile: state.profile,
    session: state.sessions[sessionId] ?? createInitialSessionState(),
  }
}

export function reduceState(state: AchievementState, event: AchievementEvent, today: string): AchievementState {
  switch (event.kind) {
    case 'turn-end': return reduceTurnEnd(state, event, today)
    case 'step-start': return reduceStepStart(state, event)
    case 'assistant-message': return reduceAssistantMessage(state, event)
    case 'step-end': return reduceStepEnd(state, event)
    case 'tool-call': return reduceToolCall(state, event)
  }
}

function reduceStepStart(
  state: AchievementState,
  event: Extract<AchievementEvent, { kind: 'step-start' }>,
): AchievementState {
  const prev = state.sessions[event.sessionId] ?? createInitialSessionState()
  // A stale openStep (no matching step/end arrived, e.g. a crash or reorder) is
  // simply overwritten: P7 never fabricates a duration from `Date.now()`, and a
  // defensive overwrite must not throw or leak the old request into the new one.
  const next: SessionAchievementState = {
    ...prev,
    openStep: { turn: event.turn, step: event.step, startedAt: event.time },
    currentStepToolCalls: 0,
  }
  return { ...state, sessions: touchSession(state.sessions, event.sessionId, next) }
}

function reduceStepEnd(
  state: AchievementState,
  event: Extract<AchievementEvent, { kind: 'step-end' }>,
): AchievementState {
  const prev = state.sessions[event.sessionId] ?? createInitialSessionState()
  const next: SessionAchievementState = { ...prev, steps: prev.steps + 1 }

  // Distinct closed-step turns: turn numbers advance monotonically per session,
  // so `lastCountedTrajectoryTurn !== turn` is a distinct-turn test (a turn
  // number jump counts +1, never interpolating the skipped numbers).
  if (prev.lastCountedTrajectoryTurn !== event.turn) {
    next.trajectoryTurns = prev.trajectoryTurns + 1
    next.lastCountedTrajectoryTurn = event.turn
  }

  // Per-turn depth: closed steps only (`step/end`), never the `step` number.
  if (prev.currentTurnNumber === event.turn) {
    next.currentTurnSteps = prev.currentTurnSteps + 1
  } else {
    next.currentTurnNumber = event.turn
    next.currentTurnSteps = 1
  }
  next.maxStepsInTurn = Math.max(prev.maxStepsInTurn, next.currentTurnSteps)

  // Close the step regardless of identity match: a boundary mismatch still
  // counts the durable step/end itself and clears any stale open state.
  next.openStep = null
  next.currentStepToolCalls = 0

  return { ...state, sessions: touchSession(state.sessions, event.sessionId, next) }
}

function reduceAssistantMessage(
  state: AchievementState,
  event: Extract<AchievementEvent, { kind: 'assistant-message' }>,
): AchievementState {
  const prev = state.sessions[event.sessionId]
  if (prev === undefined) return state
  const open = prev.openStep
  // Request duration = assembled message time − matching step/start time. A
  // missing or mismatched open step is ignored (conservative: no guessing).
  if (open === null || open.turn !== event.turn || open.step !== event.step) return state
  const duration = Math.max(0, event.time - open.startedAt)
  const next: SessionAchievementState = {
    ...prev,
    lastRequestDurationMs: duration,
    maxRequestDurationMs: Math.max(prev.maxRequestDurationMs, duration),
  }
  return { ...state, sessions: touchSession(state.sessions, event.sessionId, next) }
}

function reduceTurnEnd(
  state: AchievementState,
  event: Extract<AchievementEvent, { kind: 'turn-end' }>,
  today: string,
): AchievementState {
  const profile: ProfileState = { ...state.profile }
  profile.turns += 1

  // activeDays must be decided against the PREVIOUS day before lastActiveDay
  // is rewritten, otherwise every turn looks like "same day".
  if (profile.lastActiveDay === null || profile.lastActiveDay !== today) {
    profile.activeDays += 1
  }

  if (!profile.seenSessions.includes(event.sessionId)) {
    profile.seenSessions = [...profile.seenSessions, event.sessionId]
    profile.sessions = profile.seenSessions.length
  }

  if (profile.lastActiveDay === null) {
    profile.currentStreak = 1
  } else if (profile.lastActiveDay !== today) {
    profile.currentStreak = profile.lastActiveDay === yesterdayOf(today) ? profile.currentStreak + 1 : 1
  }
  profile.lastActiveDay = today
  profile.longestStreak = Math.max(profile.longestStreak, profile.currentStreak)

  // A turn boundary interrupts a run of consecutive reads, and (P7 defensive
  // cleanup) drops any half-open step: an aborted turn that never emitted its
  // step/end must not leak its openStep / burst into the next turn. It must NOT
  // bump trajectoryTurns here — empty turns stay invisible to trajectory stats.
  let sessions = state.sessions
  const session = sessions[event.sessionId]
  if (session !== undefined) {
    sessions = {
      ...sessions,
      [event.sessionId]: { ...session, consecutiveReads: 0, openStep: null, currentStepToolCalls: 0 },
    }
  }

  return { ...state, profile, sessions }
}

function reduceToolCall(
  state: AchievementState,
  event: Extract<AchievementEvent, { kind: 'tool-call' }>,
): AchievementState {
  const { sessionId, seq, tool } = event
  const prev = state.sessions[sessionId] ?? createInitialSessionState()
  const next: SessionAchievementState = {
    ...prev,
    toolCalls: prev.toolCalls + 1,
    toolsByName: increment(prev.toolsByName, tool.name),
  }

  // P7 tool barrage: a settled invocation inside the currently open step counts
  // toward that step's burst (failed invocations included). Without an openStep
  // the burst is not guessed — existing tool/file/test facts still accumulate.
  if (prev.openStep !== null) {
    next.currentStepToolCalls = prev.currentStepToolCalls + 1
    next.maxToolCallsInStep = Math.max(prev.maxToolCallsInStep, next.currentStepToolCalls)
  }

  // Lifetime counters are built once and incremented per kind below, so the
  // Session and Profile views of the same event stay easy to audit together.
  const profile: ProfileState = {
    ...state.profile,
    toolCalls: state.profile.toolCalls + 1,
    toolsByName: increment(state.profile.toolsByName, tool.name),
  }

  switch (tool.kind) {
    case 'file-read': {
      if (!event.isError) {
        profile.fileReads += 1
        const path = tool.path ?? ''
        const isNewFile = prev.filesRead[path] === undefined
        next.filesRead = increment(prev.filesRead, path)
        if (prev.firstReadSeq === null) next.firstReadSeq = seq
        // Distinct files read before the first edit drive Rabbit Hole.
        if (prev.firstEditSeq === null && isNewFile) {
          next.readsBeforeFirstEdit = prev.readsBeforeFirstEdit + 1
        }
        next.consecutiveReads = prev.consecutiveReads + 1
      } else {
        next.consecutiveReads = 0
      }
      break
    }
    case 'file-edit': {
      if (!event.isError) {
        profile.fileEdits += 1
        const path = tool.path ?? ''
        const isNewFile = prev.filesEdited[path] === undefined
        next.filesEdited = increment(prev.filesEdited, path)
        next.edits = prev.edits + 1
        if (prev.firstEditSeq === null) next.firstEditSeq = seq
        // Distinct files edited before the first test drive YOLO.
        if (prev.firstTestSeq === null && isNewFile) {
          next.editsBeforeFirstTest = prev.editsBeforeFirstTest + 1
        }
      }
      next.consecutiveReads = 0
      break
    }
    case 'shell-command': {
      next.commands = increment(prev.commands, tool.command ?? '')
      next.consecutiveReads = 0
      break
    }
    case 'test-run': {
      profile.testRuns += 1
      const command = tool.command ?? ''
      const passed = !event.isError
      if (passed) profile.testPasses += 1
      else profile.testFailures += 1
      next.commands = increment(prev.commands, command)
      next.tests = {
        runs: prev.tests.runs + 1,
        passed: prev.tests.passed + (passed ? 1 : 0),
        failed: prev.tests.failed + (passed ? 0 : 1),
        lastOutcome: passed ? 'pass' : 'fail',
      }
      // Track the current same-command failure streak (Surely This Time).
      if (passed) {
        next.failingCommand = null
        next.failingStreak = 0
      } else if (prev.failingCommand === command) {
        next.failingStreak = prev.failingStreak + 1
      } else {
        next.failingCommand = command
        next.failingStreak = 1
      }
      if (prev.firstTestSeq === null) {
        next.firstTestSeq = seq
        next.firstTestOutcome = passed ? 'pass' : 'fail'
      }
      next.consecutiveReads = 0
      break
    }
    default: {
      next.consecutiveReads = 0
      break
    }
  }

  return {
    ...state,
    profile,
    sessions: touchSession(state.sessions, sessionId, next),
  }
}

function increment(map: Record<string, number>, key: string): Record<string, number> {
  return { ...map, [key]: (map[key] ?? 0) + 1 }
}
