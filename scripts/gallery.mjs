// Render every candidate component of every block type in the real sandboxed renderer and screenshot it.
import { writeFileSync } from 'node:fs'
import { tsImport } from 'tsx/esm/api'
import { cardPage, launchBrowser } from './card-page.mjs'

const out = process.argv[2] ?? '/tmp/iui-gallery'
const { BLOCK_GUIDES } = await tsImport('../src/prompt.ts', import.meta.url)
const { COMPONENTS } = await tsImport('../src/catalog/spec.ts', import.meta.url)
const blocks = []
const placements = []
for (const [type, components] of Object.entries(COMPONENTS)) {
  for (const component of Object.keys(components)) {
    blocks.push({ type: 'tags', tags: [{ label: `${type} → ${component}`, tone: 'info' }] }, BLOCK_GUIDES[type].example)
    placements.push({ component: 'badges', source: 'rules' }, { component, source: 'rules' })
  }
}
const mode = process.argv[3] ?? 'light'
const html = cardPage({ spec: { title: 'Component gallery', blocks }, placements }, mode)
writeFileSync(`${out}/gallery-${mode}.html`, html)
const browser = await launchBrowser()
const page = await browser.newPage({ viewport: { width: 820, height: 900 } })
const errors = []
page.on('console', message => { if (message.type() === 'error') errors.push(message.text().slice(0, 300)) })
page.on('pageerror', error => { errors.push(String(error).slice(0, 300)) })
await page.goto(`file://${out}/gallery-${mode}.html`)
await page.waitForTimeout(6000)
await page.screenshot({ path: `${out}/gallery-${mode}.png`, fullPage: true })
const frame = page.frameLocator('#card')
const missing = []
for (const [type, components] of Object.entries(COMPONENTS)) {
  for (const component of Object.keys(components)) {
    if (await frame.getByText(`${type} → ${component}`, { exact: true }).count() === 0) missing.push(`${type}/${component}`)
  }
}
console.log(JSON.stringify({ variants: placements.length / 2, height: await page.title(), errors, missing }, null, 1))
await browser.close()
