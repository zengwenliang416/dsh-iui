/**
 * Wire-level acceptance for the three true-machine items:
 * 1) action → followup/steer (model continue)
 * 2) state → inject (next-turn context)
 * 3) slot: dsh-iui/ops append + client registers conversation.chat.node
 */
import { apply as applyHost } from '../src/host/plugin.ts'
import { apply as applyClient, attachBridge, getAttachedBridge } from '../src/client/plugin.ts'
import { DSH_IUI_ACTION_EVENT, DSH_IUI_OPS_EVENT } from '../src/host/events.ts'
import { IUI_CHAT_KIND } from '../src/client/definition.ts'

const results = []
function check(name, ok, detail = '') {
  results.push({ name, ok: !!ok, detail })
  console.log(ok ? 'PASS' : 'FAIL', name, detail || '')
}

const appended = []
const followups = []
const steers = []
const injects = []
const registeredDefs = []
const registeredSlots = []

const fakeSession = {
  id: 'wire-sess',
  append: (type, data) => {
    appended.push({ type, data })
    return { type, data }
  },
}

const fakeAgent = {
  session: fakeSession,
  followup: (msg) => followups.push(msg),
  steer: (msg) => steers.push(msg),
  inject: (msg) => injects.push(msg),
}

const hostCtx = {
  provide: (n, v) => { hostCtx._provided = { n, v }; return v },
  skills: { register: () => () => {} },
  agents: { roots: () => [fakeAgent] },
  emit: () => {},
  on: (event, handler) => {
    hostCtx._handlers = hostCtx._handlers || {}
    hostCtx._handlers[event] = hostCtx._handlers[event] || []
    hostCtx._handlers[event].push(handler)
  },
}

applyHost(hostCtx, { getSessionId: () => 'wire-sess' })
const api = hostCtx._provided.v
check('setup.host-provide-dshIui', !!api?.bridge)

// --- Slot / ops publish path (criterion 3 host side) ---
const fenceMsg = {
  id: 'm1',
  content: [
    { type: 'text', text: '看图。\n\n```dsh-iui\n{"blocks":[{"key":"c1","type":"chart","props":{"title":"T","series":[{"points":[{"x":1,"y":2}]}]}},{"key":"b1","type":"button","props":{"label":"Go","action":"go"}}]}\n```\n' },
  ],
}

const handlers = hostCtx._handlers['session/event'] || []
for (const h of handlers) {
  h(fakeSession, { type: 'assistant/message', data: { turn: 1, step: 1, message: fenceMsg } })
}

// wait microtasks for async publishOps
await new Promise((r) => setTimeout(r, 50))

const opsAppend = appended.find((a) => a.type === DSH_IUI_OPS_EVENT)
check('AccW3.ops-session-append', !!opsAppend && Array.isArray(opsAppend.data?.ops) && opsAppend.data.ops.length > 0, JSON.stringify(opsAppend?.data?.ops?.map(o => o.op + ':' + o.node?.type)))
check('AccW3.ops-sessionKey', opsAppend?.data?.sessionKey === 'wire-sess')

// Client slot registration
const clientCtx = {
  effect: (fn) => fn(),
  uiConversation: {
    events: {
      register: (def) => {
        registeredDefs.push(def)
        return () => {}
      },
    },
  },
  slots: {
    inject: (name, factory) => {
      registeredSlots.push({ name, factory })
      return factory()
    },
    register: (meta, view) => {
      registeredSlots.push({ register: meta, view })
      return meta
    },
  },
  remote: { session: { append: (type, data) => appended.push({ type, data, from: 'client' }) } },
}

applyClient(clientCtx)
check('AccW3.client-registers-ops-definition', registeredDefs.length >= 1)
const nodeReg = registeredSlots.find((s) => s.register?.name === 'conversation.chat.node' && s.register?.key === IUI_CHAT_KIND)
check('AccW3.slot-conversation.chat.node-key-dsh-iui', !!nodeReg, JSON.stringify(nodeReg?.register))

// --- AccW1: action → followup (model continue) ---
api.bridge.emitAction({ type: 'action', key: 'b1', action: 'go', payload: { ok: 1 } })
await new Promise((r) => setTimeout(r, 30))
const actionAppend = appended.find((a) => a.type === DSH_IUI_ACTION_EVENT && a.data?.action === 'go')
check('AccW1.action-appended', !!actionAppend, JSON.stringify(actionAppend?.data))
check('AccW1.followup-or-steer-called', followups.length + steers.length >= 1, `followups=${followups.length} steers=${steers.length}`)
const contMsg = followups[0] || steers[0]
const contText = typeof contMsg === 'string' ? contMsg : JSON.stringify(contMsg)
check('AccW1.continue-message-has-action-marker', contText.includes('dsh-iui action') || contText.includes('show_detail') || contText.includes('"action":"go"') || contText.includes('go'), contText.slice(0, 200))

// Wire path: session/event of type dsh-iui/action (browser → host)
followups.length = 0
steers.length = 0
for (const h of handlers) {
  h(fakeSession, {
    type: DSH_IUI_ACTION_EVENT,
    data: { sessionKey: 'wire-sess', key: 'prefs', action: 'save_prefs', payload: { values: { city: '上海' } } },
  })
}
await new Promise((r) => setTimeout(r, 30))
check('AccW1.wire-action-followup', followups.length + steers.length >= 1, `followups=${followups.length} steers=${steers.length}`)

// --- AccW2: state inject (handleAction → upsertState → agent.inject) ---
injects.length = 0
api.bridge.emitAction({
  type: 'action',
  key: 'prefs',
  action: 'save_prefs',
  payload: { values: { city: '上海', plan: '进阶' } },
})
await new Promise((r) => setTimeout(r, 30))

const stateCtx = api.getStateContext()
check(
  'AccW2.getStateContext-has-form',
  typeof stateCtx === 'string' &&
    stateCtx.includes('dsh-iui session-state') &&
    stateCtx.includes('prefs') &&
    stateCtx.includes('上海'),
  stateCtx,
)
check('AccW2.inject-called', injects.length >= 1, `injects=${injects.length}`)
const injText = JSON.stringify(injects[0] ?? '')
check(
  'AccW2.inject-has-session-state',
  injText.includes('dsh-iui session-state') && injText.includes('上海'),
  injText.slice(0, 300),
)

// Wire path also upserts+injects
injects.length = 0
for (const h of handlers) {
  h(fakeSession, {
    type: DSH_IUI_ACTION_EVENT,
    data: { sessionKey: 'wire-sess', key: 'prefs', action: 'save_prefs', payload: { values: { city: '上海' } } },
  })
}
await new Promise((r) => setTimeout(r, 30))
check('AccW2.wire-inject-called', injects.length >= 1, `injects=${injects.length}`)

import { formatStateForContext } from '../src/host/sessionWriteback.ts'
const formatted = formatStateForContext('wire-sess', { prefs: { formValues: { city: '上海' } } })
check('AccW2.format-state-for-context', formatted.includes('prefs') && formatted.includes('上海') && formatted.includes('dsh-iui session-state'), formatted)

const failed = results.filter((r) => !r.ok)
console.log('\n=== SUMMARY ===')
console.log(`passed=${results.filter((r) => r.ok).length} failed=${failed.length}`)
failed.forEach((f) => console.log('FAIL', f.name, f.detail))
if (failed.length) process.exit(1)
console.log('WIRE CHECKS DONE')
