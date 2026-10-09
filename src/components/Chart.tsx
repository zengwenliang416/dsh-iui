import type { ChartProps } from '../types/ir'

const COLORS = ['#2563eb', '#16a34a', '#ea580c', '#7c3aed']

export function ChartView({ props }: { props: ChartProps }) {
  const series = props.series ?? []
  const allY = series.flatMap((s) => s.points.map((p) => p.y))
  const maxY = Math.max(1, ...allY)
  const width = 360
  const height = 160
  const pad = 24

  return (
    <div className="iui-card iui-chart">
      {props.title ? <h3 className="iui-title">{props.title}</h3> : null}
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={props.title ?? 'chart'}>
        <line x1={pad} y1={height - pad} x2={width - 8} y2={height - pad} stroke="#e2e8f0" />
        <line x1={pad} y1={8} x2={pad} y2={height - pad} stroke="#e2e8f0" />
        {series.map((s, si) => {
          const pts = s.points
          if (!pts.length) return null
          const step = pts.length === 1 ? 0 : (width - pad - 16) / (pts.length - 1)
          const d = pts
            .map((p, i) => {
              const x = pad + i * step
              const y = height - pad - (p.y / maxY) * (height - pad - 16)
              return `${i === 0 ? 'M' : 'L'}${x},${y}`
            })
            .join(' ')
          return (
            <path
              key={si}
              d={d}
              fill="none"
              stroke={COLORS[si % COLORS.length]}
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )
        })}
      </svg>
      <div className="iui-legend">
        {series.map((s, si) => (
          <span key={si} style={{ ['--c' as string]: COLORS[si % COLORS.length] }}>
            {s.name ?? `系列 ${si + 1}`}
          </span>
        ))}
      </div>
    </div>
  )
}
