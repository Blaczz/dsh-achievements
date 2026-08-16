/**
 * BadgePanel: the achievements settings page, registered into the
 * `settings.section` slot. Renders the Agent Profile (level, XP, persona,
 * rarity distribution, favorite tool), the seven lifetime counters + a
 * separate streak line, the achievement grid split into "成长里程碑 / 特殊行为",
 * and the latest session report.
 */
import { useEffect, useState } from 'react'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { AchievementsClient, AchievementsSnapshot } from './achievements-client.ts'
import { RARITY_META } from '../gamification.ts'
import { buildProfileView, buildSessionSummary } from '../profile.ts'
import { MILESTONE_CHAINS, SPECIAL_CHAINS, buildAgentWrapped, buildShareText, chainProgressOf } from '../share.ts'
import type { AchievementProgressView, AchievementRarity, AchievementView } from '../achievements.ts'

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

/** Seven lifetime progression metrics; streak is shown separately. */
const STAT_ROWS = [
  { key: 'turns', label: '回合' },
  { key: 'toolCalls', label: '工具调用' },
  { key: 'sessions', label: '会话' },
  { key: 'activeDays', label: '活跃天数' },
  { key: 'fileReads', label: '读取次数' },
  { key: 'fileEdits', label: '修改次数' },
  { key: 'testRuns', label: '测试' },
] as const

const RARITY_ORDER: readonly AchievementRarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary']

const REPORT_ROWS = [
  { key: 'toolCalls', label: '工具调用' },
  { key: 'filesRead', label: '读文件' },
  { key: 'filesEdited', label: '改文件' },
  { key: 'tests', label: '测试' },
  { key: 'failures', label: '失败' },
] as const

