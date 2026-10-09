import { useEffect, useState } from 'react'
import type { FormProps, IuiActionEvent } from '../types/ir'
import { loadState, saveState } from '../state/sessionStore'

type Props = {
  nodeKey: string
  sessionId: string
  props: FormProps
  onAction: (ev: IuiActionEvent) => void
}

export function FormView({ nodeKey, sessionId, props, onAction }: Props) {
  const saved = loadState(sessionId, nodeKey)
  const initial = {
    ...(props.values ?? {}),
    ...(saved?.formValues ?? {}),
  } as Record<string, string | number>
  const [values, setValues] = useState(initial)

  useEffect(() => {
    saveState(sessionId, nodeKey, { formValues: values })
  }, [sessionId, nodeKey, values])

  return (
    <form
      className="iui-card iui-form"
      onSubmit={(e) => {
        e.preventDefault()
        onAction({
          type: 'action',
          key: nodeKey,
          action: props.submitAction ?? 'submit',
          payload: { values },
        })
      }}
    >
      {(props.fields ?? []).map((f) => (
        <div className="iui-field" key={f.name}>
          <label htmlFor={`${nodeKey}-${f.name}`}>{f.label ?? f.name}</label>
          {f.kind === 'select' ? (
            <select
              id={`${nodeKey}-${f.name}`}
              value={String(values[f.name] ?? '')}
              onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
            >
              <option value="">请选择</option>
              {(f.options ?? []).map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          ) : (
            <input
              id={`${nodeKey}-${f.name}`}
              type={f.kind === 'number' ? 'number' : 'text'}
              placeholder={f.placeholder}
              value={values[f.name] ?? ''}
              onChange={(e) =>
                setValues((v) => ({
                  ...v,
                  [f.name]: f.kind === 'number' ? Number(e.target.value) : e.target.value,
                }))
              }
            />
          )}
        </div>
      ))}
      <button className="iui-btn" type="submit">
        {props.submitLabel ?? '提交'}
      </button>
    </form>
  )
}
