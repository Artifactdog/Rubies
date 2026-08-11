import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('mobile-native stylesheet is loaded last', async () => {
  const main = await read('src/main.tsx')
  const legacyFixes = main.indexOf("./mobile-layout-fixes.css")
  const native = main.indexOf("./mobile-native.css")
  assert.ok(legacyFixes >= 0)
  assert.ok(native > legacyFixes)
})

test('mobile plan header fills its parent without viewport-width hacks', async () => {
  const css = await read('src/mobile-native.css')
  assert.match(css, /\.plan-header[\s\S]*?inline-size:\s*100%\s*!important/)
  assert.match(css, /grid-template-columns:\s*42px minmax\(0, 1fr\) 42px 42px/)
  assert.doesNotMatch(css, /width:\s*100vw/)
  assert.doesNotMatch(css, /margin-left:\s*-/)
})

test('mobile category rows distinguish editable and read-only money values', async () => {
  const css = await read('src/mobile-native.css')
  assert.match(css, /\.category-name::after[\s\S]*?content:\s*"›"/)
  assert.match(css, /\.assigned-value-button span::after[\s\S]*?content:\s*" · edit"/)
  assert.match(css, /\.money-stat,[\s\S]*?\.available-card[\s\S]*?border:\s*0\s*!important/)
})

test('mobile transactions are a ledger list rather than a horizontally scrolling desktop table', async () => {
  const css = await read('src/mobile-native.css')
  assert.match(css, /\.transaction-table-wrap\s*\{[\s\S]*?overflow:\s*visible\s*!important/)
  assert.match(css, /\.transaction-table\s*\{[\s\S]*?min-inline-size:\s*0\s*!important/)
  assert.match(css, /\.transaction-table thead\s*\{[\s\S]*?display:\s*none\s*!important/)
  assert.match(css, /grid-template-areas:[\s\S]*?"payee amount edit"[\s\S]*?"category amount edit"/)
})

test('New and Settings cover the previous mobile tab', async () => {
  const css = await read('src/mobile-native.css')
  assert.match(css, /\.dialog-backdrop:has\(\.settings-body\)/)
  assert.match(css, /\.dialog-backdrop:has\(\.kind-toggle\)/)
  assert.match(css, /inset:\s*0 0 var\(--rubies-mobile-nav-height, 88px\) 0\s*!important/)
  assert.match(css, /body:has\(\.dialog-backdrop \.settings-body\) \.main-content[\s\S]*?visibility:\s*hidden/)
})

test('bottom nav keeps safe-area padding on the bar rather than making giant buttons', async () => {
  const css = await read('src/mobile-native.css')
  assert.match(css, /--mobile-nav-core-height:\s*58px/)
  assert.match(css, /\.mobile-nav button\s*\{[\s\S]*?block-size:\s*var\(--mobile-nav-core-height\)\s*!important/)
  assert.match(css, /\.mobile-nav\s*\{[\s\S]*?env\(safe-area-inset-bottom/)
})
