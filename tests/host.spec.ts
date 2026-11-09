import { afterEach, describe, expect, it, vi } from 'vitest'
import type { UiSpec } from '../src/catalog/spec.ts'
import { validateSpec } from '../src/catalog/validate.ts'
import { decide } from '../src/decide/decide.ts'
import { ruleComponent } from '../src/decide/rules.ts'
import { resolveDecideOptions, type Config } from '../src/index.ts'
import { BLOCK_GUIDES, blockReference } from '../src/prompt.ts'
import { BLOCK_TYPES, COMPONENTS, type Block } from '../src/catalog/spec.ts'

const comparison: UiSpec = {
  title: 'Weekly plans',
  blocks: [
    { type: 'summary', text: 'Both plans total 40 minutes.' },
    {
      type: 'comparison',
      attributes: [{ key: 'sessions', label: 'Sessions' }, { key: 'length', label: 'Each', unit: 'min' }],
      items: [{ name: 'Short', values: { sessions: 4, length: 10 } }, { name: 'Long', values: { sessions: 2, length: 20 } }],
    },
  ],
}

const jevConfig: Config['jev'] = {
  enabled: true, endpoint: 'https://jev.test/v1/systemone', model: 'jev-latest', apiKeyEnv: 'TEST_JEV_KEY', timeoutMs: 1000, minConfidence: 0.5,
}

afterEach(() => { vi.unstubAllGlobals() })

describe('content validation', () => {
  it('accepts a consistent spec', () => {
    expect(validateSpec(comparison)).toEqual([])
  })

  it('names every problem with its path so the model can fix it', () => {
    expect(validateSpec({
      blocks: [
        { type: 'comparison', attributes: [{ key: 'a', label: 'A' }, { key: 'a', label: 'A2' }], items: [{ name: 'x', values: {} }] },
        { type: 'choice', prompt: 'Pick', options: [{ id: 'one', label: 'One', detail: 'd' }], correct: 'two' },
        {
          type: 'calculator',
          inputs: [{ key: 'total', label: 'Total', min: 10, max: 5, step: 0, value: 20 }],
          outputs: [{ label: 'Bad', formula: 'total / rate' }, { label: 'Call', formula: 'fetch(total)' }],
        },
      ],
    })).toEqual([
      'blocks[0].attributes repeats key "a"',
      'blocks[0].items[0].values is missing "a", "a"',
      'blocks[1].options must contain 2 to 8 entries, found 1',
      'blocks[1].correct "two" is not an option id',
      'blocks[2].inputs[0] needs min < max',
      'blocks[2].inputs[0].step must be positive',
      'blocks[2].inputs[0].value must lie between min and max',
      'blocks[2].outputs[0].formula "total / rate": unknown name \'rate\'',
      'blocks[2].outputs[1].formula "fetch(total)": only Math.min, max, round, floor, ceil, abs, Number, String, and Object.keys, values, entries may be called',
    ])
  })

  it('rejects a formula whose initial result is not finite and an input key formulas cannot read', () => {
    expect(validateSpec({
      blocks: [{
        type: 'calculator',
        inputs: [{ key: 'n', label: 'N', min: 0, max: 4, step: 1, value: 0 }, { key: 'class', label: 'Class', min: 0, max: 1, step: 1, value: 0 }],
        outputs: [{ label: 'Share', formula: '1 / n' }],
      }],
    })).toEqual([
      'blocks[0].inputs[1].key "class" must be a letter or underscore followed by letters, digits, or underscores, and not a reserved word',
      'blocks[0].outputs[0].formula "1 / n": result must be a finite JSON number',
    ])
  })
})

