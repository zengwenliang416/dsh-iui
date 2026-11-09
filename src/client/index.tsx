/**
 * dsh-iui, browser half. The `render_ui` tool view shows the card while the
 * Turn runs; once the Turn closes, its cards appear again under the final
 * answer unless their tool view is open, so folding the process never hides
 * the answer's card. Everything is read from persisted `tool/result` metadata.
 */

import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-tool/client'
import type {} from '@deepseek-ai/dsh-client-ui-chat/client'
import type { ThemeSnapshot } from '@deepseek-ai/dsh-client-ui-theme/client'
import type {
  ConversationLocationData, ConversationNodeDefinition, TurnLocation,
} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { FrameTheme } from '../catalog/protocol.ts'
import type { ResolvedCard } from '../catalog/spec.ts'
import { CardFrame } from './CardFrame.tsx'
import { cardFromMeta, stateKey } from './card-meta.ts'
import { createShownCards, type ShownCards } from './shown.ts'

/** Client plugin identity. */
export const name = 'dsh-iui'
/** Slots for the tool view and turn tail. */
export const inject = ['slots']

const TURN_CARDS_KEY = 'dsh-iui'
const TOOL_NAME = 'render_ui'

/** One settled card in a Turn. */
interface TurnCard {
  readonly callId: string
  readonly seq: number
  readonly card: ResolvedCard
}

declare module '@deepseek-ai/dsh-client-ui-conversation/client' {
  interface ConversationTurnDataMap {
    /** Settled `render_ui` cards of this Turn. */
    'dsh-iui': { readonly cards: readonly TurnCard[] }
  }
}

interface TurnCardsState {
  readonly turn: number
  readonly cards: readonly TurnCard[]
}

interface ToolResultData {
  readonly turn: number
  readonly meta?: unknown
  readonly message: { readonly isError?: boolean; readonly source: { readonly callId: unknown } }
}

const turnCardsDefinition: ConversationNodeDefinition<TurnCardsState> = {
  kind: TURN_CARDS_KEY,
  match: (event) => {
    if (event.type === 'turn/start') return { id: String(event.data.turn), role: 'start' }
    if (event.type !== 'tool/result') return null
    const data = event.data as ToolResultData
    return data.message.isError !== true && cardFromMeta(data.meta) !== undefined ? { id: String(data.turn), role: 'update' } : null
  },
  start: (_context, match) => {
    if (match.event.type !== 'turn/start') throw new Error('dsh-iui: turn cards start with turn/start')
    return { turn: match.event.data.turn, cards: [] }
  },
  update: (context, match) => {
    if (match.event.type !== 'tool/result') return context.state
    const data = match.event.data as ToolResultData
    const card = cardFromMeta(data.meta)
    const callId = String(data.message.source.callId)
    if (card === undefined || context.state.cards.some(existing => existing.callId === callId)) return context.state
    return { ...context.state, cards: [...context.state.cards, { callId, seq: match.event.seq, card }] }
  },
  buildLocationData: (context, scope, previous) => {
    if (scope !== 'turn' || context.state === undefined) return null
    const { turn, cards } = context.state
    if (previous?.kind === 'turn' && previous.key === TURN_CARDS_KEY && previous.value.cards === cards) return previous
    return { kind: 'turn', turn, key: TURN_CARDS_KEY, value: { cards } } satisfies ConversationLocationData
  },
}

/** Theme service surface the card reads; absent in compositions without a theme service. */
interface ThemeHost {
  getTheme(): ThemeSnapshot
}

function useFrameTheme(host: ThemeHost | undefined, subscribe: (listener: () => void) => () => void): FrameTheme {
  const mode = useSyncExternalStore(subscribe, () => host?.getTheme().active.colorScheme ?? 'light')
  return useMemo(() => ({ mode }), [mode])
}

interface Injected {
  readonly sessionId: string
  readonly shown: ShownCards
  readonly themeHost: ThemeHost | undefined
  readonly subscribeTheme: (listener: () => void) => () => void
}

function MountedCard({ callId, card, injected }: { callId: string; card: ResolvedCard; injected: Injected }) {
  const theme = useFrameTheme(injected.themeHost, injected.subscribeTheme)
  return <CardFrame card={card} theme={theme} storageKey={stateKey(injected.sessionId, callId)} />
}

