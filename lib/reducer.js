import { createInitialSessionState, touchSession, } from "./state.js";
/** 'YYYY-MM-DD' one calendar day before `day` (UTC arithmetic, deterministic). */
export function yesterdayOf(day) {
    const [year, month, date] = day.split('-').map(Number);
    const value = new Date(Date.UTC(year, month - 1, date - 1));
    return value.toISOString().slice(0, 10);
}
/** Build the evaluation context for one session (missing bucket → empty session). */
export function buildContext(state, sessionId) {
    return {
        profile: state.profile,
        session: state.sessions[sessionId] ?? createInitialSessionState(),
    };
}
export function reduceState(state, event, today) {
    return event.kind === 'turn-end' ? reduceTurnEnd(state, event, today) : reduceToolCall(state, event);
}
function reduceTurnEnd(state, event, today) {
    const profile = { ...state.profile };
    profile.turns += 1;
    // activeDays must be decided against the PREVIOUS day before lastActiveDay
    // is rewritten, otherwise every turn looks like "same day".
    if (profile.lastActiveDay === null || profile.lastActiveDay !== today) {
        profile.activeDays += 1;
    }
    if (!profile.seenSessions.includes(event.sessionId)) {
        profile.seenSessions = [...profile.seenSessions, event.sessionId];
        profile.sessions = profile.seenSessions.length;
    }
    if (profile.lastActiveDay === null) {
        profile.currentStreak = 1;
    }
    else if (profile.lastActiveDay !== today) {
        profile.currentStreak = profile.lastActiveDay === yesterdayOf(today) ? profile.currentStreak + 1 : 1;
    }
    profile.lastActiveDay = today;
    profile.longestStreak = Math.max(profile.longestStreak, profile.currentStreak);
    // A turn boundary interrupts a run of consecutive reads.
    let sessions = state.sessions;
    const session = sessions[event.sessionId];
    if (session !== undefined) {
        sessions = { ...sessions, [event.sessionId]: { ...session, consecutiveReads: 0 } };
    }
    return { ...state, profile, sessions };
}
function reduceToolCall(state, event) {
    const { sessionId, seq, tool } = event;
    const prev = state.sessions[sessionId] ?? createInitialSessionState();
    const next = {
        ...prev,
        toolCalls: prev.toolCalls + 1,
        toolsByName: increment(prev.toolsByName, tool.name),
    };
    // Lifetime counters are built once and incremented per kind below, so the
    // Session and Profile views of the same event stay easy to audit together.
    const profile = {
        ...state.profile,
        toolCalls: state.profile.toolCalls + 1,
        toolsByName: increment(state.profile.toolsByName, tool.name),
    };
    switch (tool.kind) {
        case 'file-read': {
            if (!event.isError) {
                profile.fileReads += 1;
                const path = tool.path ?? '';
                const isNewFile = prev.filesRead[path] === undefined;
                next.filesRead = increment(prev.filesRead, path);
                if (prev.firstReadSeq === null)
                    next.firstReadSeq = seq;
                // Distinct files read before the first edit drive Rabbit Hole.
                if (prev.firstEditSeq === null && isNewFile) {
                    next.readsBeforeFirstEdit = prev.readsBeforeFirstEdit + 1;
                }
                next.consecutiveReads = prev.consecutiveReads + 1;
            }
            else {
                next.consecutiveReads = 0;
            }
            break;
        }
        case 'file-edit': {
            if (!event.isError) {
                profile.fileEdits += 1;
                const path = tool.path ?? '';
                const isNewFile = prev.filesEdited[path] === undefined;
                next.filesEdited = increment(prev.filesEdited, path);
                next.edits = prev.edits + 1;
                if (prev.firstEditSeq === null)
                    next.firstEditSeq = seq;
                // Distinct files edited before the first test drive YOLO.
                if (prev.firstTestSeq === null && isNewFile) {
                    next.editsBeforeFirstTest = prev.editsBeforeFirstTest + 1;
                }
            }
            next.consecutiveReads = 0;
            break;
        }
        case 'shell-command': {
            next.commands = increment(prev.commands, tool.command ?? '');
            next.consecutiveReads = 0;
            break;
        }
        case 'test-run': {
            profile.testRuns += 1;
            const command = tool.command ?? '';
            const passed = !event.isError;
            if (passed)
                profile.testPasses += 1;
            else
                profile.testFailures += 1;
            next.commands = increment(prev.commands, command);
            next.tests = {
                runs: prev.tests.runs + 1,
                passed: prev.tests.passed + (passed ? 1 : 0),
                failed: prev.tests.failed + (passed ? 0 : 1),
                lastOutcome: passed ? 'pass' : 'fail',
            };
            // Track the current same-command failure streak (Surely This Time).
            if (passed) {
                next.failingCommand = null;
                next.failingStreak = 0;
            }
            else if (prev.failingCommand === command) {
                next.failingStreak = prev.failingStreak + 1;
            }
            else {
                next.failingCommand = command;
                next.failingStreak = 1;
            }
            if (prev.firstTestSeq === null) {
                next.firstTestSeq = seq;
                next.firstTestOutcome = passed ? 'pass' : 'fail';
            }
            next.consecutiveReads = 0;
            break;
        }
        default: {
            next.consecutiveReads = 0;
            break;
        }
    }
    return {
        ...state,
        profile,
        sessions: touchSession(state.sessions, sessionId, next),
    };
}
function increment(map, key) {
    return { ...map, [key]: (map[key] ?? 0) + 1 };
}
