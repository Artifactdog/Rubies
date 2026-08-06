export type TargetType = 'monthly-spending' | 'monthly-savings' | 'by-date'
export type TargetScheduleUnit = 'week' | 'month' | 'year'

export interface Account {
  id: string
  name: string
  note?: string
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
  /** Legacy field retained so old Rubies exports keep working. */
  targetMonth?: string
  targetDate?: string
  schedule?: TargetSchedule
  repeat?: TargetRepeat
  snoozedMonths?: string[]
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
}

export interface BudgetMonth {
  month: string
  assignments: Record<string, number>
  note?: string
}

export type AllocationEventKind = 'assignment' | 'move' | 'auto-assign'

export interface AllocationChange {
  categoryId: string | null
  delta: number
  before: number
  after: number
}

export interface AllocationEvent {
  id: string
  createdAt: string
  month: string
  kind: AllocationEventKind
  label: string
  changes: AllocationChange[]
}

export interface BudgetState {
  version: 4
  name: string
  currency: string
  activeMonth: string
  groups: CategoryGroup[]
  categories: Category[]
  accounts: Account[]
  transactions: Transaction[]
  months: Record<string, BudgetMonth>
  allocationEvents: AllocationEvent[]
  importSource?: {
    kind: 'nynab'
    importedAt: string
    sourceName: string
  }
}

export interface TargetProgress {
  /** Compatibility alias used by auto-assign. */
  needed: number
  requiredThisMonth: number
  leftToAssign: number
  overallLeft: number
  progress: number
  label: string
  dueDate?: string
  scheduledAmount: number
  snoozed: boolean
}

export interface CategoryMonthSummary {
  assigned: number
  activity: number
  available: number
  status: 'healthy' | 'underfunded' | 'overspent' | 'snoozed'
  target: TargetProgress | null
}

export interface MonthFundingSummary {
  requiredThisMonth: number
  assignedTowardTargets: number
  leftToAssign: number
  targetCount: number
}

export interface ImportResult {
  state: BudgetState
  source: 'rubies' | 'nynab'
  summary: string
  warnings: string[]
}

type UnknownRecord = Record<string, unknown>

export const uid = (prefix: string): string =>
  `${prefix}_${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`

const localDateKey = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const currentMonthKey = (): string => localDateKey(new Date()).slice(0, 7)
export const todayKey = (): string => localDateKey(new Date())
export const monthKeyFromDate = (date: string): string => date.slice(0, 7)
export const compareMonths = (left: string, right: string): number => left.localeCompare(right)
export const compareDates = (left: string, right: string): number => left.localeCompare(right)

const positiveInteger = (value: number): number => Math.max(1, Math.floor(value || 1))
const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const asString = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback
const asNumber = (value: unknown, fallback = 0): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback
const asBoolean = (value: unknown, fallback = false): boolean =>
  typeof value === 'boolean' ? value : fallback
const asArray = (value: unknown): unknown[] => Array.isArray(value) ? value : []

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

