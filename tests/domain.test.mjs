import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getActiveTargetDate,
  getCategorySummary,
  getScheduleDatesInMonth,
} from '../src/domain.ts'

const baseState = {
  version: 2,
  name: 'Test',
  currency: 'USD',
  activeMonth: '2026-08',
  groups: [{ id: 'g', name: 'Goals' }],
  accounts: [],
  transactions: [],
  months: { '2026-08': { month: '2026-08', assignments: {} } },
}

test('weekly schedules count every occurrence in the budget month', () => {
  const dates = getScheduleDatesInMonth({
    kind: 'recurring',
    unit: 'week',
    interval: 1,
    anchorDate: '2026-08-03',
  }, '2026-08')
  assert.deepEqual(dates, ['2026-08-03', '2026-08-10', '2026-08-17', '2026-08-24', '2026-08-31'])
})

test('quarterly schedules only create a target in aligned months', () => {
  const schedule = { kind: 'recurring', unit: 'month', interval: 3, anchorDate: '2026-02-28' }
  assert.deepEqual(getScheduleDatesInMonth(schedule, '2026-08'), ['2026-08-28'])
  assert.deepEqual(getScheduleDatesInMonth(schedule, '2026-09'), [])
})

test('custom dates support irregular target schedules', () => {
  const schedule = { kind: 'custom', dates: ['2026-08-02', '2026-10-10', '2026-08-21'] }
  assert.deepEqual(getScheduleDatesInMonth(schedule, '2026-08'), ['2026-08-02', '2026-08-21'])
})

test('repeating deadline targets advance to the next annual due date', () => {
  const target = {
    type: 'by-date',
    amount: 120000,
    targetDate: '2025-11-30',
    repeat: { kind: 'recurring', unit: 'year', interval: 1 },
  }
  assert.equal(getActiveTargetDate(target, '2026-08'), '2026-11-30')
})

test('scheduled savings multiplies the amount by occurrences', () => {
  const category = {
    id: 'c',
    groupId: 'g',
    name: 'Weekly spending',
    target: {
      type: 'monthly-savings',
      amount: 2500,
      schedule: { kind: 'recurring', unit: 'week', interval: 1, anchorDate: '2026-08-03' },
    },
  }
  const state = { ...baseState, categories: [category] }
  const summary = getCategorySummary(state, category, '2026-08')
  assert.equal(summary.target?.scheduledAmount, 12500)
  assert.equal(summary.target?.needed, 12500)
})
