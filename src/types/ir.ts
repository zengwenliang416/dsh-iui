/** Locked IR / ops protocol for dsh-iui (frontend + backend shared). */

export type IuiType =
  | 'chart'
  | 'form'
  | 'button'
  | 'row'
  | 'col'
  | 'text'
  | 'checklist'
  | 'stat'
  | 'table'
  | 'diagram'
  | 'hotspot'
  | 'pending'
  | 'none'

export type ChartProps = {
  title?: string
  series: Array<{ name?: string; points: Array<{ x: string | number; y: number }> }>
}

export type FormField = {
  /** Stable id; models may use `id` instead of `name` for slider fields. */
  name?: string
  id?: string
  label?: string
  /** Prefer `kind`; `type: "slider"` is accepted as an alias from the model. */
  kind?: 'text' | 'number' | 'select' | 'slider'
  type?: 'text' | 'number' | 'select' | 'slider'
  options?: string[]
  placeholder?: string
  min?: number
  max?: number
  step?: number
  value?: number
  /** Default true for slider: local-only, no model emit. */
  local?: boolean
  /** Only when set does a local field also emit to the model. */
  action?: string
}

export type FormProps = {
  fields: FormField[]
  values?: Record<string, string | number>
  submitAction?: string
  submitLabel?: string
  /** When true (default for slider-only tools), field changes stay local. */
  local?: boolean
}

/** Safe local bind: prop = scale * $from + offset. No JS/eval. */
export type BindSpec = {
  from: string
  to: string
  /** Optional linear template like "2 * $from + 1"; else use scale/offset. */
  expr?: string
  scale?: number
  offset?: number
}

export type ButtonProps = {
  label: string
  action: string
  payload?: Record<string, unknown>
}

export type TextProps = {
  content: string
}

export type LayoutProps = {
  gap?: number
  align?: 'start' | 'center' | 'end' | 'stretch'
  justify?: 'start' | 'center' | 'end' | 'between' | 'around'
  wrap?: boolean
  /** flex grow for this node when inside a row */
  grow?: number
  /** min width for flex child */
  minWidth?: number
}

export type ChecklistItem = {
  id: string
  label: string
  done?: boolean
  /** When set, toggle also emits action; default local-only. */
  action?: string
}

export type ChecklistProps = {
  title?: string
  items: ChecklistItem[]
  /** Default true: toggle writes local session state only, does not call the model. */
  local?: boolean
}

export type StatItem = {
  label: string
  value: string | number
  delta?: string | number
}

export type StatProps = {
  items?: StatItem[]
  label?: string
  value?: string | number
  delta?: string | number
}

export type TableProps = {
  title?: string
  columns: string[]
  rows: Array<Array<string | number>>
}

export type DiagramRegion = {
  id: string
  label: string
  /** SVG path `d` (preferred for irregular zones). */
  d?: string
  /** Axis-aligned rect fallback when `d` absent. */
  x?: number
  y?: number
  w?: number
  h?: number
  /** Optional inline explanation when no sibling hotspot. */
  body?: string
  /** Optional per-region action (emit only when set). */
  action?: string
}

export type DiagramProps = {
  title?: string
  /** https: URL or same-origin relative path only. */
  src?: string
  regions?: DiagramRegion[]
  selectedId?: string
  /** Default true: click stays local, no model emit. */
  local?: boolean
  /** Only when set does a region click also emit to the model. */
  action?: string
}

export type HotspotProps = {
  id: string
  label: string
  body?: string
  /** Default true: display-only explanation card. */
  local?: boolean
  /** Prefer node-level visibleWhen; accepted on props for model convenience. */
  visibleWhen?: string
  action?: string
}

export type IuiProps =
  | ChartProps
  | FormProps
  | ButtonProps
  | TextProps
  | LayoutProps
  | ChecklistProps
  | StatProps
  | TableProps
  | DiagramProps
  | HotspotProps
  | Record<string, unknown>

export type IuiNode = {
  key: string
  type: IuiType
  props: IuiProps
  children?: IuiNode[]
  /** Local-only sibling updates driven by form/slider values. */
  bind?: BindSpec | BindSpec[]
  binds?: BindSpec[]
  /** Show this node only when a diagram region with this id is selected. */
  visibleWhen?: string
}

/** Model should emit concrete type; optional Jev only fills missing/invalid when enabled. */
export type IuiPayload = {
  key: string
  type?: IuiType
  props: IuiProps
  children?: IuiPayload[]
  bind?: BindSpec | BindSpec[]
  binds?: BindSpec[]
  /** Show this node only when a diagram region with this id is selected. */
  visibleWhen?: string
}

export type UpsertOp = { op: 'upsert'; node: IuiNode }
export type RemoveOp = { op: 'remove'; key: string }
export type PatchPropsOp = { op: 'patchProps'; key: string; props: IuiProps }
export type IuiOp = UpsertOp | RemoveOp | PatchPropsOp

export type IuiActionEvent = {
  type: 'action'
  key: string
  action: string
  payload?: Record<string, unknown>
}

export type SessionStateSlice = {
  formValues?: Record<string, string | number>
  selected?: string | number
  /** checklist item id → done */
  checklistDone?: Record<string, boolean>
  /** diagram selected region id (persisted per diagram key) */
  diagramSelected?: string
  [k: string]: unknown
}
