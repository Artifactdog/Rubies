export type AccountType = 'cash' | 'credit' | 'tracking'
export type TargetType = 'monthly-spending' | 'monthly-savings' | 'by-date'
export type TargetScheduleUnit = 'week' | 'month' | 'year'

export interface Account {
  id: string
  name: string
  type: AccountType
  onBudget: boolean
  closed?: boolean
}

export interface CategoryGroup {
  id: string
  name: string
  hidden?: boolean
}

export type TargetSchedule =
  | {
      kind: 'recurring'
      unit: TargetScheduleUnit
      interval: number
      anchorDate: string
    }
  | {
      kind: 'custom'
      dates: string[]
    }

export type TargetRepeat =
  | {
      kind: 'recurring'
      unit: 'month' | 'year'
      interval: number
    }
  | {
      kind: 'custom'
      dates: string[]
    }

export interface CategoryTarget {
  type: TargetType
  amount: number
  /** Legacy v0.2 field retained for backward compatibility. */
  targetMonth?: string
  targetDate?: string
  schedule?: TargetSchedule
  repeat?: TargetRepeat
}

export interface Category {
  id: string
  groupId: string
  name: string
  target?: CategoryTarget
  note?: string
  hidden?: boolean
}

export interface Transaction {
  id: string
  accountId: string
  date: string
  payee: string
  memo: string
  categoryId: string | null
  amount: number
  cleared: boolean
}

export interface BudgetMonth {
  month: string
  assignments: Record<string, number>
}

export interface BudgetState {
  version: 2
  name: string
  currency: string
  activeMonth: string
  groups: CategoryGroup[]
  categories: Category[]
  accounts: Account[]
  transactions: Transaction[]
  months: Record<string, BudgetMonth>
}

export interface TargetProgress {
  needed: number
  progress: number
  label: string
  dueDate?: string
  scheduledAmount: number
}

export interface CategoryMonthSummary {
  assigned: number
  activity: number
  available: number
  status: 'healthy' | 'underfunded' | 'overspent'
  target: TargetProgress | null
}

export const uid = (prefix: string): string =>
  `${prefix}_${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`

export const currentMonthKey = (): string => new Date().toISOString().slice(0, 7)
export const todayKey = (): string => new Date().toISOString().slice(0, 10)
export const monthKeyFromDate = (date: string): string => date.slice(0, 7)
export const compareMonths = (left: string, right: string): number => left.localeCompare(right)
export const compareDates = (left: string, right: string): number => left.localeCompare(right)

const positiveInteger = (value: number): number => Math.max(1, Math.floor(value || 1))

const dateFromKey = (date: string): Date => {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

const dateKey = (date: Date): string => date.toISOString().slice(0, 10)

const daysInMonth = (year: number, monthIndex: number): number =>
  new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()

const addDays = (date: string, days: number): string => {
  const next = dateFromKey(date)
  next.setUTCDate(next.getUTCDate() + days)
  return dateKey(next)
}

export const addMonthsClamped = (date: string, months: number): string => {
  const source = dateFromKey(date)
  const sourceDay = source.getUTCDate()
  const monthStart = new Date(Date.UTC(source.getUTCFullYear(), source.getUTCMonth() + months, 1))
  const day = Math.min(sourceDay, daysInMonth(monthStart.getUTCFullYear(), monthStart.getUTCMonth()))
  monthStart.setUTCDate(day)
  return dateKey(monthStart)
}

export const shiftMonth = (month: string, offset: number): string => {
  const [year, monthNumber] = month.split('-').map(Number)
  const next = new Date(Date.UTC(year, monthNumber - 1 + offset, 1))
  return next.toISOString().slice(0, 7)
}

export const monthEndDate = (month: string): string => {
  const [year, monthNumber] = month.split('-').map(Number)
  return dateKey(new Date(Date.UTC(year, monthNumber, 0)))
}

export const monthsBetweenInclusive = (from: string, to: string): number => {
  const [fromYear, fromMonth] = from.split('-').map(Number)
  const [toYear, toMonth] = to.split('-').map(Number)
  return Math.max(1, (toYear - fromYear) * 12 + toMonth - fromMonth + 1)
}

export const monthLabel = (month: string): string => {
  const [year, monthNumber] = month.split('-').map(Number)
  return new Intl.DateTimeFormat(undefined, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, monthNumber - 1, 1)))
}

