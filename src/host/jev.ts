import type { IuiPayload, IuiType } from '../types/ir'

export type JevChoice = 'chart' | 'form' | 'button' | 'text' | 'none'

export type JevDecideResult = {
  choice: JevChoice | 'row' | 'col'
  confidence: number
  source: 'jev' | 'heuristic' | 'layout-passthrough'
}

const LAYOUT: ReadonlySet<string> = new Set(['row', 'col'])

const CRITERIA: Record<JevChoice, string> = {
  chart: 'numeric series / time series / comparison chart data',
  form: 'user should fill fields or submit structured input',
  button: 'a single clickable action',
  text: 'prose or labels only, no interactive control',
  none: 'do not render a UI block; keep markdown only',
}

/** Shape heuristic when JEV_API_KEY is missing (local demo / offline). */
export function heuristicPick(payload: IuiPayload): JevDecideResult {
  const props = payload.props as Record<string, unknown>
  if (Array.isArray(props.series)) {
    return { choice: 'chart', confidence: 0.9, source: 'heuristic' }
  }
  if (Array.isArray(props.fields)) {
    return { choice: 'form', confidence: 0.9, source: 'heuristic' }
  }
  if (typeof props.label === 'string' && typeof props.action === 'string') {
    return { choice: 'button', confidence: 0.9, source: 'heuristic' }
  }
  if (typeof props.content === 'string') {
    return { choice: 'text', confidence: 0.85, source: 'heuristic' }
  }
  return { choice: 'none', confidence: 0.6, source: 'heuristic' }
}

export type DecideTypeOptions = {
  intentSummary?: string
  apiKey?: string
  endpoint?: string
  /** Injected for tests. */
  fetchImpl?: typeof fetch
}

export async function decideType(
  payload: IuiPayload,
  opts: DecideTypeOptions = {},
): Promise<JevDecideResult> {
  if (payload.type && LAYOUT.has(payload.type)) {
    return { choice: payload.type as JevChoice, confidence: 1, source: 'layout-passthrough' }
  }
  // Layout types must stay as-is — never run Jev on row/col.
  if (payload.type === 'row' || payload.type === 'col') {
    return { choice: payload.type, confidence: 1, source: 'layout-passthrough' }
  }

  const apiKey =
    opts.apiKey ??
    (typeof globalThis !== 'undefined' &&
    (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
      ? (globalThis as { process?: { env?: Record<string, string | undefined> } }).process!.env!.JEV_API_KEY
      : undefined)
  if (!apiKey) return heuristicPick(payload)

  const endpoint = opts.endpoint ?? 'https://jevtypesafeai.com/api/v1/decide'
  const fetchFn = opts.fetchImpl ?? fetch
  const state = {
    intent: opts.intentSummary ?? '',
    key: payload.key,
    propsShape: Object.keys(payload.props ?? {}),
    props: payload.props,
  }

  try {
    const res = await fetchFn(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'jev-latest',
        state,
        questions: {
          component: {
            type: 'choice',
            instructions: 'Pick the best UI component type for this payload block.',
            criteria: CRITERIA,
          },
        },
      }),
    })
    if (!res.ok) return heuristicPick(payload)
    const data = (await res.json()) as {
      answers?: { component?: { choice?: string; confidence?: number } }
    }
    const choice = data.answers?.component?.choice as JevChoice | undefined
    const confidence = data.answers?.component?.confidence ?? 0
    if (!choice || !(choice in CRITERIA)) return heuristicPick(payload)
    return { choice, confidence, source: 'jev' }
  } catch {
    return heuristicPick(payload)
  }
}

export function isLayoutType(type: IuiType | undefined): boolean {
  return type === 'row' || type === 'col'
}
