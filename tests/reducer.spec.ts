/** Session behavior reducer: standardized events fold into profile + session state. */
import { describe, expect, it } from 'vitest'
import type { AchievementEvent, ToolSummary } from '../src/events.ts'
import { buildContext, reduceState, yesterdayOf } from '../src/reducer.ts'
import { createInitialState } from '../src/state.ts'

function turnEnd(sessionId: string, seq: number): AchievementEvent {
  return { kind: 'turn-end', sessionId, seq }
}

function tool(sessionId: string, seq: number, summary: ToolSummary, isError = false): AchievementEvent {
  return { kind: 'tool-call', sessionId, seq, callId: null, tool: summary, isError }
}

const read = (path: string): ToolSummary => ({ kind: 'file-read', name: 'read', path })
const edit = (path: string): ToolSummary => ({ kind: 'file-edit', name: 'edit', path })
const shell = (command: string): ToolSummary => ({ kind: 'shell-command', name: 'bash', command })
const test = (command: string): ToolSummary => ({ kind: 'test-run', name: 'bash', command })
const other = (name = 'web_search'): ToolSummary => ({ kind: 'other', name })

function stepStart(sessionId: string, seq: number, time: number, turn: number, step: number): AchievementEvent {
  return { kind: 'step-start', sessionId, seq, time, turn, step }
}

function stepEnd(sessionId: string, seq: number, time: number, turn: number, step: number): AchievementEvent {
  return { kind: 'step-end', sessionId, seq, time, turn, step }
}

function assistantMessage(sessionId: string, seq: number, time: number, turn: number, step: number): AchievementEvent {
  return { kind: 'assistant-message', sessionId, seq, time, turn, step }
}

