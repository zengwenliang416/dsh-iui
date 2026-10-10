import { useCallback, useMemo, useState, type CSSProperties } from 'react'
import type {
  ButtonProps,
  ChartProps,
  ChecklistProps,
  DiagramProps,
  FormProps,
  HotspotProps,
  IuiActionEvent,
  IuiNode,
  LayoutProps,
  StatProps,
  TableProps,
  TextProps,
} from '../types/ir'
import { applyBinds } from '../ops/bind'
import { ButtonView } from './Button'
import { ChartView } from './Chart'
import { ChecklistView } from './Checklist'
import { DiagramView } from './Diagram'
import { FormView } from './Form'
import { HotspotView } from './Hotspot'
import { StatView } from './Stat'
import { TableView } from './Table'
import { TextView } from './Text'

export type RenderCtx = {
  sessionId: string
  onAction: (ev: IuiActionEvent) => void
  onLocalValues?: (formKey: string, values: Record<string, string | number>) => void
  /** diagramKey → selected region id (forest-level for visibleWhen). */
  diagramSelected?: Record<string, string>
  onDiagramSelect?: (diagramKey: string, selectedId: string) => void
}

const ALIGN_MAP: Record<NonNullable<LayoutProps['align']>, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch',
}

const JUSTIFY_MAP: Record<NonNullable<LayoutProps['justify']>, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  between: 'space-between',
  around: 'space-around',
}

function isMountable(n: IuiNode): boolean {
  return n.type !== 'pending' && n.type !== 'none'
}

function visibleWhenId(node: IuiNode): string | undefined {
  if (typeof node.visibleWhen === 'string' && node.visibleWhen) return node.visibleWhen
  if (node.type === 'hotspot') {
    const p = node.props as HotspotProps
    if (typeof p.visibleWhen === 'string' && p.visibleWhen) return p.visibleWhen
  }
  return undefined
}

function isVisible(node: IuiNode, ctx: RenderCtx): boolean {
  const when = visibleWhenId(node)
  if (!when) return true
  // hotspot/text with visibleWhen: show only when some diagram has that region selected
  const selected = ctx.diagramSelected ?? {}
  return Object.values(selected).includes(when)
}

function LayoutItem({
  child,
  parentType,
  ctx,
}: {
  child: IuiNode
  parentType: 'row' | 'col'
  ctx: RenderCtx
}) {
  if (!isVisible(child, ctx)) return null

  const lp = (child.props ?? {}) as LayoutProps
  const isLeafCtrl = child.type === 'button'
  const grow = lp.grow ?? (parentType === 'row' ? (isLeafCtrl ? 0 : 1) : undefined)
  const minWidth =
    lp.minWidth ?? (parentType === 'row' ? (isLeafCtrl ? 0 : 200) : undefined)
  const style: CSSProperties = {}
  if (grow != null) style.flex = `${grow} 1 auto`
  if (minWidth != null) style.minWidth = minWidth
  if (parentType === 'col') style.width = '100%'
  if (isLeafCtrl) {
    style.flexGrow = 0
    style.flexBasis = 'auto'
  }

  return (
    <div className="iui-layout-item" style={style}>
      <NodeView node={child} ctx={ctx} />
    </div>
  )
}

