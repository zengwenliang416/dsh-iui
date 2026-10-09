import type { IuiActionEvent, SessionStateSlice } from '../types/ir'

export type SessionWritebackSink = {
  /** Append action into current session and trigger a new model turn. */
  issueActionTurn: (sessionId: string, event: IuiActionEvent) => void | Promise<void>
  /** Persist / merge host-visible session state for next-turn injection. */
  upsertState?: (sessionId: string, blockKey: string, slice: SessionStateSlice) => void
}

/** Format state for injection into the next model context. */
export function formatStateForContext(
  sessionId: string,
  state: Record<string, SessionStateSlice>,
): string {
  const lines = [`[dsh-iui session-state session="${sessionId}"]`]
  for (const [key, slice] of Object.entries(state)) {
    lines.push(`- ${key}: ${JSON.stringify(slice)}`)
  }
  lines.push('[/dsh-iui session-state]')
  return lines.join('\n')
}

export function formatActionForContext(event: IuiActionEvent): string {
  return [
    '[dsh-iui action]',
    JSON.stringify({ key: event.key, action: event.action, payload: event.payload ?? {} }),
    '[/dsh-iui action]',
  ].join('\n')
}

/** Pull host-injectable slice out of an action payload (form values / selection). */
export function sliceFromAction(event: IuiActionEvent): SessionStateSlice {
  const payload = (event.payload ?? {}) as Record<string, unknown>
  const slice: SessionStateSlice = { selected: event.action }

  const values =
    payload.values && typeof payload.values === 'object'
      ? (payload.values as Record<string, string | number>)
      : payload.formValues && typeof payload.formValues === 'object'
        ? (payload.formValues as Record<string, string | number>)
        : undefined

  if (values) slice.formValues = { ...values }

  // Keep other scalar payload fields for model context (e.g. button payload).
  for (const [k, v] of Object.entries(payload)) {
    if (k === 'values' || k === 'formValues') continue
    if (v === undefined) continue
    slice[k] = v
  }

  return slice
}

export async function handleAction(
  sessionId: string,
  event: IuiActionEvent,
  sink: SessionWritebackSink,
): Promise<void> {
  if (event.type !== 'action') return
  // Always upsert state first so agent.inject runs before the followup turn.
  sink.upsertState?.(sessionId, event.key, sliceFromAction(event))
  await sink.issueActionTurn(sessionId, event)
}
