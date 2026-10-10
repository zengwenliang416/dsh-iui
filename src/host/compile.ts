import type { IuiNode, IuiOp, IuiPayload, IuiProps, IuiType } from '../types/ir'
import { decideType, isLayoutType, type DecideTypeOptions } from './jev'
import { isPayloadReady } from './ready'
import { sanitizePayload } from './validate'

export type CompileOptions = DecideTypeOptions & {
  confidenceThreshold?: number
  /**
   * When true, Jev may fill missing/invalid types.
   * Default false: trust main-model type+layout; never overwrite a valid type.
   */
  jevEnabled?: boolean
  /** Main-model fallback: assign type when Jev confidence is low (only if jevEnabled). */
  mainModelFallback?: (payload: IuiPayload) => Promise<IuiType | null> | IuiType | null
}

/** Tracks keys already upserted and last props snapshot for patchProps diffs. */
export type CompileState = {
  keys: Set<string>
  propsByKey: Map<string, string>
}

export function emptyCompileState(): CompileState {
  return { keys: new Set(), propsByKey: new Map() }
}

function asCompileState(prev: Set<string> | CompileState): CompileState {
  if (prev instanceof Set) {
    return { keys: new Set(prev), propsByKey: new Map() }
  }
  return {
    keys: new Set(prev.keys),
    propsByKey: new Map(prev.propsByKey),
  }
}

const RENDERABLE = new Set<IuiType>([
  'chart',
  'form',
  'button',
  'row',
  'col',
  'text',
  'checklist',
  'stat',
  'table',
  'diagram',
  'hotspot',
])

function whitelistType(type: IuiType): IuiType | 'none' {
  if (type === 'pending') return 'none'
  if (RENDERABLE.has(type) || type === 'none') return type
  return 'none'
}

function hasConcreteType(type: IuiType | undefined): type is IuiType {
  return !!type && RENDERABLE.has(type) && type !== 'pending'
}

async function resolveType(payload: IuiPayload, opts: CompileOptions): Promise<IuiType> {
  if (isLayoutType(payload.type)) return payload.type as IuiType
  if (hasConcreteType(payload.type)) return payload.type
  if (!opts.jevEnabled) return 'none'

  const threshold = opts.confidenceThreshold ?? 0.7
  const decided = await decideType(payload, opts)

  if (decided.source === 'layout-passthrough' && isLayoutType(payload.type) && payload.type) {
    return payload.type
  }
  if (decided.confidence >= threshold && decided.choice !== 'none') {
    return decided.choice as IuiType
  }
  if (decided.choice === 'none' && decided.confidence >= threshold) return 'none'

  const fb = opts.mainModelFallback ? await opts.mainModelFallback(payload) : null
  if (fb && RENDERABLE.has(fb)) return fb
  return 'text'
}

function snapshotProps(props: IuiProps): string {
  try {
    return JSON.stringify(props)
  } catch {
    return ''
  }
}

function propsDelta(prevJson: string | undefined, next: IuiProps): IuiProps | null {
  if (!prevJson) return next
  let prev: Record<string, unknown> = {}
  try {
    prev = JSON.parse(prevJson) as Record<string, unknown>
  } catch {
    return next
  }
  const n = next as Record<string, unknown>
  const delta: Record<string, unknown> = {}
  let changed = false
  for (const k of Object.keys(n)) {
    if (JSON.stringify(prev[k]) !== JSON.stringify(n[k])) {
      delta[k] = n[k]
      changed = true
    }
  }
  return changed ? (delta as IuiProps) : null
}

async function resolveNode(
  payload: IuiPayload,
  opts: CompileOptions,
): Promise<IuiNode | null> {
  const clean = sanitizePayload(payload)
  if (!clean) return null

  const type = whitelistType(await resolveType(clean, opts))
  if (type === 'none') return null
  // Layout shells may hang before children; leaf types need ready props.
  if (!isPayloadReady(clean, type)) return null

  let children: IuiNode[] | undefined
  if (clean.children?.length) {
    const resolved = await Promise.all(clean.children.map((c) => resolveNode(c, opts)))
    children = resolved.filter((n): n is IuiNode => n !== null)
  }

  const binds = [
    ...(clean.bind ? (Array.isArray(clean.bind) ? clean.bind : [clean.bind]) : []),
    ...(clean.binds ?? []),
  ]

  return {
    key: clean.key,
    type,
    props: clean.props,
    children,
    ...(binds.length === 1
      ? { bind: binds[0] }
      : binds.length
        ? { bind: binds }
        : {}),
    ...(typeof clean.visibleWhen === 'string' && clean.visibleWhen
      ? { visibleWhen: clean.visibleWhen }
      : {}),
  }
}

function trackTree(node: IuiNode, nextKeys: Set<string>, nextProps: Map<string, string>): void {
  nextKeys.add(node.key)
  nextProps.set(node.key, snapshotProps(node.props))
  node.children?.forEach((c) => trackTree(c, nextKeys, nextProps))
}

function collectOpsForTree(
  node: IuiNode,
  state: CompileState,
  ops: IuiOp[],
  nextKeys: Set<string>,
  nextProps: Map<string, string>,
): void {
  if (!state.keys.has(node.key)) {
    // First hang: upsert full node (ready children nested when present).
    ops.push({ op: 'upsert', node })
    trackTree(node, nextKeys, nextProps)
    return
  }

  // Already hung: patch props only (preserves local client state).
  nextKeys.add(node.key)
  const snap = snapshotProps(node.props)
  nextProps.set(node.key, snap)
  const delta = propsDelta(state.propsByKey.get(node.key), node.props)
  if (delta) ops.push({ op: 'patchProps', key: node.key, props: delta })

  for (const child of node.children ?? []) {
    collectOpsForTree(child, state, ops, nextKeys, nextProps)
  }
}

/** Compile payload roots into ops. Existing keys → patchProps; new → upsert. */
export async function compilePayloadsToOps(
  payloads: IuiPayload[],
  prevKeys: Set<string> | CompileState = new Set(),
  opts: CompileOptions = {},
): Promise<{
  ops: IuiOp[]
  keys: Set<string>
  propsByKey: Map<string, string>
  state: CompileState
}> {
  const state = asCompileState(prevKeys)
  const ops: IuiOp[] = []
  const nextKeys = new Set<string>()
  const nextProps = new Map<string, string>()

  const nodes = (
    await Promise.all(payloads.map((p) => resolveNode(p, opts)))
  ).filter((n): n is IuiNode => n !== null)

  for (const node of nodes) {
    collectOpsForTree(node, state, ops, nextKeys, nextProps)
  }

  for (const k of state.keys) {
    if (!nextKeys.has(k)) ops.push({ op: 'remove', key: k })
  }

  const newState: CompileState = { keys: nextKeys, propsByKey: nextProps }
  return { ops, keys: nextKeys, propsByKey: nextProps, state: newState }
}

/** Incremental: progressive parse + upsert/patchProps. */
export async function compileStreamBuffer(
  buffer: string,
  prevKeys: Set<string> | CompileState,
  opts: CompileOptions,
  parsePayloads: (buf: string) => IuiPayload[],
): Promise<{
  ops: IuiOp[]
  keys: Set<string>
  propsByKey: Map<string, string>
  state: CompileState
}> {
  const payloads = parsePayloads(buffer)
  return compilePayloadsToOps(payloads, prevKeys, opts)
}

export { isPayloadReady } from './ready'