/** One achievement card; reused across the milestone and special sections. */
function AchievementCard({ def, unlockedAt, progress }: {
  def: AchievementView
  unlockedAt: number | undefined
  progress: AchievementProgressView | undefined
}) {
  const unlocked = unlockedAt !== undefined
  const rarity = RARITY_META[def.rarity]

  // Hidden + locked: leak no real content.
  if (def.hidden === true && !unlocked) {
    return (
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', borderRadius: 10, padding: 10, border: '1px solid rgba(128,128,128,0.18)', opacity: 0.55 }}>
        <div style={{ fontSize: 24, flex: 'none' }}>🔒</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>???</div>
          <div style={{ fontSize: 11, opacity: 0.7 }}>未解锁的隐藏成就</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex', gap: 10, alignItems: 'flex-start', borderRadius: 10, padding: 10,
      border: `1px solid ${unlocked ? rarity.color : 'rgba(128,128,128,0.18)'}`,
      background: unlocked ? `${rarity.color}1a` : 'transparent',
      opacity: unlocked ? 1 : 0.6,
    }}>
      <div style={{ fontSize: 24, flex: 'none', lineHeight: 1.3 }}>{unlocked ? def.icon : '🔒'}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{def.title.zh}</span>
          <span style={{ fontSize: 10, color: rarity.color, whiteSpace: 'nowrap' }}>{rarity.label.zh}</span>
        </div>
        <div style={{ fontSize: 11, opacity: 0.7 }}>{def.description.zh}</div>
        {unlocked && def.flavorText !== undefined && (
          <div style={{ fontSize: 11, opacity: 0.55, fontStyle: 'italic', paddingTop: 2 }}>{def.flavorText.zh}</div>
        )}
        {!unlocked && progress?.target !== undefined && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 6 }}>
            <div style={{ flex: 1, height: 5, borderRadius: 3, background: 'rgba(128,128,128,0.15)', overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(100, Math.round(((progress.progress ?? 0) / progress.target) * 100))}%`, height: '100%', background: rarity.color, borderRadius: 3 }} />
            </div>
            <span style={{ fontSize: 10, opacity: 0.7, whiteSpace: 'nowrap' }}>{progress.progress ?? 0}/{progress.target}</span>
          </div>
        )}
        <div style={{ fontSize: 10, color: rarity.color, paddingTop: 4 }}>+{def.xp} XP</div>
      </div>
      {unlocked && <div style={{ fontSize: 11, flex: 'none', opacity: 0.7 }}>{elapsedLabel(unlockedAt)}</div>}
    </div>
  )
}

/** A single chain progress row (title + bar + n/total). */
function ChainRow({ cp }: { cp: ReturnType<typeof chainProgressOf> }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 12, width: 88, flex: 'none', opacity: 0.85 }}>{cp.chain.title.zh}</span>
      <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(128,128,128,0.15)', overflow: 'hidden' }}>
        <div style={{ width: `${cp.total === 0 ? 0 : Math.round((cp.completed / cp.total) * 100)}%`, height: '100%', background: cp.done ? '#34d399' : '#fbbf24', borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 11, opacity: 0.7, flex: 'none' }}>{cp.completed}/{cp.total}</span>
    </div>
  )
}

/** The settings page body. */
export function BadgePanel({ achievements }: BadgePanelProps) {
  const [snap, setSnap] = useState<AchievementsSnapshot | null>(achievements.getSnapshot())
  const [copied, setCopied] = useState(false)
  useEffect(() => achievements.subscribe(() => setSnap(achievements.getSnapshot())), [achievements])

  if (snap === null) {
    return <div style={{ padding: 12, fontSize: 13, opacity: 0.7 }}>加载中…</div>
  }

  const { achievements: defs, state } = snap
  const profile = buildProfileView(state, defs)
  const sessionIds = Object.keys(state.sessions)
  const lastSessionId = sessionIds[sessionIds.length - 1]
  const summary = lastSessionId === undefined ? null : buildSessionSummary(state, lastSessionId)
  const wrapped = buildAgentWrapped(state, defs)
  const shareText = buildShareText(state, defs)

  // Milestone ids are derived from the seven chains (single source of truth),
  // never hardcoded in JSX; everything else is a "special" achievement.
  const milestoneIds = new Set(MILESTONE_CHAINS.flatMap(chain => chain.achievementIds))
  const milestoneDefs = MILESTONE_CHAINS.flatMap(chain =>
    chain.achievementIds
      .map(id => defs.find(def => def.id === id))
      .filter((def): def is AchievementView => def !== undefined),
  )
  const specialDefs = defs.filter(def => !milestoneIds.has(def.id))
  const milestoneChains = MILESTONE_CHAINS.map(chain => chainProgressOf(chain, state.profile.unlocked))
  const specialChains = SPECIAL_CHAINS.map(chain => chainProgressOf(chain, state.profile.unlocked))

  const copyShare = (): void => {
    if (navigator.clipboard === undefined) return
    void navigator.clipboard.writeText(shareText).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    }).catch(() => {})
  }

  return (
    <div style={{ maxWidth: 680, padding: '4px 0 16px' }}>
      {/* Agent Profile header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 800 }}>{profile.persona.title.zh}</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>{profile.persona.description.zh}</div>
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, flex: 'none' }}>Lv.{profile.level.level}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 12 }}>
        <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'rgba(128,128,128,0.15)', overflow: 'hidden' }}>
          <div style={{ width: `${Math.round(profile.level.progress * 100)}%`, height: '100%', background: '#fbbf24', borderRadius: 4 }} />
        </div>
        <div style={{ fontSize: 12, opacity: 0.7, flex: 'none' }}>{profile.level.current}/{profile.level.next} XP</div>
      </div>

      {/* Profile stats: unlocks, favorite tool, rarity distribution */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingBottom: 8 }}>
        <span style={{ fontSize: 12, opacity: 0.8 }}>已解锁 {profile.unlockedCount}/{profile.totalCount}</span>
        {profile.favoriteTool !== null && (
          <span style={{ fontSize: 12, opacity: 0.8 }}>常用工具 · {profile.favoriteTool}</span>
        )}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingBottom: 12 }}>
        {RARITY_ORDER.map(rarity => {
          const meta = RARITY_META[rarity]
          const count = profile.rarity[rarity]
          return (
            <span key={rarity} style={{
              fontSize: 11, color: meta.color, border: `1px solid ${meta.color}`, borderRadius: 6,
              padding: '2px 6px', opacity: count.total === 0 ? 0.45 : 1,
            }}>
              {meta.label.zh} {count.unlocked}/{count.total}
            </span>
          )
        })}
      </div>

      {/* Lifetime counters (responsive grid) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(78px, 1fr))', gap: 8, paddingBottom: 10 }}>
        {STAT_ROWS.map(row => (
          <div key={row.key} style={{ textAlign: 'center', borderRadius: 10, padding: '10px 6px', background: 'rgba(128,128,128,0.08)' }}>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{state.profile[row.key]}</div>
            <div style={{ fontSize: 11, opacity: 0.7 }}>{row.label}</div>
          </div>
        ))}
      </div>
      {/* Streak is a separate signal, not one of the seven progression metrics. */}
      <div style={{ fontSize: 12, opacity: 0.8, paddingBottom: 12 }}>
        🔥 当前连续 {state.profile.currentStreak} 天 · 最长连续 {state.profile.longestStreak} 天
      </div>

      {/* Growth routes (the seven five-tier chains) */}
      <div style={{ fontSize: 13, fontWeight: 700, paddingBottom: 8 }}>📈 成长路线</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 12 }}>
        {milestoneChains.map(cp => <ChainRow key={cp.chain.id} cp={cp} />)}
      </div>

      <div style={{ fontSize: 13, fontWeight: 700, paddingBottom: 8 }}>
        🏆 成就（{profile.unlockedCount}/{defs.length}）
      </div>

      {/* Milestone achievements: fixed progression order per chain */}
      <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.75, paddingBottom: 6 }}>成长里程碑</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 8, paddingBottom: 12 }}>
        {milestoneDefs.map(def => (
          <AchievementCard key={def.id} def={def} unlockedAt={state.profile.unlocked[def.id]} progress={snap.progress[def.id]} />
        ))}
      </div>

      {/* Special achievements: streaks + behavior, registration order */}
      <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.75, paddingBottom: 6 }}>特殊行为</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 8, paddingBottom: 12 }}>
        {specialDefs.map(def => (
          <AchievementCard key={def.id} def={def} unlockedAt={state.profile.unlocked[def.id]} progress={snap.progress[def.id]} />
        ))}
      </div>

      {/* Special chains: streaks + behavior, kept separate from the seven routes */}
      <div style={{ fontSize: 13, fontWeight: 700, padding: '4px 0 8px' }}>🎭 特殊链</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 12 }}>
        {specialChains.map(cp => <ChainRow key={cp.chain.id} cp={cp} />)}
      </div>

      {/* Latest session report */}
      <div style={{ fontSize: 13, fontWeight: 700, padding: '16px 0 8px' }}>📋 最近会话战报</div>
      {summary === null ? (
        <div style={{ fontSize: 12, opacity: 0.55 }}>暂无会话数据。</div>
      ) : (
        <div style={{ borderRadius: 10, border: '1px solid rgba(128,128,128,0.18)', padding: 10 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', paddingBottom: summary.unlocked.length > 0 || summary.xpGained > 0 ? 10 : 0 }}>
            {REPORT_ROWS.map(row => (
              <div key={row.key} style={{ flex: '1 1 0', minWidth: 60, textAlign: 'center', borderRadius: 8, padding: '8px 4px', background: 'rgba(128,128,128,0.08)' }}>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{summary[row.key]}</div>
                <div style={{ fontSize: 11, opacity: 0.7 }}>{row.label}</div>
              </div>
            ))}
          </div>
          {summary.unlocked.length > 0 && (
            <div style={{ fontSize: 12, paddingBottom: 4 }}>
              本会话解锁：{summary.unlocked.map(id => {
                const def = defs.find(d => d.id === id)
                return def === undefined ? null : <span key={id} style={{ marginRight: 8 }}>{def.icon} {def.title.zh}</span>
              })}
            </div>
          )}
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            {summary.xpGained > 0 && <span style={{ marginRight: 12, color: '#fbbf24' }}>+{summary.xpGained} XP</span>}
            {summary.levelUp !== null && (
              <span style={{ fontWeight: 700, color: '#fbbf24' }}>🎉 升级 Lv.{summary.levelUp.from} → Lv.{summary.levelUp.to}</span>
            )}
          </div>
        </div>
      )}

      {/* Agent Wrapped */}
      <div style={{ fontSize: 13, fontWeight: 700, padding: '16px 0 8px' }}>🎁 Agent Wrapped</div>
      <div style={{ borderRadius: 10, border: '1px solid rgba(128,128,128,0.18)', padding: 10 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingBottom: wrapped.topUnlock !== null ? 8 : 0 }}>
          <span style={{ fontSize: 12 }}>{wrapped.persona.title.zh} · Lv.{wrapped.level.level}</span>
          <span style={{ fontSize: 12, opacity: 0.7 }}>{wrapped.turns} 回合</span>
          <span style={{ fontSize: 12, opacity: 0.7 }}>{wrapped.toolCalls} 工具</span>
          <span style={{ fontSize: 12, opacity: 0.7 }}>{wrapped.sessions} 会话</span>
          <span style={{ fontSize: 12, opacity: 0.7 }}>最长连击 {wrapped.longestStreak} 天</span>
          {wrapped.favoriteTool !== null && <span style={{ fontSize: 12, opacity: 0.7 }}>常用 {wrapped.favoriteTool}</span>}
        </div>
        {wrapped.topUnlock !== null && (
          <div style={{ fontSize: 12, opacity: 0.85 }}>🏆 最高稀有成就：{wrapped.topUnlock.icon} {wrapped.topUnlock.title.zh}</div>
        )}
      </div>

      {/* Share (local, privacy-safe) */}
      <div style={{ fontSize: 13, fontWeight: 700, padding: '16px 0 8px' }}>📤 分享</div>
      <div style={{ borderRadius: 10, border: '1px solid rgba(128,128,128,0.18)', padding: 10 }}>
        <pre style={{ margin: 0, fontSize: 11, whiteSpace: 'pre-wrap', opacity: 0.85, maxHeight: 200, overflow: 'auto' }}>{shareText}</pre>
        <button
          onClick={copyShare}
          style={{ marginTop: 8, padding: '6px 12px', fontSize: 12, borderRadius: 8, border: '1px solid rgba(128,128,128,0.3)', background: 'transparent', color: 'inherit', cursor: 'pointer' }}
        >
          {copied ? '已复制 ✓' : '复制分享文本'}
        </button>
      </div>

      <div style={{ fontSize: 11, opacity: 0.55, paddingTop: 12 }}>
        成就状态跨会话持久化，保存在 DSH 主目录。分享内容仅含成就、等级与计数，不含文件路径或命令。
      </div>
    </div>
  )
}
