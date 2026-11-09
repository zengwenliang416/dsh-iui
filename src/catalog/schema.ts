/**
 * Field schemas of every block type and the `render_ui` parameters.
 * The always-visible parameters name only the block types; each block's fields
 * are validated against {@link BLOCK_FIELDS} by the host and described to the
 * model on demand by `ui_reference`, generated from the same schemas.
 */

import type { BlockType } from './spec.ts'

const text = (description: string) => ({ type: 'string', description }) as const
const required = <T extends object>(schema: T) => ({ ...schema, required: true }) as const
const title = { title: text('Optional heading of this block') } as const
const object = <P extends Record<string, unknown>>(properties: P) => ({ type: 'object', additionalProperties: false, properties }) as const
const list = <I extends object>(items: I, description: string) => ({ type: 'array', items, description }) as const
const tone = (values: readonly string[], description: string) => ({ type: 'string', enum: values, description }) as const
const scalar = (description: string) => ({ oneOf: [{ type: 'number' }, { type: 'string' }], description }) as const

/** Field schemas per block type, excluding the `type` discriminant. */
export const BLOCK_FIELDS = {
  summary: {
    ...title,
    text: required(text('The takeaway in one or two sentences')),
    highlights: list(text('One short supporting point'), 'Up to a few supporting points'),
  },
  notice: {
    tone: required(tone(['info', 'success', 'warning', 'danger'], 'Severity of the message')),
    ...title,
    text: required(text('The message')),
  },
  comparison: {
    ...title,
    attributes: required(list(object({
      key: required(text('Identifier used in item values')),
      label: required(text('Visible attribute name')),
      unit: text('Unit shown after numeric values'),
    }), 'Compared attributes; each item has a value for every key')),
    items: required(list(object({
      name: required(text('Item name')),
      values: required({ type: 'object', additionalProperties: true, description: 'Value per attribute key: a number or short text' }),
      note: text('Optional remark about this item'),
    }), 'Compared items')),
  },
  choice: {
    ...title,
    prompt: required(text('Question or instruction shown above the options')),
    options: required(list(object({
      id: required(text('Stable option identifier')),
      label: required(text('Visible option label')),
      detail: required(text('Explanation shown when this option is selected')),
    }), 'Two to eight options')),
    correct: text('Option id that answers a question correctly; omit when options are not right or wrong'),
  },
  calculator: {
    ...title,
    inputs: required(list(object({
      key: required(text('Identifier formulas read, such as total_minutes')),
      label: required(text('Visible input name')),
      kind: tone(['number', 'toggle', 'options'], 'number (default) uses min, max, and step; toggle is 0 or 1; options picks one listed value'),
      min: { type: 'number', description: 'Lowest value of a number input' },
      max: { type: 'number', description: 'Highest value of a number input' },
      step: { type: 'number', description: 'Increment of a number input' },
      value: required({ type: 'number', description: 'Initial value' }),
      unit: text('Unit shown with the value'),
      options: list(object({ label: required(text('Visible choice')), value: required({ type: 'number' }) }), 'Choices of an options input'),
    }), 'One to six inputs')),
    outputs: required(list(object({
      label: required(text('Visible result name')),
      formula: required(text('Arithmetic over input keys: + - * / %, parentheses, comparisons, ternaries, Math.min/max/round/floor/ceil/abs')),
      unit: text('Unit shown with the result'),
      decimals: { type: 'integer', description: 'Digits after the decimal point; default 0' },
    }), 'One to six results')),
  },
  steps: {
    ...title,
    steps: required(list(object({ title: required(text('Step name')), detail: text('What happens in this step') }), 'Steps in order')),
    current: { type: 'integer', description: 'Step the reader is on, counted from 0' },
  },
  metrics: {
    ...title,
    metrics: required(list(object({
      label: required(text('Metric name')),
      value: required(scalar('The figure')),
      unit: text('Unit shown with the value'),
      max: { type: 'number', description: 'Whole the value is a share of, such as 100 for a percentage' },
      note: text('Short context for the figure'),
    }), 'One to eight figures')),
  },
  checklist: {
    ...title,
    items: required(list(object({
      id: required(text('Stable item identifier')),
      label: required(text('Item to tick off')),
      detail: text('Why or how'),
    }), 'One to twelve items')),
  },
  faq: {
    ...title,
    items: required(list(object({ question: required(text('Question')), answer: required(text('Answer')) }), 'One to ten questions')),
  },
  sections: {
    ...title,
    sections: required(list(object({
      id: required(text('Stable section identifier')),
      label: required(text('Section label')),
      text: required(text('Section content')),
    }), 'Two to six sections')),
  },
  chart: {
    ...title,
    x: required(object({ key: required(text('Row field holding the x value')), label: required(text('X axis name')) })),
    series: required(list(object({ key: required(text('Row field holding this series\' number')), label: required(text('Series name')) }), 'One to four series')),
    unit: text('Unit of the series values'),
    data: required(list({ type: 'object', additionalProperties: true }, 'Rows with the x field and a number for every series; up to sixty')),
  },
  code: {
    ...title,
    language: required(text('Language name such as ts, python, sql, or text')),
    code: required(text('The code; it is shown, never run')),
  },
  quote: {
    text: required(text('The quotation')),
    source: text('Who said or wrote it'),
  },
  tags: {
    ...title,
    tags: required(list(object({
      label: required(text('Tag text')),
      tone: tone(['neutral', 'info', 'success', 'warning', 'danger'], 'Optional status colour'),
    }), 'One to twenty tags')),
  },
  text: {
    ...title,
    markdown: required(text('Markdown: paragraphs, lists, emphasis, tables, links')),
  },
  timeline: {
    ...title,
    events: required(list(object({
      date: required(text('Date or period label, such as 2026-11-09 or Week 1')),
      title: required(text('What happened or happens')),
      detail: text('More about the event'),
    }), 'Events in time order; up to twenty')),
  },
  tree: {
    ...title,
    nodes: required(list(object({
      label: required(text('Node name')),
      detail: text('Short description'),
      children: list({ type: 'json' }, 'Child nodes with the same fields; at most four levels in total'),
    }), 'Top-level nodes; at most sixty nodes in total')),
  },
  gallery: {
    ...title,
    items: required(list(object({
      title: required(text('Card title')),
      text: required(text('Card content')),
      tag: text('Short label such as a category'),
    }), 'Two to twelve parallel items')),
  },
  glossary: {
    ...title,
    terms: required(list(object({ term: required(text('Term')), definition: required(text('Definition')) }), 'One to twenty terms')),
  },
  shortcuts: {
    ...title,
    shortcuts: required(list(object({
      keys: required(text('Keys joined by +, such as Ctrl+Shift+P')),
      action: required(text('What the shortcut does')),
    }), 'One to twenty shortcuts')),
  },
  sources: {
    ...title,
    sources: required(list(object({
      title: required(text('Source title')),
      url: required(text('http or https address')),
      note: text('What this source supports'),
    }), 'One to twelve sources')),
  },
  status: {
    ...title,
    items: required(list(object({
      label: required(text('Check, service, or task')),
      state: required(tone(['ok', 'warning', 'error', 'pending', 'info'], 'Current state')),
      note: text('Explanation of the state'),
    }), 'One to twenty items')),
  },
  timer: {
    ...title,
    label: required(text('What the reader times, such as Case practice')),
    minutes: required({ type: 'number', description: 'Countdown length in minutes, 1 to 180' }),
  },
  people: {
    ...title,
    people: required(list(object({
      name: required(text('Name')),
      role: text('Role or title'),
      note: text('Responsibility or remark'),
    }), 'One to twelve people')),
  },
  calendar: {
    ...title,
    events: required(list(object({
      date: required(text('Day as YYYY-MM-DD')),
      title: required(text('Plan or event')),
      detail: text('More about it'),
    }), 'One to forty entries')),
  },
} as const satisfies Record<BlockType, Record<string, unknown>>

