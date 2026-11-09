// Screenshot the render_ui cards of a saved Session at full height, outside the Chat scroll area.
// Usage: node scripts/render-cards.mjs <session.v4.jsonl.zstd> <out-dir> [light|dark]
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { cardPage, launchBrowser } from './card-page.mjs'

const [sessionPath, out, mode = 'light'] = process.argv.slice(2)
if (sessionPath === undefined || out === undefined) throw new Error('usage: render-cards.mjs <session.v4.jsonl.zstd> <out-dir> [light|dark]')
const cards = []
const seen = new Set()
const collect = (value) => {
  if (Array.isArray(value)) value.forEach(collect)
  else if (value !== null && typeof value === 'object') {
    if (Array.isArray(value.placements) && value.spec?.blocks !== undefined) {
      const key = JSON.stringify(value)
      if (!seen.has(key)) {
        seen.add(key)
        cards.push({ spec: value.spec, placements: value.placements })
      }
    } else Object.values(value).forEach(collect)
  }
}
for (const line of execFileSync('zstd', ['-dc', sessionPath], { encoding: 'utf8', maxBuffer: 1 << 28 }).split('\n')) {
  if (line.includes('placements')) collect(JSON.parse(line))
}
const browser = await launchBrowser()
const page = await browser.newPage({ viewport: { width: 820, height: 900 } })
const report = []
for (const [index, card] of cards.entries()) {
  const file = `${out}/card-${String(index + 1)}-${mode}`
  writeFileSync(`${file}.html`, cardPage(card, mode))
  await page.goto(`file://${file}.html`)
  await page.waitForTimeout(4000)
  await page.screenshot({ path: `${file}.png`, fullPage: true })
  report.push({ title: card.spec.title, blocks: card.spec.blocks.map((block, i) => `${block.type}→${card.placements[i].component}(${card.placements[i].source})`) })
}
await browser.close()
console.log(JSON.stringify(report, null, 1))