describe('reducer — tool activity', () => {
  it('updates filesRead and consecutiveReads for reads', () => {
    let state = reduceState(createInitialState(), tool('s', 0, read('a.txt')), '2026-01-01')
    expect(state.sessions.s?.filesRead['a.txt']).toBe(1)
    expect(state.sessions.s?.consecutiveReads).toBe(1)
    state = reduceState(state, tool('s', 1, read('b.txt')), '2026-01-01')
    expect(state.sessions.s?.consecutiveReads).toBe(2)
  })

  it('resets consecutiveReads on any non-read event', () => {
    let state = reduceState(createInitialState(), tool('s', 0, read('a.txt')), '2026-01-01')
    state = reduceState(state, tool('s', 1, other()), '2026-01-01')
    expect(state.sessions.s?.consecutiveReads).toBe(0)
    state = reduceState(state, tool('s', 2, read('c.txt')), '2026-01-01')
    expect(state.sessions.s?.consecutiveReads).toBe(1)
    state = reduceState(state, turnEnd('s', 3), '2026-01-01')
    expect(state.sessions.s?.consecutiveReads).toBe(0)
  })

  it('updates filesEdited, firstEditSeq and editsBeforeFirstTest', () => {
    let state = reduceState(createInitialState(), tool('s', 2, edit('a.ts')), '2026-01-01')
    expect(state.sessions.s?.filesEdited['a.ts']).toBe(1)
    expect(state.sessions.s?.firstEditSeq).toBe(2)
    expect(state.sessions.s?.editsBeforeFirstTest).toBe(1)
    state = reduceState(state, tool('s', 3, edit('b.ts')), '2026-01-01')
    expect(state.sessions.s?.editsBeforeFirstTest).toBe(2)
  })

  it('tracks firstReadSeq, total edits, and firstTestOutcome', () => {
    let state = reduceState(createInitialState(), tool('s', 1, read('a.txt')), '2026-01-01')
    expect(state.sessions.s?.firstReadSeq).toBe(1)
    state = reduceState(state, tool('s', 2, edit('a.ts')), '2026-01-01')
    expect(state.sessions.s?.edits).toBe(1)
    state = reduceState(state, tool('s', 3, edit('a.ts')), '2026-01-01')
    expect(state.sessions.s?.edits).toBe(2)
    state = reduceState(state, tool('s', 4, test('npm test'), true), '2026-01-01')
    expect(state.sessions.s?.firstTestOutcome).toBe('fail')
    // A later passing test does not rewrite the first test's outcome.
    state = reduceState(state, tool('s', 5, test('npm test'), false), '2026-01-01')
    expect(state.sessions.s?.firstTestOutcome).toBe('fail')
  })

  it('does not set firstReadSeq or edits for errored invocations', () => {
    let state = reduceState(createInitialState(), tool('s', 0, read('a.txt'), true), '2026-01-01')
    state = reduceState(state, tool('s', 1, edit('a.ts'), true), '2026-01-01')
    expect(state.sessions.s?.firstReadSeq).toBeNull()
    expect(state.sessions.s?.edits).toBe(0)
  })

  it('freezes editsBeforeFirstTest once the first test runs', () => {
    let state = reduceState(createInitialState(), tool('s', 1, edit('a.ts')), '2026-01-01')
    state = reduceState(state, tool('s', 2, test('npm test'), false), '2026-01-01')
    expect(state.sessions.s?.firstTestSeq).toBe(2)
    expect(state.sessions.s?.editsBeforeFirstTest).toBe(1)
    state = reduceState(state, tool('s', 3, edit('c.ts')), '2026-01-01')
    expect(state.sessions.s?.editsBeforeFirstTest).toBe(1)
  })

  it('updates tests runs/passed/failed and lastOutcome from isError', () => {
    let state = reduceState(createInitialState(), tool('s', 0, test('npm test'), false), '2026-01-01')
    expect(state.sessions.s?.tests).toEqual({ runs: 1, passed: 1, failed: 0, lastOutcome: 'pass' })
    state = reduceState(state, tool('s', 1, test('npm test'), true), '2026-01-01')
    expect(state.sessions.s?.tests).toEqual({ runs: 2, passed: 1, failed: 1, lastOutcome: 'fail' })
  })

  it('tracks the same-command failure streak and resets on pass or command change', () => {
    let state = reduceState(createInitialState(), tool('s', 0, test('npm test'), true), '2026-01-01')
    state = reduceState(state, tool('s', 1, test('npm test'), true), '2026-01-01')
    expect(state.sessions.s?.failingCommand).toBe('npm test')
    expect(state.sessions.s?.failingStreak).toBe(2)
    // A different command resets the streak.
    state = reduceState(state, tool('s', 2, test('vitest'), true), '2026-01-01')
    expect(state.sessions.s?.failingCommand).toBe('vitest')
    expect(state.sessions.s?.failingStreak).toBe(1)
    // A pass clears the streak entirely.
    state = reduceState(state, tool('s', 3, test('vitest'), false), '2026-01-01')
    expect(state.sessions.s?.failingCommand).toBeNull()
    expect(state.sessions.s?.failingStreak).toBe(0)
  })

  it('counts distinct files read before first edit (readsBeforeFirstEdit)', () => {
    let state = reduceState(createInitialState(), tool('s', 0, read('a.txt')), '2026-01-01')
    state = reduceState(state, tool('s', 1, read('a.txt')), '2026-01-01')
    state = reduceState(state, tool('s', 2, read('b.txt')), '2026-01-01')
    expect(state.sessions.s?.readsBeforeFirstEdit).toBe(2)
    // The first edit freezes the count; later reads do not add.
    state = reduceState(state, tool('s', 3, edit('x.ts')), '2026-01-01')
    state = reduceState(state, tool('s', 4, read('c.txt')), '2026-01-01')
    expect(state.sessions.s?.readsBeforeFirstEdit).toBe(2)
  })

  it('counts distinct files edited before first test (editsBeforeFirstTest)', () => {
    let state = reduceState(createInitialState(), tool('s', 0, edit('a.ts')), '2026-01-01')
    state = reduceState(state, tool('s', 1, edit('a.ts')), '2026-01-01')
    state = reduceState(state, tool('s', 2, edit('b.ts')), '2026-01-01')
    expect(state.sessions.s?.editsBeforeFirstTest).toBe(2)
  })

  it('updates commands for both shell-command and test-run', () => {
    let state = reduceState(createInitialState(), tool('s', 0, shell('ls')), '2026-01-01')
    state = reduceState(state, tool('s', 1, shell('ls')), '2026-01-01')
    state = reduceState(state, tool('s', 2, test('npm test')), '2026-01-01')
    expect(state.sessions.s?.commands['ls']).toBe(2)
    expect(state.sessions.s?.commands['npm test']).toBe(1)
  })

  it('counts toolCalls/toolsByName for every invocation, and lifetime toolCalls', () => {
    let state = reduceState(createInitialState(), tool('s', 0, read('a.txt')), '2026-01-01')
    state = reduceState(state, tool('s', 1, other()), '2026-01-01')
    expect(state.sessions.s?.toolCalls).toBe(2)
    expect(state.sessions.s?.toolsByName['read']).toBe(1)
    expect(state.sessions.s?.toolsByName['web_search']).toBe(1)
    expect(state.profile.toolCalls).toBe(2)
    expect(state.profile.toolsByName['read']).toBe(1)
    expect(state.profile.toolsByName['web_search']).toBe(1)
  })

  it('does not count a failed read/edit toward filesRead/filesEdited', () => {
    let state = reduceState(createInitialState(), tool('s', 0, read('a.txt'), true), '2026-01-01')
    state = reduceState(state, tool('s', 1, edit('a.ts'), true), '2026-01-01')
    expect(state.sessions.s?.filesRead).toEqual({})
    expect(state.sessions.s?.filesEdited).toEqual({})
    expect(state.sessions.s?.toolCalls).toBe(2)
  })

  it('keeps session behavior isolated across session ids', () => {
    let state = reduceState(createInitialState(), tool('s1', 0, read('a.txt')), '2026-01-01')
    state = reduceState(state, tool('s2', 0, read('a.txt')), '2026-01-01')
    expect(state.sessions.s1?.filesRead['a.txt']).toBe(1)
    expect(state.sessions.s2?.filesRead['a.txt']).toBe(1)
    expect(state.sessions.s1?.consecutiveReads).toBe(1)
  })
})

