import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * BadgePanel: the achievements settings page, registered into the
 * `settings.section` slot. Renders the Agent Profile (level, XP, persona,
 * rarity distribution, favorite tool), the seven lifetime counters + a
 * separate streak line, a collapsible badge wall grouped by the seven
 * milestone routes and the special chains, and the latest session report.
 *
 * Task 22 keeps this a lightweight settings page: the 68 cards are collapsed
 * behind per-route `<details>` groups, a single status filter narrows the
 * visible cards, and the low-frequency Wrapped / Share blocks start closed.
 */
import { useEffect, useState } from 'react';
import { RARITY_META } from "../gamification.js";
import { buildProfileView, buildSessionSummary } from "../profile.js";
import { buildAgentWrapped, buildShareText } from "../share.js";
import { buildMilestoneGroups, buildSpecialGroups, matchesAchievementStatus, } from "./badge-panel-model.js";
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
/** Seven lifetime progression metrics; streak is shown separately. */
const STAT_ROWS = [
    { key: 'turns', label: '回合' },
    { key: 'toolCalls', label: '工具调用' },
    { key: 'sessions', label: '会话' },
    { key: 'activeDays', label: '活跃天数' },
    { key: 'fileReads', label: '读取次数' },
    { key: 'fileEdits', label: '修改次数' },
    { key: 'testRuns', label: '测试' },
];
const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
const REPORT_ROWS = [
    { key: 'turns', label: '回合' },
    { key: 'steps', label: '步骤' },
    { key: 'maxStepsInTurn', label: '最深单轮' },
    { key: 'toolCalls', label: '工具调用' },
    { key: 'filesRead', label: '读文件' },
    { key: 'filesEdited', label: '改文件' },
    { key: 'tests', label: '测试' },
    { key: 'failures', label: '失败' },
];
/** Inject the disclosure caret CSS once (no React state, no animation). */
let disclosureCssInjected = false;
function ensureDisclosureCss() {
    if (disclosureCssInjected)
        return;
    disclosureCssInjected = true;
    const style = document.createElement('style');
    style.textContent = [
        '.dsh-badge-group summary { list-style: none; }',
        '.dsh-badge-group summary::-webkit-details-marker { display: none; }',
        '.dsh-badge-group summary::marker { content: ""; }',
        ".dsh-badge-group .dsh-badge-caret::before { content: '▸'; }",
        ".dsh-badge-group[open] .dsh-badge-caret::before { content: '▾'; }",
    ].join('\n');
    document.head.appendChild(style);
}
/** Unified section shell: border, radius, padding and optional title. */
function SectionPanel({ title, children }) {
    return (_jsxs("section", { style: { borderRadius: 12, border: '1px solid rgba(128,128,128,0.18)', padding: 12, marginBottom: 12 }, children: [title !== undefined && _jsx("div", { style: { fontSize: 13, fontWeight: 700, paddingBottom: 8 }, children: title }), children] }));
}
/** One achievement card; reused across every collapsible group. */
function AchievementCard({ def, unlockedAt, progress }) {
    const unlocked = unlockedAt !== undefined;
    const rarity = RARITY_META[def.rarity];
    // Hidden + locked: leak no real content.
    if (def.hidden === true && !unlocked) {
        return (_jsxs("div", { style: { display: 'flex', gap: 10, alignItems: 'center', borderRadius: 10, padding: 10, border: '1px solid rgba(128,128,128,0.18)', opacity: 0.55 }, children: [_jsx("div", { style: { fontSize: 24, flex: 'none' }, children: "\uD83D\uDD12" }), _jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [_jsx("div", { style: { fontSize: 13, fontWeight: 600 }, children: "???" }), _jsx("div", { style: { fontSize: 11, opacity: 0.7 }, children: "\u672A\u89E3\u9501\u7684\u9690\u85CF\u6210\u5C31" })] })] }));
    }
    return (_jsxs("div", { style: {
            display: 'flex', gap: 10, alignItems: 'flex-start', borderRadius: 10, padding: 10,
            border: `1px solid ${unlocked ? rarity.color : 'rgba(128,128,128,0.18)'}`,
            background: unlocked ? `${rarity.color}1a` : 'transparent',
            opacity: unlocked ? 1 : 0.6,
        }, children: [_jsx("div", { style: { fontSize: 24, flex: 'none', lineHeight: 1.3 }, children: unlocked ? def.icon : '🔒' }), _jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [_jsxs("div", { style: { display: 'flex', gap: 6, alignItems: 'baseline', flexWrap: 'wrap' }, children: [_jsx("span", { style: { fontSize: 13, fontWeight: 600 }, children: def.title.zh }), _jsx("span", { style: { fontSize: 10, color: rarity.color, whiteSpace: 'nowrap' }, children: rarity.label.zh })] }), _jsx("div", { style: { fontSize: 11, opacity: 0.7 }, children: def.description.zh }), unlocked && def.flavorText !== undefined && (_jsx("div", { style: { fontSize: 11, opacity: 0.55, fontStyle: 'italic', paddingTop: 2 }, children: def.flavorText.zh })), !unlocked && progress?.target !== undefined && (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 8, paddingTop: 6 }, children: [_jsx("div", { style: { flex: 1, height: 5, borderRadius: 3, background: 'rgba(128,128,128,0.15)', overflow: 'hidden' }, children: _jsx("div", { style: { width: `${Math.min(100, Math.round(((progress.progress ?? 0) / progress.target) * 100))}%`, height: '100%', background: rarity.color, borderRadius: 3 } }) }), _jsxs("span", { style: { fontSize: 10, opacity: 0.7, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }, children: [progress.progress ?? 0, "/", progress.target] })] })), _jsxs("div", { style: { display: 'flex', alignItems: 'baseline', gap: 8, paddingTop: 4 }, children: [_jsxs("span", { style: { fontSize: 10, color: rarity.color, flex: 1 }, children: ["+", def.xp, " XP"] }), unlocked && _jsx("span", { style: { fontSize: 11, opacity: 0.7, flex: 'none' }, children: elapsedLabel(unlockedAt) })] })] })] }));
}
/** A collapsible route/special group: header carries title + progress, cards inside. */
function AchievementGroup({ group, unlocked, progress, filter }) {
    const visible = group.defs.filter(def => matchesAchievementStatus(unlocked[def.id], filter));
    if (visible.length === 0)
        return null;
    const done = group.completed === group.total;
    return (_jsxs("details", { className: "dsh-badge-group", style: { border: '1px solid rgba(128,128,128,0.18)', borderRadius: 10, padding: '8px 10px', marginBottom: 8 }, children: [_jsxs("summary", { style: { cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }, children: [_jsx("span", { className: "dsh-badge-caret", style: { fontSize: 11, opacity: 0.6, flex: 'none' } }), _jsx("span", { style: { flex: 1, minWidth: 0, fontSize: 12, fontWeight: 600 }, children: group.title.zh }), _jsxs("span", { style: { fontSize: 11, opacity: 0.7, flex: 'none', fontVariantNumeric: 'tabular-nums' }, children: [group.completed, "/", group.total] }), group.progression && (_jsx("div", { style: { width: 80, height: 6, borderRadius: 3, background: 'rgba(128,128,128,0.15)', overflow: 'hidden', flex: 'none' }, children: _jsx("div", { style: { width: `${group.total === 0 ? 0 : Math.round((group.completed / group.total) * 100)}%`, height: '100%', background: done ? '#34d399' : '#fbbf24', borderRadius: 3 } }) }))] }), _jsx("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(280px, 100%), 1fr))', gap: 8, paddingTop: 8 }, children: visible.map(def => (_jsx(AchievementCard, { def: def, unlockedAt: unlocked[def.id], progress: progress[def.id] }, def.id))) })] }));
}
/** The settings page body. */
export function BadgePanel({ achievements }) {
    const [snap, setSnap] = useState(achievements.getSnapshot());
    const [copied, setCopied] = useState(false);
    const [filter, setFilter] = useState('all');
    useEffect(() => achievements.subscribe(() => setSnap(achievements.getSnapshot())), [achievements]);
    useEffect(() => { ensureDisclosureCss(); }, []);
    if (snap === null) {
        return _jsx("div", { style: { padding: 12, fontSize: 13, opacity: 0.7 }, children: "\u52A0\u8F7D\u4E2D\u2026" });
    }
    const { achievements: defs, state } = snap;
    const profile = buildProfileView(state, defs);
    const sessionIds = Object.keys(state.sessions);
    const lastSessionId = sessionIds[sessionIds.length - 1];
    const summary = lastSessionId === undefined ? null : buildSessionSummary(state, lastSessionId);
    const wrapped = buildAgentWrapped(state, defs);
    const shareText = buildShareText(state, defs);
    // Groups are derived from the browser-safe chain metadata (single source of
    // truth); no achievement id is hardcoded in JSX.
    const milestoneGroups = buildMilestoneGroups(defs, state.profile.unlocked);
    const specialGroups = buildSpecialGroups(defs, state.profile.unlocked);
    const copyShare = () => {
        if (navigator.clipboard === undefined)
            return;
        void navigator.clipboard.writeText(shareText).then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
        }).catch(() => { });
    };
    return (_jsxs("div", { style: { maxWidth: 680, padding: '4px 0 16px' }, children: [_jsxs(SectionPanel, { children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 10 }, children: [_jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [_jsx("div", { style: { fontSize: 17, fontWeight: 800 }, children: profile.persona.title.zh }), _jsx("div", { style: { fontSize: 12, opacity: 0.7 }, children: profile.persona.description.zh })] }), _jsxs("div", { style: { fontSize: 22, fontWeight: 800, flex: 'none' }, children: ["Lv.", profile.level.level] })] }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 12 }, children: [_jsx("div", { style: { flex: 1, height: 8, borderRadius: 4, background: 'rgba(128,128,128,0.15)', overflow: 'hidden' }, children: _jsx("div", { style: { width: `${Math.round(profile.level.progress * 100)}%`, height: '100%', background: '#fbbf24', borderRadius: 4 } }) }), _jsxs("div", { style: { fontSize: 12, opacity: 0.7, flex: 'none' }, children: [profile.level.current, "/", profile.level.next, " XP"] })] }), _jsxs("div", { style: { display: 'flex', flexWrap: 'wrap', gap: 8, paddingBottom: 8 }, children: [_jsxs("span", { style: { fontSize: 12, opacity: 0.8 }, children: ["\u5DF2\u89E3\u9501 ", profile.unlockedCount, "/", profile.totalCount] }), profile.favoriteTool !== null && (_jsxs("span", { style: { fontSize: 12, opacity: 0.8 }, children: ["\u5E38\u7528\u5DE5\u5177 \u00B7 ", profile.favoriteTool] }))] }), _jsx("div", { style: { display: 'flex', flexWrap: 'wrap', gap: 6, paddingBottom: 12 }, children: RARITY_ORDER.map(rarity => {
                            const meta = RARITY_META[rarity];
                            const count = profile.rarity[rarity];
                            return (_jsxs("span", { style: {
                                    fontSize: 11, color: meta.color, border: `1px solid ${meta.color}`, borderRadius: 6,
                                    padding: '2px 6px', opacity: count.total === 0 ? 0.45 : 1,
                                }, children: [meta.label.zh, " ", count.unlocked, "/", count.total] }, rarity));
                        }) }), _jsx("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(78px, 1fr))', gap: 8, paddingBottom: 10 }, children: STAT_ROWS.map(row => (_jsxs("div", { style: { textAlign: 'center', borderRadius: 10, padding: '10px 6px', background: 'rgba(128,128,128,0.08)' }, children: [_jsx("div", { style: { fontSize: 20, fontWeight: 700 }, children: state.profile[row.key] }), _jsx("div", { style: { fontSize: 11, opacity: 0.7 }, children: row.label })] }, row.key))) }), _jsxs("div", { style: { fontSize: 12, opacity: 0.8 }, children: ["\uD83D\uDD25 \u5F53\u524D\u8FDE\u7EED ", state.profile.currentStreak, " \u5929 \u00B7 \u6700\u957F\u8FDE\u7EED ", state.profile.longestStreak, " \u5929"] })] }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0 8px' }, children: [_jsxs("div", { style: { fontSize: 13, fontWeight: 700, flex: 1 }, children: ["\uD83C\uDFC6 \u6210\u5C31\uFF08", profile.unlockedCount, "/", defs.length, "\uFF09"] }), _jsxs("label", { style: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, opacity: 0.7 }, children: ["\u663E\u793A", _jsxs("select", { value: filter, onChange: event => setFilter(event.target.value), style: { fontSize: 12, padding: '3px 6px', borderRadius: 6, border: '1px solid rgba(128,128,128,0.3)', background: 'transparent', color: 'inherit' }, children: [_jsx("option", { value: "all", children: "\u5168\u90E8" }), _jsx("option", { value: "locked", children: "\u672A\u89E3\u9501" }), _jsx("option", { value: "unlocked", children: "\u5DF2\u89E3\u9501" })] })] })] }), _jsx("div", { style: { fontSize: 12, fontWeight: 600, opacity: 0.75, paddingBottom: 6 }, children: "\u6210\u957F\u91CC\u7A0B\u7891" }), milestoneGroups.map(group => (_jsx(AchievementGroup, { group: group, unlocked: state.profile.unlocked, progress: snap.progress, filter: filter }, group.id))), _jsx("div", { style: { fontSize: 12, fontWeight: 600, opacity: 0.75, padding: '4px 0 6px' }, children: "\u7279\u6B8A\u884C\u4E3A" }), specialGroups.map(group => (_jsx(AchievementGroup, { group: group, unlocked: state.profile.unlocked, progress: snap.progress, filter: filter }, group.id))), _jsx(SectionPanel, { title: "\uD83D\uDCCB \u6700\u8FD1\u4F1A\u8BDD\u6218\u62A5", children: summary === null ? (_jsx("div", { style: { fontSize: 12, opacity: 0.55 }, children: "\u6682\u65E0\u4F1A\u8BDD\u6570\u636E\u3002" })) : (_jsxs("div", { children: [_jsx("div", { style: { display: 'flex', gap: 10, flexWrap: 'wrap', paddingBottom: summary.unlocked.length > 0 || summary.xpGained > 0 ? 10 : 0 }, children: REPORT_ROWS.map(row => (_jsxs("div", { style: { flex: '1 1 0', minWidth: 60, textAlign: 'center', borderRadius: 8, padding: '8px 4px', background: 'rgba(128,128,128,0.08)' }, children: [_jsx("div", { style: { fontSize: 18, fontWeight: 700 }, children: summary[row.key] }), _jsx("div", { style: { fontSize: 11, opacity: 0.7 }, children: row.label })] }, row.key))) }), summary.unlocked.length > 0 && (_jsxs("div", { style: { fontSize: 12, paddingBottom: 4 }, children: ["\u672C\u4F1A\u8BDD\u89E3\u9501\uFF1A", summary.unlocked.map(id => {
                                    const def = defs.find(d => d.id === id);
                                    return def === undefined ? null : _jsxs("span", { style: { marginRight: 8 }, children: [def.icon, " ", def.title.zh] }, id);
                                })] })), _jsxs("div", { style: { fontSize: 12, opacity: 0.8 }, children: [summary.xpGained > 0 && _jsxs("span", { style: { marginRight: 12, color: '#fbbf24' }, children: ["+", summary.xpGained, " XP"] }), summary.levelUp !== null && (_jsxs("span", { style: { fontWeight: 700, color: '#fbbf24' }, children: ["\uD83C\uDF89 \u5347\u7EA7 Lv.", summary.levelUp.from, " \u2192 Lv.", summary.levelUp.to] }))] })] })) }), _jsxs("details", { className: "dsh-badge-group", style: { border: '1px solid rgba(128,128,128,0.18)', borderRadius: 10, padding: '8px 10px', marginBottom: 8 }, children: [_jsxs("summary", { style: { cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }, children: [_jsx("span", { className: "dsh-badge-caret", style: { fontSize: 11, opacity: 0.6, flex: 'none' } }), _jsx("span", { style: { flex: 1, fontSize: 13, fontWeight: 700 }, children: "\uD83C\uDF81 Agent Wrapped" })] }), _jsxs("div", { style: { paddingTop: 8, display: 'flex', flexWrap: 'wrap', gap: 8 }, children: [_jsxs("span", { style: { fontSize: 12 }, children: [wrapped.persona.title.zh, " \u00B7 Lv.", wrapped.level.level] }), _jsxs("span", { style: { fontSize: 12, opacity: 0.7 }, children: [wrapped.turns, " \u56DE\u5408"] }), _jsxs("span", { style: { fontSize: 12, opacity: 0.7 }, children: [wrapped.toolCalls, " \u5DE5\u5177"] }), _jsxs("span", { style: { fontSize: 12, opacity: 0.7 }, children: [wrapped.sessions, " \u4F1A\u8BDD"] }), _jsxs("span", { style: { fontSize: 12, opacity: 0.7 }, children: ["\u6700\u957F\u8FDE\u51FB ", wrapped.longestStreak, " \u5929"] }), wrapped.favoriteTool !== null && _jsxs("span", { style: { fontSize: 12, opacity: 0.7 }, children: ["\u5E38\u7528 ", wrapped.favoriteTool] }), wrapped.topUnlock !== null && (_jsxs("span", { style: { fontSize: 12, opacity: 0.85 }, children: ["\uD83C\uDFC6 \u6700\u9AD8\u7A00\u6709\u6210\u5C31\uFF1A", wrapped.topUnlock.icon, " ", wrapped.topUnlock.title.zh] }))] })] }), _jsxs("details", { className: "dsh-badge-group", style: { border: '1px solid rgba(128,128,128,0.18)', borderRadius: 10, padding: '8px 10px', marginBottom: 8 }, children: [_jsxs("summary", { style: { cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }, children: [_jsx("span", { className: "dsh-badge-caret", style: { fontSize: 11, opacity: 0.6, flex: 'none' } }), _jsx("span", { style: { flex: 1, fontSize: 13, fontWeight: 700 }, children: "\uD83D\uDCE4 \u5206\u4EAB" })] }), _jsxs("div", { style: { paddingTop: 8 }, children: [_jsx("pre", { style: { margin: 0, fontSize: 11, whiteSpace: 'pre-wrap', opacity: 0.85, maxHeight: 200, overflow: 'auto' }, children: shareText }), _jsx("button", { onClick: copyShare, style: { marginTop: 8, padding: '6px 12px', fontSize: 12, borderRadius: 8, border: '1px solid rgba(128,128,128,0.3)', background: 'transparent', color: 'inherit', cursor: 'pointer' }, children: copied ? '已复制 ✓' : '复制分享文本' }), _jsx("div", { style: { fontSize: 11, opacity: 0.55, paddingTop: 8 }, children: "\u6210\u5C31\u72B6\u6001\u8DE8\u4F1A\u8BDD\u6301\u4E45\u5316\uFF0C\u4FDD\u5B58\u5728 DSH \u4E3B\u76EE\u5F55\u3002\u5206\u4EAB\u5185\u5BB9\u4EC5\u542B\u6210\u5C31\u3001\u7B49\u7EA7\u4E0E\u8BA1\u6570\uFF0C\u4E0D\u542B\u6587\u4EF6\u8DEF\u5F84\u6216\u547D\u4EE4\u3002" })] })] })] }));
}
