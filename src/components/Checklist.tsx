import { useEffect, useState } from 'react'
import type { ChecklistProps, IuiActionEvent } from '../types/ir'
import { loadState, saveState } from '../state/sessionStore'

type Props = {
  nodeKey: string
  sessionId: string
  props: ChecklistProps
  onAction: (ev: IuiActionEvent) => void
}

export function ChecklistView({ nodeKey, sessionId, props, onAction }: Props) {
  const items = props.items ?? []
  const saved = loadState(sessionId, nodeKey)
  const initial: Record<string, boolean> = {}
  for (const it of items) {
    if (it.done != null) initial[it.id] = !!it.done
  }
  Object.assign(initial, saved?.checklistDone ?? {})

  const [doneMap, setDoneMap] = useState(initial)

  useEffect(() => {
    saveState(sessionId, nodeKey, { checklistDone: doneMap })
  }, [sessionId, nodeKey, doneMap])

  const toggle = (id: string, itemAction?: string) => {
    const nextDone = !doneMap[id]
    setDoneMap((prev) => ({ ...prev, [id]: nextDone }))
    // Default local-only: emit only when item has explicit action.
    if (itemAction) {
      onAction({
        type: 'action',
        key: nodeKey,
        action: itemAction,
        payload: { itemId: id, done: nextDone },
      })
    }
  }

  return (
    <div className="iui-card iui-checklist">
      {props.title ? <h3 className="iui-title">{props.title}</h3> : null}
      <ul className="iui-checklist-list">
        {items.map((it) => {
          const checked = !!doneMap[it.id]
          return (
            <li key={it.id} className={checked ? 'iui-checklist-item is-done' : 'iui-checklist-item'}>
              <label>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(it.id, it.action)}
                />
                <span>{it.label}</span>
              </label>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
