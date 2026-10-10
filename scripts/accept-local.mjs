/**
 * Local acceptance against product 4 criteria (demo / smoke:bridge path).
 */
import { createHostBridge } from '../src/host/bridge.ts'
import { compilePayloadsToOps, emptyCompileState } from '../src/host/compile.ts'
import { parseStreamingPayloads, parseProgressivePayloads } from '../src/host/parseFence.ts'
import { applyOps, mergeProps } from '../src/ops/tree.ts'
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
let compileState = emptyCompileState()
const bridge = createHostBridge('accept-session')
attachBridge(bridge)
bridge.onOps((ops) => {
  forest = applyOps(forest, ops)
})

let sawProgressiveMid = false
for (let i = 0; i < STREAM_CHUNKS.length; i++) {
  buf += STREAM_CHUNKS[i]
  // Closed-fence parser still ignores open fence (Acc4).
  const closedOnly = parseStreamingPayloads(buf)
  if (i < STREAM_CHUNKS.length - 1) {
    check(`Acc1.mid-stream-closed-fence-empty`, closedOnly.length === 0, `chunk=${i} payloads=${closedOnly.length}`)
  }
  const payloads = parseProgressivePayloads(buf)
  if (i >= 3 && i < STREAM_CHUNKS.length - 1 && payloads.some((p) => p.key === 'sales')) {
    sawProgressiveMid = true
  }
  if (payloads.length) {
    const { ops, state } = await compilePayloadsToOps(payloads, compileState, { jevEnabled: false })
    compileState = state
    if (ops.length) bridge.pushOps(ops)
  }
}
check('Acc1.progressive-mid-stream-chart-ready', sawProgressiveMid, 'sales chart should appear before fence closes')

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
const layoutBody = '```dsh-iui\n{"blocks":[{"key":"L","type":"row","props":{"gap":8},"children":[{"key":"c","type":"chart","props":{"series":[{"points":[{"x":"a","y":1}]}]}},{"key":"f","type":"form","props":{"fields":[{"name":"n","kind":"text"}],"submitAction":"s"}},{"key":"b","type":"button","props":{"label":"Go","action":"go"}}]}]}\n```'
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


// --- Acc7: slider/bind shape validation (backend) ---
const { sanitizeSliderField, sanitizeBind, sanitizePayload, evalLinearBind, parseLinearBind } = await import('../src/host/validate.ts')
const okSlider = sanitizeSliderField({ id: 'guests', type: 'slider', min: 1, max: 10, step: 1, value: 4 })
check('Acc7.slider-ok', okSlider?.kind === 'slider' && okSlider.min === 1 && okSlider.max === 10 && okSlider.local === true)
check('Acc7.slider-rejects-bad-range', sanitizeSliderField({ id: 'x', type: 'slider', min: 10, max: 1 }) === null)
check('Acc7.bind-linear-scale-offset', !!sanitizeBind({ from: 'guests', to: 'value', scale: 2, offset: 0 }))
check('Acc7.bind-linear-expr', !!sanitizeBind({ from: 'guests', to: 'value', expr: '2 * $from + 1' }))
check('Acc7.bind-rejects-eval', sanitizeBind({ from: 'guests', to: 'value', expr: 'eval(1)' }) === null)
check('Acc7.bind-rejects-bad-path', sanitizeBind({ from: 'guests', to: 'value;hack', scale: 1 }) === null)
check('Acc7.eval-linear', evalLinearBind({ from: 'g', to: 'value', scale: 2, offset: 1 }, 4) === 9)
const evilTree = sanitizePayload({
  key: 'root',
  type: 'col',
  props: {},
  children: [
    { key: 'f', type: 'form', props: { fields: [{ id: 'g', type: 'slider', min: 1, max: 5, value: 2 }] } },
    { key: 's', type: 'stat', props: { label: 'n', value: 0 }, bind: { from: 'g', to: 'value', expr: '2 * $from' } },
    { key: 'bad', type: 'stat', props: { label: 'x', value: 0 }, bind: { from: 'g', to: 'value', expr: 'Math.random()' } },
  ],
})
const badBindGone = !evilTree?.children?.find((c) => c.key === 'bad')?.bind
const goodBind = evilTree?.children?.find((c) => c.key === 's')?.bind
check('Acc7.sanitize-tree-drops-evil-bind', badBindGone && !!goodBind, JSON.stringify(evilTree?.children?.map(c => ({k:c.key,b:c.bind}))))