const scheduleStep = (
  date: string,
  schedule: Extract<TargetSchedule, { kind: 'recurring' }>,
): string => {
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
    return dates.length === 1 ? `on ${dateLabel(dates[0])}` : `${dates.length} custom dates`
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
  state.accounts.reduce((sum, account) => sum + getAccountBalance(state, account.id), 0)

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

const getRelevantMonths = (state: BudgetState): string[] =>
  [...new Set<string>([
    ...Object.keys(state.months),
    ...state.transactions.map((transaction) => monthKeyFromDate(transaction.date)),
  ])].sort(compareMonths)

export const getCategoryAvailableBeforeMonth = (
  state: BudgetState,
  categoryId: string,
  month: string,
): number => {
  let available = 0
  for (const key of getRelevantMonths(state)) {
    if (compareMonths(key, month) >= 0) break
    available +=
      (getMonthAssignments(state, key)[categoryId] ?? 0) +
      getCategoryActivity(state, categoryId, key)
    // Rubies has only cash-style accounts. Negative category balances are
    // covered by the next month's Ready to Assign instead of rolling forward.
    available = Math.max(0, available)
  }
  return available
}

export const getCashOverspendingBeforeMonth = (
  state: BudgetState,
  month: string,
): number => {
  let overspending = 0
  const relevantMonths = getRelevantMonths(state).filter((key) => compareMonths(key, month) < 0)

  for (const category of state.categories) {
    let available = 0
    for (const key of relevantMonths) {
      const endOfMonth =
        available +
        (getMonthAssignments(state, key)[category.id] ?? 0) +
        getCategoryActivity(state, category.id, key)
      if (endOfMonth < 0) overspending += -endOfMonth
      available = Math.max(0, endOfMonth)
    }
  }

  return overspending
}

const isTargetSnoozed = (target: CategoryTarget, month: string): boolean =>
  target.snoozedMonths?.includes(month) ?? false

export const getTargetProgress = (
  state: BudgetState,
  category: Category,
  month: string,
  assigned: number,
  activity: number,
  available: number,
): TargetProgress | null => {
  if (!category.target) return null

  const snoozed = isTargetSnoozed(category.target, month)
  if (snoozed) {
    return {
      needed: 0,
      requiredThisMonth: 0,
      leftToAssign: 0,
      overallLeft: 0,
      progress: 1,
      label: `Snoozed for ${monthLabel(month)}`,
      scheduledAmount: 0,
      snoozed: true,
    }
  }

  if (category.target.type !== 'by-date') {
    const schedule = normalizedSchedule(category.target, month)
    const dates = getScheduleDatesInMonth(schedule, month)
    const scheduledAmount = category.target.amount * dates.length

    if (dates.length === 0) {
      const nextDate = getNextScheduleDate(schedule, month)
      return {
        needed: 0,
        requiredThisMonth: 0,
        leftToAssign: 0,
        overallLeft: 0,
        progress: 1,
        scheduledAmount: 0,
        ...(nextDate ? { dueDate: nextDate } : {}),
        label: nextDate ? `No target this month · next ${dateLabel(nextDate)}` : 'No more scheduled dates',
        snoozed: false,
      }
    }

    const availableBefore = getCategoryAvailableBeforeMonth(state, category.id, month)
    const requiredThisMonth = category.target.type === 'monthly-spending'
      ? Math.max(0, scheduledAmount - Math.max(0, availableBefore + activity))
      : scheduledAmount
    const leftToAssign = Math.max(0, requiredThisMonth - assigned)
    const fundedThisMonth = Math.max(0, Math.min(requiredThisMonth, assigned))
    const verb = category.target.type === 'monthly-spending' ? 'Refill' : 'Set aside'
    const amountLabel = dates.length > 1
      ? `${formatMoney(category.target.amount, state.currency)} × ${dates.length}`
      : formatMoney(scheduledAmount, state.currency)

    return {
      needed: leftToAssign,
      requiredThisMonth,
      leftToAssign,
      overallLeft: leftToAssign,
      progress: requiredThisMonth === 0 ? 1 : fundedThisMonth / requiredThisMonth,
      scheduledAmount,
      dueDate: dates.at(-1),
      label: `${verb} ${amountLabel} · ${scheduleDescription(schedule, dates)}`,
      snoozed: false,
    }
  }

  const dueDate = getActiveTargetDate(category.target, month)
  const dueMonth = monthKeyFromDate(dueDate)
  const availableBefore = getCategoryAvailableBeforeMonth(state, category.id, month)
  const amountBeforeCurrentAssignment = Math.max(0, availableBefore + activity)
  const remainingBeforeAssignment = Math.max(0, category.target.amount - amountBeforeCurrentAssignment)
  const monthsLeft = compareMonths(dueMonth, month) < 0 ? 1 : monthsBetweenInclusive(month, dueMonth)
  const requiredThisMonth = Math.ceil(remainingBeforeAssignment / monthsLeft)
  const leftToAssign = Math.max(0, requiredThisMonth - assigned)
  const overallLeft = Math.max(0, category.target.amount - Math.max(0, available))
  const overdue = compareMonths(dueMonth, month) < 0

  return {
    needed: leftToAssign,
    requiredThisMonth,
    leftToAssign,
    overallLeft,
    progress: category.target.amount === 0
      ? 1
      : Math.max(0, Math.min(1, Math.max(0, available) / category.target.amount)),
    scheduledAmount: category.target.amount,
    dueDate,
    label: `${formatMoney(category.target.amount, state.currency)} ${overdue ? 'overdue since' : 'by'} ${dateLabel(dueDate)}${repeatDescription(category.target.repeat)}`,
    snoozed: false,
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

  const status = available < 0
    ? 'overspent'
    : target?.snoozed
      ? 'snoozed'
      : target && target.leftToAssign > 0
        ? 'underfunded'
        : 'healthy'
  return { assigned, activity, available, status, target }
}

export const getMonthFundingSummary = (state: BudgetState, month: string): MonthFundingSummary => {
  const targets = state.categories
    .filter((category) => !category.hidden && category.target)
    .map((category) => getCategorySummary(state, category, month).target)
    .filter((target): target is TargetProgress => target !== null && !target.snoozed)

  return targets.reduce<MonthFundingSummary>(
    (summary, target) => ({
      requiredThisMonth: summary.requiredThisMonth + target.requiredThisMonth,
      assignedTowardTargets:
        summary.assignedTowardTargets + Math.max(0, target.requiredThisMonth - target.leftToAssign),
      leftToAssign: summary.leftToAssign + target.leftToAssign,
      targetCount: summary.targetCount + (target.requiredThisMonth > 0 ? 1 : 0),
    }),
    { requiredThisMonth: 0, assignedTowardTargets: 0, leftToAssign: 0, targetCount: 0 },
  )
}

export const getRawReadyToAssign = (state: BudgetState, month: string): number => {
  const accountIds = new Set(state.accounts.map((account) => account.id))

  const uncategorizedCashFlow = state.transactions
    .filter(
      (transaction) =>
        accountIds.has(transaction.accountId) &&
        transaction.categoryId === null &&
        compareMonths(monthKeyFromDate(transaction.date), month) <= 0,
    )
    .reduce((sum, transaction) => sum + transaction.amount, 0)

  const assigned = Object.values(state.months)
    .filter((budgetMonth) => compareMonths(budgetMonth.month, month) <= 0)
    .flatMap((budgetMonth) => Object.values(budgetMonth.assignments))
    .reduce((sum, amount) => sum + amount, 0)

  return uncategorizedCashFlow - assigned - getCashOverspendingBeforeMonth(state, month)
}

/**
 * Ready to Assign is one pool across the plan. Money left in an earlier month
 * can be consumed by assignments made later, so revisiting that earlier month
 * must not resurrect money that has already been given a job.
 *
 * Positive month deltas create funding lots. Later deficits consume the oldest
 * lots first. A past month therefore shows only the portion of its earlier
 * money that is still genuinely unassigned today.
 */
export const getReadyToAssign = (state: BudgetState, month: string): number => {
  const rawSelected = getRawReadyToAssign(state, month)
  const relevantMonths = getRelevantMonths(state)
  const latestMonth = relevantMonths.at(-1)

  if (!latestMonth || compareMonths(month, latestMonth) >= 0 || rawSelected <= 0) {
    return rawSelected
  }

  const lots: Array<{ month: string; amount: number }> = []
  let unresolvedDeficit = 0
  let previousRaw = 0

  for (const key of relevantMonths) {
    const raw = getRawReadyToAssign(state, key)
    let delta = raw - previousRaw
    previousRaw = raw

    if (delta > 0 && unresolvedDeficit > 0) {
      const covered = Math.min(delta, unresolvedDeficit)
      delta -= covered
      unresolvedDeficit -= covered
    }

    if (delta > 0) {
      lots.push({ month: key, amount: delta })
      continue
    }

    let need = -delta
    while (need > 0 && lots.length > 0) {
      const oldest = lots[0]
      const used = Math.min(need, oldest.amount)
      oldest.amount -= used
      need -= used
      if (oldest.amount === 0) lots.shift()
    }
    unresolvedDeficit += need
  }

  return lots
    .filter((lot) => compareMonths(lot.month, month) <= 0)
    .reduce((sum, lot) => sum + lot.amount, 0)
}

export const getRecentTransactions = (state: BudgetState, accountId?: string): Transaction[] =>
  [...state.transactions]
    .filter((transaction) => !accountId || transaction.accountId === accountId)
    .sort((left, right) => right.date.localeCompare(left.date) || right.id.localeCompare(left.id))

const normalizeSchedule = (value: unknown): TargetSchedule | undefined => {
  if (!isRecord(value)) return undefined
  if (value.kind === 'custom') {
    return { kind: 'custom', dates: asArray(value.dates).map((date) => asString(date)).filter(Boolean) }
  }
  if (value.kind === 'recurring') {
    const unit = value.unit === 'week' || value.unit === 'year' ? value.unit : 'month'
    return {
      kind: 'recurring',
      unit,
      interval: positiveInteger(asNumber(value.interval, 1)),
      anchorDate: asString(value.anchorDate, todayKey()),
    }
  }
  return undefined
}

const normalizeRepeat = (value: unknown): TargetRepeat | undefined => {
  if (!isRecord(value)) return undefined
  if (value.kind === 'custom') {
    return { kind: 'custom', dates: asArray(value.dates).map((date) => asString(date)).filter(Boolean) }
  }
  if (value.kind === 'recurring') {
    return {
      kind: 'recurring',
      unit: value.unit === 'month' ? 'month' : 'year',
      interval: positiveInteger(asNumber(value.interval, 1)),
    }
  }
  return undefined
}

const normalizeTarget = (value: unknown): CategoryTarget | undefined => {
  if (!isRecord(value)) return undefined
  const type: TargetType =
    value.type === 'monthly-spending' || value.type === 'by-date'
      ? value.type
      : 'monthly-savings'
  const amount = Math.max(0, Math.round(asNumber(value.amount)))
  if (amount <= 0) return undefined
  const schedule = normalizeSchedule(value.schedule)
  const repeat = normalizeRepeat(value.repeat)
  const snoozedMonths = asArray(value.snoozedMonths)
    .map((month) => asString(month))
    .filter((month) => /^\d{4}-\d{2}$/.test(month))
  return {
    type,
    amount,
    ...(asString(value.targetMonth) ? { targetMonth: asString(value.targetMonth) } : {}),
    ...(asString(value.targetDate) ? { targetDate: asString(value.targetDate) } : {}),
    ...(schedule ? { schedule } : {}),
    ...(repeat ? { repeat } : {}),
    ...(snoozedMonths.length ? { snoozedMonths: [...new Set(snoozedMonths)] } : {}),
  }
}

export const normalizeBudgetState = (raw: unknown): BudgetState => {
  if (!isRecord(raw)) throw new Error('This file does not contain a valid Rubies budget.')

  const accounts: Account[] = asArray(raw.accounts)
    .filter(isRecord)
    .map((account) => ({
      id: asString(account.id, uid('account')),
      name: asString(account.name, 'Account'),
      ...(asString(account.note) ? { note: asString(account.note) } : {}),
      ...(asBoolean(account.closed) ? { closed: true } : {}),
    }))

  const groups: CategoryGroup[] = asArray(raw.groups)
    .filter(isRecord)
    .map((group) => ({
      id: asString(group.id, uid('group')),
      name: asString(group.name, 'Group'),
      ...(asBoolean(group.hidden) ? { hidden: true } : {}),
    }))

  const fallbackGroupId = groups[0]?.id ?? 'group_general'
  if (groups.length === 0) groups.push({ id: fallbackGroupId, name: 'General' })

  const categories: Category[] = asArray(raw.categories)
    .filter(isRecord)
    .map((category) => {
      const target = normalizeTarget(category.target)
      return {
        id: asString(category.id, uid('category')),
        groupId: asString(category.groupId, fallbackGroupId),
        name: asString(category.name, 'Category'),
        ...(asString(category.note) ? { note: asString(category.note) } : {}),
        ...(asBoolean(category.hidden) ? { hidden: true } : {}),
        ...(target ? { target } : {}),
      }
    })

  const accountIds = new Set(accounts.map((account) => account.id))
  const categoryIds = new Set(categories.map((category) => category.id))
  const transactions: Transaction[] = asArray(raw.transactions)
    .filter(isRecord)
    .map((transaction) => ({
      id: asString(transaction.id, uid('transaction')),
      accountId: asString(transaction.accountId),
      date: asString(transaction.date, todayKey()),
      payee: asString(transaction.payee, 'Transaction'),
      memo: asString(transaction.memo),
      categoryId:
        typeof transaction.categoryId === 'string' && categoryIds.has(transaction.categoryId)
          ? transaction.categoryId
          : null,
      amount: Math.round(asNumber(transaction.amount)),
    }))
    .filter((transaction) => accountIds.has(transaction.accountId))

  const months: Record<string, BudgetMonth> = {}
  if (isRecord(raw.months)) {
    for (const [monthKey, monthValue] of Object.entries(raw.months)) {
      if (!/^\d{4}-\d{2}$/.test(monthKey) || !isRecord(monthValue)) continue
      const assignments: Record<string, number> = {}
      if (isRecord(monthValue.assignments)) {
        for (const [categoryId, amount] of Object.entries(monthValue.assignments)) {
          if (categoryIds.has(categoryId)) assignments[categoryId] = Math.round(asNumber(amount))
        }
      }
      months[monthKey] = {
        month: monthKey,
        assignments,
        ...(asString(monthValue.note) ? { note: asString(monthValue.note) } : {}),
      }
    }
  }

  const activeMonth = /^\d{4}-\d{2}$/.test(asString(raw.activeMonth))
    ? asString(raw.activeMonth)
    : currentMonthKey()
  if (!months[activeMonth]) months[activeMonth] = { month: activeMonth, assignments: {} }

  const allocationEvents: AllocationEvent[] = asArray(raw.allocationEvents)
    .filter(isRecord)
    .map((event) => {
      const kind: AllocationEventKind = event.kind === 'move' || event.kind === 'auto-assign'
        ? event.kind
        : 'assignment'
      const changes: AllocationChange[] = asArray(event.changes)
        .filter(isRecord)
        .map((change) => ({
          categoryId: typeof change.categoryId === 'string' ? change.categoryId : null,
          delta: Math.round(asNumber(change.delta)),
          before: Math.round(asNumber(change.before)),
          after: Math.round(asNumber(change.after)),
        }))
        .filter((change) => change.delta !== 0)

      return {
        id: asString(event.id, uid('allocation')),
        createdAt: asString(event.createdAt, new Date().toISOString()),
        month: /^\d{4}-\d{2}$/.test(asString(event.month)) ? asString(event.month) : activeMonth,
        kind,
        label: asString(event.label, 'Allocation changed'),
        changes,
      }
    })
    .filter((event) => event.changes.length > 0)

  return {
    version: 4,
    name: asString(raw.name, 'My budget'),
    currency: asString(raw.currency, 'USD'),
    activeMonth,
    groups,
    categories,
    accounts,
    transactions,
    months,
    allocationEvents,
    ...(isRecord(raw.importSource) && raw.importSource.kind === 'nynab'
      ? {
          importSource: {
            kind: 'nynab',
            importedAt: asString(raw.importSource.importedAt, new Date().toISOString()),
            sourceName: asString(raw.importSource.sourceName, 'nYNAB export'),
          },
        }
      : {}),
  }
}

const milliunitsToMinor = (amount: unknown, decimalDigits: number): number => {
  const divisor = 1000 / (10 ** Math.max(0, Math.min(3, decimalDigits)))
  return Math.round(asNumber(amount) / divisor)
}

const monthDateWithDay = (month: string, day: number | null): string => {
  if (!day) return monthEndDate(month)
  const [year, monthNumber] = month.split('-').map(Number)
  return `${month}-${String(Math.min(Math.max(1, day), daysInMonth(year, monthNumber - 1))).padStart(2, '0')}`
}

const importNynabTarget = (
  category: UnknownRecord,
  decimalDigits: number,
  fallbackMonth: string,
  snoozedMonths: string[],
): CategoryTarget | undefined => {
  const amount = Math.max(0, milliunitsToMinor(category.goal_target, decimalDigits))
  if (!asString(category.goal_type) || amount <= 0) return undefined

  const cadence = asNumber(category.goal_cadence, 0)
  const frequency = positiveInteger(asNumber(category.goal_cadence_frequency, 1))
  const creationMonth = asString(category.goal_creation_month, `${fallbackMonth}-01`).slice(0, 7)
  const targetMonth = asString(category.goal_target_month).slice(0, 7)
  const goalDayValue = asNumber(category.goal_day, 0)
  const goalDay = goalDayValue > 0 ? goalDayValue : null
  const snoozePart = snoozedMonths.length
    ? { snoozedMonths: [...new Set(snoozedMonths)].sort(compareMonths) }
    : {}

  if (cadence === 0 && targetMonth) {
    return {
      type: 'by-date',
      amount,
      targetDate: monthDateWithDay(targetMonth, goalDay),
      ...snoozePart,
    }
  }

  if (cadence === 13 && targetMonth) {
    return {
      type: 'by-date',
      amount,
      targetDate: monthDateWithDay(targetMonth, goalDay),
      repeat: { kind: 'recurring', unit: 'year', interval: frequency },
      ...snoozePart,
    }
  }

  if (cadence === 1 && frequency > 1 && targetMonth) {
    return {
      type: 'by-date',
      amount,
      targetDate: monthDateWithDay(targetMonth, goalDay),
      repeat: { kind: 'recurring', unit: 'month', interval: frequency },
      ...snoozePart,
    }
  }

  return {
    type: 'monthly-savings',
    amount,
    schedule: {
      kind: 'recurring',
      unit: 'month',
      interval: Math.max(1, frequency),
      anchorDate: monthDateWithDay(creationMonth, goalDay),
    },
    ...snoozePart,
  }
}

const importNynabPlan = (plan: UnknownRecord): ImportResult => {
  const currencyFormat = isRecord(plan.currency_format) ? plan.currency_format : {}
  const currency = asString(currencyFormat.iso_code, 'USD')
  const decimalDigits = Math.max(0, Math.min(3, Math.round(asNumber(currencyFormat.decimal_digits, 2))))
  const planName = asString(plan.name, 'Imported nYNAB budget')
  const planMonths = asArray(plan.months).filter(isRecord)
  const fallbackMonth = asString(plan.last_month, todayKey()).slice(0, 7) || currentMonthKey()

  const rawCategories = asArray(plan.categories).filter(isRecord)
  const userCategories = rawCategories.filter(
    (category) => !asBoolean(category.deleted) && !asBoolean(category.internal),
  )
  const usedGroupIds = new Set(userCategories.map((category) => asString(category.category_group_id)))

  const groups: CategoryGroup[] = asArray(plan.category_groups)
    .filter(isRecord)
    .filter((group) => !asBoolean(group.deleted) && usedGroupIds.has(asString(group.id)))
    .map((group) => ({
      id: asString(group.id, uid('group')),
      name: asString(group.name, 'Group'),
      ...(asBoolean(group.hidden) ? { hidden: true } : {}),
    }))

  const fallbackGroupId = groups[0]?.id ?? 'group_imported'
  if (groups.length === 0) groups.push({ id: fallbackGroupId, name: 'Imported categories' })
  const importedGroupIds = new Set(groups.map((group) => group.id))

  const snoozedByCategory = new Map<string, string[]>()
  for (const month of planMonths) {
    const monthKey = asString(month.month).slice(0, 7)
    if (!monthKey) continue
    for (const monthCategory of asArray(month.categories).filter(isRecord)) {
      if (monthCategory.goal_snoozed_at) {
        const categoryId = asString(monthCategory.id)
        if (categoryId) {
          const values = snoozedByCategory.get(categoryId) ?? []
          values.push(monthKey)
          snoozedByCategory.set(categoryId, values)
        }
      }
    }
  }

  const categories: Category[] = userCategories.map((category) => {
    const id = asString(category.id, uid('category'))
    const target = importNynabTarget(
      category,
      decimalDigits,
      fallbackMonth,
      snoozedByCategory.get(id) ?? [],
    )
    return {
      id,
      groupId: importedGroupIds.has(asString(category.category_group_id))
        ? asString(category.category_group_id)
        : fallbackGroupId,
      name: asString(category.name, 'Category'),
      ...(asString(category.note) ? { note: asString(category.note) } : {}),
      ...(asBoolean(category.hidden) ? { hidden: true } : {}),
      ...(target ? { target } : {}),
    }
  })

  const categoryIds = new Set(categories.map((category) => category.id))
  const accounts: Account[] = asArray(plan.accounts)
    .filter(isRecord)
    .filter((account) => !asBoolean(account.deleted))
    .map((account) => ({
      id: asString(account.id, uid('account')),
      name: asString(account.name, 'Account'),
      ...(asString(account.note) ? { note: asString(account.note) } : {}),
      ...(asBoolean(account.closed) ? { closed: true } : {}),
    }))
  const accountIds = new Set(accounts.map((account) => account.id))

  const payeeNames = new Map<string, string>()
  for (const payee of asArray(plan.payees).filter(isRecord)) {
    if (!asBoolean(payee.deleted)) payeeNames.set(asString(payee.id), asString(payee.name, 'Transaction'))
  }

  const rawSubtransactions = asArray(plan.subtransactions).filter(isRecord)
  const subtransactionsByParent = new Map<string, UnknownRecord[]>()
  for (const subtransaction of rawSubtransactions) {
    const parentId = asString(subtransaction.transaction_id || subtransaction.parent_transaction_id)
    if (!parentId) continue
    const values = subtransactionsByParent.get(parentId) ?? []
    values.push(subtransaction)
    subtransactionsByParent.set(parentId, values)
  }

  const transactions: Transaction[] = []
  for (const transaction of asArray(plan.transactions).filter(isRecord)) {
    if (asBoolean(transaction.deleted)) continue
    const accountId = asString(transaction.account_id)
    if (!accountIds.has(accountId)) continue
    const parentId = asString(transaction.id, uid('transaction'))
    const date = asString(transaction.date, todayKey())
    const parentPayee = payeeNames.get(asString(transaction.payee_id))
      ?? asString(transaction.import_payee_name)
      ?? asString(transaction.import_payee_name_original)
      ?? 'Transaction'
    const splits = subtransactionsByParent.get(parentId) ?? []

    if (splits.length > 0) {
      for (const split of splits) {
        if (asBoolean(split.deleted)) continue
        const splitCategoryId = asString(split.category_id)
        transactions.push({
          id: asString(split.id, `${parentId}_${transactions.length}`),
          accountId,
          date,
          payee: payeeNames.get(asString(split.payee_id)) ?? parentPayee,
          memo: asString(split.memo, asString(transaction.memo)),
          categoryId: categoryIds.has(splitCategoryId) ? splitCategoryId : null,
          amount: milliunitsToMinor(split.amount, decimalDigits),
        })
      }
      continue
    }

    const categoryId = asString(transaction.category_id)
    transactions.push({
      id: parentId,
      accountId,
      date,
      payee: parentPayee,
      memo: asString(transaction.memo),
      categoryId: categoryIds.has(categoryId) ? categoryId : null,
      amount: milliunitsToMinor(transaction.amount, decimalDigits),
    })
  }

  const lastModifiedDate = asString(plan.last_modified_on, todayKey()).slice(0, 10)
  for (const rawAccount of asArray(plan.accounts).filter(isRecord)) {
    if (asBoolean(rawAccount.deleted)) continue
    const accountId = asString(rawAccount.id)
    if (!accountIds.has(accountId)) continue
    const expected = milliunitsToMinor(rawAccount.balance, decimalDigits)
    const actual = transactions
      .filter((transaction) => transaction.accountId === accountId)
      .reduce((sum, transaction) => sum + transaction.amount, 0)
    const difference = expected - actual
    if (difference !== 0) {
      transactions.push({
        id: `nynab_balance_${accountId}`,
        accountId,
        date: /^\d{4}-\d{2}-\d{2}$/.test(lastModifiedDate) ? lastModifiedDate : todayKey(),
        payee: 'Imported balance adjustment',
        memo: 'Added by Rubies so the imported account balance matches the nYNAB export.',
        categoryId: null,
        amount: difference,
      })
    }
  }

  const months: Record<string, BudgetMonth> = {}
  for (const month of planMonths) {
    if (asBoolean(month.deleted)) continue
    const monthKey = asString(month.month).slice(0, 7)
    if (!/^\d{4}-\d{2}$/.test(monthKey)) continue
    const assignments: Record<string, number> = {}
    for (const category of asArray(month.categories).filter(isRecord)) {
      const categoryId = asString(category.id)
      if (categoryIds.has(categoryId)) {
        assignments[categoryId] = milliunitsToMinor(category.budgeted, decimalDigits)
      }
    }
    months[monthKey] = {
      month: monthKey,
      assignments,
      ...(asString(month.note) ? { note: asString(month.note) } : {}),
    }
  }

  const todayMonth = currentMonthKey()
  const activeMonth = months[todayMonth]
    ? todayMonth
    : Object.keys(months).sort(compareMonths).at(-1) ?? fallbackMonth
  if (!months[activeMonth]) months[activeMonth] = { month: activeMonth, assignments: {} }

  const allocationEvents: AllocationEvent[] = Object.values(months)
    .sort((left, right) => compareMonths(left.month, right.month))
    .map((budgetMonth) => ({
      id: `nynab_assignments_${budgetMonth.month}`,
      createdAt: `${budgetMonth.month}-01T00:00:00.000Z`,
      month: budgetMonth.month,
      kind: 'assignment' as const,
      label: `Imported ${monthLabel(budgetMonth.month)} assignment snapshot`,
      changes: Object.entries(budgetMonth.assignments)
        .filter(([, amount]) => amount !== 0)
        .map(([categoryId, amount]) => ({
          categoryId,
          delta: amount,
          before: 0,
          after: amount,
        })),
    }))
    .filter((event) => event.changes.length > 0)

  const warnings: string[] = []
  const scheduledCount = asArray(plan.scheduled_transactions).filter(isRecord).length
  if (scheduledCount > 0) {
    warnings.push(`${scheduledCount} scheduled transactions were not imported because Rubies does not schedule transactions yet.`)
  }

  return {
    source: 'nynab',
    state: {
      version: 4,
      name: planName,
      currency,
      activeMonth,
      groups,
      categories,
      accounts,
      transactions,
      months,
      allocationEvents,
      importSource: {
        kind: 'nynab',
        importedAt: new Date().toISOString(),
        sourceName: planName,
      },
    },
    summary: `Imported ${accounts.length} accounts, ${categories.length} categories, ${transactions.length} transactions, and ${Object.keys(months).length} budget months from ${planName}.`,
    warnings,
  }
}

export const parseImportedBudget = (raw: unknown): ImportResult => {
  if (isRecord(raw) && isRecord(raw.data) && isRecord(raw.data.plan)) {
    return importNynabPlan(raw.data.plan)
  }

  const state = normalizeBudgetState(raw)
  return {
    source: 'rubies',
    state,
    summary: `Imported ${state.accounts.length} accounts, ${state.categories.length} categories, ${state.transactions.length} transactions, and ${Object.keys(state.months).length} budget months.`,
    warnings: [],
  }
}

export const createEmptyState = (): BudgetState => {
  const month = currentMonthKey()
  return {
    version: 4,
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
        target: {
          type: 'monthly-savings',
          amount: 100_000,
          schedule: { kind: 'recurring', unit: 'month', interval: 1, anchorDate: `${month}-01` },
        },
      },
      {
        id: 'category_groceries',
        groupId: 'group_needs',
        name: 'Groceries',
        target: {
          type: 'monthly-spending',
          amount: 40_000,
          schedule: { kind: 'recurring', unit: 'month', interval: 1, anchorDate: `${month}-01` },
        },
      },
      {
        id: 'category_emergency',
        groupId: 'group_goals',
        name: 'Emergency fund',
        target: {
          type: 'monthly-savings',
          amount: 20_000,
          schedule: { kind: 'recurring', unit: 'month', interval: 1, anchorDate: `${month}-01` },
        },
      },
    ],
    accounts: [],
    transactions: [],
    months: { [month]: { month, assignments: {} } },
    allocationEvents: [],
  }
}

