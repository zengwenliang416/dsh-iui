/** Inject whitelist component CSS once (esbuild has no dsh-css loader). */
const STYLE_ID = 'dsh-iui-styles'
const CSS = `.iui-root {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
  color: #0f172a;
}
.iui-card {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 14px 16px;
  background: #fff;
  box-shadow: 0 1px 2px rgb(15 23 42 / 4%);
  width: 100%;
  box-sizing: border-box;
}
.iui-title {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 10px;
}
.iui-row {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: stretch;
  width: 100%;
  box-sizing: border-box;
}
.iui-col {
  display: flex;
  flex-direction: column;
  width: 100%;
  box-sizing: border-box;
  min-width: 0;
}
.iui-row > .iui-layout-item,
.iui-col > .iui-layout-item {
  box-sizing: border-box;
  min-width: 0;
}
.iui-layout-item {
  flex: 1 1 0;
  min-width: 200px;
  display: flex;
  flex-direction: column;
}
.iui-layout-item > .iui-node,
.iui-layout-item > .iui-row,
.iui-layout-item > .iui-col {
  width: 100%;
  flex: 1 1 auto;
}
.iui-node {
  width: 100%;
  min-width: 0;
}
.iui-text {
  font-size: 14px;
  line-height: 1.55;
  white-space: pre-wrap;
}
.iui-btn {
  appearance: none;
  border: none;
  border-radius: 8px;
  padding: 8px 14px;
  background: #2563eb;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
.iui-btn:hover { background: #1d4ed8; }
.iui-btn:active { transform: translateY(1px); }
.iui-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.iui-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.iui-field label {
  font-size: 12px;
  color: #64748b;
}
.iui-field input,
.iui-field select {
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 14px;
}
.iui-chart {
  width: 100%;
  overflow: hidden;
}
.iui-chart svg {
  width: 100%;
  height: auto;
  display: block;
}
.iui-legend {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 8px;
  font-size: 12px;
  color: #64748b;
}
.iui-legend span::before {
  content: '';
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 2px;
  margin-right: 6px;
  background: var(--c, #2563eb);
}
.iui-checklist-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.iui-checklist-item label {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 14px;
  line-height: 1.45;
  cursor: pointer;
}
.iui-checklist-item input[type='checkbox'] {
  margin-top: 3px;
  width: 16px;
  height: 16px;
  accent-color: #2563eb;
  flex-shrink: 0;
}
.iui-checklist-item.is-done span {
  color: #64748b;
  text-decoration: line-through;
}
.iui-stat-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
.iui-stat-item {
  flex: 1 1 120px;
  min-width: 100px;
}
.iui-stat-label {
  font-size: 12px;
  color: #64748b;
  margin-bottom: 4px;
}
.iui-stat-value {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.2;
}
.iui-stat-delta {
  margin-top: 4px;
  font-size: 12px;
  color: #64748b;
}
.iui-stat-delta.is-pos { color: #16a34a; }
.iui-stat-delta.is-neg { color: #dc2626; }
.iui-table-scroll {
  width: 100%;
  overflow-x: auto;
}
.iui-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.iui-table th,
.iui-table td {
  border-bottom: 1px solid #e2e8f0;
  padding: 8px 10px;
  text-align: left;
  white-space: nowrap;
}
.iui-table th {
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.iui-table tbody tr:last-child td {
  border-bottom: none;
}
`

export function ensureIuiStyles(): void {
  if (typeof document === 'undefined') return
  if (document.getElementById(STYLE_ID)) return
  const el = document.createElement('style')
  el.id = STYLE_ID
  el.textContent = CSS
  document.head.appendChild(el)
}
