/** First behavior-achievement batch: threshold / isolation / ordering / idempotency. */
import { describe, expect, it } from 'vitest'
import { applyEvent, BEHAVIOR_ACHIEVEMENTS } from '../src/achievements.ts'
import type { AchievementEvent } from '../src/events.ts'
import type { AchievementState } from '../src/state.ts'
import { createInitialState, migrateState } from '../src/state.ts'

const T = 1_700_000_000_000

function read(sessionId: string, seq: number, path: string): AchievementEvent {
  return { kind: 'tool-call', sessionId, seq, callId: null, tool: { kind: 'file-read', name: 'read', path }, isError: false }
}

function edit(sessionId: string, seq: number, path: string): AchievementEvent {
  return { kind: 'tool-call', sessionId, seq, callId: null, tool: { kind: 'file-edit', name: 'edit', path }, isError: false }
}

function testRun(sessionId: string, seq: number, command: string, failed = false): AchievementEvent {
  return { kind: 'tool-call', sessionId, seq, callId: null, tool: { kind: 'test-run', name: 'bash', command }, isError: failed }
}

function tool(sessionId: string, seq: number): AchievementEvent {
  return { kind: 'tool-call', sessionId, seq, callId: null, tool: { kind: 'other', name: 'tool' }, isError: false }
}

function run(events: AchievementEvent[]): { state: AchievementState; unlocked: Set<string> } {
  let state = createInitialState()
  const unlocked = new Set<string>()
  for (const event of events) {
    const result = applyEvent(state, event, BEHAVIOR_ACHIEVEMENTS, '2026-01-01', T)
    state = result.state
    for (const def of result.newlyUnlocked) unlocked.add(def.id)
  }
  return { state, unlocked }
}

function editsOf(path: string, count: number, startSeq = 0): AchievementEvent[] {
  return Array.from({ length: count }, (_, i) => edit('s', startSeq + i, path))
}

function readsOf(paths: string[], startSeq = 0): AchievementEvent[] {
  return paths.map((path, i) => read('s', startSeq + i, path))
}

describe('Déjà Vu (same file edited 5×)', () => {
  it('negative: 4 edits of the same file does not unlock', () => {
    expect(run(editsOf('a.ts', 4)).unlocked.has('deja-vu')).toBe(false)
  })

  it('positive: 5 edits of the same file unlocks', () => {
    expect(run(editsOf('a.ts', 5)).unlocked.has('deja-vu')).toBe(true)
  })

  it('edge: 5 edits across different files does not unlock', () => {
    const events = ['a.ts', 'b.ts', 'c.ts', 'd.ts', 'e.ts'].map((p, i) => edit('s', i, p))
    expect(run(events).unlocked.has('deja-vu')).toBe(false)
  })
})

describe('Rabbit Hole (read ≥20 files before first edit)', () => {
  it('negative: 19 reads before edit does not unlock', () => {
    const events = [...readsOf(Array.from({ length: 19 }, (_, i) => `f${i}`)), edit('s', 19, 'x.ts')]
    expect(run(events).unlocked.has('rabbit-hole')).toBe(false)
  })

  it('positive: 20 reads before edit unlocks', () => {
    const events = [...readsOf(Array.from({ length: 20 }, (_, i) => `f${i}`)), edit('s', 20, 'x.ts')]
    expect(run(events).unlocked.has('rabbit-hole')).toBe(true)
  })

  it('edge: reads after the first edit do not count backwards', () => {
    const events = [
      ...readsOf(Array.from({ length: 10 }, (_, i) => `a${i}`)),
      edit('s', 10, 'x.ts'),
      ...readsOf(Array.from({ length: 10 }, (_, i) => `b${i}`), 11),
    ]
    expect(run(events).unlocked.has('rabbit-hole')).toBe(false)
  })
})

describe('YOLO (edit ≥8 files before first test)', () => {
  it('negative: 7 edits before test does not unlock', () => {
    const events = [...Array.from({ length: 7 }, (_, i) => edit('s', i, `f${i}`)), testRun('s', 7, 'npm test')]
    expect(run(events).unlocked.has('yolo')).toBe(false)
  })

  it('positive: 8 edits before test unlocks', () => {
    const events = [...Array.from({ length: 8 }, (_, i) => edit('s', i, `f${i}`)), testRun('s', 8, 'npm test')]
    expect(run(events).unlocked.has('yolo')).toBe(true)
  })

  it('edge: edits after the first test do not count backwards', () => {
    const events = [
      ...Array.from({ length: 5 }, (_, i) => edit('s', i, `f${i}`)),
      testRun('s', 5, 'npm test'),
      ...Array.from({ length: 3 }, (_, i) => edit('s', 6 + i, `g${i}`)),
    ]
    expect(run(events).unlocked.has('yolo')).toBe(false)
  })
})

