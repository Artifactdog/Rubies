import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  Account,
  AllocationChange,
  AllocationEventKind,
  BudgetState,
  Category,
  CategoryGroup,
  Transaction,
} from './domain'
import { formatMoney, getCategorySummary, getReadyToAssign, uid } from './domain'

export interface BudgetActions {
  setActiveMonth: (month: string) => void
  setAssignment: (month: string, categoryId: string, amount: number) => void
  moveMoney: (
    month: string,
    fromCategoryId: string | null,
    toCategoryId: string | null,
    amount: number,
  ) => void
  autoAssignTargets: (month: string) => void
  toggleTargetSnooze: (month: string, categoryId: string) => void
  addTransaction: (transaction: Omit<Transaction, 'id'>) => void
  updateTransaction: (transactionId: string, changes: Omit<Transaction, 'id'>) => void
  deleteTransaction: (transactionId: string) => void
  addCategory: (category: Omit<Category, 'id'>) => void
  updateCategory: (categoryId: string, changes: Omit<Category, 'id'>) => void
  archiveCategory: (categoryId: string) => void
  addGroup: (name: string) => void
  updateGroup: (groupId: string, changes: Partial<Omit<CategoryGroup, 'id'>>) => void
  addAccount: (account: Omit<Account, 'id'>, openingBalance: number) => void
  updateAccount: (accountId: string, changes: Partial<Omit<Account, 'id'>>) => void
  importState: (state: BudgetState) => void
  replaceState: (state: BudgetState) => void
  undo: () => void
  redo: () => void
}

