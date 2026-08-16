/**
 * Achievement domain model v2 + the pure evaluation engine. Unlock rules moved
 * from `condition(counters)` to `evaluate(ctx)`, so a definition can read both
 * lifetime/profile and session behavior. The Host feeds standardized events in;
 * this module reduces them and evaluates every still-locked achievement.
 */
import { isDependencyPath, type AchievementEvent } from './events.ts'
import { buildContext, reduceState, type AchievementContext } from './reducer.ts'
import { createInitialSessionState, touchSession, type AchievementState, type ProfileState } from './state.ts'
import type { AchievementPack } from './sdk.ts'

// ---- model types ----

export interface LocalizedText {
  zh: string
  en: string
}

export type AchievementRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'

export type AchievementScope = 'lifetime' | 'session'

export interface AchievementEvaluation {
  unlocked: boolean
  /** Optional progress toward the target (rendered by Steamification, P2). */
  progress?: number
  /** Optional target the progress is measured against. */
  target?: number
}

export type { AchievementContext } from './reducer.ts'

export interface AchievementDef {
  id: string
  icon: string
  title: LocalizedText
  description: LocalizedText
  flavorText?: LocalizedText
  rarity: AchievementRarity
  xp: number
  scope: AchievementScope
  hidden?: boolean
  evaluate(ctx: AchievementContext): AchievementEvaluation
}

export interface AchievementProgress {
  state: AchievementState
  newlyUnlocked: AchievementDef[]
}

// ---- engine ----

/**
 * Advance the engine by one standardized event: reduce it into v2 state, build
 * the evaluation context, then unlock every still-locked achievement whose
 * `evaluate` now holds.
 */
export function applyEvent(
  state: AchievementState,
  event: AchievementEvent,
  defs: readonly AchievementDef[],
  today: string,
  now = Date.now(),
): AchievementProgress {
  const nextState = reduceState(state, event, today)
  const ctx = buildContext(nextState, event.sessionId)
  const newlyUnlocked: AchievementDef[] = []
  const unlocked = { ...nextState.profile.unlocked }
  let xpGained = 0
  for (const def of defs) {
    if (!(def.id in unlocked) && def.evaluate(ctx).unlocked) {
      unlocked[def.id] = now
      newlyUnlocked.push(def)
      xpGained += def.xp
    }
  }

  // Attribute this session's unlocks + XP so a session report shows only the
  // additions made here.
  let sessions = nextState.sessions
  if (newlyUnlocked.length > 0) {
    const session = sessions[event.sessionId] ?? createInitialSessionState()
    sessions = touchSession(sessions, event.sessionId, {
      ...session,
      unlocked: [...session.unlocked, ...newlyUnlocked.map(def => def.id)],
      xpGained: session.xpGained + xpGained,
    })
  }

  return {
    state: {
      ...nextState,
      profile: { ...nextState.profile, unlocked, xp: nextState.profile.xp + xpGained },
      sessions,
    },
    newlyUnlocked,
  }
}

/** Serialized progress view of one achievement (progress / target only). */
export interface AchievementProgressView {
  progress?: number
  target?: number
}

/** Evaluate every definition and keep only the ones reporting progress/target. */
export function computeProgress(
  defs: readonly AchievementDef[],
  ctx: AchievementContext,
): Record<string, AchievementProgressView> {
  const out: Record<string, AchievementProgressView> = {}
  for (const def of defs) {
    const evaluation = def.evaluate(ctx)
    if (evaluation.progress !== undefined || evaluation.target !== undefined) {
      out[def.id] = { progress: evaluation.progress, target: evaluation.target }
    }
  }
  return out
}

// ---- silent lifetime reconciliation (P6) ----

/** Result of one silent reconciliation pass. */
export interface LifetimeReconciliation {
  state: AchievementState
  newlyUnlocked: AchievementDef[]
  xpGained: number
}

/**
 * Silently unlock every still-locked `scope === 'lifetime'` definition whose
 * `evaluate` already holds against the current profile, awarding its XP once.
 *
 * Deliberately NOT `applyEvent`: it runs no reducer, writes no session
 * attribution, and the caller must not broadcast the resulting unlocks. The
 * unlock timestamp is the reconciliation moment (the "system confirmed" time),
 * not a fabricated historical completion date. Idempotent via the same
 * `id in unlocked` guard as the live engine.
 */
