/** Read-only blocks: summary, notice, quote, tags, and code. */

import { Badge, Banner, Blockquote, Card, CodeBlock, HStack, Text, Token, VStack } from '@astryxdesign/core'
import type { CodeBlockSpec, NoticeBlock, QuoteBlock, SummaryBlock, TagsBlock } from '../../src/catalog/spec.ts'
import { BlockTitle, TONE_STATUS } from './shared.tsx'

/** Summary as a callout or a plain card. */
export function SummaryView({ block, component }: { block: SummaryBlock; component: string }) {
  const points = (block.highlights ?? []).map(point => <Text key={point} type="supporting">• {point}</Text>)
  if (component === 'callout') {
    return (
      <Banner status="info" title={block.title ?? block.text} {...block.title === undefined ? {} : { description: block.text }}>
        {points.length > 0 && <VStack gap={1}>{points}</VStack>}
      </Banner>
    )
  }
  return (
    <Card padding={4}>
      <VStack gap={2}>
        <BlockTitle title={block.title} />
        <Text>{block.text}</Text>
        {points}
      </VStack>
    </Card>
  )
}

/** Notice as a banner or an inline status line. */
export function NoticeView({ block, component }: { block: NoticeBlock; component: string }) {
  const status = TONE_STATUS[block.tone]
  if (component === 'banner') {
    return <Banner status={status} title={block.title ?? block.text} {...block.title === undefined ? {} : { description: block.text }} />
  }
  return (
    <HStack gap={2} align="center">
      <Badge variant={status} label={block.title ?? block.tone} />
      <Text>{block.text}</Text>
    </HStack>
  )
}

/** Quotation as an indented blockquote or its own card. */
export function QuoteView({ block, component }: { block: QuoteBlock; component: string }) {
  const quote = <Blockquote {...block.source === undefined ? {} : { cite: block.source }}>{block.text}</Blockquote>
  return component === 'card' ? <Card padding={4} variant="muted">{quote}</Card> : quote
}

/** Tags as neutral tokens or tone badges. */
export function TagsView({ block, component }: { block: TagsBlock; component: string }) {
  return (
    <VStack gap={2}>
      <BlockTitle title={block.title} />
      <HStack gap={2} wrap="wrap">
        {block.tags.map(tag => component === 'badges'
          ? <Badge key={tag.label} variant={TONE_STATUS[tag.tone ?? 'neutral']} label={tag.label} />
          : <Token key={tag.label} label={tag.label} size="sm" />)}
      </HStack>
    </VStack>
  )
}

/** Code shown as text, with line numbers when chosen; it is never executed. */
export function CodeView({ block, component }: { block: CodeBlockSpec; component: string }) {
  return (
    <CodeBlock code={block.code} language={block.language} hasLanguageLabel hasCopyButton={false}
      hasLineNumbers={component === 'numbered'} {...block.title === undefined ? {} : { title: block.title }} maxHeight={480} />
  )
}
