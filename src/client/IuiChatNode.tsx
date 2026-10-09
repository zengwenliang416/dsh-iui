import { useMemo } from 'react'
import { IuiForest } from '../components/Node'
import type { IuiActionEvent } from '../types/ir'
import type { IuiChatState } from './definition'
import { DSH_IUI_ACTION_EVENT } from './events'
import { ensureIuiStyles } from './ensureStyles'

type NodeProps = {
  node: {
    kind: string
    data: IuiChatState
  }
  /** Injected by slot when available */
  emitAction?: (ev: IuiActionEvent) => void
  appendSessionEvent?: (type: string, data: unknown) => void
}

/** conversation.chat.node renderer for kind `dsh-iui`. */
export function IuiChatNodeView({ node, emitAction, appendSessionEvent }: NodeProps) {
  ensureIuiStyles()
  const state = node?.data
  const roots = state?.roots ?? []
  const sessionId = state?.sessionKey ?? 'default'

  const onAction = useMemo(
    () => (ev: IuiActionEvent) => {
      emitAction?.(ev)
      appendSessionEvent?.(DSH_IUI_ACTION_EVENT, {
        sessionKey: sessionId,
        key: ev.key,
        action: ev.action,
        payload: ev.payload,
      })
    },
    [emitAction, appendSessionEvent, sessionId],
  )

  if (!roots.length) return null
  return (
    <div className="iui-chat-node" data-dsh-iui="1">
      <IuiForest roots={roots} sessionId={sessionId} onAction={onAction} />
    </div>
  )
}
