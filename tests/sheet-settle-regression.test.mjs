import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('settling an interactive mobile sheet cannot restart its entrance animation', async () => {
  const main = await read('src/main.tsx')
  const motion = await read('src/motion.css')
  const physics = await read('src/physics-motion.css')

  assert.ok(main.indexOf("./physics-motion.css") > main.indexOf("./motion.css"))
  assert.match(motion, /\.dialog-card\.rubies-sheet-dragging[\s\S]*?animation:\s*none\s*!important/)
  assert.match(physics, /\.dialog-card\.rubies-sheet-dragging,[\s\S]*?\.dialog-card\.rubies-sheet-rebounding[\s\S]*?animation:\s*rubies-sheet-in var\(--motion-sheet\) var\(--ease-sheet\) both\s*!important/)
  assert.match(physics, /animation-play-state:\s*paused\s*!important/)
  assert.doesNotMatch(physics, /animation:\s*none\s*!important/)
})