export function reconcileLifetimeAchievements(
  state: AchievementState,
  defs: readonly AchievementDef[],
  now = Date.now(),
): LifetimeReconciliation {
  const ctx = buildContext(state, '')
  const unlocked = { ...state.profile.unlocked }
  const newlyUnlocked: AchievementDef[] = []
  let xpGained = 0
  for (const def of defs) {
    if (def.scope !== 'lifetime') continue
    if (def.id in unlocked) continue
    if (!def.evaluate(ctx).unlocked) continue
    unlocked[def.id] = now
    newlyUnlocked.push(def)
    xpGained += def.xp
  }
  return {
    state: {
      ...state,
      profile: { ...state.profile, unlocked, xp: state.profile.xp + xpGained },
    },
    newlyUnlocked,
    xpGained,
  }
}

// ---- legacy counter compatibility ----

/** The v1 counter view, kept so existing counter rules need no rewrite. */
export interface AchievementCounters {
  turns: number
  toolCalls: number
  sessions: number
  streakDays: number
}

export function countersOf(profile: ProfileState): AchievementCounters {
  return {
    turns: profile.turns,
    toolCalls: profile.toolCalls,
    sessions: profile.sessions,
    streakDays: profile.currentStreak,
  }
}

/** Wrap a v1 `condition(counters)` into a v2 `evaluate(ctx)` definition. */
export function fromCounterCondition(
  base: { id: string; icon: string; title: LocalizedText; description: LocalizedText },
  condition: (counters: AchievementCounters) => boolean,
  overrides?: Partial<Pick<AchievementDef, 'rarity' | 'xp' | 'scope' | 'hidden' | 'flavorText'>>,
): AchievementDef {
  return {
    ...base,
    rarity: overrides?.rarity ?? 'common',
    xp: overrides?.xp ?? 0,
    scope: overrides?.scope ?? 'lifetime',
    hidden: overrides?.hidden ?? false,
    flavorText: overrides?.flavorText,
    evaluate: ctx => ({ unlocked: condition(countersOf(ctx.profile)) }),
  }
}

// ---- lifetime milestone framework (P6) ----

/** Internal spec for one Lifetime threshold milestone (not public SDK surface). */
interface LifetimeMilestoneSpec {
  id: string
  icon: string
  title: LocalizedText
  description: LocalizedText
  flavorText?: LocalizedText
  rarity: AchievementRarity
  xp: number
  target: number
  /** Reads the lifetime metric this milestone measures from the profile. */
  value(profile: ProfileState): number
}

/**
 * Build one Lifetime threshold achievement with a standard
 * `{ unlocked, progress, target }` evaluation. `progress` is the raw metric,
 * not clamped to `target`, so downstream view models keep the true value and
 * the UI caps the bar width itself. Kept internal: third parties may still
 * write their own `evaluate`; this is not added to the public SDK surface.
 */
export function createLifetimeMilestone(spec: LifetimeMilestoneSpec): AchievementDef {
  return {
    id: spec.id,
    icon: spec.icon,
    title: spec.title,
    description: spec.description,
    flavorText: spec.flavorText,
    rarity: spec.rarity,
    xp: spec.xp,
    scope: 'lifetime',
    evaluate: ctx => {
      const progress = spec.value(ctx.profile)
      return { unlocked: progress >= spec.target, progress, target: spec.target }
    },
  }
}

// ---- built-in achievements ----