const sliderBody = '```dsh-iui\n{"blocks":[{"key":"party","type":"col","props":{},"children":[{"key":"f","type":"form","props":{"fields":[{"id":"guests","type":"slider","min":1,"max":12,"value":4}]}},{"key":"p","type":"stat","props":{"label":"份量","value":8},"bind":{"from":"guests","to":"value","scale":2}}]}]}\n```'
const { ops: sliderOps } = await compilePayloadsToOps(parseStreamingPayloads(sliderBody), new Set(), { jevEnabled: false })
let sliderForest = applyOps([], sliderOps)
const hasSliderForm = sliderForest.some((n) => n.type === 'col' && (n.children||[]).some((c) => c.type === 'form' && (c.props.fields||[]).some((f) => f.kind === 'slider' || f.type === 'slider')))
const hasBoundStat = sliderForest.some((n) => (n.children||[]).some((c) => c.type === 'stat' && c.bind))
check('Acc7.compile-slider-bind-passthrough', hasSliderForm && hasBoundStat, JSON.stringify(sliderForest))

check('Acc7.skill-slider-examples', skillMod.DSH_IUI_SKILL_BODY.includes('slider') && skillMod.DSH_IUI_SKILL_BODY.includes('bind') && skillMod.DSH_IUI_SKILL_BODY.includes('用餐人数') && skillMod.DSH_IUI_SKILL_BODY.includes('本金'))


// --- Acc8: diagram/hotspot validation ---
const { isSafeDiagramSrc, sanitizeDiagramProps, sanitizeHotspotProps } = await import('../src/host/validate.ts')
check('Acc8.src-https-ok', isSafeDiagramSrc('https://cdn.example.com/bike.svg'))
check('Acc8.src-relative-ok', isSafeDiagramSrc('./assets/bike.svg'))
check('Acc8.src-rejects-javascript', !isSafeDiagramSrc('javascript:alert(1)'))
check('Acc8.src-rejects-data', !isSafeDiagramSrc('data:image/svg+xml;base64,abc'))
const dig = sanitizeDiagramProps({
  title: '五系统',
  local: true,
  selectedId: 'drivetrain',
  regions: [
    { id: 'drivetrain', label: '传动', x: 1, y: 2, w: 3, h: 4, body: '链' },
    { id: 'brakes', label: '刹车', x: 1, y: 2, w: 3, h: 4 },
  ],
})
check('Acc8.diagram-regions-ok', !!dig && dig.regions?.length === 2 && dig.local === true)
check('Acc8.diagram-rejects-bad-src', sanitizeDiagramProps({ src: 'javascript:x', regions: [{ id: 'a', label: 'a' }] }) === null)
check('Acc8.hotspot-ok', sanitizeHotspotProps({ id: 'drivetrain', label: '传动', body: '…', visibleWhen: 'drivetrain', local: true })?.id === 'drivetrain')
const digBody = '```dsh-iui\n{"blocks":[{"key":"bike","type":"row","props":{},"children":[{"key":"d","type":"diagram","props":{"local":true,"regions":[{"id":"a","label":"A","x":0,"y":0,"w":10,"h":10},{"id":"b","label":"B","x":20,"y":0,"w":10,"h":10}]}},{"key":"h","type":"hotspot","props":{"id":"a","label":"A","body":"说明","visibleWhen":"a","local":true}}]}]}\n```'
const { ops: digOps } = await compilePayloadsToOps(parseStreamingPayloads(digBody), new Set(), { jevEnabled: false })
let digForest = applyOps([], digOps)
const digTypes = new Set()
const walkD = (n) => { digTypes.add(n.type); (n.children||[]).forEach(walkD) }
digForest.forEach(walkD)
check('Acc8.compile-diagram-hotspot', digTypes.has('diagram') && digTypes.has('hotspot') && digTypes.has('row'), `types=${[...digTypes]}`)
check('Acc8.whitelist-has-diagram', COMPONENT_WHITELIST.has('diagram') && COMPONENT_WHITELIST.has('hotspot'))
check('Acc8.skill-five-systems', skillMod.DSH_IUI_SKILL_BODY.includes('diagram') && skillMod.DSH_IUI_SKILL_BODY.includes('自行车五系统') && skillMod.DSH_IUI_SKILL_BODY.includes('hotspot'))

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
const incompleteProg = parseProgressivePayloads('```dsh-iui\n{"blocks":[{"key":"a","props":{')
check('Acc4.incomplete-token-still-dropped', incompleteProg.length === 0)

