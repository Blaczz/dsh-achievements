export function createAchievementRegistry() {
    const defs = [];
    const byId = new Map();
    const register = (def) => {
        if (byId.has(def.id)) {
            throw new Error(`[achievements] duplicate achievement id: ${JSON.stringify(def.id)}`);
        }
        byId.set(def.id, def);
        defs.push(def);
    };
    const registerPack = (pack) => {
        for (const def of pack.achievements)
            register(def);
    };
    return {
        register,
        registerPack,
        list: () => defs,
    };
}
