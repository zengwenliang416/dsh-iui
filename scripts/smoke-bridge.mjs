import { createHostBridge } from '../src/host/bridge.ts'
import { compilePayloadsToOps } from '../src/host/compile.ts'
import { parseStreamingPayloads } from '../src/host/parseFence.ts'
import { applyOps } from '../src/ops/tree.ts'
import { attachBridge, getAttachedBridge } from '../src/client/plugin.ts'

const text = `
\`\`\`dsh-iui
{
  "blocks": [
    { "key": "c1", "type": "chart", "props": { "title": "T", "series": [{ "points": [{ "x": 1, "y": 2 }] }] } },
    { "key": "f1", "type": "form", "props": { "fields": [{ "name": "n", "kind": "text" }], "submitAction": "s" } },
    { "key": "b1", "type": "button", "props": { "label": "Go", "action": "go" } }
  ]
}
\`\`\`
`

const bridge = createHostBridge('bridge-smoke')
attachBridge(bridge)
console.assert(getAttachedBridge()?.sessionId === 'bridge-smoke', 'attach')

let forest = []
bridge.onOps((ops) => {
  forest = applyOps(forest, ops)
})

let actionHit = null
bridge.onAction((ev) => {
  actionHit = ev
})

const payloads = parseStreamingPayloads(text)
const { ops } = await compilePayloadsToOps(payloads, new Set(), { jevEnabled: false })
bridge.pushOps(ops)

const types = forest.map((n) => n.type).sort()
console.assert(types.includes('chart') && types.includes('form') && types.includes('button'), 'forest types ' + types)
console.assert(!forest.some((n) => n.type === 'pending'), 'no pending in forest')

bridge.emitAction({ type: 'action', key: 'b1', action: 'go', payload: { ok: 1 } })
console.assert(actionHit?.action === 'go', 'action roundtrip')

console.log('smoke-bridge ok', { types, nodes: forest.length })
