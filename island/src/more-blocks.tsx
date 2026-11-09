/**
 * Text, timeline, tree, gallery, glossary, shortcuts, sources, status, timer,
 * people, and calendar blocks. Links never navigate the frame: the renderer
 * hands them to the host, which opens web addresses outside the card.
 */

import { useEffect, useMemo, useState, type ComponentProps } from 'react'
import {
  Avatar, Badge, Button, Calendar, Card, Carousel, Citation, Grid, HStack, InfoTip, Kbd, List, ListItem, Markdown,
  MetadataList, MetadataListItem, ProgressBar, StatusDot, Step, Stepper, Table, Text, Timer, TreeList, VStack,
} from '@astryxdesign/core'
import type { TreeListItemData } from '@astryxdesign/core/TreeList'
import type {
  CalendarBlock, GalleryBlock, GlossaryBlock, PeopleBlock, ShortcutsBlock, SourcesBlock, StatusBlock, TextBlock,
  TimelineBlock, TimerBlock, TreeBlock, TreeNode,
} from '../../src/catalog/spec.ts'
import { BlockTitle, openLink, useCopy } from './shared.tsx'

/** Markdown explanation; links open outside the card. */
export function TextView({ block, component }: { block: TextBlock; component: string }) {
  return (
    <VStack gap={2}>
      <BlockTitle title={block.title} />
      <Markdown density={component === 'compact' ? 'compact' : 'default'} headingLevelStart={4}
        onLinkClick={(href) => { openLink(href); return false }}>
        {block.markdown}
      </Markdown>
    </VStack>
  )
}

/** Timeline as vertical steps or a dated list. */
export function TimelineView({ block, component }: { block: TimelineBlock; component: string }) {
  if (component === 'vertical-steps') {
    return (
      <VStack gap={2}>
        <BlockTitle title={block.title} />
        <Stepper activeStep={block.events.length} orientation="vertical">
          {block.events.map((event, index) => (
            <Step key={index} step={index} label={`${event.date} · ${event.title}`} {...event.detail === undefined ? {} : { description: event.detail }} />
          ))}
        </Stepper>
      </VStack>
    )
  }
  return (
    <VStack gap={2}>
      <BlockTitle title={block.title} />
      <List density="balanced" hasDividers>
        {block.events.map((event, index) => (
          <ListItem key={index} label={event.title} startContent={<Text type="supporting" hasTabularNumbers>{event.date}</Text>}
            {...event.detail === undefined ? {} : { description: event.detail }} />
        ))}
      </List>
    </VStack>
  )
}

function treeItems(nodes: readonly TreeNode[], prefix: string): TreeListItemData[] {
  return nodes.map((node, index) => {
    const id = `${prefix}${String(index)}`
    return {
      id,
      label: node.label,
      ...node.detail === undefined ? {} : { description: node.detail },
      ...node.children === undefined || node.children.length === 0 ? {} : { children: treeItems(node.children, `${id}.`), isExpanded: prefix === '' },
    }
  })
}

function NestedList({ nodes, depth }: { nodes: readonly TreeNode[]; depth: number }) {
  return (
    <VStack gap={1}>
      {nodes.map((node, index) => (
        <div key={index} style={{ paddingInlineStart: depth * 16 }}>
          <Text weight={depth === 0 ? 'semibold' : 'normal'}>{node.label}</Text>
          {node.detail !== undefined && <Text type="supporting"> — {node.detail}</Text>}
          {node.children !== undefined && <NestedList nodes={node.children} depth={depth + 1} />}
        </div>
      ))}
    </VStack>
  )
}

/** Hierarchy as an expandable tree or an indented list. */
export function TreeView({ block, component }: { block: TreeBlock; component: string }) {
  const items = useMemo(() => treeItems(block.nodes, ''), [block.nodes])
  return (
    <VStack gap={2}>
      <BlockTitle title={block.title} />
      {component === 'tree' ? <TreeList items={items} density="balanced" /> : <NestedList nodes={block.nodes} depth={0} />}
    </VStack>
  )
}

/** Parallel items as a carousel or a grid. */
export function GalleryView({ block, component }: { block: GalleryBlock; component: string }) {
  const cards = block.items.map(item => (
    <Card key={item.title} padding={4} variant="muted" {...component === 'carousel' ? { width: 280 } : {}}>
      <VStack gap={2}>
        {item.tag !== undefined && <HStack><Badge variant="info" label={item.tag} /></HStack>}
        <Text weight="semibold">{item.title}</Text>
        <Text type="supporting">{item.text}</Text>
      </VStack>
    </Card>
  ))
  return (
    <VStack gap={2}>
      <BlockTitle title={block.title} />
      {component === 'carousel'
        ? <Carousel aria-label={block.title ?? block.items[0]?.title ?? ''} gap={3} hasButtons>{cards}</Carousel>
        : <Grid columns={{ minWidth: 220 }} gap={3}>{cards}</Grid>}
    </VStack>
  )
}