const dateOffset = (days: number): string => {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return localDateKey(date)
}

export const createDemoState = (): BudgetState => {
  const month = currentMonthKey()
  const previousMonth = shiftMonth(month, -1)
  const nextMonth = shiftMonth(month, 1)

  const groups: CategoryGroup[] = [
    { id: 'group_bills', name: 'Fixed bills' },
    { id: 'group_living', name: 'Everyday living' },
    { id: 'group_true', name: 'True expenses' },
    { id: 'group_fun', name: 'Quality of life' },
  ]

  const categories: Category[] = [
    {
      id: 'category_rent',
      groupId: 'group_bills',
      name: 'Rent',
      target: {
        type: 'monthly-savings',
        amount: 125_000,
        schedule: { kind: 'recurring', unit: 'month', interval: 1, anchorDate: `${previousMonth}-05` },
      },
    },
    {
      id: 'category_internet',
      groupId: 'group_bills',
      name: 'Internet',
      target: {
        type: 'monthly-savings',
        amount: 6_500,
        schedule: { kind: 'recurring', unit: 'month', interval: 1, anchorDate: `${previousMonth}-12` },
      },
    },
    {
      id: 'category_groceries',
      groupId: 'group_living',
      name: 'Groceries',
      target: {
        type: 'monthly-spending',
        amount: 11_000,
        schedule: { kind: 'recurring', unit: 'week', interval: 1, anchorDate: `${previousMonth}-03` },
      },
    },
    {
      id: 'category_transport',
      groupId: 'group_living',
      name: 'Transport',
      target: {
        type: 'monthly-savings',
        amount: 7_500,
        schedule: { kind: 'recurring', unit: 'week', interval: 2, anchorDate: `${previousMonth}-06` },
      },
    },
    {
      id: 'category_medical',
      groupId: 'group_true',
      name: 'Medical',
      target: {
        type: 'by-date',
        amount: 120_000,
        targetDate: monthEndDate(shiftMonth(month, 5)),
        repeat: { kind: 'recurring', unit: 'year', interval: 1 },
      },
    },
    {
      id: 'category_maintenance',
      groupId: 'group_true',
      name: 'Maintenance',
      target: {
        type: 'by-date',
        amount: 90_000,
        targetDate: monthEndDate(nextMonth),
        repeat: { kind: 'recurring', unit: 'month', interval: 3 },
      },
    },
    {
      id: 'category_fun',
      groupId: 'group_fun',
      name: 'Fun money',
      target: {
        type: 'monthly-savings',
        amount: 18_000,
        schedule: { kind: 'recurring', unit: 'month', interval: 1, anchorDate: `${previousMonth}-01` },
      },
    },
    {
      id: 'category_gifts',
      groupId: 'group_fun',
      name: 'Gifts',
      target: {
        type: 'monthly-savings',
        amount: 10_000,
        schedule: {
          kind: 'custom',
          dates: [`${month}-10`, `${shiftMonth(month, 2)}-18`, `${shiftMonth(month, 5)}-24`],
        },
      },
    },
  ]

  const accounts: Account[] = [
    { id: 'account_everyday', name: 'Everyday money' },
    { id: 'account_savings', name: 'Savings' },
  ]

  const transactions: Transaction[] = [
    { id: 'tx_open_everyday', accountId: 'account_everyday', date: `${previousMonth}-02`, payee: 'Opening balance', memo: '', categoryId: null, amount: 285_000 },
    { id: 'tx_open_savings', accountId: 'account_savings', date: `${previousMonth}-02`, payee: 'Opening balance', memo: '', categoryId: null, amount: 240_000 },
    { id: 'tx_payday', accountId: 'account_everyday', date: dateOffset(-5), payee: 'Acme Studio', memo: 'Salary', categoryId: null, amount: 320_000 },
    { id: 'tx_rent', accountId: 'account_everyday', date: dateOffset(-4), payee: 'Home Properties', memo: 'Monthly rent', categoryId: 'category_rent', amount: -125_000 },
    { id: 'tx_market', accountId: 'account_everyday', date: dateOffset(-2), payee: 'Fresh Market', memo: 'Weekly shop', categoryId: 'category_groceries', amount: -8_640 },
    { id: 'tx_train', accountId: 'account_everyday', date: dateOffset(-1), payee: 'Metro', memo: '', categoryId: 'category_transport', amount: -2_450 },
    { id: 'tx_cinema', accountId: 'account_everyday', date: todayKey(), payee: 'Cinema House', memo: 'Friday night', categoryId: 'category_fun', amount: -3_800 },
  ]

  return {
    version: 4,
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
          category_groceries: 44_000,
          category_transport: 15_000,
          category_medical: 20_000,
          category_maintenance: 20_000,
          category_fun: 18_000,
        },
      },
      [month]: {
        month,
        assignments: {
          category_rent: 125_000,
          category_internet: 6_500,
          category_groceries: 22_000,
          category_transport: 7_500,
          category_medical: 12_000,
          category_maintenance: 20_000,
          category_fun: 8_000,
        },
      },
    },
    allocationEvents: [],
  }
}