export function NodeView({ node, ctx }: { node: IuiNode; ctx: RenderCtx }) {
  if (!isMountable(node)) return null
  if (!isVisible(node, ctx)) return null

  if (node.type === 'chart') {
    return (
      <div data-iui-type="chart" data-iui-key={node.key} className="iui-node">
        <ChartView props={node.props as ChartProps} />
      </div>
    )
  }
  if (node.type === 'form') {
    return (
      <div data-iui-type="form" data-iui-key={node.key} className="iui-node">
        <FormView
          nodeKey={node.key}
          sessionId={ctx.sessionId}
          props={node.props as FormProps}
          onAction={ctx.onAction}
          onLocalValues={ctx.onLocalValues}
        />
      </div>
    )
  }
  if (node.type === 'button') {
    return (
      <div data-iui-type="button" data-iui-key={node.key} className="iui-node">
        <ButtonView
          nodeKey={node.key}
          props={node.props as ButtonProps}
          onAction={ctx.onAction}
        />
      </div>
    )
  }
  if (node.type === 'text') {
    return (
      <div data-iui-type="text" data-iui-key={node.key} className="iui-node">
        <TextView props={node.props as TextProps} />
      </div>
    )
  }
  if (node.type === 'checklist') {
    return (
      <div data-iui-type="checklist" data-iui-key={node.key} className="iui-node">
        <ChecklistView
          nodeKey={node.key}
          sessionId={ctx.sessionId}
          props={node.props as ChecklistProps}
          onAction={ctx.onAction}
        />
      </div>
    )
  }
  if (node.type === 'stat') {
    return (
      <div data-iui-type="stat" data-iui-key={node.key} className="iui-node">
        <StatView props={node.props as StatProps} />
      </div>
    )
  }
  if (node.type === 'table') {
    return (
      <div data-iui-type="table" data-iui-key={node.key} className="iui-node">
        <TableView props={node.props as TableProps} />
      </div>
    )
  }
  if (node.type === 'diagram') {
    return (
      <div data-iui-type="diagram" data-iui-key={node.key} className="iui-node">
        <DiagramView
          nodeKey={node.key}
          sessionId={ctx.sessionId}
          props={node.props as DiagramProps}
          onAction={ctx.onAction}
          onDiagramSelect={ctx.onDiagramSelect}
        />
      </div>
    )
  }
  if (node.type === 'hotspot') {
    return (
      <div data-iui-type="hotspot" data-iui-key={node.key} className="iui-node">
        <HotspotView props={node.props as HotspotProps} />
      </div>
    )
  }
  if (node.type === 'row' || node.type === 'col') {
    const lp = (node.props ?? {}) as LayoutProps
    const gap = lp.gap ?? 12
    const cls = node.type === 'row' ? 'iui-row' : 'iui-col'
    const style: CSSProperties = { gap }
    if (lp.align) style.alignItems = ALIGN_MAP[lp.align]
    if (lp.justify) style.justifyContent = JUSTIFY_MAP[lp.justify]
    if (lp.wrap != null) style.flexWrap = lp.wrap ? 'wrap' : 'nowrap'

    const kids = (node.children ?? []).filter(isMountable)

    return (
      <div
        className={cls}
        style={style}
        data-iui-type={node.type}
        data-iui-key={node.key}
      >
        {kids.map((c) => (
          <LayoutItem key={c.key} child={c} parentType={node.type as 'row' | 'col'} ctx={ctx} />
        ))}
      </div>
    )
  }
  return null
}

export function IuiForest({
  roots,
  sessionId,
  onAction,
}: {
  roots: IuiNode[]
  sessionId: string
  onAction: (ev: IuiActionEvent) => void
}) {
  const [formValues, setFormValues] = useState<Record<string, string | number>>({})
  const [diagramSelected, setDiagramSelected] = useState<Record<string, string>>({})

  const onLocalValues = useCallback(
    (_formKey: string, values: Record<string, string | number>) => {
      setFormValues((prev) => {
        let changed = false
        const next = { ...prev }
        for (const [k, v] of Object.entries(values)) {
          if (next[k] !== v) {
            next[k] = v
            changed = true
          }
        }
        return changed ? next : prev
      })
    },
    [],
  )

  const onDiagramSelect = useCallback((diagramKey: string, selectedId: string) => {
    setDiagramSelected((prev) => {
      if (prev[diagramKey] === selectedId) return prev
      return { ...prev, [diagramKey]: selectedId }
    })
  }, [])

  const displayRoots = useMemo(
    () => applyBinds(roots, formValues),
    [roots, formValues],
  )

  const ctx: RenderCtx = useMemo(
    () => ({ sessionId, onAction, onLocalValues, diagramSelected, onDiagramSelect }),
    [sessionId, onAction, onLocalValues, diagramSelected, onDiagramSelect],
  )

  return (
    <div className="iui-root">
      {displayRoots.filter(isMountable).map((n) => (
        <NodeView key={n.key} node={n} ctx={ctx} />
      ))}
    </div>
  )
}
