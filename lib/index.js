import z from '@deepseek-ai/schemastery';
import { settingsNamespace } from '@deepseek-ai/dsh-settings';
import { applyEvent, BUILTIN_ACHIEVEMENTS, BUILTIN_PACK, computeProgress, DEFAULT_ACHIEVEMENTS_SETTINGS, toAchievementView, } from "./achievements.js";
import { createAchievementRegistry } from "./sdk.js";
import { buildContext } from "./reducer.js";
import { loadState, saveState } from "./state.js";
import { buildToolCallEvent, buildTurnEndEvent, classifyTool, parseToolArguments, } from "./events.js";
import { ACHIEVEMENTS_API_PREFIX, ACHIEVEMENTS_EVENTS_API_PATH, ACHIEVEMENTS_STATE_API_PATH, unlockEventFrame } from "./api.js";
// Public SDK surface (pure engine + model + classifier + reducer).
export { applyEvent, BEHAVIOR_ACHIEVEMENTS, BUILTIN_ACHIEVEMENTS, COUNTER_ACHIEVEMENTS, computeProgress, countersOf, fromCounterCondition, toAchievementView, DEFAULT_ACHIEVEMENTS_SETTINGS, } from "./achievements.js";
export { createInitialProfile, createInitialSessionState, createInitialState, migrateState, MAX_SESSIONS, STATE_VERSION, touchSession, } from "./state.js";
export { buildToolCallEvent, buildTurnEndEvent, classifyTool, isDependencyPath, isTestCommand, parseToolArguments, } from "./events.js";
export { buildContext, reduceState, yesterdayOf } from "./reducer.js";
export { levelOf, xpForLevel, XP_PER_LEVEL, RARITY_META } from "./gamification.js";
export { buildProfileView, buildSessionSummary, favoriteToolOf, personaOf, raritySummaryOf, } from "./profile.js";
export { buildAchievementCard, buildAgentWrapped, buildShareText, chainProgressOf, BUILTIN_CHAINS, } from "./share.js";
export { ACHIEVEMENTS_API_PREFIX, ACHIEVEMENTS_STATE_API_PATH } from "./api.js";
export { createAchievementRegistry } from "./sdk.js";
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
    // Achievement registry: built-in + third-party packs share one evaluation path.
    const registry = createAchievementRegistry();
    registry.registerPack(BUILTIN_PACK);
    ctx.provide('achievements', {
        register: registry.register,
        registerPack: registry.registerPack,
    });
    const persist = () => {
        try {
            saveState(state);
        }
        catch { /* persistence is best-effort */ }
    };
    // SSE downlink: unlock events are pushed to every connected browser client
    // (persist → broadcast order guarantees a repull sees the persisted state).
    const sseClients = new Set();
    const broadcastUnlock = (id) => {
        if (sseClients.size === 0)
            return;
        const frame = unlockEventFrame(id);
        for (const client of sseClients)
            client.write(frame);
    };
    const handleUnlocks = (newlyUnlocked) => {
        for (const def of newlyUnlocked) {
            ctx.logger.info(`[achievements] unlocked: ${def.id} (${def.title.en})`);
            broadcastUnlock(def.id);
        }
    };
    const applyAchievementEvent = (event) => {
        const result = applyEvent(state, event, registry.list(), localToday());
        state = result.state;
        persist();
        handleUnlocks(result.newlyUnlocked);
    };
    // call id → classification, so a settled `tool/result` can be correlated
    // with the `tool/call` that carried its name and arguments.
    const pendingCalls = new Map();
    ctx.on('session/event', (session, event) => {
        if (!settings.get().enabled)
            return;
        const sessionId = String(session.id);
        if (event.type === 'turn/end') {
            applyAchievementEvent(buildTurnEndEvent(sessionId, event.seq));
        }
        else if (event.type === 'tool/call') {
            const summary = classifyTool(event.data.name, parseToolArguments(event.data.arguments));
            pendingCalls.set(String(event.data.callId), summary);
        }
        else if (event.type === 'tool/result') {
            const callId = String(event.data.message.source.callId);
            // Fall back to a generic classification if the call was never observed
            // (e.g. a resumed seed) so an unknown tool is still a safe tool-call.
            const summary = pendingCalls.get(callId) ?? { kind: 'other', name: '' };
            const block = event.data.message.content[0];
            const isError = event.data.error !== undefined || block?.isError === true;
            applyAchievementEvent(buildToolCallEvent(sessionId, event.seq, callId, summary, isError));
        }
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
            // Progress is evaluated against the most recently touched session so the
            // badge wall can render session-scoped progress too (lifetime rules read
            // the global profile regardless of the session key).
            const sessionIds = Object.keys(state.sessions);
            const defs = registry.list();
            const progress = computeProgress(defs, buildContext(state, sessionIds[sessionIds.length - 1] ?? ''));
            res.end(JSON.stringify({
                settings: settings.get(),
                achievements: defs.map(toAchievementView),
                state,
                progress,
            }));
        },
    }), 'achievements: state API');
    // Real-time unlock push (SSE). Polling stays as the fallback path; this is
    // the primary, immediate notification channel.
    ctx.effect(() => {
        const dispose = ctx.webServer.register({
            kind: 'exact',
            path: ACHIEVEMENTS_EVENTS_API_PATH,
            handler: (req, res) => {
                if (!isLoopbackRequest(req)) {
                    res.statusCode = 403;
                    res.setHeader('content-type', 'application/json; charset=utf-8');
                    res.end(JSON.stringify({ error: 'forbidden' }));
                    return;
                }
                res.writeHead(200, {
                    'content-type': 'text/event-stream; charset=utf-8',
                    'cache-control': 'no-cache, no-transform',
                    'connection': 'keep-alive',
                });
                res.write('retry: 5000\n\n');
                sseClients.add(res);
                req.on('close', () => sseClients.delete(res));
            },
        });
        return () => {
            dispose();
            for (const client of sseClients)
                client.end();
            sseClients.clear();
        };
    }, 'achievements: unlock SSE');
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
