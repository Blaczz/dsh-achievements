/** v0.2 second half: One Shot, Librarian, Dependency Archaeologist, Gigachad. */
import { describe, expect, it } from 'vitest'
import { applyEvent, BEHAVIOR_ACHIEVEMENTS } from '../src/achievements.ts'
import type { AchievementEvent } from '../src/events.ts'
import { createInitialState } from '../src/state.ts'

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

function other(sessionId: string, seq: number): AchievementEvent {
  return { kind: 'tool-call', sessionId, seq, callId: null, tool: { kind: 'other', name: 'tool' }, isError: false }
}

function run(events: AchievementEvent[]): Set<string> {
  let state = createInitialState()
  const unlocked = new Set<string>()
  for (const event of events) {
    const result = applyEvent(state, event, BEHAVIOR_ACHIEVEMENTS, '2026-01-01', T)
    state = result.state
    for (const def of result.newlyUnlocked) unlocked.add(def.id)
  }
  return unlocked
}

describe('One Shot (single edit, first test passes)', () => {
  it('positive: one edit then a passing first test unlocks', () => {
    expect(run([edit('s', 0, 'a.ts'), testRun('s', 1, 'npm test')]).has('one-shot')).toBe(true)
  })

  it('negative: two edits does not unlock', () => {
    expect(run([edit('s', 0, 'a.ts'), edit('s', 1, 'b.ts'), testRun('s', 2, 'npm test')]).has('one-shot')).toBe(false)
  })

  it('negative: a single edit whose first test fails does not unlock', () => {
    expect(run([edit('s', 0, 'a.ts'), testRun('s', 1, 'npm test', true)]).has('one-shot')).toBe(false)
  })

  it('negative: an edit without any test does not unlock', () => {
    expect(run([edit('s', 0, 'a.ts')]).has('one-shot')).toBe(false)
  })

  it('negative: a passing test before the edit does not unlock (ordering)', () => {
    expect(run([testRun('s', 0, 'npm test'), edit('s', 1, 'a.ts')]).has('one-shot')).toBe(false)
  })
})

describe('Librarian (read ≥30 distinct files)', () => {
  it('negative: 29 distinct files does not unlock', () => {
    const events = Array.from({ length: 29 }, (_, i) => read('s', i, `f${i}`))
    expect(run(events).has('librarian')).toBe(false)
  })

  it('positive: 30 distinct files unlocks', () => {
    const events = Array.from({ length: 30 }, (_, i) => read('s', i, `f${i}`))
    expect(run(events).has('librarian')).toBe(true)
  })

  it('edge: 30 reads of the same file does not unlock', () => {
    const events = Array.from({ length: 30 }, (_, i) => read('s', i, 'same.ts'))
    expect(run(events).has('librarian')).toBe(false)
  })
})

describe('Dependency Archaeologist (read a dependency directory)', () => {
  it('positive: reading a node_modules file unlocks', () => {
    expect(run([read('s', 0, 'node_modules/react/index.js')]).has('dependency-archaeologist')).toBe(true)
  })

  it('positive: vendor and site-packages paths unlock', () => {
    expect(run([read('s', 0, 'vendor/autoload.php')]).has('dependency-archaeologist')).toBe(true)
    expect(run([read('s', 0, 'site-packages/django/apps.py')]).has('dependency-archaeologist')).toBe(true)
  })

  it('negative: ordinary source files do not unlock', () => {
    expect(run([read('s', 0, 'src/index.ts'), read('s', 1, 'README.md')]).has('dependency-archaeologist')).toBe(false)
  })
})

describe('Gigachad (read → edit → passing test within 5 tool calls)', () => {
  it('positive: read → edit → passing test in 3 calls unlocks', () => {
    expect(run([read('s', 0, 'a.ts'), edit('s', 1, 'a.ts'), testRun('s', 2, 'npm test')]).has('gigachad')).toBe(true)
  })

  it('positive: exactly 5 tool calls still unlocks with two idle calls in between', () => {
    const events = [read('s', 0, 'a.ts'), other('s', 1), edit('s', 2, 'a.ts'), other('s', 3), testRun('s', 4, 'npm test')]
    expect(run(events).has('gigachad')).toBe(true)
  })

  it('negative: 6 tool calls does not unlock', () => {
    const events = [read('s', 0, 'a.ts'), other('s', 1), other('s', 2), edit('s', 3, 'a.ts'), other('s', 4), testRun('s', 5, 'npm test')]
    expect(run(events).has('gigachad')).toBe(false)
  })

  it('negative: a failing test does not unlock', () => {
    expect(run([read('s', 0, 'a.ts'), edit('s', 1, 'a.ts'), testRun('s', 2, 'npm test', true)]).has('gigachad')).toBe(false)
  })

  it('negative: edit before read does not unlock (ordering)', () => {
    expect(run([edit('s', 0, 'a.ts'), read('s', 1, 'a.ts'), testRun('s', 2, 'npm test')]).has('gigachad')).toBe(false)
  })
})
