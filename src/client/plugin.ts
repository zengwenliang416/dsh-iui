import type { IuiActionEvent, IuiOp } from '../types/ir'
import { IUI_CHAT_KIND, iuiDefinition } from './definition'
import { IuiChatNodeView } from './IuiChatNode'
import { DSH_IUI_ACTION_EVENT } from './events'

export const name = 'dsh-iui-client'
/** Browser Cordis services — no host-only `dshIui`. */
export const inject = ['slots', 'uiConversation', 'remote']

export type HostBridge = {
  onOps: (handler: (ops: IuiOp[]) => void) => () => void
  emitAction: (ev: IuiActionEvent) => void
  sessionId: string
}

export type DshIuiCtx = {
  effect?: (fn: () => void | (() => void), label?: string) => void
  slots: {
    inject: (name: string, factory: () => unknown) => void
    register: (
      meta: { name: string; key?: string; id?: string; inject?: (sessionId: string) => unknown },
      view: unknown,
    ) => unknown
  }
  uiConversation: {
    events: {
      register: (definition: unknown) => () => void
    }
  }
  remote?: {
    session?: {
      append?: (type: string, data: unknown) => void
    }
  }
  /** Optional host bridge when loaded in the same process (demo / smoke). */
  dshIui?: { bridge?: HostBridge }
  on?: (event: string, handler: (...args: unknown[]) => void) => void
}

let attached: HostBridge | null = null

export function getAttachedBridge(): HostBridge | null {
  return attached
}

export function attachBridge(bridge: HostBridge): () => void {
  attached = bridge
  return () => {
    if (attached === bridge) attached = null
  }
}

/**
 * Web client: register conversationEvents match for `dsh-iui/ops`,
 * then mount `conversation.chat.node` keyed renderer.
 */
export function apply(ctx: unknown): void {
  const c = ctx as DshIuiCtx

  if (c.dshIui?.bridge) {
    attachBridge(c.dshIui.bridge)
    console.info('[dsh-iui-client] optional in-process bridge attached', c.dshIui.bridge.sessionId)
  }

  const run = (fn: () => void | (() => void), label: string) => {
    if (c.effect) c.effect(fn, label)
    else fn()
  }

  run(() => c.uiConversation.events.register(iuiDefinition), 'dsh-iui: conversation definition')

  run(
    () =>
      c.slots.inject('conversation.chat.node', () =>
        c.slots.register(
          {
            name: 'conversation.chat.node',
            key: IUI_CHAT_KIND,
            inject: () => ({
              emitAction: (ev: IuiActionEvent) => {
                attached?.emitAction(ev)
              },
              appendSessionEvent: (type: string, data: unknown) => {
                try {
                  c.remote?.session?.append?.(type, data)
                } catch (err) {
                  console.info('[dsh-iui-client] appendSessionEvent failed', type, err)
                }
                // Host picks up durable dsh-iui/action from the session wire.
              },
            }),
          },
          IuiChatNodeView,
        ),
      ),
    'dsh-iui: chat.node renderer',
  )

  console.info('[dsh-iui-client] registered match dsh-iui/ops + conversation.chat.node')
}
