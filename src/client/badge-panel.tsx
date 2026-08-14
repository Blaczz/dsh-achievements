/**
 * BadgePanel: the achievements settings page, registered into the
 * `settings.section` slot. Renders a lifetime counter summary plus the full
 * achievement grid (unlocked = colored, locked = dimmed).
 */
import { useEffect, useState } from 'react'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { AchievementsClient, AchievementsSnapshot } from './achievements-client.ts'

/** Injected business face: the shared client (see the client apply). */
export interface BadgePanelInjected {
  achievements: AchievementsClient
}

/** Full component props: settings-section runtime share + injected client. */
export type BadgePanelProps = PropsRuntime<'settings.section'> & BadgePanelInjected

/** 'X 天前' / '刚刚' from an unlock epoch. */
export function elapsedLabel(unlockedAt: number | undefined, now = Date.now()): string {
  if (unlockedAt === undefined) return ''
  const days = Math.floor((now - unlockedAt) / 86_400_000)
  if (days <= 0) return '刚刚'
  if (days === 1) return '1 天前'
  return `${days} 天前`
}

const STAT_ROWS = [
  { key: 'turns', label: '回合' },
  { key: 'toolCalls', label: '工具调用' },
  { key: 'sessions', label: '会话' },
  { key: 'streakDays', label: '连续天数' },
] as const

/** The settings page body. */
export function BadgePanel({ achievements }: BadgePanelProps) {
  const [snap, setSnap] = useState<AchievementsSnapshot | null>(achievements.getSnapshot())
  useEffect(() => achievements.subscribe(() => setSnap(achievements.getSnapshot())), [achievements])

  if (snap === null) {
    return <div style={{ padding: 12, fontSize: 13, opacity: 0.7 }}>加载中…</div>
  }

  const { achievements: defs, state } = snap
  const unlockedCount = Object.keys(state.unlocked).length

  return (
    <div style={{ maxWidth: 640, padding: '4px 0 16px' }}>
      {/* Lifetime counters */}
      <div style={{ display: 'flex', gap: 10, paddingBottom: 12 }}>
        {STAT_ROWS.map(row => (
          <div key={row.key} style={{ flex: 1, textAlign: 'center', borderRadius: 10, padding: '10px 6px', background: 'rgba(128,128,128,0.08)' }}>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{state.counters[row.key]}</div>
            <div style={{ fontSize: 11, opacity: 0.7 }}>{row.label}</div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 13, fontWeight: 700, paddingBottom: 8 }}>
        🏆 成就（{unlockedCount}/{defs.length}）
      </div>

      {/* Achievement grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
        {defs.map(def => {
          const unlockedAt = state.unlocked[def.id]
          const unlocked = unlockedAt !== undefined
          return (
            <div key={def.id} style={{
              display: 'flex', gap: 10, alignItems: 'center', borderRadius: 10, padding: 10,
              border: '1px solid rgba(128,128,128,0.18)',
              background: unlocked ? 'rgba(77,107,254,0.10)' : 'transparent',
              opacity: unlocked ? 1 : 0.55,
            }}>
              <div style={{ fontSize: 24, flex: 'none' }}>{unlocked ? def.icon : '🔒'}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{def.title.zh}</div>
                <div style={{ fontSize: 11, opacity: 0.7 }}>{def.description.zh}</div>
              </div>
              {unlocked && <div style={{ fontSize: 11, flex: 'none', opacity: 0.7 }}>{elapsedLabel(unlockedAt)}</div>}
            </div>
          )
        })}
      </div>

      <div style={{ fontSize: 11, opacity: 0.55, paddingTop: 12 }}>
        成就状态跨会话持久化，保存在 DSH 主目录。回合、工具调用、会话数与连续天数自动累计。
      </div>
    </div>
  )
}
