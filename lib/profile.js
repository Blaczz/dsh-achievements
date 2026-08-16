/**
 * Agent Profile + Session Summary derivations. Browser-safe pure functions —
 * only type imports from state/achievements and the pure `levelOf` from
 * gamification — so the client bundle inlines them without pulling in node
 * or @deepseek-ai runtime code.
 */
import { levelOf } from "./gamification.js";
const PERFECTIONIST = { id: 'perfectionist', title: { zh: '完美主义', en: 'Perfectionist' }, description: { zh: '反复打磨同一个文件', en: 'Polishes the same file repeatedly' } };
const DETECTIVE = { id: 'detective', title: { zh: '侦探', en: 'Detective' }, description: { zh: '读得多、改得少', en: 'Reads a lot, edits little' } };
const COWBOY = { id: 'cowboy', title: { zh: '牛仔', en: 'Cowboy' }, description: { zh: '改得多、测试靠后', en: 'Edits a lot, tests late' } };
const TEST_DRIVEN = { id: 'test-driven', title: { zh: '测试驱动', en: 'Test-Driven' }, description: { zh: '测试频繁、修改克制', en: 'Tests often, edits carefully' } };
const EXPLORER = { id: 'explorer', title: { zh: '探索者', en: 'Explorer' }, description: { zh: '刚开始探索', en: 'Just getting started' } };
/** Deterministic persona from one session's behavior. Priority: first match wins. */
export function personaOf(session) {
    if (session === undefined)
        return EXPLORER;
    const reads = distinctCount(session.filesRead);
    const edits = distinctCount(session.filesEdited);
    const maxSameEdit = maxValue(session.filesEdited);
    const tests = session.tests.runs;
    const editsBeforeTest = session.editsBeforeFirstTest;
    if (maxSameEdit >= 4)
        return PERFECTIONIST;
    if (reads >= 10 && reads >= edits * 4)
        return DETECTIVE;
    if (edits >= 6 && editsBeforeTest >= 5)
        return COWBOY;
    if (tests >= 4 && edits <= tests)
        return TEST_DRIVEN;
    return EXPLORER;
}
export function raritySummaryOf(views, unlocked) {
    const out = {
        common: { unlocked: 0, total: 0 },
        uncommon: { unlocked: 0, total: 0 },
        rare: { unlocked: 0, total: 0 },
        epic: { unlocked: 0, total: 0 },
        legendary: { unlocked: 0, total: 0 },
    };
    for (const view of views) {
        out[view.rarity].total += 1;
        if (unlocked[view.id] !== undefined)
            out[view.rarity].unlocked += 1;
    }
    return out;
}
export function favoriteToolOf(profile) {
    let best = null;
    let bestCount = 0;
    for (const [name, count] of Object.entries(profile.toolsByName)) {
        if (count > bestCount) {
            best = name;
            bestCount = count;
        }
    }
    return best;
}
/** Assemble the Agent Profile from raw state + views (persona uses the latest session). */
export function buildProfileView(state, views) {
    const sessionIds = Object.keys(state.sessions);
    const lastId = sessionIds[sessionIds.length - 1];
    const recent = lastId === undefined ? undefined : state.sessions[lastId];
    return {
        level: levelOf(state.profile.xp),
        xp: state.profile.xp,
        unlockedCount: Object.keys(state.profile.unlocked).length,
        totalCount: views.length,
        rarity: raritySummaryOf(views, state.profile.unlocked),
        favoriteTool: favoriteToolOf(state.profile),
        persona: personaOf(recent),
    };
}
/** Compute one session's report; null when the session bucket is absent. */
export function buildSessionSummary(state, sessionId) {
    const session = state.sessions[sessionId];
    if (session === undefined)
        return null;
    const before = levelOf(state.profile.xp - session.xpGained).level;
    const after = levelOf(state.profile.xp).level;
    return {
        sessionId,
        turns: session.trajectoryTurns,
        steps: session.steps,
        maxStepsInTurn: session.maxStepsInTurn,
        toolCalls: session.toolCalls,
        filesRead: distinctCount(session.filesRead),
        filesEdited: distinctCount(session.filesEdited),
        tests: session.tests.runs,
        failures: session.tests.failed,
        unlocked: [...session.unlocked],
        xpGained: session.xpGained,
        levelUp: after > before ? { from: before, to: after } : null,
    };
}
function distinctCount(map) {
    return Object.keys(map).length;
}
function maxValue(map) {
    let max = 0;
    for (const value of Object.values(map))
        if (value > max)
            max = value;
    return max;
}