describe('reducer — turns / streak', () => {
  it('updates profile turns, distinct sessions and streak on turn-end', () => {
    let state = reduceState(createInitialState(), turnEnd('s1', 0), '2026-01-01')
    expect(state.profile.turns).toBe(1)
    expect(state.profile.sessions).toBe(1)
    expect(state.profile.currentStreak).toBe(1)
    expect(state.profile.longestStreak).toBe(1)
    state = reduceState(state, turnEnd('s2', 0), '2026-01-01')
    expect(state.profile.sessions).toBe(2)
    state = reduceState(state, turnEnd('s1', 1), '2026-01-02')
    expect(state.profile.currentStreak).toBe(2)
    expect(state.profile.longestStreak).toBe(2)
  })
})

describe('reducer — lifetime metrics (P6)', () => {
  it('accumulates activeDays once per calendar day, independent of session id', () => {
    let state = createInitialState()
    expect(state.profile.activeDays).toBe(0)
    state = reduceState(state, turnEnd('s1', 0), '2026-01-01')
    expect(state.profile.activeDays).toBe(1)
    state = reduceState(state, turnEnd('s1', 1), '2026-01-01')
    expect(state.profile.activeDays).toBe(1)
    state = reduceState(state, turnEnd('s2', 0), '2026-01-02')
    expect(state.profile.activeDays).toBe(2)
  })

  it('still +1 activeDays across a streak gap while currentStreak resets', () => {
    let state = reduceState(createInitialState(), turnEnd('s', 0), '2026-01-01')
    state = reduceState(state, turnEnd('s', 1), '2026-01-02')
    expect(state.profile.currentStreak).toBe(2)
    state = reduceState(state, turnEnd('s', 2), '2026-01-05')
    expect(state.profile.activeDays).toBe(3)
    expect(state.profile.currentStreak).toBe(1)
    expect(state.profile.longestStreak).toBe(2)
  })

  it('accumulates lifetime fileReads on success and ignores failed reads', () => {
    let state = reduceState(createInitialState(), tool('s', 0, read('a.txt')), '2026-01-01')
    state = reduceState(state, tool('s', 1, read('a.txt')), '2026-01-01')
    state = reduceState(state, tool('s', 2, read('b.txt'), true), '2026-01-01')
    expect(state.profile.fileReads).toBe(2)
  })

  it('accumulates lifetime fileEdits on success and ignores failed edits', () => {
    let state = reduceState(createInitialState(), tool('s', 0, edit('a.ts')), '2026-01-01')
    state = reduceState(state, tool('s', 1, edit('a.ts')), '2026-01-01')
    state = reduceState(state, tool('s', 2, edit('b.ts'), true), '2026-01-01')
    expect(state.profile.fileEdits).toBe(2)
    expect(state.sessions.s?.edits).toBe(2)
  })

  it('accumulates lifetime testRuns/passes/failures in sync with the session', () => {
    let state = reduceState(createInitialState(), tool('s', 0, test('npm test')), '2026-01-01')
    state = reduceState(state, tool('s', 1, test('npm test'), true), '2026-01-01')
    state = reduceState(state, tool('s', 2, shell('ls')), '2026-01-01')
    expect(state.profile.testRuns).toBe(2)
    expect(state.profile.testPasses).toBe(1)
    expect(state.profile.testFailures).toBe(1)
    expect(state.sessions.s?.tests).toEqual({ runs: 2, passed: 1, failed: 1, lastOutcome: 'fail' })
  })
})

