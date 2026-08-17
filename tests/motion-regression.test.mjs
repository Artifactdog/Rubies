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

test('actual mobile dialogs slide up while New and Settings remain primary screens', async () => {
  const css = await read('src/motion.css')
  assert.match(css, /--motion-sheet:\s*540ms/)
  assert.match(css, /@keyframes rubies-sheet-in[\s\S]*?translate3d\(0, 102%, 0\)/)
  assert.match(css, /\.dialog-backdrop:not\(:has\(\.settings-body\)\):not\(:has\(\.kind-toggle\)\) > \.dialog-card[\s\S]*?rubies-sheet-in/)
  assert.match(css, /\.dialog-backdrop:has\(\.settings-body\),[\s\S]*?\.dialog-backdrop:has\(\.kind-toggle\)[\s\S]*?animation:\s*none\s*!important/)
  assert.match(css, /\.dialog-backdrop:has\(\.settings-body\) > \.dialog-card,[\s\S]*?\.transaction-screen-card[\s\S]*?animation:\s*none\s*!important/)
})

test('Move Money uses the mobile bottom-sheet language', async () => {
  const css = await read('src/motion.css')
  assert.match(css, /\.move-money-modal-backdrop[\s\S]*?align-items:\s*flex-end\s*!important/)
  assert.match(css, /\.move-money-modal-card[\s\S]*?border-radius:\s*22px 22px 0 0\s*!important/)
})

test('only actual mobile dialogs expose drag affordance and swipe-to-dismiss', async () => {
  const css = await read('src/motion.css')
  const runtime = await read('src/motionRuntime.ts')
  assert.match(css, /not\(:has\(\.settings-body\)\):not\(:has\(\.kind-toggle\)\)[\s\S]*?> \.dialog-card > \.dialog-header::before[\s\S]*?inline-size:\s*42px/)
  assert.match(css, /rubies-sheet-dragging/)
  assert.match(css, /rubies-sheet-rebounding/)
  assert.match(runtime, /const isPrimaryMobileScreen/)
  assert.match(runtime, /isSwipeDismissibleSheet[\s\S]*?isPrimaryMobileScreen\(card\)/)
  assert.match(runtime, /setPointerCapture/)
  assert.match(runtime, /velocity > \.5/)
})

test('swipe dismissal preserves the dragged visual position until exit animation owns it', async () => {
  const runtime = await read('src/motionRuntime.ts')
  const dismissStart = runtime.indexOf('const playDismissAnimation')
  const capture = runtime.indexOf('const currentTransform', dismissStart)
  const clear = runtime.indexOf('clearDragState(card)', capture)
  const animate = runtime.indexOf('const cardAnimation = card.animate', clear)
  assert.ok(dismissStart >= 0)
  assert.ok(capture > dismissStart)
  assert.ok(clear > capture)
  assert.ok(animate > clear)
  assert.match(runtime, /Finish any entrance[\s\S]*?animation\.finish\(\)/)
})

test('committed mobile sheet dismissal can only continue downward', async () => {
  const runtime = await read('src/motionRuntime.ts')
  const mobileFrames = runtime.match(/mobile\s*\?\s*\[([\s\S]*?)\]\s*:\s*\[/)?.[1] ?? ''
  assert.match(runtime, /const mobileExitY = Math\.ceil\(card\.getBoundingClientRect\(\)\.height \* 1\.08\)/)
  assert.match(mobileFrames, /transform:\s*currentTransform/)
  assert.match(mobileFrames, /translate3d\(0, \$\{mobileExitY\}px, 0\)/)
  assert.doesNotMatch(mobileFrames, /translate3d\(0, 8%, 0\)/)
  assert.doesNotMatch(mobileFrames, /offset:\s*\.18/)
})

test('mobile primary screens bypass modal close choreography', async () => {
  const runtime = await read('src/motionRuntime.ts')
  assert.match(runtime, /handleCloseClick[\s\S]*?isPrimaryMobileScreen\(card\)\) return false/)
  assert.match(runtime, /handleMobileNavigation[\s\S]*?isPrimaryMobileScreen\(card\)\) return false/)
  assert.match(runtime, /handleDialogSubmit[\s\S]*?isPrimaryMobileScreen\(card\)\) return/)
})

test('motion respects reduced-motion preferences', async () => {
  const css = await read('src/motion.css')
  const runtime = await read('src/motionRuntime.ts')
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/)
  assert.match(runtime, /prefers-reduced-motion: reduce/)
})

test('primary mobile navigation does not animate as modal navigation', async () => {
  const css = await read('src/motion.css')
  assert.match(css, /Plan, Accounts, New and Settings are primary mobile navigation destinations/)
  assert.doesNotMatch(css, /\.view-shell\s*\{[\s\S]*?animation:/)
  assert.match(css, /\.mobile-nav button\.active svg/)
})
