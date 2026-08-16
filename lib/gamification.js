/** XP required to advance one level: level n needs `XP_PER_LEVEL * n` XP. */
export const XP_PER_LEVEL = 100;
/** Cumulative XP required to reach `level` (level 1 = 0 XP). */
export function xpForLevel(level) {
    return (XP_PER_LEVEL * (level - 1) * level) / 2;
}
/** Deterministic level + within-level progress for a total XP. */
export function levelOf(xp) {
    let level = 1;
    while (xpForLevel(level + 1) <= xp)
        level += 1;
    const current = xp - xpForLevel(level);
    const next = XP_PER_LEVEL * level;
    return { level, current, next, progress: Math.min(1, current / next) };
}
/** Common → legendary visual hierarchy (readable on light and dark themes). */
export const RARITY_META = {
    common: { label: { zh: '普通', en: 'Common' }, color: '#9ca3af' },
    uncommon: { label: { zh: '罕见', en: 'Uncommon' }, color: '#34d399' },
    rare: { label: { zh: '稀有', en: 'Rare' }, color: '#60a5fa' },
    epic: { label: { zh: '史诗', en: 'Epic' }, color: '#c084fc' },
    legendary: { label: { zh: '传说', en: 'Legendary' }, color: '#fbbf24' },
};
