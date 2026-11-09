/**
 * Validation of model-written `render_ui` content: each block's fields against
 * its schema, then the cross-field rules a schema cannot express. Every
 * message names the offending path so the model can correct its next call.
 */

import { validateArgs, type ParameterSchemaSpec } from '@deepseek-ai/dsh-tools'
import { assertBindingName } from './expr.ts'
import { checkFormula, evaluateFormula } from './formula.ts'
import { BLOCK_FIELDS } from './schema.ts'
import { BLOCK_TYPES, type Block, type BlockType, type CalculatorBlock, type ChartBlock, type UiSpec } from './spec.ts'

/** Protocol bounds that keep one card readable and its projection small. */
const LIMITS = {
  blocks: 10, attributes: 8, items: 12, options: 8, inputs: 6, outputs: 6, steps: 12, metrics: 8,
  checklist: 12, faq: 10, sections: 6, series: 4, rows: 60, codeChars: 8_000, tags: 20,
  markdownChars: 6_000, events: 20, treeNodes: 60, treeDepth: 4, gallery: 12, terms: 20, shortcuts: 20,
  sources: 12, status: 20, timerMinutes: 180, people: 12, calendar: 40,
} as const

/** Tree node fields, checked recursively because a JSON schema here cannot refer to itself. */
const TREE_NODE_FIELDS = {
  label: { type: 'string', required: true },
  detail: { type: 'string' },
  children: { type: 'array', items: { type: 'json' } },
} as const

