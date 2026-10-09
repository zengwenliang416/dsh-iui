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

function replaceInForest(roots: IuiNode[], key: string, next: IuiNode): IuiNode[] {
  return roots.map((n) => {
    if (n.key === key) return next
    if (!n.children?.length) return n
    return { ...n, children: replaceInForest(n.children, key, next) }
  })
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
      return { ...n, props: { ...n.props, ...props } as IuiProps }
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
      const node = cleaned
      const exists = indexTree(next).has(node.key)
      next = exists ? replaceInForest(next, node.key, node) : [...next, node]
    } else if (op.op === 'remove') {
      next = removeFromForest(next, op.key)
    } else if (op.op === 'patchProps') {
      next = patchInForest(next, op.key, op.props)
    }
  }
  return next
}
