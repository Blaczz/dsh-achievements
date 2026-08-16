/**
 * Achievement domain model v2 + the pure evaluation engine. Unlock rules moved
 * from `condition(counters)` to `evaluate(ctx)`, so a definition can read both
 * lifetime/profile and session behavior. The Host feeds standardized events in;
 * this module reduces them and evaluates every still-locked achievement.
 */
import { isDependencyPath } from "./events.js";
import { buildContext, reduceState } from "./reducer.js";
import { createInitialSessionState, touchSession } from "./state.js";
// ---- engine ----
/**
 * Advance the engine by one standardized event: reduce it into v2 state, build
 * the evaluation context, then unlock every still-locked achievement whose
 * `evaluate` now holds.
 */
export function applyEvent(state, event, defs, today, now = Date.now()) {
    const nextState = reduceState(state, event, today);
    const ctx = buildContext(nextState, event.sessionId);
    const newlyUnlocked = [];
    const unlocked = { ...nextState.profile.unlocked };
    let xpGained = 0;
    for (const def of defs) {
        if (!(def.id in unlocked) && def.evaluate(ctx).unlocked) {
            unlocked[def.id] = now;
            newlyUnlocked.push(def);
            xpGained += def.xp;
        }
    }
    // Attribute this session's unlocks + XP so a session report shows only the
    // additions made here.
    let sessions = nextState.sessions;
    if (newlyUnlocked.length > 0) {
        const session = sessions[event.sessionId] ?? createInitialSessionState();
        sessions = touchSession(sessions, event.sessionId, {
            ...session,
            unlocked: [...session.unlocked, ...newlyUnlocked.map(def => def.id)],
            xpGained: session.xpGained + xpGained,
        });
    }
    return {
        state: {
            ...nextState,
            profile: { ...nextState.profile, unlocked, xp: nextState.profile.xp + xpGained },
            sessions,
        },
        newlyUnlocked,
    };
}
/** Evaluate every definition and keep only the ones reporting progress/target. */
export function computeProgress(defs, ctx) {
    const out = {};
    for (const def of defs) {
        const evaluation = def.evaluate(ctx);
        if (evaluation.progress !== undefined || evaluation.target !== undefined) {
            out[def.id] = { progress: evaluation.progress, target: evaluation.target };
        }
    }
    return out;
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
export function reconcileLifetimeAchievements(state, defs, now = Date.now()) {
    const ctx = buildContext(state, '');
    const unlocked = { ...state.profile.unlocked };
    const newlyUnlocked = [];
    let xpGained = 0;
    for (const def of defs) {
        if (def.scope !== 'lifetime')
            continue;
        if (def.id in unlocked)
            continue;
        if (!def.evaluate(ctx).unlocked)
            continue;
        unlocked[def.id] = now;
        newlyUnlocked.push(def);
        xpGained += def.xp;
    }
    return {
        state: {
            ...state,
            profile: { ...state.profile, unlocked, xp: state.profile.xp + xpGained },
        },
        newlyUnlocked,
        xpGained,
    };
}
export function countersOf(profile) {
    return {
        turns: profile.turns,
        toolCalls: profile.toolCalls,
        sessions: profile.sessions,
        streakDays: profile.currentStreak,
    };
}
/** Wrap a v1 `condition(counters)` into a v2 `evaluate(ctx)` definition. */
export function fromCounterCondition(base, condition, overrides) {
    return {
        ...base,
        rarity: overrides?.rarity ?? 'common',
        xp: overrides?.xp ?? 0,
        scope: overrides?.scope ?? 'lifetime',
        hidden: overrides?.hidden ?? false,
        flavorText: overrides?.flavorText,
        evaluate: ctx => ({ unlocked: condition(countersOf(ctx.profile)) }),
    };
}
/**
 * Build one Lifetime threshold achievement with a standard
 * `{ unlocked, progress, target }` evaluation. `progress` is the raw metric,
 * not clamped to `target`, so downstream view models keep the true value and
 * the UI caps the bar width itself. Kept internal: third parties may still
 * write their own `evaluate`; this is not added to the public SDK surface.
 */
export function createLifetimeMilestone(spec) {
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
            const progress = spec.value(ctx.profile);
            return { unlocked: progress >= spec.target, progress, target: spec.target };
        },
    };
}
/**
 * Build one Session threshold achievement with a standard
 * `{ unlocked, progress, target }` evaluation. `progress` is the raw metric, not
 * clamped, mirroring `createLifetimeMilestone`. Kept internal: third parties
 * still write their own `evaluate`; this is not added to the public SDK surface.
 */