/** One line per block type, shown with the always-visible `type` field. */
export const BLOCK_SUMMARIES: Record<BlockType, string> = {
  summary: 'key takeaway',
  notice: 'info, success, warning, or danger message',
  comparison: 'items compared across shared attributes',
  choice: 'options that reveal explanations or check an answer',
  calculator: 'inputs and formulas computed live',
  steps: 'ordered process',
  metrics: 'headline figures',
  checklist: 'items the reader ticks off',
  faq: 'questions and answers',
  sections: 'alternative views the reader switches between',
  chart: 'numeric series plotted over x values',
  code: 'source code shown, never run',
  quote: 'quotation with source',
  tags: 'short labels',
  text: 'Markdown explanation',
  timeline: 'dated events in order',
  tree: 'hierarchy such as an outline or structure',
  gallery: 'parallel examples or cases to browse',
  glossary: 'terms and definitions',
  shortcuts: 'keyboard shortcuts',
  sources: 'cited links',
  status: 'state of several checks or tasks',
  timer: 'local practice timer',
  people: 'people and roles',
  calendar: 'plans on calendar days',
}

/** `render_ui` parameters: block fields are validated by the host and listed by `ui_reference`. */
export const RENDER_UI_PARAMETERS = {
  title: text('Optional card heading'),
  blocks: {
    type: 'array',
    required: true,
    description: 'Content blocks in reading order; the host chooses how each is shown. Call ui_reference for a block type\'s fields.',
    items: {
      type: 'object',
      additionalProperties: true,
      properties: {
        type: {
          type: 'string',
          required: true,
          enum: Object.keys(BLOCK_SUMMARIES),
          description: Object.entries(BLOCK_SUMMARIES).map(([type, summary]) => `${type}: ${summary}`).join('; '),
        },
      },
    },
  },
} as const
