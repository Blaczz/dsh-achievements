/**
 * Achievements plugin, browser half: polls the read-only state API, shows an
 * unlock toast when new achievements arrive, exposes `ctx.achievements` for
 * other plugins, and registers the badge panel in the settings page.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { HttpAchievementsClient } from './achievements-client.ts'
import { BadgePanel } from './badge-panel.tsx'
import { showUnlockToast } from './toast.ts'

export type { BadgePanelInjected, BadgePanelProps } from './badge-panel.tsx'
export { HttpAchievementsClient } from './achievements-client.ts'

/** Public service other client plugins can inject and call. */
export interface AchievementsService {
  /** Re-poll the state API. */
  refresh(): Promise<void>
  /** Currently unlocked achievement ids. */
  unlockedIds(): string[]
}

/** Required services (cordis fiber inject). */
export const inject = ['slots']

declare module '@deepseek-ai/cordis' {
  interface Context {
    achievements: AchievementsService
  }
}

/** 'X 天前' / '刚刚' from an unlock epoch. */
function elapsedOf(ts: number | undefined, now = Date.now()): string | null {
  if (ts === undefined) return null
  const days = Math.floor((now - ts) / 86_400_000)
  if (days <= 0) return '刚刚'
  if (days === 1) return '1 天前'
  return `${days} 天前`
}

/**
 * Client plugin body: one shared HTTP client, an unlock watcher that toasts
 * new achievements, the cross-plugin service, and the settings-page panel.
 * @param ctx - client cordis context.
 */
export function apply(ctx: ClientContext): void {
  const client = new HttpAchievementsClient()
  let lastUnlocked = new Set<string>()

  const checkUnlocks = (): void => {
    const snap = client.getSnapshot()
    if (snap === null || !snap.settings.enabled || !snap.settings.toastEnabled) return
    const current = new Set(Object.keys(snap.state.unlocked))
    const fresh = [...current].filter(id => !lastUnlocked.has(id))
    if (fresh.length > 0) {
      for (const id of fresh) {
        const def = snap.achievements.find(achievement => achievement.id === id)
        if (def !== undefined) showUnlockToast(def, elapsedOf(snap.state.unlocked[id]))
      }
    }
    lastUnlocked = current
  }

  const refresh = (): void => {
    void client.refresh().then(checkUnlocks).catch(() => {})
  }

  // Poll on mount, on tab focus / visibility, and every 30s while visible.
  ctx.effect(() => {
    refresh()
    const onFocus = (): void => refresh()
    const onVisible = (): void => { if (!document.hidden) refresh() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisible)
    const timer = window.setInterval(() => { if (!document.hidden) refresh() }, 30_000)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisible)
      window.clearInterval(timer)
      client.dispose()
    }
  }, 'achievements: poll')

  // Cross-plugin service.
  ctx.provide('achievements', {
    refresh,
    unlockedIds: () => [...lastUnlocked],
  })

  // Settings page badge panel.
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'dsh-achievements',
    order: 60,
    label: '🏆 成就',
    inject: () => ({ achievements: client }),
  }, BadgePanel))
}
