import { IuiForest } from '../components/Node'
import type { HostBridge } from './plugin'
import { useIuiBridge } from './useIuiBridge'
import { ensureIuiStyles } from './ensureStyles'

/** Bind a HostBridge to the whitelist component tree. */
export function IuiMount({ bridge }: { bridge: HostBridge }) {
  ensureIuiStyles()
  const { roots, sessionId, emitAction } = useIuiBridge(bridge)
  return <IuiForest roots={roots} sessionId={sessionId} onAction={emitAction} />
}
