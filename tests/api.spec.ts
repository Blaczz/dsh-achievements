/** API contract: shared paths + the SSE unlock frame. */
import { describe, expect, it } from 'vitest'
import {
  ACHIEVEMENTS_API_PREFIX, ACHIEVEMENTS_EVENTS_API_PATH, ACHIEVEMENTS_STATE_API_PATH, unlockEventFrame,
} from '../src/api.ts'

describe('api paths', () => {
  it('keeps state and events endpoints under the shared prefix', () => {
    expect(ACHIEVEMENTS_STATE_API_PATH).toBe(`${ACHIEVEMENTS_API_PREFIX}/state`)
    expect(ACHIEVEMENTS_EVENTS_API_PATH).toBe(`${ACHIEVEMENTS_API_PREFIX}/events`)
  })
})

describe('unlock SSE frame', () => {
  it('emits a named unlock event with a JSON id payload', () => {
    expect(unlockEventFrame('deja-vu')).toBe('event: unlock\ndata: {"id":"deja-vu"}\n\n')
  })
})
