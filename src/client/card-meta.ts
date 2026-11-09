/** Read a card from persisted tool-result metadata and its reader state from browser storage. */

import type { CardState } from '../catalog/protocol.ts'
import type { ResolvedCard } from '../catalog/spec.ts'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Accept the `render_ui` result metadata recorded in the session log.
 * The host validated the content when it ran; this guards only against logs from other versions.
 * @param meta - Persisted `tool/result` metadata.
 * @returns The card, or undefined when the metadata is not a card.
 */
export function cardFromMeta(meta: unknown): ResolvedCard | undefined {
  if (!isRecord(meta) || !isRecord(meta.spec) || !Array.isArray(meta.placements)) return undefined
  const blocks = meta.spec.blocks
  if (!Array.isArray(blocks) || blocks.length !== meta.placements.length) return undefined
  // Shape and content were validated by the host tool that produced this metadata.
  return meta as unknown as ResolvedCard
}

/** Storage key prefix; one entry per Session and tool call. */
const STATE_PREFIX = 'dsh-iui:v1:'
/** Serialized state above this size is not stored. */
const MAX_STATE_CHARS = 16_384

/**
 * Storage key of one card's reader state.
 * @param sessionId - Owning Session.
 * @param callId - The `render_ui` call that produced the card.
 * @returns The localStorage key.
 */
export function stateKey(sessionId: string, callId: string): string {
  return `${STATE_PREFIX}${sessionId}:${callId}`
}

/**
 * Read saved reader state, discarding anything malformed.
 * @param key - Key from {@link stateKey}.
 * @returns The saved state, or undefined.
 */
export function loadState(key: string): CardState | undefined {
  let raw: string | null
  try {
    raw = localStorage.getItem(key)
  } catch (_error) {
    // Storage can be unavailable (private mode, quota policy); the card starts fresh.
    return undefined
  }
  if (raw === null) return undefined
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch (_error) {
    // A corrupted entry is ignored and overwritten by the next interaction.
    return undefined
  }
  if (!isRecord(value) || !isRecord(value.selections) || !isRecord(value.values)) return undefined
  const selections = Object.fromEntries(Object.entries(value.selections).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
  const values = Object.fromEntries(Object.entries(value.values).flatMap(([block, inputs]) => isRecord(inputs)
    ? [[block, Object.fromEntries(Object.entries(inputs).filter((entry): entry is [string, number] => typeof entry[1] === 'number' && Number.isFinite(entry[1])))]]
    : []))
  const checks = isRecord(value.checks)
    ? Object.fromEntries(Object.entries(value.checks).flatMap(([block, ids]) => Array.isArray(ids)
      ? [[block, ids.filter((id): id is string => typeof id === 'string')]]
      : []))
    : {}
  return { selections, values, checks }
}

/**
 * Save reader state; oversized or unwritable state stays in memory only.
 * @param key - Key from {@link stateKey}.
 * @param state - Current state.
 */
export function saveState(key: string, state: CardState): void {
  const raw = JSON.stringify(state)
  if (raw.length > MAX_STATE_CHARS) return
  try {
    localStorage.setItem(key, raw)
  } catch (_error) {
    // Quota or policy failures leave the in-memory state authoritative for this view.
  }
}
