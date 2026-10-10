import type { BindSpec, IuiNode, IuiProps } from '../types/ir'

const PROP_PATH = /^[a-zA-Z_][\w.]*$/
/** Only a * $from + b (optional spaces, optional a/b). */
const LINEAR_EXPR = /^\s*(-?\d+(?:\.\d+)?)\s*\*\s*\$from\s*([+-]\s*\d+(?:\.\d+)?)?\s*$/
const LINEAR_FROM_FIRST = /^\s*\$from\s*\*\s*(-?\d+(?:\.\d+)?)\s*([+-]\s*\d+(?:\.\d+)?)?\s*$/
const LINEAR_FROM_ONLY = /^\s*\$from\s*([+-]\s*\d+(?:\.\d+)?)?\s*$/

/** Parse safe linear bind into scale/offset. Rejects anything beyond a*$from+b. */
export function parseLinearBind(bind: BindSpec): { scale: number; offset: number } | null {
  if (typeof bind.from !== 'string' || !bind.from) return null
  if (typeof bind.to !== 'string' || !PROP_PATH.test(bind.to)) return null

  if (bind.expr == null || bind.expr === '') {
    const scale = bind.scale == null ? 1 : Number(bind.scale)
    const offset = bind.offset == null ? 0 : Number(bind.offset)
    if (!Number.isFinite(scale) || !Number.isFinite(offset)) return null
    return { scale, offset }
  }

  if (typeof bind.expr !== 'string') return null
  if (/[;`(){}[\]]|function|=>|eval|Math|window|global/i.test(bind.expr)) return null

  let m = bind.expr.match(LINEAR_EXPR)
  if (m) {
    const scale = Number(m[1])
    const offset = m[2] ? Number(m[2].replace(/\s+/g, '')) : 0
    return Number.isFinite(scale) && Number.isFinite(offset) ? { scale, offset } : null
  }
  m = bind.expr.match(LINEAR_FROM_FIRST)
  if (m) {
    const scale = Number(m[1])
    const offset = m[2] ? Number(m[2].replace(/\s+/g, '')) : 0
    return Number.isFinite(scale) && Number.isFinite(offset) ? { scale, offset } : null
  }
  m = bind.expr.match(LINEAR_FROM_ONLY)
  if (m) {
    const offset = m[1] ? Number(m[1].replace(/\s+/g, '')) : 0
    return Number.isFinite(offset) ? { scale: 1, offset } : null
  }
  return null
}

export function evalLinearBind(bind: BindSpec, fromValue: number): number | null {
  const parsed = parseLinearBind(bind)
  if (!parsed || !Number.isFinite(fromValue)) return null
  return parsed.scale * fromValue + parsed.offset
}

function getAtPath(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.')
  let cur: unknown = obj
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[p]
  }
  return cur
}

function setAtPath(obj: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
  const parts = path.split('.')
  if (parts.length === 1) return { ...obj, [parts[0]]: value }

  const out: Record<string, unknown> = { ...obj }
  let cur: Record<string, unknown> = out
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i]
    const next = cur[p]
    if (Array.isArray(next)) {
      cur[p] = [...next]
    } else if (next && typeof next === 'object') {
      cur[p] = { ...(next as Record<string, unknown>) }
    } else {
      cur[p] = {}
    }
    cur = cur[p] as Record<string, unknown>
  }
  cur[parts[parts.length - 1]] = value
  return out
}

function collectBinds(node: IuiNode): BindSpec[] {
  const list: BindSpec[] = []
  if (node.bind) {
    if (Array.isArray(node.bind)) list.push(...node.bind)
    else list.push(node.bind)
  }
  return list
}

function roundDisplay(v: number): number {
  if (Number.isInteger(v)) return v
  return Math.round(v * 100) / 100
}

function applyBindsToNode(
  node: IuiNode,
  formValues: Record<string, string | number>,
): IuiNode {
  const binds = collectBinds(node)
  let props = { ...(node.props as Record<string, unknown>) }
  let propsChanged = false

  for (const b of binds) {
    const raw = formValues[b.from]
    const fromNum = typeof raw === 'number' ? raw : Number(raw)
    if (!Number.isFinite(fromNum)) continue
    const v = evalLinearBind(b, fromNum)
    if (v == null) continue
    const leaf = roundDisplay(v)
    const existing = getAtPath(props, b.to)
    const outVal = typeof existing === 'string' ? String(leaf) : leaf
    props = setAtPath(props, b.to, outVal)
    propsChanged = true
  }

  let children = node.children
  let kidsChanged = false
  if (node.children?.length) {
    const nextKids = node.children.map((c) => applyBindsToNode(c, formValues))
    kidsChanged = nextKids.some((c, i) => c !== node.children![i])
    if (kidsChanged) children = nextKids
  }

  if (!propsChanged && !kidsChanged) return node
  return {
    ...node,
    props: props as IuiProps,
    ...(children ? { children } : {}),
  }
}

/** Patch forest props from formValues via each node's bind (local only). */
export function applyBinds(
  roots: IuiNode[],
  formValues: Record<string, string | number>,
): IuiNode[] {
  if (!roots.length) return roots
  if (!formValues || !Object.keys(formValues).length) {
    // Still walk in case default slider values were never reported — no-op without values.
    return roots
  }
  return roots.map((n) => applyBindsToNode(n, formValues))
}