export function createSessionMilestone(spec) {
    return {
        id: spec.id,
        icon: spec.icon,
        title: spec.title,
        description: spec.description,
        flavorText: spec.flavorText,
        rarity: spec.rarity,
        xp: spec.xp,
        scope: 'session',
        hidden: spec.hidden,
        evaluate: ctx => {
            const progress = spec.value(ctx.session);
            return { unlocked: progress >= spec.target, progress, target: spec.target };
        },
    };
}
// ---- built-in achievements ----
/** Legacy lifetime counter achievements (v1), carried into the v2 model. */
export const COUNTER_ACHIEVEMENTS = [
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
];
/** P6 lifetime progression milestones (30 new, across 7 five-tier chains). */
export const MILESTONE_ACHIEVEMENTS = [
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
];
/** Every built-in Lifetime progression achievement (legacy counters + new milestones). */
export const LIFETIME_ACHIEVEMENTS = [...COUNTER_ACHIEVEMENTS, ...MILESTONE_ACHIEVEMENTS];
/** Highest value across a path→count map (0 when empty). */
function maxValue(map) {
    let max = 0;
    for (const value of Object.values(map))
        if (value > max)
            max = value;
    return max;
}
/** Number of distinct keys in a path→count map. */
function distinctCount(map) {
    return Object.keys(map).length;
}
/**
 * The first batch of behavior achievements (v0.2). Session-scoped: each reads
 * `ctx.session`, which the reducer resets per session, so behavior never leaks
 * across sessions. Thresholds are the literal spec from Task 05.
 */
export const BEHAVIOR_ACHIEVEMENTS = [
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
            const s = ctx.session;
            const ordered = s.firstReadSeq !== null && s.firstEditSeq !== null && s.firstTestSeq !== null
                && s.firstReadSeq < s.firstEditSeq && s.firstEditSeq < s.firstTestSeq;
            return {
                unlocked: s.toolCalls <= 5
                    && distinctCount(s.filesRead) >= 1
                    && distinctCount(s.filesEdited) >= 1
                    && s.tests.passed >= 1
                    && ordered,
            };
        },
    },
];
/**
 * P7 trajectory / session-behavior batch: four five-tier session chains
 * (session-marathon / turn-depth / tool-barrage / time-anomaly), 20 achievements
 * total. Each reads one O(1) session metric via `createSessionMilestone`.
 *
 * Behavior XP stays below the Lifetime milestone scale (10 / 20 / 40 / 70 / 120)
 * so a repeatably constructible session condition never out-earns lifetime work.
 * The duration chain reads seconds (`Math.floor(ms / 1000)`) so the Badge Wall
 * shows a sane `30 / 30` instead of a raw-millisecond `30000 / 30000`.
 */