/** Legacy lifetime counter achievements (v1), carried into the v2 model. */
export const COUNTER_ACHIEVEMENTS: readonly AchievementDef[] = [
  createLifetimeMilestone({
    id: 'first-turn', icon: '🎬', title: { zh: '初次登场', en: 'First Turn' }, description: { zh: '完成第一个回合', en: 'Complete your first turn' },
    rarity: 'common', xp: 10, target: 1, value: p => p.turns,
  }),
  createLifetimeMilestone({
    id: 'ten-turns', icon: '🔟', title: { zh: '渐入佳境', en: 'Warming Up' }, description: { zh: '累计完成 10 个回合', en: 'Complete 10 turns' },
    rarity: 'common', xp: 20, target: 10, value: p => p.turns,
  }),
  createLifetimeMilestone({
    id: 'hundred-turns', icon: '💯', title: { zh: '百炼成钢', en: 'Century Club' }, description: { zh: '累计完成 100 个回合', en: 'Complete 100 turns' },
    rarity: 'epic', xp: 200, target: 100, value: p => p.turns,
  }),
  createLifetimeMilestone({
    id: 'first-tool', icon: '🔧', title: { zh: '工具初体验', en: 'Tool Time' }, description: { zh: '首次让 agent 调用工具', en: 'First tool call' },
    rarity: 'common', xp: 10, target: 1, value: p => p.toolCalls,
  }),
  createLifetimeMilestone({
    id: 'hundred-tools', icon: '🛠️', title: { zh: '工具大师', en: 'Power Tooler' }, description: { zh: '累计 100 次工具调用', en: '100 tool calls' },
    rarity: 'rare', xp: 150, target: 100, value: p => p.toolCalls,
  }),
  createLifetimeMilestone({
    id: 'ten-sessions', icon: '📚', title: { zh: '会话收藏家', en: 'Session Collector' }, description: { zh: '累计使用 10 个会话', en: 'Use 10 sessions' },
    rarity: 'uncommon', xp: 50, target: 10, value: p => p.sessions,
  }),
  createLifetimeMilestone({
    id: 'streak-3', icon: '🔥', title: { zh: '三日之约', en: 'Three-Day Streak' }, description: { zh: '连续 3 天使用', en: '3 consecutive active days' },
    rarity: 'uncommon', xp: 50, target: 3, value: p => p.currentStreak,
  }),
  createLifetimeMilestone({
    id: 'streak-7', icon: '🌋', title: { zh: '七日火山', en: 'Week on Fire' }, description: { zh: '连续 7 天使用', en: '7 consecutive active days' },
    rarity: 'legendary', xp: 500, target: 7, value: p => p.currentStreak,
  }),
]

