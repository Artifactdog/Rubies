import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../src/ios-standalone-spacing.css', import.meta.url), 'utf8')
const main = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8')

test('standalone iOS gets a clear top comfort offset without changing browser mode', () => {
  assert.match(css, /@media \(display-mode: standalone\) and \(max-width: 820px\)/)
  assert.match(css, /--rubies-standalone-top-comfort:\s*16px/)
  assert.match(css, /padding-top:\s*calc\(var\(--rubies-safe-top[^)]*\)[^;]*var\(--rubies-standalone-top-comfort\)\)/)
  assert.match(css, /transaction-screen-backdrop[\s\S]*top:\s*calc\(var\(--rubies-safe-top/)
  assert.match(main, /import '\.\/ios-standalone-spacing\.css'/)
})
