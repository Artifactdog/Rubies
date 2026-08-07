import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('UI runtime does not install MutationObserver polling', async () => {
  const runtime = await readFile(new URL('../src/uiRuntime.ts', import.meta.url), 'utf8')
  assert.equal(runtime.includes('MutationObserver'), false)
})

test('application entrypoint uses only the event-driven UI runtime', async () => {
  const main = await readFile(new URL('../src/main.tsx', import.meta.url), 'utf8')
  assert.match(main, /installUiRuntime/)
  assert.doesNotMatch(main, /installUiEnhancements|installUiStability/)
})
