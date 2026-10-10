import type { BindSpec, DiagramProps, DiagramRegion, FormField, HotspotProps, IuiPayload, IuiProps } from '../types/ir'

const PROP_PATH = /^[a-zA-Z_][\w.]*$/
/** Only a * $from + b (optional spaces, optional a/b). */
const LINEAR_EXPR = /^\s*(-?\d+(?:\.\d+)?)\s*\*\s*\$from\s*([+-]\s*\d+(?:\.\d+)?)?\s*$/
const LINEAR_FROM_FIRST = /^\s*\$from\s*\*\s*(-?\d+(?:\.\d+)?)\s*([+-]\s*\d+(?:\.\d+)?)?\s*$/
const LINEAR_FROM_ONLY = /^\s*\$from\s*([+-]\s*\d+(?:\.\d+)?)?\s*$/

export function fieldKey(f: FormField): string | null {
  const k = f.id ?? f.name
  return typeof k === 'string' && k.length > 0 ? k : null
}

export function fieldKind(f: FormField): FormField['kind'] | undefined {
  return f.kind ?? f.type
}

/** Normalize + validate a slider field; returns null if invalid. */
export function sanitizeSliderField(raw: FormField): FormField | null {
  const kind = fieldKind(raw)
  if (kind !== 'slider') return raw
  const id = fieldKey(raw)
  if (!id) return null
  const min = Number(raw.min)
  const max = Number(raw.max)
  if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) return null
  const step = raw.step == null ? 1 : Number(raw.step)
  if (!Number.isFinite(step) || step <= 0) return null
  let value = raw.value == null ? min : Number(raw.value)
  if (!Number.isFinite(value)) value = min
  value = Math.min(max, Math.max(min, value))
  return {
    ...raw,
    id,
    name: raw.name ?? id,
    kind: 'slider',
    type: 'slider',
    min,
    max,
    step,
    value,
    local: raw.local !== false,
  }
}

export function sanitizeFormFields(fields: unknown): FormField[] {
  if (!Array.isArray(fields)) return []
  const out: FormField[] = []
  for (const f of fields) {
    if (!f || typeof f !== 'object') continue
    const field = f as FormField
    if (fieldKind(field) === 'slider') {
      const s = sanitizeSliderField(field)
      if (s) out.push(s)
      continue
    }
    const key = fieldKey(field)
    if (!key) continue
    out.push({ ...field, name: field.name ?? key, id: field.id ?? key })
  }
  return out
}

