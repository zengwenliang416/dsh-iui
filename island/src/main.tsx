/**
 * Isolated card renderer: React 19 and Astryx inside the card's sandboxed
 * iframe. It receives the decided card from the host frame, renders each block
 * with its placed component, and reports its height and reader state back.
 */

import '@astryxdesign/core/reset.css'
import '@astryxdesign/core/astryx.css'
import { StrictMode, useEffect, useMemo, useState, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { Heading, VStack } from '@astryxdesign/core'
import { Theme, defineTheme } from '@astryxdesign/core/theme'
import { InternationalizationProvider } from '@astryxdesign/core/i18n'
import zhCN from '@astryxdesign/core/locales/zh-CN.generated.js'
import type { CardState, FrameMessage, FrameTheme, RenderMessage } from '../../src/catalog/protocol.ts'
import type { Block } from '../../src/catalog/spec.ts'
import { ChartView, ComparisonView, MetricsView } from './data-blocks.tsx'
import { CalculatorView, ChecklistView, ChoiceView, FaqView, SectionsView, StepsView } from './interactive-blocks.tsx'
import {
  CalendarView, GalleryView, GlossaryView, PeopleView, ShortcutsView, SourcesView, StatusView, TextView, TimelineView, TimerView, TreeView,
} from './more-blocks.tsx'
import { copyFor, CopyContext, openLink } from './shared.tsx'
import { CodeView, NoticeView, QuoteView, SummaryView, TagsView } from './static-blocks.tsx'

function post(message: FrameMessage): void {
  window.parent.postMessage(message, '*')
}

function BlockView({ block, component, index, state, update }: {
  block: Block; component: string; index: number; state: CardState; update: (state: CardState) => void
}): ReactNode {
  const key = String(index)
  const select = (value: string) => { update({ ...state, selections: { ...state.selections, [key]: value } }) }
  switch (block.type) {
    case 'summary': return <SummaryView block={block} component={component} />
    case 'notice': return <NoticeView block={block} component={component} />
    case 'quote': return <QuoteView block={block} component={component} />
    case 'tags': return <TagsView block={block} component={component} />
    case 'code': return <CodeView block={block} component={component} />
    case 'comparison': return <ComparisonView block={block} component={component} />
    case 'metrics': return <MetricsView block={block} component={component} />
    case 'chart': return <ChartView block={block} component={component} />
    case 'faq': return <FaqView block={block} component={component} />
    case 'text': return <TextView block={block} component={component} />
    case 'timeline': return <TimelineView block={block} component={component} />
    case 'tree': return <TreeView block={block} component={component} />
    case 'gallery': return <GalleryView block={block} component={component} />
    case 'glossary': return <GlossaryView block={block} component={component} />
    case 'shortcuts': return <ShortcutsView block={block} component={component} />
    case 'sources': return <SourcesView block={block} component={component} />
    case 'status': return <StatusView block={block} component={component} />
    case 'timer': return <TimerView block={block} component={component} />
    case 'people': return <PeopleView block={block} component={component} />
    case 'calendar': return <CalendarView block={block} component={component} selected={state.selections[key]} select={select} />
    case 'choice': return <ChoiceView block={block} component={component} selected={state.selections[key]} select={select} />
    case 'sections': return <SectionsView block={block} component={component} selected={state.selections[key]} select={select} />
    case 'steps': {
      const saved = Number(state.selections[key])
      const active = Number.isInteger(saved) && saved >= 0 && saved < block.steps.length ? saved : block.current ?? 0
      return <StepsView block={block} component={component} active={active} activate={(next) => { select(String(next)) }} />
    }
    case 'checklist':
      return (
        <ChecklistView block={block} component={component} checked={state.checks[key] ?? []}
          change={(ids) => { update({ ...state, checks: { ...state.checks, [key]: ids } }) }} />
      )
    case 'calculator':
      return (
        <CalculatorView block={block} component={component} values={state.values[key] ?? {}}
          change={(input, value) => { update({ ...state, values: { ...state.values, [key]: { ...state.values[key], [input]: value } } }) }} />
      )
  }
}

function themeFor(frame: FrameTheme | undefined) {
  const accent = frame?.accent
  return defineTheme({ name: 'dsh', tokens: accent === undefined ? {} : { '--color-accent': [accent, accent] } })
}

function App() {
  const [message, setMessage] = useState<RenderMessage | null>(null)
  const [state, setState] = useState<CardState | null>(null)
  useEffect(() => {
    const onMessage = (event: MessageEvent<unknown>) => {
      if (event.source !== window.parent) return
      const data = event.data as Partial<RenderMessage> | null
      if (data?.kind !== 'dsh-iui:render') return
      const render = data as RenderMessage
      setMessage(render)
      // Older saved state predates checklist ticks.
      setState({ ...render.state, checks: render.state.checks ?? {} })
    }
    window.addEventListener('message', onMessage)
    post({ kind: 'dsh-iui:ready' })
    return () => { window.removeEventListener('message', onMessage) }
  }, [])
  useEffect(() => {
    // Measure the content, not the document: the document's scrollHeight never drops below the frame's
    // current height, so a card that grew once would keep its height after it shrinks.
    const content = document.getElementById('root')
    if (content === null) return
    const report = () => { post({ kind: 'dsh-iui:height', height: Math.ceil(content.getBoundingClientRect().height) }) }
    const observer = new ResizeObserver(report)
    observer.observe(content)
    report()
    return () => { observer.disconnect() }
  }, [])
  const theme = useMemo(() => themeFor(message?.theme), [message?.theme])
  const copy = useMemo(() => copyFor(message?.language ?? 'en'), [message?.language])
  if (message === null || state === null) return null
  const update = (next: CardState) => {
    setState(next)
    post({ kind: 'dsh-iui:state', state: next })
  }
  const { card } = message
  return (
    <CopyContext.Provider value={copy}>
      <InternationalizationProvider {...copy.locale === 'zh-CN' ? { locale: 'zh-CN', messages: { 'zh-CN': zhCN } } : { locale: 'en' }}>
        <Theme theme={theme} mode={message.theme.mode}>
          <VStack gap={4}>
            {card.spec.title !== undefined && <Heading level={2}>{card.spec.title}</Heading>}
            {card.spec.blocks.map((block, index) => (
              <BlockView key={index} block={block} component={card.placements[index]?.component ?? ''} index={index} state={state} update={update} />
            ))}
          </VStack>
        </Theme>
      </InternationalizationProvider>
    </CopyContext.Provider>
  )
}

// Links rendered by components (Citation, Markdown) go to the host instead of navigating the frame.
document.addEventListener('click', (event) => {
  const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null
  if (anchor === null) return
  event.preventDefault()
  openLink((anchor as HTMLAnchorElement).href)
}, true)

const root = document.getElementById('root')
if (root !== null) createRoot(root).render(<StrictMode><App /></StrictMode>)
