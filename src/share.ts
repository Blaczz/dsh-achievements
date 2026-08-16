/**
 * Sharing + community layer (v1.0): shareable achievement cards, a local
 * "Agent Wrapped" summary, and achievement chains. Everything here is
 * browser-safe and pure, and every export is privacy-safe by construction —
 * it only reads aggregate counters, achievement metadata, and persona/level;
 * it never reads file paths, command strings, or any session detail.
 */
import { levelOf, RARITY_META, type LevelInfo } from './gamification.ts'
import { buildProfileView, type Persona } from './profile.ts'
import type { AchievementRarity, AchievementView } from './achievements.ts'
import type { AchievementState } from './state.ts'

// ---- shareable achievement card ----

export interface AchievementCard {
  id: string
  icon: string
  title: AchievementView['title']
  description: AchievementView['description']
  rarity: AchievementRarity
  xp: number
  unlockedAt: number
}

export function buildAchievementCard(view: AchievementView, unlockedAt: number): AchievementCard {
  return {
    id: view.id,
    icon: view.icon,
    title: view.title,
    description: view.description,
    rarity: view.rarity,
    xp: view.xp,
    unlockedAt,
  }
}

// ---- Agent Wrapped (local aggregation, no cloud account) ----

export interface AgentWrapped {
  persona: Persona
  level: LevelInfo
  xp: number
  unlockedCount: number
  totalCount: number
  turns: number
  toolCalls: number
  sessions: number
  longestStreak: number
  favoriteTool: string | null
  topUnlock: AchievementCard | null
  recentUnlock: AchievementCard | null
}

export function buildAgentWrapped(state: AchievementState, views: readonly AchievementView[]): AgentWrapped {
  const profile = buildProfileView(state, views)
  let topUnlock: AchievementCard | null = null
  let recentUnlock: AchievementCard | null = null
  for (const view of views) {
    const at = state.profile.unlocked[view.id]
    if (at === undefined) continue
    const card = buildAchievementCard(view, at)
    if (topUnlock === null || RARITY_RANK[card.rarity] > RARITY_RANK[topUnlock.rarity]) topUnlock = card
    if (recentUnlock === null || at > recentUnlock.unlockedAt) recentUnlock = card
  }
  return {
    persona: profile.persona,
    level: profile.level,
    xp: profile.xp,
    unlockedCount: profile.unlockedCount,
    totalCount: profile.totalCount,
    turns: state.profile.turns,
    toolCalls: state.profile.toolCalls,
    sessions: state.profile.sessions,
    longestStreak: state.profile.longestStreak,
    favoriteTool: profile.favoriteTool,
    topUnlock,
    recentUnlock,
  }
}

// ---- share text (privacy-safe by construction) ----

const RARITY_RANK: Record<AchievementRarity, number> = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 }

export function buildShareText(
  state: AchievementState,
  views: readonly AchievementView[],
  locale: 'zh' | 'en' = 'zh',
): string {
  const profile = buildProfileView(state, views)
  const lines: string[] = [
    `🏆 dsh-achievements · ${profile.persona.title[locale]}`,
    `Lv.${profile.level.level} · ${profile.xp} XP · ${profile.unlockedCount}/${profile.totalCount} 成就`,
  ]
  const unlocked = views
    .filter(view => state.profile.unlocked[view.id] !== undefined)
    .sort((a, b) => RARITY_RANK[b.rarity] - RARITY_RANK[a.rarity] || a.id.localeCompare(b.id))
  if (unlocked.length > 0) {
    lines.push('')
    for (const view of unlocked) {
      lines.push(`${view.icon} ${view.title[locale]} · ${RARITY_META[view.rarity].label[locale]}`)
    }
  }
  return lines.join('\n')
}

// ---- achievement chains / saga ----

export interface AchievementChain {
  id: string
  title: AchievementView['title']
  achievementIds: readonly string[]
}

export interface ChainProgress {
  chain: AchievementChain
  completed: number
  total: number
  /** Next uncompleted achievement id, or null when the chain is complete. */
  nextId: string | null
  done: boolean
}

export function chainProgressOf(chain: AchievementChain, unlocked: Record<string, number>): ChainProgress {
  let completed = 0
  let nextId: string | null = null
  for (const id of chain.achievementIds) {
    if (unlocked[id] !== undefined) completed += 1
    else if (nextId === null) nextId = id
  }
  return { chain, completed, total: chain.achievementIds.length, nextId, done: completed === chain.achievementIds.length }
}

/**
 * The seven formal five-tier Lifetime progression chains. Each has exactly five
 * nodes ordered common → uncommon → rare → epic → legendary (see Task 17), and
 * drives the Badge Wall's milestone grouping — the UI derives milestone ids from
 * these chains rather than hardcoding them.
 */
export const MILESTONE_CHAINS: readonly AchievementChain[] = [
  { id: 'turns', title: { zh: '回合之路', en: 'Turn Road' }, achievementIds: ['first-turn', 'turns-25', 'turns-50', 'hundred-turns', 'turns-500'] },
  { id: 'tools', title: { zh: '工具之途', en: 'Tool Path' }, achievementIds: ['first-tool', 'tools-25', 'hundred-tools', 'tools-500', 'tools-2000'] },
  { id: 'sessions', title: { zh: '会话旅程', en: 'Session Journey' }, achievementIds: ['sessions-1', 'ten-sessions', 'sessions-50', 'sessions-200', 'sessions-500'] },
  { id: 'active-days', title: { zh: '活跃岁月', en: 'Active Days' }, achievementIds: ['active-days-1', 'active-days-7', 'active-days-30', 'active-days-100', 'active-days-365'] },
  { id: 'file-reads', title: { zh: '阅读之路', en: 'File Reads' }, achievementIds: ['file-reads-10', 'file-reads-100', 'file-reads-500', 'file-reads-2500', 'file-reads-10000'] },
  { id: 'file-edits', title: { zh: '编辑之路', en: 'File Edits' }, achievementIds: ['file-edits-1', 'file-edits-10', 'file-edits-50', 'file-edits-250', 'file-edits-1000'] },
  { id: 'tests', title: { zh: '测试之路', en: 'Test Runs' }, achievementIds: ['tests-1', 'tests-10', 'tests-50', 'tests-250', 'tests-1000'] },
]

/** Non-progression special chains: streaks + session behavior. */
export const SPECIAL_CHAINS: readonly AchievementChain[] = [
  { id: 'streaks', title: { zh: '连续作战', en: 'Streak' }, achievementIds: ['streak-3', 'streak-7'] },
  { id: 'behavior', title: { zh: '行为狂人', en: 'Behavior Maniac' }, achievementIds: ['deja-vu', 'rabbit-hole', 'yolo', 'it-works-eventually'] },
]

/** Every built-in chain: seven milestone lines first, then special chains. */
export const BUILTIN_CHAINS: readonly AchievementChain[] = [...MILESTONE_CHAINS, ...SPECIAL_CHAINS]
