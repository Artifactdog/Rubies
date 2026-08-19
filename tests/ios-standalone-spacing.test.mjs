import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../src/ios-standalone-spacing.css', import.meta.url), 'utf8')
const main = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8')

test('iOS Home Screen mode is detected explicitly and moves visible headers below the blur', () => {
  assert.match(main, /type IOSNavigator = Navigator & \{ standalone\?: boolean \}/)
  assert.match(main, /standalone === true/)
  assert.match(main, /classList\.add\('rubies-ios-standalone'\)/)
  assert.match(css, /html\.rubies-ios-standalone/)
  assert.match(css, /--rubies-standalone-header-comfort:\s*14px/)
  assert.match(css, /\.dialog-backdrop:has\(\.settings-body\) \.dialog-header/)
  assert.match(css, /\.dialog-backdrop:has\(\.kind-toggle\) \.dialog-header/)
  assert.match(css, /padding-top:\s*calc\(22px \+ var\(--rubies-standalone-header-comfort\)\)/)
  assert.doesNotMatch(css, /@media \(display-mode:\s*standalone\)/)
})

test('installed iOS month title gets the measured Dynamic Island optical correction', () => {
  assert.match(css, /html\.rubies-ios-standalone \.plan-header \.month-navigation > h1/)
  assert.match(css, /transform:\s*translateX\(-2px\)\s*!important/)
})
