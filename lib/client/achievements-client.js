import { ACHIEVEMENTS_STATE_API_PATH } from "../api.js";
export class HttpAchievementsClient {
    snapshot = null;
    listeners = new Set();
    abort = new AbortController();
    disposed = false;
    getSnapshot = () => this.snapshot;
    subscribe = (listener) => {
        this.listeners.add(listener);
        return () => { this.listeners.delete(listener); };
    };
    async refresh() {
        if (this.disposed)
            return;
        try {
            const response = await fetch(ACHIEVEMENTS_STATE_API_PATH, { signal: this.abort.signal });
            const body = await response.json();
            if (!response.ok)
                throw new Error(`achievements API answered ${response.status}`);
            this.snapshot = body;
            for (const listener of [...this.listeners])
                listener();
        }
        catch (error) {
            if (this.abort.signal.aborted)
                return;
            throw error;
        }
    }
    dispose() {
        this.disposed = true;
        this.abort.abort();
        this.listeners.clear();
    }
}