export const dateLabel = (date: string): string =>
  new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(dateFromKey(date))

export const formatMoney = (minorUnits: number, currency: string): string =>
  new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minorUnits / 100)

export const parseMoney = (value: string): number => {
  const normalized = value.replace(/[^0-9.-]/g, '')
  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0
}

export const parseDateList = (value: string): string[] =>
  [...new Set(value.split(/[\s,;]+/).filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item)))]
    .sort(compareDates)

const scheduleStep = (date: string, schedule: Extract<TargetSchedule, { kind: 'recurring' }>): string => {
  const interval = positiveInteger(schedule.interval)
  if (schedule.unit === 'week') return addDays(date, interval * 7)
  return addMonthsClamped(date, interval * (schedule.unit === 'year' ? 12 : 1))
}

const normalizedSchedule = (target: CategoryTarget, month: string): TargetSchedule => {
  if (target.schedule?.kind === 'custom') {
    return { kind: 'custom', dates: [...new Set(target.schedule.dates)].sort(compareDates) }
  }
  if (target.schedule?.kind === 'recurring') {
    return {
      kind: 'recurring',
      unit: target.schedule.unit,
      interval: positiveInteger(target.schedule.interval),
      anchorDate: target.schedule.anchorDate,
    }
  }
  return { kind: 'recurring', unit: 'month', interval: 1, anchorDate: `${month}-01` }
}

export const getScheduleDatesInMonth = (schedule: TargetSchedule, month: string): string[] => {
  const start = `${month}-01`
  const end = monthEndDate(month)

  if (schedule.kind === 'custom') {
    return [...new Set(schedule.dates)]
      .filter((date) => date >= start && date <= end)
      .sort(compareDates)
  }

  let occurrence = schedule.anchorDate
  if (occurrence > end) return []

  let guard = 0
  while (occurrence < start && guard < 10_000) {
    occurrence = scheduleStep(occurrence, schedule)
    guard += 1
  }

  const dates: string[] = []
  while (occurrence <= end && guard < 10_000) {
    if (occurrence >= start) dates.push(occurrence)
    occurrence = scheduleStep(occurrence, schedule)
    guard += 1
  }
  return dates
}

export const getNextScheduleDate = (schedule: TargetSchedule, month: string): string | undefined => {
  const start = `${month}-01`
  if (schedule.kind === 'custom') {
    return [...new Set(schedule.dates)].sort(compareDates).find((date) => date >= start)
  }

  let occurrence = schedule.anchorDate
  let guard = 0
  while (occurrence < start && guard < 10_000) {
    occurrence = scheduleStep(occurrence, schedule)
    guard += 1
  }
  return guard < 10_000 ? occurrence : undefined
}

const targetBaseDate = (target: CategoryTarget, month: string): string =>
  target.targetDate ?? (target.targetMonth ? monthEndDate(target.targetMonth) : monthEndDate(month))

export const getActiveTargetDate = (target: CategoryTarget, month: string): string => {
  const baseDate = targetBaseDate(target, month)
  if (!target.repeat) return baseDate

  if (target.repeat.kind === 'custom') {
    const dates = [...new Set([baseDate, ...target.repeat.dates])].sort(compareDates)
    return dates.find((date) => monthKeyFromDate(date) >= month) ?? dates.at(-1) ?? baseDate
  }

  let dueDate = baseDate
  let guard = 0
  const monthStep = positiveInteger(target.repeat.interval) * (target.repeat.unit === 'year' ? 12 : 1)
  while (monthKeyFromDate(dueDate) < month && guard < 10_000) {
    dueDate = addMonthsClamped(dueDate, monthStep)
    guard += 1
  }
  return dueDate
}

const scheduleDescription = (schedule: TargetSchedule, dates: string[]): string => {
  if (schedule.kind === 'custom') {
    return dates.length === 1 ? `on ${dateLabel(dates[0])}` : `across ${dates.length} custom dates`
  }
  if (dates.length === 1) return `due ${dateLabel(dates[0])}`
  const unit = schedule.unit === 'week' ? 'weekly' : schedule.unit === 'month' ? 'monthly' : 'yearly'
  return `${dates.length} ${unit} occurrences`
}

const repeatDescription = (repeat: TargetRepeat | undefined): string => {
  if (!repeat) return ''
  if (repeat.kind === 'custom') return ' · custom future dates'
  const interval = positiveInteger(repeat.interval)
  const unit = `${repeat.unit}${interval === 1 ? '' : 's'}`
  return ` · repeats every ${interval} ${unit}`
}

