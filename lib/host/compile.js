import { decideType, isLayoutType } from './jev';
const RENDERABLE = new Set(['chart', 'form', 'button', 'row', 'col', 'text']);
function whitelistType(type) {
    if (type === 'pending')
        return 'none';
    if (RENDERABLE.has(type) || type === 'none')
        return type;
    return 'none';
}
async function resolveType(payload, opts) {
    // Layout: main model owns type; never Jev.
    if (isLayoutType(payload.type))
        return payload.type;
    // Already a concrete whitelist type from a prior fallback write.
    if (payload.type && RENDERABLE.has(payload.type) && payload.type !== 'pending') {
        return payload.type;
    }
    const threshold = opts.confidenceThreshold ?? 0.7;
    const decided = await decideType(payload, opts);
    if (decided.source === 'layout-passthrough' && isLayoutType(payload.type)) {
        return payload.type;
    }
    if (decided.confidence >= threshold && decided.choice !== 'none') {
        return decided.choice;
    }
    if (decided.choice === 'none' && decided.confidence >= threshold) {
        return 'none';
    }
    // Low confidence → main-model fallback once.
    const fb = opts.mainModelFallback ? await opts.mainModelFallback(payload) : null;
    if (fb && RENDERABLE.has(fb))
        return fb;
    // Still low / failed → degrade to plain text (non-blocking).
    return 'text';
}
async function resolveNode(payload, opts) {
    const type = whitelistType(await resolveType(payload, opts));
    if (type === 'none')
        return null;
    let children;
    if (payload.children?.length) {
        const resolved = await Promise.all(payload.children.map((c) => resolveNode(c, opts)));
        children = resolved.filter((n) => n !== null);
    }
    return {
        key: payload.key,
        type,
        props: payload.props,
        children,
    };
}
/** Compile payload roots into ops. Parallel Jev per block. */
export async function compilePayloadsToOps(payloads, prevKeys = new Set(), opts = {}) {
    const nodes = (await Promise.all(payloads.map((p) => resolveNode(p, opts)))).filter((n) => n !== null);
    const nextKeys = new Set();
    const walk = (n) => {
        nextKeys.add(n.key);
        n.children?.forEach(walk);
    };
    nodes.forEach(walk);
    const ops = nodes.map((node) => ({ op: 'upsert', node }));
    for (const k of prevKeys) {
        if (!nextKeys.has(k))
            ops.push({ op: 'remove', key: k });
    }
    return { ops, keys: nextKeys };
}
/** Incremental: given streaming buffer + previous key set, emit new ops batch. */
export async function compileStreamBuffer(buffer, prevKeys, opts, parseStreamingPayloads) {
    const payloads = parseStreamingPayloads(buffer);
    return compilePayloadsToOps(payloads, prevKeys, opts);
}
