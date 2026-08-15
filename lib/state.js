/**
 * State v2: lifetime/profile state + per-session behavior state, persisted as a
 * JSON file under the DSH home directory. v1 counter state migrates losslessly.
 *
 * Layering:
 * - `profile` — cross-session lifetime facts (counters, streak, unlocks, xp).
 * - `sessions` — per-session behavior buckets, keyed by session id; never
 *   shared across sessions.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths';
export const STATE_FILE = 'achievements-state.json';
/** Schema version stamped into the persisted state. */
export const STATE_VERSION = 2;
/** Maximum retained session buckets; the oldest (first-touched) sessions are pruned beyond this. */
export const MAX_SESSIONS = 64;
export function createInitialSessionState() {
    return {
        toolCalls: 0,
        toolsByName: {},
        filesRead: {},
        filesEdited: {},
        commands: {},
        tests: { runs: 0, passed: 0, failed: 0, lastOutcome: null },
        firstEditSeq: null,
        firstTestSeq: null,
        consecutiveReads: 0,
        readsBeforeFirstEdit: 0,
        editsBeforeFirstTest: 0,
        failingCommand: null,
        failingStreak: 0,
        unlocked: [],
        xpGained: 0,
    };
}
export function createInitialProfile() {
    return {
        xp: 0,
        unlocked: {},
        turns: 0,
        toolCalls: 0,
        toolsByName: {},
        sessions: 0,
        currentStreak: 0,
        longestStreak: 0,
        lastActiveDay: null,
        seenSessions: [],
    };
}
export function createInitialState() {
    return { version: STATE_VERSION, profile: createInitialProfile(), sessions: {} };
}
/**
 * Insert or update one session bucket. Re-inserting moves it to the most-recent
 * slot (so the currently active session is never pruned), then the oldest
 * first-touched buckets beyond `MAX_SESSIONS` are dropped to bound growth.
 */
export function touchSession(sessions, sessionId, session) {
    // Delete then re-add so a re-touched session moves to the most-recent slot
    // (object spread alone would keep its original insertion position).
    const next = { ...sessions };
    delete next[sessionId];
    next[sessionId] = session;
    const keys = Object.keys(next);
    if (keys.length > MAX_SESSIONS) {
        for (const key of keys.slice(0, keys.length - MAX_SESSIONS))
            delete next[key];
    }
    return next;
}
// ---- persistence ----
export function stateFilePath() {
    return join(resolveDshHome(), STATE_FILE);
}
/** Load the state file, migrating or falling back to a fresh v2 state when absent/corrupt. */
export function loadState() {
    try {
        return migrateState(JSON.parse(readFileSync(stateFilePath(), 'utf8')));
    }
    catch {
        return createInitialState();
    }
}
/** Persist the state atomically enough for this purpose (best-effort). */
export function saveState(state) {
    const file = stateFilePath();
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(state, null, 2));
}
// ---- migration / normalization ----
/**
 * Coerce any persisted JSON into the current v2 shape:
 * - `version === 2` → normalize (forward-tolerant partial data),
 * - a v1 `{ counters, unlocked, lastActiveDay, seenSessions }` → migrate,
 * - anything else → fresh state.
 */
export function migrateState(value) {
    if (!isRecord(value))
        return createInitialState();
    if (value.version === STATE_VERSION)
        return normalizeV2(value);
    if (isRecord(value.counters))
        return migrateV1(value);
    return createInitialState();
}
function migrateV1(v1) {
    const counters = isRecord(v1.counters) ? v1.counters : {};
    const seenSessions = Array.isArray(v1.seenSessions)
        ? v1.seenSessions.filter((item) => typeof item === 'string')
        : [];
    const currentStreak = toNumber(counters.streakDays);
    return {
        version: STATE_VERSION,
        profile: {
            xp: 0,
            unlocked: toStringNumberMap(v1.unlocked),
            turns: toNumber(counters.turns),
            toolCalls: toNumber(counters.toolCalls),
            toolsByName: {},
            sessions: seenSessions.length,
            currentStreak,
            longestStreak: currentStreak,
            lastActiveDay: typeof v1.lastActiveDay === 'string' ? v1.lastActiveDay : null,
            seenSessions,
        },
        sessions: {},
    };
}
function normalizeV2(v2) {
    const profileRaw = isRecord(v2.profile) ? v2.profile : {};
    const profile = createInitialProfile();
    profile.xp = toNumber(profileRaw.xp);
    profile.unlocked = toStringNumberMap(profileRaw.unlocked);
    profile.turns = toNumber(profileRaw.turns);
    profile.toolCalls = toNumber(profileRaw.toolCalls);
    profile.toolsByName = toStringNumberMap(profileRaw.toolsByName);
    profile.sessions = toNumber(profileRaw.sessions);
    profile.currentStreak = toNumber(profileRaw.currentStreak);
    profile.longestStreak = toNumber(profileRaw.longestStreak);
    profile.lastActiveDay = typeof profileRaw.lastActiveDay === 'string' ? profileRaw.lastActiveDay : null;
    profile.seenSessions = Array.isArray(profileRaw.seenSessions)
        ? profileRaw.seenSessions.filter((item) => typeof item === 'string')
        : [];
    const sessionsRaw = isRecord(v2.sessions) ? v2.sessions : {};
    const sessions = {};
    for (const [id, raw] of Object.entries(sessionsRaw)) {
        if (isRecord(raw))
            sessions[id] = normalizeSession(raw);
    }
    const keys = Object.keys(sessions);
    for (const key of keys.slice(0, Math.max(0, keys.length - MAX_SESSIONS)))
        delete sessions[key];
    return { version: STATE_VERSION, profile, sessions };
}
function normalizeSession(raw) {
    const session = createInitialSessionState();
    session.toolCalls = toNumber(raw.toolCalls);
    session.toolsByName = toStringNumberMap(raw.toolsByName);
    session.filesRead = toStringNumberMap(raw.filesRead);
    session.filesEdited = toStringNumberMap(raw.filesEdited);
    session.commands = toStringNumberMap(raw.commands);
    const tests = isRecord(raw.tests) ? raw.tests : {};
    session.tests = {
        runs: toNumber(tests.runs),
        passed: toNumber(tests.passed),
        failed: toNumber(tests.failed),
        lastOutcome: tests.lastOutcome === 'pass' || tests.lastOutcome === 'fail' ? tests.lastOutcome : null,
    };
    session.firstEditSeq = toNullableNumber(raw.firstEditSeq);
    session.firstTestSeq = toNullableNumber(raw.firstTestSeq);
    session.consecutiveReads = toNumber(raw.consecutiveReads);
    session.readsBeforeFirstEdit = toNumber(raw.readsBeforeFirstEdit);
    session.editsBeforeFirstTest = toNumber(raw.editsBeforeFirstTest);
    session.failingCommand = typeof raw.failingCommand === 'string' ? raw.failingCommand : null;
    session.failingStreak = toNumber(raw.failingStreak);
    session.unlocked = Array.isArray(raw.unlocked)
        ? raw.unlocked.filter((item) => typeof item === 'string')
        : [];
    session.xpGained = toNumber(raw.xpGained);
    return session;
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function toNumber(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}
function toNullableNumber(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
function toStringNumberMap(value) {
    if (!isRecord(value))
        return {};
    const out = {};
    for (const [key, item] of Object.entries(value)) {
        if (typeof item === 'number' && Number.isFinite(item))
            out[key] = item;
    }
    return out;
}
