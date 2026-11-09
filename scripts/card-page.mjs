// A standalone page that renders one decided card in the real sandboxed renderer, for screenshots outside DSH.
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const js = readFileSync(new URL('../island/dist/island.js', import.meta.url), 'utf8').replaceAll('</script', '<\\/script')
const css = readFileSync(new URL('../island/dist/island.css', import.meta.url), 'utf8').replaceAll('</style', '<\\/style')
const srcdoc = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style><style>html,body{margin:0;background:transparent}</style></head><body><div id="root"></div><script>${js}</script></body></html>`

/**
 * HTML of a page holding one card frame; the page title becomes `h<height>` once the card reports its height.
 * @param card - `{ spec, placements }` as stored in the render_ui result.
 * @param mode - `light` or `dark`.
 * @returns The page HTML.
 */
export function cardPage(card, mode) {
  return `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:24px;background:${mode === 'dark' ? '#111' : '#fff'}">
<iframe id="card" sandbox="allow-scripts" style="width:760px;border:0;display:block"></iframe>
<script>
const frame = document.getElementById('card')
frame.srcdoc = ${JSON.stringify(srcdoc).replaceAll('</', '<\\/')}
const card = ${JSON.stringify(card).replaceAll('</', '<\\/')}
window.addEventListener('message', (event) => {
  if (event.source !== frame.contentWindow) return
  if (event.data.kind === 'dsh-iui:ready') frame.contentWindow.postMessage({ kind: 'dsh-iui:render', card, state: { selections: {}, values: {}, checks: {} }, theme: { mode: '${mode}' }, language: 'zh-CN' }, '*')
  if (event.data.kind === 'dsh-iui:height') { frame.style.height = event.data.height + 'px'; document.title = 'h' + event.data.height }
})
</script></body></html>`
}

/**
 * Launch Playwright Chromium (`npx playwright install chromium` once).
 * @returns The browser.
 */
export async function launchBrowser() {
  const require = createRequire(import.meta.url)
  return require('playwright').chromium.launch()
}
