const PREFIX = 'dsh-iui:state:';
function storageKey(sessionId, blockKey) {
    return `${PREFIX}${sessionId}:${blockKey}`;
}
export function loadState(sessionId, blockKey) {
    try {
        const raw = localStorage.getItem(storageKey(sessionId, blockKey));
        if (!raw)
            return null;
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
}
export function saveState(sessionId, blockKey, slice) {
    localStorage.setItem(storageKey(sessionId, blockKey), JSON.stringify(slice));
}
export function dumpSessionState(sessionId) {
    const out = {};
    const needle = `${PREFIX}${sessionId}:`;
    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k?.startsWith(needle))
            continue;
        const blockKey = k.slice(needle.length);
        const slice = loadState(sessionId, blockKey);
        if (slice)
            out[blockKey] = slice;
    }
    return out;
}