describe('rule placements', () => {
  it('chooses from the block shape', () => {
    expect(ruleComponent({ type: 'summary', text: 'short' })).toBe('callout')
    expect(ruleComponent({ type: 'summary', text: 'x'.repeat(200) })).toBe('card')
    expect(ruleComponent(comparison.blocks[1]!)).toBe('table')
    expect(ruleComponent({
      type: 'comparison', attributes: [{ key: 'v', label: 'V' }],
      items: [{ name: 'a', values: { v: 'warm' } }, { name: 'b', values: { v: 'cold' } }],
    })).toBe('card-grid')
    const option = (id: string, label: string) => ({ id, label, detail: 'd' })
    expect(ruleComponent({ type: 'choice', prompt: 'p', options: [option('a', 'A'), option('b', 'B')] })).toBe('segmented')
    expect(ruleComponent({ type: 'choice', prompt: 'p', options: [option('a', 'A much longer label'), option('b', 'B')] })).toBe('option-cards')
    const input = (max: number) => ({ key: 'x', label: 'X', min: 0, max, step: 1, value: 0 })
    expect(ruleComponent({ type: 'calculator', inputs: [input(100)], outputs: [{ label: 'y', formula: 'x' }] })).toBe('sliders')
    expect(ruleComponent({ type: 'calculator', inputs: [input(10_000)], outputs: [{ label: 'y', formula: 'x' }] })).toBe('number-fields')
  })
})

describe('Jev placements', () => {
  const settings = { jev: { endpoint: jevConfig.endpoint, model: 'jev-latest', apiKey: 'key', timeoutMs: 1000 }, minConfidence: 0.5 }

  function answer(body: unknown, status = 200) {
    const fetch = vi.fn(() => Promise.resolve(new Response(JSON.stringify(body), { status })))
    vi.stubGlobal('fetch', fetch)
    return fetch
  }

  it('sends one choice question per block with the catalog descriptions and keeps confident choices', async () => {
    const fetch = answer({ answers: {
      block_0: { type: 'choice', choice: 'card', confidence: 0.9 },
      block_1: { type: 'choice', choice: 'card-grid', confidence: 0.3 },
    } })
    expect(await decide(comparison, settings, new AbortController().signal)).toEqual([
      { component: 'card', source: 'jev', confidence: 0.9 },
      { component: 'table', source: 'rules', confidence: 0.3, fallback: 'low-confidence' },
    ])
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(jevConfig.endpoint)
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer key')
    const body = JSON.parse(String(init.body)) as { model: string; questions: Record<string, { criteria: Record<string, string> }> }
    expect(body.model).toBe('jev-latest')
    expect(Object.keys(body.questions.block_1!.criteria)).toEqual(['table', 'card-grid'])
  })

  it('falls back to rules when Jev fails or names an unknown component', async () => {
    answer({ detail: 'bad' }, 500)
    expect(await decide(comparison, settings, new AbortController().signal)).toEqual([
      { component: 'callout', source: 'rules', fallback: 'unavailable' },
      { component: 'table', source: 'rules', fallback: 'unavailable' },
    ])
    answer({ answers: { block_0: { choice: 'carousel', confidence: 1 } } })
    expect((await decide(comparison, settings, new AbortController().signal))[0]).toEqual({ component: 'callout', source: 'rules', fallback: 'unavailable' })
  })

  it('propagates a caller abort instead of deciding', async () => {
    vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => { reject(init.signal?.reason) })
    })))
    const controller = new AbortController()
    const pending = decide(comparison, settings, controller.signal)
    controller.abort(new Error('stopped'))
    await expect(pending).rejects.toThrow('stopped')
  })

  it('uses rules only without an enabled, keyed Jev configuration', async () => {
    expect(resolveDecideOptions({ jev: jevConfig }, {}).jev).toBeUndefined()
    expect(resolveDecideOptions({ jev: { ...jevConfig, enabled: false } }, { TEST_JEV_KEY: 'k' }).jev).toBeUndefined()
    expect(resolveDecideOptions({ jev: jevConfig }, { TEST_JEV_KEY: ' k ' }).jev?.apiKey).toBe('k')
    expect(await decide(comparison, { minConfidence: 0.5 }, new AbortController().signal)).toEqual([
      { component: 'callout', source: 'rules' },
      { component: 'table', source: 'rules' },
    ])
  })
})

