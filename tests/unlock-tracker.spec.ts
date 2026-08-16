/** Toast baseline regression: the first snapshot after a reload must not re-toast historical unlocks. */
import { describe, expect, it } from 'vitest'
import { createUnlockTracker } from '../src/client/unlock-tracker.ts'

function ids(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `a${i}`)
}

describe('unlock tracker baseline', () => {
  it('seeds a baseline from the first snapshot and reports no toasts', () => {
    const tracker = createUnlockTracker()
    const historical = ids(30)
    expect(tracker.diff(historical)).toEqual([])
    expect(tracker.currentIds()).toEqual(historical)
  })

  it('reports nothing when a later snapshot is unchanged', () => {
    const tracker = createUnlockTracker()
    const historical = ids(30)
    tracker.diff(historical)
    expect(tracker.diff(historical)).toEqual([])
    expect(tracker.diff(historical)).toEqual([])
  })

  it('reports exactly the one id added after reload', () => {
    const tracker = createUnlockTracker()
    const historical = ids(30)
    tracker.diff(historical)
    expect(tracker.diff([...historical, 'fresh-1'])).toEqual(['fresh-1'])
  })

  it('reports every new id exactly once, then goes silent', () => {
    const tracker = createUnlockTracker()
    tracker.diff(['a', 'b'])
    expect(tracker.diff(['a', 'b', 'c', 'd'])).toEqual(['c', 'd'])
    expect(tracker.diff(['a', 'b', 'c', 'd'])).toEqual([])
  })

  it('still toasts a genuine first unlock for a brand-new user', () => {
    const tracker = createUnlockTracker()
    tracker.diff([])
    expect(tracker.diff(['first-turn'])).toEqual(['first-turn'])
  })
})