export const getAccountBalance = (state: BudgetState, accountId: string): number =>
  state.transactions
    .filter((transaction) => transaction.accountId === accountId)
    .reduce((sum, transaction) => sum + transaction.amount, 0)

export const getBudgetBalance = (state: BudgetState): number =>
  state.accounts
    .filter((account) => account.onBudget)
    .reduce((sum, account) => sum + getAccountBalance(state, account.id), 0)

export const getMonthAssignments = (state: BudgetState, month: string): Record<string, number> =>
  state.months[month]?.assignments ?? {}

export const getCategoryActivity = (
  state: BudgetState,
  categoryId: string,
  month: string,
): number =>
  state.transactions
    .filter(
      (transaction) =>
        transaction.categoryId === categoryId && monthKeyFromDate(transaction.date) === month,
    )
    .reduce((sum, transaction) => sum + transaction.amount, 0)

export const getCategoryAvailableBeforeMonth = (
  state: BudgetState,
  categoryId: string,
  month: string,
): number => {
  const relevantMonths = new Set<string>([
    ...Object.keys(state.months),
    ...state.transactions.map((transaction) => monthKeyFromDate(transaction.date)),
  ])

  return [...relevantMonths]
    .filter((key) => compareMonths(key, month) < 0)
    .sort(compareMonths)
    .reduce(
      (available, key) =>
        available +
        (getMonthAssignments(state, key)[categoryId] ?? 0) +
        getCategoryActivity(state, categoryId, key),
      0,
    )
}

export const getTargetProgress = (
  state: BudgetState,
  category: Category,
  month: string,
  assigned: number,
  activity: number,
  available: number,
): TargetProgress | null => {
  if (!category.target) return null

  if (category.target.type !== 'by-date') {
    const schedule = normalizedSchedule(category.target, month)
    const dates = getScheduleDatesInMonth(schedule, month)
    const scheduledAmount = category.target.amount * dates.length

    if (dates.length === 0) {
      const nextDate = getNextScheduleDate(schedule, month)
      return {
        needed: 0,
        progress: 0,
        scheduledAmount: 0,
        ...(nextDate ? { dueDate: nextDate } : {}),
        label: nextDate ? `No target this month · next ${dateLabel(nextDate)}` : 'No more scheduled dates',
      }
    }

    const needed = category.target.type === 'monthly-spending'
      ? Math.max(0, scheduledAmount - available)
      : Math.max(0, scheduledAmount - assigned)
    const progressValue = category.target.type === 'monthly-spending' ? available : assigned
    const verb = category.target.type === 'monthly-spending' ? 'Refill to' : 'Assign'
    const amountLabel = dates.length > 1
      ? `${formatMoney(category.target.amount, state.currency)} × ${dates.length}`
      : formatMoney(scheduledAmount, state.currency)

    return {
      needed,
      progress: scheduledAmount === 0 ? 0 : Math.max(0, Math.min(1, progressValue / scheduledAmount)),
      scheduledAmount,
      dueDate: dates.at(-1),
      label: `${verb} ${amountLabel} · ${scheduleDescription(schedule, dates)}`,
    }
  }

  const dueDate = getActiveTargetDate(category.target, month)
  const dueMonth = monthKeyFromDate(dueDate)
  const availableBefore = getCategoryAvailableBeforeMonth(state, category.id, month)
  const amountBeforeCurrentAssignment = Math.max(0, availableBefore + activity)
  const remaining = Math.max(0, category.target.amount - amountBeforeCurrentAssignment)
  const monthsLeft = compareMonths(dueMonth, month) < 0 ? 1 : monthsBetweenInclusive(month, dueMonth)
  const recommendedThisMonth = Math.ceil(remaining / monthsLeft)
  const needed = Math.max(0, recommendedThisMonth - assigned)
  const overdue = compareMonths(dueMonth, month) < 0

  return {
    needed,
    progress: Math.max(0, Math.min(1, available / category.target.amount)),
    scheduledAmount: category.target.amount,
    dueDate,
    label: `${formatMoney(category.target.amount, state.currency)} ${overdue ? 'overdue since' : 'by'} ${dateLabel(dueDate)}${repeatDescription(category.target.repeat)}`,
  }
}

