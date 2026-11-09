/** Model-visible text: the always-on section and the on-demand block guidance. */

import { describeFields } from './catalog/fields-doc.ts'
import { BLOCK_FIELDS, BLOCK_SUMMARIES } from './catalog/schema.ts'
import type { Block, BlockType } from './catalog/spec.ts'

/** Always-on section: when to use a card; block fields come from `ui_reference`. */
export const IUI_SECTION = [
  'When an answer gains from exploration, such as comparing options across the same attributes, choosing between alternatives that each need an explanation, or calculating from numbers the user gave, also call render_ui with content blocks; the user sees an interactive card under your reply and the host decides how each block is shown.',
  'Keep plain text for simple replies, use only facts from the conversation or verified sources, and still state the key result in your text.',
  'Before the first card in a conversation, call ui_reference for the block types you plan to use.',
].join(' ')

interface Guide {
  readonly guidance: string
  readonly example: Block
}

/** Guidance and one valid example per block type. */
export const BLOCK_GUIDES: Record<BlockType, Guide> = {
  summary: {
    guidance: 'Put the takeaway first when the card has other blocks. Highlights are short supporting points, not a second explanation.',
    example: { type: 'summary', text: 'Two 20-minute sessions suit a schedule with few but longer free slots.', highlights: ['Same 40 minutes per week', 'Fewer context switches'] },
  },
  notice: {
    guidance: 'Use for a caveat, risk, or verified result the reader must not miss; pick the tone that matches its severity.',
    example: { type: 'notice', tone: 'warning', text: 'These estimates assume every session starts on time.' },
  },
  comparison: {
    guidance: 'Every item needs a value for every attribute key. Use numbers for numeric values and put the unit on the attribute.',
    example: {
      type: 'comparison', title: 'Weekly plans',
      attributes: [{ key: 'sessions', label: 'Sessions' }, { key: 'length', label: 'Each session', unit: 'min' }],
      items: [{ name: 'Short', values: { sessions: 4, length: 10 } }, { name: 'Long', values: { sessions: 2, length: 20 } }],
    },
  },
  choice: {
    guidance: 'Use for discrete alternatives such as plans or quiz answers, rather than a calculator input. Each detail explains that option on its own; for a quiz, set correct and write each detail as feedback.',
    example: {
      type: 'choice', prompt: 'Which index level holds logical block 261?', correct: 'single',
      options: [{ id: 'direct', label: 'Direct', detail: 'Direct entries cover blocks 0 to 4 only.' }, { id: 'single', label: 'Single indirect', detail: 'Correct: 5 + 256 = 261 starts the second single-indirect block.' }],
    },
  },
  calculator: {
    guidance: 'Choose ranges and steps that make sense for the facts; formulas read input keys only and must not invent rates or constants. Use an options input for a few discrete values and a toggle for on/off.',
    example: {
      type: 'calculator',
      inputs: [
        { key: 'total', label: 'Weekly total', min: 60, max: 180, step: 10, value: 120, unit: 'min' },
        { key: 'sessions', label: 'Sessions', kind: 'options', value: 2, options: [{ label: 'Two', value: 2 }, { label: 'Three', value: 3 }] },
      ],
      outputs: [{ label: 'Each session', formula: 'total / sessions', unit: 'min', decimals: 1 }],
    },
  },
  steps: {
    guidance: 'Use for an ordered procedure. Keep titles short and put the explanation in detail.',
    example: { type: 'steps', steps: [{ title: 'Read the inode', detail: 'Find iaddr[5] = 90.' }, { title: 'Read block 90', detail: 'Its first entry points to 58.' }] },
  },
  metrics: {
    guidance: 'Use for a few figures the reader should see at a glance. Set max only when a value is a share of a known whole.',
    example: { type: 'metrics', metrics: [{ label: 'Weekly total', value: 120, unit: 'min' }, { label: 'Completed', value: 80, max: 120, unit: 'min' }] },
  },
  checklist: {
    guidance: 'Use for actions or requirements the reader works through; ticks stay in the card and do not reach you.',
    example: { type: 'checklist', items: [{ id: 'units', label: 'Check units' }, { id: 'total', label: 'Recompute the total', detail: 'Multiply sessions by length.' }] },
  },
  faq: {
    guidance: 'Use for follow-up questions the reader may have; keep each answer self-contained.',
    example: { type: 'faq', items: [{ question: 'Can I mix both plans?', answer: 'Yes, as long as the weekly total stays at 120 minutes.' }] },
  },
  sections: {
    guidance: 'Use for alternative views of one topic, such as explanations for different audiences; the reader reads one at a time.',
    example: { type: 'sections', sections: [{ id: 'short', label: 'Short', text: 'Two sessions of 60 minutes.' }, { id: 'detail', label: 'Detailed', text: 'Each session warms up for 10 minutes, then practises for 50.' }] },
  },
  chart: {
    guidance: 'Plot only numbers from the conversation or verified sources. Every row needs the x field and a number for every series.',
    example: {
      type: 'chart', title: 'Minutes per session', x: { key: 'total', label: 'Weekly total' }, unit: 'min',
      series: [{ key: 'two', label: 'Two sessions' }, { key: 'three', label: 'Three sessions' }],
      data: [{ total: 60, two: 30, three: 20 }, { total: 120, two: 60, three: 40 }, { total: 180, two: 90, three: 60 }],
    },
  },
  code: {
    guidance: 'Use for code the reader copies or studies; also keep a short explanation in your text.',
    example: { type: 'code', language: 'python', code: 'per_session = total / sessions' },
  },
  quote: {
    guidance: 'Quote exact words only, with their source.',
    example: { type: 'quote', text: 'Premature optimization is the root of all evil.', source: 'Donald Knuth' },
  },
  tags: {
    guidance: 'Use for categories or attributes; set a tone only for a real status.',
    example: { type: 'tags', tags: [{ label: 'Scheduling' }, { label: 'Feasible', tone: 'success' }] },
  },
  text: {
    guidance: 'Use for explanation that belongs inside the card next to interactive blocks; keep the main answer in your reply.',
    example: { type: 'text', markdown: 'Split the week by **free slots**, not by habit:\n\n- Short gaps suit three sessions\n- Long gaps suit two' },
  },
  timeline: {
    guidance: 'Use for events in time order; dates may be exact days or labels such as Week 1.',
    example: { type: 'timeline', events: [{ date: 'Week 1', title: 'Fundamentals', detail: '3 hours' }, { date: 'Week 2', title: 'Case practice', detail: '3 hours' }] },
  },
  tree: {
    guidance: 'Use for a hierarchy such as an outline, organisation, or directory; children use the same fields.',
    example: { type: 'tree', nodes: [{ label: 'Case analysis', children: [{ label: 'Quality attributes', detail: 'Performance, availability' }, { label: 'Architecture styles' }] }] },
  },
  gallery: {
    guidance: 'Use for parallel examples or cases of the same kind, each understandable on its own.',
    example: { type: 'gallery', items: [{ title: 'Layered', text: 'Separates presentation, logic, and data.', tag: 'Style' }, { title: 'Event-driven', text: 'Components react to published events.', tag: 'Style' }] },
  },
  glossary: {
    guidance: 'Use for terms the reader may not know; keep each definition self-contained.',
    example: { type: 'glossary', terms: [{ term: 'Inode', definition: 'The record that stores a file\'s block addresses.' }, { term: 'Indirect block', definition: 'A block that stores further block addresses.' }] },
  },
  shortcuts: {
    guidance: 'Use for keyboard shortcuts; write keys as they appear on the keyboard, joined by +.',
    example: { type: 'shortcuts', shortcuts: [{ keys: 'Ctrl+Shift+P', action: 'Open the command palette' }, { keys: 'Ctrl+P', action: 'Go to a file' }] },
  },
  sources: {
    guidance: 'List only sources you actually used or the user gave; links open in the browser outside the card.',
    example: { type: 'sources', sources: [{ title: 'RFC 9110: HTTP Semantics', url: 'https://www.rfc-editor.org/rfc/rfc9110', note: 'Status code meanings' }] },
  },
  status: {
    guidance: 'Use for the state of several checks, services, or tasks; explain any warning or error in its note.',
    example: { type: 'status', items: [{ label: 'Weekly total', state: 'ok' }, { label: 'Essay practice', state: 'warning', note: 'Only one full essay before the exam' }] },
  },
  timer: {
    guidance: 'Use when the reader will practise against a time limit; the timer runs only in their browser.',
    example: { type: 'timer', label: 'Case question', minutes: 45 },
  },
  people: {
    guidance: 'Use for people involved and their roles; include only names from the conversation.',
    example: { type: 'people', people: [{ name: 'Alex Chen', role: 'Architect', note: 'Owns the design review' }, { name: 'Sam Li', role: 'Tester' }] },
  },
  calendar: {
    guidance: 'Use for plans on specific days; every date is YYYY-MM-DD and comes from the conversation.',
    example: { type: 'calendar', events: [{ date: '2026-11-09', title: 'Fundamentals review' }, { date: '2026-11-12', title: 'Full case practice', detail: '90 minutes' }] },
  },
}

/**
 * The `ui_reference` text of one block type: summary, fields, guidance, and example.
 * @param type - Block type.
 * @returns The reference section.
 */
export function blockReference(type: BlockType): string {
  const { guidance, example } = BLOCK_GUIDES[type]
  return [
    `## ${type}: ${BLOCK_SUMMARIES[type]}`,
    describeFields(BLOCK_FIELDS[type]),
    guidance,
    `Example: ${JSON.stringify(example)}`,
  ].join('\n')
}