/**
 * A folded process keeps its rows mounted and hides them with `hidden="until-found"`
 * and `content-visibility: hidden` on ancestors, so the tool-view card counts as
 * shown only while the browser reports it visible; folding toggles re-check it.
 */
function ToolCard({ callId, card, injected }: { callId: string; card: ResolvedCard; injected: Injected }) {
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const element = box.current
    if (element === null) return
    let release: (() => void) | undefined
    const sync = () => {
      const visible = element.checkVisibility()
      if (visible && release === undefined) release = injected.shown.mount(callId)
      else if (!visible && release !== undefined) {
        release()
        release = undefined
      }
    }
    const folds = new MutationObserver(sync)
    for (let ancestor = element.parentElement; ancestor !== null; ancestor = ancestor.parentElement) {
      folds.observe(ancestor, { attributes: true, attributeFilter: ['hidden', 'class', 'style'] })
    }
    const sizes = new ResizeObserver(sync)
    sizes.observe(element)
    sync()
    return () => {
      folds.disconnect()
      sizes.disconnect()
      release?.()
    }
  }, [callId, injected.shown])
  return <div ref={box}><MountedCard callId={callId} card={card} injected={injected} /></div>
}

const statusStyle = { fontSize: 13, opacity: 0.7, padding: '4px 0' } as const

/**
 * Tool view of `render_ui`: the card once its result settles, a short status before.
 * @param props - Tool view owner props and the injected session services.
 * @returns The card, status, or the error text.
 */
function RenderUiView(props: PropsRuntime<'tool.call.toolview'> & { dshIui: Injected }) {
  if (props.phase !== 'result') return <div style={statusStyle}>Preparing interactive card…</div>
  const card = props.block.isError ? undefined : cardFromMeta(props.block.meta)
  if (card === undefined) {
    const text = props.block.content.flatMap(part => part.type === 'text' ? [part.text] : []).join('\n')
    return <div style={statusStyle}>{text === '' ? 'The card could not be shown.' : text}</div>
  }
  return <ToolCard callId={props.callId} card={card} injected={props.dshIui} />
}

/**
 * Turn-tail entry: the closed Turn's cards that are not open in their tool view.
 * @param props - Turn-tail owner props and the injected session services.
 * @returns The cards, or null.
 */
function TurnCards(props: PropsRuntime<'conversation.chat.turnTail'> & { dshIui: Injected }) {
  const { shown } = props.dshIui
  useSyncExternalStore(shown.subscribe, shown.version)
  const turn: TurnLocation | undefined = props.turn
  const cards = (turn?.data?.get(TURN_CARDS_KEY)?.cards ?? []).filter(entry => entry.seq < props.seq && !shown.has(entry.callId))
  if (cards.length === 0) return null
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 12, margin: '8px 0 4px' }}>
      {cards.map(entry => <MountedCard key={entry.callId} callId={entry.callId} card={entry.card} injected={props.dshIui} />)}
    </div>
  )
}

/**
 * Register the tool view, the turn-card Definition, and the turn tail.
 * @param ctx - Client root context.
 */
export function apply(ctx: ClientContext): void {
  const shown = createShownCards()
  const themeHost = ctx.get('theme') as ThemeHost | undefined
  const subscribeTheme = (listener: () => void) => ctx.on('theme/change', listener)
  const injectFor = (sessionId: unknown) => ({ dshIui: { sessionId: String(sessionId), shown, themeHost, subscribeTheme } })
  ctx.slots.inject('tool.call.toolview', () => ctx.slots.register(
    { name: 'tool.call.toolview', key: TOOL_NAME, inject: injectFor },
    RenderUiView,
  ))
  ctx.inject(['uiConversation'], (scope) => {
    scope.uiConversation.events.register(turnCardsDefinition as ConversationNodeDefinition)
  })
  ctx.slots.inject('conversation.chat.turnTail', () => ctx.slots.register(
    { name: 'conversation.chat.turnTail', id: 'dsh-iui-cards', order: 110, inject: injectFor },
    TurnCards,
  ))
}
