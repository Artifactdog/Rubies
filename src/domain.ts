export type AccountType = 'cash' | 'credit' | 'tracking'

export interface Account {
  id: string
  name: string
  type: AccountType
  onBudget: boolean
}

export interface CategoryGroup {
  id: string
  name: string
}

export interface Category {
  id: string
  groupId: string
  name: string
  target?: number
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
  version: 1
  currency: string
  activeMonth: string
  groups: CategoryGroup[]
  categories: Category[]
  accounts: Account[]
  transactions: Transaction[]
  months: Record<string, BudgetMonth>
}

export interface CategoryMonthSummary {
  assigned: number
  activity: number
  available: number
  status: 'healthy' | 'underfunded' | 'overspent'
}

export const uid = (prefix: string): string =>
  `${prefix}_${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`

export const currentMonthKey = (): string => new Date().toISOString().slice(0, 7)

export const monthKeyFromDate = (date: string): string => date.slice(0, 7)

export const compareMonths = (left: string, right: string): number => left.localeCompare(right)

export const shiftMonth = (month: string, offset: number): string => {
  const [year, monthNumber] = month.split('-').map(Number)
  const next = new Date(Date.UTC(year, monthNumber - 1 + offset, 1))
  return next.toISOString().slice(0, 7)
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

export const getCategorySummary = (
  state: BudgetState,
  category: Category,
  month: string,
): CategoryMonthSummary => {
  const months = new Set<string>([
    ...Object.keys(state.months),
    ...state.transactions.map((transaction) => monthKeyFromDate(transaction.date)),
    month,
  ])

  const orderedMonths = [...months].filter((key) => compareMonths(key, month) <= 0).sort(compareMonths)

  let available = 0
  let assigned = 0
  let activity = 0

  for (const key of orderedMonths) {
    const monthAssigned = getMonthAssignments(state, key)[category.id] ?? 0
    const monthActivity = getCategoryActivity(state, category.id, key)
    available += monthAssigned + monthActivity

    if (key === month) {
      assigned = monthAssigned
      activity = monthActivity
    }
  }

  const status =
    available < 0
      ? 'overspent'
      : category.target && available < category.target
        ? 'underfunded'
        : 'healthy'

  return { assigned, activity, available, status }
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

export const createSeedState = (): BudgetState => {
  const month = currentMonthKey()
  const today = new Date().toISOString().slice(0, 10)
  const priorWeek = new Date(Date.now() - 6 * 86_400_000).toISOString().slice(0, 10)
  const priorDay = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)

  const accounts: Account[] = [
    { id: 'account_checking', name: 'Everyday Checking', type: 'cash', onBudget: true },
    { id: 'account_savings', name: 'Rainy Day Savings', type: 'cash', onBudget: true },
  ]

  const groups: CategoryGroup[] = [
    { id: 'group_immediate', name: 'Immediate Obligations' },
    { id: 'group_true', name: 'True Expenses' },
    { id: 'group_quality', name: 'Quality of Life' },
  ]

  const categories: Category[] = [
    { id: 'category_rent', groupId: 'group_immediate', name: 'Rent', target: 125_000 },
    { id: 'category_groceries', groupId: 'group_immediate', name: 'Groceries', target: 45_000 },
    { id: 'category_transport', groupId: 'group_immediate', name: 'Transport', target: 12_000 },
    { id: 'category_repairs', groupId: 'group_true', name: 'Home & Repairs', target: 20_000 },
    { id: 'category_annual', groupId: 'group_true', name: 'Annual Bills', target: 18_000 },
    { id: 'category_fun', groupId: 'group_quality', name: 'Fun Money', target: 15_000 },
    { id: 'category_travel', groupId: 'group_quality', name: 'Travel', target: 25_000 },
  ]

  const transactions: Transaction[] = [
    {
      id: 'transaction_paycheck',
      accountId: 'account_checking',
      date: priorWeek,
      payee: 'Opening balance',
      memo: 'Money currently available to plan',
      categoryId: null,
      amount: 390_000,
      cleared: true,
    },
    {
      id: 'transaction_savings',
      accountId: 'account_savings',
      date: priorWeek,
      payee: 'Opening balance',
      memo: 'Existing savings',
      categoryId: null,
      amount: 120_000,
      cleared: true,
    },
    {
      id: 'transaction_rent',
      accountId: 'account_checking',
      date: priorDay,
      payee: 'Landlord',
      memo: '',
      categoryId: 'category_rent',
      amount: -125_000,
      cleared: true,
    },
    {
      id: 'transaction_market',
      accountId: 'account_checking',
      date: today,
      payee: 'Fresh Market',
      memo: 'Weekly groceries',
      categoryId: 'category_groceries',
      amount: -6_420,
      cleared: false,
    },
  ]

  return {
    version: 1,
    currency: 'USD',
    activeMonth: month,
    groups,
    categories,
    accounts,
    transactions,
    months: {
      [month]: {
        month,
        assignments: {
          category_rent: 125_000,
          category_groceries: 45_000,
          category_transport: 12_000,
          category_repairs: 20_000,
          category_annual: 18_000,
          category_fun: 15_000,
          category_travel: 25_000,
        },
      },
    },
  }
}
