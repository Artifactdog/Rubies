import { useCallback, useEffect, useState } from 'react'
import type { BudgetState, Category, Transaction } from './domain'
import { createSeedState, uid } from './domain'

const STORAGE_KEY = 'rubies-budget-state-v1'

const loadState = (): BudgetState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return createSeedState()
    const parsed = JSON.parse(raw) as BudgetState
    if (parsed.version !== 1) return createSeedState()
    return parsed
  } catch {
    return createSeedState()
  }
}

export interface BudgetActions {
  setActiveMonth: (month: string) => void
  setAssignment: (month: string, categoryId: string, amount: number) => void
  addTransaction: (transaction: Omit<Transaction, 'id'>) => void
  addCategory: (category: Omit<Category, 'id'>) => void
  importState: (state: BudgetState) => void
  reset: () => void
}

export const useBudgetStore = (): [BudgetState, BudgetActions] => {
  const [state, setState] = useState<BudgetState>(loadState)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  const setActiveMonth = useCallback((month: string) => {
    setState((current) => ({ ...current, activeMonth: month }))
  }, [])

  const setAssignment = useCallback((month: string, categoryId: string, amount: number) => {
    setState((current) => ({
      ...current,
      months: {
        ...current.months,
        [month]: {
          month,
          assignments: {
            ...(current.months[month]?.assignments ?? {}),
            [categoryId]: amount,
          },
        },
      },
    }))
  }, [])

  const addTransaction = useCallback((transaction: Omit<Transaction, 'id'>) => {
    setState((current) => ({
      ...current,
      transactions: [...current.transactions, { ...transaction, id: uid('transaction') }],
    }))
  }, [])

  const addCategory = useCallback((category: Omit<Category, 'id'>) => {
    setState((current) => ({
      ...current,
      categories: [...current.categories, { ...category, id: uid('category') }],
    }))
  }, [])

  const importState = useCallback((next: BudgetState) => {
    if (next.version !== 1) throw new Error('Unsupported Rubies data version')
    setState(next)
  }, [])

  const reset = useCallback(() => setState(createSeedState()), [])

  return [
    state,
    { setActiveMonth, setAssignment, addTransaction, addCategory, importState, reset },
  ]
}
