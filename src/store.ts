import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  Account,
  BudgetState,
  Category,
  CategoryGroup,
  Transaction,
} from './domain'
import { getCategorySummary, getReadyToAssign, uid } from './domain'

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
}

export const useBudgetStore = (
  initialState: BudgetState,
  onPersist?: (state: BudgetState) => Promise<void>,
): [BudgetState, BudgetActions, 'idle' | 'saving' | 'saved' | 'error'] => {
  const [state, setState] = useState<BudgetState>(initialState)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const firstRender = useRef(true)
  const saveQueue = useRef<Promise<void>>(Promise.resolve())

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

  const setActiveMonth = useCallback((month: string) => {
    setState((current) => ({ ...current, activeMonth: month }))
  }, [])

  const setAssignment = useCallback((month: string, categoryId: string, amount: number) => {
    setState((current) => {
      const previousMonth = current.months[month]
      return {
        ...current,
        months: {
          ...current.months,
          [month]: {
            month,
            ...(previousMonth?.note ? { note: previousMonth.note } : {}),
            assignments: {
              ...(previousMonth?.assignments ?? {}),
              [categoryId]: Math.round(amount),
            },
          },
        },
      }
    })
  }, [])

  const moveMoney = useCallback(
    (month: string, fromCategoryId: string | null, toCategoryId: string | null, amount: number) => {
      if (amount <= 0 || fromCategoryId === toCategoryId) return
      setState((current) => {
        const previousMonth = current.months[month]
        const assignments = { ...(previousMonth?.assignments ?? {}) }
        if (fromCategoryId) assignments[fromCategoryId] = (assignments[fromCategoryId] ?? 0) - amount
        if (toCategoryId) assignments[toCategoryId] = (assignments[toCategoryId] ?? 0) + amount
        return {
          ...current,
          months: {
            ...current.months,
            [month]: {
              month,
              ...(previousMonth?.note ? { note: previousMonth.note } : {}),
              assignments,
            },
          },
        }
      })
    },
    [],
  )

  const autoAssignTargets = useCallback((month: string) => {
    setState((current) => {
      let remaining = Math.max(0, getReadyToAssign(current, month))
      if (remaining === 0) return current
      const previousMonth = current.months[month]
      const assignments = { ...(previousMonth?.assignments ?? {}) }

      for (const category of current.categories.filter((item) => !item.hidden)) {
        const needed = getCategorySummary(current, category, month).target?.leftToAssign ?? 0
        const amount = Math.min(needed, remaining)
        if (amount > 0) {
          assignments[category.id] = (assignments[category.id] ?? 0) + amount
          remaining -= amount
        }
        if (remaining === 0) break
      }

      return {
        ...current,
        months: {
          ...current.months,
          [month]: {
            month,
            ...(previousMonth?.note ? { note: previousMonth.note } : {}),
            assignments,
          },
        },
      }
    })
  }, [])

  const toggleTargetSnooze = useCallback((month: string, categoryId: string) => {
    setState((current) => ({
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
  }, [])

  const addTransaction = useCallback((transaction: Omit<Transaction, 'id'>) => {
    setState((current) => ({
      ...current,
      transactions: [...current.transactions, { ...transaction, id: uid('transaction') }],
    }))
  }, [])

  const updateTransaction = useCallback((transactionId: string, changes: Omit<Transaction, 'id'>) => {
    setState((current) => ({
      ...current,
      transactions: current.transactions.map((transaction) =>
        transaction.id === transactionId ? { id: transactionId, ...changes } : transaction,
      ),
    }))
  }, [])

  const deleteTransaction = useCallback((transactionId: string) => {
    setState((current) => ({
      ...current,
      transactions: current.transactions.filter((transaction) => transaction.id !== transactionId),
    }))
  }, [])

  const addCategory = useCallback((category: Omit<Category, 'id'>) => {
    setState((current) => ({
      ...current,
      categories: [...current.categories, { ...category, id: uid('category') }],
    }))
  }, [])

  const updateCategory = useCallback((categoryId: string, changes: Omit<Category, 'id'>) => {
    setState((current) => ({
      ...current,
      categories: current.categories.map((category) =>
        category.id === categoryId ? { id: categoryId, ...changes } : category,
      ),
    }))
  }, [])

  const archiveCategory = useCallback((categoryId: string) => {
    setState((current) => ({
      ...current,
      categories: current.categories.map((category) =>
        category.id === categoryId ? { ...category, hidden: true } : category,
      ),
    }))
  }, [])

  const addGroup = useCallback((name: string) => {
    setState((current) => ({
      ...current,
      groups: [...current.groups, { id: uid('group'), name }],
    }))
  }, [])

  const updateGroup = useCallback((groupId: string, changes: Partial<Omit<CategoryGroup, 'id'>>) => {
    setState((current) => ({
      ...current,
      groups: current.groups.map((group) =>
        group.id === groupId ? { ...group, ...changes } : group,
      ),
    }))
  }, [])

  const addAccount = useCallback((account: Omit<Account, 'id'>, openingBalance: number) => {
    setState((current) => {
      const id = uid('account')
      const openingTransaction: Transaction | null = openingBalance === 0
        ? null
        : {
            id: uid('transaction'),
            accountId: id,
            date: new Date().toISOString().slice(0, 10),
            payee: 'Opening balance',
            memo: '',
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
  }, [])

  const updateAccount = useCallback((accountId: string, changes: Partial<Omit<Account, 'id'>>) => {
    setState((current) => ({
      ...current,
      accounts: current.accounts.map((account) =>
        account.id === accountId ? { ...account, ...changes } : account,
      ),
    }))
  }, [])

  const importState = useCallback((next: BudgetState) => setState(next), [])
  const replaceState = useCallback((next: BudgetState) => setState(next), [])

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
  ])

  return [state, actions, saveStatus]
}
