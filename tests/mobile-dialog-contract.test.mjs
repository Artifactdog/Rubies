import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('../src/mobile-dialog-contract.css', import.meta.url), 'utf8')
const main = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8')

function componentSource(name, nextName) {
  const start = app.indexOf(`const ${name} =`)
  assert.notEqual(start, -1, `${name} must exist`)
  const end = nextName ? app.indexOf(`const ${nextName} =`, start + 1) : app.length
  assert.notEqual(end, -1, `${nextName} must exist after ${name}`)
  return app.slice(start, end)
}

test('all mobile confirmation flows expose explicit action footers', () => {
  const flows = [
    ['AssignmentDialog', 'CategoryRow'],
    ['CategoryDialog', 'MoveMoneyDialog'],
    ['MoveMoneyDialog', 'GroupDialog'],
    ['GroupDialog', 'AccountDialog'],
    ['AccountDialog', 'SettingsDialog'],
  ]

  for (const [name, next] of flows) {
    const source = componentSource(name, next)
    assert.match(source, /<form\b/, `${name} must contain a form`)
    assert.match(source, /className="dialog-actions(?: [^"]*)?"/, `${name} must expose dialog actions`)
    assert.match(source, /type="submit"/, `${name} must expose a submit action`)
  }
})

test('mobile dialog contract pins confirmation actions independently of form height', () => {
  assert.match(main, /import '\.\/mobile-dialog-contract\.css'/)
  assert.match(css, /\.dialog-content:has\(> form > \.dialog-actions\)/)
  assert.match(css, /overflow:\s*hidden\s*!important/)
  assert.match(css, /> form \{[\s\S]*overflow-y:\s*scroll\s*!important/)
  assert.match(css, /> form > \.dialog-actions \{[\s\S]*position:\s*absolute\s*!important/)
  assert.match(css, /padding:\s*16px 16px 168px\s*!important/)
  assert.match(css, /scroll-padding-bottom:\s*168px/)
  assert.match(css, /inset:\s*auto 0 0\s*!important/)
})

test('mobile dialogs own scrolling instead of leaking gestures to Plan or Accounts', () => {
  assert.match(css, /html:has\(\.dialog-backdrop\),[\s\S]*body:has\(\.dialog-backdrop\)[\s\S]*overflow:\s*hidden\s*!important/)
  assert.match(css, /body:has\(\.dialog-backdrop\) #root,[\s\S]*\.app-shell[\s\S]*overflow:\s*hidden\s*!important/)
  assert.match(css, /block-size:\s*100%\s*!important/)
  assert.match(css, /touch-action:\s*pan-y\s*!important/)
  assert.match(css, /overscroll-behavior-y:\s*contain\s*!important/)
})

test('mobile dialog content can scroll the final field comfortably above the footer', () => {
  assert.match(css, /> :not\(\.dialog-actions\):last-of-type \{[\s\S]*margin-block-end:\s*24px\s*!important/)
})

test('mobile confirmation actions do not advertise physical keyboard hints', () => {
  assert.match(componentSource('AssignmentDialog', 'CategoryRow'), /Save assignment\s*<kbd>Enter<\/kbd>/)
  assert.match(css, /\.dialog-actions kbd \{[\s\S]*display:\s*none\s*!important/)
})

test('generic mobile sheets stay above bottom navigation', () => {
  assert.match(css, /inset:\s*0 0 var\(--rubies-mobile-nav-height, 88px\) 0\s*!important/)
  assert.match(css, /max-block-size:\s*100%\s*!important/)
})
