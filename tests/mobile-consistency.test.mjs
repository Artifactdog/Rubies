import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../src/mobile-consistency.css', import.meta.url), 'utf8')
const viewport = readFileSync(new URL('../src/mobileViewport.ts', import.meta.url), 'utf8')
const main = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8')

test('mobile consistency layer loads last and uses event-driven visual viewport sync', () => {
  assert.match(main, /import '\.\/mobile-consistency\.css'/)
  assert.match(main, /installMobileViewport\(\)/)
  assert.match(viewport, /window\.visualViewport\?\.addEventListener\('resize'/)
  assert.match(viewport, /window\.visualViewport\?\.addEventListener\('scroll'/)
  assert.doesNotMatch(viewport, /MutationObserver/)
  assert.doesNotMatch(viewport, /setInterval/)
})

test('mobile category schedule constrains the due date and avoids the desktop three-column squeeze', () => {
  assert.match(css, /\.target-inline-grid:not\(\.repeat-grid\)[\s\S]*grid-template-columns:\s*minmax\(0, \.58fr\) minmax\(0, 1fr\)/)
  assert.match(css, /> label:nth-child\(3\)[\s\S]*grid-column:\s*1 \/ -1/)
  assert.match(css, /\.target-inline-grid input\[type="date"\][\s\S]*max-inline-size:\s*100%/)
})

test('mobile month title is centered independently from Today and eyebrow labels are removed', () => {
  assert.match(css, /\.plan-header \.eyebrow,[\s\S]*\.accounts-header \.eyebrow[\s\S]*display:\s*none/)
  assert.match(css, /\.month-navigation h1[\s\S]*inset-inline-start:\s*50%/)
  assert.match(css, /transform:\s*translateX\(-50%\)/)
  assert.match(css, /\.icon-button:nth-of-type\(2\)[\s\S]*margin-inline-start:\s*auto/)
})

test('new and edit transaction screens share color, sizing, and predictable actions', () => {
  assert.match(css, /\.kind-toggle > button:first-child\.active[\s\S]*--red|\.kind-toggle > button:first-child\.active[\s\S]*237, 126, 144/)
  assert.match(css, /\.kind-toggle > button:last-child\.active[\s\S]*114, 215, 163/)
  assert.match(css, /aria-label="Edit transaction"[\s\S]*\.dialog-header \.icon-button[\s\S]*display:\s*grid/)
  assert.match(css, /grid-template-rows:\s*auto minmax\(0, 1fr\) auto/)
  assert.match(css, /\.form-grid[\s\S]*overflow-y:\s*auto/)
})

test('mobile dialogs follow visual viewport and undo feedback stays above navigation', () => {
  assert.match(css, /--rubies-visual-height/)
  assert.match(css, /--rubies-active-nav-height/)
  assert.match(css, /rubies-keyboard-open \.mobile-nav[\s\S]*visibility:\s*hidden/)
  assert.match(css, /\.action-toast[\s\S]*bottom:\s*calc\(var\(--rubies-active-nav-height\) \+ 12px\)/)
})

test('confirmation footer alignment is consistent across split and regular dialogs', () => {
  assert.match(css, /\.dialog-card \.dialog-actions[\s\S]*justify-content:\s*flex-end/)
  assert.match(css, /\.dialog-actions\.split-actions[\s\S]*grid-template-columns:\s*auto minmax\(0, 1fr\)/)
  assert.match(css, /\.dialog-actions\.split-actions > div[\s\S]*justify-self:\s*end/)
})
