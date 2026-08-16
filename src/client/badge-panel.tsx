/**
 * BadgePanel: the achievements settings page, registered into the
 * `settings.section` slot. Renders the Agent Profile (level, XP, persona,
 * rarity distribution, favorite tool), the seven lifetime counters + a
 * separate streak line, a collapsible badge wall grouped by the seven
 * milestone routes and the special chains, and the latest session report.
 *
 * Task 22 keeps this a lightweight settings page: the 68 cards are collapsed
 * behind per-route `<details>` groups, a single status filter narrows the
 * visible cards, and the low-frequency Wrapped / Share blocks start closed.
 */
import { useEffect, useState, type ReactNode } from 'react'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { AchievementsClient, AchievementsSnapshot } from './achievements-client.ts'
import { RARITY_META } from '../gamification.ts'
import { buildProfileView, buildSessionSummary } from '../profile.ts'
import { buildAgentWrapped, buildShareText } from '../share.ts'
import type { AchievementProgressView, AchievementRarity, AchievementView } from '../achievements.ts'
import {
  buildMilestoneGroups,
  buildSpecialGroups,
  matchesAchievementStatus,
  type AchievementGroup,
  type AchievementStatusFilter,
} from './badge-panel-model.ts'

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
  { key: 'turns', label: '回合' },
  { key: 'steps', label: '步骤' },
  { key: 'maxStepsInTurn', label: '最深单轮' },
  { key: 'toolCalls', label: '工具调用' },
  { key: 'filesRead', label: '读文件' },
  { key: 'filesEdited', label: '改文件' },
  { key: 'tests', label: '测试' },
  { key: 'failures', label: '失败' },
] as const

/** Inject the disclosure caret CSS once (no React state, no animation). */
let disclosureCssInjected = false
function ensureDisclosureCss(): void {
  if (disclosureCssInjected) return
  disclosureCssInjected = true
  const style = document.createElement('style')
  style.textContent = [
    '.dsh-badge-group summary { list-style: none; }',
    '.dsh-badge-group summary::-webkit-details-marker { display: none; }',
    '.dsh-badge-group summary::marker { content: ""; }',
    ".dsh-badge-group .dsh-badge-caret::before { content: '▸'; }",
    ".dsh-badge-group[open] .dsh-badge-caret::before { content: '▾'; }",
  ].join('\n')
  document.head.appendChild(style)
}

/** Unified section shell: border, radius, padding and optional title. */
function SectionPanel({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section style={{ borderRadius: 12, border: '1px solid rgba(128,128,128,0.18)', padding: 12, marginBottom: 12 }}>
      {title !== undefined && <div style={{ fontSize: 13, fontWeight: 700, paddingBottom: 8 }}>{title}</div>}
      {children}
    </section>
  )
}

/** One achievement card; reused across every collapsible group. */
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
        <div style={{ display: 'flex', gap: 6, alignItems: 'baseline', flexWrap: 'wrap' }}>
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
            <span style={{ fontSize: 10, opacity: 0.7, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{progress.progress ?? 0}/{progress.target}</span>
          </div>
        )}
        {/* Footer: XP on the left, elapsed time on the right (kept off the title row). */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, paddingTop: 4 }}>
          <span style={{ fontSize: 10, color: rarity.color, flex: 1 }}>+{def.xp} XP</span>
          {unlocked && <span style={{ fontSize: 11, opacity: 0.7, flex: 'none' }}>{elapsedLabel(unlockedAt)}</span>}
        </div>
      </div>
    </div>
  )
}

/** A collapsible route/special group: header carries title + progress, cards inside. */
function AchievementGroup({ group, unlocked, progress, filter }: {
  group: AchievementGroup
  unlocked: Record<string, number>
  progress: Record<string, AchievementProgressView>
  filter: AchievementStatusFilter
}) {
  const visible = group.defs.filter(def => matchesAchievementStatus(unlocked[def.id], filter))
  if (visible.length === 0) return null
  const done = group.completed === group.total

  return (
    <details className="dsh-badge-group" style={{ border: '1px solid rgba(128,128,128,0.18)', borderRadius: 10, padding: '8px 10px', marginBottom: 8 }}>
      <summary style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="dsh-badge-caret" style={{ fontSize: 11, opacity: 0.6, flex: 'none' }} />
        <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 600 }}>{group.title.zh}</span>
        <span style={{ fontSize: 11, opacity: 0.7, flex: 'none', fontVariantNumeric: 'tabular-nums' }}>{group.completed}/{group.total}</span>
        {group.progression && (
          <div style={{ width: 80, height: 6, borderRadius: 3, background: 'rgba(128,128,128,0.15)', overflow: 'hidden', flex: 'none' }}>
            <div style={{ width: `${group.total === 0 ? 0 : Math.round((group.completed / group.total) * 100)}%`, height: '100%', background: done ? '#34d399' : '#fbbf24', borderRadius: 3 }} />
          </div>
        )}
      </summary>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(280px, 100%), 1fr))', gap: 8, paddingTop: 8 }}>
        {visible.map(def => (
          <AchievementCard key={def.id} def={def} unlockedAt={unlocked[def.id]} progress={progress[def.id]} />
        ))}
      </div>
    </details>
  )
}

