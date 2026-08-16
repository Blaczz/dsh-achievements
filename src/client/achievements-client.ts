/** Reactive browser client for the achievements read-only state API. */
import type { AchievementProgressView, AchievementView, AchievementsSettings } from '../achievements.ts'
import type { AchievementState } from '../state.ts'
import { ACHIEVEMENTS_STATE_API_PATH } from '../api.ts'

export interface AchievementsSnapshot {
  settings: AchievementsSettings
  achievements: AchievementView[]
  state: AchievementState
  /** Per-achievement progress/target, evaluated host-side against the latest session. */
  progress: Record<string, AchievementProgressView>
}

export interface AchievementsClient {
  getSnapshot(): AchievementsSnapshot | null
  subscribe(listener: () => void): () => void
  refresh(): Promise<void>
  dispose(): void
}

export class HttpAchievementsClient implements AchievementsClient {
  private snapshot: AchievementsSnapshot | null = null
  private readonly listeners = new Set<() => void>()
  private readonly abort = new AbortController()
  private disposed = false

  getSnapshot = (): AchievementsSnapshot | null => this.snapshot

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  async refresh(): Promise<void> {
    if (this.disposed) return
    try {
      const response = await fetch(ACHIEVEMENTS_STATE_API_PATH, { signal: this.abort.signal })
      const body = await response.json() as AchievementsSnapshot
      if (!response.ok) throw new Error(`achievements API answered ${response.status}`)
      this.snapshot = body
      for (const listener of [...this.listeners]) listener()
    } catch (error) {
      if (this.abort.signal.aborted) return
      throw error
    }
  }

  dispose(): void {
    this.disposed = true
    this.abort.abort()
    this.listeners.clear()
  }
}
