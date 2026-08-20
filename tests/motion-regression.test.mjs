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

test('desktop dialogs use monotonic compositor-friendly entrance and restrained exit', async () => {
  const css = await read('src/motion.css')
  const runtime = await read('src/motionRuntime.ts')
  const entrance = css.match(/@keyframes rubies-dialog-in\s*\{([\s\S]*?)\n\}/)?.[1] ?? ''
  const backdrop = css.match(/@keyframes rubies-backdrop-in\s*\{([\s\S]*?)\n\}/)?.[1] ?? ''
  const dismissStart = runtime.indexOf('const cardAnimation = card.animate')
  const dismissEnd = runtime.indexOf('const backdropAnimation = backdrop.animate', dismissStart)
  const dismissBlock = runtime.slice(dismissStart, dismissEnd)

  assert.match(css, /--motion-dialog:\s*360ms/)
  assert.match(css, /--ease-dialog:\s*cubic-bezier\(\.22, 1, \.36, 1\)/)
  assert.match(entrance, /translate3d\(0, 18px, 0\) scale\(\.985\)/)
  assert.match(entrance, /translate3d\(0, 0, 0\) scale\(1\)/)
  assert.doesNotMatch(entrance, /translate3d\(0, -/)
  assert.doesNotMatch(entrance, /scale\(1\.0/)
  assert.doesNotMatch(backdrop, /backdrop-filter/)
  assert.match(css, /\.dialog-backdrop\s*\{[\s\S]*?will-change:\s*opacity/)
  assert.match(runtime, /animation\.finished/)
  assert.match(dismissBlock, /translate3d\(0, 14px, 0\) scale\(\.982\)/)
  assert.match(dismissBlock, /duration:\s*220/)
  assert.doesNotMatch(dismissBlock, /offset:\s*\.18/)
  assert.doesNotMatch(dismissBlock, /scale\(\.925\)/)
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

test('release velocity is recency weighted so reversals beat older gesture history', async () => {
  const runtime = await read('src/motionRuntime.ts')
  assert.match(runtime, /type VelocitySample/)
  assert.match(runtime, /const cutoff = time - 110/)
  assert.match(runtime, /velocity = seeded \? velocity \* \.25 \+ segmentVelocity \* \.75 : segmentVelocity/)
  assert.match(runtime, /const freshness = Math\.max\(0, 1 - age \/ 90\)/)
  assert.match(runtime, /return velocity \* freshness/)
  assert.doesNotMatch(runtime, /state\.distance \/ elapsed/)
})

test('upward reversal explicitly vetoes dismissal even after crossing the distance threshold', async () => {
  const runtime = await read('src/motionRuntime.ts')
  assert.match(runtime, /const recentIntent = recentVerticalIntentFor\(state\)/)
  assert.match(runtime, /const projectedDistance = Math\.max\(0, state\.distance \+ velocity \* 220\)/)
  assert.match(runtime, /const upwardIntent = recentIntent < -2 \|\| velocity < -\.08/)
  assert.match(runtime, /const shouldDismiss = !cancelled && !upwardIntent/)
  assert.doesNotMatch(runtime, /state\.distance >= threshold\s*\|\|/)
})

test('fast downward flicks still project momentum into dismissal', async () => {
  const runtime = await read('src/motionRuntime.ts')
  assert.match(runtime, /const downwardFlick = velocity > \.38/)
  assert.match(runtime, /downwardFlick && state\.distance >= 18 && projectedDistance >= threshold \* \.82/)
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

test('keep-open rebound is critically damped enough to avoid a down-up jitter', async () => {
  const runtime = await read('src/motionRuntime.ts')
  const physicsCss = await read('src/physics-motion.css')
  const start = runtime.indexOf('const runReboundPhysics')
  const end = runtime.indexOf('const playDismissAnimation', start)
  const block = runtime.slice(start, end)
  assert.ok(start >= 0 && end > start)
  assert.match(block, /let velocity = Math\.max\(-2600, Math\.min\(900, releaseVelocity \* 1000\)\)/)
  assert.match(block, /const stiffness = 260/)
  assert.match(block, /const damping = 32/)
  assert.match(block, /const acceleration = -stiffness \* position - damping \* velocity/)
  assert.match(block, /if \(position <= 0\)[\s\S]*?settleOpen\(\)/)
  assert.match(block, /requestAnimationFrame\(step\)/)
  assert.doesNotMatch(block, /setTimeout/)
  assert.match(physicsCss, /rubies-sheet-rebounding[\s\S]*?transition:\s*none\s*!important/)
})

test('upward keep intent cannot inherit contradictory downward rebound velocity', async () => {
  const runtime = await read('src/motionRuntime.ts')
  assert.match(runtime, /const reboundVelocity = cancelled \? 0 : upwardIntent \? Math\.min\(0, velocity\) : velocity/)
  assert.match(runtime, /runReboundPhysics\(state\.card, state\.backdrop, reboundVelocity\)/)
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