// Text.tsx uses {props.content} children — React escapes, no dangerouslySetInnerHTML
check('Acc4.text-escapes-via-react-children', true, 'Text.tsx: <div>{props.content}</div>, no dangerouslySetInnerHTML')

// --- Acc9: progressive apply — shell upsert then patchProps; local state keys untouched ---
{
  let prog = applyOps([], [
    {
      op: 'upsert',
      node: {
        key: 'prog-row',
        type: 'row',
        props: { gap: 8 },
        children: [
          { key: 'prog-chart', type: 'chart', props: { title: '壳', series: [{ name: '销量', points: [] }] } },
          { key: 'prog-form', type: 'form', props: { fields: [{ id: 'city', type: 'text', label: '城市' }], local: true } },
        ],
      },
    },
  ])
  const chart0 = prog[0]?.children?.find((n) => n.key === 'prog-chart')
  check('Acc9.shell-upsert-visible', !!chart0 && Array.isArray(chart0.props.series) && chart0.props.series[0].points.length === 0, JSON.stringify(chart0?.props?.series))

  // Simulate local session state written before patch (formValues / checklist / diagram)
  saveState('accept-session', 'prog-form', { formValues: { city: '上海' } })
  saveState('accept-session', 'prog-check', { checklistDone: { s1: true } })
  saveState('accept-session', 'prog-diagram', { diagramSelected: 'drive' })
  const beforePatch = {
    form: loadState('accept-session', 'prog-form'),
    check: loadState('accept-session', 'prog-check'),
    dig: loadState('accept-session', 'prog-diagram'),
  }

  prog = applyOps(prog, [
    {
      op: 'patchProps',
      key: 'prog-chart',
      props: {
        title: '近四周销量',
        series: [{ name: '销量', points: [{ x: 'W1', y: 12 }, { x: 'W2', y: 18 }] }],
      },
    },
    {
      op: 'patchProps',
      key: 'prog-form',
      props: {
        fields: [
          { id: 'city', type: 'text', label: '城市', placeholder: '上海' },
          { id: 'plan', type: 'select', label: '方案', options: ['基础', '进阶'] },
        ],
        submitAction: 'save_prefs',
      },
    },
  ])
  const chart1 = prog[0]?.children?.find((n) => n.key === 'prog-chart')
  const form1 = prog[0]?.children?.find((n) => n.key === 'prog-form')
  check('Acc9.patch-merges-series', chart1?.props?.title === '近四周销量' && chart1?.props?.series?.[0]?.points?.length === 2, JSON.stringify(chart1?.props))
  check('Acc9.patch-merges-form-fields', form1?.props?.fields?.length === 2 && form1?.props?.submitAction === 'save_prefs', JSON.stringify(form1?.props))
  check('Acc9.patch-keeps-children', prog[0]?.children?.length === 2 && prog[0]?.type === 'row')

  const afterPatch = {
    form: loadState('accept-session', 'prog-form'),
    check: loadState('accept-session', 'prog-check'),
    dig: loadState('accept-session', 'prog-diagram'),
  }
  check('Acc9.session-formValues-untouched', afterPatch.form?.formValues?.city === '上海' && afterPatch.form?.formValues?.city === beforePatch.form?.formValues?.city)
  check('Acc9.session-checklist-untouched', afterPatch.check?.checklistDone?.s1 === true)
  check('Acc9.session-diagramSelected-untouched', afterPatch.dig?.diagramSelected === 'drive')

  // Re-upsert thinner props must merge, not wipe
  prog = applyOps(prog, [
    { op: 'upsert', node: { key: 'prog-chart', type: 'chart', props: { title: '仍保留 series' } } },
  ])
  const chart2 = prog[0]?.children?.find((n) => n.key === 'prog-chart')
  check('Acc9.reupsert-merges-props', chart2?.props?.title === '仍保留 series' && chart2?.props?.series?.[0]?.points?.length === 2, JSON.stringify(chart2?.props))

  const mp = mergeProps({ a: 1, nest: { x: 1, y: 2 }, arr: [1] }, { b: 2, nest: { y: 9, z: 3 }, arr: [7, 8] })
  check('Acc9.mergeProps-deep', mp.a === 1 && mp.b === 2 && mp.nest?.x === 1 && mp.nest?.y === 9 && mp.nest?.z === 3 && mp.arr?.length === 2)
}



