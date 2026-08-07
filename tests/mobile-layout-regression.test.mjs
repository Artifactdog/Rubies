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

test('mobile plan header fills its container without viewport-width hacks', async () => {
  const css = await read('src/mobile-layout-fixes.css')
  assert.match(css, /\.plan-header,[\s\S]*?width:\s*100%\s*!important/)
  assert.match(css, /\.plan-header \.month-navigation\s*\{[\s\S]*?grid-template-columns:/)
  assert.match(css, /\.plan-header \.header-actions\s*\{[\s\S]*?grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/)
  assert.doesNotMatch(css, /\.plan-header\s*\{[\s\S]{0,180}?width:\s*100vw/)
  assert.doesNotMatch(css, /\.plan-header\s*\{[\s\S]{0,220}?margin-left:\s*-[0-9]/)
})

test('iOS standalone layout consumes safe areas explicitly', async () => {
  const css = await read('src/mobile-layout-fixes.css')
  assert.match(css, /--rubies-safe-top:\s*env\(safe-area-inset-top/)
  assert.match(css, /\.app-shell\s*\{[\s\S]*?padding-top:\s*var\(--rubies-safe-top\)/)
  assert.match(css, /\.budget-health-hud\s*\{[\s\S]*?var\(--rubies-safe-top\)/)
  assert.match(css, /\.mobile-nav button\s*\{[\s\S]*?var\(--rubies-safe-bottom\)/)
})

test('mobile category groups paint rounded child corners without clipping menus', async () => {
  const css = await read('src/mobile-layout-fixes.css')
  assert.match(css, /\.category-group \.group-row\s*\{[\s\S]*?border-radius:\s*11px 11px 0 0/)
  assert.match(css, /\.category-group \.group-categories > :last-child\s*\{[\s\S]*?border-radius:\s*0 0 11px 11px/)
})

test('mobile transaction form and native date control cannot exceed the viewport', async () => {
  const css = await read('src/mobile-layout-fixes.css')
  assert.match(css, /\.transaction-screen-card \.form-grid,[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)\s*!important/)
  assert.match(css, /input\[type="date"\][\s\S]*?max-inline-size:\s*100%\s*!important/)
  assert.match(css, /input\[type="date"\][\s\S]*?-webkit-appearance:\s*none/)
  assert.match(css, /\.dialog-actions\.split-actions > div[\s\S]*?width:\s*100%\s*!important/)
  assert.match(css, /\.dialog-actions \.primary-button[\s\S]*?width:\s*100%\s*!important/)
})

test('single-budget UI hides legacy plan naming controls', async () => {
  const css = await read('src/mobile-layout-fixes.css')
  assert.match(css, /access-form:has\(input\[autocomplete="new-password"\]\) > label:first-child/)
  assert.match(css, /summary-list > div:first-child/)
})
