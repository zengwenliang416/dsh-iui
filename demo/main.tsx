import { StrictMode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { IuiMount } from '../src/client/IuiMount'
import { attachBridge } from '../src/client/plugin'
import { createHostBridge } from '../src/host/bridge'
import { compilePayloadsToOps } from '../src/host/compile'
import { parseStreamingPayloads } from '../src/host/parseFence'
import { dumpSessionState } from '../src/state/sessionStore'
import type { IuiActionEvent } from '../src/types/ir'
import '../src/components/styles.css'
import './demo.css'

const SESSION = 'demo-session'

/** Primary: full-typed nested IR (type+布局). Concrete types → compile skips Jev. */
const LAYOUT_CHUNKS = [
  '先看趋势，再填偏好。左侧是销量图，右侧可改偏好并点操作。\n\n```dsh-iui\n{\n  "blocks": [\n',
  '    {\n      "key": "intro",\n      "type": "text",\n      "props": { "content": "主模型已给出完整 type + 嵌套布局（关 Jev 仍可渲染）。" }\n    },\n',
  '    {\n      "key": "main",\n      "type": "row",\n      "props": { "gap": 16, "align": "stretch", "wrap": true },\n      "children": [\n',
  '        {\n          "key": "sales",\n          "type": "chart",\n          "props": {\n            "title": "近四周销量",\n            "series": [{ "name": "销量", "points": [\n',
  '              { "x": "W1", "y": 12 }, { "x": "W2", "y": 18 }, { "x": "W3", "y": 15 }, { "x": "W4", "y": 22 }\n            ] }]\n          }\n        },\n',
  '        {\n          "key": "side",\n          "type": "col",\n          "props": { "gap": 12 },\n          "children": [\n',
  '            {\n              "key": "prefs",\n              "type": "form",\n              "props": {\n                "fields": [\n                  { "name": "city", "label": "城市", "kind": "text", "placeholder": "上海" },\n                  { "name": "plan", "label": "方案", "kind": "select", "options": ["基础", "进阶", "企业"] }\n                ],\n                "submitAction": "save_prefs",\n                "submitLabel": "保存偏好"\n              }\n            },\n',
  '            {\n              "key": "actions",\n              "type": "row",\n              "props": { "gap": 8, "justify": "start" },\n              "children": [\n                { "key": "btn-more", "type": "button", "props": { "label": "再看明细", "action": "show_detail" } },\n                { "key": "btn-reset", "type": "button", "props": { "label": "重置演示", "action": "reset_demo" } }\n              ]\n            }\n',
  '          ]\n        }\n',
  '      ]\n    }\n',
  '  ]\n}\n```\n',
]

/** Legacy pending stream (Jev fills type). */
const PENDING_CHUNKS = [
  '先看趋势，再填偏好。\n\n```dsh-iui\n{\n  "blocks": [\n',
  '    {\n      "key": "sales",\n      "type": "pending",\n      "props": {\n        "title": "近四周销量",\n        "series": [{ "name": "销量", "points": [\n',
  '          { "x": "W1", "y": 12 }, { "x": "W2", "y": 18 }, { "x": "W3", "y": 15 }, { "x": "W4", "y": 22 }\n        ] }]\n      }\n    },\n',
  '    {\n      "key": "prefs",\n      "type": "pending",\n      "props": {\n        "fields": [\n          { "name": "city", "label": "城市", "kind": "text", "placeholder": "上海" },\n          { "name": "plan", "label": "方案", "kind": "select", "options": ["基础", "进阶", "企业"] }\n        ],\n        "submitAction": "save_prefs",\n        "submitLabel": "保存偏好"\n      }\n    },\n',
  '    {\n      "key": "actions",\n      "type": "row",\n      "props": { "gap": 8 },\n      "children": [\n        { "key": "btn-more", "props": { "label": "再看明细", "action": "show_detail" } },\n        { "key": "btn-reset", "props": { "label": "重置演示", "action": "reset_demo" } }\n      ]\n    }\n',
  '  ]\n}\n```\n',
]

/** P0: roast-style checklist (local toggles). */
const ROAST_CHUNKS = [
  'Sunday roast 步骤：勾选后仅写本地状态，默认不回模型。\n\n```dsh-iui\n{\n  "blocks": [\n',
  '    {\n      "key": "roast-intro",\n      "type": "text",\n      "props": { "content": "烤鸡周日套餐 — 按顺序勾选步骤（本地持久，不回模型）。" }\n    },\n',
  '    {\n      "key": "roast-steps",\n      "type": "checklist",\n      "props": {\n        "title": "Sunday roast",\n        "local": true,\n        "items": [\n          { "id": "s1", "label": "预热烤箱到 180°C", "done": false },\n          { "id": "s2", "label": "腌制鸡腿 30 分钟", "done": false },\n          { "id": "s3", "label": "烤 45 分钟，中途翻面", "done": false },\n          { "id": "s4", "label": "静置 10 分钟再切", "done": false },\n          { "id": "s5", "label": "配菜上桌", "done": false }\n        ]\n      }\n    }\n',
  '  ]\n}\n```\n',
]

/** P0: monitoring card — stat + table coexisting. */
const MONITOR_CHUNKS = [
  '本轮监控卡：stat 指标 + table 明细，可与现有类型同树。\n\n```dsh-iui\n{\n  "blocks": [\n',
  '    {\n      "key": "mon-intro",\n      "type": "text",\n      "props": { "content": "服务健康总览（stat + table）。" }\n    },\n',
  '    {\n      "key": "mon-row",\n      "type": "row",\n      "props": { "gap": 16, "align": "stretch", "wrap": true },\n      "children": [\n',
  '        {\n          "key": "mon-stats",\n          "type": "stat",\n          "props": {\n            "items": [\n              { "label": "QPS", "value": "1.2k", "delta": "+8%" },\n              { "label": "错误率", "value": "0.12%", "delta": "-0.03%" },\n              { "label": "P99", "value": "186ms", "delta": "+12ms" }\n            ]\n          }\n        },\n',
  '        {\n          "key": "mon-table",\n          "type": "table",\n          "props": {\n            "title": "近 1h 实例",\n            "columns": ["实例", "CPU", "内存", "状态"],\n            "rows": [\n              ["api-a", "42%", "1.1G", "ok"],\n              ["api-b", "61%", "1.4G", "ok"],\n              ["worker-1", "28%", "900M", "ok"]\n            ]\n          }\n        }\n',
  '      ]\n    }\n',
  '  ]\n}\n```\n',
]

/** Slider + bind: guests → portions. */
const PEOPLE_CHUNKS = [
  '用餐人数联动份量：拖动滑块只写本地状态，兄弟节点按 bind 重算。\n\n```dsh-iui\n{\n  "blocks": [\n',
  '    {\n      "key": "party",\n      "type": "col",\n      "props": { "gap": 12 },\n      "children": [\n',
  '        {\n          "key": "party-intro",\n          "type": "text",\n          "props": { "content": "人数 → 份量（slider + 本地 bind，不回模型）。" }\n        },\n',
  '        {\n          "key": "guests-form",\n          "type": "form",\n          "props": {\n            "local": true,\n            "fields": [\n              {\n                "id": "guests",\n                "type": "slider",\n                "label": "用餐人数",\n                "min": 1,\n                "max": 12,\n                "step": 1,\n                "value": 4,\n                "local": true\n              }\n            ]\n          }\n        },\n',
  '        {\n          "key": "portions",\n          "type": "stat",\n          "props": { "label": "建议份量", "value": 8 },\n          "bind": { "from": "guests", "to": "value", "scale": 2, "offset": 0 }\n        },\n',
  '        {\n          "key": "portions-hint",\n          "type": "text",\n          "props": { "content": "8" },\n          "bind": { "from": "guests", "to": "content", "expr": "2 * $from + 0" }\n        }\n',
  '      ]\n    }\n',
  '  ]\n}\n```\n',
]

/** Slider + bind: principal / months → yield. */
const SAVINGS_CHUNKS = [
  '储蓄器：本金/月数滑块本地联动收益。\n\n```dsh-iui\n{\n  "blocks": [\n',
  '    {\n      "key": "savings",\n      "type": "col",\n      "props": { "gap": 12 },\n      "children": [\n',
  '        {\n          "key": "savings-intro",\n          "type": "text",\n          "props": { "content": "本金 → 预估收益（线性 bind）；月数本地显示。" }\n        },\n',
  '        {\n          "key": "savings-form",\n          "type": "form",\n          "props": {\n            "local": true,\n            "fields": [\n              {\n                "id": "principal",\n                "type": "slider",\n                "label": "本金",\n                "min": 1000,\n                "max": 50000,\n                "step": 500,\n                "value": 10000,\n                "local": true\n              },\n              {\n                "id": "months",\n                "type": "slider",\n                "label": "月数",\n                "min": 1,\n                "max": 36,\n                "step": 1,\n                "value": 12,\n                "local": true\n              }\n            ]\n          }\n        },\n',
  '        {\n          "key": "interest",\n          "type": "stat",\n          "props": { "label": "预估收益", "value": 300 },\n          "bind": { "from": "principal", "to": "value", "expr": "0.03 * $from + 0" }\n        },\n',
  '        {\n          "key": "term",\n          "type": "stat",\n          "props": { "label": "存期（月）", "value": 12 },\n          "bind": { "from": "months", "to": "value", "scale": 1, "offset": 0 }\n        }\n',
  '      ]\n    }\n',
  '  ]\n}\n```\n',
]


/** Diagram + hotspot: bicycle five systems. */
const DIAGRAM_CHUNKS = [
  '自行车五系统图解：点击分区本地高亮与说明，默认不回模型。\n\n```dsh-iui\n{\n  "blocks": [\n',
  '    {\n      "key": "bike",\n      "type": "row",\n      "props": { "gap": 16, "align": "stretch", "wrap": true },\n      "children": [\n',
  '        {\n          "key": "bike-diagram",\n          "type": "diagram",\n          "props": {\n            "title": "自行车五系统",\n            "local": true,\n            "selectedId": "drive",\n            "regions": [\n              { "id": "drive", "label": "传动", "x": 150, "y": 130, "w": 90, "h": 70, "body": "牙盘、链条、飞轮：把腿力传到后轮。" },\n              { "id": "brake", "label": "刹车", "x": 40, "y": 40, "w": 80, "h": 50, "body": "手闸与夹器：前后轮制动，点刹优于死刹。" },\n              { "id": "wheel", "label": "车轮", "x": 280, "y": 150, "w": 90, "h": 80, "body": "轮圈、辐条、轮胎：承重与滚动；胎压影响滚阻。" },\n              { "id": "frame", "label": "车架", "x": 140, "y": 50, "w": 100, "h": 55, "body": "主三角与后下叉：几何决定舒适与操控。" },\n              { "id": "gear", "label": "变速", "x": 250, "y": 40, "w": 80, "h": 50, "body": "拨链器与手变：按坡度选齿比，避免跨链。" }\n            ]\n          }\n        },\n',
  '        {\n          "key": "bike-side",\n          "type": "col",\n          "props": { "gap": 10 },\n          "children": [\n',
  '            { "key": "hs-drive", "type": "hotspot", "props": { "id": "drive", "label": "传动系统", "body": "踩踏 → 牙盘 → 链条 → 飞轮 → 后轮。保持链条清洁可显著降噪。", "visibleWhen": "drive" }, "visibleWhen": "drive" },\n',
  '            { "key": "hs-brake", "type": "hotspot", "props": { "id": "brake", "label": "刹车系统", "body": "前刹贡献大部分制动力；湿滑路面请提前预留距离。", "visibleWhen": "brake" }, "visibleWhen": "brake" },\n',
  '            { "key": "hs-wheel", "type": "hotspot", "props": { "id": "wheel", "label": "车轮系统", "body": "轮组强度与轮胎宽度权衡速度与舒适；检查辐条张力。", "visibleWhen": "wheel" }, "visibleWhen": "wheel" },\n',
  '            { "key": "hs-frame", "type": "hotspot", "props": { "id": "frame", "label": "车架系统", "body": "车架材质（钢/铝/碳）影响重量与吸振；立管高度需匹配身高。", "visibleWhen": "frame" }, "visibleWhen": "frame" },\n',
  '            { "key": "hs-gear", "type": "hotspot", "props": { "id": "gear", "label": "变速系统", "body": "爬坡用小盘大飞；平路大盘小飞。换挡时减轻踩踏力矩。", "visibleWhen": "gear" }, "visibleWhen": "gear" }\n',
  '          ]\n        }\n',
  '      ]\n    }\n',
  '  ]\n}\n```\n',
]

type Mode = 'layout' | 'pending' | 'roast' | 'monitor' | 'people' | 'savings' | 'diagram' | 'progressive'

function App() {
  const bridge = useMemo(() => {
    const b = createHostBridge(SESSION)
    attachBridge(b)
    return b
  }, [])
  const [mode, setMode] = useState<Mode>('layout')
  const [buf, setBuf] = useState('')
  const [chunk, setChunk] = useState(0)
  const [events, setEvents] = useState<IuiActionEvent[]>([])
  const [log, setLog] = useState<string[]>([])
  const [tick, setTick] = useState(0)
  const prevKeys = useRef(new Set<string>())

  const chunks =
    mode === 'layout'
      ? LAYOUT_CHUNKS
      : mode === 'pending'
        ? PENDING_CHUNKS
        : mode === 'roast'
          ? ROAST_CHUNKS
          : mode === 'monitor'
            ? MONITOR_CHUNKS
            : mode === 'people'
              ? PEOPLE_CHUNKS
              : mode === 'savings'
                ? SAVINGS_CHUNKS
                : mode === 'diagram'
                  ? DIAGRAM_CHUNKS
                  : []

  const pushLog = useCallback((line: string) => {
    setLog((L) => [line, ...L].slice(0, 12))
  }, [])

  const clearForest = useCallback(() => {
    const keys = [...prevKeys.current]
    if (keys.length) {
      bridge.pushOps(keys.map((key) => ({ op: 'remove' as const, key })))
    }
    prevKeys.current = new Set()
    setBuf('')
    setChunk(0)
    setEvents([])
    setTick((t) => t + 1)
  }, [bridge])

  useEffect(() => {
    return bridge.onAction((ev) => {
      setEvents((E) => [ev, ...E])
      pushLog(`action: ${ev.action} @ ${ev.key}`)
      setTick((t) => t + 1)
      if (ev.action === 'reset_demo') {
        clearForest()
        pushLog('已重置演示状态')
      }
    })
  }, [bridge, pushLog, clearForest])

  const compileFrom = async (text: string, label?: string) => {
    const payloads = parseStreamingPayloads(text)
    if (!payloads.length) {
      pushLog('尚无完整 fence，继续流式…')
      return
    }
    const { ops, keys } = await compilePayloadsToOps(payloads, prevKeys.current)
    prevKeys.current = keys
    if (ops.length) {
      bridge.pushOps(ops)
      const tag = label ?? (mode === 'layout' ? '完整 type，Jev 不介入' : 'pending→Jev')
      pushLog(`编译并推送 ${ops.length} 条 ops（${tag}）`)
      setTick((t) => t + 1)
    }
  }

  const streamNext = async () => {
    if (chunk >= chunks.length) {
      pushLog('流式文本已结束')
      return
    }
    const next = buf + chunks[chunk]
    setBuf(next)
    setChunk((c) => c + 1)
    await compileFrom(next)
  }

  const streamAll = async () => {
    let text = buf
    for (let i = chunk; i < chunks.length; i++) {
      text += chunks[i]
      setBuf(text)
      setChunk(i + 1)
      await compileFrom(text)
      await new Promise((r) => setTimeout(r, 280))
    }
  }

  const playLayoutSample = async () => {
    clearForest()
    setMode('layout')
    setLog(['关 Jev 多块并排样例'])
    let text = ''
    for (let i = 0; i < LAYOUT_CHUNKS.length; i++) {
      text += LAYOUT_CHUNKS[i]
      setBuf(text)
      setChunk(i + 1)
      await compileFrom(text, '完整 type，Jev 不介入')
      await new Promise((r) => setTimeout(r, 200))
    }
  }

  const playPendingSample = async () => {
    clearForest()
    setMode('pending')
    setLog(['旧 pending 流式样例'])
    let text = ''
    for (let i = 0; i < PENDING_CHUNKS.length; i++) {
      text += PENDING_CHUNKS[i]
      setBuf(text)
      setChunk(i + 1)
      await compileFrom(text, 'pending→Jev')
      await new Promise((r) => setTimeout(r, 200))
    }
  }

  const playRoastSample = async () => {
    clearForest()
    setMode('roast')
    setLog(['roast 步骤 checklist'])
    let text = ''
    for (let i = 0; i < ROAST_CHUNKS.length; i++) {
      text += ROAST_CHUNKS[i]
      setBuf(text)
      setChunk(i + 1)
      await compileFrom(text, 'checklist 本地勾选')
      await new Promise((r) => setTimeout(r, 160))
    }
  }

  const playMonitorSample = async () => {
    clearForest()
    setMode('monitor')
    setLog(['监控卡 stat+table'])
    let text = ''
    for (let i = 0; i < MONITOR_CHUNKS.length; i++) {
      text += MONITOR_CHUNKS[i]
      setBuf(text)
      setChunk(i + 1)
      await compileFrom(text, 'stat+table')
      await new Promise((r) => setTimeout(r, 160))
    }
  }

  const playPeopleSample = async () => {
    clearForest()
    setMode('people')
    setLog(['人数→份量 slider'])
    let text = ''
    for (let i = 0; i < PEOPLE_CHUNKS.length; i++) {
      text += PEOPLE_CHUNKS[i]
      setBuf(text)
      setChunk(i + 1)
      await compileFrom(text, 'slider+bind 人数')
      await new Promise((r) => setTimeout(r, 160))
    }
  }

  const playSavingsSample = async () => {
    clearForest()
    setMode('savings')
    setLog(['储蓄器 slider'])
    let text = ''
    for (let i = 0; i < SAVINGS_CHUNKS.length; i++) {
      text += SAVINGS_CHUNKS[i]
      setBuf(text)
      setChunk(i + 1)
      await compileFrom(text, 'slider+bind 储蓄')
      await new Promise((r) => setTimeout(r, 160))
    }
  }



  const playProgressiveSample = async () => {
    clearForest()
    setMode('progressive')
    setLog(['先壳后补全：upsert 壳 → patchProps'])
    // Stage 1: shell nodes (chart empty series, form field shell)
    bridge.pushOps([
      {
        op: 'upsert',
        node: {
          key: 'prog-intro',
          type: 'text',
          props: { content: '渐进编译演示：先出壳，再补全数据。' },
        },
      },
      {
        op: 'upsert',
        node: {
          key: 'prog-row',
          type: 'row',
          props: { gap: 16, align: 'stretch', wrap: true },
          children: [
            {
              key: 'prog-chart',
              type: 'chart',
              props: {
                title: '近四周销量（加载中…）',
                series: [{ name: '销量', points: [] }],
              },
            },
            {
              key: 'prog-form',
              type: 'form',
              props: {
                local: true,
                fields: [{ id: 'city', type: 'text', label: '城市' }],
              },
            },
          ],
        },
      },
    ])
    prevKeys.current = new Set(['prog-intro', 'prog-row', 'prog-chart', 'prog-form'])
    pushLog('阶段1：upsert 壳（chart 空 series + form 字段壳）')
    setTick((t) => t + 1)
    await new Promise((r) => setTimeout(r, 700))

    // Stage 2: patchProps fills series + form fields (local state keys untouched)
    bridge.pushOps([
      {
        op: 'patchProps',
        key: 'prog-chart',
        props: {
          title: '近四周销量',
          series: [
            {
              name: '销量',
              points: [
                { x: 'W1', y: 12 },
                { x: 'W2', y: 18 },
                { x: 'W3', y: 15 },
                { x: 'W4', y: 22 },
              ],
            },
          ],
        },
      },
      {
        op: 'patchProps',
        key: 'prog-form',
        props: {
          fields: [
            { id: 'city', type: 'text', label: '城市', placeholder: '上海' },
            { id: 'plan', type: 'select', label: '方案', options: ['基础', '进阶', '企业'] },
          ],
          submitAction: 'save_prefs',
          submitLabel: '保存偏好',
        },
      },
      {
        op: 'patchProps',
        key: 'prog-intro',
        props: { content: '渐进编译演示：壳已补全（patchProps，本地 state 不丢）。' },
      },
    ])
    pushLog('阶段2：patchProps 补 series / fields')
    setTick((t) => t + 1)
  }

  const playDiagramSample = async () => {
    clearForest()
    setMode('diagram')
    setLog(['五系统图解 diagram'])
    let text = ''
    for (let i = 0; i < DIAGRAM_CHUNKS.length; i++) {
      text += DIAGRAM_CHUNKS[i]
      setBuf(text)
      setChunk(i + 1)
      await compileFrom(text, 'diagram+hotspot 五系统')
      await new Promise((r) => setTimeout(r, 160))
    }
  }

  const persisted = useMemo(() => dumpSessionState(SESSION), [events, tick])

  return (
    <div className="demo">
      <header>
        <h1>dsh-iui 联调演示</h1>
        <p>
          主模型完整 IR（type+布局）→ 渲染；Jev 默认不介入。可选旧 pending 流验证兜底。
        </p>
      </header>
      <div className="toolbar">
        <button type="button" onClick={() => void playLayoutSample()}>
          关 Jev 多块并排样例
        </button>
        <button type="button" onClick={() => void playPendingSample()}>
          旧 pending 流式
        </button>
        <button type="button" onClick={() => void playRoastSample()}>
          roast 步骤 checklist
        </button>
        <button type="button" onClick={() => void playMonitorSample()}>
          监控卡 stat+table
        </button>
        <button type="button" onClick={() => void playPeopleSample()}>
          人数→份量
        </button>
        <button type="button" onClick={() => void playSavingsSample()}>
          储蓄器
        </button>
        <button type="button" onClick={() => void playDiagramSample()}>
          五系统图解
        </button>
        <button type="button" onClick={() => void playProgressiveSample()}>
          先壳后补全
        </button>
        <button type="button" onClick={() => void streamNext()}>
          下一步流式
        </button>
        <button type="button" onClick={() => void streamAll()}>
          自动流式播放
        </button>
        <button type="button" onClick={() => { clearForest(); setLog(['已清空']) }}>
          清空
        </button>
        <span className="meta">
          {mode === 'layout'
            ? '完整 IR'
            : mode === 'pending'
              ? 'pending'
              : mode === 'roast'
                ? 'checklist'
                : mode === 'monitor'
                  ? 'stat+table'
                  : mode === 'people'
                    ? '人数→份量'
                    : mode === 'savings'
                      ? '储蓄器'
                      : mode === 'diagram'
                        ? '五系统图解'
                        : '先壳后补全'} · chunk {chunk}/{chunks.length}
        </span>
      </div>
      <div className="grid">
        <section className="panel">
          <h2>渲染面（IuiMount）</h2>
          <IuiMount bridge={bridge} />
        </section>
        <aside className="panel">
          <h2>事件回传</h2>
          <pre>{JSON.stringify(events, null, 2) || '[]'}</pre>
          <h2>会话状态</h2>
          <pre>{JSON.stringify(persisted, null, 2)}</pre>
          <h2>日志</h2>
          <ul className="log">
            {log.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
