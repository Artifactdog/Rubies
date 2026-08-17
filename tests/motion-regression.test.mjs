import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('motion layer loads after layout styles and physics overrides load after motion CSS', async () => {
  const main = await read('src/main.tsx')
  const consistency = main.indexOf("./mobile-consistency.css")
  const motionCss = main.indexOf("./motion.css")
  const physicsCss = main.indexOf("./physics-motion.css")
  const motionInstall = main.indexOf('installMotionRuntime()')
  const uiInstall = main.indexOf('installUiRuntime()')
  assert.ok(consistency >= 0)
  assert.ok(motionCss > consistency)
  assert.ok(physicsCss > motionCss)
  assert.ok(motionInstall >= 0)
  assert.ok(uiInstall > motionInstall)
})

test('desktop dialogs keep the visible spring entrance and animation-driven exit', async () => {
  const css = await read('src/motion.css')
  const runtime = await read('src/motionRuntime.ts')
  assert.match(css, /@keyframes rubies-dialog-in/)
  assert.match(css, /--motion-dialog:\s*440ms/)
  assert.match(css, /scale\(\.93\)/)
  assert.match(runtime, /card\.animate\(/)
  assert.match(runtime, /animation\.finished/)
  assert.match(runtime, /duration:\s*320/)
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
  assert.match(runtime, /const isPrimaryMobileScreen/)
  assert.match(runtime, /isSwipeDismissibleSheet[\s\S]*?isPrimaryMobileScreen\(card\)/)
  assert.match(runtime, /setPointerCapture/)
})

test('release velocity is sampled from the recent finger path instead of gesture-average speed', async () => {
  const runtime = await read('src/motionRuntime.ts')
  assert.match(runtime, /type VelocitySample/)
  assert.match(runtime, /const cutoff = time - 90/)
  assert.match(runtime, /while \(state\.samples\.length > 2 && state\.samples\[0\]\.time < cutoff\)/)
  assert.match(runtime, /return \(last\.y - first\.y\) \/ elapsed/)
  assert.doesNotMatch(runtime, /state\.distance \/ elapsed/)
})

test('fast flicks project release momentum into the dismissal decision', async () => {
  const runtime = await read('src/motionRuntime.ts')
  assert.match(runtime, /const projectedDistance = state\.distance \+ Math\.max\(0, velocity\) \* 180/)
  assert.match(runtime, /state\.distance >= 18 && velocity > \.45 && projectedDistance >= threshold/)
  assert.match(runtime, /dismissVelocities\.set\(state\.backdrop, Math\.max\(0, velocity\)\)/)
})

test('committed mobile dismissal is requestAnimationFrame physics with inherited velocity', async () => {
  const runtime = await read('src/motionRuntime.ts')
  const start = runtime.indexOf('const runDismissPhysics')
  const end = runtime.indexOf('const runReboundPhysics', start)
  const block = runtime.slice(start, end)
  assert.ok(start >= 0 && end > start)
  assert.match(block, /let velocity = Math\.max\(0, releaseVelocity\) \* 1000/)
  assert.match(block, /const acceleration = 5200 \+ remaining \* 3\.2 - velocity \* 1\.6/)
  assert.match(block, /position \+= velocity \* dt/)
  assert.match(block, /requestAnimationFrame\(step\)/)
  assert.doesNotMatch(block, /duration:/)
  assert.doesNotMatch(block, /card\.animate\(/)
})

test('cancelled sheet dismissal springs back using release velocity rather than CSS timing', async () => {
  const runtime = await read('src/motionRuntime.ts')
  const physicsCss = await read('src/physics-motion.css')
  const start = runtime.indexOf('const runReboundPhysics')
  const end = runtime.indexOf('const playDismissAnimation', start)
  const block = runtime.slice(start, end)
  assert.ok(start >= 0 && end > start)
  assert.match(block, /let velocity = releaseVelocity \* 1000/)
  assert.match(block, /const stiffness = 245/)
  assert.match(block, /const damping = 27/)
  assert.match(block, /const acceleration = -stiffness \* position - damping \* velocity/)
  assert.match(block, /requestAnimationFrame\(step\)/)
  assert.doesNotMatch(block, /setTimeout/)
  assert.match(physicsCss, /rubies-sheet-rebounding[\s\S]*?transition:\s*none\s*!important/)
})

test('mobile physics preserves visual continuity from the drag frame into release', async () => {
  const runtime = await read('src/motionRuntime.ts')
  assert.match(runtime, /const sheetPositions = new WeakMap/)
  assert.match(runtime, /setSheetPosition\(state\.card, state\.backdrop, distance\)/)
  assert.match(runtime, /let position = sheetPositions\.get\(card\) \?\? 0/)
  assert.match(runtime, /setSheetPosition\(card, backdrop, position\)/)
  assert.doesNotMatch(runtime, /duration:\s*mobile/)
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
