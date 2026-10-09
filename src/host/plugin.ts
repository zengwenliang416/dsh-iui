import { createHostBridge } from './bridge'
import { compilePayloadsToOps } from './compile'
import { DSH_IUI_ACTION_EVENT, DSH_IUI_OPS_EVENT, type DshIuiOpsEventData } from './events'
import { parseStreamingPayloads } from './parseFence'
import {
  DSH_IUI_SKILL_DESCRIPTION,
  DSH_IUI_SKILL_NAME,
  DSH_IUI_SKILL_BODY,
} from './skill'
import { formatActionForContext, formatStateForContext, handleAction } from './sessionWriteback'
import { textFromContent } from './text'
import { buildUserMessage } from './userMessage'
import type { IuiActionEvent, SessionStateSlice } from '../types/ir'

export const name = 'dsh-iui-host'
/** Soft deps — Cordis resolves when present in the profile. */
export const inject: string[] = []

export type HostPluginOptions = {
  confidenceThreshold?: number
  /** Default false: skip Jev; only fill missing/invalid types when true. */
  jevEnabled?: boolean
  getSessionId?: () => string
}

type SessionLike = {
  id?: string
  append: (type: string, data: unknown) => unknown
}

type AgentLike = {
  session: SessionLike
  steer: (message: unknown) => void
  inject: (message: unknown) => void
  followup?: (message: unknown) => void
}

type LooseCtx = {
  provide: (name: string, value: unknown) => unknown
  get?: (name: string) => unknown
  skills?: {
    register?: (skill: {
      name: string
      description: string
      body?: string
      content?: string
    }) => () => void
  }
  on?: (event: string, handler: (...args: unknown[]) => void, opts?: { global?: boolean }) => void
  emit?: (event: string, payload: unknown) => void
  sessions?: unknown
  agents?: {
    roots?: () => AgentLike[]
    get?: (id: string) => AgentLike | undefined
  }
}

/**
 * Host apply: provide `dshIui` + skill + compile on assistant settlement +
 * durable `dsh-iui/ops` session events for the Web Client over the wire.
 */
