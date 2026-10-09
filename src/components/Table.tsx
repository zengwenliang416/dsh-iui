import type { TableProps } from '../types/ir'

export function TableView({ props }: { props: TableProps }) {
  const columns = props.columns ?? []
  const rows = props.rows ?? []
  return (
    <div className="iui-card iui-table-wrap">
      {props.title ? <h3 className="iui-title">{props.title}</h3> : null}
      <div className="iui-table-scroll">
        <table className="iui-table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri}>
                {columns.map((_, ci) => (
                  <td key={ci}>{row[ci] ?? ''}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
