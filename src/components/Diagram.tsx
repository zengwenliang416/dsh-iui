import { useEffect, useMemo, useState, type MouseEvent } from 'react'
import type { DiagramProps, DiagramRegion, IuiActionEvent } from '../types/ir'
import { loadState, saveState } from '../state/sessionStore'

type Props = {
  nodeKey: string
  sessionId: string
  props: DiagramProps
  onAction: (ev: IuiActionEvent) => void
  onDiagramSelect?: (diagramKey: string, selectedId: string) => void
}

const VIEW_W = 400
const VIEW_H = 260

const FILL = '#94a3b8'
const FILL_SEL = '#2563eb'
const STROKE = '#64748b'
const STROKE_SEL = '#1d4ed8'

function regionShape(r: DiagramRegion, selected: boolean) {
  const fill = selected ? FILL_SEL : FILL
  const stroke = selected ? STROKE_SEL : STROKE
  const opacity = selected ? 0.55 : 0.28
  const common = {
    fill,
    stroke,
    strokeWidth: selected ? 2.5 : 1.5,
    opacity,
    style: { cursor: 'pointer' as const },
  }
  if (r.d) {
    return <path key={r.id} d={r.d} {...common} data-region-id={r.id} />
  }
  const x = r.x ?? 0
  const y = r.y ?? 0
  const w = r.w ?? 40
  const h = r.h ?? 40
  return (
    <rect
      key={r.id}
      x={x}
      y={y}
      width={w}
      height={h}
      rx={6}
      {...common}
      data-region-id={r.id}
    />
  )
}

export function DiagramView({ nodeKey, sessionId, props, onAction, onDiagramSelect }: Props) {
  const regions = props.regions ?? []
  const saved = loadState(sessionId, nodeKey)
  const initial =
    (typeof saved?.diagramSelected === 'string' && saved.diagramSelected) ||
    props.selectedId ||
    regions[0]?.id ||
    ''

  const [selectedId, setSelectedId] = useState(initial)

  useEffect(() => {
    if (selectedId) {
      saveState(sessionId, nodeKey, { diagramSelected: selectedId })
      onDiagramSelect?.(nodeKey, selectedId)
    }
  }, [sessionId, nodeKey, selectedId, onDiagramSelect])

  const selected = useMemo(
    () => regions.find((r) => r.id === selectedId) ?? null,
    [regions, selectedId],
  )

  const select = (id: string, regionAction?: string) => {
    setSelectedId(id)
    const action = regionAction ?? props.action
    if (action) {
      onAction({
        type: 'action',
        key: nodeKey,
        action,
        payload: { regionId: id },
      })
    }
  }

  const onSvgClick = (e: MouseEvent<SVGSVGElement>) => {
    const el = (e.target as SVGElement).closest('[data-region-id]') as SVGElement | null
    if (!el) return
    const id = el.getAttribute('data-region-id')
    if (!id) return
    const region = regions.find((r) => r.id === id)
    select(id, region?.action)
  }

  const src = props.src

  return (
    <div className="iui-card iui-diagram">
      {props.title ? <h3 className="iui-title">{props.title}</h3> : null}
      <div className="iui-diagram-canvas">
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          role="img"
          aria-label={props.title ?? 'diagram'}
          onClick={onSvgClick}
        >
          {src ? (
            <image href={src} x={0} y={0} width={VIEW_W} height={VIEW_H} preserveAspectRatio="xMidYMid meet" />
          ) : (
            <rect x={0} y={0} width={VIEW_W} height={VIEW_H} fill="#f8fafc" rx={8} />
          )}
          {/* bicycle-ish silhouette hint when no external image */}
          {!src ? (
            <g opacity={0.12} pointerEvents="none">
              <circle cx={90} cy={180} r={48} fill="none" stroke="#0f172a" strokeWidth={6} />
              <circle cx={300} cy={180} r={48} fill="none" stroke="#0f172a" strokeWidth={6} />
              <path
                d="M90 180 L160 100 L250 100 L300 180 M160 100 L140 180 M200 100 L200 70"
                fill="none"
                stroke="#0f172a"
                strokeWidth={5}
                strokeLinecap="round"
              />
            </g>
          ) : null}
          {regions.map((r) => regionShape(r, r.id === selectedId))}
          {regions.map((r) => {
            const cx = r.d ? undefined : (r.x ?? 0) + (r.w ?? 40) / 2
            const cy = r.d ? undefined : (r.y ?? 0) + (r.h ?? 40) / 2
            if (cx == null || cy == null) return null
            return (
              <text
                key={`${r.id}-label`}
                x={cx}
                y={cy}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={12}
                fontWeight={r.id === selectedId ? 700 : 500}
                fill={r.id === selectedId ? '#1e3a8a' : '#334155'}
                pointerEvents="none"
              >
                {r.label}
              </text>
            )
          })}
        </svg>
      </div>
      {selected ? (
        <div className="iui-diagram-panel" data-selected={selected.id}>
          <div className="iui-diagram-panel-label">{selected.label}</div>
          {selected.body ? <div className="iui-diagram-panel-body">{selected.body}</div> : null}
        </div>
      ) : (
        <div className="iui-diagram-panel is-empty">点击分区查看说明</div>
      )}
    </div>
  )
}
