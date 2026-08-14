/**
 * The achievement engine, extracted as pure functions so the unlock rules are
 * unit-testable without a running harness. The Host half feeds real session /
 * tool events in; this module only maps counters → achievements.
 *
 * State shape:
 * - `counters` — lifetime totals (turns, tool calls, sessions, streak days)
 * - `unlocked` — achievement id → unlock epoch-ms
 * - `lastActiveDay` — 'YYYY-MM-DD' of the most recent turn, drives the streak
 * - `seenSessions` — distinct session ids that completed a turn
 */
export function createInitialState() {
    return {
        counters: { turns: 0, toolCalls: 0, sessions: 0, streakDays: 0 },
        unlocked: {},
        lastActiveDay: null,
        seenSessions: [],
    };
}
/** Advance the engine by one event; returns the next state and new unlocks. */
export function applyEvent(state, event, defs, today, now = Date.now()) {
    const counters = { ...state.counters };
    const seenSessions = [...state.seenSessions];
    let lastActiveDay = state.lastActiveDay;
    if (event.kind === 'turn-end') {
        counters.turns += 1;
        if (!seenSessions.includes(event.sessionId)) {
            seenSessions.push(event.sessionId);
            counters.sessions = seenSessions.length;
        }
        if (lastActiveDay === null) {
            counters.streakDays = 1;
        }
        else if (lastActiveDay !== today) {
            counters.streakDays = lastActiveDay === yesterdayOf(today) ? counters.streakDays + 1 : 1;
        }
        lastActiveDay = today;
    }
    else {
        counters.toolCalls += 1;
    }
    const newlyUnlocked = [];
    const unlocked = { ...state.unlocked };
    for (const def of defs) {
        if (!(def.id in unlocked) && def.condition(counters)) {
            unlocked[def.id] = now;
            newlyUnlocked.push(def);
        }
    }
    return { state: { counters, unlocked, lastActiveDay, seenSessions }, newlyUnlocked };
}
/** 'YYYY-MM-DD' one calendar day before `day` (UTC arithmetic, deterministic). */
export function yesterdayOf(day) {
    const [year, month, date] = day.split('-').map(Number);
    const value = new Date(Date.UTC(year, month - 1, date - 1));
    return value.toISOString().slice(0, 10);
}
/** The built-in achievements (ordered for display). */
export const BUILTIN_ACHIEVEMENTS = [
    {
        id: 'first-turn',
        icon: '🎬',
        title: { zh: '初次登场', en: 'First Turn' },
        description: { zh: '完成第一个回合', en: 'Complete your first turn' },
        condition: c => c.turns >= 1,
    },
    {
        id: 'ten-turns',
        icon: '🔟',
        title: { zh: '渐入佳境', en: 'Warming Up' },
        description: { zh: '累计完成 10 个回合', en: 'Complete 10 turns' },
        condition: c => c.turns >= 10,
    },
    {
        id: 'hundred-turns',
        icon: '💯',
        title: { zh: '百炼成钢', en: 'Century Club' },
        description: { zh: '累计完成 100 个回合', en: 'Complete 100 turns' },
        condition: c => c.turns >= 100,
    },
    {
        id: 'first-tool',
        icon: '🔧',
        title: { zh: '工具初体验', en: 'Tool Time' },
        description: { zh: '首次让 agent 调用工具', en: 'First tool call' },
        condition: c => c.toolCalls >= 1,
    },
    {
        id: 'hundred-tools',
        icon: '🛠️',
        title: { zh: '工具大师', en: 'Power Tooler' },
        description: { zh: '累计 100 次工具调用', en: '100 tool calls' },
        condition: c => c.toolCalls >= 100,
    },
    {
        id: 'ten-sessions',
        icon: '📚',
        title: { zh: '会话收藏家', en: 'Session Collector' },
        description: { zh: '累计使用 10 个会话', en: 'Use 10 sessions' },
        condition: c => c.sessions >= 10,
    },
    {
        id: 'streak-3',
        icon: '🔥',
        title: { zh: '三日之约', en: 'Three-Day Streak' },
        description: { zh: '连续 3 天使用', en: '3 consecutive active days' },
        condition: c => c.streakDays >= 3,
    },
    {
        id: 'streak-7',
        icon: '🌋',
        title: { zh: '七日火山', en: 'Week on Fire' },
        description: { zh: '连续 7 天使用', en: '7 consecutive active days' },
        condition: c => c.streakDays >= 7,
    },
];
/** Strip the predicate so a definition is safe to send to the browser half. */
export function toAchievementView(def) {
    return { id: def.id, icon: def.icon, title: def.title, description: def.description };
}
export const DEFAULT_ACHIEVEMENTS_SETTINGS = {
    enabled: true,
    toastEnabled: true,
};