/** P6 lifetime progression milestones (30 new, across 7 five-tier chains). */
export const MILESTONE_ACHIEVEMENTS: readonly AchievementDef[] = [
  // A. 回合之路 / Turns
  createLifetimeMilestone({
    id: 'turns-25', icon: '🚶', title: { zh: '稳步前行', en: 'Finding Rhythm' }, description: { zh: '累计完成 25 个回合', en: 'Complete 25 turns' },
    rarity: 'uncommon', xp: 30, target: 25, value: p => p.turns,
  }),
  createLifetimeMilestone({
    id: 'turns-50', icon: '🧭', title: { zh: '驾轻就熟', en: 'In the Groove' }, description: { zh: '累计完成 50 个回合', en: 'Complete 50 turns' },
    rarity: 'rare', xp: 75, target: 50, value: p => p.turns,
  }),
  createLifetimeMilestone({
    id: 'turns-500', icon: '👑', title: { zh: '回合宗师', en: 'Turnmaster' }, description: { zh: '累计完成 500 个回合', en: 'Complete 500 turns' },
    rarity: 'legendary', xp: 400, target: 500, value: p => p.turns,
  }),
  // B. 工具之途 / Tools
  createLifetimeMilestone({
    id: 'tools-25', icon: '🧰', title: { zh: '工具箱常客', en: 'Toolbox Regular' }, description: { zh: '累计 25 次工具调用', en: '25 tool calls' },
    rarity: 'uncommon', xp: 30, target: 25, value: p => p.toolCalls,
  }),
  createLifetimeMilestone({
    id: 'tools-500', icon: '⚙️', title: { zh: '机巧工坊', en: 'Toolsmith' }, description: { zh: '累计 500 次工具调用', en: '500 tool calls' },
    rarity: 'epic', xp: 175, target: 500, value: p => p.toolCalls,
  }),
  createLifetimeMilestone({
    id: 'tools-2000', icon: '🦾', title: { zh: '万能机巧', en: 'Master of Tools' }, description: { zh: '累计 2000 次工具调用', en: '2000 tool calls' },
    rarity: 'legendary', xp: 400, target: 2000, value: p => p.toolCalls,
  }),
  // C. 会话旅程 / Sessions
  createLifetimeMilestone({
    id: 'sessions-1', icon: '💬', title: { zh: '初次会面', en: 'First Session' }, description: { zh: '累计使用 1 个会话', en: 'Use 1 session' },
    rarity: 'common', xp: 10, target: 1, value: p => p.sessions,
  }),
  createLifetimeMilestone({
    id: 'sessions-50', icon: '🗂️', title: { zh: '会话常客', en: 'Session Regular' }, description: { zh: '累计使用 50 个会话', en: 'Use 50 sessions' },
    rarity: 'rare', xp: 75, target: 50, value: p => p.sessions,
  }),
  createLifetimeMilestone({
    id: 'sessions-200', icon: '🧳', title: { zh: '长谈不倦', en: 'Conversation Veteran' }, description: { zh: '累计使用 200 个会话', en: 'Use 200 sessions' },
    rarity: 'epic', xp: 175, target: 200, value: p => p.sessions,
  }),
  createLifetimeMilestone({
    id: 'sessions-500', icon: '🏛️', title: { zh: '会话典藏家', en: 'Session Archivist' }, description: { zh: '累计使用 500 个会话', en: 'Use 500 sessions' },
    rarity: 'legendary', xp: 400, target: 500, value: p => p.sessions,
  }),
  // D. 活跃岁月 / Active Days
  createLifetimeMilestone({
    id: 'active-days-1', icon: '🌅', title: { zh: '今日启程', en: 'Day One' }, description: { zh: '累计活跃 1 天', en: 'Active on 1 day' },
    rarity: 'common', xp: 10, target: 1, value: p => p.activeDays,
  }),
  createLifetimeMilestone({
    id: 'active-days-7', icon: '📅', title: { zh: '一周常驻', en: 'One Week In' }, description: { zh: '累计活跃 7 天', en: 'Active on 7 days' },
    rarity: 'uncommon', xp: 30, target: 7, value: p => p.activeDays,
  }),
  createLifetimeMilestone({
    id: 'active-days-30', icon: '🗓️', title: { zh: '月度常客', en: 'Month Regular' }, description: { zh: '累计活跃 30 天', en: 'Active on 30 days' },
    rarity: 'rare', xp: 75, target: 30, value: p => p.activeDays,
  }),
  createLifetimeMilestone({
    id: 'active-days-100', icon: '🌤️', title: { zh: '百日同行', en: 'Hundred Days' }, description: { zh: '累计活跃 100 天', en: 'Active on 100 days' },
    rarity: 'epic', xp: 175, target: 100, value: p => p.activeDays,
  }),
  createLifetimeMilestone({
    id: 'active-days-365', icon: '🌍', title: { zh: '周年相伴', en: 'Year in the Loop' }, description: { zh: '累计活跃 365 天', en: 'Active on 365 days' },
    rarity: 'legendary', xp: 400, target: 365, value: p => p.activeDays,
  }),
  // E. 阅读之路 / File Reads
  createLifetimeMilestone({
    id: 'file-reads-10', icon: '📖', title: { zh: '翻阅初章', en: 'First Chapter' }, description: { zh: '成功读取文件 10 次', en: 'Read files 10 times' },
    rarity: 'common', xp: 10, target: 10, value: p => p.fileReads,
  }),
  createLifetimeMilestone({
    id: 'file-reads-100', icon: '📚', title: { zh: '广泛阅读', en: 'Wide Reader' }, description: { zh: '成功读取文件 100 次', en: 'Read files 100 times' },
    rarity: 'uncommon', xp: 30, target: 100, value: p => p.fileReads,
  }),
  createLifetimeMilestone({
    id: 'file-reads-500', icon: '🧠', title: { zh: '仓库漫游者', en: 'Repository Rover' }, description: { zh: '成功读取文件 500 次', en: 'Read files 500 times' },
    rarity: 'rare', xp: 75, target: 500, value: p => p.fileReads,
  }),
  createLifetimeMilestone({
    id: 'file-reads-2500', icon: '🔬', title: { zh: '源码博览家', en: 'Source Scholar' }, description: { zh: '成功读取文件 2500 次', en: 'Read files 2500 times' },
    rarity: 'epic', xp: 175, target: 2500, value: p => p.fileReads,
  }),
  createLifetimeMilestone({
    id: 'file-reads-10000', icon: '🏯', title: { zh: '万卷代码', en: 'Ten Thousand Reads' }, description: { zh: '成功读取文件 10000 次', en: 'Read files 10000 times' },
    rarity: 'legendary', xp: 400, target: 10000, value: p => p.fileReads,
  }),
  // F. 编辑之路 / File Edits
  createLifetimeMilestone({
    id: 'file-edits-1', icon: '✏️', title: { zh: '落下第一笔', en: 'First Edit' }, description: { zh: '成功修改文件 1 次', en: 'Edit files 1 time' },
    rarity: 'common', xp: 10, target: 1, value: p => p.fileEdits,
  }),
  createLifetimeMilestone({
    id: 'file-edits-10', icon: '🩹', title: { zh: '小修小补', en: 'Patchwork' }, description: { zh: '成功修改文件 10 次', en: 'Edit files 10 times' },
    rarity: 'uncommon', xp: 30, target: 10, value: p => p.fileEdits,
  }),
  createLifetimeMilestone({
    id: 'file-edits-50', icon: '🔨', title: { zh: '改造能手', en: 'Code Tinkerer' }, description: { zh: '成功修改文件 50 次', en: 'Edit files 50 times' },
    rarity: 'rare', xp: 75, target: 50, value: p => p.fileEdits,
  }),
  createLifetimeMilestone({
    id: 'file-edits-250', icon: '🏗️', title: { zh: '重构老手', en: 'Refactor Veteran' }, description: { zh: '成功修改文件 250 次', en: 'Edit files 250 times' },
    rarity: 'epic', xp: 175, target: 250, value: p => p.fileEdits,
  }),
  createLifetimeMilestone({
    id: 'file-edits-1000', icon: '⚒️', title: { zh: '千锤百炼', en: 'Thousand Edits' }, description: { zh: '成功修改文件 1000 次', en: 'Edit files 1000 times' },
    rarity: 'legendary', xp: 400, target: 1000, value: p => p.fileEdits,
  }),
  // G. 测试之路 / Test Runs
  createLifetimeMilestone({
    id: 'tests-1', icon: '🧪', title: { zh: '试运行', en: 'First Test' }, description: { zh: '运行测试 1 次', en: 'Run tests 1 time' },
    rarity: 'common', xp: 10, target: 1, value: p => p.testRuns,
  }),
  createLifetimeMilestone({
    id: 'tests-10', icon: '✅', title: { zh: '测试习惯', en: 'Test Habit' }, description: { zh: '运行测试 10 次', en: 'Run tests 10 times' },
    rarity: 'uncommon', xp: 30, target: 10, value: p => p.testRuns,
  }),
  createLifetimeMilestone({
    id: 'tests-50', icon: '🚦', title: { zh: '测试巡航', en: 'Test Cruiser' }, description: { zh: '运行测试 50 次', en: 'Run tests 50 times' },
    rarity: 'rare', xp: 75, target: 50, value: p => p.testRuns,
  }),
  createLifetimeMilestone({
    id: 'tests-250', icon: '⚗️', title: { zh: '测试炼金术', en: 'Test Alchemist' }, description: { zh: '运行测试 250 次', en: 'Run tests 250 times' },
    rarity: 'epic', xp: 175, target: 250, value: p => p.testRuns,
  }),
  createLifetimeMilestone({
    id: 'tests-1000', icon: '🧬', title: { zh: '千测不怠', en: 'Test Marathon' }, description: { zh: '运行测试 1000 次', en: 'Run tests 1000 times' },
    rarity: 'legendary', xp: 400, target: 1000, value: p => p.testRuns,
  }),
]

