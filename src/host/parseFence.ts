import type { IuiPayload } from '../types/ir'

const FENCE_RE = /```dsh-iui\s*\n([\s\S]*?)```/g
const FENCE_OPEN_RE = /```dsh-iui\s*\n([\s\S]*)$/

/** Extract complete ```dsh-iui``` fences; incomplete trailing fence is ignored. */
export function extractCompleteFences(text: string): string[] {
  const out: string[] = []
  for (const m of text.matchAll(FENCE_RE)) {
    const body = m[1]?.trim()
    if (body) out.push(body)
  }
  return out
}

/** Body of the last unclosed ```dsh-iui fence, if any. */
export function extractOpenFenceBody(text: string): string | null {
  // Strip complete fences first so we only see the trailing open one.
  const withoutComplete = text.replace(FENCE_RE, '')
  const m = withoutComplete.match(FENCE_OPEN_RE)
  return m?.[1] ?? null
}

function isPayload(v: unknown): v is IuiPayload {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  return typeof o.key === 'string' && o.props !== undefined && typeof o.props === 'object'
}

/** Parse fence body into payload roots. Accepts a single node, `{blocks:[...]}`, or an array. */
export function parsePayloadRoots(body: string): IuiPayload[] {
  let data: unknown
  try {
    data = JSON.parse(body)
  } catch {
    return []
  }
  if (Array.isArray(data)) return data.filter(isPayload)
  if (data && typeof data === 'object' && Array.isArray((data as { blocks?: unknown }).blocks)) {
    return ((data as { blocks: unknown[] }).blocks).filter(isPayload)
  }
  if (isPayload(data)) return [data]
  return []
}

/**
 * Extract balanced `{...}` slices that parse as IuiPayload from arbitrary text
 * (used for progressive streaming inside an open fence).
 */
export function extractCompleteJsonObjects(text: string): IuiPayload[] {
  const out: IuiPayload[] = []
  let i = 0
  while (i < text.length) {
    if (text[i] !== '{') {
      i++
      continue
    }
    let depth = 0
    let inStr = false
    let esc = false
    let end = -1
    for (let j = i; j < text.length; j++) {
      const ch = text[j]
      if (inStr) {
        if (esc) {
          esc = false
        } else if (ch === '\\') {
          esc = true
        } else if (ch === '"') {
          inStr = false
        }
        continue
      }
      if (ch === '"') {
        inStr = true
        continue
      }
      if (ch === '{') depth++
      else if (ch === '}') {
        depth--
        if (depth === 0) {
          end = j
          break
        }
      }
    }
    if (end < 0) {
      // Unbalanced outer brace (open fence) — skip this '{' and keep scanning inners.
      i++
      continue
    }
    const slice = text.slice(i, end + 1)
    try {
      const data = JSON.parse(slice) as unknown
      if (isPayload(data)) out.push(data)
      else if (
        data &&
        typeof data === 'object' &&
        Array.isArray((data as { blocks?: unknown }).blocks)
      ) {
        out.push(...((data as { blocks: unknown[] }).blocks).filter(isPayload))
      }
    } catch {
      // skip
    }
    i = end + 1
  }
  return out
}

function flattenPayloads(list: IuiPayload[]): IuiPayload[] {
  const out: IuiPayload[] = []
  const walk = (p: IuiPayload) => {
    out.push(p)
    p.children?.forEach(walk)
  }
  list.forEach(walk)
  return out
}

/** Streaming helper: only return roots from fully closed fences in the buffer. */
export function parseStreamingPayloads(buffer: string): IuiPayload[] {
  const roots: IuiPayload[] = []
  for (const body of extractCompleteFences(buffer)) {
    roots.push(...parsePayloadRoots(body))
  }
  return roots
}

/**
 * Progressive streaming: closed fences + complete JSON objects inside an open fence.
 * Returns a flat list (parents and children) so each ready node can upsert independently.
 */
export function parseProgressivePayloads(buffer: string): IuiPayload[] {
  const seen = new Set<string>()
  const out: IuiPayload[] = []
  const add = (list: IuiPayload[]) => {
    for (const p of flattenPayloads(list)) {
      if (seen.has(p.key)) continue
      seen.add(p.key)
      out.push(p)
    }
  }

  for (const body of extractCompleteFences(buffer)) {
    add(parsePayloadRoots(body))
  }

  const open = extractOpenFenceBody(buffer)
  if (open) {
    // Try full parse first (open fence may still be valid JSON if blocks closed)
    const full = parsePayloadRoots(open.trim())
    if (full.length) add(full)
    else add(extractCompleteJsonObjects(open))
  }

  return out
}
