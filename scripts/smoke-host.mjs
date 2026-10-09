import {
  parseStreamingPayloads,
  compilePayloadsToOps,
  formatActionForContext,
  createHostBridge,
} from '../src/host/index.ts'

const fenceOpen = '```' + 'dsh-iui\n'
const fenceClose = '\n```'
const buf =
  'Here is a chart and a form.\n\n' +
  fenceOpen +
  JSON.stringify(
    {
      blocks: [
        {
          key: 'layout',
          type: 'row',
          props: { gap: 8 },
          children: [
            {
              key: 'c1',
              type: 'chart',
              props: {
                title: 'Sales',
                series: [{ name: 'Q', points: [{ x: 'a', y: 1 }, { x: 'b', y: 2 }] }],
              },
            },
            {
              key: 'f1',
              type: 'form',
              props: {
                fields: [{ name: 'email', label: 'Email', kind: 'text' }],
                submitAction: 'submit_email',
              },
            },
          ],
        },
        {
          key: 'b1',
          type: 'button',
          props: { label: 'Go', action: 'go' },
        },
      ],
    },
    null,
    2,
  ) +
  fenceClose +
  '\n\nincomplete fence should be ignored:\n' +
  fenceOpen +
  '{ "blocks": [\n'

const payloads = parseStreamingPayloads(buf)
console.assert(payloads.length === 2, 'expected 2 complete root payloads, got ' + payloads.length)

const { ops } = await compilePayloadsToOps(payloads, new Set())
const types = []
const walk = (n) => {
  types.push(n.type)
  ;(n.children || []).forEach(walk)
}
ops.filter((o) => o.op === 'upsert').forEach((o) => walk(o.node))
console.assert(types.includes('row'), 'row')
console.assert(types.includes('chart'), 'chart')
console.assert(types.includes('form'), 'form')
console.assert(types.includes('button'), 'button')
console.assert(!types.includes('pending'), 'no pending')

const pendingBody =
  fenceOpen +
  JSON.stringify({
    blocks: [
      {
        key: 'p',
        type: 'pending',
        props: { series: [{ points: [{ x: 1, y: 2 }] }] },
      },
    ],
  }) +
  fenceClose
const pending = parseStreamingPayloads(pendingBody)
const { ops: dropOps } = await compilePayloadsToOps(pending, new Set(), { jevEnabled: false })
console.assert(dropOps.filter((o) => o.op === 'upsert').length === 0, 'pending dropped when jev off')

const { ops: jevOps } = await compilePayloadsToOps(pending, new Set(), { jevEnabled: true })
const jevTypes = jevOps.filter((o) => o.op === 'upsert').map((o) => o.node.type)
console.assert(jevTypes.includes('chart'), 'jev fallback chart')

const bridge = createHostBridge('sess-1')
let got = null
bridge.onOps((batch) => {
  got = batch
})
bridge.pushOps(ops)
console.assert(got && got.length === ops.length, 'bridge ops')

const actionMsg = formatActionForContext({
  type: 'action',
  key: 'b1',
  action: 'go',
  payload: { ok: true },
})
console.assert(actionMsg.includes('dsh-iui action'), 'action format')

console.log('smoke-host ok', { types, ops: ops.length })
