import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('Escape closes only the topmost actual dialog through its existing close button', async () => {
  const runtime = await read('src/dialogKeyboard.ts')
  const main = await read('src/main.tsx')

  assert.match(main, /import \{ installDialogKeyboard \} from '\.\/dialogKeyboard'/)
  assert.match(main, /installMotionRuntime\(\)[\s\S]*?installDialogKeyboard\(\)/)
  assert.match(runtime, /event\.key !== 'Escape'/)
  assert.match(runtime, /event\.repeat/)
  assert.match(runtime, /event\.defaultPrevented/)
  assert.match(runtime, /for \(let index = backdrops\.length - 1; index >= 0; index -= 1\)/)
  assert.match(runtime, /backdrop\.dataset\.rubiesMotionClosing === 'true'/)
  assert.match(runtime, /mobileMedia\.matches && isPrimaryMobileScreen\(card\)/)
  assert.match(runtime, /\.dialog-header \.icon-button/)
  assert.match(runtime, /closeButton\.click\(\)/)
})

test('Escape listener uses bubble phase so focused controls can consume it first', async () => {
  const runtime = await read('src/dialogKeyboard.ts')
  assert.match(runtime, /document\.addEventListener\('keydown', handleDialogEscape\)/)
  assert.doesNotMatch(runtime, /addEventListener\('keydown', handleDialogEscape, true\)/)
})
