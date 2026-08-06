import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getAccountBalance,
  getActiveTargetDate,
  getCategorySummary,
  getMonthFundingSummary,
  getReadyToAssign,
  getScheduleDatesInMonth,
  normalizeBudgetState,
  parseImportedBudget,
} from '../src/domain.ts'

const baseState = {
  version: 5,
  name: 'Test',
  currency: 'USD',
  activeMonth: '2026-08',
  groups: [{ id: 'g', name: 'Goals' }],
  accounts: [],
  transactions: [],
  months: { '2026-08': { month: '2026-08', assignments: {} } },
  allocationEvents: [],
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
  assert.equal(summary.target?.requiredThisMonth, 12500)
  assert.equal(summary.target?.leftToAssign, 12500)
})

test('deadline recommendations increase as fewer future months remain', () => {
  const category = {
    id: 'deadline',
    groupId: 'g',
    name: 'Deadline',
    target: {
      type: 'by-date',
      amount: 120000,
      targetDate: '2026-12-31',
    },
  }
  const state = {
    ...baseState,
    categories: [category],
    months: {
      '2026-08': { month: '2026-08', assignments: {} },
      '2026-09': { month: '2026-09', assignments: {} },
    },
  }
  assert.equal(getCategorySummary(state, category, '2026-08').target?.requiredThisMonth, 24000)
  assert.equal(getCategorySummary(state, category, '2026-09').target?.requiredThisMonth, 30000)
})

test('month funding summary separates required, assigned, and left', () => {
  const category = {
    id: 'monthly',
    groupId: 'g',
    name: 'Monthly',
    target: {
      type: 'monthly-savings',
      amount: 50000,
      schedule: { kind: 'recurring', unit: 'month', interval: 1, anchorDate: '2026-01-15' },
    },
  }
  const state = {
    ...baseState,
    categories: [category],
    months: { '2026-08': { month: '2026-08', assignments: { monthly: 12500 } } },
  }
  assert.deepEqual(getMonthFundingSummary(state, '2026-08'), {
    requiredThisMonth: 50000,
    assignedTowardTargets: 12500,
    leftToAssign: 37500,
    targetCount: 1,
  })
})

test('snoozed targets require nothing in their snoozed month', () => {
  const category = {
    id: 'snoozed',
    groupId: 'g',
    name: 'Snoozed',
    target: {
      type: 'monthly-savings',
      amount: 50000,
      schedule: { kind: 'recurring', unit: 'month', interval: 1, anchorDate: '2026-01-01' },
      snoozedMonths: ['2026-08'],
    },
  }
  const state = { ...baseState, categories: [category] }
  const summary = getCategorySummary(state, category, '2026-08')
  assert.equal(summary.status, 'snoozed')
  assert.equal(summary.target?.leftToAssign, 0)
})


test('cash overspending resets the category and reduces next month Ready to Assign', () => {
  const category = { id: 'food', groupId: 'g', name: 'Food' }
  const state = {
    ...baseState,
    categories: [category],
    accounts: [{ id: 'a', name: 'Cash' }],
    transactions: [
      { id: 'income', accountId: 'a', date: '2026-04-01', payee: 'Income', categoryId: null, amount: 10000 },
      { id: 'spend', accountId: 'a', date: '2026-04-20', payee: 'Shop', categoryId: 'food', amount: -12000 },
    ],
    months: {
      '2026-04': { month: '2026-04', assignments: { food: 10000 } },
      '2026-05': { month: '2026-05', assignments: {} },
    },
  }
  assert.equal(getCategorySummary(state, category, '2026-04').available, -2000)
  assert.equal(getCategorySummary(state, category, '2026-05').available, 0)
  assert.equal(getReadyToAssign(state, '2026-04'), 0)
  assert.equal(getReadyToAssign(state, '2026-05'), -2000)
})