export const getCategorySummary = (
  state: BudgetState,
  category: Category,
  month: string,
): CategoryMonthSummary => {
  const availableBefore = getCategoryAvailableBeforeMonth(state, category.id, month)
  const assigned = getMonthAssignments(state, month)[category.id] ?? 0
  const activity = getCategoryActivity(state, category.id, month)
  const available = availableBefore + assigned + activity
  const target = getTargetProgress(state, category, month, assigned, activity, available)

  const status = available < 0 ? 'overspent' : target && target.needed > 0 ? 'underfunded' : 'healthy'
  return { assigned, activity, available, status, target }
}

export const getReadyToAssign = (state: BudgetState, month: string): number => {
  const budgetAccountIds = new Set(
    state.accounts.filter((account) => account.onBudget).map((account) => account.id),
  )

  const uncategorizedCashFlow = state.transactions
    .filter(
      (transaction) =>
        budgetAccountIds.has(transaction.accountId) &&
        transaction.categoryId === null &&
        compareMonths(monthKeyFromDate(transaction.date), month) <= 0,
    )
    .reduce((sum, transaction) => sum + transaction.amount, 0)

  const assigned = Object.values(state.months)
    .filter((budgetMonth) => compareMonths(budgetMonth.month, month) <= 0)
    .flatMap((budgetMonth) => Object.values(budgetMonth.assignments))
    .reduce((sum, amount) => sum + amount, 0)

  return uncategorizedCashFlow - assigned
}

export const getRecentTransactions = (state: BudgetState, accountId?: string): Transaction[] =>
  [...state.transactions]
    .filter((transaction) => !accountId || transaction.accountId === accountId)
    .sort((left, right) => right.date.localeCompare(left.date) || right.id.localeCompare(left.id))

const monthlySchedule = (anchorDate: string, interval = 1): TargetSchedule => ({
  kind: 'recurring',
  unit: 'month',
  interval,
  anchorDate,
})

export const createEmptyState = (): BudgetState => {
  const month = currentMonthKey()
  const anchorDate = `${month}-01`
  return {
    version: 2,
    name: 'My budget',
    currency: 'USD',
    activeMonth: month,
    groups: [
      { id: 'group_bills', name: 'Bills' },
      { id: 'group_needs', name: 'Everyday needs' },
      { id: 'group_goals', name: 'Goals' },
    ],
    categories: [
      {
        id: 'category_rent',
        groupId: 'group_bills',
        name: 'Rent / mortgage',
        target: { type: 'monthly-spending', amount: 100_000, schedule: monthlySchedule(anchorDate) },
      },
      {
        id: 'category_groceries',
        groupId: 'group_needs',
        name: 'Groceries',
        target: { type: 'monthly-spending', amount: 10_000, schedule: { kind: 'recurring', unit: 'week', interval: 1, anchorDate } },
      },
      {
        id: 'category_emergency',
        groupId: 'group_goals',
        name: 'Emergency fund',
        target: { type: 'monthly-savings', amount: 20_000, schedule: monthlySchedule(anchorDate) },
      },
    ],
    accounts: [],
    transactions: [],
    months: { [month]: { month, assignments: {} } },
  }
}

const dateOffset = (days: number): string =>
  new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)

