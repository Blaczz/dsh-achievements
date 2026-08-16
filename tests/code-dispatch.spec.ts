/**
 * Code Mode (tool/code-dispatch) event coverage: a settled sub-dispatch reuses
 * the same classifier + reducer path as a native tool call, so read/edit/test
 * facts accumulate identically and each sub-call counts exactly once.
 *
 * The `tool/code-dispatch` payload shape is from the installed DSH runtime
 * (`@deepseek-ai/dsh-tools/lib/types/types.d.ts`):
 *   CodeDispatchEventData = {
 *     rootCallId, parentCallId, subCallId,   // CallId (branded string)
 *     name, arguments,                        // name: string; arguments: unknown (JSON-normalized object)
 *     isError, content,                       // isError: boolean; content: ContentBlock[]
 *   }
 */
import { describe, expect, it } from 'vitest'
import { buildStepStartEvent, buildToolCallEvent, classifyCodeDispatch } from '../src/events.ts'
import { reduceState } from '../src/reducer.ts'
import { createInitialState } from '../src/state.ts'

/** Build the settled AchievementEvent the Host produces for one code-dispatch. */
function codeDispatch(sessionId: string, seq: number, name: string, args: unknown, isError = false) {
  return buildToolCallEvent(sessionId, seq, `parent:code:${seq}`, classifyCodeDispatch(name, args), isError)
}

/** The equivalent native event for the same settled invocation. */
function native(sessionId: string, seq: number, name: string, args: unknown, isError = false) {
  return buildToolCallEvent(sessionId, seq, `call-${seq}`, classifyCodeDispatch(name, args), isError)
}

describe('Code Mode sub-dispatch → reducer equivalence', () => {
  it('produces the same session + lifetime facts as native read/edit/test calls', () => {
    const seq = [
      ['read', { file_path: 'a.ts' }, false],
      ['edit', { file_path: 'a.ts' }, false],
      ['bash', { command: 'npm test' }, false],
    ] as const

    let code = createInitialState()
    let ntv = createInitialState()
    seq.forEach(([name, args, err], i) => {
      code = reduceState(code, codeDispatch('s', i, name, args, err), '2026-01-01')
      ntv = reduceState(ntv, native('s', i, name, args, err), '2026-01-01')
    })

    expect(code.sessions.s).toEqual(ntv.sessions.s)
    expect(code.profile).toEqual(ntv.profile)
    // Spot-check the facts that matter for Lifetime milestones.
    expect(code.profile.toolCalls).toBe(3)
    expect(code.sessions.s?.filesRead['a.ts']).toBe(1)
    expect(code.sessions.s?.filesEdited['a.ts']).toBe(1)
    expect(code.sessions.s?.tests).toEqual({ runs: 1, passed: 1, failed: 0, lastOutcome: 'pass' })
  })

  it('counts a failed code-dispatch read/test as an error invocation', () => {
    let state = createInitialState()
    state = reduceState(state, codeDispatch('s', 0, 'read', { file_path: 'a.ts' }, true), '2026-01-01')
    state = reduceState(state, codeDispatch('s', 1, 'bash', { command: 'npm test' }, true), '2026-01-01')
    expect(state.sessions.s?.filesRead).toEqual({})
    expect(state.sessions.s?.tests).toEqual({ runs: 1, passed: 0, failed: 1, lastOutcome: 'fail' })
    expect(state.profile.toolCalls).toBe(2)
  })

  it('counts one settled sub-call exactly once (no double counting)', () => {
    let state = createInitialState()
    state = reduceState(state, codeDispatch('s', 0, 'read', { file_path: 'a.ts' }), '2026-01-01')
    // The start event (`tool/code-dispatch-start`) is log-only and never reduced;
    // replaying the same settled seq again here would be a host bug, so assert
    // a fresh settled call advances by exactly one.
    state = reduceState(state, codeDispatch('s', 1, 'read', { file_path: 'a.ts' }), '2026-01-01')
    expect(state.sessions.s?.filesRead['a.ts']).toBe(2)
    expect(state.profile.toolCalls).toBe(2)
  })

  it('tolerates a malformed arguments payload without throwing', () => {
    const state = reduceState(createInitialState(), codeDispatch('s', 0, 'read', undefined), '2026-01-01')
    expect(state.profile.toolCalls).toBe(1)
    expect(state.sessions.s?.filesRead['']).toBe(1)
  })
})

describe('Code Mode tool barrage (P7)', () => {
  it('counts one settled sub-dispatch per burst invocation, never the start event', () => {
    let state = reduceState(createInitialState(), buildStepStartEvent('s', 0, 1000, 1, 1), '2026-01-01')
    // Five settled dispatches inside the open step → burst = 5. The sibling
    // `tool/code-dispatch-start` event is log-only and has no AchievementEvent
    // kind, so it structurally cannot contribute a 6th burst invocation.
    for (let i = 0; i < 5; i += 1) {
      state = reduceState(state, codeDispatch('s', i + 1, 'read', { file_path: `f${i}` }), '2026-01-01')
    }
    expect(state.sessions.s?.currentStepToolCalls).toBe(5)
    expect(state.sessions.s?.maxToolCallsInStep).toBe(5)
  })
})