export function parseLinearBind(bind: BindSpec): { scale: number; offset: number } | null {
  if (typeof bind.from !== 'string' || !bind.from) return null
  if (typeof bind.to !== 'string' || !PROP_PATH.test(bind.to)) return null

  if (bind.expr == null || bind.expr === '') {
    const scale = bind.scale == null ? 1 : Number(bind.scale)
    const offset = bind.offset == null ? 0 : Number(bind.offset)
    if (!Number.isFinite(scale) || !Number.isFinite(offset)) return null
    return { scale, offset }
  }

  if (typeof bind.expr !== 'string') return null
  // Reject anything that looks like JS beyond the linear template.
  if (/[;`(){}[\]]|function|=>|eval|Math|window|global/i.test(bind.expr)) return null

  let m = bind.expr.match(LINEAR_EXPR)
  if (m) {
    const scale = Number(m[1])
    const offset = m[2] ? Number(m[2].replace(/\s+/g, '')) : 0
    return Number.isFinite(scale) && Number.isFinite(offset) ? { scale, offset } : null
  }
  m = bind.expr.match(LINEAR_FROM_FIRST)
  if (m) {
    const scale = Number(m[1])
    const offset = m[2] ? Number(m[2].replace(/\s+/g, '')) : 0
    return Number.isFinite(scale) && Number.isFinite(offset) ? { scale, offset } : null
  }
  m = bind.expr.match(LINEAR_FROM_ONLY)
  if (m) {
    const offset = m[1] ? Number(m[1].replace(/\s+/g, '')) : 0
    return Number.isFinite(offset) ? { scale: 1, offset } : null
  }
  return null
}

export function sanitizeBind(raw: unknown): BindSpec | null {
  if (!raw || typeof raw !== 'object') return null
  const b = raw as BindSpec
  const parsed = parseLinearBind(b)
  if (!parsed) return null
  return {
    from: b.from,
    to: b.to,
    scale: parsed.scale,
    offset: parsed.offset,
    ...(b.expr ? { expr: b.expr } : {}),
  }
}

export function sanitizeBinds(raw: unknown): BindSpec[] | undefined {
  if (raw == null) return undefined
  const list = Array.isArray(raw) ? raw : [raw]
  const out = list.map(sanitizeBind).filter((b): b is BindSpec => b !== null)
  return out.length ? out : undefined
}

/** Apply validated linear bind: returns new value for prop path leaf. */
export function evalLinearBind(bind: BindSpec, fromValue: number): number | null {
  const parsed = parseLinearBind(bind)
  if (!parsed || !Number.isFinite(fromValue)) return null
  return parsed.scale * fromValue + parsed.offset
}


/** Allow https: URLs or same-repo relative paths only (no javascript:/data:). */
export function isSafeDiagramSrc(src: unknown): src is string {
  if (typeof src !== 'string' || !src.trim()) return false
  const s = src.trim()
  if (/^(javascript|data|blob|file|vbscript):/i.test(s)) return false
  if (/^https:\/\//i.test(s)) return true
  // relative path: no scheme, no //, no .. escape games beyond path segments
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(s)) return false
  if (s.startsWith('//')) return false
  return /^[./]?[\w./@%-]+$/.test(s)
}

export function sanitizeRegion(raw: unknown): DiagramRegion | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (typeof r.id !== 'string' || !r.id) return null
  if (typeof r.label !== 'string') return null
  const out: DiagramRegion = { id: r.id, label: r.label }
  if (typeof r.d === 'string') {
    // reject event handlers / script-like junk in path
    if (/[<>]|javascript:|on\w+=/i.test(r.d)) return null
    out.d = r.d
  }
  for (const k of ['x', 'y', 'w', 'h'] as const) {
    if (r[k] != null) {
      const n = Number(r[k])
      if (!Number.isFinite(n)) return null
      out[k] = n
    }
  }
  if (typeof r.body === 'string') out.body = r.body
  if (typeof r.action === 'string') out.action = r.action
  return out
}

export function sanitizeDiagramProps(raw: unknown): DiagramProps | null {
  if (!raw || typeof raw !== 'object') return null
  const p = raw as Record<string, unknown>
  const out: DiagramProps = { local: p.local !== false }
  if (typeof p.title === 'string') out.title = p.title
  if (p.src != null) {
    if (!isSafeDiagramSrc(p.src)) return null
    out.src = String(p.src).trim()
  }
  if (p.selectedId != null) {
    if (typeof p.selectedId !== 'string') return null
    out.selectedId = p.selectedId
  }
  if (p.regions != null) {
    if (!Array.isArray(p.regions)) return null
    const regions = p.regions.map(sanitizeRegion).filter((r): r is DiagramRegion => r !== null)
    if (!regions.length && !out.src) return null
    out.regions = regions
  } else if (!out.src) {
    return null
  }
  return out
}

export function sanitizeHotspotProps(raw: unknown): HotspotProps | null {
  if (!raw || typeof raw !== 'object') return null
  const p = raw as Record<string, unknown>
  if (typeof p.id !== 'string' || !p.id) return null
  if (typeof p.label !== 'string') return null
  const out: HotspotProps = {
    id: p.id,
    label: p.label,
    local: p.local !== false,
  }
  if (typeof p.body === 'string') out.body = p.body
  if (typeof p.visibleWhen === 'string') out.visibleWhen = p.visibleWhen
  if (typeof p.action === 'string') out.action = p.action
  return out
}

/** Sanitize form props + bind on a payload tree (compile-time whitelist). */
export function sanitizePayload(payload: IuiPayload): IuiPayload | null {
  if (!payload?.key) return null
  const props = { ...(payload.props as Record<string, unknown>) } as IuiProps
  if (payload.type === 'form') {
    const fields = sanitizeFormFields((props as { fields?: unknown }).fields)
    ;(props as { fields: FormField[] }).fields = fields
  }
  if (payload.type === 'diagram') {
    const d = sanitizeDiagramProps(props)
    if (!d) return null
    Object.assign(props as object, d)
  }
  if (payload.type === 'hotspot') {
    const h = sanitizeHotspotProps(props)
    if (!h) return null
    Object.assign(props as object, h)
  }
  const fromBind = sanitizeBinds(payload.bind)
  const fromBinds = sanitizeBinds((payload as { binds?: unknown }).binds)
  const merged = [...(fromBind ?? []), ...(fromBinds ?? [])]
  const uniq = merged.filter(
    (b, i, arr) => arr.findIndex((x) => x.from === b.from && x.to === b.to) === i,
  )
  const bind = uniq.length ? uniq : undefined
  let children = payload.children
  if (children?.length) {
    children = children.map(sanitizePayload).filter((c): c is IuiPayload => c !== null)
  }
  const { bind: _drop, binds: _db, children: _c, props: _p, ...rest } = payload as IuiPayload & {
    binds?: unknown
  }
  return {
    ...rest,
    props,
    ...(bind ? { bind: bind.length === 1 ? bind[0] : bind } : {}),
    ...(children ? { children } : {}),
  }
}
