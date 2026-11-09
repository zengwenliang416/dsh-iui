/**
 * dsh-iui, host half: the `render_ui` and `ui_reference` tools and the short
 * section telling the model when a card helps. `render_ui` validates the
 * content, places each block with Jev or the rules, and records the placements
 * in its result so replay and the browser half never decide again.
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-system-prompt'
import { RENDER_UI_PARAMETERS } from './catalog/schema.ts'
import { BLOCK_TYPES } from './catalog/spec.ts'
import { asValidSpec, validateSpec } from './catalog/validate.ts'
import { decide, type DecideOptions } from './decide/decide.ts'
import { blockReference, IUI_SECTION } from './prompt.ts'

/** Cordis plugin identity. */
export const name = 'dsh-iui'
/** Tool registry and system prompt. */
export const inject = ['tools', 'systemPrompt']

/** Jev decision settings; the key is read from the named environment variable. */
export interface JevConfig {
  enabled: boolean
  endpoint: string
  model: string
  apiKeyEnv: string
  timeoutMs: number
  minConfidence: number
}

/** Plugin configuration. */
export interface Config {
  jev: JevConfig
}

/** Configuration schema; every field is changeable from cordis.yml. */
export const Config: z<Config> = z.object({
  jev: z.object({
    enabled: z.boolean().default(true).description('Ask Jev for component choices when its API key is present'),
    endpoint: z.string().default('https://api.typesafe.ai/v1/systemone').description('System One endpoint'),
    model: z.string().default('jev-latest').description('Jev model or alias'),
    apiKeyEnv: z.string().default('TYPESAFE_API_KEY').description('Environment variable holding the TypeSafe API key'),
    timeoutMs: z.natural().min(500).default(4000).description('Jev request timeout; slower answers fall back to rules'),
    minConfidence: z.number().min(0).max(1).default(0.5).description('Lowest Jev confidence accepted for a component'),
  }).default({}),
})

/** Section order: after the tool sections, before the SDK and deliverable sections. */
const SECTION_ORDER = 2950

/**
 * Resolve decider options from configuration and the environment.
 * @param config - Validated plugin configuration.
 * @param env - Process environment.
 * @returns Jev settings when enabled and keyed, plus the threshold.
 */
export function resolveDecideOptions(config: Config, env: NodeJS.ProcessEnv): DecideOptions {
  const { jev } = config
  const apiKey = jev.enabled ? env[jev.apiKeyEnv]?.trim() : undefined
  return {
    minConfidence: jev.minConfidence,
    ...apiKey ? { jev: { endpoint: jev.endpoint, model: jev.model, apiKey, timeoutMs: jev.timeoutMs } } : {},
  }
}

const PLACEMENT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    component: { type: 'string', required: true },
    source: { type: 'string', enum: ['rules', 'jev'], required: true },
    confidence: { type: 'number' },
    fallback: { type: 'string', enum: ['low-confidence', 'unavailable'] },
  },
} as const

/**
 * Build the `render_ui` tool.
 * @param options - Resolved decider options.
 * @returns A registry-ready definition.
 */
export function renderUiTool(options: DecideOptions) {
  return defineTool({
    name: 'render_ui',
    description: 'Show content blocks as an interactive card under your reply. Reader interactions stay in the card. Returns the problems to fix when the card cannot be shown.',
    parameters: RENDER_UI_PARAMETERS,
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: { placements: { type: 'array', required: true, items: PLACEMENT_SCHEMA } },
      },
      render: (_args, value) => [{ type: 'text', text: `The card is shown under your reply. Blocks appear as: ${value.placements.map(placement => placement.component).join(', ')}. Describe what the card shows, not a layout it does not use.` }],
      // The browser half reads this as a ResolvedCard; it is replayed from the log.
      presentationMeta: (args, value) => ({ spec: args, placements: value.placements }),
    },
    async execute(args, exec) {
      const problems = validateSpec(args)
      if (problems.length > 0) throw new Error(`The card was not shown. Fix these problems and call render_ui again:\n- ${problems.join('\n- ')}`)
      return { placements: await decide(asValidSpec(args), options, exec.signal) }
    },
  })
}

/** `ui_reference`: block guidance and examples, loaded when the model plans a card. */
export const uiReferenceTool = defineTool({
  name: 'ui_reference',
  description: 'Return the fields, guidance, and an example of each listed render_ui block type.',
  parameters: {
    blocks: {
      type: 'array',
      required: true,
      items: { type: 'string', enum: BLOCK_TYPES },
      description: 'Block types to describe',
    },
  },
  output: {
    schema: { type: 'string' },
    render: (_args, value) => [{ type: 'text', text: value }],
  },
  execute: (args) => Promise.resolve([...new Set(args.blocks)].map(type => blockReference(type as (typeof BLOCK_TYPES)[number])).join('\n\n')),
})

/**
 * Register both tools and the section.
 * @param ctx - Context with the tool registry and system prompt.
 * @param config - Validated configuration.
 */
export function apply(ctx: Context, config: Config): void {
  const options = resolveDecideOptions(config, process.env)
  ctx.effect(() => ctx.tools.register(renderUiTool(options)), 'dsh-iui: render_ui')
  ctx.effect(() => ctx.tools.register(uiReferenceTool), 'dsh-iui: ui_reference')
  ctx.effect(() => ctx.systemPrompt.section({ name: 'dsh-iui', order: SECTION_ORDER, interpolate: false, text: IUI_SECTION }), 'dsh-iui: section')
}
