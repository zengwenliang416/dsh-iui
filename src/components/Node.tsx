import type { CSSProperties } from 'react'
import type {
  ButtonProps,
  ChartProps,
  FormProps,
  IuiActionEvent,
  IuiNode,
  LayoutProps,
  TextProps,
} from '../types/ir'
import { ButtonView } from './Button'
import { ChartView } from './Chart'
import { FormView } from './Form'
import { TextView } from './Text'

export type RenderCtx = {
  sessionId: string
  onAction: (ev: IuiActionEvent) => void
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

function LayoutItem({
  child,
  parentType,
  ctx,
}: {
  child: IuiNode
  parentType: 'row' | 'col'
  ctx: RenderCtx
}) {
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
  return (
    <div className="iui-root">
      {roots.filter(isMountable).map((n) => (
        <NodeView key={n.key} node={n} ctx={{ sessionId, onAction }} />
      ))}
    </div>
  )
}
