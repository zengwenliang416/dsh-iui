import type { IuiActionEvent, IuiOp } from '../types/ir'
import type { HostBridge } from '../client/plugin'

type OpsHandler = (ops: IuiOp[]) => void

/** In-process ops/action bridge shared by host compile chain and web client. */
export function createHostBridge(sessionId: string): HostBridge & {
  pushOps: (ops: IuiOp[]) => void
  onAction: (handler: (ev: IuiActionEvent) => void) => () => void
} {
  const opsHandlers = new Set<OpsHandler>()
  const actionHandlers = new Set<(ev: IuiActionEvent) => void>()

  return {
    sessionId,
    onOps(handler) {
      opsHandlers.add(handler)
      return () => {
        opsHandlers.delete(handler)
      }
    },
    emitAction(ev) {
      for (const h of actionHandlers) h(ev)
    },
    pushOps(ops) {
      for (const h of opsHandlers) h(ops)
    },
    onAction(handler) {
      actionHandlers.add(handler)
      return () => {
        actionHandlers.delete(handler)
      }
    },
  }
}
