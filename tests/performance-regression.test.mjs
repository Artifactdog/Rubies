import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

for (const path of ['src/uiEnhancements.ts', 'src/ui-stability.ts']) {
  test(`${path} does not install a document-wide MutationObserver`, async () => {
    const source = await readFile(new URL(`../${path}`, import.meta.url), 'utf8')
    assert.equal(source.includes('new MutationObserver'), false)
  })
}
