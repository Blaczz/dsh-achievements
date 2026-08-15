/**
 * Pure unlock-baseline tracker for the toast system. Kept free of DOM, fetch
 * and React so the reload regression is unit-testable in Node.
 *
 * Semantics: the first snapshot a page load observes only seeds a baseline;
 * every later snapshot diffs against it and reports only newly added ids.
 */

export interface UnlockTracker {
  /** Advance by one snapshot of unlocked ids; returns the ids added since the baseline. */
  diff(ids: readonly string[]): string[]
  /** The ids observed in the most recent snapshot (insertion order). */
  currentIds(): string[]
}

export function createUnlockTracker(): UnlockTracker {
  let initialized = false
  let lastUnlocked = new Set<string>()

  return {
    diff(ids) {
      const current = new Set(ids)
      if (!initialized) {
        // First snapshot: seed the baseline and stay silent — historical
        // unlocks after a reload are never reported as fresh.
        lastUnlocked = current
        initialized = true
        return []
      }
      const fresh = ids.filter(id => !lastUnlocked.has(id))
      lastUnlocked = current
      return fresh
    },
    currentIds() {
      return [...lastUnlocked]
    },
  }
}
