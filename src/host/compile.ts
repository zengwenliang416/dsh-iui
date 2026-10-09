import type { IuiNode, IuiOp, IuiPayload, IuiType } from '../types/ir'
import { decideType, isLayoutType, type DecideTypeOptions } from './jev'

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

const RENDERABLE = new Set<IuiType>(['chart', 'form', 'button', 'row', 'col', 'text', 'checklist', 'stat', 'table'])

function whitelistType(type: IuiType): IuiType | 'none' {
  if (type === 'pending') return 'none'
  if (RENDERABLE.has(type) || type === 'none') return type
  return 'none'
}

function hasConcreteType(type: IuiType | undefined): type is IuiType {
  return !!type && RENDERABLE.has(type) && type !== 'pending'
}

async function resolveType(payload: IuiPayload, opts: CompileOptions): Promise<IuiType> {
  // Layout: main model owns type; never Jev.
  if (isLayoutType(payload.type)) return payload.type as IuiType

  // Valid concrete type from main model — never overwrite.
  if (hasConcreteType(payload.type)) {
    return payload.type
  }

  // Missing / pending / unknown: only Jev when explicitly enabled.
  if (!opts.jevEnabled) {
    return 'none'
  }

  const threshold = opts.confidenceThreshold ?? 0.7
  const decided = await decideType(payload, opts)

  if (decided.source === 'layout-passthrough' && isLayoutType(payload.type) && payload.type) {
    return payload.type
  }

  if (decided.confidence >= threshold && decided.choice !== 'none') {
    return decided.choice as IuiType
  }

  if (decided.choice === 'none' && decided.confidence >= threshold) {
    return 'none'
  }

  // Low confidence → main-model fallback once.
  const fb = opts.mainModelFallback ? await opts.mainModelFallback(payload) : null
  if (fb && RENDERABLE.has(fb)) return fb

  // Still low / failed → degrade to plain text (non-blocking) when Jev path is on.
  return 'text'
}

async function resolveNode(payload: IuiPayload, opts: CompileOptions): Promise<IuiNode | null> {
  const type = whitelistType(await resolveType(payload, opts))
  if (type === 'none') return null

  let children: IuiNode[] | undefined
  if (payload.children?.length) {
    const resolved = await Promise.all(payload.children.map((c) => resolveNode(c, opts)))
    children = resolved.filter((n): n is IuiNode => n !== null)
  }

  return {
    key: payload.key,
    type,
    props: payload.props,
    children,
  }
}

/** Compile payload roots into ops. Jev only when opts.jevEnabled. */
export async function compilePayloadsToOps(
  payloads: IuiPayload[],
  prevKeys: Set<string> = new Set(),
  opts: CompileOptions = {},
): Promise<{ ops: IuiOp[]; keys: Set<string> }> {
  const nodes = (
    await Promise.all(payloads.map((p) => resolveNode(p, opts)))
  ).filter((n): n is IuiNode => n !== null)

  const nextKeys = new Set<string>()
  const walk = (n: IuiNode) => {
    nextKeys.add(n.key)
    n.children?.forEach(walk)
  }
  nodes.forEach(walk)

  const ops: IuiOp[] = nodes.map((node) => ({ op: 'upsert' as const, node }))

  for (const k of prevKeys) {
    if (!nextKeys.has(k)) ops.push({ op: 'remove', key: k })
  }

  return { ops, keys: nextKeys }
}

/** Incremental: given streaming buffer + previous key set, emit new ops batch. */
export async function compileStreamBuffer(
  buffer: string,
  prevKeys: Set<string>,
  opts: CompileOptions,
  parseStreamingPayloads: (buf: string) => IuiPayload[],
): Promise<{ ops: IuiOp[]; keys: Set<string> }> {
  const payloads = parseStreamingPayloads(buffer)
  return compilePayloadsToOps(payloads, prevKeys, opts)
}
