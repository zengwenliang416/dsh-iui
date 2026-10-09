import type { IuiOp } from '../types/ir'

/** Durable session event payloads for dsh-iui (host → client over session log). */
export type DshIuiOpsEventData = {
  sessionKey: string
  turn?: number
  step?: number
  ops: IuiOp[]
  /** Assistant message id that produced this batch, when known. */
  sourceMessageId?: string
}

export type DshIuiActionEventData = {
  sessionKey: string
  key: string
  action: string
  payload?: Record<string, unknown>
}

export const DSH_IUI_OPS_EVENT = 'dsh-iui/ops' as const
export const DSH_IUI_ACTION_EVENT = 'dsh-iui/action' as const
