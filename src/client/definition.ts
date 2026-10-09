import { applyOps } from '../ops/tree'
import type { IuiNode, IuiOp } from '../types/ir'
import { DSH_IUI_OPS_EVENT, type DshIuiOpsEventData } from './events'

export const IUI_CHAT_KIND = 'dsh-iui' as const

export type IuiChatState = {
  sessionKey: string
  roots: IuiNode[]
  lastOps: IuiOp[]
  sourceMessageId?: string
}

type SessionEventLike = {
  type: string
  seq?: number
  data?: DshIuiOpsEventData
}

function opsData(event: SessionEventLike): DshIuiOpsEventData | null {
  if (event.type !== DSH_IUI_OPS_EVENT) return null
  const data = event.data
  if (!data || !Array.isArray(data.ops)) return null
  return data
}

function identityOf(event: SessionEventLike, data: DshIuiOpsEventData): string {
  return (
    data.sourceMessageId ??
    `${data.sessionKey}:${data.turn ?? 't'}:${data.step ?? 's'}:${event.seq ?? 0}`
  )
}

/**
 * Conversation node definition: match durable `dsh-iui/ops` session events.
 * Registered via `ctx.uiConversation.events.register` (conversationEvents).
 */
export const iuiDefinition = {
  kind: IUI_CHAT_KIND,
  target: 'chat',
  match(event: SessionEventLike) {
    const data = opsData(event)
    if (!data) return null
    return {
      id: identityOf(event, data),
      role: 'start' as const,
    }
  },
  start(_context: unknown, match: { event: SessionEventLike }): IuiChatState {
    const data = opsData(match.event)!
    return {
      sessionKey: data.sessionKey,
      roots: applyOps([], data.ops),
      lastOps: data.ops,
      sourceMessageId: data.sourceMessageId,
    }
  },
  update(
    context: { state: IuiChatState },
    match: { event: SessionEventLike },
  ): IuiChatState {
    const data = opsData(match.event)
    if (!data) return context.state
    return {
      sessionKey: data.sessionKey,
      roots: applyOps(context.state.roots, data.ops),
      lastOps: data.ops,
      sourceMessageId: data.sourceMessageId ?? context.state.sourceMessageId,
    }
  },
  buildViewNode(context: {
    key: string
    id: string
    state: IuiChatState
    start?: { event: SessionEventLike; location?: unknown }
    matches: Array<{ event: SessionEventLike; location?: unknown }>
  }) {
    const start = context.start ?? context.matches[0]
    if (!context.state?.roots?.length || !start) return null
    return {
      key: context.key,
      kind: IUI_CHAT_KIND,
      id: context.id,
      target: 'chat',
      anchorSeq: start.event.seq ?? 0,
      location: start.location,
      visibility: 'visible',
      data: context.state,
    }
  },
}