test('later assignments consume Ready to Assign left in earlier months', () => {
  const category = { id: 'general', groupId: 'g', name: 'General' }
  const state = {
    ...baseState,
    categories: [category],
    accounts: [{ id: 'a', name: 'Cash' }],
    transactions: [
      { id: 'may-income', accountId: 'a', date: '2026-05-01', payee: 'Income', categoryId: null, amount: 10000 },
      { id: 'jun-income', accountId: 'a', date: '2026-06-01', payee: 'Income', categoryId: null, amount: 10000 },
      { id: 'jul-income', accountId: 'a', date: '2026-07-01', payee: 'Income', categoryId: null, amount: 10000 },
    ],
    months: {
      '2026-05': { month: '2026-05', assignments: { general: 6000 } },
      '2026-06': { month: '2026-06', assignments: { general: 6000 } },
      '2026-07': { month: '2026-07', assignments: { general: 18000 } },
    },
  }
  assert.equal(getReadyToAssign(state, '2026-05'), 0)
  assert.equal(getReadyToAssign(state, '2026-06'), 0)
  assert.equal(getReadyToAssign(state, '2026-07'), 0)
})

test('older budgets migrate to the simplified model and keep notes only on categories', () => {
  const migrated = normalizeBudgetState({
    version: 2,
    name: 'Old',
    currency: 'USD',
    activeMonth: '2026-08',
    groups: [{ id: 'g', name: 'General' }],
    categories: [],
    accounts: [{ id: 'a', name: 'Card', note: 'Remove me', type: 'credit', onBudget: true }],
    transactions: [{
      id: 't',
      accountId: 'a',
      date: '2026-08-01',
      payee: '',
      memo: 'Remove me',
      categoryId: null,
      amount: 1000,
      cleared: true,
    }],
    months: { '2026-08': { month: '2026-08', assignments: {}, note: 'Remove me' } },
  })
  assert.equal(migrated.version, 5)
  assert.deepEqual(migrated.allocationEvents, [])
  assert.deepEqual(migrated.accounts[0], { id: 'a', name: 'Card' })
  assert.equal('cleared' in migrated.transactions[0], false)
  assert.equal('note' in migrated.accounts[0], false)
  assert.equal('memo' in migrated.transactions[0], false)
  assert.equal('note' in migrated.months['2026-08'], false)
  assert.equal(migrated.transactions[0].payee, '')
})

test('nYNAB imports convert milliunits, assignments, goals, snoozing, and balances', () => {
  const raw = {
    data: {
      plan: {
        name: 'Fixture',
        currency_format: { iso_code: 'THB', decimal_digits: 2 },
        last_month: '2026-08-01',
        last_modified_on: '2026-08-05T12:00:00Z',
        accounts: [{ id: 'a', name: 'Cash', note: 'Ignore account note', balance: 14520000, deleted: false, closed: false }],
        payees: [{ id: 'p', name: 'Starting Balance', deleted: false }],
        category_groups: [{ id: 'g', name: 'Bills', deleted: false }],
        categories: [{
          id: 'c',
          category_group_id: 'g',
          name: 'Rent',
          note: 'Keep category note',
          internal: false,
          deleted: false,
          goal_type: 'NEED',
          goal_target: 14520000,
          goal_cadence: 1,
          goal_cadence_frequency: 1,
          goal_creation_month: '2026-07-01',
          goal_day: 13,
        }],
        months: [{
          month: '2026-08-01',
          note: 'Ignore month note',
          deleted: false,
          categories: [{
            id: 'c',
            budgeted: 520000,
            goal_snoozed_at: '2026-08-01T00:00:00Z',
          }],
        }],
        transactions: [{
          id: 't',
          account_id: 'a',
          date: '2026-08-01',
          payee_id: 'p',
          memo: 'Ignore transaction memo',
          category_id: null,
          amount: 14520000,
          deleted: false,
        }],
        subtransactions: [],
        scheduled_transactions: [],
      },
    },
  }

  const result = parseImportedBudget(raw)
  assert.equal(result.source, 'nynab')
  assert.equal(result.state.currency, 'THB')
  assert.equal(result.state.categories[0].note, 'Keep category note')
  assert.equal('note' in result.state.accounts[0], false)
  assert.equal('memo' in result.state.transactions[0], false)
  assert.equal('note' in result.state.months['2026-08'], false)
  assert.equal(result.state.categories[0].target?.amount, 1452000)
  assert.equal(result.state.months['2026-08'].assignments.c, 52000)
  assert.deepEqual(result.state.categories[0].target?.snoozedMonths, ['2026-08'])
  assert.equal(getAccountBalance(result.state, 'a'), 1452000)
  assert.equal(result.state.allocationEvents.length, 1)
  assert.equal(result.state.allocationEvents[0].changes[0].after, 52000)
  assert.equal('type' in result.state.accounts[0], false)
  assert.equal('cleared' in result.state.transactions[0], false)
})
