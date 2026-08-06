import {
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  type BudgetState,
  type Category,
  formatMoney,
  getAccountBalance,
  getBudgetBalance,
  getCategorySummary,
  getReadyToAssign,
  getRecentTransactions,
  monthLabel,
  parseMoney,
  shiftMonth,
} from './domain'
import { useBudgetStore } from './store'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

type View = 'plan' | 'accounts'

const Icon = ({ children, size = 18 }: { children: ReactNode; size?: number }) => (
  <svg
    aria-hidden="true"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {children}
  </svg>
)

const PlanIcon = () => (
  <Icon>
    <path d="M4 5.5h16M4 12h16M4 18.5h16" />
    <path d="M8 3v5M15 9.5v5M11 16v5" />
  </Icon>
)

const AccountIcon = () => (
  <Icon>
    <path d="M3.5 9.5 12 4l8.5 5.5" />
    <path d="M5 10.5h14v8H5zM8 13.5h2M14 13.5h2" />
  </Icon>
)

const PlusIcon = () => (
  <Icon>
    <path d="M12 5v14M5 12h14" />
  </Icon>
)

const DownloadIcon = () => (
  <Icon>
    <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
  </Icon>
)

const UploadIcon = () => (
  <Icon>
    <path d="M12 21V9M7 14l5-5 5 5M5 3h14" />
  </Icon>
)

const InstallIcon = () => (
  <Icon>
    <rect x="5" y="3" width="14" height="18" rx="2" />
    <path d="M9 7h6M12 10v6M9.5 13.5 12 16l2.5-2.5" />
  </Icon>
)

const ChevronIcon = ({ direction }: { direction: 'left' | 'right' }) => (
  <Icon size={16}>
    <path d={direction === 'left' ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6'} />
  </Icon>
)

const RubyMark = () => (
  <div className="ruby-mark" aria-hidden="true">
    <span />
  </div>
)

const MoneyInput = ({
  value,
  onCommit,
  ariaLabel,
}: {
  value: number
  onCommit: (value: number) => void
  ariaLabel: string
}) => {
  const [draft, setDraft] = useState((value / 100).toFixed(2))

  useEffect(() => setDraft((value / 100).toFixed(2)), [value])

  const commit = () => {
    const parsed = parseMoney(draft)
    setDraft((parsed / 100).toFixed(2))
    onCommit(parsed)
  }

  return (
    <input
      className="money-input"
      aria-label={ariaLabel}
      inputMode="decimal"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
      }}
    />
  )
}

const StatusDot = ({ status }: { status: 'healthy' | 'underfunded' | 'overspent' }) => (
  <span className={`status-dot ${status}`} aria-label={status} />
)

const EmptyState = ({ title, detail }: { title: string; detail: string }) => (
  <div className="empty-state">
    <div className="empty-gem"><RubyMark /></div>
    <h3>{title}</h3>
    <p>{detail}</p>
  </div>
)

