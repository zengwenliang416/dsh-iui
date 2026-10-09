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
  | 'pending'
  | 'none'

export type ChartProps = {
  title?: string
  series: Array<{ name?: string; points: Array<{ x: string | number; y: number }> }>
}

export type FormField = {
  name: string
  label?: string
  kind?: 'text' | 'number' | 'select'
  options?: string[]
  placeholder?: string
}

export type FormProps = {
  fields: FormField[]
  values?: Record<string, string | number>
  submitAction?: string
  submitLabel?: string
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

export type IuiProps =
  | ChartProps
  | FormProps
  | ButtonProps
  | TextProps
  | LayoutProps
  | ChecklistProps
  | StatProps
  | TableProps
  | Record<string, unknown>

export type IuiNode = {
  key: string
  type: IuiType
  props: IuiProps
  children?: IuiNode[]
}

/** Model should emit concrete type; optional Jev only fills missing/invalid when enabled. */
export type IuiPayload = {
  key: string
  type?: IuiType
  props: IuiProps
  children?: IuiPayload[]
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
  [k: string]: unknown
}
