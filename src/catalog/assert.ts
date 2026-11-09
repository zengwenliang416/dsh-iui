/** Exhaustiveness checks for parsed DIL syntax. */

/**
 * Reject a node outside the closed parser union.
 * @param node - Unhandled syntax; every declared variant must be handled before this call.
 * @returns Never; an unhandled runtime node throws.
 */
export function assertNever(node: never): never {
  throw new Error(`unsupported DIL node ${JSON.stringify(node)}`)
}
