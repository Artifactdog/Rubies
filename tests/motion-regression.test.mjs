import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('motion layer loads after layout styles and before the legacy UI runtime installs', async () => {
  const main = await read('src/main.tsx')
  const consistency = main.indexOf("./mobile-consistency.css")
  const motionCss = main.indexOf("./motion.css")
  const motionInstall = main.indexOf('installMotionRuntime()')
  const uiInstall = main.indexOf('installUiRuntime()')
  assert.ok(consistency >= 0)
  assert.ok(motionCss > consistency)
  assert.ok(motionInstall >= 0)
  assert.ok(uiInstall > motionInstall)
})

test('desktop dialogs have a visible spring entrance and animation-driven exit', async () => {
  const css = await read('src/motion.css')
  const runtime = await read('src/motionRuntime.ts')
  assert.match(css, /@keyframes rubies-dialog-in/)
  assert.match(css, /--motion-dialog:\s*440ms/)
  assert.match(css, /scale\(\.93\)/)
  assert.match(runtime, /card\.animate\(/)
  assert.match(runtime, /animation\.finished/)
  assert.match(runtime, /duration:\s*mobile \? 410 : 320/)
  assert.doesNotMatch(runtime, /const motionDelay/)
})

test('every mobile dialog surface slides up from below with slower sheet motion', async () => {
  const css = await read('src/motion.css')
  assert.match(css, /--motion-sheet:\s*540ms/)
  assert.match(css, /@keyframes rubies-sheet-in[\s\S]*?translate3d\(0, 102%, 0\)/)
  assert.match(css, /\.dialog-backdrop > \.dialog-card[\s\S]*?rubies-sheet-in/)
  assert.doesNotMatch(css, /not\(:has\(\.settings-body\)\)/)
  assert.doesNotMatch(css, /not\(:has\(\.kind-toggle\)\)/)
})

test('Move Money uses the same mobile bottom-sheet language', async () => {
  const css = await read('src/motion.css')
  assert.match(css, /\.move-money-modal-backdrop[\s\S]*?align-items:\s*flex-end\s*!important/)
  assert.match(css, /\.move-money-modal-card[\s\S]*?border-radius:\s*22px 22px 0 0\s*!important/)
})

test('all mobile dialog headers expose drag affordance and swipe-to-dismiss', async () => {
  const css = await read('src/motion.css')
  const runtime = await read('src/motionRuntime.ts')
  assert.match(css, /\.dialog-card > \.dialog-header::before[\s\S]*?inline-size:\s*42px/)
  assert.match(css, /rubies-sheet-dragging/)
  assert.match(css, /rubies-sheet-rebounding/)
  assert.match(runtime, /setPointerCapture/)
  assert.match(runtime, /velocity > \.5/)
  assert.match(runtime, /Boolean\(card\.querySelector\('\.dialog-header \.icon-button'\)\)/)
  assert.doesNotMatch(runtime, /settings-screen-card, \.transaction-screen-card, \.move-money-modal-card/)
})

test('motion respects reduced-motion preferences', async () => {
  const css = await read('src/motion.css')
  const runtime = await read('src/motionRuntime.ts')
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/)
  assert.match(runtime, /prefers-reduced-motion: reduce/)
})

test('primary tab switching is intentionally not animated as page navigation', async () => {
  const css = await read('src/motion.css')
  assert.match(css, /Plan and Accounts are primary tabs[\s\S]*?not animate between/)
  assert.doesNotMatch(css, /\.view-shell\s*\{[\s\S]*?animation:/)
  assert.match(css, /\.mobile-nav button\.active svg/)
})