describe('buildContext', () => {
  it('returns profile plus the session bucket, or an empty session for unknown ids', () => {
    let state = reduceState(createInitialState(), tool('s1', 0, read('a.txt')), '2026-01-01')
    const ctx = buildContext(state, 's1')
    expect(ctx.profile).toBe(state.profile)
    expect(ctx.session.filesRead['a.txt']).toBe(1)
    const missing = buildContext(state, 'nope')
    expect(missing.session.toolCalls).toBe(0)
  })
})

describe('yesterdayOf', () => {
  it('steps back one calendar day across month and year boundaries', () => {
    expect(yesterdayOf('2026-01-01')).toBe('2025-12-31')
    expect(yesterdayOf('2026-03-01')).toBe('2026-02-28')
    expect(yesterdayOf('2026-01-10')).toBe('2026-01-09')
  })
})

describe('reducer — P7 step counting', () => {
  it('1 step/start does not count a closed step', () => {
    const state = reduceState(createInitialState(), stepStart('s', 0, 1000, 1, 1), '2026-01-01')
    expect(state.sessions.s?.steps).toBe(0)
    expect(state.sessions.s?.openStep).toEqual({ turn: 1, step: 1, startedAt: 1000 })
  })

  it('1 step/end → steps +1', () => {
    const state = reduceState(createInitialState(), stepEnd('s', 0, 1000, 1, 1), '2026-01-01')
    expect(state.sessions.s?.steps).toBe(1)
  })

  it('5 step/end in the same turn → currentTurnSteps=5, maxStepsInTurn=5', () => {
    let state = createInitialState()
    for (let i = 0; i < 5; i += 1) state = reduceState(state, stepEnd('s', i, 1000 + i, 1, i + 1), '2026-01-01')
    expect(state.sessions.s?.currentTurnSteps).toBe(5)
    expect(state.sessions.s?.maxStepsInTurn).toBe(5)
  })

  it('a new turn resets currentTurnSteps but keeps the max', () => {
    let state = createInitialState()
    for (let i = 0; i < 5; i += 1) state = reduceState(state, stepEnd('s', i, 1000, 1, i + 1), '2026-01-01')
    state = reduceState(state, stepEnd('s', 5, 2000, 2, 1), '2026-01-01')
    expect(state.sessions.s?.currentTurnSteps).toBe(1)
    expect(state.sessions.s?.maxStepsInTurn).toBe(5)
  })

  it('turn number jumps still count +1 per distinct observed closed turn', () => {
    let state = reduceState(createInitialState(), stepEnd('s', 0, 1000, 1, 1), '2026-01-01')
    state = reduceState(state, stepEnd('s', 1, 1000, 5, 1), '2026-01-01')
    expect(state.sessions.s?.trajectoryTurns).toBe(2)
  })

  it('500-step loop (no real model) yields steps=500, maxStepsInTurn=500', () => {
    let state = createInitialState()
    for (let i = 0; i < 500; i += 1) state = reduceState(state, stepEnd('s', i, 1000 + i, 1, i + 1), '2026-01-01')
    expect(state.sessions.s?.steps).toBe(500)
    expect(state.sessions.s?.maxStepsInTurn).toBe(500)
  })
})

