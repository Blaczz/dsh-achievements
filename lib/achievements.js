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
// ---- built-in achievements ----
/** Legacy lifetime counter achievements (v1), carried into the v2 model. */
export const COUNTER_ACHIEVEMENTS = [
    fromCounterCondition({ id: 'first-turn', icon: '🎬', title: { zh: '初次登场', en: 'First Turn' }, description: { zh: '完成第一个回合', en: 'Complete your first turn' } }, c => c.turns >= 1, { rarity: 'common', xp: 10 }),
    fromCounterCondition({ id: 'ten-turns', icon: '🔟', title: { zh: '渐入佳境', en: 'Warming Up' }, description: { zh: '累计完成 10 个回合', en: 'Complete 10 turns' } }, c => c.turns >= 10, { rarity: 'common', xp: 20 }),
    fromCounterCondition({ id: 'hundred-turns', icon: '💯', title: { zh: '百炼成钢', en: 'Century Club' }, description: { zh: '累计完成 100 个回合', en: 'Complete 100 turns' } }, c => c.turns >= 100, { rarity: 'epic', xp: 200 }),
    fromCounterCondition({ id: 'first-tool', icon: '🔧', title: { zh: '工具初体验', en: 'Tool Time' }, description: { zh: '首次让 agent 调用工具', en: 'First tool call' } }, c => c.toolCalls >= 1, { rarity: 'common', xp: 10 }),
    fromCounterCondition({ id: 'hundred-tools', icon: '🛠️', title: { zh: '工具大师', en: 'Power Tooler' }, description: { zh: '累计 100 次工具调用', en: '100 tool calls' } }, c => c.toolCalls >= 100, { rarity: 'rare', xp: 150 }),
    fromCounterCondition({ id: 'ten-sessions', icon: '📚', title: { zh: '会话收藏家', en: 'Session Collector' }, description: { zh: '累计使用 10 个会话', en: 'Use 10 sessions' } }, c => c.sessions >= 10, { rarity: 'uncommon', xp: 50 }),
    fromCounterCondition({ id: 'streak-3', icon: '🔥', title: { zh: '三日之约', en: 'Three-Day Streak' }, description: { zh: '连续 3 天使用', en: '3 consecutive active days' } }, c => c.streakDays >= 3, { rarity: 'uncommon', xp: 50 }),
    fromCounterCondition({ id: 'streak-7', icon: '🌋', title: { zh: '七日火山', en: 'Week on Fire' }, description: { zh: '连续 7 天使用', en: '7 consecutive active days' } }, c => c.streakDays >= 7, { rarity: 'legendary', xp: 500 }),
];
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
/** All built-in achievements: lifetime counters + first behavior batch. */
export const BUILTIN_ACHIEVEMENTS = [...COUNTER_ACHIEVEMENTS, ...BEHAVIOR_ACHIEVEMENTS];
/** The built-in achievements expressed as the default Pack (same registry path). */
export const BUILTIN_PACK = {
    id: 'builtin',
    version: '0.2.0',
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
