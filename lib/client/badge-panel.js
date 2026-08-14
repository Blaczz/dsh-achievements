import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * BadgePanel: the achievements settings page, registered into the
 * `settings.section` slot. Renders a lifetime counter summary plus the full
 * achievement grid (unlocked = colored, locked = dimmed).
 */
import { useEffect, useState } from 'react';
/** 'X 天前' / '刚刚' from an unlock epoch. */
export function elapsedLabel(unlockedAt, now = Date.now()) {
    if (unlockedAt === undefined)
        return '';
    const days = Math.floor((now - unlockedAt) / 86_400_000);
    if (days <= 0)
        return '刚刚';
    if (days === 1)
        return '1 天前';
    return `${days} 天前`;
}
const STAT_ROWS = [
    { key: 'turns', label: '回合' },
    { key: 'toolCalls', label: '工具调用' },
    { key: 'sessions', label: '会话' },
    { key: 'streakDays', label: '连续天数' },
];
/** The settings page body. */
export function BadgePanel({ achievements }) {
    const [snap, setSnap] = useState(achievements.getSnapshot());
    useEffect(() => achievements.subscribe(() => setSnap(achievements.getSnapshot())), [achievements]);
    if (snap === null) {
        return _jsx("div", { style: { padding: 12, fontSize: 13, opacity: 0.7 }, children: "\u52A0\u8F7D\u4E2D\u2026" });
    }
    const { achievements: defs, state } = snap;
    const unlockedCount = Object.keys(state.unlocked).length;
    return (_jsxs("div", { style: { maxWidth: 640, padding: '4px 0 16px' }, children: [_jsx("div", { style: { display: 'flex', gap: 10, paddingBottom: 12 }, children: STAT_ROWS.map(row => (_jsxs("div", { style: { flex: 1, textAlign: 'center', borderRadius: 10, padding: '10px 6px', background: 'rgba(128,128,128,0.08)' }, children: [_jsx("div", { style: { fontSize: 20, fontWeight: 700 }, children: state.counters[row.key] }), _jsx("div", { style: { fontSize: 11, opacity: 0.7 }, children: row.label })] }, row.key))) }), _jsxs("div", { style: { fontSize: 13, fontWeight: 700, paddingBottom: 8 }, children: ["\uD83C\uDFC6 \u6210\u5C31\uFF08", unlockedCount, "/", defs.length, "\uFF09"] }), _jsx("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }, children: defs.map(def => {
                    const unlockedAt = state.unlocked[def.id];
                    const unlocked = unlockedAt !== undefined;
                    return (_jsxs("div", { style: {
                            display: 'flex', gap: 10, alignItems: 'center', borderRadius: 10, padding: 10,
                            border: '1px solid rgba(128,128,128,0.18)',
                            background: unlocked ? 'rgba(77,107,254,0.10)' : 'transparent',
                            opacity: unlocked ? 1 : 0.55,
                        }, children: [_jsx("div", { style: { fontSize: 24, flex: 'none' }, children: unlocked ? def.icon : '🔒' }), _jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [_jsx("div", { style: { fontSize: 13, fontWeight: 600 }, children: def.title.zh }), _jsx("div", { style: { fontSize: 11, opacity: 0.7 }, children: def.description.zh })] }), unlocked && _jsx("div", { style: { fontSize: 11, flex: 'none', opacity: 0.7 }, children: elapsedLabel(unlockedAt) })] }, def.id));
                }) }), _jsx("div", { style: { fontSize: 11, opacity: 0.55, paddingTop: 12 }, children: "\u6210\u5C31\u72B6\u6001\u8DE8\u4F1A\u8BDD\u6301\u4E45\u5316\uFF0C\u4FDD\u5B58\u5728 DSH \u4E3B\u76EE\u5F55\u3002\u56DE\u5408\u3001\u5DE5\u5177\u8C03\u7528\u3001\u4F1A\u8BDD\u6570\u4E0E\u8FDE\u7EED\u5929\u6570\u81EA\u52A8\u7D2F\u8BA1\u3002" })] }));
}