describe('reducer — P7 session turn counting', () => {
  it('multiple steps in turn 1 keep trajectoryTurns=1', () => {
    let state = reduceState(createInitialState(), stepEnd('s', 0, 1000, 1, 1), '2026-01-01')
    state = reduceState(state, stepEnd('s', 1, 1000, 1, 2), '2026-01-01')
    expect(state.sessions.s?.trajectoryTurns).toBe(1)
  })

  it('the first step/end of turn 2 → trajectoryTurns=2', () => {
    let state = reduceState(createInitialState(), stepEnd('s', 0, 1000, 1, 1), '2026-01-01')
    state = reduceState(state, stepEnd('s', 1, 1000, 2, 1), '2026-01-01')
    expect(state.sessions.s?.trajectoryTurns).toBe(2)
  })

  it('turn/end without step/end never bumps trajectoryTurns', () => {
    // A lone turn/end creates no session bucket, and legacy profile.turns still +1.
    let state = reduceState(createInitialState(), turnEnd('s', 0), '2026-01-01')
    expect(state.sessions.s).toBeUndefined()
    expect(state.profile.turns).toBe(1)
    // A turn/end after a closed step must not add a second trajectory turn.
    state = reduceState(createInitialState(), stepEnd('s', 0, 1000, 1, 1), '2026-01-01')
    state = reduceState(state, turnEnd('s', 1), '2026-01-01')
    expect(state.sessions.s?.trajectoryTurns).toBe(1)
  })
})

describe('reducer — P7 request duration', () => {
  it('pairs a matching start/message into the correct ms duration', () => {
    let state = reduceState(createInitialState(), stepStart('s', 0, 1000, 1, 1), '2026-01-01')
    state = reduceState(state, assistantMessage('s', 1, 118000, 1, 1), '2026-01-01')
    expect(state.sessions.s?.lastRequestDurationMs).toBe(117000)
    expect(state.sessions.s?.maxRequestDurationMs).toBe(117000)
  })

  it('a second shorter request does not lower the max', () => {
    let state = reduceState(createInitialState(), stepStart('s', 0, 1000, 1, 1), '2026-01-01')
    state = reduceState(state, assistantMessage('s', 1, 118000, 1, 1), '2026-01-01')
    state = reduceState(state, stepEnd('s', 2, 118000, 1, 1), '2026-01-01')
    state = reduceState(state, stepStart('s', 3, 200000, 1, 2), '2026-01-01')
    state = reduceState(state, assistantMessage('s', 4, 210000, 1, 2), '2026-01-01')
    expect(state.sessions.s?.lastRequestDurationMs).toBe(10000)
    expect(state.sessions.s?.maxRequestDurationMs).toBe(117000)
  })

  it('a second longer request updates the max', () => {
    let state = reduceState(createInitialState(), stepStart('s', 0, 1000, 1, 1), '2026-01-01')
    state = reduceState(state, assistantMessage('s', 1, 118000, 1, 1), '2026-01-01')
    state = reduceState(state, stepEnd('s', 2, 118000, 1, 1), '2026-01-01')
    state = reduceState(state, stepStart('s', 3, 200000, 1, 2), '2026-01-01')
    state = reduceState(state, assistantMessage('s', 4, 400000, 1, 2), '2026-01-01')
    expect(state.sessions.s?.maxRequestDurationMs).toBe(200000)
  })

  it('a message without a matching start is ignored', () => {
    const state = reduceState(createInitialState(), assistantMessage('s', 0, 5000, 1, 1), '2026-01-01')
    expect(state.sessions.s).toBeUndefined()
  })

  it('a message with a mismatched turn/step is ignored', () => {
    let state = reduceState(createInitialState(), stepStart('s', 0, 1000, 1, 1), '2026-01-01')
    state = reduceState(state, assistantMessage('s', 1, 5000, 1, 2), '2026-01-01')
    expect(state.sessions.s?.lastRequestDurationMs).toBeNull()
    expect(state.sessions.s?.maxRequestDurationMs).toBe(0)
  })

  it('clamps a time inversion to 0 (no negative duration)', () => {
    let state = reduceState(createInitialState(), stepStart('s', 0, 5000, 1, 1), '2026-01-01')
    state = reduceState(state, assistantMessage('s', 1, 3000, 1, 1), '2026-01-01')
    expect(state.sessions.s?.lastRequestDurationMs).toBe(0)
    expect(state.sessions.s?.maxRequestDurationMs).toBe(0)
  })

  it('step/end never fabricates a request duration', () => {
    let state = reduceState(createInitialState(), stepStart('s', 0, 1000, 1, 1), '2026-01-01')
    state = reduceState(state, stepEnd('s', 1, 118000, 1, 1), '2026-01-01')
    expect(state.sessions.s?.lastRequestDurationMs).toBeNull()
    expect(state.sessions.s?.maxRequestDurationMs).toBe(0)
  })
})

