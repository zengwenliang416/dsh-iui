/** Calculator formulas over input keys, evaluated without executing source text. */

import { evalExpr, parseExpr, rejectDisallowedCalls } from './expr.ts'

/**
 * Reject a formula that does not parse, calls an unlisted function, or reads a name other than an input key.
 * @param formula - Model-written formula.
 * @param keys - Input keys the formula may read.
 */
export function checkFormula(formula: string, keys: readonly string[]): void {
  rejectDisallowedCalls(parseExpr(formula), new Set(), new Set(keys))
}

/**
 * Evaluate a formula for the current input values.
 * @param formula - Formula accepted by {@link checkFormula}.
 * @param values - Current value of every input key.
 * @returns The finite result.
 * @throws When the result is not a finite number.
 */
export function evaluateFormula(formula: string, values: Readonly<Record<string, number>>): number {
  const result = evalExpr(parseExpr(formula), values)
  if (typeof result !== 'number' || !Number.isFinite(result)) throw new Error('formula result must be a finite number')
  return result
}