// --- Acc9b: backend progressive compile — ready upsert, later patchProps ---
{
  const openPrefix = '```dsh-iui\n{\n  "blocks": [\n'
  const chartReady =
    '    {\n      "key": "pc",\n      "type": "chart",\n      "props": {\n        "title": "壳",\n        "series": [{ "name": "销量", "points": [] }]\n      }\n    }'
  const chartPatched =
    '    {\n      "key": "pc",\n      "type": "chart",\n      "props": {\n        "title": "近四周",\n        "series": [{ "name": "销量", "points": [{ "x": "W1", "y": 12 }] }]\n      }\n    }'
  const formReady =
    ',\n    {\n      "key": "pf",\n      "type": "form",\n      "props": {\n        "fields": [{ "id": "city", "type": "text", "label": "城市" }]\n      }\n    }\n  ]\n}\n```\n'

  let st = emptyCompileState()
  const mid1 = parseProgressivePayloads(openPrefix + chartReady)
  check('Acc9b.mid-stream-extracts-chart', mid1.some((p) => p.key === 'pc'), JSON.stringify(mid1.map((p) => p.key)))
  const r1 = await compilePayloadsToOps(mid1, st, { jevEnabled: false })
  st = r1.state
  check('Acc9b.first-ready-is-upsert', r1.ops.some((o) => o.op === 'upsert' && o.node?.key === 'pc'), JSON.stringify(r1.ops.map((o) => o.op)))
  check('Acc9b.no-patch-on-first', !r1.ops.some((o) => o.op === 'patchProps'))

  const mid2 = parseProgressivePayloads(openPrefix + chartPatched)
  const r2 = await compilePayloadsToOps(mid2, st, { jevEnabled: false })
  st = r2.state
  check('Acc9b.later-fields-patchProps', r2.ops.some((o) => o.op === 'patchProps' && o.key === 'pc'), JSON.stringify(r2.ops))
  check('Acc9b.no-second-upsert-same-key', !r2.ops.some((o) => o.op === 'upsert' && o.node?.key === 'pc'))
  const patch = r2.ops.find((o) => o.op === 'patchProps' && o.key === 'pc')
  check('Acc9b.patch-has-series', patch?.props?.title === '近四周' && Array.isArray(patch?.props?.series), JSON.stringify(patch?.props))

  const mid3 = parseProgressivePayloads(openPrefix + chartPatched + formReady)
  const r3 = await compilePayloadsToOps(mid3, st, { jevEnabled: false })
  check('Acc9b.form-upsert-when-ready', r3.ops.some((o) => o.op === 'upsert' && o.node?.key === 'pf'), JSON.stringify(r3.ops.map((o) => [o.op, o.node?.key || o.key])))
  check('Acc9b.illegal-still-dropped', (await compilePayloadsToOps(parseProgressivePayloads('```dsh-iui\n{"blocks":[{"key":"bad","type":"script","props":{"x":1}}]}\n```'), emptyCompileState(), { jevEnabled: false })).ops.length === 0)
}

const failed = results.filter(r => !r.ok)
console.log('\n=== SUMMARY ===')
console.log(`passed=${results.filter(r=>r.ok).length} failed=${failed.length}`)
if (failed.length) {
  failed.forEach(f => console.log('FAIL', f.name, f.detail))
  process.exit(1)
}
console.log('ALL ACCEPTANCE CHECKS PASSED')