/** Glossary as a definition list, inline definition tips, or a list. */
export function GlossaryView({ block, component }: { block: GlossaryBlock; component: string }) {
  if (component === 'metadata') {
    return (
      <MetadataList {...block.title === undefined ? {} : { title: block.title }} columns="single" label={{ position: 'start', width: 140 }}>
        {block.terms.map(term => <MetadataListItem key={term.term} label={term.term}>{term.definition}</MetadataListItem>)}
      </MetadataList>
    )
  }
  if (component === 'infotips') {
    return (
      <VStack gap={2}>
        <BlockTitle title={block.title} />
        <HStack gap={3} wrap="wrap">
          {block.terms.map(term => (
            <HStack key={term.term} gap={1} align="center">
              <Text weight="medium">{term.term}</Text>
              <InfoTip label={term.term} content={term.definition} size="sm" />
            </HStack>
          ))}
        </HStack>
      </VStack>
    )
  }
  return (
    <VStack gap={2}>
      <BlockTitle title={block.title} />
      <List density="balanced" hasDividers>
        {block.terms.map(term => <ListItem key={term.term} label={term.term} description={term.definition} />)}
      </List>
    </VStack>
  )
}

/** Shortcuts as a table or a list, with keys drawn as keyboard keys. */
export function ShortcutsView({ block, component }: { block: ShortcutsBlock; component: string }) {
  const copy = useCopy()
  if (component === 'table') {
    const data = block.shortcuts.map((shortcut, index) => ({ id: index, keys: shortcut.keys, action: shortcut.action }))
    return (
      <VStack gap={2}>
        <BlockTitle title={block.title} />
        <Table data={data} idKey="id" dividers="rows" density="compact"
          columns={[
            { key: 'keys', header: copy.keys, renderCell: (row: { keys: string }) => <Kbd keys={row.keys} /> },
            { key: 'action', header: copy.action },
          ]} />
      </VStack>
    )
  }
  return (
    <VStack gap={2}>
      <BlockTitle title={block.title} />
      <List density="balanced">
        {block.shortcuts.map(shortcut => <ListItem key={shortcut.keys} label={shortcut.action} endContent={<Kbd keys={shortcut.keys} />} />)}
      </List>
    </VStack>
  )
}

/** Sources as numbered citations or a link list; both open outside the card. */
export function SourcesView({ block, component }: { block: SourcesBlock; component: string }) {
  if (component === 'citations') {
    return (
      <VStack gap={2}>
        <BlockTitle title={block.title} />
        {block.sources.map((source, index) => (
          <HStack key={source.url} gap={2} align="center">
            <Citation source={{ title: source.title, url: source.url }} number={index + 1} variant="number" />
            <Text>{source.title}</Text>
            {source.note !== undefined && <Text type="supporting">· {source.note}</Text>}
          </HStack>
        ))}
      </VStack>
    )
  }
  return (
    <VStack gap={2}>
      <BlockTitle title={block.title} />
      <List density="balanced" hasDividers>
        {block.sources.map(source => (
          <ListItem key={source.url} label={source.title} description={source.note ?? new URL(source.url).hostname}
            onClick={() => { openLink(source.url) }} />
        ))}
      </List>
    </VStack>
  )
}

const DOT_VARIANT = { ok: 'success', warning: 'warning', error: 'error', pending: 'neutral', info: 'accent' } as const
const BADGE_VARIANT = { ok: 'success', warning: 'warning', error: 'error', pending: 'neutral', info: 'info' } as const

/** Status as dots or badges. */
export function StatusView({ block, component }: { block: StatusBlock; component: string }) {
  const copy = useCopy()
  return (
    <VStack gap={2}>
      <BlockTitle title={block.title} />
      {block.items.map(item => component === 'dots'
        ? (
            <HStack key={item.label} gap={2} align="center">
              <StatusDot variant={DOT_VARIANT[item.state]} label={copy.states[item.state]} isPulsing={item.state === 'pending'} />
              <Text>{item.label}</Text>
              {item.note !== undefined && <Text type="supporting">· {item.note}</Text>}
            </HStack>
          )
        : (
            <HStack key={item.label} gap={2} align="start">
              <Badge variant={BADGE_VARIANT[item.state]} label={copy.states[item.state]} />
              <VStack gap={0.5}>
                <Text weight="medium">{item.label}</Text>
                {item.note !== undefined && <Text type="supporting">{item.note}</Text>}
              </VStack>
            </HStack>
          ))}
    </VStack>
  )
}

function clock(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds))
  return `${String(Math.floor(whole / 60)).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}`
}

