import type { SessionStateSlice } from '../types/ir'

const PREFIX = 'dsh-iui:state:'

function storageKey(sessionId: string, blockKey: string) {
  return `${PREFIX}${sessionId}:${blockKey}`
}

export function loadState(sessionId: string, blockKey: string): SessionStateSlice | null {
  try {
    const raw = localStorage.getItem(storageKey(sessionId, blockKey))
    if (!raw) return null
    return JSON.parse(raw) as SessionStateSlice
  } catch {
    return null
  }
}

export function saveState(sessionId: string, blockKey: string, slice: SessionStateSlice): void {
  localStorage.setItem(storageKey(sessionId, blockKey), JSON.stringify(slice))
}

export function dumpSessionState(sessionId: string): Record<string, SessionStateSlice> {
  const out: Record<string, SessionStateSlice> = {}
  const needle = `${PREFIX}${sessionId}:`
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (!k?.startsWith(needle)) continue
    const blockKey = k.slice(needle.length)
    const slice = loadState(sessionId, blockKey)
    if (slice) out[blockKey] = slice
  }
  return out
}
