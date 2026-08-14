import z from '@deepseek-ai/schemastery';
import { settingsNamespace } from '@deepseek-ai/dsh-settings';
import { applyEvent, BUILTIN_ACHIEVEMENTS, createInitialState, DEFAULT_ACHIEVEMENTS_SETTINGS, toAchievementView, } from "./achievements.js";
import { loadState, saveState } from "./state.js";
import { ACHIEVEMENTS_API_PREFIX, ACHIEVEMENTS_STATE_API_PATH } from "./api.js";
export { BUILTIN_ACHIEVEMENTS, createInitialState, } from "./achievements.js";
export { ACHIEVEMENTS_API_PREFIX, ACHIEVEMENTS_STATE_API_PATH } from "./api.js";
export const name = 'achievements';
export const inject = ['settings', 'webServer'];
const SettingsSchema = z.object({
    enabled: z.boolean().default(DEFAULT_ACHIEVEMENTS_SETTINGS.enabled),
    toastEnabled: z.boolean().default(DEFAULT_ACHIEVEMENTS_SETTINGS.toastEnabled),
});
/** Local calendar day as 'YYYY-MM-DD' (streak arithmetic uses local time). */
export function localToday(now = new Date()) {
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
export function apply(ctx) {
    const settings = ctx.settings.register(settingsNamespace('achievements'), SettingsSchema);
    let state = loadState();
    const persist = () => {
        try {
            saveState(state);
        }
        catch { /* persistence is best-effort */ }
    };
    const handleUnlocks = (newlyUnlocked) => {
        for (const def of newlyUnlocked) {
            ctx.logger.info(`[achievements] unlocked: ${def.id} (${def.title.en})`);
        }
    };
    // Count every completed turn (also drives the streak + session counters).
    ctx.on('session/event', (session, event) => {
        if (event.type !== 'turn/end')
            return;
        if (!settings.get().enabled)
            return;
        const result = applyEvent(state, { kind: 'turn-end', sessionId: String(session.id) }, BUILTIN_ACHIEVEMENTS, localToday());
        state = result.state;
        persist();
        handleUnlocks(result.newlyUnlocked);
    });
    // Count every tool call completion.
    ctx.on('tools/result', () => {
        if (!settings.get().enabled)
            return;
        const result = applyEvent(state, { kind: 'tool-call' }, BUILTIN_ACHIEVEMENTS, localToday());
        state = result.state;
        persist();
        handleUnlocks(result.newlyUnlocked);
    });
    // Read-only HTTP API for the browser half (loopback-only).
    ctx.effect(() => ctx.webServer.register({
        kind: 'prefix',
        path: ACHIEVEMENTS_API_PREFIX,
        handler: async (req, res) => {
            const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
            if (pathname !== ACHIEVEMENTS_STATE_API_PATH) {
                res.statusCode = 404;
                res.setHeader('content-type', 'application/json; charset=utf-8');
                res.end(JSON.stringify({ error: 'not-found' }));
                return;
            }
            if (!isLoopbackRequest(req)) {
                res.statusCode = 403;
                res.setHeader('content-type', 'application/json; charset=utf-8');
                res.end(JSON.stringify({ error: 'forbidden' }));
                return;
            }
            res.statusCode = 200;
            res.setHeader('content-type', 'application/json; charset=utf-8');
            res.setHeader('cache-control', 'no-store');
            res.end(JSON.stringify({
                settings: settings.get(),
                achievements: BUILTIN_ACHIEVEMENTS.map(toAchievementView),
                state,
            }));
        },
    }), 'achievements: state API');
}
function isLoopbackRequest(req) {
    const authority = req.headers.host;
    if (authority === undefined)
        return false;
    let hostname;
    try {
        hostname = new URL(`http://${authority}`).hostname;
    }
    catch {
        return false;
    }
    hostname = hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname.toLowerCase();
    if (hostname !== 'localhost' && hostname !== '::1' && !/^127(?:\.[0-9]{1,3}){3}$/.test(hostname))
        return false;
    const site = req.headers['sec-fetch-site'];
    if (typeof site === 'string' && site !== 'same-origin' && site !== 'none')
        return false;
    return true;
}