describe('reducer — P7 tool barrage', () => {
  it('counts 5 settled native calls inside one step toward the burst', () => {
    let state = reduceState(createInitialState(), stepStart('s', 0, 1000, 1, 1), '2026-01-01')
    for (let i = 0; i < 5; i += 1) state = reduceState(state, tool('s', i + 1, other()), '2026-01-01')
    expect(state.sessions.s?.currentStepToolCalls).toBe(5)
    expect(state.sessions.s?.maxToolCallsInStep).toBe(5)
  })

  it('resets the burst on a new step while keeping the max', () => {
    let state = reduceState(createInitialState(), stepStart('s', 0, 1000, 1, 1), '2026-01-01')
    for (let i = 0; i < 5; i += 1) state = reduceState(state, tool('s', i + 1, other()), '2026-01-01')
    state = reduceState(state, stepEnd('s', 6, 2000, 1, 1), '2026-01-01')
    state = reduceState(state, stepStart('s', 7, 3000, 1, 2), '2026-01-01')
    expect(state.sessions.s?.currentStepToolCalls).toBe(0)
    expect(state.sessions.s?.maxToolCallsInStep).toBe(5)
    state = reduceState(state, tool('s', 8, other()), '2026-01-01')
    expect(state.sessions.s?.currentStepToolCalls).toBe(1)
  })

  it('a failed settled tool still counts one burst invocation', () => {
    let state = reduceState(createInitialState(), stepStart('s', 0, 1000, 1, 1), '2026-01-01')
    state = reduceState(state, tool('s', 1, read('a.txt'), true), '2026-01-01')
    expect(state.sessions.s?.currentStepToolCalls).toBe(1)
    expect(state.sessions.s?.maxToolCallsInStep).toBe(1)
  })

  it('a tool call without an open step skips the burst but keeps old counters', () => {
    const state = reduceState(createInitialState(), tool('s', 0, read('a.txt')), '2026-01-01')
    expect(state.sessions.s?.currentStepToolCalls).toBe(0)
    expect(state.sessions.s?.maxToolCallsInStep).toBe(0)
    expect(state.sessions.s?.toolCalls).toBe(1)
  })
})

describe('reducer — P7 defensive boundaries', () => {
  it('overwrites a stale openStep on a new step/start without computing duration', () => {
    let state = reduceState(createInitialState(), stepStart('s', 0, 1000, 1, 1), '2026-01-01')
    state = reduceState(state, tool('s', 1, other()), '2026-01-01')
    state = reduceState(state, stepStart('s', 2, 9000, 1, 2), '2026-01-01')
    expect(state.sessions.s?.openStep).toEqual({ turn: 1, step: 2, startedAt: 9000 })
    expect(state.sessions.s?.currentStepToolCalls).toBe(0)
    expect(state.sessions.s?.maxRequestDurationMs).toBe(0)
  })

  it('turn/end drops a half-open step without bumping trajectoryTurns', () => {
    let state = reduceState(createInitialState(), stepStart('s', 0, 1000, 1, 1), '2026-01-01')
    state = reduceState(state, tool('s', 1, other()), '2026-01-01')
    state = reduceState(state, turnEnd('s', 2), '2026-01-01')
    expect(state.sessions.s?.openStep).toBeNull()
    expect(state.sessions.s?.currentStepToolCalls).toBe(0)
    expect(state.sessions.s?.trajectoryTurns).toBe(0)
  })
})
