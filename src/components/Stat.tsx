import type { StatItem, StatProps } from '../types/ir'

function normalizeItems(props: StatProps): StatItem[] {
  if (props.items?.length) return props.items
  if (props.label != null && props.value != null) {
    return [{ label: props.label, value: props.value, delta: props.delta }]
  }
  return []
}

function formatDelta(delta: string | number | undefined): string | null {
  if (delta == null || delta === '') return null
  return String(delta)
}

export function StatView({ props }: { props: StatProps }) {
  const items = normalizeItems(props)
  return (
    <div className="iui-card iui-stat">
      <div className="iui-stat-grid">
        {items.map((it, i) => {
          const delta = formatDelta(it.delta)
          const deltaPositive =
            delta != null && (String(delta).startsWith('+') || (!String(delta).startsWith('-') && Number(delta) > 0))
          const deltaNegative = delta != null && (String(delta).startsWith('-') || Number(delta) < 0)
          return (
            <div className="iui-stat-item" key={`${it.label}-${i}`}>
              <div className="iui-stat-label">{it.label}</div>
              <div className="iui-stat-value">{it.value}</div>
              {delta != null ? (
                <div
                  className={
                    deltaNegative
                      ? 'iui-stat-delta is-neg'
                      : deltaPositive
                        ? 'iui-stat-delta is-pos'
                        : 'iui-stat-delta'
                  }
                >
                  {delta}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