/** Every built-in Lifetime progression achievement (legacy counters + new milestones). */
export const LIFETIME_ACHIEVEMENTS: readonly AchievementDef[] = [...COUNTER_ACHIEVEMENTS, ...MILESTONE_ACHIEVEMENTS]

/** Highest value across a path→count map (0 when empty). */
function maxValue(map: Record<string, number>): number {
  let max = 0
  for (const value of Object.values(map)) if (value > max) max = value
  return max
}

/** Number of distinct keys in a path→count map. */
function distinctCount(map: Record<string, number>): number {
  return Object.keys(map).length
}

/**
 * The first batch of behavior achievements (v0.2). Session-scoped: each reads
 * `ctx.session`, which the reducer resets per session, so behavior never leaks
 * across sessions. Thresholds are the literal spec from Task 05.
 */
export const BEHAVIOR_ACHIEVEMENTS: readonly AchievementDef[] = [
  {
    id: 'deja-vu',
    icon: '🔁',
    title: { zh: '似曾相识', en: 'Déjà Vu' },
    description: { zh: '同一文件修改 5 次', en: 'Edit the same file 5 times' },
    flavorText: { zh: '你确定这不是第 6 次了吗？', en: 'Are you sure this is not the 6th time?' },
    rarity: 'uncommon',
    xp: 30,
    scope: 'session',
    evaluate: ctx => ({ unlocked: maxValue(ctx.session.filesEdited) >= 5, progress: maxValue(ctx.session.filesEdited), target: 5 }),
  },
  {
    id: 'rabbit-hole',
    icon: '🕳',
    title: { zh: '兔子洞', en: 'Rabbit Hole' },
    description: { zh: '第一次修改前读取 20 个文件', en: 'Read 20 files before your first edit' },
    flavorText: { zh: '你只是看看，对吧？', en: 'You were just looking, right?' },
    rarity: 'rare',
    xp: 40,
    scope: 'session',
    evaluate: ctx => ({ unlocked: ctx.session.readsBeforeFirstEdit >= 20, progress: ctx.session.readsBeforeFirstEdit, target: 20 }),
  },
  {
    id: 'yolo',
    icon: '💣',
    title: { zh: '先斩后奏', en: 'YOLO' },
    description: { zh: '第一次测试前修改 8 个文件', en: 'Edit 8 files before your first test' },
    flavorText: { zh: '测试？那是什么？', en: 'Tests? What are those?' },
    rarity: 'epic',
    xp: 60,
    scope: 'session',
    evaluate: ctx => ({ unlocked: ctx.session.editsBeforeFirstTest >= 8, progress: ctx.session.editsBeforeFirstTest, target: 8 }),
  },
  {
    id: 'it-works-eventually',
    icon: '🔥',
    title: { zh: '终于通了', en: 'It Works Eventually' },
    description: { zh: '测试失败 5 次后成功', en: 'Pass after 5 failed tests' },
    flavorText: { zh: '失败是成功之母，但你未免太孝顺了。', en: 'Failure teaches success, but you were a little too filial.' },
    rarity: 'epic',
    xp: 80,
    scope: 'session',
    evaluate: ctx => ({ unlocked: ctx.session.tests.failed >= 5 && ctx.session.tests.lastOutcome === 'pass', progress: ctx.session.tests.failed, target: 5 }),
  },
  {
    id: 'surely-this-time',
    icon: '🎰',
    title: { zh: '这次一定', en: 'Surely This Time' },
    description: { zh: '同一测试命令连续失败 5 次', en: 'Fail the same test command 5 times in a row' },
    flavorText: { zh: '再跑一次肯定绿。', en: 'One more run and it will be green.' },
    rarity: 'rare',
    xp: 50,
    scope: 'session',
    evaluate: ctx => ({ unlocked: ctx.session.failingStreak >= 5, progress: ctx.session.failingStreak, target: 5 }),
  },
  {
    id: 'one-shot',
    icon: '🎯',
    title: { zh: '一发入魂', en: 'One Shot' },
    description: { zh: '只改一次，第一次测试直接通过', en: 'Pass the first test after a single edit' },
    flavorText: { zh: '没有第二枪，因为不需要。', en: 'No second shot, because none was needed.' },
    rarity: 'epic',
    xp: 50,
    scope: 'session',
    evaluate: ctx => ({
      unlocked: ctx.session.edits === 1
        && ctx.session.firstTestOutcome === 'pass'
        && ctx.session.firstEditSeq !== null
        && ctx.session.firstTestSeq !== null
        && ctx.session.firstEditSeq < ctx.session.firstTestSeq,
    }),
  },
  {
    id: 'librarian',
    icon: '📚',
    title: { zh: '图书管理员', en: 'Librarian' },
    description: { zh: '单会话读取 30 个不同文件', en: 'Read 30 distinct files in one session' },
    flavorText: { zh: '整个仓库都借阅过了。', en: 'Borrowed the whole repository.' },
    rarity: 'uncommon',
    xp: 20,
    scope: 'session',
    evaluate: ctx => ({ unlocked: distinctCount(ctx.session.filesRead) >= 30, progress: distinctCount(ctx.session.filesRead), target: 30 }),
  },
  {
    id: 'touch-grass',
    icon: '🌱',
    title: { zh: '出门走走', en: 'Touch Grass' },
    description: { zh: '单会话工具调用 100 次', en: '100 tool calls in one session' },
    flavorText: { zh: '放下键盘，去晒晒太阳。', en: 'Step away from the keyboard and touch some grass.' },
    rarity: 'uncommon',
    xp: 30,
    scope: 'session',
    evaluate: ctx => ({ unlocked: ctx.session.toolCalls >= 100, progress: ctx.session.toolCalls, target: 100 }),
  },
  {
    id: 'dependency-archaeologist',
    icon: '🦴',
    title: { zh: '依赖考古学家', en: 'Dependency Archaeologist' },
    description: { zh: '读取依赖目录（node_modules / site-packages / vendor）下的文件', en: 'Read a file inside a dependency directory' },
    flavorText: { zh: '你进入了 node_modules，而且活着回来了。', en: 'You entered node_modules, and came back alive.' },
    rarity: 'epic',
    xp: 50,
    scope: 'session',
    evaluate: ctx => ({ unlocked: Object.keys(ctx.session.filesRead).some(isDependencyPath) }),
  },
  {
    id: 'gigachad',
    icon: '🗿',
    title: { zh: '巨佬模式', en: 'Gigachad' },
    description: { zh: '≤5 次工具调用内完成 读→改→测 且通过', en: 'Read, edit and pass a test within 5 tool calls' },
    flavorText: { zh: '少说，少看，少改，直接对。', en: 'Say less, look less, edit less, just be right.' },
    rarity: 'legendary',
    xp: 100,
    scope: 'session',
    evaluate: ctx => {
      const s = ctx.session
      const ordered = s.firstReadSeq !== null && s.firstEditSeq !== null && s.firstTestSeq !== null
        && s.firstReadSeq < s.firstEditSeq && s.firstEditSeq < s.firstTestSeq
      return {
        unlocked: s.toolCalls <= 5
          && distinctCount(s.filesRead) >= 1
          && distinctCount(s.filesEdited) >= 1
          && s.tests.passed >= 1
          && ordered,
      }
    },
  },
]

