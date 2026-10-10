import type { IuiPayload, IuiType } from '../types/ir'
import { fieldKey, fieldKind, isSafeDiagramSrc } from './validate'

function propsOf(p: IuiPayload): Record<string, unknown> {
  return (p.props ?? {}) as Record<string, unknown>
}

function nonEmptyString(v: unknown): boolean {
  return typeof v === 'string' && v.trim().length > 0
}

/** True when a payload has the minimum props to allow first upsert. */
export function isPayloadReady(payload: IuiPayload, type: IuiType): boolean {
  if (!payload?.key || typeof payload.key !== 'string') return false
  const props = propsOf(payload)

  switch (type) {
    case 'row':
    case 'col':
      return true
    case 'text':
      return (
        nonEmptyString(props.content) ||
        nonEmptyString(props.text) ||
        nonEmptyString(props.value)
      )
    case 'button':
      return nonEmptyString(props.label)
    case 'chart': {
      const series = props.series
      return Array.isArray(series) && series.length > 0
    }
    case 'form': {
      const fields = props.fields
      if (!Array.isArray(fields) || fields.length === 0) return false
      // Architect: id (+ type when present). Shell may hang once each field has an id/name.
      return fields.every((f) => {
        if (!f || typeof f !== 'object') return false
        return !!fieldKey(f as never)
      })
    }
    case 'checklist': {
      const items = props.items
      if (!Array.isArray(items) || items.length === 0) return false
      return items.every(
        (it) =>
          it &&
          typeof it === 'object' &&
          typeof (it as { id?: unknown }).id === 'string' &&
          typeof (it as { label?: unknown }).label === 'string',
      )
    }
    case 'stat': {
      if (Array.isArray(props.items) && props.items.length > 0) {
        return props.items.every(
          (it) =>
            it &&
            typeof it === 'object' &&
            nonEmptyString((it as { label?: unknown }).label) &&
            (it as { value?: unknown }).value !== undefined &&
            (it as { value?: unknown }).value !== null,
        )
      }
      return nonEmptyString(props.label) && props.value !== undefined && props.value !== null
    }
    case 'table':
      return Array.isArray(props.columns) && Array.isArray(props.rows)
    case 'diagram': {
      if (props.src != null) return isSafeDiagramSrc(props.src)
      const regions = props.regions
      if (!Array.isArray(regions) || regions.length === 0) return false
      return regions.every(
        (r) =>
          r &&
          typeof r === 'object' &&
          typeof (r as { id?: unknown }).id === 'string' &&
          typeof (r as { label?: unknown }).label === 'string',
      )
    }
    case 'hotspot':
      return nonEmptyString(props.id) && nonEmptyString(props.label)
    default:
      return false
  }
}