function checkTree(errors: string[], path: string, nodes: readonly unknown[], depth: number, count: { value: number }): void {
  if (depth > LIMITS.treeDepth) {
    errors.push(`${path} is nested deeper than ${String(LIMITS.treeDepth)} levels`)
    return
  }
  nodes.forEach((node, index) => {
    const at = `${path}[${String(index)}]`
    count.value += 1
    const problems = validateArgs(TREE_NODE_FIELDS as ParameterSchemaSpec, node)
    if (problems.length > 0) {
      errors.push(...problems.map(problem => `${at}: ${problem}`))
      return
    }
    const children = (node as { children?: readonly unknown[] }).children
    if (children !== undefined) checkTree(errors, `${at}.children`, children, depth + 1, count)
  })
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

function isDay(value: string): boolean {
  if (!ISO_DAY.test(value)) return false
  const time = Date.parse(`${value}T00:00:00Z`)
  return Number.isFinite(time) && new Date(time).toISOString().startsWith(value)
}

function isWebAddress(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch (_error) {
    // An unparsable address is reported to the model below.
    return false
  }
}

function duplicates(values: readonly string[]): string[] {
  const seen = new Set<string>()
  const repeated = new Set<string>()
  for (const value of values) (seen.has(value) ? repeated : seen).add(value)
  return [...repeated]
}

function range(errors: string[], path: string, count: number, min: number, max: number): void {
  if (count < min || count > max) errors.push(`${path} must contain ${String(min)} to ${String(max)} entries, found ${String(count)}`)
}

function unique(errors: string[], path: string, label: string, values: readonly string[]): void {
  for (const value of duplicates(values)) errors.push(`${path} repeats ${label} "${value}"`)
}

function checkCalculator(errors: string[], path: string, block: CalculatorBlock): void {
  range(errors, `${path}.inputs`, block.inputs.length, 1, LIMITS.inputs)
  range(errors, `${path}.outputs`, block.outputs.length, 1, LIMITS.outputs)
  const keys = block.inputs.map(input => input.key)
  unique(errors, `${path}.inputs`, 'key', keys)
  block.inputs.forEach((input, index) => {
    const at = `${path}.inputs[${String(index)}]`
    try {
      assertBindingName(input.key)
    } catch (_error) {
      // The evaluator's identifier rule decides which keys a formula can read.
      errors.push(`${at}.key "${input.key}" must be a letter or underscore followed by letters, digits, or underscores, and not a reserved word`)
    }
    switch (input.kind ?? 'number') {
      case 'toggle':
        if (input.value !== 0 && input.value !== 1) errors.push(`${at}.value of a toggle must be 0 or 1`)
        return
      case 'options': {
        const values = (input.options ?? []).map(option => option.value)
        range(errors, `${at}.options`, values.length, 2, LIMITS.options)
        if (!values.includes(input.value)) errors.push(`${at}.value must be one of its options' values`)
        return
      }
      case 'number': {
        const { min, max, step } = input
        if (min === undefined || max === undefined || step === undefined) {
          errors.push(`${at} is a number input and needs min, max, and step`)
          return
        }
        if (!(min < max)) errors.push(`${at} needs min < max`)
        if (!(step > 0)) errors.push(`${at}.step must be positive`)
        if (input.value < min || input.value > max) errors.push(`${at}.value must lie between min and max`)
      }
    }
  })
  const initial = Object.fromEntries(block.inputs.map(input => [input.key, input.value]))
  block.outputs.forEach((output, index) => {
    const at = `${path}.outputs[${String(index)}].formula`
    try {
      checkFormula(output.formula, keys)
      evaluateFormula(output.formula, initial)
    } catch (error) {
      errors.push(`${at} "${output.formula}": ${error instanceof Error ? error.message : 'invalid formula'}`)
    }
  })
}

function checkChart(errors: string[], path: string, block: ChartBlock): void {
  range(errors, `${path}.series`, block.series.length, 1, LIMITS.series)
  range(errors, `${path}.data`, block.data.length, 1, LIMITS.rows)
  unique(errors, `${path}.series`, 'key', block.series.map(series => series.key))
  block.data.forEach((row, index) => {
    const at = `${path}.data[${String(index)}]`
    const x = row[block.x.key]
    if (typeof x !== 'string' && typeof x !== 'number') errors.push(`${at} needs a text or number "${block.x.key}" x value`)
    const missing = block.series.filter(series => typeof row[series.key] !== 'number' || !Number.isFinite(row[series.key]))
    if (missing.length > 0) errors.push(`${at} needs a number for ${missing.map(series => `"${series.key}"`).join(', ')}`)
  })
}

function checkBlock(errors: string[], path: string, block: Block): void {
  switch (block.type) {
    case 'summary':
    case 'notice':
    case 'quote':
      if (block.text.trim() === '') errors.push(`${path}.text must not be empty`)
      return
    case 'comparison': {
      range(errors, `${path}.attributes`, block.attributes.length, 1, LIMITS.attributes)
      range(errors, `${path}.items`, block.items.length, 1, LIMITS.items)
      const keys = block.attributes.map(attribute => attribute.key)
      unique(errors, `${path}.attributes`, 'key', keys)
      block.items.forEach((item, index) => {
        const missing = keys.filter(key => !Object.hasOwn(item.values, key))
        if (missing.length > 0) errors.push(`${path}.items[${String(index)}].values is missing ${missing.map(key => `"${key}"`).join(', ')}`)
      })
      return
    }
    case 'choice': {
      range(errors, `${path}.options`, block.options.length, 2, LIMITS.options)
      const ids = block.options.map(option => option.id)
      unique(errors, `${path}.options`, 'id', ids)
      if (block.correct !== undefined && !ids.includes(block.correct)) errors.push(`${path}.correct "${block.correct}" is not an option id`)
      return
    }
    case 'calculator':
      checkCalculator(errors, path, block)
      return
    case 'steps':
      range(errors, `${path}.steps`, block.steps.length, 1, LIMITS.steps)
      if (block.current !== undefined && (block.current < 0 || block.current >= block.steps.length)) {
        errors.push(`${path}.current must be a step index from 0 to ${String(block.steps.length - 1)}`)
      }
      return
    case 'metrics':
      range(errors, `${path}.metrics`, block.metrics.length, 1, LIMITS.metrics)
      block.metrics.forEach((metric, index) => {
        if (metric.max === undefined) return
        if (!(metric.max > 0)) errors.push(`${path}.metrics[${String(index)}].max must be positive`)
        else if (typeof metric.value !== 'number' || metric.value < 0 || metric.value > metric.max) {
          errors.push(`${path}.metrics[${String(index)}].value must be a number from 0 to max`)
        }
      })
      return
    case 'checklist':
      range(errors, `${path}.items`, block.items.length, 1, LIMITS.checklist)
      unique(errors, `${path}.items`, 'id', block.items.map(item => item.id))
      return
    case 'faq':
      range(errors, `${path}.items`, block.items.length, 1, LIMITS.faq)
      return
    case 'sections':
      range(errors, `${path}.sections`, block.sections.length, 2, LIMITS.sections)
      unique(errors, `${path}.sections`, 'id', block.sections.map(section => section.id))
      return
    case 'chart':
      checkChart(errors, path, block)
      return
    case 'code':
      if (block.code.length > LIMITS.codeChars) errors.push(`${path}.code must be at most ${String(LIMITS.codeChars)} characters`)
      return
    case 'tags':
      range(errors, `${path}.tags`, block.tags.length, 1, LIMITS.tags)
      return
    case 'text':
      if (block.markdown.trim() === '') errors.push(`${path}.markdown must not be empty`)
      if (block.markdown.length > LIMITS.markdownChars) errors.push(`${path}.markdown must be at most ${String(LIMITS.markdownChars)} characters`)
      return
    case 'timeline':
      range(errors, `${path}.events`, block.events.length, 1, LIMITS.events)
      return
    case 'tree': {
      const count = { value: 0 }
      checkTree(errors, `${path}.nodes`, block.nodes, 1, count)
      if (count.value > LIMITS.treeNodes) errors.push(`${path} has ${String(count.value)} nodes; at most ${String(LIMITS.treeNodes)} are allowed`)
      return
    }
    case 'gallery':
      range(errors, `${path}.items`, block.items.length, 2, LIMITS.gallery)
      return
    case 'glossary':
      range(errors, `${path}.terms`, block.terms.length, 1, LIMITS.terms)
      return
    case 'shortcuts':
      range(errors, `${path}.shortcuts`, block.shortcuts.length, 1, LIMITS.shortcuts)
      return
    case 'sources':
      range(errors, `${path}.sources`, block.sources.length, 1, LIMITS.sources)
      block.sources.forEach((source, index) => {
        if (!isWebAddress(source.url)) errors.push(`${path}.sources[${String(index)}].url must be an http or https address`)
      })
      return
    case 'status':
      range(errors, `${path}.items`, block.items.length, 1, LIMITS.status)
      return
    case 'timer':
      if (!(block.minutes >= 1 && block.minutes <= LIMITS.timerMinutes)) errors.push(`${path}.minutes must be from 1 to ${String(LIMITS.timerMinutes)}`)
      return
    case 'people':
      range(errors, `${path}.people`, block.people.length, 1, LIMITS.people)
      return
    case 'calendar':
      range(errors, `${path}.events`, block.events.length, 1, LIMITS.calendar)
      block.events.forEach((event, index) => {
        if (!isDay(event.date)) errors.push(`${path}.events[${String(index)}].date "${event.date}" must be a real day written YYYY-MM-DD`)
      })
  }
}

function isBlockType(value: unknown): value is BlockType {
  return typeof value === 'string' && (BLOCK_TYPES as readonly string[]).includes(value)
}

/**
 * Validate model-written content: block fields first, then cross-field rules for blocks whose fields are valid.
 * @param spec - `render_ui` arguments; blocks are unchecked JSON objects.
 * @returns One actionable message per problem; empty when the spec renders.
 */
export function validateSpec(spec: { readonly title?: string; readonly blocks: readonly unknown[] }): string[] {
  const errors: string[] = []
  range(errors, 'blocks', spec.blocks.length, 1, LIMITS.blocks)
  spec.blocks.forEach((block, index) => {
    const path = `blocks[${String(index)}]`
    const type = typeof block === 'object' && block !== null ? (block as { type?: unknown }).type : undefined
    if (!isBlockType(type)) {
      errors.push(`${path}.type must be one of ${BLOCK_TYPES.join(', ')}`)
      return
    }
    const fieldErrors = validateArgs(BLOCK_FIELDS[type] as ParameterSchemaSpec, block)
    if (fieldErrors.length > 0) {
      errors.push(...fieldErrors.map(message => `${path} (${type}): ${message}`))
      return
    }
    // The schema check above makes the block a valid member of its type.
    checkBlock(errors, path, block as Block)
  })
  return errors
}

/**
 * Narrow arguments that passed {@link validateSpec}.
 * @param spec - Arguments with no validation errors.
 * @returns The same value typed as a spec.
 */
export function asValidSpec(spec: { readonly title?: string; readonly blocks: readonly unknown[] }): UiSpec {
  return spec as UiSpec
}