export const TRAJECTORY_ACHIEVEMENTS = [
    // Chain A — 会话马拉松 / Session Marathon (trajectoryTurns: distinct closed-step turns)
    createSessionMilestone({
        id: 'session-turns-5', icon: '💬', title: { zh: '聊开了', en: 'Conversation Warm-Up' }, description: { zh: '单个会话完成 5 个回合', en: 'Complete 5 turns in one session' },
        flavorText: { zh: '看来这不是一句话能解决的问题。', en: "Seems this isn't a one-sentence problem." },
        rarity: 'common', xp: 10, target: 5, value: s => s.trajectoryTurns,
    }),
    createSessionMilestone({
        id: 'session-turns-20', icon: '☕', title: { zh: '长谈正酣', en: 'Long Conversation' }, description: { zh: '单个会话完成 20 个回合', en: 'Complete 20 turns in one session' },
        flavorText: { zh: '咖啡可以续杯，对话也可以。', en: 'Coffee refills, and so do conversations.' },
        rarity: 'uncommon', xp: 20, target: 20, value: s => s.trajectoryTurns,
    }),
    createSessionMilestone({
        id: 'session-turns-50', icon: '📺', title: { zh: '连续剧', en: 'Binge Session' }, description: { zh: '单个会话完成 50 个回合', en: 'Complete 50 turns in one session' },
        flavorText: { zh: '上一集：我们还在修这个问题。', en: 'Previously on: still fixing this.' },
        rarity: 'rare', xp: 40, target: 50, value: s => s.trajectoryTurns,
    }),
    createSessionMilestone({
        id: 'session-turns-100', icon: '📜', title: { zh: '百回长谈', en: 'Hundred-Turn Talk' }, description: { zh: '单个会话完成 100 个回合', en: 'Complete 100 turns in one session' },
        flavorText: { zh: '这已经不是聊天记录，是编年史。', en: "This is no longer a chat log; it's a chronicle." },
        rarity: 'epic', xp: 70, target: 100, value: s => s.trajectoryTurns,
    }),
    createSessionMilestone({
        id: 'session-turns-200', icon: '🏰', title: { zh: '永不散场', en: 'Never-Ending Session' }, description: { zh: '单个会话完成 200 个回合', en: 'Complete 200 turns in one session' },
        flavorText: { zh: '这个 Session 拒绝完结。', en: 'This session refuses to end.' },
        rarity: 'legendary', xp: 120, target: 200, value: s => s.trajectoryTurns,
    }),
    // Chain B — 单轮深潜 / Turn Depth (maxStepsInTurn: closed steps in one turn)
    createSessionMilestone({
        id: 'turn-steps-5', icon: '🪜', title: { zh: '层层深入', en: 'Going Deeper' }, description: { zh: '单个回合进入 5 个步骤', en: 'Reach 5 steps in a single turn' },
        rarity: 'common', xp: 10, target: 5, value: s => s.maxStepsInTurn,
    }),
    createSessionMilestone({
        id: 'turn-steps-20', icon: '🧵', title: { zh: '长链思考', en: 'Long Chain' }, description: { zh: '单个回合进入 20 个步骤', en: 'Reach 20 steps in a single turn' },
        rarity: 'uncommon', xp: 20, target: 20, value: s => s.maxStepsInTurn,
    }),
    createSessionMilestone({
        id: 'turn-steps-50', icon: '🌀', title: { zh: '深不见底', en: 'Down the Spiral' }, description: { zh: '单个回合进入 50 个步骤', en: 'Reach 50 steps in a single turn' },
        rarity: 'rare', xp: 40, target: 50, value: s => s.maxStepsInTurn,
    }),
    createSessionMilestone({
        id: 'turn-steps-100', icon: '♾️', title: { zh: '一轮百转', en: 'Hundred-Step Turn' }, description: { zh: '单个回合进入 100 个步骤', en: 'Reach 100 steps in a single turn' },
        rarity: 'epic', xp: 70, target: 100, value: s => s.maxStepsInTurn,
    }),
    createSessionMilestone({
        id: 'turn-steps-500', icon: '🏛️', title: { zh: '无尽回廊', en: 'Endless Corridor' }, description: { zh: '单个回合进入 500 个步骤', en: 'Reach 500 steps in a single turn' },
        rarity: 'legendary', xp: 120, target: 500, value: s => s.maxStepsInTurn,
    }),
    // Chain C — 工具齐射 / Tool Barrage (maxToolCallsInStep: settled calls in one step)
    createSessionMilestone({
        id: 'step-tools-5', icon: '🔧', title: { zh: '工具齐射', en: 'Tool Volley' }, description: { zh: '单个步骤调用 5 次工具', en: '5 tool calls in a single step' },
        rarity: 'common', xp: 10, target: 5, value: s => s.maxToolCallsInStep,
    }),
    createSessionMilestone({
        id: 'step-tools-10', icon: '🧰', title: { zh: '十器并用', en: 'Ten-Tool Step' }, description: { zh: '单个步骤调用 10 次工具', en: '10 tool calls in a single step' },
        rarity: 'uncommon', xp: 20, target: 10, value: s => s.maxToolCallsInStep,
    }),
    createSessionMilestone({
        id: 'step-tools-25', icon: '🌪️', title: { zh: '工具风暴', en: 'Tool Storm' }, description: { zh: '单个步骤调用 25 次工具', en: '25 tool calls in a single step' },
        rarity: 'rare', xp: 40, target: 25, value: s => s.maxToolCallsInStep,
    }),
    createSessionMilestone({
        id: 'step-tools-50', icon: '🏭', title: { zh: '流水线', en: 'Assembly Line' }, description: { zh: '单个步骤调用 50 次工具', en: '50 tool calls in a single step' },
        rarity: 'epic', xp: 70, target: 50, value: s => s.maxToolCallsInStep,
    }),
    createSessionMilestone({
        id: 'step-tools-100', icon: '🎼', title: { zh: '百器齐鸣', en: 'Hundred Tools' }, description: { zh: '单个步骤调用 100 次工具', en: '100 tool calls in a single step' },
        rarity: 'legendary', xp: 120, target: 100, value: s => s.maxToolCallsInStep,
    }),
    // Chain D — 时间异象 / Time Anomaly (maxRequestDurationMs, hidden easter eggs)
    createSessionMilestone({
        id: 'request-duration-30s', icon: '⏳', title: { zh: '稍等片刻', en: 'Give It a Moment' }, description: { zh: '单次模型请求思考耗时 ≥ 30 秒', en: 'A single model request thinking for ≥ 30 seconds' },
        flavorText: { zh: '正在思考，请勿刷新。', en: 'Thinking. Please do not refresh.' },
        rarity: 'common', xp: 10, target: 30, hidden: true, value: s => Math.floor(s.maxRequestDurationMs / 1000),
    }),
    createSessionMilestone({
        id: 'request-duration-100s', icon: '🧠', title: { zh: '深度思考', en: 'Deep Thought' }, description: { zh: '单次模型请求思考耗时 ≥ 100 秒', en: 'A single model request thinking for ≥ 100 seconds' },
        flavorText: { zh: '这个答案已经腌入味了。', en: 'This answer has been marinating.' },
        rarity: 'uncommon', xp: 20, target: 100, hidden: true, value: s => Math.floor(s.maxRequestDurationMs / 1000),
    }),
    createSessionMilestone({
        id: 'request-duration-300s', icon: '🐢', title: { zh: '慢工出细活', en: 'Slow and Steady' }, description: { zh: '单次模型请求思考耗时 ≥ 300 秒', en: 'A single model request thinking for ≥ 300 seconds' },
        flavorText: { zh: '时间也是上下文的一部分。', en: 'Time is part of the context too.' },
        rarity: 'rare', xp: 40, target: 300, hidden: true, value: s => Math.floor(s.maxRequestDurationMs / 1000),
    }),
    createSessionMilestone({
        id: 'request-duration-500s', icon: '🕰️', title: { zh: '时间膨胀', en: 'Time Dilation' }, description: { zh: '单次模型请求思考耗时 ≥ 500 秒', en: 'A single model request thinking for ≥ 500 seconds' },
        flavorText: { zh: '外面过去了八分钟，Step 里只是一个瞬间。', en: 'Eight minutes passed outside; inside the step, only a moment.' },
        rarity: 'epic', xp: 70, target: 500, hidden: true, value: s => Math.floor(s.maxRequestDurationMs / 1000),
    }),
    createSessionMilestone({
        id: 'request-duration-1000s', icon: '🗿', title: { zh: '世纪请求', en: 'The Long Wait' }, description: { zh: '单次模型请求思考耗时 ≥ 1000 秒', en: 'A single model request thinking for ≥ 1000 seconds' },
        flavorText: { zh: '你甚至有时间重新考虑这个问题。', en: 'You even had time to reconsider the question.' },
        rarity: 'legendary', xp: 120, target: 1000, hidden: true, value: s => Math.floor(s.maxRequestDurationMs / 1000),
    }),
];
/** All built-in achievements: lifetime counters + P6 milestones + behavior + P7 trajectory. */
export const BUILTIN_ACHIEVEMENTS = [...COUNTER_ACHIEVEMENTS, ...MILESTONE_ACHIEVEMENTS, ...BEHAVIOR_ACHIEVEMENTS, ...TRAJECTORY_ACHIEVEMENTS];
/** The built-in achievements expressed as the default Pack (same registry path). */
export const BUILTIN_PACK = {
    id: 'builtin',
    version: '0.7.0',
    name: { zh: '内置', en: 'Built-in' },
    achievements: BUILTIN_ACHIEVEMENTS,
};
/** Strip the `evaluate` predicate so a definition is safe to send to the browser half. */
export function toAchievementView(def) {
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
    };
}
export const DEFAULT_ACHIEVEMENTS_SETTINGS = {
    enabled: true,
    toastEnabled: true,
};