export function apply(ctx: unknown, options: HostPluginOptions = {}): void {
  const c = ctx as LooseCtx
  const sessionId = options.getSessionId?.() ?? 'default'
  const bridge = createHostBridge(sessionId)
  let prevKeys = new Set<string>()
  const hostState: Record<string, SessionStateSlice> = {}
  /** Avoid re-compiling the same assistant message. */
  const seenMessages = new Set<string>()

  const publishOps = async (
    session: SessionLike | null,
    text: string,
    meta: { turn?: number; step?: number; sourceMessageId?: string } = {},
  ) => {
    const payloads = parseStreamingPayloads(text)
    if (!payloads.length) return
    const { ops, keys } = await compilePayloadsToOps(payloads, prevKeys, {
      confidenceThreshold: options.confidenceThreshold ?? 0.7,
      jevEnabled: options.jevEnabled === true,
      intentSummary: '',
    })
    prevKeys = keys
    if (!ops.length) return

    bridge.pushOps(ops)
    const sid = String(session?.id ?? bridge.sessionId)
    const data: DshIuiOpsEventData = {
      sessionKey: sid,
      turn: meta.turn,
      step: meta.step,
      ops,
      sourceMessageId: meta.sourceMessageId,
    }
    c.emit?.('dsh-iui.ops', data)
    try {
      session?.append(DSH_IUI_OPS_EVENT, data)
    } catch (err) {
      console.info('[dsh-iui-host] session.append dsh-iui/ops failed', err)
    }
  }

  const api = {
    bridge,
    onAssistantDelta: async (text: string) => {
      await publishOps(null, text)
    },
    getStateContext: () => formatStateForContext(bridge.sessionId, hostState),
  }

  c.provide('dshIui', api)

  try {
    c.skills?.register?.({
      name: DSH_IUI_SKILL_NAME,
      description: DSH_IUI_SKILL_DESCRIPTION,
      body: DSH_IUI_SKILL_BODY,
      content: DSH_IUI_SKILL_BODY,
    })
  } catch {
    console.info('[dsh-iui-host] skills.register unavailable; skill exported for manual mount')
  }

  // Settlement path: assistant/message → compile → durable ops event (cross-process).
  c.on?.(
    'session/event',
    (session, event) => {
      const s = session as SessionLike
      const ev = event as {
        type?: string
        data?: {
          turn?: number
          step?: number
          message?: { id?: string; content?: unknown }
        }
      }
      if (ev?.type !== 'assistant/message') return
      const msg = ev.data?.message
      const mid = msg?.id
      if (mid && seenMessages.has(mid)) return
      if (mid) seenMessages.add(mid)
      const text = textFromContent(msg?.content)
      if (!text.includes('```dsh-iui')) return
      void publishOps(s, text, {
        turn: ev.data?.turn,
        step: ev.data?.step,
        sourceMessageId: mid,
      })
    },
    { global: true },
  )

  const findRootAgent = (session: SessionLike | null): AgentLike | undefined => {
    const roots = c.agents?.roots?.() ?? []
    if (!session) return roots[0]
    return roots.find((a) => a.session === session || String(a.session?.id) === String(session.id))
  }

  bridge.onAction(async (ev: IuiActionEvent) => {
    await handleAction(bridge.sessionId, ev, {
      issueActionTurn: async (sid, event) => {
        const msgText = formatActionForContext(event)
        c.emit?.('dsh-iui.action', { sessionId: sid, event, message: msgText })
        try {
          const agent = findRootAgent(null)
          const session = agent?.session
          session?.append(DSH_IUI_ACTION_EVENT, {
            sessionKey: sid,
            key: event.key,
            action: event.action,
            payload: event.payload,
          })
          const userMsg = buildUserMessage(msgText, 'dsh-iui-action')
          // Prefer followup (new turn) so the model continues the chat.
          if (agent?.followup) agent.followup(userMsg)
          else agent?.steer(userMsg)
        } catch (err) {
          console.info('[dsh-iui-host] action writeback failed', err)
        }
      },
      upsertState: (sid, blockKey, slice) => {
        hostState[blockKey] = { ...hostState[blockKey], ...slice }
        const ctxText = formatStateForContext(sid, hostState)
        c.emit?.('dsh-iui.state', { sessionId: sid, state: hostState, context: ctxText })
        try {
          const agent = findRootAgent(null)
          agent?.inject(
            buildUserMessage(ctxText, 'dsh-iui-state'),
          )
        } catch (err) {
          console.info('[dsh-iui-host] state inject failed', err)
        }
      },
    })
  })


  // Cross-process: browser appends dsh-iui/action → followup/steer/inject (no re-append).
  c.on?.(
    'session/event',
    (_session, event) => {
      const ev = event as {
        type?: string
        data?: { sessionKey?: string; key?: string; action?: string; payload?: Record<string, unknown> }
      }
      if (ev?.type !== DSH_IUI_ACTION_EVENT) return
      if (!ev.data?.key || !ev.data?.action) return
      const actionEv: IuiActionEvent = {
        type: 'action',
        key: ev.data.key,
        action: ev.data.action,
        payload: ev.data.payload,
      }
      void handleAction(ev.data.sessionKey ?? bridge.sessionId, actionEv, {
        issueActionTurn: async (_sid, event) => {
          const msgText = formatActionForContext(event)
          c.emit?.('dsh-iui.action', { sessionId: _sid, event, message: msgText })
          try {
            const agent = findRootAgent(null)
            const userMsg = buildUserMessage(msgText, 'dsh-iui-action')
            if (agent?.followup) agent.followup(userMsg)
            else agent?.steer(userMsg)
          } catch (err) {
            console.info('[dsh-iui-host] wire action writeback failed', err)
          }
        },
        upsertState: (sid, blockKey, slice) => {
          hostState[blockKey] = { ...hostState[blockKey], ...slice }
          const ctxText = formatStateForContext(sid, hostState)
          c.emit?.('dsh-iui.state', { sessionId: sid, state: hostState, context: ctxText })
          try {
            const agent = findRootAgent(null)
            agent?.inject(buildUserMessage(ctxText, 'dsh-iui-state'))
          } catch (err) {
            console.info('[dsh-iui-host] wire state inject failed', err)
          }
        },
      })
    },
    { global: true },
  )

  console.info('[dsh-iui-host] loaded (provide dshIui + session ops + action steer)')
}

export { createHostBridge, compilePayloadsToOps, parseStreamingPayloads }