/** All built-in achievements: lifetime counters + P6 milestones + behavior batch. */
export const BUILTIN_ACHIEVEMENTS: readonly AchievementDef[] = [...COUNTER_ACHIEVEMENTS, ...MILESTONE_ACHIEVEMENTS, ...BEHAVIOR_ACHIEVEMENTS]

/** The built-in achievements expressed as the default Pack (same registry path). */
export const BUILTIN_PACK: AchievementPack = {
  id: 'builtin',
  version: '0.6.0',
  name: { zh: '内置', en: 'Built-in' },
  achievements: BUILTIN_ACHIEVEMENTS,
}

// ---- serialization / settings ----

/** Serialized achievement view the browser half can render (no functions). */
export interface AchievementView {
  id: string
  icon: string
  title: LocalizedText
  description: LocalizedText
  flavorText?: LocalizedText
  rarity: AchievementRarity
  xp: number
  scope: AchievementScope
  hidden: boolean
}

/** Strip the `evaluate` predicate so a definition is safe to send to the browser half. */
export function toAchievementView(def: AchievementDef): AchievementView {
  return {
    id: def.id,
    icon: def.icon,
    title: def.title,
    description: def.description,
    flavorText: def.flavorText,
    rarity: def.rarity,
    xp: def.xp,
    scope: def.scope,
    hidden: def.hidden ?? false,
  }
}

export interface AchievementsSettings {
  /** Master switch for unlock toasts + badge updates. */
  enabled: boolean
  /** Show a toast when an achievement unlocks mid-session. */
  toastEnabled: boolean
}

export const DEFAULT_ACHIEVEMENTS_SETTINGS: AchievementsSettings = {
  enabled: true,
  toastEnabled: true,
}
