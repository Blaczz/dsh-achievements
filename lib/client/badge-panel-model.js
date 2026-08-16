import { MILESTONE_CHAINS, SPECIAL_CHAINS, TRAJECTORY_CHAINS } from "../share.js";
/**
 * Chains that render a progress bar in the group header: the seven five-tier
 * milestone routes plus the four five-tier trajectory chains. The two-node
 * streaks and four-node behavior special chains stay count-only.
 */
const PROGRESSION_CHAIN_IDS = new Set([...MILESTONE_CHAINS, ...TRAJECTORY_CHAINS].map(chain => chain.id));
/** Whether a card is visible under the given status filter. */
export function matchesAchievementStatus(unlockedAt, filter) {
    if (filter === 'locked')
        return unlockedAt === undefined;
    if (filter === 'unlocked')
        return unlockedAt !== undefined;
    return true;
}
/** Resolve a chain's ids to views, keeping the chain's declaration order. */
function resolveDefs(ids, defs) {
    return ids
        .map(id => defs.find(def => def.id === id))
        .filter((def) => def !== undefined);
}
function completedOf(defs, unlocked) {
    return defs.reduce((n, def) => n + (unlocked[def.id] !== undefined ? 1 : 0), 0);
}
/** The seven lifetime milestone chains, one collapsible group each. */
export function buildMilestoneGroups(defs, unlocked) {
    return MILESTONE_CHAINS.map(chain => {
        const groupDefs = resolveDefs(chain.achievementIds, defs);
        return {
            id: chain.id,
            title: chain.title,
            defs: groupDefs,
            chain,
            progression: true,
            completed: completedOf(groupDefs, unlocked),
            total: groupDefs.length,
        };
    });
}
/**
 * Special achievements grouped by `SPECIAL_CHAINS`, plus one residual group
 * holding every def that belongs to neither a milestone chain nor a special
 * chain: the early `ten-turns` bonus, the remaining classic behavior
 * achievements, and any third-party pack achievements.
 */
export function buildSpecialGroups(defs, unlocked) {
    const milestoneIds = new Set(MILESTONE_CHAINS.flatMap(chain => chain.achievementIds));
    const specialChainIds = new Set(SPECIAL_CHAINS.flatMap(chain => chain.achievementIds));
    const residualDefs = defs.filter(def => !milestoneIds.has(def.id) && !specialChainIds.has(def.id));
    const groups = SPECIAL_CHAINS.map(chain => {
        const groupDefs = resolveDefs(chain.achievementIds, defs);
        return {
            id: chain.id,
            title: chain.title,
            defs: groupDefs,
            chain,
            progression: PROGRESSION_CHAIN_IDS.has(chain.id),
            completed: completedOf(groupDefs, unlocked),
            total: groupDefs.length,
        };
    });
    if (residualDefs.length > 0) {
        groups.unshift({
            id: 'residual-special',
            title: { zh: '其它 / 经典行为', en: 'Other / Classic' },
            defs: residualDefs,
            chain: null,
            progression: false,
            completed: completedOf(residualDefs, unlocked),
            total: residualDefs.length,
        });
    }
    return groups;
}
