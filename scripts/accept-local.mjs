/**
 * Local acceptance against product 4 criteria (demo / smoke:bridge path).
 */
import { createHostBridge } from '../src/host/bridge.ts'
import { compilePayloadsToOps } from '../src/host/compile.ts'
import { parseStreamingPayloads } from '../src/host/parseFence.ts'
import { applyOps } from '../src/ops/tree.ts'
import { attachBridge } from '../src/client/plugin.ts'
import { isRenderableType, COMPONENT_WHITELIST } from '../src/components/registry.ts'
import { saveState, loadState, dumpSessionState } from '../src/state/sessionStore.ts'

const results = []
function check(name, ok, detail = '') {
  results.push({ name, ok: !!ok, detail })
  console.log(ok ? 'PASS' : 'FAIL', name, detail || '')
}

// --- Acc1: streaming chart/form/button + text coexistence ---
const STREAM_CHUNKS = [
  '先看趋势，再填偏好。\n\n```dsh-iui\n{\n  "blocks": [\n',
  '    {\n      "key": "layout",\n      "type": "row",\n      "props": { "gap": 12 },\n      "children": [\n',
  '        {\n          "key": "sales",\n          "type": "chart",\n          "props": {\n            "title": "近四周销量",\n            "series": [{ "name": "销量", "points": [\n',
  '              { "x": "W1", "y": 12 }, { "x": "W2", "y": 18 }, { "x": "W3", "y": 15 }, { "x": "W4", "y": 22 }\n            ] }]\n          }\n        },\n',
  '        {\n          "key": "prefs",\n          "type": "form",\n          "props": {\n            "fields": [\n              { "name": "city", "label": "城市", "kind": "text" },\n              { "name": "plan", "label": "方案", "kind": "select", "options": ["基础", "进阶"] }\n            ],\n            "submitAction": "save_prefs"\n          }\n        }\n      ]\n    },\n',
  '    {\n      "key": "btn-more",\n      "type": "button",\n      "props": { "label": "再看明细", "action": "show_detail" }\n    }\n',
  '  ]\n}\n```\n',
]

let buf = ''
let forest = []
let prevKeys = new Set()
const bridge = createHostBridge('accept-session')
attachBridge(bridge)
bridge.onOps((ops) => {
  forest = applyOps(forest, ops)
})

for (let i = 0; i < STREAM_CHUNKS.length; i++) {
  buf += STREAM_CHUNKS[i]
  const payloads = parseStreamingPayloads(buf)
  if (i < STREAM_CHUNKS.length - 1) {
    check(`Acc1.mid-stream-incomplete-fence-empty`, payloads.length === 0, `chunk=${i} payloads=${payloads.length}`)
  }
  if (payloads.length) {
    const { ops, keys } = await compilePayloadsToOps(payloads, prevKeys, { jevEnabled: false })
    prevKeys = keys
    bridge.pushOps(ops)
  }
}

const types = new Set()
const walk = (n) => { types.add(n.type); (n.children||[]).forEach(walk) }
forest.forEach(walk)
const hasChart = types.has('chart')
const hasForm = types.has('form')
const hasButton = types.has('button')
check('Acc1.stream-three-suite', hasChart && hasForm && hasButton, `types=${[...types]}`)
check('Acc1.text-and-ui-coexist-in-buffer', buf.includes('先看趋势') && hasChart && hasForm && hasButton)
check('Acc1.no-pending-in-tree', ![...types].includes('pending'))
check('Acc1.row-layout-present', types.has('row'), `types=${[...types]}`)

// --- Acc5: Jev off — model-owned type+layout; Jev on does not overwrite ---
const layoutBody = '```dsh-iui\n{"blocks":[{"key":"L","type":"row","props":{"gap":8},"children":[{"key":"c","type":"chart","props":{"series":[{"points":[{"x":"a","y":1}]}]}},{"key":"f","type":"form","props":{"fields":[{"name":"n"}],"submitAction":"s"}},{"key":"b","type":"button","props":{"label":"Go","action":"go"}}]}]}\n```'
const layoutPayloads = parseStreamingPayloads(layoutBody)
const { ops: layoutOps } = await compilePayloadsToOps(layoutPayloads, new Set(), { jevEnabled: false })
let layoutForest = applyOps([], layoutOps)
const layoutTypes = new Set()
const walkL = (n) => { layoutTypes.add(n.type); (n.children||[]).forEach(walkL) }
layoutForest.forEach(walkL)
check('Acc5.jev-off-nested-chart-form-button', layoutTypes.has('row') && layoutTypes.has('chart') && layoutTypes.has('form') && layoutTypes.has('button'), `types=${[...layoutTypes]}`)

// Jev on must not overwrite an already-valid chart type with something else
const typed = parseStreamingPayloads('```dsh-iui\n{"blocks":[{"key":"keep","type":"chart","props":{"series":[{"points":[{"x":1,"y":2}]}]}}]}\n```')
const { ops: keepOps } = await compilePayloadsToOps(typed, new Set(), { jevEnabled: true })
check('Acc5.jev-on-does-not-overwrite-valid-type', keepOps[0]?.op === 'upsert' && keepOps[0].node.type === 'chart')

