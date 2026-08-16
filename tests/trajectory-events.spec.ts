/**
 * P7 standard event vocabulary: the three new low-frequency boundaries the
 * Host feeds into the engine. Shapes mirror the installed DSH runtime:
 *
 *   SessionEvent envelope = { type, seq, time (Unix epoch ms), data }
 *   step/start        → data { turn, step }
 *   assistant/message → data { turn, step, message, usage?: TokenUsage }
 *   step/end          → data { turn, step }
 *   TokenUsage        → { inputTokens, outputTokens, cacheReadTokens?, cacheWriteTokens?, reasoningTokens? }
 *
 * Verified against `@deepseek-ai/dsh-session/lib/types/types.d.ts` and
 * `@deepseek-ai/dsh-llm/lib/types/types.d.ts` in the installed host.
 */
import { describe, expect, it } from 'vitest'
import {
  buildAssistantMessageEvent, buildStepEndEvent, buildStepStartEvent, buildToolCallEvent, buildTurnEndEvent,
  type AchievementTokenUsage,
} from '../src/events.ts'

describe('P7 event builders', () => {
  it('buildStepStartEvent carries time / turn / step', () => {
    expect(buildStepStartEvent('s', 3, 1700000000000, 1, 2)).toEqual({
      kind: 'step-start', sessionId: 's', seq: 3, time: 1700000000000, turn: 1, step: 2,
    })
  })

  it('buildAssistantMessageEvent carries time / turn / step / optional usage', () => {
    const usage: AchievementTokenUsage = { inputTokens: 500, outputTokens: 100, reasoningTokens: 400 }
    expect(buildAssistantMessageEvent('s', 4, 1700000000000, 1, 2, usage)).toEqual({
      kind: 'assistant-message', sessionId: 's', seq: 4, time: 1700000000000, turn: 1, step: 2, usage,
    })
    expect(buildAssistantMessageEvent('s', 4, 1700000000000, 1, 2)).toEqual({
      kind: 'assistant-message', sessionId: 's', seq: 4, time: 1700000000000, turn: 1, step: 2, usage: undefined,
    })
  })

  it('buildStepEndEvent carries time / turn / step', () => {
    expect(buildStepEndEvent('s', 5, 1700000000000, 1, 2)).toEqual({
      kind: 'step-end', sessionId: 's', seq: 5, time: 1700000000000, turn: 1, step: 2,
    })
  })

  it('keeps the existing turn-end and tool-call builders unchanged', () => {
    expect(buildTurnEndEvent('s', 0)).toEqual({ kind: 'turn-end', sessionId: 's', seq: 0 })
    expect(buildToolCallEvent('s', 1, 'c1', { kind: 'other', name: 'x' }, false)).toEqual({
      kind: 'tool-call', sessionId: 's', seq: 1, callId: 'c1', tool: { kind: 'other', name: 'x' }, isError: false,
    })
  })
})