function App() {
  const [state, actions] = useBudgetStore()
  const [view, setView] = useState<View>('plan')
  const [selectedAccountId, setSelectedAccountId] = useState<string | undefined>()
  const [transactionOpen, setTransactionOpen] = useState(false)
  const [categoryGroupId, setCategoryGroupId] = useState<string | null>(null)
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const importInputRef = useRef<HTMLInputElement>(null)

  const readyToAssign = useMemo(
    () => getReadyToAssign(state, state.activeMonth),
    [state],
  )

  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall)
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (target?.matches('input, textarea, select, button')) return
      if (event.key.toLowerCase() === 'n') setTransactionOpen(true)
      if (event.key.toLowerCase() === 'p') setView('plan')
      if (event.key.toLowerCase() === 'a') setView('accounts')
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const selectAccount = (accountId?: string) => {
    setSelectedAccountId(accountId)
    setView('accounts')
  }

  const exportData = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `rubies-budget-${new Date().toISOString().slice(0, 10)}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const importData = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const parsed = JSON.parse(await file.text()) as BudgetState
      actions.importState(parsed)
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Could not import this Rubies file.')
    } finally {
      event.target.value = ''
    }
  }

  const install = async () => {
    if (!installPrompt) return
    await installPrompt.prompt()
    await installPrompt.userChoice
    setInstallPrompt(null)
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <RubyMark />
          <div>
            <strong>Rubies</strong>
            <span>Budget workspace</span>
          </div>
        </div>

        <nav className="primary-nav" aria-label="Main navigation">
          <button className={view === 'plan' ? 'active' : ''} onClick={() => setView('plan')}>
            <PlanIcon />
            <span>Plan</span>
            <kbd>P</kbd>
          </button>
          <button
            className={view === 'accounts' && !selectedAccountId ? 'active' : ''}
            onClick={() => selectAccount(undefined)}
          >
            <AccountIcon />
            <span>All accounts</span>
            <kbd>A</kbd>
          </button>
        </nav>

        <div className="sidebar-section">
          <div className="section-heading">
            <span>Budget accounts</span>
            <span>{formatMoney(getBudgetBalance(state), state.currency)}</span>
          </div>
          <div className="account-list">
            {state.accounts.filter((account) => account.onBudget).map((account) => (
              <button
                key={account.id}
                className={selectedAccountId === account.id && view === 'accounts' ? 'active' : ''}
                onClick={() => selectAccount(account.id)}
              >
                <span className="account-name"><span className="account-dot" />{account.name}</span>
                <span>{formatMoney(getAccountBalance(state, account.id), state.currency)}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="sidebar-footer">
          {installPrompt && (
            <button onClick={install}><InstallIcon /><span>Install Rubies</span></button>
          )}
          <button onClick={exportData}><DownloadIcon /><span>Export data</span></button>
          <button onClick={() => importInputRef.current?.click()}><UploadIcon /><span>Import data</span></button>
          <input ref={importInputRef} type="file" accept="application/json" hidden onChange={importData} />
        </div>
      </aside>

      <main className="workspace">
        {view === 'plan' ? (
          <PlanView
            state={state}
            readyToAssign={readyToAssign}
            onMonthChange={actions.setActiveMonth}
            onAssignmentChange={actions.setAssignment}
            onAddCategory={setCategoryGroupId}
            onNewTransaction={() => setTransactionOpen(true)}
          />
        ) : (
          <AccountsView
            state={state}
            selectedAccountId={selectedAccountId}
            onSelectAccount={setSelectedAccountId}
            onNewTransaction={() => setTransactionOpen(true)}
          />
        )}
      </main>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        <button className={view === 'plan' ? 'active' : ''} onClick={() => setView('plan')}>
          <PlanIcon /><span>Plan</span>
        </button>
        <button className={view === 'accounts' ? 'active' : ''} onClick={() => selectAccount(undefined)}>
          <AccountIcon /><span>Accounts</span>
        </button>
        <button className="mobile-add" onClick={() => setTransactionOpen(true)}>
          <PlusIcon /><span>New</span>
        </button>
      </nav>

      {transactionOpen && (
        <TransactionDialog
          state={state}
          selectedAccountId={selectedAccountId}
          onClose={() => setTransactionOpen(false)}
          onSubmit={(transaction) => {
            actions.addTransaction(transaction)
            setTransactionOpen(false)
          }}
        />
      )}

      {categoryGroupId && (
        <CategoryDialog
          state={state}
          groupId={categoryGroupId}
          onClose={() => setCategoryGroupId(null)}
          onSubmit={(category) => {
            actions.addCategory(category)
            setCategoryGroupId(null)
          }}
        />
      )}
    </div>
  )
}

const PlanView = ({
  state,
  readyToAssign,
  onMonthChange,
  onAssignmentChange,
  onAddCategory,
  onNewTransaction,
}: {
  state: BudgetState
  readyToAssign: number
  onMonthChange: (month: string) => void
  onAssignmentChange: (month: string, categoryId: string, amount: number) => void
  onAddCategory: (groupId: string) => void
  onNewTransaction: () => void
}) => {
  const totalAssigned = state.categories.reduce(
    (sum, category) => sum + getCategorySummary(state, category, state.activeMonth).assigned,
    0,
  )
  const totalActivity = state.categories.reduce(
    (sum, category) => sum + getCategorySummary(state, category, state.activeMonth).activity,
    0,
  )
  const totalAvailable = state.categories.reduce(
    (sum, category) => sum + getCategorySummary(state, category, state.activeMonth).available,
    0,
  )

  return (
    <>
      <header className="workspace-header">
        <div>
          <span className="eyebrow">Zero-based plan</span>
          <div className="month-switcher">
            <button aria-label="Previous month" onClick={() => onMonthChange(shiftMonth(state.activeMonth, -1))}>
              <ChevronIcon direction="left" />
            </button>
            <h1>{monthLabel(state.activeMonth)}</h1>
            <button aria-label="Next month" onClick={() => onMonthChange(shiftMonth(state.activeMonth, 1))}>
              <ChevronIcon direction="right" />
            </button>
          </div>
        </div>
        <div className={`ready-card ${readyToAssign < 0 ? 'negative' : ''}`}>
          <span>Ready to assign</span>
          <strong>{formatMoney(readyToAssign, state.currency)}</strong>
          <small>{readyToAssign === 0 ? 'Every available dollar has a job.' : readyToAssign > 0 ? 'Give this money a job.' : 'Move money to cover the gap.'}</small>
        </div>
      </header>

      <div className="toolbar">
        <button className="primary-button" onClick={onNewTransaction}><PlusIcon />New transaction <kbd>N</kbd></button>
        <div className="legend">
          <span><StatusDot status="healthy" />Funded</span>
          <span><StatusDot status="underfunded" />Needs attention</span>
          <span><StatusDot status="overspent" />Overspent</span>
        </div>
      </div>

      <section className="budget-panel">
        <div className="budget-grid budget-grid-header">
          <div>Category</div>
          <div>Assigned</div>
          <div>Activity</div>
          <div>Available</div>
        </div>

        {state.groups.map((group) => {
          const categories = state.categories.filter((category) => category.groupId === group.id)
          return (
            <div className="category-group" key={group.id}>
              <div className="group-row">
                <strong>{group.name}</strong>
                <button onClick={() => onAddCategory(group.id)}><PlusIcon /> Add category</button>
              </div>
              {categories.map((category) => {
                const summary = getCategorySummary(state, category, state.activeMonth)
                return (
                  <div className="budget-grid category-row" key={category.id}>
                    <div className="category-cell">
                      <StatusDot status={summary.status} />
                      <span>
                        <strong>{category.name}</strong>
                        {category.target ? <small>Target {formatMoney(category.target, state.currency)}</small> : null}
                      </span>
                    </div>
                    <div>
                      <MoneyInput
                        value={summary.assigned}
                        ariaLabel={`Assigned to ${category.name}`}
                        onCommit={(amount) => onAssignmentChange(state.activeMonth, category.id, amount)}
                      />
                    </div>
                    <div className={summary.activity < 0 ? 'negative-money' : ''}>
                      {formatMoney(summary.activity, state.currency)}
                    </div>
                    <div>
                      <span className={`available-pill ${summary.status}`}>
                        {formatMoney(summary.available, state.currency)}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })}

        <div className="budget-grid totals-row">
          <div>Plan totals</div>
          <div>{formatMoney(totalAssigned, state.currency)}</div>
          <div>{formatMoney(totalActivity, state.currency)}</div>
          <div>{formatMoney(totalAvailable, state.currency)}</div>
        </div>
      </section>
    </>
  )
}

const AccountsView = ({
  state,
  selectedAccountId,
  onSelectAccount,
  onNewTransaction,
}: {
  state: BudgetState
  selectedAccountId?: string
  onSelectAccount: (accountId?: string) => void
  onNewTransaction: () => void
}) => {
  const selectedAccount = state.accounts.find((account) => account.id === selectedAccountId)
  const transactions = getRecentTransactions(state, selectedAccountId)

  return (
    <>
      <header className="workspace-header accounts-header">
        <div>
          <span className="eyebrow">Account register</span>
          <h1>{selectedAccount?.name ?? 'All accounts'}</h1>
          <p>{selectedAccount ? formatMoney(getAccountBalance(state, selectedAccount.id), state.currency) : `${state.accounts.length} connected ledgers`}</p>
        </div>
        <button className="primary-button" onClick={onNewTransaction}><PlusIcon />New transaction <kbd>N</kbd></button>
      </header>

      <div className="account-chips" aria-label="Account filter">
        <button className={!selectedAccountId ? 'active' : ''} onClick={() => onSelectAccount(undefined)}>All</button>
        {state.accounts.map((account) => (
          <button
            key={account.id}
            className={selectedAccountId === account.id ? 'active' : ''}
            onClick={() => onSelectAccount(account.id)}
          >
            {account.name}
          </button>
        ))}
      </div>

      <section className="register-panel">
        {transactions.length === 0 ? (
          <EmptyState title="No transactions yet" detail="Add an inflow or expense to begin building this account register." />
        ) : (
          <div className="transaction-list">
            {transactions.map((transaction) => {
              const account = state.accounts.find((item) => item.id === transaction.accountId)
              const category = state.categories.find((item) => item.id === transaction.categoryId)
              return (
                <article className="transaction-row" key={transaction.id}>
                  <div className={`transaction-icon ${transaction.amount >= 0 ? 'inflow' : 'outflow'}`}>
                    {transaction.amount >= 0 ? '↙' : '↗'}
                  </div>
                  <div className="transaction-main">
                    <strong>{transaction.payee}</strong>
                    <span>{category?.name ?? 'Ready to assign'} · {account?.name}</span>
                    {transaction.memo && <small>{transaction.memo}</small>}
                  </div>
                  <time>{new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(`${transaction.date}T12:00:00`))}</time>
                  <div className={`transaction-amount ${transaction.amount >= 0 ? 'positive' : ''}`}>
                    {formatMoney(transaction.amount, state.currency)}
                    <small>{transaction.cleared ? 'Cleared' : 'Uncleared'}</small>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </>
  )
}

const DialogFrame = ({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string
  subtitle: string
  onClose: () => void
  children: ReactNode
}) => {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.currentTarget === event.target) onClose()
    }}>
      <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
        <header>
          <div>
            <span className="eyebrow">Rubies workspace</span>
            <h2 id="dialog-title">{title}</h2>
            <p>{subtitle}</p>
          </div>
          <button className="close-button" aria-label="Close" onClick={onClose}>×</button>
        </header>
        {children}
      </section>
    </div>
  )
}

const TransactionDialog = ({
  state,
  selectedAccountId,
  onClose,
  onSubmit,
}: {
  state: BudgetState
  selectedAccountId?: string
  onClose: () => void
  onSubmit: (transaction: {
    accountId: string
    date: string
    payee: string
    memo: string
    categoryId: string | null
    amount: number
    cleared: boolean
  }) => void
}) => {
  const [kind, setKind] = useState<'expense' | 'income'>('expense')
  const [accountId, setAccountId] = useState(selectedAccountId ?? state.accounts[0]?.id ?? '')
  const [categoryId, setCategoryId] = useState(state.categories[0]?.id ?? '')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [payee, setPayee] = useState('')
  const [memo, setMemo] = useState('')
  const [amount, setAmount] = useState('')
  const [cleared, setCleared] = useState(false)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const parsed = Math.abs(parseMoney(amount))
    if (!accountId || !payee.trim() || parsed === 0) return
    onSubmit({
      accountId,
      date,
      payee: payee.trim(),
      memo: memo.trim(),
      categoryId: kind === 'income' ? null : categoryId,
      amount: kind === 'income' ? parsed : -parsed,
      cleared,
    })
  }

  return (
    <DialogFrame title="New transaction" subtitle="Record money exactly where it moved." onClose={onClose}>
      <form onSubmit={submit}>
        <div className="segmented-control">
          <button type="button" className={kind === 'expense' ? 'active' : ''} onClick={() => setKind('expense')}>Expense</button>
          <button type="button" className={kind === 'income' ? 'active' : ''} onClick={() => setKind('income')}>Income</button>
        </div>
        <div className="form-grid">
          <label>
            Account
            <select value={accountId} onChange={(event) => setAccountId(event.target.value)} required>
              {state.accounts.map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}
            </select>
          </label>
          <label>
            Date
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
          </label>
          <label className="span-two">
            Payee
            <input value={payee} onChange={(event) => setPayee(event.target.value)} placeholder={kind === 'expense' ? 'Who did you pay?' : 'Where did it come from?'} autoFocus required />
          </label>
          {kind === 'expense' && (
            <label className="span-two">
              Category
              <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} required>
                {state.groups.map((group) => (
                  <optgroup label={group.name} key={group.id}>
                    {state.categories.filter((category) => category.groupId === group.id).map((category) => (
                      <option value={category.id} key={category.id}>{category.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
          )}
          <label>
            Amount
            <input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" required />
          </label>
          <label>
            Status
            <select value={cleared ? 'cleared' : 'uncleared'} onChange={(event) => setCleared(event.target.value === 'cleared')}>
              <option value="uncleared">Uncleared</option>
              <option value="cleared">Cleared</option>
            </select>
          </label>
          <label className="span-two">
            Memo <span className="optional">Optional</span>
            <input value={memo} onChange={(event) => setMemo(event.target.value)} placeholder="A useful note for future you" />
          </label>
        </div>
        <footer className="dialog-actions">
          <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary-button">Save transaction</button>
        </footer>
      </form>
    </DialogFrame>
  )
}

const CategoryDialog = ({
  state,
  groupId,
  onClose,
  onSubmit,
}: {
  state: BudgetState
  groupId: string
  onClose: () => void
  onSubmit: (category: Omit<Category, 'id'>) => void
}) => {
  const [name, setName] = useState('')
  const [target, setTarget] = useState('')
  const group = state.groups.find((item) => item.id === groupId)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return
    const targetAmount = parseMoney(target)
    onSubmit({ groupId, name: name.trim(), ...(targetAmount > 0 ? { target: targetAmount } : {}) })
  }

  return (
    <DialogFrame title="Add category" subtitle={`Create another envelope in ${group?.name ?? 'this group'}.`} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="form-grid single-column">
          <label>
            Category name
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Gifts" autoFocus required />
          </label>
          <label>
            Monthly target <span className="optional">Optional</span>
            <input inputMode="decimal" value={target} onChange={(event) => setTarget(event.target.value)} placeholder="0.00" />
          </label>
        </div>
        <footer className="dialog-actions">
          <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary-button">Add category</button>
        </footer>
      </form>
    </DialogFrame>
  )
}

export default App
