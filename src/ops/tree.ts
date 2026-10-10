import type { IuiNode, IuiOp, IuiProps } from '../types/ir'

export type FlatMap = Map<string, IuiNode>

export function cloneNode(node: IuiNode): IuiNode {
  return {
    ...node,
    props: { ...node.props } as IuiProps,
    children: node.children?.map(cloneNode),
  }
}

/** Recursively drop pending/none nodes from a subtree before mounting. */
export function stripUnmountable(node: IuiNode): IuiNode | null {
  if (node.type === 'pending' || node.type === 'none') return null
  const children = node.children
    ?.map(stripUnmountable)
    .filter((n): n is IuiNode => n !== null)
  return {
    ...node,
    props: { ...node.props } as IuiProps,
    children: children?.length ? children : undefined,
  }
}

export function indexTree(roots: IuiNode[], map: FlatMap = new Map()): FlatMap {
  for (const n of roots) {
    map.set(n.key, n)
    if (n.children) indexTree(n.children, map)
  }
  return map
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === 'object' && !Array.isArray(v)
}

/**
 * Deep-merge props for patchProps / re-upsert.
 * Arrays and primitives from `patch` replace; plain objects recurse.
 * Keys only in `old` are kept.
 */
export function mergeProps(old: IuiProps, patch: IuiProps): IuiProps {
  const base = { ...(old as Record<string, unknown>) }
  const src = patch as Record<string, unknown>
  for (const [k, v] of Object.entries(src)) {
    if (v === undefined) continue
    const prev = base[k]
    if (isPlainObject(prev) && isPlainObject(v)) {
      base[k] = mergeProps(prev as IuiProps, v as IuiProps)
    } else {
      // arrays / primitives / replace objects when old isn't plain
      base[k] = Array.isArray(v) ? v.map((item) =>
        isPlainObject(item) ? { ...item } : item,
      ) : v
    }
  }
  return base as IuiProps
}

/** Merge an incoming upsert onto an existing node without wiping thinner shells. */
export function mergeUpsertNode(existing: IuiNode, incoming: IuiNode): IuiNode {
  const children =
    incoming.children !== undefined
      ? incoming.children.map(cloneNode)
      : existing.children?.map(cloneNode)

  return {
    ...existing,
    ...incoming,
    type: incoming.type,
    key: incoming.key,
    props: mergeProps(existing.props, incoming.props),
    children: children?.length ? children : undefined,
    bind: incoming.bind !== undefined ? incoming.bind : existing.bind,
    binds: incoming.binds !== undefined ? incoming.binds : existing.binds,
    visibleWhen:
      incoming.visibleWhen !== undefined ? incoming.visibleWhen : existing.visibleWhen,
  }
}

function replaceInForest(roots: IuiNode[], key: string, next: IuiNode): IuiNode[] {
  return roots.map((n) => {
    if (n.key === key) return next
    if (!n.children?.length) return n
    return { ...n, children: replaceInForest(n.children, key, next) }
  })
}

function findInForest(roots: IuiNode[], key: string): IuiNode | null {
  for (const n of roots) {
    if (n.key === key) return n
    if (n.children?.length) {
      const hit = findInForest(n.children, key)
      if (hit) return hit
    }
  }
  return null
}

function removeFromForest(roots: IuiNode[], key: string): IuiNode[] {
  const out: IuiNode[] = []
  for (const n of roots) {
    if (n.key === key) continue
    out.push(
      n.children?.length
        ? { ...n, children: removeFromForest(n.children, key) }
        : n,
    )
  }
  return out
}

function patchInForest(roots: IuiNode[], key: string, props: IuiProps): IuiNode[] {
  return roots.map((n) => {
    if (n.key === key) {
      return { ...n, props: mergeProps(n.props, props) }
    }
    if (!n.children?.length) return n
    return { ...n, children: patchInForest(n.children, key, props) }
  })
}

/** Apply a batch of ops to a forest of root nodes. Skips pending/none at apply time. */
export function applyOps(roots: IuiNode[], ops: IuiOp[]): IuiNode[] {
  let next = roots.map(cloneNode)
  for (const op of ops) {
    if (op.op === 'upsert') {
      const cleaned = stripUnmountable(op.node)
      if (!cleaned) {
        next = removeFromForest(next, op.node.key)
        continue
      }
      const existing = findInForest(next, cleaned.key)
      if (existing) {
        // Re-upsert of same key: merge props; keep children unless incoming provides them.
        const merged = mergeUpsertNode(existing, cleaned)
        next = replaceInForest(next, cleaned.key, merged)
      } else {
        next = [...next, cleaned]
      }
    } else if (op.op === 'remove') {
      next = removeFromForest(next, op.key)
    } else if (op.op === 'patchProps') {
      next = patchInForest(next, op.key, op.props)
    }
  }
  return next
}