export interface BudgetHistoryState {
  canUndo: boolean
  canRedo: boolean
  lastAction: { id: number; label: string } | null
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'
type HistoryEntry = { state: BudgetState; label: string }

const MAX_UNDO_STEPS = 60
const MAX_ALLOCATION_EVENTS = 500

const appendAllocationEvent = (
  state: BudgetState,
  month: string,
  kind: AllocationEventKind,
  label: string,
  changes: AllocationChange[],
): BudgetState => {
  const meaningful = changes.filter((change) => change.delta !== 0)
  if (meaningful.length === 0) return state
  return {
    ...state,
    allocationEvents: [
      ...state.allocationEvents,
      {
        id: uid('allocation'),
        createdAt: new Date().toISOString(),
        month,
        kind,
        label,
        changes: meaningful,
      },
    ].slice(-MAX_ALLOCATION_EVENTS),
  }
}

const assignmentChanges = (
  before: BudgetState,
  after: BudgetState,
  month: string,
  categoryIds: string[],
): AllocationChange[] => {
  const beforeAssignments = before.months[month]?.assignments ?? {}
  const afterAssignments = after.months[month]?.assignments ?? {}
  const changes: AllocationChange[] = categoryIds.map((categoryId) => {
    const previous = beforeAssignments[categoryId] ?? 0
    const next = afterAssignments[categoryId] ?? 0
    return { categoryId, delta: next - previous, before: previous, after: next }
  })

  const beforeRta = getReadyToAssign(before, month)
  const afterRta = getReadyToAssign(after, month)
  if (beforeRta !== afterRta) {
    changes.push({ categoryId: null, delta: afterRta - beforeRta, before: beforeRta, after: afterRta })
  }
  return changes.filter((change) => change.delta !== 0)
}

export const useBudgetStore = (
  initialState: BudgetState,
  onPersist?: (state: BudgetState) => Promise<void>,
): [BudgetState, BudgetActions, SaveStatus, BudgetHistoryState] => {
  const [state, setState] = useState<BudgetState>(initialState)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [historyRevision, setHistoryRevision] = useState(0)
  const [lastAction, setLastAction] = useState<BudgetHistoryState['lastAction']>(null)
  const firstRender = useRef(true)
  const saveQueue = useRef<Promise<void>>(Promise.resolve())
  const stateRef = useRef(initialState)
  const pastRef = useRef<HistoryEntry[]>([])
  const futureRef = useRef<HistoryEntry[]>([])
  const actionIdRef = useRef(0)

  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    if (!onPersist || firstRender.current) {
      firstRender.current = false
      return
    }

    setSaveStatus('saving')
    const timeout = window.setTimeout(() => {
      saveQueue.current = saveQueue.current
        .catch(() => undefined)
        .then(() => onPersist(state))
        .then(() => setSaveStatus('saved'))
        .catch(() => setSaveStatus('error'))
    }, 350)
    return () => window.clearTimeout(timeout)
  }, [state, onPersist])

  const announce = useCallback((label: string) => {
    actionIdRef.current += 1
    setLastAction({ id: actionIdRef.current, label })
  }, [])

  const commit = useCallback((label: string, updater: (current: BudgetState) => BudgetState) => {
    const current = stateRef.current
    const next = updater(current)
    if (next === current) return

    pastRef.current = [...pastRef.current.slice(-(MAX_UNDO_STEPS - 1)), { state: current, label }]
    futureRef.current = []
    stateRef.current = next
    setState(next)
    setHistoryRevision((value) => value + 1)
    announce(label)
  }, [announce])

  const setActiveMonth = useCallback((month: string) => {
    const current = stateRef.current
    if (current.activeMonth === month) return
    const next = { ...current, activeMonth: month }
    stateRef.current = next
    setState(next)
  }, [])

  const setAssignment = useCallback((month: string, categoryId: string, amount: number) => {
    const categoryName = stateRef.current.categories.find((category) => category.id === categoryId)?.name ?? 'category'
    commit(`Updated ${categoryName}`, (current) => {
      const previousMonth = current.months[month]
      const previousAmount = previousMonth?.assignments[categoryId] ?? 0
      const nextAmount = Math.round(amount)
      if (previousAmount === nextAmount) return current

      const next: BudgetState = {
        ...current,
        months: {
          ...current.months,
          [month]: {
            month,
            assignments: {
              ...(previousMonth?.assignments ?? {}),
              [categoryId]: nextAmount,
            },
          },
        },
      }
      return appendAllocationEvent(
        next,
        month,
        'assignment',
        `Set ${categoryName} to ${formatMoney(nextAmount, current.currency)}`,
        assignmentChanges(current, next, month, [categoryId]),
      )
    })
  }, [commit])

  const moveMoney = useCallback(
    (month: string, fromCategoryId: string | null, toCategoryId: string | null, amount: number) => {
      if (amount <= 0 || fromCategoryId === toCategoryId) return
      const current = stateRef.current
      const nameFor = (id: string | null) => id
        ? current.categories.find((category) => category.id === id)?.name ?? 'category'
        : 'Ready to Assign'
      const label = `Moved ${formatMoney(amount, current.currency)} from ${nameFor(fromCategoryId)} to ${nameFor(toCategoryId)}`

      commit(label, (stateBefore) => {
        const previousMonth = stateBefore.months[month]
        const assignments = { ...(previousMonth?.assignments ?? {}) }
        if (fromCategoryId) assignments[fromCategoryId] = (assignments[fromCategoryId] ?? 0) - amount
        if (toCategoryId) assignments[toCategoryId] = (assignments[toCategoryId] ?? 0) + amount
        const next: BudgetState = {
          ...stateBefore,
          months: {
            ...stateBefore.months,
            [month]: {
              month,
                assignments,
            },
          },
        }
        const categoryIds = [fromCategoryId, toCategoryId].filter((id): id is string => Boolean(id))
        return appendAllocationEvent(next, month, 'move', label, assignmentChanges(stateBefore, next, month, categoryIds))
      })
    },
    [commit],
  )

  const autoAssignTargets = useCallback((month: string) => {
    commit('Auto-assigned available money', (current) => {
      let remaining = Math.max(0, getReadyToAssign(current, month))
      if (remaining === 0) return current
      const previousMonth = current.months[month]
      const assignments = { ...(previousMonth?.assignments ?? {}) }
      const changedCategoryIds: string[] = []

      for (const category of current.categories.filter((item) => !item.hidden)) {
        const needed = getCategorySummary(current, category, month).target?.leftToAssign ?? 0
        const amount = Math.min(needed, remaining)
        if (amount > 0) {
          assignments[category.id] = (assignments[category.id] ?? 0) + amount
          changedCategoryIds.push(category.id)
          remaining -= amount
        }
        if (remaining === 0) break
      }

      if (changedCategoryIds.length === 0) return current
      const next: BudgetState = {
        ...current,
        months: {
          ...current.months,
          [month]: {
            month,
            assignments,
          },
        },
      }
      return appendAllocationEvent(
        next,
        month,
        'auto-assign',
        `Auto-assigned ${changedCategoryIds.length} categor${changedCategoryIds.length === 1 ? 'y' : 'ies'}`,
        assignmentChanges(current, next, month, changedCategoryIds),
      )
    })
  }, [commit])

  const toggleTargetSnooze = useCallback((month: string, categoryId: string) => {
    const name = stateRef.current.categories.find((category) => category.id === categoryId)?.name ?? 'category'
    commit(`Changed ${name} target snooze`, (current) => ({
      ...current,
      categories: current.categories.map((category) => {
        if (category.id !== categoryId || !category.target) return category
        const months = new Set(category.target.snoozedMonths ?? [])
        if (months.has(month)) months.delete(month)
        else months.add(month)
        return {
          ...category,
          target: {
            ...category.target,
            ...(months.size > 0 ? { snoozedMonths: [...months].sort() } : { snoozedMonths: undefined }),
          },
        }
      }),
    }))
  }, [commit])

  const addTransaction = useCallback((transaction: Omit<Transaction, 'id'>) => {
    commit(`Added ${transaction.payee || 'transaction'}`, (current) => ({
      ...current,
      transactions: [...current.transactions, { ...transaction, id: uid('transaction') }],
    }))
  }, [commit])

  const updateTransaction = useCallback((transactionId: string, changes: Omit<Transaction, 'id'>) => {
    commit(`Updated ${changes.payee || 'transaction'}`, (current) => ({
      ...current,
      transactions: current.transactions.map((transaction) =>
        transaction.id === transactionId ? { id: transactionId, ...changes } : transaction,
      ),
    }))
  }, [commit])

  const deleteTransaction = useCallback((transactionId: string) => {
    const payee = stateRef.current.transactions.find((transaction) => transaction.id === transactionId)?.payee || 'transaction'
    commit(`Deleted ${payee}`, (current) => ({
      ...current,
      transactions: current.transactions.filter((transaction) => transaction.id !== transactionId),
    }))
  }, [commit])

  const addCategory = useCallback((category: Omit<Category, 'id'>) => {
    commit(`Added ${category.name}`, (current) => ({
      ...current,
      categories: [...current.categories, { ...category, id: uid('category') }],
    }))
  }, [commit])

  const updateCategory = useCallback((categoryId: string, changes: Omit<Category, 'id'>) => {
    commit(`Updated ${changes.name}`, (current) => ({
      ...current,
      categories: current.categories.map((category) =>
        category.id === categoryId ? { id: categoryId, ...changes } : category,
      ),
    }))
  }, [commit])

  const archiveCategory = useCallback((categoryId: string) => {
    const name = stateRef.current.categories.find((category) => category.id === categoryId)?.name ?? 'category'
    commit(`Archived ${name}`, (current) => ({
      ...current,
      categories: current.categories.map((category) =>
        category.id === categoryId ? { ...category, hidden: true } : category,
      ),
    }))
  }, [commit])

  const addGroup = useCallback((name: string) => {
    commit(`Added ${name} group`, (current) => ({
      ...current,
      groups: [...current.groups, { id: uid('group'), name }],
    }))
  }, [commit])

  const updateGroup = useCallback((groupId: string, changes: Partial<Omit<CategoryGroup, 'id'>>) => {
    commit('Updated category group', (current) => ({
      ...current,
      groups: current.groups.map((group) =>
        group.id === groupId ? { ...group, ...changes } : group,
      ),
    }))
  }, [commit])

  const addAccount = useCallback((account: Omit<Account, 'id'>, openingBalance: number) => {
    commit(`Added ${account.name}`, (current) => {
      const id = uid('account')
      const openingTransaction: Transaction | null = openingBalance === 0
        ? null
        : {
            id: uid('transaction'),
            accountId: id,
            date: new Date().toISOString().slice(0, 10),
            payee: 'Opening balance',
            categoryId: null,
            amount: openingBalance,
          }

      return {
        ...current,
        accounts: [...current.accounts, { ...account, id }],
        transactions: openingTransaction
          ? [...current.transactions, openingTransaction]
          : current.transactions,
      }
    })
  }, [commit])

  const updateAccount = useCallback((accountId: string, changes: Partial<Omit<Account, 'id'>>) => {
    commit(`Updated ${changes.name ?? 'account'}`, (current) => ({
      ...current,
      accounts: current.accounts.map((account) =>
        account.id === accountId ? { ...account, ...changes } : account,
      ),
    }))
  }, [commit])

  const importState = useCallback((next: BudgetState) => commit('Imported a budget', () => next), [commit])
  const replaceState = useCallback((next: BudgetState) => commit('Reset the budget', () => next), [commit])

  const undo = useCallback(() => {
    const entry = pastRef.current.at(-1)
    if (!entry) return
    const current = stateRef.current
    pastRef.current = pastRef.current.slice(0, -1)
    futureRef.current = [{ state: current, label: entry.label }, ...futureRef.current].slice(0, MAX_UNDO_STEPS)
    stateRef.current = entry.state
    setState(entry.state)
    setHistoryRevision((value) => value + 1)
    announce(`Undid ${entry.label}`)
  }, [announce])

  const redo = useCallback(() => {
    const entry = futureRef.current[0]
    if (!entry) return
    const current = stateRef.current
    futureRef.current = futureRef.current.slice(1)
    pastRef.current = [...pastRef.current.slice(-(MAX_UNDO_STEPS - 1)), { state: current, label: entry.label }]
    stateRef.current = entry.state
    setState(entry.state)
    setHistoryRevision((value) => value + 1)
    announce(`Redid ${entry.label}`)
  }, [announce])

  const actions = useMemo<BudgetActions>(() => ({
    setActiveMonth,
    setAssignment,
    moveMoney,
    autoAssignTargets,
    toggleTargetSnooze,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    addCategory,
    updateCategory,
    archiveCategory,
    addGroup,
    updateGroup,
    addAccount,
    updateAccount,
    importState,
    replaceState,
    undo,
    redo,
  }), [
    setActiveMonth,
    setAssignment,
    moveMoney,
    autoAssignTargets,
    toggleTargetSnooze,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    addCategory,
    updateCategory,
    archiveCategory,
    addGroup,
    updateGroup,
    addAccount,
    updateAccount,
    importState,
    replaceState,
    undo,
    redo,
  ])

  const history = useMemo<BudgetHistoryState>(() => ({
    canUndo: pastRef.current.length > 0,
    canRedo: futureRef.current.length > 0,
    lastAction,
  }), [historyRevision, lastAction])

  return [state, actions, saveStatus, history]
}
