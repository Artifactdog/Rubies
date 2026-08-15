import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('transaction screens are excluded from generic 168px footer reserve', async () => {
  const css = await read('src/mobile-dialog-contract.css')
  assert.match(css, /\.dialog-card:not\(:has\(\.kind-toggle\)\) \.dialog-content:has\(> form > \.dialog-actions\) > form/)
  assert.match(css, /padding: 16px 16px 168px !important/)
})

test('transaction screen has one scrolling fields surface and no fake footer padding', async () => {
  const css = await read('src/mobile-consistency.css')
  assert.match(css, /\.dialog-card:has\(\.kind-toggle\) \.dialog-content > form[\s\S]*?padding: 0 !important;[\s\S]*?overflow: hidden !important;/)
  assert.match(css, /\.dialog-card:has\(\.kind-toggle\) \.form-grid[\s\S]*?overflow-y: auto !important;/)
  assert.match(css, /\.dialog-card:has\(\.kind-toggle\) \.dialog-actions[\s\S]*?position: static !important;/)
})

test('mobile month switcher is symmetric and Today cannot steal title width', async () => {
  const css = await read('src/mobile-consistency.css')
  assert.match(css, /grid-template-columns: 44px minmax\(0, 1fr\) 44px !important/)
  assert.match(css, /"previous month next"/)
  assert.match(css, /"\. today \."/)
  assert.match(css, /\.today-button:disabled[\s\S]*?display: none !important;/)
  assert.match(css, /\.month-navigation > h1[\s\S]*?text-overflow: clip !important;[\s\S]*?white-space: nowrap !important;/)
  assert.doesNotMatch(css, /inline-size: min\(52vw, 230px\)/)
})
