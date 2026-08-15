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
/** Built-in chains over the shipped achievement ids. */
export const BUILTIN_CHAINS = [
    { id: 'turns', title: { zh: '回合之路', en: 'Turn Road' }, achievementIds: ['first-turn', 'ten-turns', 'hundred-turns'] },
    { id: 'tools', title: { zh: '工具之途', en: 'Tool Path' }, achievementIds: ['first-tool', 'hundred-tools'] },
    { id: 'streaks', title: { zh: '连续作战', en: 'Streak' }, achievementIds: ['streak-3', 'streak-7'] },
    { id: 'behavior', title: { zh: '行为狂人', en: 'Behavior Maniac' }, achievementIds: ['deja-vu', 'rabbit-hole', 'yolo', 'it-works-eventually'] },
];
