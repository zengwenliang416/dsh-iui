/** Placement of every block: Jev when configured and confident, rules otherwise. */

import type { Placement, UiSpec } from '../catalog/spec.ts'
import { askJev, type JevSettings } from './jev.ts'
import { ruleComponent } from './rules.ts'

/** Decider inputs resolved from plugin configuration and the environment. */
export interface DecideOptions {
  /** Jev settings, or undefined when Jev is disabled or has no API key. */
  readonly jev?: JevSettings
  /** Lowest Jev confidence accepted; below it the rule component replaces the choice. */
  readonly minConfidence: number
}

/**
 * Place every block of a validated spec.
 * A failed or cancelled Jev request falls back to rules for every block; rules never fail.
 * @param spec - Validated spec.
 * @param options - Jev settings and confidence threshold.
 * @param signal - Caller cancellation, forwarded to Jev.
 * @returns One placement per block, in block order.
 */
export async function decide(spec: UiSpec, options: DecideOptions, signal: AbortSignal): Promise<Placement[]> {
  const rules = spec.blocks.map(block => ruleComponent(block))
  if (options.jev === undefined) return rules.map(component => ({ component, source: 'rules' }))
  let answers: Awaited<ReturnType<typeof askJev>>
  try {
    answers = await askJev(options.jev, spec.title, spec.blocks, signal)
  } catch (error) {
    // A caller abort ends the tool call; any other Jev failure leaves the rules in charge.
    if (signal.aborted) throw error
    return rules.map(component => ({ component, source: 'rules', fallback: 'unavailable' }))
  }
  return rules.map((component, index): Placement => {
    const answer = answers[index]
    if (answer === undefined) return { component, source: 'rules', fallback: 'unavailable' }
    if (answer.confidence < options.minConfidence) {
      return { component, source: 'rules', confidence: answer.confidence, fallback: 'low-confidence' }
    }
    return { component: answer.choice, source: 'jev', confidence: answer.confidence }
  })
}
