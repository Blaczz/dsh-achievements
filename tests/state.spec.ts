/** State v2: migration, session bucket lifecycle, and JSON round-trip. */
import { describe, expect, it } from 'vitest'
import {
  MAX_SESSIONS, createInitialSessionState, createInitialState, migrateState, touchSession,
} from '../src/state.ts'
import type { SessionAchievementState } from '../src/state.ts'

describe('state migration', () => {
  it('migrates a v1 counter state losslessly', () => {
    const v1 = {
      counters: { turns: 42, toolCalls: 7, sessions: 3, streakDays: 5 },
      unlocked: { 'first-turn': 123, 'ten-turns': 456 },
      lastActiveDay: '2026-01-05',
      seenSessions: ['a', 'b', 'c'],
    }
    const state = migrateState(v1)
    expect(state.version).toBe(2)
    expect(state.profile.turns).toBe(42)
    expect(state.profile.toolCalls).toBe(7)
    expect(state.profile.sessions).toBe(3)
    expect(state.profile.currentStreak).toBe(5)
    expect(state.profile.longestStreak).toBe(5)
    expect(state.profile.lastActiveDay).toBe('2026-01-05')
    expect(state.profile.seenSessions).toEqual(['a', 'b', 'c'])
    expect(state.profile.unlocked).toEqual({ 'first-turn': 123, 'ten-turns': 456 })
    expect(state.sessions).toEqual({})
  })

  it('returns fresh state for non-object or unknown input', () => {
    for (const input of [null, undefined, 'x', 42, {}, { version: 99 }]) {
      expect(migrateState(input).version).toBe(2)
    }
  })

  it('normalizes a partial v2 state, defaulting missing fields', () => {
    const partial = {
      version: 2,
      profile: { turns: 9, currentStreak: 2, unlocked: { a: 1 } },
      sessions: { s1: { toolCalls: 3 } },
    }
    const state = migrateState(partial)
    expect(state.profile.turns).toBe(9)
    expect(state.profile.currentStreak).toBe(2)
    expect(state.profile.toolCalls).toBe(0)
    expect(state.profile.unlocked).toEqual({ a: 1 })
    expect(state.sessions.s1?.toolCalls).toBe(3)
    expect(state.sessions.s1?.filesRead).toEqual({})
  })

  it('normalizes the behavior fields (lastOutcome, streak, reads-before-edit) and rejects invalid lastOutcome', () => {
    const partial = {
      version: 2,
      profile: {},
      sessions: {
        s1: { tests: { runs: 3, passed: 1, failed: 2, lastOutcome: 'pass' }, failingCommand: 'npm test', failingStreak: 4, readsBeforeFirstEdit: 12, editsBeforeFirstTest: 7 },
        s2: { tests: { lastOutcome: 'bogus' }, failingCommand: 42 },
      },
    }
    const state = migrateState(partial)
    expect(state.sessions.s1?.tests.lastOutcome).toBe('pass')
    expect(state.sessions.s1?.failingCommand).toBe('npm test')
    expect(state.sessions.s1?.failingStreak).toBe(4)
    expect(state.sessions.s1?.readsBeforeFirstEdit).toBe(12)
    expect(state.sessions.s1?.editsBeforeFirstTest).toBe(7)
    expect(state.sessions.s2?.tests.lastOutcome).toBeNull()
    expect(state.sessions.s2?.failingCommand).toBeNull()
  })

  it('normalizes the v0.2 fields (firstReadSeq, firstTestOutcome, edits) and rejects invalid values', () => {
    const partial = {
      version: 2,
      profile: {},
      sessions: {
        s1: { firstReadSeq: 3, firstTestOutcome: 'pass', edits: 4 },
        s2: { firstTestOutcome: 'bogus', edits: 'nope' },
      },
    }
    const state = migrateState(partial)
    expect(state.sessions.s1?.firstReadSeq).toBe(3)
    expect(state.sessions.s1?.firstTestOutcome).toBe('pass')
    expect(state.sessions.s1?.edits).toBe(4)
    expect(state.sessions.s2?.firstReadSeq).toBeNull()
    expect(state.sessions.s2?.firstTestOutcome).toBeNull()
    expect(state.sessions.s2?.edits).toBe(0)
  })

  it('round-trips profile/unlocks/sessions through JSON', () => {
    const state = createInitialState()
    state.profile.turns = 5
    state.profile.unlocked['first-turn'] = 111
    state.sessions.s1 = { ...createInitialSessionState(), filesRead: { 'a.txt': 2 } }
    const restored = migrateState(JSON.parse(JSON.stringify(state)))
    expect(restored.profile.turns).toBe(5)
    expect(restored.profile.unlocked['first-turn']).toBe(111)
    expect(restored.sessions.s1?.filesRead['a.txt']).toBe(2)
  })
})

describe('session buckets', () => {
  it('reuses a session bucket on re-touch, moving it to the most-recent slot', () => {
    const one = touchSession({}, 's1', createInitialSessionState())
    expect(one.s1?.toolCalls).toBe(0)
    const two = touchSession(one, 's1', { ...createInitialSessionState(), toolCalls: 1 })
    expect(Object.keys(two)).toEqual(['s1'])
    expect(two.s1?.toolCalls).toBe(1)
  })

  it('prunes oldest sessions beyond MAX_SESSIONS', () => {
    let sessions: Record<string, SessionAchievementState> = {}
    for (let i = 0; i < MAX_SESSIONS + 5; i += 1) {
      sessions = touchSession(sessions, `s${i}`, createInitialSessionState())
    }
    const keys = Object.keys(sessions)
    expect(keys.length).toBe(MAX_SESSIONS)
    expect(keys[0]).toBe('s5')
    expect(keys[keys.length - 1]).toBe(`s${MAX_SESSIONS + 4}`)
  })

  it('never prunes the just-touched (active) session', () => {
    let sessions: Record<string, SessionAchievementState> = {}
    for (let i = 0; i < MAX_SESSIONS; i += 1) {
      sessions = touchSession(sessions, `s${i}`, createInitialSessionState())
    }
    sessions = touchSession(sessions, 's0', createInitialSessionState())
    sessions = touchSession(sessions, 'newest', createInitialSessionState())
    expect(sessions.s0).toBeDefined()
    expect(Object.keys(sessions).length).toBe(MAX_SESSIONS)
  })
})
