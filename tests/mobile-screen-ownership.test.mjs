import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const css = await readFile(new URL('../src/mobile-screen-fixes.css', import.meta.url), 'utf8')
const main = await readFile(new URL('../src/main.tsx', import.meta.url), 'utf8')

test('mobile New and Settings remove the underlying view from scrolling', () => {
  assert.match(css, /html:has\(\.dialog-backdrop \.settings-body\)[\s\S]*overflow: hidden !important/)
  assert.match(css, /body:has\(\.dialog-backdrop \.kind-toggle\) \.main-content[\s\S]*position: fixed !important/)
  assert.match(css, /body:has\(\.dialog-backdrop \.kind-toggle\) \.main-content[\s\S]*block-size: 0 !important/)
  assert.match(css, /\.dialog-card:has\(\.kind-toggle\) \.dialog-content[\s\S]*overflow-y: auto !important/)
})

test('sticky RTA has no opaque wrapper behind it', () => {
  assert.match(css, /\.month-summary-grid[\s\S]*background: transparent !important/)
  assert.match(css, /\.month-summary-grid[\s\S]*border-bottom: 0 !important/)
})

test('mobile category overflow trigger is geometrically centered', () => {
  assert.match(css, /\.mobile-row-menu > summary[\s\S]*top: 50% !important/)
  assert.match(css, /\.mobile-row-menu > summary[\s\S]*left: 50% !important/)
  assert.match(css, /transform: translate\(-50%, -50%\) !important/)
})

test('mobile screen fixes load after the native mobile stylesheet', () => {
  assert.ok(main.indexOf("import './mobile-native.css'") < main.indexOf("import './mobile-screen-fixes.css'"))
})
