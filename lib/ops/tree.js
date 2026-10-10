export function cloneNode(node) {
    return {
        ...node,
        props: { ...node.props },
        children: node.children?.map(cloneNode),
    };
}
export function indexTree(roots, map = new Map()) {
    for (const n of roots) {
        map.set(n.key, n);
        if (n.children)
            indexTree(n.children, map);
    }
    return map;
}
function replaceInForest(roots, key, next) {
    return roots.map((n) => {
        if (n.key === key)
            return next;
        if (!n.children?.length)
            return n;
        return { ...n, children: replaceInForest(n.children, key, next) };
    });
}
function removeFromForest(roots, key) {
    const out = [];
    for (const n of roots) {
        if (n.key === key)
            continue;
        out.push(n.children?.length
            ? { ...n, children: removeFromForest(n.children, key) }
            : n);
    }
    return out;
}
function patchInForest(roots, key, props) {
    return roots.map((n) => {
        if (n.key === key) {
            return { ...n, props: { ...n.props, ...props } };
        }
        if (!n.children?.length)
            return n;
        return { ...n, children: patchInForest(n.children, key, props) };
    });
}
/** Apply a batch of ops to a forest of root nodes. Skips pending/none at apply time only for upserts that would hang. */
export function applyOps(roots, ops) {
    let next = roots.map(cloneNode);
    for (const op of ops) {
        if (op.op === 'upsert') {
            const node = cloneNode(op.node);
            if (node.type === 'pending' || node.type === 'none') {
                // Do not mount incomplete / non-UI blocks on the tree.
                next = removeFromForest(next, node.key);
                continue;
            }
            const exists = indexTree(next).has(node.key);
            next = exists ? replaceInForest(next, node.key, node) : [...next, node];
        }
        else if (op.op === 'remove') {
            next = removeFromForest(next, op.key);
        }
        else if (op.op === 'patchProps') {
            next = patchInForest(next, op.key, op.props);
        }
    }
    return next;
}
