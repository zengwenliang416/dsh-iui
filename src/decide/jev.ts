/**
 * Jev component decisions: one System One request with one Choice question per
 * block, whose criteria are the catalog's component descriptions.
 */

import { COMPONENTS, type Block } from '../catalog/spec.ts'

/** Resolved Jev settings; the API key comes from the environment, never from configuration files. */
export interface JevSettings {
  readonly endpoint: string
  readonly model: string
  readonly apiKey: string
  readonly timeoutMs: number
}

/** One Choice answer as returned by System One. */
export interface JevChoice {
  readonly choice: string
  readonly confidence: number
}

/** Bounded state text: Jev sees the block content, not the whole conversation. */
const MAX_STATE_CHARS = 6_000

function question(block: Block): { type: 'choice'; instructions: string; criteria: Record<string, string> } {
  return {
    type: 'choice',
    instructions: `Which component presents the ${block.type} block at this position best for a reader of this answer?`,
    criteria: { ...COMPONENTS[block.type] },
  }
}

function isChoice(value: unknown, allowed: readonly string[]): value is JevChoice {
  if (typeof value !== 'object' || value === null) return false
  const { choice, confidence } = value as { choice?: unknown; confidence?: unknown }
  return typeof choice === 'string' && allowed.includes(choice) && typeof confidence === 'number' && Number.isFinite(confidence)
}

/**
 * Ask Jev for one component per block.
 * @param settings - Endpoint, model, key, and timeout.
 * @param title - Card title, part of the decision state.
 * @param blocks - Validated blocks in card order.
 * @param signal - Caller cancellation.
 * @returns One answer per block, or undefined for a block whose answer is missing or invalid.
 * @throws When the request fails, times out, or returns a non-success status.
 */
export async function askJev(
  settings: JevSettings, title: string | undefined, blocks: readonly Block[], signal: AbortSignal,
): Promise<(JevChoice | undefined)[]> {
  const state = JSON.stringify({ title: title ?? null, blocks }).slice(0, MAX_STATE_CHARS)
  const questions = Object.fromEntries(blocks.map((block, index) => [`block_${String(index)}`, question(block)]))
  const response = await fetch(settings.endpoint, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${settings.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: settings.model, state, questions }),
    signal: AbortSignal.any([signal, AbortSignal.timeout(settings.timeoutMs)]),
  })
  if (!response.ok) throw new Error(`Jev request failed with HTTP ${String(response.status)}`)
  const body = await response.json() as { answers?: Record<string, unknown> }
  return blocks.map((block, index) => {
    const answer = body.answers?.[`block_${String(index)}`]
    return isChoice(answer, Object.keys(COMPONENTS[block.type])) ? answer : undefined
  })
}
