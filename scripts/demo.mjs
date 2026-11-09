// Record a real conversation with the plugin: natural question → card → interactions → reload.
// Usage: node scripts/demo.mjs <server-log> <out-dir> <prompt | session:<sidebar title>>
// `session:` reopens an existing conversation instead of sending a prompt.
// The server must run a DSH profile with this plugin, e.g. `dsh <profile> --no-open --port 3191 > <server-log>`; the session is created in a workspace named chatgpt-iui.
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const [logPath, OUT, PROMPT] = process.argv.slice(2)
if (logPath === undefined || OUT === undefined || PROMPT === undefined) throw new Error('usage: demo.mjs <server-log> <out-dir> <prompt>')
const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
mkdirSync(OUT, { recursive: true })
const url = readFileSync(logPath, 'utf8').match(/dsh web: (http\S+)/)[1]
const log = (...args) => { console.log(new Date().toISOString().slice(11, 19), ...args) }

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1280, height: 860 }, locale: 'zh-CN', recordVideo: { dir: OUT, size: { width: 1280, height: 860 } } })
const page = await context.newPage()
const pause = ms => page.waitForTimeout(ms)
const result = { prompt: PROMPT, controls: {}, skipped: [] }
// One control that never settles (an animating carousel, a hidden node) must not end the walkthrough.
const attempt = async (name, operate) => {
  try {
    await operate()
  } catch (error) {
    result.skipped.push(`${name}: ${String(error).split('\n')[0]}`)
  }
}
// Cards inside the collapsed process stay mounted but hidden; only shown cards are captured and operated.
const shownCards = () => page.locator('iframe[data-dsh-iui-card]:visible')
const cardTexts = async () => Promise.all((await shownCards().all()).map(frame => frame.contentFrame().locator('body').innerText()))
try {
  await page.goto(url)
  await pause(2500)
  const cont = page.getByRole('button', { name: '继续' })
  if (await cont.count()) await cont.click()
  if (PROMPT.startsWith('session:')) {
    await page.getByText(PROMPT.slice('session:'.length)).first().click()
    await shownCards().first().waitFor({ timeout: 60_000 })
    await pause(3000)
  } else {
    // New session in the chatgpt-iui workspace, read-only so the demo cannot change files.
    await page.getByText('chatgpt-iui', { exact: true }).first().hover()
    await pause(400)
    await page.locator('button[aria-label="在“chatgpt-iui”中新建会话"]').click({ force: true })
    await pause(1200)
    await page.getByRole('button', { name: /工作区内修改|完全权限|仅可查看/ }).first().click()
    await page.getByRole('menuitem', { name: '仅可查看' }).click()
    await pause(600)
    const composer = page.locator('[data-composer-input]').first()
    await composer.click()
    await composer.pressSequentially(PROMPT, { delay: 10 })
    await composer.press('Enter')
    log('sent')
    await page.locator('iframe[data-dsh-iui-card]').first().waitFor({ state: 'attached', timeout: 300_000 })
    log('card attached')
    let last = ''
    for (let stable = 0, i = 0; stable < 10 && i < 400; i++) {
      await pause(1500)
      const now = await page.locator('body').innerText()
      stable = now === last ? stable + 1 : 0
      last = now
    }
  }
  log('turn settled')
  const summary = page.getByText(/已完成，用时/).last()
  if (await summary.count()) {
    await summary.scrollIntoViewIfNeeded()
    await summary.click()
    await pause(3000)
    await page.screenshot({ path: `${OUT}/00-process.png` })
    await summary.click()
    await pause(1200)
  }
  const cards = await shownCards().all()
  result.cards = cards.length
  await cards[0].scrollIntoViewIfNeeded()
  await pause(1500)
  await page.screenshot({ path: `${OUT}/01-card.png` })
  // Full-height card images come from scripts/render-cards.mjs; Chat clips tall cards to its scroll area.
  for (const frame of cards) {
    const card = frame.contentFrame()
    // Walk the card top to bottom, operating each kind of control it offers.
    const act = async (role, count, operate) => {
      const items = card.getByRole(role)
      const total = await items.count()
      result.controls[role] = (result.controls[role] ?? 0) + total
      for (let i = 0; i < Math.min(total, count); i++) {
        await attempt(`${role} ${String(i)}`, async () => {
          await items.nth(i).evaluate(element => { element.scrollIntoView({ block: 'center' }) }, undefined, { timeout: 5000 })
          await operate(items.nth(i))
        })
        await pause(1600)
      }
    }
    await act('tab', 3, item => item.click({ timeout: 5000 }))
    await act('radio', 4, item => item.click({ force: true, timeout: 5000 }))
    await act('checkbox', 4, item => item.dispatchEvent('click', undefined, { timeout: 5000 }))
    await act('slider', 2, async (item) => {
      await item.focus()
      for (let k = 0; k < 4; k++) { await item.press('ArrowRight'); await pause(500) }
    })
    await act('spinbutton', 2, item => item.press('ArrowUp'))
    const start = card.getByRole('button', { name: /^(开始|Start)$/ })
    const timers = await start.count()
    result.controls.timers = (result.controls.timers ?? 0) + timers
    if (timers > 0) {
      await attempt('timer', () => start.first().click({ timeout: 5000 }))
      await pause(3500)
    }
    const days = card.locator('[role="grid"] button:not([disabled]):not([aria-disabled="true"])')
    const dayCount = await days.count()
    result.controls.calendarDays = (result.controls.calendarDays ?? 0) + dayCount
    for (let i = 1; i < Math.min(dayCount, 3); i++) {
      await attempt(`day ${String(i)}`, () => days.nth(i).click({ timeout: 5000 }))
      await pause(1600)
    }
    const expandable = card.locator('[aria-expanded="false"]')
    const collapsed = await expandable.count()
    result.controls.collapsed = (result.controls.collapsed ?? 0) + collapsed
    for (let i = 0; i < Math.min(collapsed, 2); i++) {
      await attempt(`expand ${String(i)}`, () => expandable.first().click({ timeout: 5000 }))
      await pause(1400)
    }
  }
  log('controls', JSON.stringify(result.controls))
  await page.screenshot({ path: `${OUT}/02-interacted.png` })
  const before = await cardTexts()
  await page.reload()
  await shownCards().first().waitFor({ timeout: 60_000 })
  await pause(3500)
  await shownCards().last().scrollIntoViewIfNeeded()
  await pause(1500)
  const after = await cardTexts()
  result.restoredText = before.map((text, index) => text === after[index])
  await page.screenshot({ path: `${OUT}/03-reloaded.png` })
  log('reloaded; same card text =', result.restoredText)
} catch (error) {
  result.error = String(error)
  await page.screenshot({ path: `${OUT}/error.png` }).catch(() => {})
  log('error', result.error)
} finally {
  const video = page.video()
  await context.close()
  await browser.close()
  if (video) renameSync(await video.path(), `${OUT}/demo.webm`)
  writeFileSync(`${OUT}/result.json`, JSON.stringify(result, null, 2))
}
