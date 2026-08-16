/**
 * Sharing + community layer (v1.0): shareable achievement cards, a local
 * "Agent Wrapped" summary, and achievement chains. Everything here is
 * browser-safe and pure, and every export is privacy-safe by construction —
 * it only reads aggregate counters, achievement metadata, and persona/level;
 * it never reads file paths, command strings, or any session detail.
 */
import { levelOf, RARITY_META } from "./gamification.js";
import { buildProfileView } from "./profile.js";
export function buildAchievementCard(view, unlockedAt) {
    return {
        id: view.id,
        icon: view.icon,
        title: view.title,
        description: view.description,
        rarity: view.rarity,
        xp: view.xp,
        unlockedAt,
    };
}
export function buildAgentWrapped(state, views) {
    const profile = buildProfileView(state, views);
    let topUnlock = null;
    let recentUnlock = null;
    for (const view of views) {
        const at = state.profile.unlocked[view.id];
        if (at === undefined)
            continue;
        const card = buildAchievementCard(view, at);
        if (topUnlock === null || RARITY_RANK[card.rarity] > RARITY_RANK[topUnlock.rarity])
            topUnlock = card;
        if (recentUnlock === null || at > recentUnlock.unlockedAt)
            recentUnlock = card;
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
    };
}
// ---- share text (privacy-safe by construction) ----
const RARITY_RANK = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };
export function buildShareText(state, views, locale = 'zh') {
    const profile = buildProfileView(state, views);
    const lines = [
        `🏆 dsh-achievements · ${profile.persona.title[locale]}`,
        `Lv.${profile.level.level} · ${profile.xp} XP · ${profile.unlockedCount}/${profile.totalCount} 成就`,
    ];
    const unlocked = views
        .filter(view => state.profile.unlocked[view.id] !== undefined)
        .sort((a, b) => RARITY_RANK[b.rarity] - RARITY_RANK[a.rarity] || a.id.localeCompare(b.id));
    if (unlocked.length > 0) {
        lines.push('');
        for (const view of unlocked) {
            lines.push(`${view.icon} ${view.title[locale]} · ${RARITY_META[view.rarity].label[locale]}`);
        }
    }
    return lines.join('\n');
}
export function chainProgressOf(chain, unlocked) {
    let completed = 0;
    let nextId = null;
    for (const id of chain.achievementIds) {
        if (unlocked[id] !== undefined)
            completed += 1;
        else if (nextId === null)
            nextId = id;
    }
    return { chain, completed, total: chain.achievementIds.length, nextId, done: completed === chain.achievementIds.length };
}
/**
 * The seven formal five-tier Lifetime progression chains. Each has exactly five
 * nodes ordered common → uncommon → rare → epic → legendary (see Task 17), and
 * drives the Badge Wall's milestone grouping — the UI derives milestone ids from
 * these chains rather than hardcoding them.
 */
export const MILESTONE_CHAINS = [
    { id: 'turns', title: { zh: '回合之路', en: 'Turn Road' }, achievementIds: ['first-turn', 'turns-25', 'turns-50', 'hundred-turns', 'turns-500'] },
    { id: 'tools', title: { zh: '工具之途', en: 'Tool Path' }, achievementIds: ['first-tool', 'tools-25', 'hundred-tools', 'tools-500', 'tools-2000'] },
    { id: 'sessions', title: { zh: '会话旅程', en: 'Session Journey' }, achievementIds: ['sessions-1', 'ten-sessions', 'sessions-50', 'sessions-200', 'sessions-500'] },
    { id: 'active-days', title: { zh: '活跃岁月', en: 'Active Days' }, achievementIds: ['active-days-1', 'active-days-7', 'active-days-30', 'active-days-100', 'active-days-365'] },
    { id: 'file-reads', title: { zh: '阅读之路', en: 'File Reads' }, achievementIds: ['file-reads-10', 'file-reads-100', 'file-reads-500', 'file-reads-2500', 'file-reads-10000'] },
    { id: 'file-edits', title: { zh: '编辑之路', en: 'File Edits' }, achievementIds: ['file-edits-1', 'file-edits-10', 'file-edits-50', 'file-edits-250', 'file-edits-1000'] },
    { id: 'tests', title: { zh: '测试之路', en: 'Test Runs' }, achievementIds: ['tests-1', 'tests-10', 'tests-50', 'tests-250', 'tests-1000'] },
];
/**
 * P7 trajectory chains: four five-tier session chains. The Badge Wall derives
 * its special-behavior grouping from these ids (never hardcoded in JSX), and
 * each chain also renders as a `/5` progress row.
 */
export const TRAJECTORY_CHAINS = [
    {
        id: 'session-marathon',
        title: { zh: '会话马拉松', en: 'Session Marathon' },
        achievementIds: ['session-turns-5', 'session-turns-20', 'session-turns-50', 'session-turns-100', 'session-turns-200'],
    },
    {
        id: 'turn-depth',
        title: { zh: '单轮深潜', en: 'Turn Depth' },
        achievementIds: ['turn-steps-5', 'turn-steps-20', 'turn-steps-50', 'turn-steps-100', 'turn-steps-500'],
    },
    {
        id: 'tool-barrage',
        title: { zh: '工具齐射', en: 'Tool Barrage' },
        achievementIds: ['step-tools-5', 'step-tools-10', 'step-tools-25', 'step-tools-50', 'step-tools-100'],
    },
    {
        id: 'time-anomaly',
        title: { zh: '时间异象', en: 'Time Anomaly' },
        achievementIds: ['request-duration-30s', 'request-duration-100s', 'request-duration-300s', 'request-duration-500s', 'request-duration-1000s'],
    },
];
/** Non-progression special chains: streaks + session behavior + P7 trajectory. */
export const SPECIAL_CHAINS = [
    { id: 'streaks', title: { zh: '连续作战', en: 'Streak' }, achievementIds: ['streak-3', 'streak-7'] },
    { id: 'behavior', title: { zh: '行为狂人', en: 'Behavior Maniac' }, achievementIds: ['deja-vu', 'rabbit-hole', 'yolo', 'it-works-eventually'] },
    ...TRAJECTORY_CHAINS,
];
/** Every built-in chain: seven milestone lines first, then special chains. */
export const BUILTIN_CHAINS = [...MILESTONE_CHAINS, ...SPECIAL_CHAINS];
