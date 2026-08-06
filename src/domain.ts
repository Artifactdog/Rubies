export type AccountType = 'cash' | 'credit' | 'tracking'
export type TargetType = 'monthly-spending' | 'monthly-savings' | 'by-date'

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

export interface CategoryTarget {
  type: TargetType
  amount: number
  targetMonth?: string
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

export const shiftMonth = (month: string, offset: number): string => {
  const [year, monthNumber] = month.split('-').map(Number)
  const next = new Date(Date.UTC(year, monthNumber - 1 + offset, 1))
  return next.toISOString().slice(0, 7)
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
  available: number,
): TargetProgress | null => {
  if (!category.target) return null

  if (category.target.type === 'monthly-spending') {
    const needed = Math.max(0, category.target.amount - available)
    return {
      needed,
      progress: Math.max(0, Math.min(1, available / category.target.amount)),
      label: `Refill to ${formatMoney(category.target.amount, state.currency)}`,
    }
  }

  if (category.target.type === 'monthly-savings') {
    const needed = Math.max(0, category.target.amount - assigned)
    return {
      needed,
      progress: Math.max(0, Math.min(1, assigned / category.target.amount)),
      label: `Add ${formatMoney(category.target.amount, state.currency)} this month`,
    }
  }

  const targetMonth = category.target.targetMonth ?? month
  const availableBefore = getCategoryAvailableBeforeMonth(state, category.id, month)
  const remaining = Math.max(0, category.target.amount - Math.max(0, availableBefore))
  const monthsLeft = compareMonths(targetMonth, month) < 0 ? 1 : monthsBetweenInclusive(month, targetMonth)
  const recommendedThisMonth = Math.ceil(remaining / monthsLeft)
  const needed = Math.max(0, recommendedThisMonth - assigned)

  return {
    needed,
    progress: Math.max(0, Math.min(1, available / category.target.amount)),
    label: `${formatMoney(category.target.amount, state.currency)} by ${monthLabel(targetMonth)}`,
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
  const target = getTargetProgress(state, category, month, assigned, available)

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

export const createEmptyState = (): BudgetState => {
  const month = currentMonthKey()
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
        target: { type: 'monthly-spending', amount: 100_000 },
      },
      {
        id: 'category_groceries',
        groupId: 'group_needs',
        name: 'Groceries',
        target: { type: 'monthly-spending', amount: 40_000 },
      },
      {
        id: 'category_emergency',
        groupId: 'group_goals',
        name: 'Emergency fund',
        target: { type: 'monthly-savings', amount: 20_000 },
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

  const groups: CategoryGroup[] = [
    { id: 'group_bills', name: 'Fixed bills' },
    { id: 'group_living', name: 'Everyday living' },
    { id: 'group_true', name: 'True expenses' },
    { id: 'group_fun', name: 'Quality of life' },
  ]

  const categories: Category[] = [
    { id: 'category_rent', groupId: 'group_bills', name: 'Rent', target: { type: 'monthly-spending', amount: 125_000 } },
    { id: 'category_internet', groupId: 'group_bills', name: 'Internet', target: { type: 'monthly-spending', amount: 6_500 } },
    { id: 'category_groceries', groupId: 'group_living', name: 'Groceries', target: { type: 'monthly-spending', amount: 45_000 } },
    { id: 'category_transport', groupId: 'group_living', name: 'Transport', target: { type: 'monthly-spending', amount: 15_000 } },
    { id: 'category_medical', groupId: 'group_true', name: 'Medical', target: { type: 'monthly-savings', amount: 10_000 } },
    { id: 'category_annual', groupId: 'group_true', name: 'Annual subscriptions', target: { type: 'by-date', amount: 72_000, targetMonth: nextYearMonth } },
    { id: 'category_fun', groupId: 'group_fun', name: 'Fun money', target: { type: 'monthly-spending', amount: 18_000 } },
    { id: 'category_travel', groupId: 'group_fun', name: 'Japan trip', target: { type: 'by-date', amount: 250_000, targetMonth: shiftMonth(month, 10) }, note: 'Flights, hotel, and a generous ramen budget.' },
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
          category_fun: 18_000,
          category_travel: 25_000,
        },
      },
    },
  }
}
