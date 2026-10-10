const FENCE_RE = /```dsh-iui\s*\n([\s\S]*?)```/g;
/** Extract complete ```dsh-iui``` fences; incomplete trailing fence is ignored. */
export function extractCompleteFences(text) {
    const out = [];
    for (const m of text.matchAll(FENCE_RE)) {
        const body = m[1]?.trim();
        if (body)
            out.push(body);
    }
    return out;
}
function isPayload(v) {
    if (!v || typeof v !== 'object')
        return false;
    const o = v;
    return typeof o.key === 'string' && o.props !== undefined && typeof o.props === 'object';
}
/** Parse fence body into payload roots. Accepts a single node, `{blocks:[...]}`, or an array. */
export function parsePayloadRoots(body) {
    let data;
    try {
        data = JSON.parse(body);
    }
    catch {
        return [];
    }
    if (Array.isArray(data))
        return data.filter(isPayload);
    if (data && typeof data === 'object' && Array.isArray(data.blocks)) {
        return (data.blocks).filter(isPayload);
    }
    if (isPayload(data))
        return [data];
    return [];
}
/** Streaming helper: only return roots from fully closed fences in the buffer. */
export function parseStreamingPayloads(buffer) {
    const roots = [];
    for (const body of extractCompleteFences(buffer)) {
        roots.push(...parsePayloadRoots(body));
    }
    return roots;
}