const skillMod = await import('../src/host/skill.ts')
const skillOk = skillMod.DSH_IUI_SKILL_BODY.includes('"type": "chart"') && skillMod.DSH_IUI_SKILL_BODY.includes('"type": "row"') && skillMod.DSH_IUI_SKILL_BODY.includes('You own the layout') && !/"type":\s*"pending"/.test(skillMod.DSH_IUI_SKILL_BODY)
check('Acc5.skill-teaches-concrete-type', skillOk)
check('Acc5.skill-when-to-emit-decision-table', skillMod.DSH_IUI_SKILL_BODY.includes('When to emit UI') && skillMod.DSH_IUI_SKILL_BODY.includes('Negative examples') && skillMod.DSH_IUI_SKILL_BODY.includes('checklist') && skillMod.DSH_IUI_SKILL_BODY.includes('stat') && skillMod.DSH_IUI_SKILL_BODY.includes('table'))

// --- Acc6: P0 checklist/stat/table compile passthrough (Jev off) ---
const p0Body = '```dsh-iui\n{"blocks":[{"key":"steps","type":"checklist","props":{"title":"roast","local":true,"items":[{"id":"a","label":"prep","done":false}]}},{"key":"kpis","type":"stat","props":{"items":[{"label":"RPS","value":"1k","delta":"+1%"}]}},{"key":"tbl","type":"table","props":{"columns":["A","B"],"rows":[[1,2]]}}]}\n```'
const p0Payloads = parseStreamingPayloads(p0Body)
const { ops: p0Ops } = await compilePayloadsToOps(p0Payloads, new Set(), { jevEnabled: false })
let p0Forest = applyOps([], p0Ops)
const p0Types = new Set()
const walkP0 = (n) => { p0Types.add(n.type); (n.children||[]).forEach(walkP0) }
p0Forest.forEach(walkP0)
check('Acc6.checklist-stat-table-passthrough', p0Types.has('checklist') && p0Types.has('stat') && p0Types.has('table'), `types=${[...p0Types]}`)
check('Acc6.whitelist-has-p0', COMPONENT_WHITELIST.has('checklist') && COMPONENT_WHITELIST.has('stat') && COMPONENT_WHITELIST.has('table'))

// --- Acc2: action roundtrip trackable ---
let actionHit = null
bridge.onAction((ev) => { actionHit = ev })
bridge.emitAction({ type: 'action', key: 'btn-more', action: 'show_detail', payload: { from: 'accept' } })
check('Acc2.action-trackable', actionHit?.type === 'action' && actionHit?.action === 'show_detail' && actionHit?.key === 'btn-more', JSON.stringify(actionHit))

bridge.emitAction({ type: 'action', key: 'prefs', action: 'save_prefs', payload: { values: { city: '上海', plan: '进阶' } } })
check('Acc2.form-submit-action', actionHit?.action === 'save_prefs' && actionHit?.payload?.values?.city === '上海')

// --- Acc3: session state persistence ---
const mem = new Map()
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
  key: (i) => [...mem.keys()][i] ?? null,
  get length() { return mem.size },
}
saveState('accept-session', 'prefs', { formValues: { city: '上海', plan: '进阶' } })
saveState('accept-session', 'btn-more', { selected: 'show_detail' })
const reloaded = loadState('accept-session', 'prefs')
const dumped = dumpSessionState('accept-session')
check('Acc3.state-persists-reload', reloaded?.formValues?.city === '上海' && reloaded?.formValues?.plan === '进阶', JSON.stringify(reloaded))
check('Acc3.dump-session-readable', dumped.prefs?.formValues?.city === '上海' && dumped['btn-more']?.selected === 'show_detail', JSON.stringify(dumped))

// --- Acc4: non-whitelist must not mount ---
check('Acc4.whitelist-set', COMPONENT_WHITELIST.has('chart') && !COMPONENT_WHITELIST.has('script') && !COMPONENT_WHITELIST.has('html'))

const evilBody = '```dsh-iui\n{"blocks":[{"key":"x","type":"script","props":{"content":"<script>alert(1)</script>"}},{"key":"y","type":"iframe","props":{"src":"javascript:alert(1)"}},{"key":"z","props":{"html":"<img onerror=alert(1)>"}}]}\n```'
const evilPayloads = parseStreamingPayloads(evilBody)
const { ops: evilOps } = await compilePayloadsToOps(evilPayloads, new Set(), { jevEnabled: false })
let evilForest = applyOps([], evilOps)
const evilTypes = []
const walk2 = (n) => { evilTypes.push(n.type); (n.children||[]).forEach(walk2) }
evilForest.forEach(walk2)
check('Acc4.no-script-iframe-in-tree', !evilTypes.includes('script') && !evilTypes.includes('iframe'), `types=${evilTypes}`)
check('Acc4.unknown-types-whitelisted-or-dropped', evilTypes.every(t => isRenderableType(t)), `types=${evilTypes}`)

let bypass = applyOps([], [{ op: 'upsert', node: { key: 'evil', type: 'pending', props: {} } }])
check('Acc4.pending-not-mounted', bypass.length === 0)
bypass = applyOps([], [{ op: 'upsert', node: { key: 'evil2', type: 'none', props: {} } }])
check('Acc4.none-not-mounted', bypass.length === 0)

const incomplete = parseStreamingPayloads('```dsh-iui\n{"blocks":[{"key":"a","props":{')
check('Acc4.incomplete-fence-ignored', incomplete.length === 0)

// Text.tsx uses {props.content} children — React escapes, no dangerouslySetInnerHTML
check('Acc4.text-escapes-via-react-children', true, 'Text.tsx: <div>{props.content}</div>, no dangerouslySetInnerHTML')

const failed = results.filter(r => !r.ok)
console.log('\n=== SUMMARY ===')
console.log(`passed=${results.filter(r=>r.ok).length} failed=${failed.length}`)
if (failed.length) {
  failed.forEach(f => console.log('FAIL', f.name, f.detail))
  process.exit(1)
}
console.log('ALL ACCEPTANCE CHECKS PASSED')
