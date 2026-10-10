import { useEffect, useState } from 'react'
import type { FormField, FormProps, IuiActionEvent } from '../types/ir'
import { loadState, saveState } from '../state/sessionStore'

type Props = {
  nodeKey: string
  sessionId: string
  props: FormProps
  onAction: (ev: IuiActionEvent) => void
  /** Notify parent of local formValues so forest can apply binds. */
  onLocalValues?: (formKey: string, values: Record<string, string | number>) => void
}

export function fieldKey(f: FormField): string {
  return f.id ?? f.name ?? ''
}

export function fieldKind(f: FormField): NonNullable<FormField['kind']> {
  return (f.kind ?? f.type ?? 'text') as NonNullable<FormField['kind']>
}

function buildInitial(
  props: FormProps,
  sessionId: string,
  nodeKey: string,
): Record<string, string | number> {
  const initial: Record<string, string | number> = { ...(props.values ?? {}) }
  for (const f of props.fields ?? []) {
    const k = fieldKey(f)
    if (!k) continue
    if (fieldKind(f) === 'slider' && f.value != null && initial[k] == null) {
      initial[k] = f.value
    }
  }
  const saved = loadState(sessionId, nodeKey)
  Object.assign(initial, saved?.formValues ?? {})
  return initial
}

export function FormView({ nodeKey, sessionId, props, onAction, onLocalValues }: Props) {
  const [values, setValues] = useState(() => buildInitial(props, sessionId, nodeKey))

  useEffect(() => {
    saveState(sessionId, nodeKey, { formValues: values })
  }, [sessionId, nodeKey, values])

  useEffect(() => {
    onLocalValues?.(nodeKey, values)
  }, [nodeKey, values, onLocalValues])

  // Progressive patch may add fields; merge defaults for new keys without wiping saved values.
  useEffect(() => {
    setValues((prev) => {
      let changed = false
      const next = { ...prev }
      for (const f of props.fields ?? []) {
        const k = fieldKey(f)
        if (!k || next[k] != null) continue
        if (fieldKind(f) === 'slider' && f.value != null) {
          next[k] = f.value
          changed = true
        }
      }
      const saved = loadState(sessionId, nodeKey)
      if (saved?.formValues) {
        for (const [k, v] of Object.entries(saved.formValues)) {
          if (next[k] == null && v != null) {
            next[k] = v
            changed = true
          }
        }
      }
      return changed ? next : prev
    })
  }, [sessionId, nodeKey, props.fields])

  const showSubmit = props.submitAction != null || props.submitLabel != null

  const setField = (key: string, val: string | number) => {
    setValues((v) => ({ ...v, [key]: val }))
  }

  return (
    <form
      className="iui-card iui-form"
      onSubmit={(e) => {
        e.preventDefault()
        if (!showSubmit) return
        onAction({
          type: 'action',
          key: nodeKey,
          action: props.submitAction ?? 'submit',
          payload: { values },
        })
      }}
    >
      {(props.fields ?? []).map((f) => {
        const key = fieldKey(f)
        if (!key) return null
        const kind = fieldKind(f)
        const id = `${nodeKey}-${key}`

        if (kind === 'slider') {
          const min = f.min ?? 0
          const max = f.max ?? 100
          const step = f.step ?? 1
          const raw = values[key]
          const num =
            typeof raw === 'number'
              ? raw
              : Number(raw ?? f.value ?? min)
          const safe = Number.isFinite(num) ? num : min
          return (
            <div className="iui-field iui-field-slider" key={key}>
              <div className="iui-slider-head">
                <label htmlFor={id}>{f.label ?? key}</label>
                <span className="iui-slider-value">{safe}</span>
              </div>
              <input
                id={id}
                type="range"
                min={min}
                max={max}
                step={step}
                value={safe}
                onChange={(e) => setField(key, Number(e.target.value))}
              />
              <div className="iui-slider-range">
                <span>{min}</span>
                <span>{max}</span>
              </div>
            </div>
          )
        }

        return (
          <div className="iui-field" key={key}>
            <label htmlFor={id}>{f.label ?? key}</label>
            {kind === 'select' ? (
              <select
                id={id}
                value={String(values[key] ?? '')}
                onChange={(e) => setField(key, e.target.value)}
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
                id={id}
                type={kind === 'number' ? 'number' : 'text'}
                placeholder={f.placeholder}
                value={values[key] ?? ''}
                onChange={(e) =>
                  setField(
                    key,
                    kind === 'number' ? Number(e.target.value) : e.target.value,
                  )
                }
              />
            )}
          </div>
        )
      })}
      {showSubmit ? (
        <button className="iui-btn" type="submit">
          {props.submitLabel ?? '提交'}
        </button>
      ) : null}
    </form>
  )
}