describe('block reference', () => {
  it('pairs generated fields, guidance, and a valid example with every block type', () => {
    for (const type of BLOCK_TYPES) {
      expect(validateSpec({ blocks: [BLOCK_GUIDES[type].example] }), type).toEqual([])
      const reference = blockReference(type)
      expect(reference.startsWith(`## ${type}: `)).toBe(true)
      expect(reference).toContain('Example: {')
    }
    expect(blockReference('calculator')).toContain('- inputs (list of objects, required): One to six inputs\n  - key (string, required)')
    expect(blockReference('notice')).toContain('- tone ("info" | "success" | "warning" | "danger", required)')
  })

  it('rejects unknown block types and invalid fields with their path', () => {
    const errors = validateSpec({ blocks: [{ type: 'carousel' }, { type: 'steps', steps: [{ detail: 'x' }] }, { type: 'notice', tone: 'loud', text: 'x' }] })
    expect(errors[0]).toBe(`blocks[0].type must be one of ${BLOCK_TYPES.join(', ')}`)
    expect(errors.some(error => error.startsWith('blocks[1] (steps): ') && error.includes('title'))).toBe(true)
    expect(errors.some(error => error.startsWith('blocks[2] (notice): ') && error.includes('tone'))).toBe(true)
  })

  it('checks cross-field rules of the newer block types', () => {
    expect(validateSpec({ blocks: [
      { type: 'steps', steps: [{ title: 'a' }], current: 3 },
      { type: 'metrics', metrics: [{ label: 'Done', value: 150, max: 120 }] },
      { type: 'checklist', items: [{ id: 'a', label: 'A' }, { id: 'a', label: 'B' }] },
      { type: 'sections', sections: [{ id: 'only', label: 'Only', text: 'x' }] },
      { type: 'chart', x: { key: 'm', label: 'M' }, series: [{ key: 'v', label: 'V' }], data: [{ m: 'Jan', v: 'high' }, { v: 2 }] },
      { type: 'calculator', inputs: [{ key: 'on', label: 'On', kind: 'toggle', value: 2 }, { key: 'n', label: 'N', kind: 'options', value: 5, options: [{ label: 'One', value: 1 }, { label: 'Two', value: 2 }] }, { key: 'x', label: 'X', value: 1 }], outputs: [{ label: 'Y', formula: 'on + n' }] },
    ] })).toEqual([
      'blocks[0].current must be a step index from 0 to 0',
      'blocks[1].metrics[0].value must be a number from 0 to max',
      'blocks[2].items repeats id "a"',
      'blocks[3].sections must contain 2 to 6 entries, found 1',
      'blocks[4].data[0] needs a number for "v"',
      'blocks[4].data[1] needs a text or number "m" x value',
      'blocks[5].inputs[0].value of a toggle must be 0 or 1',
      'blocks[5].inputs[1].value must be one of its options\' values',
      'blocks[5].inputs[2] is a number input and needs min, max, and step',
    ])
  })
})

describe('newer block validation', () => {
  it('bounds trees, restricts source links to the web, and checks calendar days and timer length', () => {
    const deep = { label: 'a', children: [{ label: 'b', children: [{ label: 'c', children: [{ label: 'd', children: [{ label: 'e' }] }] }] }] }
    expect(validateSpec({ blocks: [
      { type: 'tree', nodes: [deep, { label: 'x', children: [{ detail: 'no label' }] }] },
      { type: 'sources', sources: [{ title: 'Local', url: 'file:///etc/passwd' }, { title: 'Script', url: 'javascript:alert(1)' }, { title: 'Ok', url: 'https://example.com' }] },
      { type: 'calendar', events: [{ date: '2026-02-30', title: 'x' }, { date: 'next week', title: 'y' }, { date: '2026-11-09', title: 'z' }] },
      { type: 'timer', label: 'Practice', minutes: 0 },
      { type: 'gallery', items: [{ title: 'Only', text: 'one' }] },
    ] })).toEqual([
      'blocks[0].nodes[0].children[0].children[0].children[0].children is nested deeper than 4 levels',
      'blocks[0].nodes[1].children[0]: missing required property "label"',
      'blocks[1].sources[0].url must be an http or https address',
      'blocks[1].sources[1].url must be an http or https address',
      'blocks[2].events[0].date "2026-02-30" must be a real day written YYYY-MM-DD',
      'blocks[2].events[1].date "next week" must be a real day written YYYY-MM-DD',
      'blocks[3].minutes must be from 1 to 180',
      'blocks[4].items must contain 2 to 12 entries, found 1',
    ])
  })
})