describe('It Works Eventually (pass after ≥5 failures)', () => {
  it('negative: 4 failures then pass does not unlock', () => {
    const events = [...Array.from({ length: 4 }, (_, i) => testRun('s', i, 'npm test', true)), testRun('s', 4, 'npm test')]
    expect(run(events).unlocked.has('it-works-eventually')).toBe(false)
  })

  it('positive: 5 failures then pass unlocks', () => {
    const events = [...Array.from({ length: 5 }, (_, i) => testRun('s', i, 'npm test', true)), testRun('s', 5, 'npm test')]
    expect(run(events).unlocked.has('it-works-eventually')).toBe(true)
  })

  it('edge: failures with no eventual pass do not unlock', () => {
    const events = Array.from({ length: 6 }, (_, i) => testRun('s', i, 'npm test', true))
    expect(run(events).unlocked.has('it-works-eventually')).toBe(false)
  })
})

describe('Surely This Time (same command fails 5× consecutively)', () => {
  it('negative: failures spread across different commands do not unlock', () => {
    const events = ['a', 'b', 'a', 'b', 'a'].map((cmd, i) => testRun('s', i, cmd, true))
    expect(run(events).unlocked.has('surely-this-time')).toBe(false)
  })

  it('positive: same command fails 5× unlocks', () => {
    const events = Array.from({ length: 5 }, (_, i) => testRun('s', i, 'npm test', true))
    expect(run(events).unlocked.has('surely-this-time')).toBe(true)
  })

  it('edge: a different command in between resets the streak', () => {
    const events = [
      ...Array.from({ length: 4 }, (_, i) => testRun('s', i, 'npm test', true)),
      testRun('s', 4, 'vitest', true),
      ...Array.from({ length: 4 }, (_, i) => testRun('s', 5 + i, 'npm test', true)),
    ]
    expect(run(events).unlocked.has('surely-this-time')).toBe(false)
  })
})

describe('Touch Grass (100 tool calls in one session)', () => {
  it('negative: 99 tool calls does not unlock', () => {
    expect(run(Array.from({ length: 99 }, (_, i) => tool('s', i))).unlocked.has('touch-grass')).toBe(false)
  })

  it('positive: 100 tool calls unlocks', () => {
    expect(run(Array.from({ length: 100 }, (_, i) => tool('s', i))).unlocked.has('touch-grass')).toBe(true)
  })

  it('edge: 101 tool calls still unlocks exactly once (idempotent)', () => {
    let state = createInitialState()
    const unlocked = new Set<string>()
    for (let i = 0; i < 101; i += 1) {
      const result = applyEvent(state, tool('s', i), BEHAVIOR_ACHIEVEMENTS, '2026-01-01', T)
      state = result.state
      for (const def of result.newlyUnlocked) unlocked.add(def.id)
    }
    expect(unlocked.has('touch-grass')).toBe(true)
    expect(state.profile.unlocked['touch-grass']).toBe(T)
  })
})

describe('session isolation', () => {
  it('does not leak edited-file counts across sessions (Déjà Vu)', () => {
    let state = createInitialState()
    for (let i = 0; i < 4; i += 1) {
      state = applyEvent(state, edit('A', i, 'a.ts'), BEHAVIOR_ACHIEVEMENTS, '2026-01-01', T).state
    }
    const result = applyEvent(state, edit('B', 0, 'a.ts'), BEHAVIOR_ACHIEVEMENTS, '2026-01-01', T)
    expect(result.newlyUnlocked.map(d => d.id)).not.toContain('deja-vu')
    expect(result.state.sessions.B?.filesEdited['a.ts']).toBe(1)
  })

  it('does not leak test failures across sessions (It Works Eventually)', () => {
    let state = createInitialState()
    for (let i = 0; i < 5; i += 1) {
      state = applyEvent(state, testRun('A', i, 'npm test', true), BEHAVIOR_ACHIEVEMENTS, '2026-01-01', T).state
    }
    const result = applyEvent(state, testRun('B', 0, 'npm test'), BEHAVIOR_ACHIEVEMENTS, '2026-01-01', T)
    expect(result.newlyUnlocked.map(d => d.id)).not.toContain('it-works-eventually')
  })
})

describe('persistence of behavior unlocks', () => {
  it('preserves a behavior unlock through a JSON round-trip', () => {
    const { state } = run(editsOf('a.ts', 5))
    expect(state.profile.unlocked['deja-vu']).toBeDefined()
    const restored = migrateState(JSON.parse(JSON.stringify(state)))
    expect(restored.profile.unlocked['deja-vu']).toBe(T)
    expect(restored.sessions.s?.filesEdited['a.ts']).toBe(5)
  })
})
