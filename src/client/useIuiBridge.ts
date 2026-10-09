import { useEffect, useState } from 'react'
import { applyOps } from '../ops/tree'
import type { IuiActionEvent, IuiNode, IuiOp } from '../types/ir'
import type { HostBridge } from './plugin'

export function useIuiBridge(bridge: HostBridge | null) {
  const [roots, setRoots] = useState<IuiNode[]>([])

  useEffect(() => {
    if (!bridge) return
    setRoots([])
    return bridge.onOps((ops: IuiOp[]) => {
      setRoots((prev) => applyOps(prev, ops))
    })
  }, [bridge])

  const emitAction = (ev: IuiActionEvent) => {
    bridge?.emitAction(ev)
  }

  return {
    roots,
    sessionId: bridge?.sessionId ?? 'default',
    emitAction,
    reset: () => setRoots([]),
  }
}