/** A countdown or stopwatch that runs only in this card. */
export function TimerView({ block, component }: { block: TimerBlock; component: string }) {
  const copy = useCopy()
  const total = block.minutes * 60
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [banked, setBanked] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (startedAt === null) return
    const tick = setInterval(() => { setNow(Date.now()) }, 250)
    return () => { clearInterval(tick) }
  }, [startedAt])
  const elapsed = banked + (startedAt === null ? 0 : (now - startedAt) / 1000)
  const finished = component === 'countdown' && elapsed >= total
  useEffect(() => {
    if (finished && startedAt !== null) {
      setBanked(total)
      setStartedAt(null)
    }
  }, [finished, startedAt, total])
  const toggle = () => {
    if (startedAt === null) {
      setNow(Date.now())
      setStartedAt(Date.now())
    } else {
      setBanked(elapsed)
      setStartedAt(null)
    }
  }
  const reset = () => {
    setStartedAt(null)
    setBanked(0)
  }
  return (
    <Card padding={4}>
      <VStack gap={3}>
        <BlockTitle title={block.title} />
        <Text weight="medium">{block.label}</Text>
        {component === 'countdown'
          ? (
              <>
                <Text type="display-2" hasTabularNumbers>{finished ? copy.timeUp : clock(total - elapsed)}</Text>
                <ProgressBar label={block.label} isLabelHidden value={Math.min(elapsed, total)} max={total} />
              </>
            )
          : startedAt === null
            ? <Text type="display-2" hasTabularNumbers>{clock(elapsed)}</Text>
            : <Timer startTime={startedAt - banked * 1000} format="elapsed" type="large" size="3xl" />}
        <HStack gap={2}>
          <Button label={startedAt === null ? (elapsed > 0 && !finished ? copy.resume : copy.start) : copy.pause} variant="primary"
            isDisabled={finished} onClick={toggle} />
          <Button label={copy.reset} variant="secondary" onClick={reset} />
        </HStack>
      </VStack>
    </Card>
  )
}

/** People as a list or cards, each with an avatar. */
export function PeopleView({ block, component }: { block: PeopleBlock; component: string }) {
  if (component === 'cards') {
    return (
      <VStack gap={2}>
        <BlockTitle title={block.title} />
        <Grid columns={{ minWidth: 200 }} gap={3}>
          {block.people.map(person => (
            <Card key={person.name} padding={3} variant="muted">
              <HStack gap={2} align="start">
                <Avatar name={person.name} size="md" />
                <VStack gap={0.5}>
                  <Text weight="semibold">{person.name}</Text>
                  {person.role !== undefined && <Text type="supporting">{person.role}</Text>}
                  {person.note !== undefined && <Text type="supporting">{person.note}</Text>}
                </VStack>
              </HStack>
            </Card>
          ))}
        </Grid>
      </VStack>
    )
  }
  return (
    <VStack gap={2}>
      <BlockTitle title={block.title} />
      <List density="balanced">
        {block.people.map(person => (
          <ListItem key={person.name} label={person.name} startContent={<Avatar name={person.name} size="sm" />}
            {...person.role === undefined && person.note === undefined ? {} : { description: [person.role, person.note].filter(Boolean).join(' · ') }} />
        ))}
      </List>
    </VStack>
  )
}

type CalendarDay = Extract<NonNullable<ComponentProps<typeof Calendar>['value']>, string>

function localDay(date: Date): string {
  return `${String(date.getFullYear())}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** Calendar of planned days, or an agenda grouped by day. */
export function CalendarView({ block, component, selected, select }: {
  block: CalendarBlock; component: string; selected: string | undefined; select: (day: string) => void
}) {
  const copy = useCopy()
  const days = useMemo(() => [...new Set(block.events.map(event => event.date))].sort(), [block.events])
  const planned = useMemo(() => new Set(days), [days])
  const byDay = (day: string) => block.events.filter(event => event.date === day)
  if (component === 'agenda') {
    return (
      <VStack gap={3}>
        <BlockTitle title={block.title} />
        {days.map(day => (
          <VStack key={day} gap={1}>
            <Text weight="semibold" hasTabularNumbers>{day}</Text>
            {byDay(day).map(event => (
              <Text key={event.title}>• {event.title}{event.detail === undefined ? '' : ` — ${event.detail}`}</Text>
            ))}
          </VStack>
        ))}
      </VStack>
    )
  }
  // The host validated every date as YYYY-MM-DD.
  const day = (selected !== undefined && days.includes(selected) ? selected : days[0]) as CalendarDay | undefined
  return (
    <VStack gap={3}>
      <BlockTitle title={block.title} />
      <HStack gap={4} align="start" wrap="wrap">
        <Calendar mode="single" value={day ?? null} {...day === undefined ? {} : { focusDate: day }}
          onChange={(next: string | null) => { if (next !== null) select(next) }}
          dateConstraints={[date => planned.has(localDay(date))]} />
        <VStack gap={1}>
          <Text weight="semibold" hasTabularNumbers>{day ?? copy.chooseDay}</Text>
          {day === undefined ? null : byDay(day).map(event => (
            <VStack key={event.title} gap={0.5}>
              <Text>{event.title}</Text>
              {event.detail !== undefined && <Text type="supporting">{event.detail}</Text>}
            </VStack>
          ))}
        </VStack>
      </HStack>
    </VStack>
  )
}