/** The settings page body. */
export function BadgePanel({ achievements }: BadgePanelProps) {
  const [snap, setSnap] = useState<AchievementsSnapshot | null>(achievements.getSnapshot())
  const [copied, setCopied] = useState(false)
  const [filter, setFilter] = useState<AchievementStatusFilter>('all')
  useEffect(() => achievements.subscribe(() => setSnap(achievements.getSnapshot())), [achievements])
  useEffect(() => { ensureDisclosureCss() }, [])

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

  // Groups are derived from the browser-safe chain metadata (single source of
  // truth); no achievement id is hardcoded in JSX.
  const milestoneGroups = buildMilestoneGroups(defs, state.profile.unlocked)
  const specialGroups = buildSpecialGroups(defs, state.profile.unlocked)

  const copyShare = (): void => {
    if (navigator.clipboard === undefined) return
    void navigator.clipboard.writeText(shareText).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    }).catch(() => {})
  }

  return (
    <div style={{ maxWidth: 680, padding: '4px 0 16px' }}>
      {/* Agent Profile overview (single section shell) */}
      <SectionPanel>
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

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(78px, 1fr))', gap: 8, paddingBottom: 10 }}>
          {STAT_ROWS.map(row => (
            <div key={row.key} style={{ textAlign: 'center', borderRadius: 10, padding: '10px 6px', background: 'rgba(128,128,128,0.08)' }}>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{state.profile[row.key]}</div>
              <div style={{ fontSize: 11, opacity: 0.7 }}>{row.label}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 12, opacity: 0.8 }}>
          🔥 当前连续 {state.profile.currentStreak} 天 · 最长连续 {state.profile.longestStreak} 天
        </div>
      </SectionPanel>

      {/* Achievement wall header + the single status filter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0 8px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, flex: 1 }}>🏆 成就（{profile.unlockedCount}/{defs.length}）</div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, opacity: 0.7 }}>
          显示
          <select
            value={filter}
            onChange={event => setFilter(event.target.value as AchievementStatusFilter)}
            style={{ fontSize: 12, padding: '3px 6px', borderRadius: 6, border: '1px solid rgba(128,128,128,0.3)', background: 'transparent', color: 'inherit' }}
          >
            <option value="all">全部</option>
            <option value="locked">未解锁</option>
            <option value="unlocked">已解锁</option>
          </select>
        </label>
      </div>

      {/* Milestone routes: seven collapsible five-tier chains */}
      <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.75, paddingBottom: 6 }}>成长里程碑</div>
      {milestoneGroups.map(group => (
        <AchievementGroup key={group.id} group={group} unlocked={state.profile.unlocked} progress={snap.progress} filter={filter} />
      ))}

      {/* Special behavior: residual classic group first, then SPECIAL_CHAINS */}
      <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.75, padding: '4px 0 6px' }}>特殊行为</div>
      {specialGroups.map(group => (
        <AchievementGroup key={group.id} group={group} unlocked={state.profile.unlocked} progress={snap.progress} filter={filter} />
      ))}

      {/* Latest session report (high-value, stays visible) */}
      <SectionPanel title="📋 最近会话战报">
        {summary === null ? (
          <div style={{ fontSize: 12, opacity: 0.55 }}>暂无会话数据。</div>
        ) : (
          <div>
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
      </SectionPanel>

      {/* Agent Wrapped (low-frequency, collapsed by default) */}
      <details className="dsh-badge-group" style={{ border: '1px solid rgba(128,128,128,0.18)', borderRadius: 10, padding: '8px 10px', marginBottom: 8 }}>
        <summary style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="dsh-badge-caret" style={{ fontSize: 11, opacity: 0.6, flex: 'none' }} />
          <span style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>🎁 Agent Wrapped</span>
        </summary>
        <div style={{ paddingTop: 8, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontSize: 12 }}>{wrapped.persona.title.zh} · Lv.{wrapped.level.level}</span>
          <span style={{ fontSize: 12, opacity: 0.7 }}>{wrapped.turns} 回合</span>
          <span style={{ fontSize: 12, opacity: 0.7 }}>{wrapped.toolCalls} 工具</span>
          <span style={{ fontSize: 12, opacity: 0.7 }}>{wrapped.sessions} 会话</span>
          <span style={{ fontSize: 12, opacity: 0.7 }}>最长连击 {wrapped.longestStreak} 天</span>
          {wrapped.favoriteTool !== null && <span style={{ fontSize: 12, opacity: 0.7 }}>常用 {wrapped.favoriteTool}</span>}
          {wrapped.topUnlock !== null && (
            <span style={{ fontSize: 12, opacity: 0.85 }}>🏆 最高稀有成就：{wrapped.topUnlock.icon} {wrapped.topUnlock.title.zh}</span>
          )}
        </div>
      </details>

      {/* Share (local, privacy-safe, collapsed by default) */}
      <details className="dsh-badge-group" style={{ border: '1px solid rgba(128,128,128,0.18)', borderRadius: 10, padding: '8px 10px', marginBottom: 8 }}>
        <summary style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="dsh-badge-caret" style={{ fontSize: 11, opacity: 0.6, flex: 'none' }} />
          <span style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>📤 分享</span>
        </summary>
        <div style={{ paddingTop: 8 }}>
          <pre style={{ margin: 0, fontSize: 11, whiteSpace: 'pre-wrap', opacity: 0.85, maxHeight: 200, overflow: 'auto' }}>{shareText}</pre>
          <button
            onClick={copyShare}
            style={{ marginTop: 8, padding: '6px 12px', fontSize: 12, borderRadius: 8, border: '1px solid rgba(128,128,128,0.3)', background: 'transparent', color: 'inherit', cursor: 'pointer' }}
          >
            {copied ? '已复制 ✓' : '复制分享文本'}
          </button>
          <div style={{ fontSize: 11, opacity: 0.55, paddingTop: 8 }}>
            成就状态跨会话持久化，保存在 DSH 主目录。分享内容仅含成就、等级与计数，不含文件路径或命令。
          </div>
        </div>
      </details>
    </div>
  )
}
