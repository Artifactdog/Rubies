import {
  type ChangeEvent,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  type Account,
  type AllocationEvent,
  type BudgetState,
  type Category,
  type CategoryTarget,
  type Transaction,
  createDemoState,
  createEmptyState,
  currentMonthKey,
  formatMoney,
  getAccountBalance,
  getBudgetBalance,
  getCategorySummary,
  getMonthFundingSummary,
  getReadyToAssign,
  getRecentTransactions,
  monthEndDate,
  monthLabel,
  normalizeBudgetState,
  parseDateList,
  parseImportedBudget,
  parseMoney,
  shiftMonth,
  todayKey,
} from './domain'
import { useBudgetStore } from './store'
import { deleteVault, hasVault, openVault, saveVault } from './vault'
import { APP_VERSION } from './version'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

type View = 'plan' | 'accounts'

type Session =
  | { mode: 'protected'; state: BudgetState; password: string }
  | { mode: 'demo'; state: BudgetState }

type CategoryDialogState =
  | { mode: 'create'; groupId: string }
  | { mode: 'edit'; category: Category }
  | null

type TransactionDialogState = { transaction?: Transaction } | null

type MovePreset = { from?: string | null; to?: string | null }

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

const PlanIcon = () => <Icon><path d="M4 5.5h16M4 12h16M4 18.5h16"/><path d="M8 3v5M15 9.5v5M11 16v5"/></Icon>
const AccountIcon = () => <Icon><path d="M3.5 9.5 12 4l8.5 5.5"/><path d="M5 10.5h14v8H5zM8 13.5h2M14 13.5h2"/></Icon>
const PlusIcon = () => <Icon><path d="M12 5v14M5 12h14"/></Icon>
const MoveIcon = () => <Icon><path d="M7 7h11l-3-3M17 17H6l3 3"/><path d="M18 7l-3 3M6 17l3-3"/></Icon>
const TargetIcon = () => <Icon><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="m14 10 5-5"/></Icon>
const LockIcon = () => <Icon><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></Icon>
const SettingsIcon = () => <Icon><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.12-1.3l2-1.55-2-3.46-2.45 1A7 7 0 0 0 14.2 5.4L13.85 3h-4l-.35 2.4a7 7 0 0 0-2.23 1.29l-2.45-1-2 3.46 2 1.55A7 7 0 0 0 4.7 12c0 .45.04.88.12 1.3l-2 1.55 2 3.46 2.45-1A7 7 0 0 0 9.5 18.6l.35 2.4h4l.35-2.4a7 7 0 0 0 2.23-1.29l2.45 1 2-3.46-2-1.55c.08-.42.12-.85.12-1.3Z"/></Icon>
const DownloadIcon = () => <Icon><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></Icon>
const UploadIcon = () => <Icon><path d="M12 21V9M7 14l5-5 5 5M5 3h14"/></Icon>
const EditIcon = () => <Icon size={15}><path d="m4 20 4.5-1 10-10a2 2 0 0 0-3-3l-10 10L4 20Z"/><path d="m14 7 3 3"/></Icon>
const ChevronIcon = ({ direction }: { direction: 'left' | 'right' }) => (
  <Icon size={17}><path d={direction === 'left' ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6'}/></Icon>
)
const CalendarIcon = () => <Icon><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/></Icon>
const SnoozeIcon = () => <Icon><path d="M7 7h7l-7 7h7M15 4h5l-5 5h5"/></Icon>
const HistoryIcon = () => <Icon><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></Icon>
const UndoIcon = () => <Icon><path d="M9 7 4 12l5 5"/><path d="M5 12h8a6 6 0 0 1 6 6"/></Icon>
const KeyboardIcon = () => <Icon><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10h.01M11 10h.01M15 10h.01M7 14h7M17 14h.01"/></Icon>

const RubyMark = () => <div className="ruby-mark" aria-hidden="true"><span /></div>

const DialogFrame = ({
  title,
  subtitle,
  children,
  onClose,
  wide = false,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  onClose: () => void
  wide?: boolean
}) => (
  <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
    <section
      className={`dialog-card${wide ? ' dialog-wide' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <header className="dialog-header">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <button className="icon-button" onClick={onClose} aria-label="Close">×</button>
      </header>
      <div className="dialog-content">{children}</div>
    </section>
  </div>
)

const AccessGate = ({ onOpen }: { onOpen: (session: Session) => void }) => {
  const [existing, setExisting] = useState(hasVault())
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [budgetName, setBudgetName] = useState('My budget')
  const [currency, setCurrency] = useState('USD')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const unlock = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const state = await openVault(password)
      onOpen({ mode: 'protected', state, password })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not unlock the budget.')
    } finally {
      setBusy(false)
    }
  }

  const create = async (event: FormEvent) => {
    event.preventDefault()
    if (password.length < 8) {
      setError('Use at least 8 characters for the password.')
      return
    }
    if (password !== confirm) {
      setError('The passwords do not match.')
      return
    }

    setBusy(true)
    setError('')
    try {
      const state = createEmptyState()
      state.name = budgetName.trim() || 'My budget'
      state.currency = currency.trim().toUpperCase() || 'USD'
      await saveVault(state, password)
      onOpen({ mode: 'protected', state, password })
    } catch {
      setError('Could not create the encrypted local vault.')
    } finally {
      setBusy(false)
    }
  }

  const startOver = () => {
    if (!window.confirm('Delete the encrypted budget stored in this browser? This cannot be undone.')) return
    deleteVault()
    setExisting(false)
    setPassword('')
    setConfirm('')
    setError('')
  }

  return (
    <main className="access-shell">
      <section className="access-card">
        <div className="access-brand">
          <RubyMark />
          <div><strong>Rubies</strong><span>Private envelope budgeting</span></div>
        </div>

        {existing ? (
          <>
            <div className="access-copy">
              <span className="eyebrow">Protected local vault</span>
              <h1>Welcome back</h1>
              <p>Your budget is encrypted in this browser. Enter the password to unlock it.</p>
            </div>
            <form className="access-form" onSubmit={unlock}>
              <label>Password
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  autoFocus
                />
              </label>
              {error && <div className="form-error">{error}</div>}
              <button className="primary-button access-primary" disabled={busy || !password}>
                {busy ? 'Unlocking…' : 'Unlock budget'}
              </button>
            </form>
            <button className="text-button danger-text" onClick={startOver}>Delete local vault</button>
          </>
        ) : (
          <>
            <div className="access-copy">
              <span className="eyebrow">First run</span>
              <h1>Create your protected budget</h1>
              <p>Rubies encrypts your budget before saving it locally. There is no password recovery.</p>
            </div>
            <form className="access-form" onSubmit={create}>
              <label>Budget name
                <input value={budgetName} onChange={(event) => setBudgetName(event.target.value)} autoFocus />
              </label>
              <label>Currency code
                <input value={currency} onChange={(event) => setCurrency(event.target.value)} maxLength={3} />
              </label>
              <label>Password
                <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" />
              </label>
              <label>Confirm password
                <input type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="new-password" />
              </label>
              {error && <div className="form-error">{error}</div>}
              <button className="primary-button access-primary" disabled={busy}>
                {busy ? 'Creating…' : 'Create encrypted budget'}
              </button>
            </form>
          </>
        )}

        <div className="access-divider"><span>or</span></div>
        <button className="demo-button" onClick={() => onOpen({ mode: 'demo', state: createDemoState() })}>
          <span className="demo-icon">◆</span>
          <span><strong>Enter demo mode</strong><small>Try a complete sample budget without saving anything.</small></span>
        </button>
      </section>
    </main>
  )
}

const NormalizedMoneySlider = ({
  value,
  max,
  currency,
  onChange,
}: {
  value: number
  max: number
  currency: string
  onChange: (value: number) => void
}) => {
  const safeMax = Math.max(1, Math.round(max))
  const clamped = Math.max(0, Math.min(safeMax, value))
  const position = Math.round((clamped / safeMax) * 1000)
  const fill = `${position / 10}%`
  const moneyStep = safeMax >= 10_000_000
    ? 10_000
    : safeMax >= 1_000_000
      ? 1_000
      : safeMax >= 100_000
        ? 100
        : 1

  return (
    <div className="normalized-slider">
      <input
        className="money-slider"
        type="range"
        min="0"
        max="1000"
        step="1"
        value={position}
        onChange={(event) => {
          const raw = (Number(event.target.value) / 1000) * safeMax
          onChange(Math.round(raw / moneyStep) * moneyStep)
        }}
        style={{ '--slider-fill': fill } as CSSProperties}
        aria-label="Adjust amount with slider"
      />
      <div className="allocation-scale">
        <span>{formatMoney(0, currency)}</span>
        <span>{formatMoney(safeMax, currency)}</span>
      </div>
    </div>
  )
}

const AssignmentDialog = ({
  state,
  category,
  onClose,
  onSave,
}: {
  state: BudgetState
  category: Category
  onClose: () => void
  onSave: (amount: number) => void
}) => {
  const summary = getCategorySummary(state, category, state.activeMonth)
  const target = summary.target
  const [draft, setDraft] = useState(summary.assigned)
  const [text, setText] = useState((summary.assigned / 100).toFixed(2))
  const sliderMax = Math.max(
    100_000,
    Math.ceil(Math.max(
      Math.abs(summary.assigned),
      target?.requiredThisMonth ?? 0,
      summary.assigned + (target?.leftToAssign ?? 0),
    ) * 1.3 / 100) * 100,
  )

  const updateDraft = (amount: number) => {
    const rounded = Math.round(amount)
    setDraft(rounded)
    setText((rounded / 100).toFixed(2))
  }

  const parseText = () => {
    const parsed = parseMoney(text)
    setDraft(parsed)
    setText((parsed / 100).toFixed(2))
    return parsed
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    onSave(parseText())
  }

  return (
    <DialogFrame
      title={`Assign money · ${category.name}`}
      subtitle={`Changes apply to ${monthLabel(state.activeMonth)} only after you save.`}
      onClose={onClose}
    >
      <form onSubmit={submit} className="assignment-dialog-form">
        <div className="assignment-context">
          <div><span>Currently assigned</span><strong>{formatMoney(summary.assigned, state.currency)}</strong></div>
          <div><span>Required this month</span><strong>{formatMoney(target?.requiredThisMonth ?? 0, state.currency)}</strong></div>
          <div><span>Left to assign</span><strong>{formatMoney(target?.leftToAssign ?? 0, state.currency)}</strong></div>
        </div>
        <label className="standalone-label">New assigned amount
          <input
            inputMode="decimal"
            value={text}
            onChange={(event) => setText(event.target.value)}
            onBlur={parseText}
            onKeyDown={(event) => {
              if (event.key === 'Escape') onClose()
            }}
            autoFocus
          />
        </label>
        <NormalizedMoneySlider
          value={draft}
          max={sliderMax}
          currency={state.currency}
          onChange={updateDraft}
        />
        <div className="assignment-quick-actions">
          <button type="button" className="secondary-button compact" onClick={() => updateDraft(0)}>Clear</button>
          {target && target.leftToAssign > 0 && (
            <button type="button" className="secondary-button compact" onClick={() => updateDraft(summary.assigned + target.leftToAssign)}>
              Fund remaining {formatMoney(target.leftToAssign, state.currency)}
            </button>
          )}
        </div>
        <footer className="dialog-actions">
          <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary-button">Save assignment <kbd>Enter</kbd></button>
        </footer>
      </form>
    </DialogFrame>
  )
}

const CategoryRow = ({
  state,
  category,
  onEditAssignment,
  onEdit,
  onMove,
  onToggleSnooze,
  onOpenHistory,
}: {
  state: BudgetState
  category: Category
  onEditAssignment: () => void
  onEdit: () => void
  onMove: () => void
  onToggleSnooze: () => void
  onOpenHistory: () => void
}) => {
  const summary = getCategorySummary(state, category, state.activeMonth)
  const target = summary.target
  const progress = Math.round((target?.progress ?? 0) * 100)

  return (
    <article className={`category-row status-${summary.status}`}>
      <div className="category-identity">
        <button className="category-name" onClick={onEdit}>{category.name}</button>
        <p className="target-description">{target?.label ?? category.note ?? 'No target set'}</p>
        {target && (
          <div className="progress-wrap" aria-label={`${progress}% funded`}>
            <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
          </div>
        )}
      </div>

      <div className="target-compact-cell">
        {target ? (
          <>
            <span>Need {formatMoney(target.requiredThisMonth, state.currency)}</span>
            <strong className={target.leftToAssign > 0 ? 'warning-value' : 'good-value'}>
              {target.leftToAssign > 0 ? `${formatMoney(target.leftToAssign, state.currency)} left` : 'Funded'}
            </strong>
          </>
        ) : (
          <span className="muted-value">No target</span>
        )}
      </div>

      <button className="assigned-value-button" onClick={onEditAssignment} title="Edit assignment">
        <span>Assigned</span>
        <strong>{formatMoney(summary.assigned, state.currency)}</strong>
      </button>

      <div className="money-stat compact-stat">
        <span>Activity</span>
        <strong className={summary.activity < 0 ? 'negative-value' : summary.activity > 0 ? 'good-value' : ''}>
          {formatMoney(summary.activity, state.currency)}
        </strong>
      </div>

      <div className={`available-card compact-stat ${summary.available < 0 ? 'negative' : summary.status === 'underfunded' ? 'warning' : 'positive'}`}>
        <span>Available</span>
        <strong>{formatMoney(summary.available, state.currency)}</strong>
      </div>

      <div className="row-actions">
        <button className="mini-action" onClick={onOpenHistory} title="Allocation history"><HistoryIcon /></button>
        {target && (
          <button className={`mini-action${target.snoozed ? ' active' : ''}`} onClick={onToggleSnooze} title={target.snoozed ? 'Resume target' : 'Snooze target this month'}>
            <SnoozeIcon />
          </button>
        )}
        <button className="mini-action" onClick={onMove} title="Move money"><MoveIcon /></button>
        <button className="mini-action" onClick={onEdit} title="Edit category"><EditIcon /></button>
      </div>
    </article>
  )
}

const AllocationHistoryDialog = ({
  state,
  categoryId,
  onClose,
}: {
  state: BudgetState
  categoryId?: string
  onClose: () => void
}) => {
  const categoryById = new Map(state.categories.map((category) => [category.id, category.name]))
  const categoryName = categoryId ? categoryById.get(categoryId) : undefined
  const events = [...state.allocationEvents]
    .filter((event) => !categoryId || event.changes.some((change) => change.categoryId === categoryId))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))

  const changeName = (change: AllocationEvent['changes'][number]) =>
    change.categoryId ? categoryById.get(change.categoryId) ?? 'Archived category' : 'Ready to Assign'

  return (
    <DialogFrame
      title={categoryName ? `${categoryName} allocation history` : 'Allocation history'}
      subtitle={state.importSource?.kind === 'nynab'
        ? 'Rubies records exact new actions. Imported entries are month-level assignment snapshots because nYNAB does not export the original click-by-click allocation log.'
        : 'Every confirmed assignment, move, and auto-assign action is recorded here.'}
      onClose={onClose}
      wide
    >
      <div className="allocation-history-list">
        {events.map((event) => (
          <article className="allocation-history-event" key={event.id}>
            <header>
              <div><strong>{event.label}</strong><span>{monthLabel(event.month)}</span></div>
              <time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString()}</time>
            </header>
            <div className="allocation-change-list">
              {event.changes
                .filter((change) => !categoryId || change.categoryId === categoryId)
                .map((change, index) => (
                  <div className="allocation-change" key={`${event.id}-${index}`}>
                    <span>{changeName(change)}</span>
                    <strong className={change.delta > 0 ? 'good-value' : 'negative-value'}>
                      {change.delta > 0 ? '+' : ''}{formatMoney(change.delta, state.currency)}
                    </strong>
                    <small>{formatMoney(change.before, state.currency)} → {formatMoney(change.after, state.currency)}</small>
                  </div>
                ))}
            </div>
          </article>
        ))}
        {events.length === 0 && (
          <div className="empty-history">
            <HistoryIcon />
            <strong>No allocation changes yet</strong>
            <span>Confirmed assignments, money moves, and auto-assign actions will appear here.</span>
          </div>
        )}
      </div>
    </DialogFrame>
  )
}

const ShortcutsDialog = ({ onClose }: { onClose: () => void }) => (
  <DialogFrame title="Keyboard shortcuts" subtitle="Shortcuts only run when you are not typing in a field." onClose={onClose}>
    <div className="shortcut-list">
      <div><kbd>N</kbd><span>New transaction</span></div>
      <div><kbd>M</kbd><span>Move money</span></div>
      <div><kbd>T</kbd><span>Jump to this month</span></div>
      <div><kbd>P</kbd><span>Open Plan</span></div>
      <div><kbd>A</kbd><span>Open Accounts</span></div>
      <div><kbd>Ctrl/⌘ Z</kbd><span>Undo</span></div>
      <div><kbd>Ctrl/⌘ Shift Z</kbd><span>Redo</span></div>
      <div><kbd>?</kbd><span>Show this list</span></div>
    </div>
  </DialogFrame>
)

const PlanView = ({
  state,
  readyToAssign,
  collapsedGroups,
  onToggleGroup,
  onMonthChange,
  onEditAssignment,
  onEditCategory,
  onAddCategory,
  onEditGroup,
  onNewGroup,
  onNewTransaction,
  onMove,
  onAutoAssign,
  onToggleSnooze,
  onOpenHistory,
  onUndo,
  canUndo,
}: {
  state: BudgetState
  readyToAssign: number
  collapsedGroups: Set<string>
  onToggleGroup: (groupId: string) => void
  onMonthChange: (month: string) => void
  onEditAssignment: (category: Category) => void
  onEditCategory: (category: Category) => void
  onAddCategory: (groupId: string) => void
  onEditGroup: (groupId: string, name: string) => void
  onNewGroup: () => void
  onNewTransaction: () => void
  onMove: (preset?: MovePreset) => void
  onAutoAssign: () => void
  onToggleSnooze: (categoryId: string) => void
  onOpenHistory: (categoryId?: string) => void
  onUndo: () => void
  canUndo: boolean
}) => {
  const funding = getMonthFundingSummary(state, state.activeMonth)
  const todayMonth = currentMonthKey()
  const visibleGroups = state.groups.filter((group) => !group.hidden)

  return (
    <div className="view-shell">
      <header className="plan-header">
        <div>
          <span className="eyebrow">Budget plan</span>
          <div className="month-navigation">
            <button className="icon-button" onClick={() => onMonthChange(shiftMonth(state.activeMonth, -1))} aria-label="Previous month"><ChevronIcon direction="left" /></button>
            <h1>{monthLabel(state.activeMonth)}</h1>
            <button className="icon-button" onClick={() => onMonthChange(shiftMonth(state.activeMonth, 1))} aria-label="Next month"><ChevronIcon direction="right" /></button>
            <button
              className="today-button"
              onClick={() => onMonthChange(todayMonth)}
              disabled={state.activeMonth === todayMonth}
            >
              <CalendarIcon />Today <kbd>T</kbd>
            </button>
          </div>
          {state.activeMonth !== todayMonth && (
            <p className="month-context">
              Viewing {state.activeMonth < todayMonth ? 'a past' : 'a future'} month. Target recommendations are recalculated for this month.
            </p>
          )}
        </div>
        <div className="header-actions">
          <button className="secondary-button" onClick={onUndo} disabled={!canUndo}><UndoIcon />Undo <kbd>⌘Z</kbd></button>
          <button className="secondary-button" onClick={() => onOpenHistory()}><HistoryIcon />History</button>
          <button className="secondary-button" onClick={() => onMove()}><MoveIcon />Move money <kbd>M</kbd></button>
          <button className="secondary-button" onClick={onAutoAssign} disabled={readyToAssign <= 0 || funding.leftToAssign <= 0}><TargetIcon />Auto-assign</button>
          <button className="primary-button" onClick={onNewTransaction}><PlusIcon />Transaction <kbd>N</kbd></button>
        </div>
      </header>

      <section className="month-summary-grid">
        <button className={`summary-card rta-card${readyToAssign < 0 ? ' negative' : ''}`} onClick={() => onMove({ from: null })}>
          <span>Ready to assign</span>
          <strong>{formatMoney(readyToAssign, state.currency)}</strong>
          <small>{readyToAssign >= 0 ? 'Available to distribute' : 'Over-assigned through this month'}</small>
        </button>
        <div className="summary-card">
          <span>Targets this month</span>
          <strong>{formatMoney(funding.requiredThisMonth, state.currency)}</strong>
          <small>{funding.targetCount} active target{funding.targetCount === 1 ? '' : 's'}</small>
        </div>
        <div className="summary-card">
          <span>Assigned toward targets</span>
          <strong>{formatMoney(funding.assignedTowardTargets, state.currency)}</strong>
          <small>For {monthLabel(state.activeMonth)}</small>
        </div>
        <div className={`summary-card${funding.leftToAssign > 0 ? ' warning' : ' complete'}`}>
          <span>Still to assign</span>
          <strong>{formatMoney(funding.leftToAssign, state.currency)}</strong>
          <small>{funding.leftToAssign > 0 ? 'To meet this month’s plan' : 'This month is fully funded'}</small>
        </div>
      </section>

      <div className="budget-toolbar">
        <div>
          <strong>Categories</strong>
          <span>Click an Assigned value to edit it. Changes are saved only after confirmation.</span>
        </div>
        <button className="secondary-button" onClick={onNewGroup}><PlusIcon />Group</button>
      </div>

      <div className="budget-column-headings" aria-hidden="true">
        <span>Category</span><span>Target</span><span>Assigned</span><span>Activity</span><span>Available</span><span />
      </div>

      <div className="category-list">
        {visibleGroups.map((group) => {
          const categories = state.categories.filter((category) => category.groupId === group.id && !category.hidden)
          const collapsed = collapsedGroups.has(group.id)

          return (
            <section className="category-group" key={group.id}>
              <header className="group-row">
                <button className="group-name" onClick={() => onToggleGroup(group.id)}>
                  <span className={`group-chevron${collapsed ? ' collapsed' : ''}`}>⌄</span>
                  <strong>{group.name}</strong>
                  <small>{categories.length} categories</small>
                </button>
                <div className="group-actions">
                  <button className="mini-action" onClick={() => onEditGroup(group.id, group.name)} title="Rename group"><EditIcon /></button>
                  <button className="mini-action" onClick={() => onAddCategory(group.id)} title="Add category"><PlusIcon /></button>
                </div>
              </header>
              {!collapsed && (
                <div className="group-categories">
                  {categories.map((category) => (
                    <CategoryRow
                      key={category.id}
                      state={state}
                      category={category}
                      onEditAssignment={() => onEditAssignment(category)}
                      onEdit={() => onEditCategory(category)}
                      onMove={() => onMove({ from: category.id })}
                      onToggleSnooze={() => onToggleSnooze(category.id)}
                      onOpenHistory={() => onOpenHistory(category.id)}
                    />
                  ))}
                  {categories.length === 0 && (
                    <button className="empty-category" onClick={() => onAddCategory(group.id)}>
                      <PlusIcon />Add a category to {group.name}
                    </button>
                  )}
                </div>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}

const AccountsView = ({
  state,
  selectedAccountId,
  onSelectAccount,
  onNewAccount,
  onEditAccount,
  onNewTransaction,
  onEditTransaction,
}: {
  state: BudgetState
  selectedAccountId: string | undefined
  onSelectAccount: (accountId: string | undefined) => void
  onNewAccount: () => void
  onEditAccount: (account: Account) => void
  onNewTransaction: () => void
  onEditTransaction: (transaction: Transaction) => void
}) => {
  const transactions = getRecentTransactions(state, selectedAccountId)
  const categoryById = new Map(state.categories.map((category) => [category.id, category.name]))
  const accountById = new Map(state.accounts.map((account) => [account.id, account.name]))

  return (
    <div className="view-shell">
      <header className="accounts-header">
        <div>
          <span className="eyebrow">Money locations</span>
          <h1>Accounts</h1>
          <p>All accounts use the same simple model. No credit-card mode, tracking mode, or cleared state.</p>
        </div>
        <div className="header-actions">
          <button className="secondary-button" onClick={onNewAccount}><PlusIcon />Account</button>
          <button className="primary-button" onClick={onNewTransaction}><PlusIcon />Transaction <kbd>N</kbd></button>
        </div>
      </header>

      <section className="account-overview">
        <button className={`account-card total-card${selectedAccountId === undefined ? ' selected' : ''}`} onClick={() => onSelectAccount(undefined)}>
          <span>All accounts</span>
          <strong>{formatMoney(getBudgetBalance(state), state.currency)}</strong>
          <small>{state.accounts.filter((account) => !account.closed).length} open accounts</small>
        </button>
        {state.accounts.map((account) => (
          <button
            className={`account-card${selectedAccountId === account.id ? ' selected' : ''}${account.closed ? ' closed' : ''}`}
            onClick={() => onSelectAccount(account.id)}
            onDoubleClick={() => onEditAccount(account)}
            key={account.id}
          >
            <span>{account.name}</span>
            <strong>{formatMoney(getAccountBalance(state, account.id), state.currency)}</strong>
            <small>{account.closed ? 'Closed' : account.note || 'Open account'} · Double-click to edit</small>
          </button>
        ))}
      </section>

      <section className="transactions-panel">
        <header>
          <div>
            <h2>{selectedAccountId ? accountById.get(selectedAccountId) : 'All transactions'}</h2>
            <span>{transactions.length} transactions</span>
          </div>
          {selectedAccountId && (
            <button className="secondary-button compact" onClick={() => {
              const account = state.accounts.find((item) => item.id === selectedAccountId)
              if (account) onEditAccount(account)
            }}><EditIcon />Edit account</button>
          )}
        </header>
        <div className="transaction-table-wrap">
          <table className="transaction-table">
            <thead><tr><th>Date</th><th>Payee</th><th>Category</th><th>Account</th><th>Flow</th><th>Amount</th><th /></tr></thead>
            <tbody>
              {transactions.map((transaction) => (
                <tr className={transaction.amount < 0 ? 'expense-row' : 'income-row'} key={transaction.id}>
                  <td>{transaction.date}</td>
                  <td><strong>{transaction.payee}</strong>{transaction.memo && <small>{transaction.memo}</small>}</td>
                  <td>{transaction.categoryId ? categoryById.get(transaction.categoryId) ?? 'Archived category' : 'Ready to assign'}</td>
                  <td>{accountById.get(transaction.accountId)}</td>
                  <td><span className={`flow-badge ${transaction.amount < 0 ? 'expense' : 'income'}`}>{transaction.amount < 0 ? '↓ Expense' : '↑ Income'}</span></td>
                  <td><strong className={`transaction-amount ${transaction.amount < 0 ? 'negative-value' : 'good-value'}`}>{formatMoney(transaction.amount, state.currency)}</strong></td>
                  <td><button className="mini-action" onClick={() => onEditTransaction(transaction)} aria-label="Edit transaction"><EditIcon /></button></td>
                </tr>
              ))}
              {transactions.length === 0 && <tr><td colSpan={7} className="empty-table">No transactions yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

const TransactionDialog = ({
  state,
  transaction,
  selectedAccountId,
  onClose,
  onSubmit,
  onDelete,
}: {
  state: BudgetState
  transaction?: Transaction
  selectedAccountId?: string
  onClose: () => void
  onSubmit: (transaction: Omit<Transaction, 'id'>) => void
  onDelete?: () => void
}) => {
  const [kind, setKind] = useState<'expense' | 'income'>(transaction?.amount && transaction.amount > 0 ? 'income' : 'expense')
  const [accountId, setAccountId] = useState(transaction?.accountId ?? selectedAccountId ?? state.accounts.find((account) => !account.closed)?.id ?? '')
  const [date, setDate] = useState(transaction?.date ?? todayKey())
  const [payee, setPayee] = useState(transaction?.payee ?? '')
  const [categoryId, setCategoryId] = useState(transaction?.categoryId ?? state.categories.find((category) => !category.hidden)?.id ?? '')
  const [amount, setAmount] = useState(transaction ? (Math.abs(transaction.amount) / 100).toFixed(2) : '')
  const [memo, setMemo] = useState(transaction?.memo ?? '')
  const amountMinor = Math.abs(parseMoney(amount))
  const selectedCategory = state.categories.find((category) => category.id === categoryId)
  const categoryAvailable = kind === 'expense' && selectedCategory
    ? getCategorySummary(state, selectedCategory, state.activeMonth).available
    : 0
  const accountBalance = accountId ? getAccountBalance(state, accountId) : 0
  const sliderMax = Math.max(
    100_000,
    Math.ceil(Math.max(amountMinor, Math.max(0, categoryAvailable), Math.max(0, accountBalance)) * 1.25 / 100) * 100,
  )

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const parsed = amountMinor
    if (!accountId || !payee.trim() || parsed <= 0) return
    onSubmit({
      accountId,
      date,
      payee: payee.trim(),
      memo: memo.trim(),
      categoryId: kind === 'income' ? null : categoryId || null,
      amount: kind === 'income' ? parsed : -parsed,
    })
  }

  return (
    <DialogFrame title={transaction ? 'Edit transaction' : 'New transaction'} subtitle="Nothing changes until you save the transaction." onClose={onClose} wide>
      <form onSubmit={submit}>
        <div className="kind-toggle">
          <button type="button" className={kind === 'expense' ? 'active' : ''} onClick={() => setKind('expense')}>Expense</button>
          <button type="button" className={kind === 'income' ? 'active' : ''} onClick={() => setKind('income')}>Income</button>
        </div>
        <div className="form-grid">
          <label>Account
            <select value={accountId} onChange={(event) => setAccountId(event.target.value)} required>
              {state.accounts.filter((account) => !account.closed || account.id === accountId).map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}
            </select>
          </label>
          <label>Date<input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></label>
          <label className="span-two">Payee
            <input value={payee} onChange={(event) => setPayee(event.target.value)} placeholder={kind === 'expense' ? 'Who did you pay?' : 'Where did it come from?'} autoFocus required />
          </label>
          {kind === 'expense' && (
            <label className="span-two">Category
              <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} required>
                {state.groups.map((group) => (
                  <optgroup label={group.name} key={group.id}>
                    {state.categories.filter((category) => category.groupId === group.id && !category.hidden).map((category) => (
                      <option value={category.id} key={category.id}>{category.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
          )}
          <div className="transaction-amount-editor span-two">
            <label>Amount<input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" required /></label>
            <NormalizedMoneySlider
              value={amountMinor}
              max={sliderMax}
              currency={state.currency}
              onChange={(value) => setAmount((value / 100).toFixed(2))}
            />
          </div>
          <label className="span-two">Memo <span className="optional">Optional</span><input value={memo} onChange={(event) => setMemo(event.target.value)} /></label>
        </div>
        <footer className="dialog-actions split-actions">
          {onDelete ? <button type="button" className="danger-button" onClick={onDelete}>Delete</button> : <span />}
          <div><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button type="submit" className="primary-button" disabled={state.accounts.length === 0}>{transaction ? 'Save changes' : 'Save transaction'}</button></div>
        </footer>
      </form>
    </DialogFrame>
  )
}

const CategoryDialog = ({
  state,
  initial,
  groupId,
  onClose,
  onSubmit,
  onArchive,
}: {
  state: BudgetState
  initial?: Category
  groupId: string
  onClose: () => void
  onSubmit: (category: Omit<Category, 'id'>) => void
  onArchive?: () => void
}) => {
  const initialTarget = initial?.target
  const initialSchedule = initialTarget?.schedule
  const initialRepeat = initialTarget?.repeat
  const fallbackTargetDate = initialTarget?.targetDate
    ?? (initialTarget?.targetMonth ? monthEndDate(initialTarget.targetMonth) : monthEndDate(shiftMonth(state.activeMonth, 6)))

  const [name, setName] = useState(initial?.name ?? '')
  const [selectedGroupId, setSelectedGroupId] = useState(initial?.groupId ?? groupId)
  const [targetType, setTargetType] = useState<CategoryTarget['type'] | 'none'>(initialTarget?.type ?? 'none')
  const [targetAmount, setTargetAmount] = useState(initialTarget ? (initialTarget.amount / 100).toFixed(2) : '')
  const [scheduleMode, setScheduleMode] = useState<'recurring' | 'custom'>(initialSchedule?.kind ?? 'recurring')
  const [scheduleUnit, setScheduleUnit] = useState<'week' | 'month' | 'year'>(initialSchedule?.kind === 'recurring' ? initialSchedule.unit : 'month')
  const [scheduleInterval, setScheduleInterval] = useState(initialSchedule?.kind === 'recurring' ? String(initialSchedule.interval) : '1')
  const [anchorDate, setAnchorDate] = useState(initialSchedule?.kind === 'recurring' ? initialSchedule.anchorDate : `${state.activeMonth}-01`)
  const [customScheduleDates, setCustomScheduleDates] = useState(initialSchedule?.kind === 'custom' ? initialSchedule.dates.join('\n') : '')
  const [targetDate, setTargetDate] = useState(fallbackTargetDate)
  const [repeatMode, setRepeatMode] = useState<'none' | 'recurring' | 'custom'>(initialRepeat?.kind ?? 'none')
  const [repeatUnit, setRepeatUnit] = useState<'month' | 'year'>(initialRepeat?.kind === 'recurring' ? initialRepeat.unit : 'year')
  const [repeatInterval, setRepeatInterval] = useState(initialRepeat?.kind === 'recurring' ? String(initialRepeat.interval) : '1')
  const [customRepeatDates, setCustomRepeatDates] = useState(initialRepeat?.kind === 'custom' ? initialRepeat.dates.join('\n') : '')
  const [note, setNote] = useState(initial?.note ?? '')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return
    const amount = Math.abs(parseMoney(targetAmount))
    let target: CategoryTarget | undefined

    if (targetType !== 'none' && amount > 0) {
      if (targetType === 'by-date') {
        const repeat = repeatMode === 'recurring'
          ? { kind: 'recurring' as const, unit: repeatUnit, interval: Math.max(1, Number.parseInt(repeatInterval, 10) || 1) }
          : repeatMode === 'custom'
            ? { kind: 'custom' as const, dates: parseDateList(customRepeatDates).filter((date) => date !== targetDate) }
            : undefined
        target = {
          type: targetType,
          amount,
          targetDate,
          ...(repeat ? { repeat } : {}),
          ...(initialTarget?.snoozedMonths ? { snoozedMonths: initialTarget.snoozedMonths } : {}),
        }
      } else {
        const schedule = scheduleMode === 'custom'
          ? { kind: 'custom' as const, dates: parseDateList(customScheduleDates) }
          : {
              kind: 'recurring' as const,
              unit: scheduleUnit,
              interval: Math.max(1, Number.parseInt(scheduleInterval, 10) || 1),
              anchorDate,
            }
        target = {
          type: targetType,
          amount,
          schedule,
          ...(initialTarget?.snoozedMonths ? { snoozedMonths: initialTarget.snoozedMonths } : {}),
        }
      }
    }

    onSubmit({
      groupId: selectedGroupId,
      name: name.trim(),
      note: note.trim(),
      ...(target ? { target } : {}),
    })
  }

  return (
    <DialogFrame title={initial ? 'Edit category' : 'Add category'} subtitle="Targets produce a month-specific recommendation, not merely a lifetime goal total." onClose={onClose} wide>
      <form onSubmit={submit}>
        <div className="form-grid single-column">
          <label>Category name<input value={name} onChange={(event) => setName(event.target.value)} autoFocus required /></label>
          <label>Group
            <select value={selectedGroupId} onChange={(event) => setSelectedGroupId(event.target.value)}>
              {state.groups.filter((group) => !group.hidden).map((group) => <option value={group.id} key={group.id}>{group.name}</option>)}
            </select>
          </label>
          <label>Target type
            <select value={targetType} onChange={(event) => setTargetType(event.target.value as CategoryTarget['type'] | 'none')}>
              <option value="none">No target</option>
              <option value="monthly-savings">Set aside another amount on each due date</option>
              <option value="monthly-spending">Refill the available balance on each due date</option>
              <option value="by-date">Build a total balance by a deadline</option>
            </select>
          </label>

          {targetType !== 'none' && (
            <label>{targetType === 'by-date' ? 'Total target amount' : 'Amount per occurrence'}
              <input inputMode="decimal" value={targetAmount} onChange={(event) => setTargetAmount(event.target.value)} placeholder="0.00" required />
            </label>
          )}

          {targetType !== 'none' && targetType !== 'by-date' && (
            <section className="target-schedule-box">
              <div className="target-schedule-heading">
                <strong>Schedule</strong>
                <span>Every matching date contributes one occurrence to that month’s required amount.</span>
              </div>
              <label>Schedule style
                <select value={scheduleMode} onChange={(event) => setScheduleMode(event.target.value as 'recurring' | 'custom')}>
                  <option value="recurring">Repeat at a regular interval</option>
                  <option value="custom">Use custom irregular dates</option>
                </select>
              </label>
              {scheduleMode === 'recurring' ? (
                <div className="target-inline-grid">
                  <label>Every<input type="number" min="1" max="999" value={scheduleInterval} onChange={(event) => setScheduleInterval(event.target.value)} required /></label>
                  <label>Period
                    <select value={scheduleUnit} onChange={(event) => setScheduleUnit(event.target.value as 'week' | 'month' | 'year')}>
                      <option value="week">Week(s)</option>
                      <option value="month">Month(s)</option>
                      <option value="year">Year(s)</option>
                    </select>
                  </label>
                  <label>First due date<input type="date" value={anchorDate} onChange={(event) => setAnchorDate(event.target.value)} required /></label>
                </div>
              ) : (
                <label>Custom dates
                  <textarea value={customScheduleDates} onChange={(event) => setCustomScheduleDates(event.target.value)} placeholder={'2026-08-15\n2026-10-01\n2027-02-14'} rows={4} required />
                  <small className="field-help">Enter one ISO date per line. Commas and spaces also work.</small>
                </label>
              )}
            </section>
          )}

          {targetType === 'by-date' && (
            <section className="target-schedule-box">
              <div className="target-schedule-heading">
                <strong>Deadline</strong>
                <span>Rubies divides the remaining balance across the months still available.</span>
              </div>
              <label>First target date<input type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} required /></label>
              <label>After this deadline
                <select value={repeatMode} onChange={(event) => setRepeatMode(event.target.value as 'none' | 'recurring' | 'custom')}>
                  <option value="none">Stop after this target</option>
                  <option value="recurring">Repeat at a regular interval</option>
                  <option value="custom">Use custom future deadlines</option>
                </select>
              </label>
              {repeatMode === 'recurring' && (
                <div className="target-inline-grid repeat-grid">
                  <label>Repeat every<input type="number" min="1" max="999" value={repeatInterval} onChange={(event) => setRepeatInterval(event.target.value)} required /></label>
                  <label>Period
                    <select value={repeatUnit} onChange={(event) => setRepeatUnit(event.target.value as 'month' | 'year')}>
                      <option value="month">Month(s)</option>
                      <option value="year">Year(s)</option>
                    </select>
                  </label>
                </div>
              )}
              {repeatMode === 'custom' && (
                <label>Additional target dates
                  <textarea value={customRepeatDates} onChange={(event) => setCustomRepeatDates(event.target.value)} placeholder={'2027-01-31\n2027-06-15\n2028-03-01'} rows={4} required />
                </label>
              )}
            </section>
          )}

          <label>Notes <span className="optional">Optional</span>
            <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} />
          </label>
        </div>
        <footer className="dialog-actions split-actions">
          {onArchive ? <button type="button" className="danger-button" onClick={() => { if (window.confirm('Archive this category? Existing history will be kept.')) onArchive() }}>Archive</button> : <span />}
          <div><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button type="submit" className="primary-button">{initial ? 'Save category' : 'Add category'}</button></div>
        </footer>
      </form>
    </DialogFrame>
  )
}

const MoveMoneyDialog = ({
  state,
  readyToAssign,
  preset,
  onClose,
  onMove,
}: {
  state: BudgetState
  readyToAssign: number
  preset: MovePreset
  onClose: () => void
  onMove: (from: string | null, to: string | null, amount: number) => void
}) => {
  const categories = state.categories.filter((category) => !category.hidden)
  const [from, setFrom] = useState<string>(preset.from === null ? 'rta' : preset.from ?? 'rta')
  const [to, setTo] = useState<string>(preset.to === null ? 'rta' : preset.to ?? categories.find((category) => category.id !== preset.from)?.id ?? 'rta')
  const [amount, setAmount] = useState('')

  const sourceId = from === 'rta' ? null : from
  const destinationId = to === 'rta' ? null : to
  const sourceCategory = sourceId ? categories.find((category) => category.id === sourceId) : undefined
  const sourceAvailable = sourceCategory ? getCategorySummary(state, sourceCategory, state.activeMonth).available : readyToAssign
  const parsed = Math.abs(parseMoney(amount))
  const valid = parsed > 0 && sourceId !== destinationId && parsed <= Math.max(0, sourceAvailable)

  const options = (
    <>
      <option value="rta">Ready to assign ({formatMoney(readyToAssign, state.currency)})</option>
      {state.groups.map((group) => (
        <optgroup label={group.name} key={group.id}>
          {categories.filter((category) => category.groupId === group.id).map((category) => (
            <option value={category.id} key={category.id}>
              {category.name} ({formatMoney(getCategorySummary(state, category, state.activeMonth).available, state.currency)})
            </option>
          ))}
        </optgroup>
      ))}
    </>
  )

  return (
    <DialogFrame title="Move money" subtitle={`Reassign money in ${monthLabel(state.activeMonth)} without changing account balances.`} onClose={onClose}>
      <form onSubmit={(event) => { event.preventDefault(); if (valid) onMove(sourceId, destinationId, parsed) }}>
        <div className="move-flow">
          <label>From<select value={from} onChange={(event) => setFrom(event.target.value)}>{options}</select></label>
          <span className="move-arrow">→</span>
          <label>To<select value={to} onChange={(event) => setTo(event.target.value)}>{options}</select></label>
        </div>
        <label className="standalone-label">Amount<input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" autoFocus /></label>
        <div className="source-balance">Available to move: <strong>{formatMoney(Math.max(0, sourceAvailable), state.currency)}</strong></div>
        {parsed > sourceAvailable && <div className="form-error">That source does not have enough available money.</div>}
        <footer className="dialog-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button type="submit" className="primary-button" disabled={!valid}>Move money</button></footer>
      </form>
    </DialogFrame>
  )
}

const GroupDialog = ({ initialName, onClose, onSubmit }: { initialName: string; onClose: () => void; onSubmit: (name: string) => void }) => {
  const [name, setName] = useState(initialName)
  return (
    <DialogFrame title={initialName ? 'Rename group' : 'New category group'} onClose={onClose}>
      <form onSubmit={(event) => { event.preventDefault(); if (name.trim()) onSubmit(name.trim()) }}>
        <div className="form-grid single-column"><label>Group name<input value={name} onChange={(event) => setName(event.target.value)} autoFocus required /></label></div>
        <footer className="dialog-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit">Save group</button></footer>
      </form>
    </DialogFrame>
  )
}

const AccountDialog = ({
  initial,
  onClose,
  onSubmit,
}: {
  initial?: Account
  onClose: () => void
  onSubmit: (account: Omit<Account, 'id'>, openingBalance: number) => void
}) => {
  const [name, setName] = useState(initial?.name ?? '')
  const [note, setNote] = useState(initial?.note ?? '')
  const [closed, setClosed] = useState(initial?.closed ?? false)
  const [openingBalance, setOpeningBalance] = useState('')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return
    onSubmit(
      {
        name: name.trim(),
        ...(note.trim() ? { note: note.trim() } : {}),
        ...(closed ? { closed: true } : {}),
      },
      parseMoney(openingBalance),
    )
  }

  return (
    <DialogFrame title={initial ? 'Edit account' : 'Add account'} subtitle="Every account behaves the same way in Rubies." onClose={onClose}>
      <form onSubmit={submit}>
        <div className="form-grid single-column">
          <label>Account name<input value={name} onChange={(event) => setName(event.target.value)} autoFocus required /></label>
          <label>Note <span className="optional">Optional</span><input value={note} onChange={(event) => setNote(event.target.value)} /></label>
          {!initial && <label>Current balance<input inputMode="decimal" value={openingBalance} onChange={(event) => setOpeningBalance(event.target.value)} placeholder="0.00" /></label>}
          {initial && <label className="checkbox-label"><input type="checkbox" checked={closed} onChange={(event) => setClosed(event.target.checked)} />Close this account</label>}
        </div>
        <footer className="dialog-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit">{initial ? 'Save account' : 'Add account'}</button></footer>
      </form>
    </DialogFrame>
  )
}

const SettingsDialog = ({
  state,
  mode,
  onClose,
  onExport,
  onImport,
  onChangePassword,
  onResetDemo,
  onLock,
}: {
  state: BudgetState
  mode: Session['mode']
  onClose: () => void
  onExport: () => void
  onImport: () => void
  onChangePassword: (password: string) => Promise<void>
  onResetDemo: () => void
  onLock: () => void
}) => {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [message, setMessage] = useState('')

  const change = async (event: FormEvent) => {
    event.preventDefault()
    if (password.length < 8) {
      setMessage('Use at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setMessage('The passwords do not match.')
      return
    }
    await onChangePassword(password)
    setPassword('')
    setConfirm('')
    setMessage('Password changed and vault re-encrypted.')
  }

  return (
    <DialogFrame title="Settings & data" subtitle="Import nYNAB exports, back up Rubies, and manage local protection." onClose={onClose} wide>
      <div className="settings-body">
        <section className="settings-section">
          <h3>Data ownership</h3>
          <p>Rubies imports its own JSON exports and nYNAB API-style plan exports. Importing replaces the current budget after confirmation.</p>
          <div className="settings-actions">
            <button className="secondary-button" onClick={onExport}><DownloadIcon />Export Rubies JSON</button>
            <button className="primary-button" onClick={onImport}><UploadIcon />Import Rubies or nYNAB JSON</button>
            {mode === 'demo' && <button className="secondary-button" onClick={onResetDemo}>Reset demo data</button>}
            <button className="secondary-button" onClick={onLock}><LockIcon />{mode === 'demo' ? 'Exit demo' : 'Lock now'}</button>
          </div>
          {state.importSource?.kind === 'nynab' && (
            <div className="import-source-note">
              Imported from <strong>{state.importSource.sourceName}</strong> on {new Date(state.importSource.importedAt).toLocaleString()}.
            </div>
          )}
        </section>

        {mode === 'protected' && (
          <section className="settings-section">
            <h3>Change password</h3>
            <p>This re-encrypts the current budget. Rubies cannot recover a forgotten password.</p>
            <form onSubmit={change} className="password-change">
              <label>New password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" /></label>
              <label>Confirm password<input type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="new-password" /></label>
              {message && <div className={message.startsWith('Password changed') ? 'form-success' : 'form-error'}>{message}</div>}
              <button className="primary-button" type="submit">Change password</button>
            </form>
          </section>
        )}

        <section className="settings-section">
          <h3>Budget summary</h3>
          <dl className="summary-list">
            <div><dt>Budget</dt><dd>{state.name}</dd></div>
            <div><dt>Accounts</dt><dd>{state.accounts.length}</dd></div>
            <div><dt>Categories</dt><dd>{state.categories.length}</dd></div>
            <div><dt>Transactions</dt><dd>{state.transactions.length}</dd></div>
            <div><dt>Months</dt><dd>{Object.keys(state.months).length}</dd></div>
            <div><dt>Version</dt><dd>{APP_VERSION}</dd></div>
          </dl>
        </section>
      </div>
    </DialogFrame>
  )
}

const BudgetWorkspace = ({
  session,
  onCloseSession,
  onUpdateSession,
}: {
  session: Session
  onCloseSession: () => void
  onUpdateSession: (session: Session) => void
}) => {
  const persist = useCallback(
    async (state: BudgetState) => {
      if (session.mode === 'protected') await saveVault(state, session.password)
    },
    [session],
  )

  const [state, actions, saveStatus, history] = useBudgetStore(session.state, session.mode === 'protected' ? persist : undefined)
  const [view, setView] = useState<View>('plan')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [categoryDialog, setCategoryDialog] = useState<CategoryDialogState>(null)
  const [transactionDialog, setTransactionDialog] = useState<TransactionDialogState>(null)
  const [accountDialog, setAccountDialog] = useState<Account | 'new' | null>(null)
  const [movePreset, setMovePreset] = useState<MovePreset | null>(null)
  const [groupDialog, setGroupDialog] = useState<{ id?: string; name: string } | null>(null)
  const [assignmentCategory, setAssignmentCategory] = useState<Category | null>(null)
  const [allocationHistory, setAllocationHistory] = useState<{ categoryId?: string } | null>(null)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [toastVisible, setToastVisible] = useState(false)
  const [selectedAccountId, setSelectedAccountId] = useState<string | undefined>()
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const importInputRef = useRef<HTMLInputElement>(null)

  const readyToAssign = useMemo(() => getReadyToAssign(state, state.activeMonth), [state])
  const budgetBalance = useMemo(() => getBudgetBalance(state), [state])

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  useEffect(() => {
    const keyHandler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.matches('input, textarea, select')) return
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) actions.redo()
        else actions.undo()
        return
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'y') {
        event.preventDefault()
        actions.redo()
        return
      }
      if (event.key.toLowerCase() === 'p') setView('plan')
      if (event.key.toLowerCase() === 'a') setView('accounts')
      if (event.key.toLowerCase() === 'n') setTransactionDialog({})
      if (event.key.toLowerCase() === 'm') setMovePreset({})
      if (event.key.toLowerCase() === 't') actions.setActiveMonth(currentMonthKey())
      if (event.key === '?') setShortcutsOpen(true)
    }
    window.addEventListener('keydown', keyHandler)
    return () => window.removeEventListener('keydown', keyHandler)
  }, [actions])

  useEffect(() => {
    if (!history.lastAction) return
    setToastVisible(true)
    const timeout = window.setTimeout(() => setToastVisible(false), 5000)
    return () => window.clearTimeout(timeout)
  }, [history.lastAction])

  useEffect(() => {
    if (session.mode !== 'protected') return
    let timeout = window.setTimeout(onCloseSession, 15 * 60 * 1000)
    const reset = () => {
      window.clearTimeout(timeout)
      timeout = window.setTimeout(onCloseSession, 15 * 60 * 1000)
    }
    const events = ['pointerdown', 'keydown', 'touchstart']
    events.forEach((event) => window.addEventListener(event, reset, { passive: true }))
    return () => {
      window.clearTimeout(timeout)
      events.forEach((event) => window.removeEventListener(event, reset))
    }
  }, [session.mode, onCloseSession])

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups((current) => {
      const next = new Set(current)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }

  const exportData = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `rubies-${state.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${todayKey()}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const importData = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    try {
      const result = parseImportedBudget(JSON.parse(await file.text()))
      const warningText = result.warnings.length ? `\n\nWarnings:\n${result.warnings.join('\n')}` : ''
      if (!window.confirm(`${result.summary}${warningText}\n\nReplace the current budget with this import?`)) return
      actions.importState(result.state)
      onUpdateSession(session.mode === 'protected'
        ? { mode: 'protected', state: result.state, password: session.password }
        : { mode: 'demo', state: result.state })
      setSettingsOpen(false)
      window.alert(`${result.summary}${warningText}`)
    } catch (reason) {
      window.alert(reason instanceof Error ? reason.message : 'Could not import this JSON file.')
    }
  }

  const changePassword = async (password: string) => {
    if (session.mode !== 'protected') return
    await saveVault(state, password)
    onUpdateSession({ mode: 'protected', state, password })
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
        <div className="sidebar-brand"><RubyMark /><div><strong>Rubies</strong><span>{APP_VERSION}</span></div></div>
        <nav className="main-nav">
          <button className={view === 'plan' ? 'active' : ''} onClick={() => setView('plan')}><PlanIcon /><span>Plan</span><kbd>P</kbd></button>
          <button className={view === 'accounts' ? 'active' : ''} onClick={() => setView('accounts')}><AccountIcon /><span>Accounts</span><kbd>A</kbd></button>
        </nav>

        <div className="sidebar-section">
          <div className="section-heading"><span>Accounts</span><button className="tiny-add" onClick={() => setAccountDialog('new')}>+</button></div>
          <button className="sidebar-account all" onClick={() => { setView('accounts'); setSelectedAccountId(undefined) }}>
            <span>All money</span><strong>{formatMoney(budgetBalance, state.currency)}</strong>
          </button>
          {state.accounts.filter((account) => !account.closed).map((account) => (
            <button className="sidebar-account" key={account.id} onClick={() => { setView('accounts'); setSelectedAccountId(account.id) }}>
              <span>{account.name}</span><strong>{formatMoney(getAccountBalance(state, account.id), state.currency)}</strong>
            </button>
          ))}
          {state.accounts.length === 0 && <button className="empty-account-link" onClick={() => setAccountDialog('new')}>+ Add your first account</button>}
        </div>

        <div className="sidebar-footer">
          {installPrompt && <button onClick={install}><DownloadIcon /><span>Install app</span></button>}
          <button onClick={() => setShortcutsOpen(true)}><KeyboardIcon /><span>Keyboard shortcuts</span><kbd>?</kbd></button>
          <button onClick={() => setSettingsOpen(true)}><SettingsIcon /><span>Settings</span></button>
          <div className={`save-status ${saveStatus}`}>
            <span />
            {session.mode === 'demo' ? 'Demo changes are temporary' : saveStatus === 'saving' ? 'Encrypting…' : saveStatus === 'error' ? 'Save failed' : 'Encrypted locally'}
          </div>
        </div>
      </aside>

      <main className="main-content">
        {view === 'plan' ? (
          <PlanView
            state={state}
            readyToAssign={readyToAssign}
            collapsedGroups={collapsedGroups}
            onToggleGroup={toggleGroup}
            onMonthChange={actions.setActiveMonth}
            onEditAssignment={setAssignmentCategory}
            onEditCategory={(category) => setCategoryDialog({ mode: 'edit', category })}
            onAddCategory={(groupId) => setCategoryDialog({ mode: 'create', groupId })}
            onEditGroup={(id, name) => setGroupDialog({ id, name })}
            onNewGroup={() => setGroupDialog({ name: '' })}
            onNewTransaction={() => setTransactionDialog({})}
            onMove={(preset = {}) => setMovePreset(preset)}
            onAutoAssign={() => actions.autoAssignTargets(state.activeMonth)}
            onToggleSnooze={(categoryId) => actions.toggleTargetSnooze(state.activeMonth, categoryId)}
            onOpenHistory={(categoryId) => setAllocationHistory(categoryId ? { categoryId } : {})}
            onUndo={actions.undo}
            canUndo={history.canUndo}
          />
        ) : (
          <AccountsView
            state={state}
            selectedAccountId={selectedAccountId}
            onSelectAccount={setSelectedAccountId}
            onNewAccount={() => setAccountDialog('new')}
            onEditAccount={(account) => setAccountDialog(account)}
            onNewTransaction={() => setTransactionDialog({})}
            onEditTransaction={(transaction) => setTransactionDialog({ transaction })}
          />
        )}
      </main>

      <nav className="mobile-nav">
        <button className={view === 'plan' ? 'active' : ''} onClick={() => setView('plan')}><PlanIcon /><span>Plan</span></button>
        <button className={view === 'accounts' ? 'active' : ''} onClick={() => setView('accounts')}><AccountIcon /><span>Accounts</span></button>
        <button className="mobile-add" onClick={() => setTransactionDialog({})}><PlusIcon /><span>New</span></button>
        <button onClick={() => setSettingsOpen(true)}><SettingsIcon /><span>More</span></button>
      </nav>

      {transactionDialog && (
        <TransactionDialog
          state={state}
          transaction={transactionDialog.transaction}
          selectedAccountId={selectedAccountId}
          onClose={() => setTransactionDialog(null)}
          onSubmit={(transaction) => {
            if (transactionDialog.transaction) actions.updateTransaction(transactionDialog.transaction.id, transaction)
            else actions.addTransaction(transaction)
            setTransactionDialog(null)
          }}
          onDelete={transactionDialog.transaction ? () => {
            if (window.confirm('Delete this transaction?')) {
              actions.deleteTransaction(transactionDialog.transaction!.id)
              setTransactionDialog(null)
            }
          } : undefined}
        />
      )}

      {assignmentCategory && (
        <AssignmentDialog
          state={state}
          category={assignmentCategory}
          onClose={() => setAssignmentCategory(null)}
          onSave={(amount) => {
            actions.setAssignment(state.activeMonth, assignmentCategory.id, amount)
            setAssignmentCategory(null)
          }}
        />
      )}

      {categoryDialog && (
        <CategoryDialog
          state={state}
          initial={categoryDialog.mode === 'edit' ? categoryDialog.category : undefined}
          groupId={categoryDialog.mode === 'create' ? categoryDialog.groupId : categoryDialog.category.groupId}
          onClose={() => setCategoryDialog(null)}
          onSubmit={(category) => {
            if (categoryDialog.mode === 'edit') actions.updateCategory(categoryDialog.category.id, category)
            else actions.addCategory(category)
            setCategoryDialog(null)
          }}
          onArchive={categoryDialog.mode === 'edit' ? () => {
            const summary = getCategorySummary(state, categoryDialog.category, state.activeMonth)
            if (summary.available !== 0) {
              window.alert('Move this category’s available money before archiving it.')
              return
            }
            actions.archiveCategory(categoryDialog.category.id)
            setCategoryDialog(null)
          } : undefined}
        />
      )}

      {movePreset && (
        <MoveMoneyDialog
          state={state}
          readyToAssign={readyToAssign}
          preset={movePreset}
          onClose={() => setMovePreset(null)}
          onMove={(from, to, amount) => {
            actions.moveMoney(state.activeMonth, from, to, amount)
            setMovePreset(null)
          }}
        />
      )}

      {groupDialog && (
        <GroupDialog
          initialName={groupDialog.name}
          onClose={() => setGroupDialog(null)}
          onSubmit={(name) => {
            if (groupDialog.id) actions.updateGroup(groupDialog.id, { name })
            else actions.addGroup(name)
            setGroupDialog(null)
          }}
        />
      )}

      {accountDialog && (
        <AccountDialog
          initial={accountDialog === 'new' ? undefined : accountDialog}
          onClose={() => setAccountDialog(null)}
          onSubmit={(account, openingBalance) => {
            if (accountDialog === 'new') actions.addAccount(account, openingBalance)
            else actions.updateAccount(accountDialog.id, account)
            setAccountDialog(null)
          }}
        />
      )}

      {settingsOpen && (
        <SettingsDialog
          state={state}
          mode={session.mode}
          onClose={() => setSettingsOpen(false)}
          onExport={exportData}
          onImport={() => importInputRef.current?.click()}
          onChangePassword={changePassword}
          onResetDemo={() => actions.replaceState(createDemoState())}
          onLock={onCloseSession}
        />
      )}


      {allocationHistory && (
        <AllocationHistoryDialog
          state={state}
          categoryId={allocationHistory.categoryId}
          onClose={() => setAllocationHistory(null)}
        />
      )}

      {shortcutsOpen && <ShortcutsDialog onClose={() => setShortcutsOpen(false)} />}

      {toastVisible && history.lastAction && (
        <div className="action-toast" role="status">
          <span>{history.lastAction.label}</span>
          <button onClick={actions.undo} disabled={!history.canUndo}>Undo <kbd>⌘Z</kbd></button>
          <button className="toast-close" onClick={() => setToastVisible(false)} aria-label="Dismiss">×</button>
        </div>
      )}

      <input ref={importInputRef} type="file" accept="application/json,.json" hidden onChange={importData} />
    </div>
  )
}

const App = () => {
  const [session, setSession] = useState<Session | null>(null)
  return session
    ? <BudgetWorkspace session={session} onCloseSession={() => setSession(null)} onUpdateSession={setSession} />
    : <AccessGate onOpen={(next) => setSession({ ...next, state: normalizeBudgetState(next.state) })} />
}

export default App
