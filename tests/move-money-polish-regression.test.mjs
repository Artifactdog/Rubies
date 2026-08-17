import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('Move Money polish loads after the shared motion layer', async () => {
  const main = await read('src/main.tsx')
  assert.ok(main.indexOf("./moveMoneyPolish.css") > main.indexOf("./motion.css"))
  assert.ok(main.indexOf('installMoveMoneyPolish()') > main.indexOf('installUiRuntime()'))
})

test('native category options expose clean labels without deleting balance metadata', async () => {
  const runtime = await read('src/moveMoneyPolish.ts')
  assert.match(runtime, /option\.dataset\.rubiesOriginalText = original/)
  assert.match(runtime, /option\.dataset\.rubiesAvailableText = match\[1\]\.trim\(\)/)
  assert.match(runtime, /option\.label = cleanLabel/)
  assert.doesNotMatch(runtime, /option\.textContent\s*=/)
})

test('available category money is rendered as separate endpoint metadata', async () => {
  const runtime = await read('src/moveMoneyPolish.ts')
  const css = await read('src/moveMoneyPolish.css')
  assert.match(runtime, /move-endpoint-summary/)
  assert.match(runtime, /move-endpoint-summary-label\">Available/)
  assert.match(css, /\.move-endpoint-summary[\s\S]*?justify-content:\s*space-between/)
  assert.match(css, /\.move-endpoint-summary strong[\s\S]*?var\(--accent-strong\)/)
})

test('Move Money sheet can never extend under persistent mobile navigation', async () => {
  const css = await read('src/moveMoneyPolish.css')
  assert.match(css, /\.move-money-modal-backdrop[\s\S]*?inset:\s*0 0 var\(--rubies-mobile-nav-height, 88px\) 0\s*!important/)
  assert.match(css, /\.move-money-modal-card[\s\S]*?block-size:\s*auto\s*!important/)
  assert.match(css, /max-block-size:\s*calc\(100dvh - var\(--rubies-mobile-nav-height, 88px\)/)
  assert.doesNotMatch(css, /86dvh/)
})

test('Move Money actions stay in the sheet scroll surface instead of behind navigation', async () => {
  const css = await read('src/moveMoneyPolish.css')
  assert.match(css, /form > \.dialog-actions[\s\S]*?position:\s*sticky\s*!important/)
  assert.match(css, /form > \.dialog-actions[\s\S]*?bottom:\s*0\s*!important/)
  assert.match(css, /form[\s\S]*?overflow-y:\s*auto\s*!important/)
})

test('mobile From and To endpoints use full-width stacked layout', async () => {
  const css = await read('src/moveMoneyPolish.css')
  assert.match(css, /\.rubies-move-money-polished \.move-flow[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)\s*!important/)
})

test('direction arrow icon owns orientation while button keeps tactile transform motion', async () => {
  const css = await read('src/moveMoneyPolish.css')
  assert.match(css, /\.move-direction-button svg[\s\S]*?transition:\s*transform 340ms/)
  assert.match(css, /@media \(max-width: 820px\)[\s\S]*?\.move-direction-button svg\s*\{[\s\S]*?rotate\(90deg\)/)
  assert.match(css, /\.move-direction-button\.reverse svg\s*\{[\s\S]*?rotate\(-90deg\)/)
  assert.doesNotMatch(css, /\.move-direction-button\s*\{[^}]*transform:\s*rotate/)
  assert.doesNotMatch(css, /\.move-direction-button\.reverse\s*\{[^}]*transform:\s*rotate/)
})
