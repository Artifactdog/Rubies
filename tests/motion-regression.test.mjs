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

test('motion stylesheet gives dialogs distinct desktop, sheet, and full-screen transitions', async () => {
  const css = await read('src/motion.css')
  assert.match(css, /@keyframes rubies-dialog-in/)
  assert.match(css, /@keyframes rubies-sheet-in/)
  assert.match(css, /@keyframes rubies-screen-in/)
  assert.match(css, /\.dialog-backdrop\.rubies-motion-dismissing/)
  assert.match(css, /not\(:has\(\.settings-body\)\):not\(:has\(\.kind-toggle\)\):not\(:has\(\.move-flow\)\)/)
})

test('mobile sheets expose a drag handle and runtime swipe-to-dismiss behavior', async () => {
  const css = await read('src/motion.css')
  const runtime = await read('src/motionRuntime.ts')
  assert.match(css, /\.dialog-header::before[\s\S]*?inline-size:\s*38px/)
  assert.match(css, /rubies-sheet-dragging/)
  assert.match(css, /rubies-sheet-rebounding/)
  assert.match(runtime, /setPointerCapture/)
  assert.match(runtime, /velocity > \.58/)
  assert.match(runtime, /runAfterDismiss/)
})

test('motion respects reduced-motion preferences', async () => {
  const css = await read('src/motion.css')
  const runtime = await read('src/motionRuntime.ts')
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/)
  assert.match(runtime, /prefers-reduced-motion: reduce/)
})

test('primary tab switching is intentionally not animated as page navigation', async () => {
  const css = await read('src/motion.css')
  assert.match(css, /Page\/tab content deliberately does not transition when[\s\S]*?Plan and Accounts/)
  assert.doesNotMatch(css, /\.view-shell\s*\{[\s\S]*?animation:/)
  assert.match(css, /\.mobile-nav button\.active svg/)
})
