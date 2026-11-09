/**
 * The sandboxed frame that hosts the isolated React 19 + Astryx renderer.
 * The frame has an opaque origin (`allow-scripts` only) and a CSP that forbids
 * every network connection, form submission, and external resource; messages
 * are accepted only from this frame's own window.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import type { CardState, FrameMessage, FrameTheme, RenderMessage } from '../catalog/protocol.ts'
import { EMPTY_STATE } from '../catalog/protocol.ts'
import type { ResolvedCard } from '../catalog/spec.ts'
import { ISLAND_CSS, ISLAND_JS } from './island-assets.generated.ts'
import { loadState, saveState } from './card-meta.ts'

const CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'"

/** Inline the renderer so the frame never fetches anything. */
const SRCDOC = [
  '<!doctype html><html><head><meta charset="utf-8">',
  `<meta http-equiv="Content-Security-Policy" content="${CSP}">`,
  `<style>${ISLAND_CSS.replaceAll('</style', '<\\/style')}</style>`,
  '<style>html,body{margin:0;padding:0;background:transparent;overflow:hidden}</style>',
  '</head><body><div id="root"></div>',
  `<script>${ISLAND_JS.replaceAll('</script', '<\\/script')}</script>`,
  '</body></html>',
].join('')

/**
 * Open an http or https address in a new tab without giving it a handle to this page; other schemes are ignored.
 * @param url - Address the reader clicked inside the card.
 */
function openWebAddress(url: string): void {
  if (!URL.canParse(url)) return
  const { protocol } = new URL(url)
  if (protocol === 'http:' || protocol === 'https:') window.open(url, '_blank', 'noopener,noreferrer')
}

/** Props of one card frame. */
export interface CardFrameProps {
  readonly card: ResolvedCard
  readonly theme: FrameTheme
  /** localStorage key of this card's reader state. */
  readonly storageKey: string
}

/**
 * Render one decided card in its sandboxed frame.
 * @param props - Card, theme, and state key.
 * @returns The frame sized to its content.
 */
export function CardFrame({ card, theme, storageKey }: CardFrameProps) {
  const frame = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState(120)
  const [ready, setReady] = useState(false)
  const state = useRef<CardState>(loadState(storageKey) ?? EMPTY_STATE)
  const message = useMemo(() => ({ kind: 'dsh-iui:render', card, theme, language: document.documentElement.lang || navigator.language }) as const, [card, theme])

  useEffect(() => {
    const onMessage = (event: MessageEvent<unknown>) => {
      if (event.source === null || event.source !== frame.current?.contentWindow) return
      const data = event.data as Partial<FrameMessage> | null
      if (data?.kind === 'dsh-iui:ready') setReady(true)
      else if (data?.kind === 'dsh-iui:height' && typeof data.height === 'number' && Number.isFinite(data.height)) {
        setHeight(Math.min(Math.max(Math.ceil(data.height), 40), 4000))
      } else if (data?.kind === 'dsh-iui:state' && data.state !== undefined) {
        state.current = data.state
        saveState(storageKey, data.state)
      } else if (data?.kind === 'dsh-iui:open' && typeof data.url === 'string') {
        openWebAddress(data.url)
      }
    }
    window.addEventListener('message', onMessage)
    return () => { window.removeEventListener('message', onMessage) }
  }, [storageKey])

  useEffect(() => {
    if (!ready) return
    const render: RenderMessage = { ...message, state: state.current }
    // The opaque-origin frame has no addressable origin, so the target is '*'; only this frame's window receives it.
    frame.current?.contentWindow?.postMessage(render, '*')
  }, [ready, message])

  return (
    <iframe
      ref={frame}
      title={card.spec.title ?? 'Interactive card'}
      sandbox="allow-scripts"
      srcDoc={SRCDOC}
      data-dsh-iui-card=""
      style={{ width: '100%', height, border: 0, display: 'block', colorScheme: theme.mode }}
    />
  )
}
