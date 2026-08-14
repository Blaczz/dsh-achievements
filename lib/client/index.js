import { HttpAchievementsClient } from "./achievements-client.js";
import { BadgePanel } from "./badge-panel.js";
import { showUnlockToast } from "./toast.js";
export { HttpAchievementsClient } from "./achievements-client.js";
/** Required services (cordis fiber inject). */
export const inject = ['slots'];
/** 'X 天前' / '刚刚' from an unlock epoch. */
function elapsedOf(ts, now = Date.now()) {
    if (ts === undefined)
        return null;
    const days = Math.floor((now - ts) / 86_400_000);
    if (days <= 0)
        return '刚刚';
    if (days === 1)
        return '1 天前';
    return `${days} 天前`;
}
/**
 * Client plugin body: one shared HTTP client, an unlock watcher that toasts
 * new achievements, the cross-plugin service, and the settings-page panel.
 * @param ctx - client cordis context.
 */
export function apply(ctx) {
    const client = new HttpAchievementsClient();
    let lastUnlocked = new Set();
    const checkUnlocks = () => {
        const snap = client.getSnapshot();
        if (snap === null || !snap.settings.enabled || !snap.settings.toastEnabled)
            return;
        const current = new Set(Object.keys(snap.state.unlocked));
        const fresh = [...current].filter(id => !lastUnlocked.has(id));
        if (fresh.length > 0) {
            for (const id of fresh) {
                const def = snap.achievements.find(achievement => achievement.id === id);
                if (def !== undefined)
                    showUnlockToast(def, elapsedOf(snap.state.unlocked[id]));
            }
        }
        lastUnlocked = current;
    };
    const refresh = () => {
        void client.refresh().then(checkUnlocks).catch(() => { });
    };
    // Poll on mount, on tab focus / visibility, and every 30s while visible.
    ctx.effect(() => {
        refresh();
        const onFocus = () => refresh();
        const onVisible = () => { if (!document.hidden)
            refresh(); };
        window.addEventListener('focus', onFocus);
        document.addEventListener('visibilitychange', onVisible);
        const timer = window.setInterval(() => { if (!document.hidden)
            refresh(); }, 30_000);
        return () => {
            window.removeEventListener('focus', onFocus);
            document.removeEventListener('visibilitychange', onVisible);
            window.clearInterval(timer);
            client.dispose();
        };
    }, 'achievements: poll');
    // Cross-plugin service.
    ctx.provide('achievements', {
        refresh,
        unlockedIds: () => [...lastUnlocked],
    });
    // Settings page badge panel.
    ctx.slots.inject('settings.section', () => ctx.slots.register({
        name: 'settings.section',
        id: 'dsh-achievements',
        order: 60,
        label: '🏆 成就',
        inject: () => ({ achievements: client }),
    }, BadgePanel));
}
