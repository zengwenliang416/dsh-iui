import { StrictMode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { IuiMount } from '../src/client/IuiMount'
import { attachBridge } from '../src/client/plugin'
import { createHostBridge } from '../src/host/bridge'
import { compilePayloadsToOps } from '../src/host/compile'
import { parseStreamingPayloads } from '../src/host/parseFence'
import { dumpSessionState } from '../src/state/sessionStore'
import type { IuiActionEvent } from '../types/ir'
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

type Mode = 'layout' | 'pending'

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

  const chunks = mode === 'layout' ? LAYOUT_CHUNKS : PENDING_CHUNKS

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
          {mode === 'layout' ? '完整 IR' : 'pending'} · chunk {chunk}/{chunks.length}
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
