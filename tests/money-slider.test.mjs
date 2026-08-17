import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')

test('money sliders advance in exact whole currency units', () => {
  assert.match(app, /const maxWholeUnits = Math\.max\(1, Math\.round\(safeMax \/ 100\)\)/)
  assert.match(app, /max=\{maxWholeUnits\}[\s\S]*step="1"[\s\S]*value=\{wholeUnitValue\}/)
  assert.match(app, /onChange=\{\(event\) => onChange\(Number\(event\.target\.value\) \* 100\)\}/)
  assert.doesNotMatch(app, /const moneyStep =/)
  assert.doesNotMatch(app, /max="1000"/)
})
