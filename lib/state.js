/** Durable state persistence: a JSON file under the DSH home directory. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths';
import { createInitialState } from "./achievements.js";
export const STATE_FILE = 'achievements-state.json';
export function stateFilePath() {
    return join(resolveDshHome(), STATE_FILE);
}
/** Load the state file, falling back to a fresh state when absent or corrupt. */
export function loadState() {
    try {
        return normalize(JSON.parse(readFileSync(stateFilePath(), 'utf8')));
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
/** Coerce a possibly-partial/older on-disk state into the current shape. */
function normalize(value) {
    const base = createInitialState();
    return {
        counters: { ...base.counters, ...(value?.counters ?? {}) },
        unlocked: value?.unlocked ?? {},
        lastActiveDay: value?.lastActiveDay ?? null,
        seenSessions: Array.isArray(value?.seenSessions) ? value.seenSessions : [],
    };
}