describe('rule placements of every block type', () => {
  it('chooses a declared candidate for every guide example', () => {
    for (const type of BLOCK_TYPES) {
      const example: Block = BLOCK_GUIDES[type].example
      expect(Object.keys(COMPONENTS[type])).toContain(ruleComponent(example))
    }
    expect(ruleComponent({ type: 'notice', tone: 'danger', text: 'x' })).toBe('banner')
    expect(ruleComponent({ type: 'notice', tone: 'info', text: 'x' })).toBe('inline')
    expect(ruleComponent({ type: 'steps', steps: Array.from({ length: 8 }, (_, i) => ({ title: String(i) })) })).toBe('numbered-list')
    expect(ruleComponent({ type: 'steps', steps: [{ title: 'a', detail: 'x'.repeat(300) }] })).toBe('accordion')
    expect(ruleComponent({ type: 'metrics', metrics: [{ label: 'a', value: 1, max: 2 }] })).toBe('progress')
    expect(ruleComponent({ type: 'metrics', metrics: [{ label: 'a', value: 'high' }] })).toBe('metadata')
    expect(ruleComponent({ type: 'faq', items: Array.from({ length: 4 }, () => ({ question: 'q', answer: 'a' })) })).toBe('accordion')
    expect(ruleComponent({ type: 'sections', sections: [{ id: 'a', label: 'A very long section label', text: 'x' }, { id: 'b', label: 'B', text: 'y' }] })).toBe('radio-list')
    expect(ruleComponent({ type: 'chart', x: { key: 'k', label: 'K' }, series: [{ key: 'v', label: 'V' }], data: [{ k: 'a', v: 1 }] })).toBe('bar')
    expect(ruleComponent({ type: 'code', language: 'ts', code: 'a\n'.repeat(20) })).toBe('numbered')
    expect(ruleComponent({ type: 'tags', tags: [{ label: 'x' }] })).toBe('tokens')
    expect(ruleComponent({ type: 'calendar', events: [{ date: '2026-01-01', title: 'a' }, { date: '2026-12-01', title: 'b' }] })).toBe('agenda')
    expect(ruleComponent({ type: 'glossary', terms: Array.from({ length: 9 }, (_, i) => ({ term: String(i), definition: 'd' })) })).toBe('infotips')
    expect(ruleComponent({ type: 'gallery', items: Array.from({ length: 5 }, (_, i) => ({ title: String(i), text: 't' })) })).toBe('carousel')
    expect(ruleComponent({ type: 'tree', nodes: [{ label: 'a', children: [{ label: 'b', children: [{ label: 'c' }] }] }] })).toBe('tree')
  })
})

describe('calculator formulas', () => {
  it('accepts == and != as strict comparisons, as models commonly write them', async () => {
    const { evaluateFormula } = await import('../src/catalog/formula.ts')
    expect(evaluateFormula('sessions == 3 ? weekly / 3 : weekly / 2', { sessions: 3, weekly: 120 })).toBe(40)
    expect(evaluateFormula('sessions != 3 ? weekly / 2 : weekly / 3', { sessions: 2, weekly: 120 })).toBe(60)
    expect(evaluateFormula('Math.abs(weekly / sessions - (sessions == 3 ? weekly / 2 : weekly / 3))', { sessions: 3, weekly: 120 })).toBe(20)
    expect(evaluateFormula('sessions === 3 ? 1 : 0', { sessions: 3 })).toBe(1)
    expect(validateSpec({ blocks: [{
      type: 'calculator',
      inputs: [{ key: 'sessions', label: 'Sessions', min: 2, max: 3, step: 1, value: 3 }, { key: 'weekly', label: 'Weekly', min: 60, max: 180, step: 10, value: 120 }],
      outputs: [{ label: 'Each', formula: 'sessions == 3 ? weekly / 3 : weekly / 2' }],
    }] })).toEqual([])
  })
})
