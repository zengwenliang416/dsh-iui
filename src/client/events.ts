import type { IuiOp } from '../types/ir'

export const DSH_IUI_OPS_EVENT = 'dsh-iui/ops' as const
export const DSH_IUI_ACTION_EVENT = 'dsh-iui/action' as const

export type DshIuiOpsEventData = {
  sessionKey: string
  turn?: number
  step?: number
  ops: IuiOp[]
  sourceMessageId?: string
}

export type DshIuiActionEventData = {
  sessionKey: string
  key: string
  action: string
  payload?: Record<string, unknown>
}
