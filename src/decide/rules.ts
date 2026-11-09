/** Deterministic component choice for each block; the decision used when Jev is absent or unsure. */

import type { Block, ComponentId, TreeNode } from '../catalog/spec.ts'

/** Ranges with more steps than this are easier to type than to drag. */
const MAX_SLIDER_STEPS = 200
/** Labels longer than this crowd a segmented control or tab. */
const MAX_SHORT_LABEL = 12
/** Text up to this length reads as one takeaway or a short answer. */
const MAX_SHORT_TEXT = 160
/** Code longer than this many lines is referred to by line. */
const MAX_PLAIN_CODE_LINES = 12

const short = (value: string) => value.length <= MAX_SHORT_TEXT
/** Dates within this many days fit one or two calendar months. */
const MAX_CALENDAR_SPAN_DAYS = 62

function treeDepth(nodes: readonly TreeNode[]): number {
  return nodes.reduce((depth, node) => Math.max(depth, 1 + treeDepth(node.children ?? [])), 0)
}

function treeSize(nodes: readonly TreeNode[]): number {
  return nodes.reduce((size, node) => size + 1 + treeSize(node.children ?? []), 0)
}

function daySpan(dates: readonly string[]): number {
  const times = dates.map(date => Date.parse(`${date}T00:00:00Z`))
  return (Math.max(...times) - Math.min(...times)) / 86_400_000
}

/**
 * Choose a component from the block's content alone.
 * @param block - Validated block.
 * @returns A candidate component id of the block's type.
 */
export function ruleComponent(block: Block): ComponentId {
  switch (block.type) {
    case 'summary':
      return (block.highlights?.length ?? 0) > 0 || short(block.text) ? 'callout' : 'card'
    case 'notice':
      return block.tone === 'info' && block.title === undefined && short(block.text) ? 'inline' : 'banner'
    case 'comparison': {
      const numeric = block.items.some(item => Object.values(item.values).some(value => typeof value === 'number'))
      return block.items.length >= 4 || block.attributes.length >= 3 || numeric ? 'table' : 'card-grid'
    }
    case 'choice':
      if (block.options.length <= 4 && block.options.every(option => option.label.length <= MAX_SHORT_LABEL)) return 'segmented'
      return block.options.length >= 4 ? 'radio-list' : 'option-cards'
    case 'calculator':
      return block.inputs.every(input => input.kind !== undefined && input.kind !== 'number'
        || (input.max! - input.min!) / input.step! <= MAX_SLIDER_STEPS) ? 'sliders' : 'number-fields'
    case 'steps':
      if (block.steps.some(step => step.detail !== undefined && !short(step.detail))) return 'accordion'
      return block.steps.length <= 6 ? 'stepper' : 'numbered-list'
    case 'metrics':
      if (block.metrics.every(metric => metric.max !== undefined)) return 'progress'
      return block.metrics.length <= 4 && block.metrics.every(metric => typeof metric.value === 'number') ? 'stat-cards' : 'metadata'
    case 'checklist':
      return block.items.filter(item => item.detail !== undefined).length * 2 > block.items.length ? 'cards' : 'checkbox-list'
    case 'faq':
      return block.items.length <= 3 && block.items.every(item => short(item.answer)) ? 'list' : 'accordion'
    case 'sections':
      if (block.sections.length <= 4 && block.sections.every(section => section.label.length <= MAX_SHORT_LABEL)) return 'tabs'
      return 'radio-list'
    case 'chart': {
      const numericX = block.data.every(row => typeof row[block.x.key] === 'number')
      if (numericX && block.series.length === 1 && block.data.length >= 12) return 'scatter'
      return block.data.length >= 8 || numericX && block.data.length >= 6 ? 'line' : 'bar'
    }
    case 'code':
      return block.code.split('\n').length > MAX_PLAIN_CODE_LINES ? 'numbered' : 'code-block'
    case 'quote':
      return short(block.text) ? 'card' : 'blockquote'
    case 'tags':
      return block.tags.some(tag => tag.tone !== undefined && tag.tone !== 'neutral') ? 'badges' : 'tokens'
    case 'text':
      return block.markdown.length <= MAX_SHORT_TEXT * 2 ? 'compact' : 'markdown'
    case 'timeline':
      return block.events.length <= 6 ? 'vertical-steps' : 'dated-list'
    case 'tree':
      return treeDepth(block.nodes) >= 3 || treeSize(block.nodes) > 15 ? 'tree' : 'nested-list'
    case 'gallery':
      return block.items.length <= 3 ? 'grid' : 'carousel'
    case 'glossary':
      if (block.terms.length > 8) return 'infotips'
      return block.terms.some(term => !short(term.definition)) ? 'list' : 'metadata'
    case 'shortcuts':
      return block.shortcuts.length > 6 ? 'table' : 'list'
    case 'sources':
      return block.sources.every(source => source.note !== undefined) ? 'links' : 'citations'
    case 'status':
      return block.items.some(item => item.note !== undefined) ? 'badges' : 'dots'
    case 'timer':
      return 'countdown'
    case 'people':
      return block.people.length <= 4 && block.people.some(person => person.note !== undefined) ? 'cards' : 'list'
    case 'calendar':
      return daySpan(block.events.map(event => event.date)) <= MAX_CALENDAR_SPAN_DAYS ? 'calendar' : 'agenda'
  }
}