export const createDemoState = (): BudgetState => {
  const month = currentMonthKey()
  const previousMonth = shiftMonth(month, -1)
  const nextYearMonth = shiftMonth(month, 8)
  const monthAnchor = `${previousMonth}-01`

  const groups: CategoryGroup[] = [
    { id: 'group_bills', name: 'Fixed bills' },
    { id: 'group_living', name: 'Everyday living' },
    { id: 'group_true', name: 'True expenses' },
    { id: 'group_fun', name: 'Quality of life' },
  ]

  const categories: Category[] = [
    { id: 'category_rent', groupId: 'group_bills', name: 'Rent', target: { type: 'monthly-spending', amount: 125_000, schedule: monthlySchedule(`${previousMonth}-01`) } },
    { id: 'category_internet', groupId: 'group_bills', name: 'Internet', target: { type: 'monthly-spending', amount: 6_500, schedule: monthlySchedule(`${previousMonth}-12`) } },
    { id: 'category_groceries', groupId: 'group_living', name: 'Groceries', target: { type: 'monthly-spending', amount: 11_000, schedule: { kind: 'recurring', unit: 'week', interval: 1, anchorDate: monthAnchor } } },
    { id: 'category_transport', groupId: 'group_living', name: 'Transport', target: { type: 'monthly-savings', amount: 7_500, schedule: { kind: 'recurring', unit: 'week', interval: 2, anchorDate: monthAnchor } } },
    { id: 'category_medical', groupId: 'group_true', name: 'Medical', target: { type: 'monthly-savings', amount: 10_000, schedule: monthlySchedule(`${previousMonth}-05`) } },
    { id: 'category_annual', groupId: 'group_true', name: 'Annual subscriptions', target: { type: 'by-date', amount: 72_000, targetDate: monthEndDate(nextYearMonth), repeat: { kind: 'recurring', unit: 'year', interval: 1 } } },
    { id: 'category_repairs', groupId: 'group_true', name: 'Home maintenance', target: { type: 'by-date', amount: 45_000, targetDate: monthEndDate(shiftMonth(month, 2)), repeat: { kind: 'recurring', unit: 'month', interval: 3 } } },
    { id: 'category_fun', groupId: 'group_fun', name: 'Fun money', target: { type: 'monthly-spending', amount: 18_000, schedule: monthlySchedule(`${previousMonth}-01`) } },
    { id: 'category_gifts', groupId: 'group_fun', name: 'Gifts', target: { type: 'monthly-savings', amount: 8_000, schedule: { kind: 'custom', dates: [dateOffset(10), dateOffset(45), dateOffset(120)] } } },
    { id: 'category_travel', groupId: 'group_fun', name: 'Japan trip', target: { type: 'by-date', amount: 250_000, targetDate: monthEndDate(shiftMonth(month, 10)) }, note: 'Flights, hotel, and a generous ramen budget.' },
  ]

  const accounts: Account[] = [
    { id: 'account_checking', name: 'Everyday checking', type: 'cash', onBudget: true },
    { id: 'account_savings', name: 'High-yield savings', type: 'cash', onBudget: true },
    { id: 'account_card', name: 'Daily credit card', type: 'credit', onBudget: true },
  ]

  const transactions: Transaction[] = [
    { id: 'tx_open_checking', accountId: 'account_checking', date: `${previousMonth}-02`, payee: 'Opening balance', memo: '', categoryId: null, amount: 285_000, cleared: true },
    { id: 'tx_open_savings', accountId: 'account_savings', date: `${previousMonth}-02`, payee: 'Opening balance', memo: '', categoryId: null, amount: 240_000, cleared: true },
    { id: 'tx_payday', accountId: 'account_checking', date: dateOffset(-5), payee: 'Acme Studio', memo: 'Salary', categoryId: null, amount: 320_000, cleared: true },
    { id: 'tx_rent', accountId: 'account_checking', date: dateOffset(-4), payee: 'Home Properties', memo: 'Monthly rent', categoryId: 'category_rent', amount: -125_000, cleared: true },
    { id: 'tx_market', accountId: 'account_card', date: dateOffset(-2), payee: 'Fresh Market', memo: 'Weekly shop', categoryId: 'category_groceries', amount: -8_640, cleared: true },
    { id: 'tx_train', accountId: 'account_card', date: dateOffset(-1), payee: 'Metro', memo: '', categoryId: 'category_transport', amount: -2_450, cleared: false },
    { id: 'tx_cinema', accountId: 'account_card', date: todayKey(), payee: 'Cinema House', memo: 'Friday night', categoryId: 'category_fun', amount: -3_800, cleared: false },
  ]

  return {
    version: 2,
    name: 'Demo budget',
    currency: 'USD',
    activeMonth: month,
    groups,
    categories,
    accounts,
    transactions,
    months: {
      [previousMonth]: {
        month: previousMonth,
        assignments: {
          category_rent: 125_000,
          category_groceries: 40_000,
          category_transport: 12_000,
          category_medical: 8_000,
          category_annual: 6_000,
          category_fun: 15_000,
          category_travel: 20_000,
        },
      },
      [month]: {
        month,
        assignments: {
          category_rent: 125_000,
          category_internet: 6_500,
          category_groceries: 45_000,
          category_transport: 15_000,
          category_medical: 10_000,
          category_annual: 6_000,
          category_repairs: 15_000,
          category_fun: 18_000,
          category_gifts: 8_000,
          category_travel: 25_000,
        },
      },
    },
  }
}
