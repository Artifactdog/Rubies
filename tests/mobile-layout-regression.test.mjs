import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('mobile layout fix layer is loaded after the base styles', async () => {
  const main = await read('src/main.tsx')
  const base = main.indexOf("./ui-stability.css")
  const fixes = main.indexOf("./mobile-layout-fixes.css")
  assert.ok(base >= 0)
  assert.ok(fixes > base)
})

test('mobile plan header is forced to the viewport width', async () => {
  const css = await read('src/mobile-layout-fixes.css')
  assert.match(css, /\.plan-header\s*\{[\s\S]*?width:\s*100vw\s*!important/)
  assert.match(css, /\.plan-header \.header-actions > button\s*\{[\s\S]*?width:\s*100%\s*!important/)
})

test('mobile category groups paint rounded child corners without clipping menus', async () => {
  const css = await read('src/mobile-layout-fixes.css')
  assert.match(css, /\.category-group \.group-row\s*\{[\s\S]*?border-radius:\s*11px 11px 0 0/)
  assert.match(css, /\.category-group \.group-categories > :last-child\s*\{[\s\S]*?border-radius:\s*0 0 11px 11px/)
})

test('mobile transaction date and save action cannot exceed their container', async () => {
  const css = await read('src/mobile-layout-fixes.css')
  assert.match(css, /input\[type="date"\][\s\S]*?max-width:\s*100%\s*!important/)
  assert.match(css, /\.dialog-actions\.split-actions > div[\s\S]*?width:\s*100%\s*!important/)
  assert.match(css, /\.dialog-actions \.primary-button[\s\S]*?width:\s*100%\s*!important/)
})

test('single-budget UI hides legacy plan naming controls', async () => {
  const css = await read('src/mobile-layout-fixes.css')
  assert.match(css, /access-form:has\(input\[autocomplete="new-password"\]\) > label:first-child/)
  assert.match(css, /summary-list > div:first-child/)
})
