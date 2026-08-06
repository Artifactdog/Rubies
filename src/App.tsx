import { type ChangeEvent, type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState, } from 'react';
import { type Account, type BudgetState, type Category, type CategoryTarget, type Transaction, createDemoState, createEmptyState, formatMoney, getAccountBalance, getBudgetBalance, getCategorySummary, getReadyToAssign, getRecentTransactions, monthEndDate, monthLabel, parseDateList, parseMoney, shiftMonth, } from './domain';
import { useBudgetStore } from './store';
import { deleteVault, hasVault, openVault, saveVault } from './vault';
import { APP_VERSION } from './version';
interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{
        outcome: 'accepted' | 'dismissed';
        platform: string;
    }>;
}
type View = 'plan' | 'accounts';
type Session = {
    mode: 'protected';
    state: BudgetState;
    password: string;
} | {
    mode: 'demo';
    state: BudgetState;
};
type CategoryDialogState = {
    mode: 'create';
    groupId: string;
} | {
    mode: 'edit';
    category: Category;
} | null;
type TransactionDialogState = {
    transaction?: Transaction;
} | null;
const Icon = ({ children, size = 18 }: {
    children: ReactNode;
    size?: number;
}) => (<svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>);
const PlanIcon = () => <Icon><path d="M4 5.5h16M4 12h16M4 18.5h16"/><path d="M8 3v5M15 9.5v5M11 16v5"/></Icon>;
const AccountIcon = () => <Icon><path d="M3.5 9.5 12 4l8.5 5.5"/><path d="M5 10.5h14v8H5zM8 13.5h2M14 13.5h2"/></Icon>;
const PlusIcon = () => <Icon><path d="M12 5v14M5 12h14"/></Icon>;
const MoveIcon = () => <Icon><path d="M7 7h11l-3-3M17 17H6l3 3"/><path d="M18 7l-3 3M6 17l3-3"/></Icon>;
const TargetIcon = () => <Icon><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="m14 10 5-5"/></Icon>;
const LockIcon = () => <Icon><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></Icon>;
const SettingsIcon = () => <Icon><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.09a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.09a1.7 1.7 0 0 0 1.6-1.1 1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.09a1.7 1.7 0 0 0 1.1 1.6 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.14.37.35.7.6 1 .29.3.68.46 1.1.4h.09v4h-.09a1.7 1.7 0 0 0-1.7.6Z"/></Icon>;
const DownloadIcon = () => <Icon><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></Icon>;
const UploadIcon = () => <Icon><path d="M12 21V9M7 14l5-5 5 5M5 3h14"/></Icon>;
const InstallIcon = () => <Icon><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 7h6M12 10v6M9.5 13.5 12 16l2.5-2.5"/></Icon>;
const EditIcon = () => <Icon size={15}><path d="m4 20 4.5-1 10-10a2 2 0 0 0-3-3l-10 10L4 20Z"/><path d="m14 7 3 3"/></Icon>;
const ChevronIcon = ({ direction }: {
    direction: 'left' | 'right';
}) => <Icon size={16}><path d={direction === 'left' ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6'}/></Icon>;
const RubyMark = () => <div className="ruby-mark" aria-hidden="true"><span /></div>;
const StatusDot = ({ status }: {
    status: 'healthy' | 'underfunded' | 'overspent';
}) => <span className={`status-dot ${status}`} aria-label={status}/>;
const MoneyInput = ({ value, onCommit, ariaLabel }: {
    value: number;
    onCommit: (value: number) => void;
    ariaLabel: string;
}) => {
    const [draft, setDraft] = useState((value / 100).toFixed(2));
    useEffect(() => setDraft((value / 100).toFixed(2)), [value]);
    const commit = () => {
        const parsed = parseMoney(draft);
        setDraft((parsed / 100).toFixed(2));
        onCommit(parsed);
    };
    return <input className="money-input" aria-label={ariaLabel} inputMode="decimal" value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={commit} onKeyDown={(event) => { if (event.key === 'Enter')
        event.currentTarget.blur(); }}/>;
};
const DialogFrame = ({ title, subtitle, onClose, children, wide = false }: {
    title: string;
    subtitle: string;
    onClose: () => void;
    children: ReactNode;
    wide?: boolean;
}) => {
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape')
            onClose(); };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [onClose]);
    return (<div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target)
        onClose(); }}>
      <section className={`dialog ${wide ? 'dialog-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby="dialog-title">
        <header><div><span className="eyebrow">Rubies workspace</span><h2 id="dialog-title">{title}</h2><p>{subtitle}</p></div><button className="close-button" aria-label="Close" onClick={onClose}>×</button></header>
        {children}
      </section>
    </div>);
};
function App() {
    const [session, setSession] = useState<Session | null>(null);
    const [vaultPresent, setVaultPresent] = useState(hasVault());
    if (!session) {
        return <AccessScreen vaultPresent={vaultPresent} onProtected={(state, password) => { setVaultPresent(true); setSession({ mode: 'protected', state, password }); }} onDemo={() => setSession({ mode: 'demo', state: createDemoState() })} onDeleteVault={() => { deleteVault(); setVaultPresent(false); }}/>;
    }
    return <BudgetApp key={session.mode} session={session} onLock={() => setSession(null)} onPasswordChanged={(password) => { if (session.mode === 'protected')
        setSession({ ...session, password }); }}/>;
}
const AccessScreen = ({ vaultPresent, onProtected, onDemo, onDeleteVault }: {
    vaultPresent: boolean;
    onProtected: (state: BudgetState, password: string) => void;
    onDemo: () => void;
    onDeleteVault: () => void;
}) => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const submit = async (event: FormEvent) => {
        event.preventDefault();
        setError('');
        if (!vaultPresent && password.length < 8) {
            setError('Use at least 8 characters. A longer passphrase is better.');
            return;
        }
        if (!vaultPresent && password !== confirmPassword) {
            setError('The passwords do not match.');
            return;
        }
        setBusy(true);
        try {
            if (vaultPresent) {
                const state = await openVault(password);
                onProtected(state, password);
            }
            else {
                const state = createEmptyState();
                await saveVault(state, password);
                onProtected(state, password);
            }
        }
        catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Could not open the budget.');
        }
        finally {
            setBusy(false);
        }
    };
    const resetVault = () => {
        if (window.confirm('Delete the encrypted budget stored on this device? This cannot be undone without an export.'))
            onDeleteVault();
    };
    return (<main className="access-shell">
      <section className="access-card">
        <div className="access-brand"><RubyMark /><div><strong>Rubies</strong><span>Private zero-based budgeting</span></div></div>
        <div className="access-copy">
          <span className="eyebrow">{vaultPresent ? 'Protected budget found' : 'First-time setup'}</span>
          <h1>{vaultPresent ? 'Unlock your budget' : 'Protect your budget first'}</h1>
          <p>{vaultPresent ? 'Your data is encrypted on this device. Enter the password to decrypt it for this session.' : 'Create a password before storing financial data. Rubies encrypts the entire budget locally and never stores the password.'}</p>
        </div>
        <form onSubmit={submit} className="access-form">
          <label>Password<input type="password" autoComplete={vaultPresent ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} autoFocus required/></label>
          {!vaultPresent && <label>Confirm password<input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required/></label>}
          {error && <div className="form-error" role="alert">{error}</div>}
          <button className="primary-button access-primary" type="submit" disabled={busy}><LockIcon />{busy ? 'Working…' : vaultPresent ? 'Unlock budget' : 'Create protected budget'}</button>
        </form>
        <div className="access-divider"><span>or</span></div>
        <button className="demo-button" onClick={onDemo}><RubyMark /><span><strong>Enter demo mode</strong><small>Try a realistic pre-filled budget. Changes are discarded when you leave.</small></span></button>
        {vaultPresent && <button className="danger-link" onClick={resetVault}>Delete local vault and start over</button>}
        <p className="security-note"><LockIcon />Encrypted with PBKDF2 and AES-GCM. Locking or closing the tab removes the decrypted session from memory.</p>
      </section>
    </main>);
};
const BudgetApp = ({ session, onLock, onPasswordChanged }: {
    session: Session;
    onLock: () => void;
    onPasswordChanged: (password: string) => void;
}) => {
    const [password, setPassword] = useState(session.mode === 'protected' ? session.password : '');
    const passwordRef = useRef(password);
    const persist = useCallback((state: BudgetState) => session.mode === 'protected' ? saveVault(state, passwordRef.current) : Promise.resolve(), [session.mode]);
    const [state, actions, saveStatus] = useBudgetStore(session.state, session.mode === 'protected' ? persist : undefined);
    const [view, setView] = useState<View>('plan');
    const [selectedAccountId, setSelectedAccountId] = useState<string | undefined>();
    const [transactionDialog, setTransactionDialog] = useState<TransactionDialogState>(null);
    const [categoryDialog, setCategoryDialog] = useState<CategoryDialogState>(null);
    const [moveOpen, setMoveOpen] = useState<{
        from?: string | null;
        to?: string | null;
    } | null>(null);
    const [groupDialogId, setGroupDialogId] = useState<string | 'new' | null>(null);
    const [accountDialog, setAccountDialog] = useState<Account | 'new' | null>(null);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
    const importInputRef = useRef<HTMLInputElement>(null);
    const readyToAssign = useMemo(() => getReadyToAssign(state, state.activeMonth), [state]);
    useEffect(() => {
        const onBeforeInstall = (event: Event) => { event.preventDefault(); setInstallPrompt(event as BeforeInstallPromptEvent); };
        window.addEventListener('beforeinstallprompt', onBeforeInstall);
        return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
    }, []);
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.metaKey || event.ctrlKey || event.altKey)
                return;
            const target = event.target as HTMLElement | null;
            if (target?.matches('input, textarea, select, button'))
                return;
            if (event.key.toLowerCase() === 'n')
                setTransactionDialog({});
            if (event.key.toLowerCase() === 'p')
                setView('plan');
            if (event.key.toLowerCase() === 'a')
                setView('accounts');
            if (event.key.toLowerCase() === 'm')
                setMoveOpen({});
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);
    useEffect(() => {
        if (session.mode !== 'protected')
            return;
        let timeout = window.setTimeout(onLock, 15 * 60 * 1000);
        const refresh = () => { window.clearTimeout(timeout); timeout = window.setTimeout(onLock, 15 * 60 * 1000); };
        const events = ['pointerdown', 'keydown', 'touchstart'] as const;
        events.forEach((event) => window.addEventListener(event, refresh, { passive: true }));
        return () => { window.clearTimeout(timeout); events.forEach((event) => window.removeEventListener(event, refresh)); };
    }, [onLock, session.mode]);
    const selectAccount = (accountId?: string) => { setSelectedAccountId(accountId); setView('accounts'); };
    const exportData = () => {
        const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `rubies-budget-${new Date().toISOString().slice(0, 10)}.json`;
        anchor.click();
        URL.revokeObjectURL(url);
    };
    const importData = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file)
            return;
        try {
            actions.importState(JSON.parse(await file.text()) as BudgetState);
        }
        catch (error) {
            window.alert(error instanceof Error ? error.message : 'Could not import this Rubies file.');
        }
        finally {
            event.target.value = '';
        }
    };
    const install = async () => { if (installPrompt) {
        await installPrompt.prompt();
        await installPrompt.userChoice;
        setInstallPrompt(null);
    } };
    const toggleGroup = (groupId: string) => setCollapsedGroups((current) => { const next = new Set(current); next.has(groupId) ? next.delete(groupId) : next.add(groupId); return next; });
    const changePassword = async (nextPassword: string) => {
        passwordRef.current = nextPassword;
        await saveVault(state, nextPassword);
        setPassword(nextPassword);
        onPasswordChanged(nextPassword);
    };
    return (<div className="app-shell">
      {session.mode === 'demo' && <div className="demo-banner"><span>Demo mode · changes are temporary</span><button onClick={() => actions.replaceState(createDemoState())}>Reset demo</button></div>}
      <aside className="sidebar">
        <div className="brand"><RubyMark /><div><strong>Rubies</strong><span>{state.name}</span></div></div>
        <nav className="primary-nav" aria-label="Main navigation">
          <button className={view === 'plan' ? 'active' : ''} onClick={() => setView('plan')}><PlanIcon /><span>Plan</span><kbd>P</kbd></button>
          <button className={view === 'accounts' && !selectedAccountId ? 'active' : ''} onClick={() => selectAccount(undefined)}><AccountIcon /><span>All accounts</span><kbd>A</kbd></button>
        </nav>
        <div className="sidebar-section">
          <div className="section-heading"><span>Budget accounts</span><button className="tiny-add" onClick={() => setAccountDialog('new')} aria-label="Add account">+</button></div>
          <div className="account-list">
            {state.accounts.filter((account) => !account.closed).map((account) => <button key={account.id} className={selectedAccountId === account.id && view === 'accounts' ? 'active' : ''} onClick={() => selectAccount(account.id)}><span className="account-name"><span className={`account-dot ${account.type}`}/>{account.name}</span><span>{formatMoney(getAccountBalance(state, account.id), state.currency)}</span></button>)}
            {state.accounts.length === 0 && <button className="empty-account-link" onClick={() => setAccountDialog('new')}>+ Add your first account</button>}
          </div>
          <div className="sidebar-total"><span>On-budget total</span><strong>{formatMoney(getBudgetBalance(state), state.currency)}</strong></div>
        </div>
        <div className="sidebar-footer">
          {installPrompt && <button onClick={install}><InstallIcon /><span>Install Rubies</span></button>}
          <button onClick={() => setSettingsOpen(true)}><SettingsIcon /><span>Settings & data</span></button>
          <button onClick={onLock}><LockIcon /><span>{session.mode === 'demo' ? 'Exit demo' : 'Lock budget'}</span></button>
          <span className={`save-status ${saveStatus}`}>{session.mode === 'demo' ? 'Temporary session' : saveStatus === 'saving' ? 'Encrypting changes…' : saveStatus === 'error' ? 'Could not save' : 'Encrypted locally'}</span>
        </div>
      </aside>

      <main className="workspace">
        {view === 'plan' ? <PlanView state={state} readyToAssign={readyToAssign} collapsedGroups={collapsedGroups} onToggleGroup={toggleGroup} onMonthChange={actions.setActiveMonth} onAssignmentChange={actions.setAssignment} onEditCategory={(category) => setCategoryDialog({ mode: 'edit', category })} onAddCategory={(groupId) => setCategoryDialog({ mode: 'create', groupId })} onEditGroup={setGroupDialogId} onNewGroup={() => setGroupDialogId('new')} onNewTransaction={() => setTransactionDialog({})} onMoveMoney={(preset) => setMoveOpen(preset)} onFundTarget={(category) => { const summary = getCategorySummary(state, category, state.activeMonth); const amount = Math.min(Math.max(0, readyToAssign), summary.target?.needed ?? 0); actions.moveMoney(state.activeMonth, null, category.id, amount); }} onAutoAssign={() => actions.autoAssignTargets(state.activeMonth)}/> : <AccountsView state={state} selectedAccountId={selectedAccountId} onSelectAccount={setSelectedAccountId} onNewTransaction={() => setTransactionDialog({})} onEditTransaction={(transaction) => setTransactionDialog({ transaction })} onAddAccount={() => setAccountDialog('new')} onEditAccount={(account) => setAccountDialog(account)}/>}
      </main>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        <button className={view === 'plan' ? 'active' : ''} onClick={() => setView('plan')}><PlanIcon /><span>Plan</span></button>
        <button className={view === 'accounts' ? 'active' : ''} onClick={() => selectAccount(undefined)}><AccountIcon /><span>Accounts</span></button>
        <button className="mobile-add" onClick={() => setTransactionDialog({})}><PlusIcon /><span>New</span></button>
        <button onClick={() => setSettingsOpen(true)}><SettingsIcon /><span>More</span></button>
      </nav>

      {transactionDialog && <TransactionDialog state={state} transaction={transactionDialog.transaction} selectedAccountId={selectedAccountId} onClose={() => setTransactionDialog(null)} onSubmit={(transaction) => { transactionDialog.transaction ? actions.updateTransaction(transactionDialog.transaction.id, transaction) : actions.addTransaction(transaction); setTransactionDialog(null); }} onDelete={transactionDialog.transaction ? () => { if (window.confirm('Delete this transaction?')) {
        actions.deleteTransaction(transactionDialog.transaction!.id);
        setTransactionDialog(null);
    } } : undefined}/>}
      {categoryDialog && <CategoryDialog state={state} initial={categoryDialog.mode === 'edit' ? categoryDialog.category : undefined} groupId={categoryDialog.mode === 'create' ? categoryDialog.groupId : categoryDialog.category.groupId} onClose={() => setCategoryDialog(null)} onSubmit={(category) => { categoryDialog.mode === 'edit' ? actions.updateCategory(categoryDialog.category.id, category) : actions.addCategory(category); setCategoryDialog(null); }} onArchive={categoryDialog.mode === 'edit' ? () => { const available = getCategorySummary(state, categoryDialog.category, state.activeMonth).available; if (available !== 0) {
        window.alert(`Move ${formatMoney(available, state.currency)} out of this category before archiving it.`);
        return;
    } actions.archiveCategory(categoryDialog.category.id); setCategoryDialog(null); } : undefined}/>}
      {moveOpen && <MoveMoneyDialog state={state} readyToAssign={readyToAssign} preset={moveOpen} onClose={() => setMoveOpen(null)} onMove={(from, to, amount) => { actions.moveMoney(state.activeMonth, from, to, amount); setMoveOpen(null); }}/>}
      {groupDialogId && <GroupDialog initialName={groupDialogId === 'new' ? '' : state.groups.find((group) => group.id === groupDialogId)?.name ?? ''} onClose={() => setGroupDialogId(null)} onSubmit={(name) => { groupDialogId === 'new' ? actions.addGroup(name) : actions.updateGroup(groupDialogId, { name }); setGroupDialogId(null); }}/>}
      {accountDialog && <AccountDialog initial={accountDialog === 'new' ? undefined : accountDialog} onClose={() => setAccountDialog(null)} onSubmit={(account, openingBalance) => { accountDialog === 'new' ? actions.addAccount(account, openingBalance) : actions.updateAccount(accountDialog.id, account); setAccountDialog(null); }}/>}
      {settingsOpen && <SettingsDialog state={state} mode={session.mode} onClose={() => setSettingsOpen(false)} onExport={exportData} onImport={() => importInputRef.current?.click()} onChangePassword={changePassword} onResetDemo={() => actions.replaceState(createDemoState())} onLock={onLock}/>}
      <input ref={importInputRef} type="file" accept="application/json" hidden onChange={importData}/>
    </div>);
};
const PlanView = ({ state, readyToAssign, collapsedGroups, onToggleGroup, onMonthChange, onAssignmentChange, onEditCategory, onAddCategory, onEditGroup, onNewGroup, onNewTransaction, onMoveMoney, onFundTarget, onAutoAssign }: {
    state: BudgetState;
    readyToAssign: number;
    collapsedGroups: Set<string>;
    onToggleGroup: (groupId: string) => void;
    onMonthChange: (month: string) => void;
    onAssignmentChange: (month: string, categoryId: string, amount: number) => void;
    onEditCategory: (category: Category) => void;
    onAddCategory: (groupId: string) => void;
    onEditGroup: (groupId: string) => void;
    onNewGroup: () => void;
    onNewTransaction: () => void;
    onMoveMoney: (preset: {
        from?: string | null;
        to?: string | null;
    }) => void;
    onFundTarget: (category: Category) => void;
    onAutoAssign: () => void;
}) => {
    const visibleCategories = state.categories.filter((category) => !category.hidden);
    const summaries = visibleCategories.map((category) => getCategorySummary(state, category, state.activeMonth));
    const totalAssigned = summaries.reduce((sum, item) => sum + item.assigned, 0);
    const totalActivity = summaries.reduce((sum, item) => sum + item.activity, 0);
    const totalAvailable = summaries.reduce((sum, item) => sum + item.available, 0);
    const totalNeeded = summaries.reduce((sum, item) => sum + (item.target?.needed ?? 0), 0);
    return <>
    <header className="workspace-header"><div><span className="eyebrow">Zero-based plan</span><div className="month-switcher"><button aria-label="Previous month" onClick={() => onMonthChange(shiftMonth(state.activeMonth, -1))}><ChevronIcon direction="left"/></button><h1>{monthLabel(state.activeMonth)}</h1><button aria-label="Next month" onClick={() => onMonthChange(shiftMonth(state.activeMonth, 1))}><ChevronIcon direction="right"/></button></div><p>{formatMoney(totalNeeded, state.currency)} still needed to meet this month’s targets.</p></div><button className={`ready-card ${readyToAssign < 0 ? 'negative' : ''}`} onClick={() => onMoveMoney({ from: null })}><span>Ready to assign</span><strong>{formatMoney(readyToAssign, state.currency)}</strong><small>{readyToAssign === 0 ? 'Every available dollar has a job.' : readyToAssign > 0 ? 'Click to assign this money.' : 'Move money back to cover the gap.'}</small></button></header>
    <div className="toolbar"><div className="toolbar-cluster"><button className="primary-button" onClick={onNewTransaction}><PlusIcon />New transaction <kbd>N</kbd></button><button className="secondary-button" onClick={() => onMoveMoney({})}><MoveIcon />Move money <kbd>M</kbd></button><button className="secondary-button" onClick={onAutoAssign} disabled={readyToAssign <= 0 || totalNeeded <= 0}><TargetIcon />Auto-assign targets</button></div><button className="text-button" onClick={onNewGroup}>+ New group</button></div>
    <section className="budget-panel">
      <div className="budget-grid budget-grid-header"><div>Category & target</div><div>Assigned</div><div>Activity</div><div>Available</div></div>
      {state.groups.filter((group) => !group.hidden).map((group) => {
            const categories = visibleCategories.filter((category) => category.groupId === group.id);
            const collapsed = collapsedGroups.has(group.id);
            return <div className="category-group" key={group.id}><div className="group-row"><button className="group-name" onClick={() => onToggleGroup(group.id)}><span className={`collapse-chevron ${collapsed ? 'collapsed' : ''}`}>⌄</span><strong>{group.name}</strong><small>{categories.length}</small></button><div className="group-actions"><button onClick={() => onEditGroup(group.id)}><EditIcon /> Rename</button><button onClick={() => onAddCategory(group.id)}><PlusIcon /> Add category</button></div></div>{!collapsed && categories.map((category) => { const summary = getCategorySummary(state, category, state.activeMonth); return <div className="budget-grid category-row" key={category.id}><div className="category-cell"><StatusDot status={summary.status}/><div className="category-details"><button className="category-name-button" onClick={() => onEditCategory(category)}><strong>{category.name}</strong><EditIcon /></button>{summary.target ? <><small>{summary.target.label}</small><div className="target-track"><span style={{ width: `${Math.round(summary.target.progress * 100)}%` }}/></div></> : <small className="no-target">No target · click name to add one</small>}</div>{summary.target && summary.target.needed > 0 && readyToAssign > 0 && <button className="fund-button" onClick={() => onFundTarget(category)}>Fund {formatMoney(Math.min(summary.target.needed, readyToAssign), state.currency)}</button>}</div><div><MoneyInput value={summary.assigned} ariaLabel={`Assigned to ${category.name}`} onCommit={(amount) => onAssignmentChange(state.activeMonth, category.id, amount)}/></div><div className={summary.activity < 0 ? 'negative-money' : ''}>{formatMoney(summary.activity, state.currency)}</div><div><button className={`available-pill ${summary.status}`} onClick={() => onMoveMoney({ from: category.id })}>{formatMoney(summary.available, state.currency)}</button></div></div>; })}</div>;
        })}
      <div className="budget-grid totals-row"><div>Plan totals</div><div>{formatMoney(totalAssigned, state.currency)}</div><div>{formatMoney(totalActivity, state.currency)}</div><div>{formatMoney(totalAvailable, state.currency)}</div></div>
    </section>
  </>;
};
const AccountsView = ({ state, selectedAccountId, onSelectAccount, onNewTransaction, onEditTransaction, onAddAccount, onEditAccount }: {
    state: BudgetState;
    selectedAccountId?: string;
    onSelectAccount: (accountId?: string) => void;
    onNewTransaction: () => void;
    onEditTransaction: (transaction: Transaction) => void;
    onAddAccount: () => void;
    onEditAccount: (account: Account) => void;
}) => {
    const selectedAccount = state.accounts.find((account) => account.id === selectedAccountId);
    const transactions = getRecentTransactions(state, selectedAccountId);
    return <><header className="workspace-header accounts-header"><div><span className="eyebrow">Account register</span><div className="title-with-action"><h1>{selectedAccount?.name ?? 'All accounts'}</h1>{selectedAccount && <button className="icon-button" onClick={() => onEditAccount(selectedAccount)} aria-label="Edit account"><EditIcon /></button>}</div><p>{selectedAccount ? formatMoney(getAccountBalance(state, selectedAccount.id), state.currency) : `${state.accounts.length} account${state.accounts.length === 1 ? '' : 's'} · ${formatMoney(getBudgetBalance(state), state.currency)} on budget`}</p></div><div className="toolbar-cluster"><button className="secondary-button" onClick={onAddAccount}><PlusIcon />Add account</button><button className="primary-button" onClick={onNewTransaction}><PlusIcon />New transaction <kbd>N</kbd></button></div></header><div className="account-chips" aria-label="Account filter"><button className={!selectedAccountId ? 'active' : ''} onClick={() => onSelectAccount(undefined)}>All</button>{state.accounts.filter((account) => !account.closed).map((account) => <button key={account.id} className={selectedAccountId === account.id ? 'active' : ''} onClick={() => onSelectAccount(account.id)}>{account.name}</button>)}</div><section className="register-panel">{transactions.length === 0 ? <div className="empty-state"><RubyMark /><h3>No transactions yet</h3><p>Add an account opening balance, inflow, or expense to begin the register.</p><div className="toolbar-cluster"><button className="secondary-button" onClick={onAddAccount}>Add account</button><button className="primary-button" onClick={onNewTransaction} disabled={state.accounts.length === 0}>Add transaction</button></div></div> : <div className="transaction-list">{transactions.map((transaction) => { const account = state.accounts.find((item) => item.id === transaction.accountId); const category = state.categories.find((item) => item.id === transaction.categoryId); return <button className="transaction-row" key={transaction.id} onClick={() => onEditTransaction(transaction)}><div className={`transaction-icon ${transaction.amount >= 0 ? 'inflow' : 'outflow'}`}>{transaction.amount >= 0 ? '↙' : '↗'}</div><div className="transaction-main"><strong>{transaction.payee}</strong><span>{category?.name ?? 'Ready to assign'} · {account?.name}</span>{transaction.memo && <small>{transaction.memo}</small>}</div><time>{new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(`${transaction.date}T12:00:00`))}</time><div className={`transaction-amount ${transaction.amount >= 0 ? 'positive' : ''}`}>{formatMoney(transaction.amount, state.currency)}<small>{transaction.cleared ? 'Cleared' : 'Uncleared'} · Edit</small></div></button>; })}</div>}</section></>;
};
const TransactionDialog = ({ state, transaction, selectedAccountId, onClose, onSubmit, onDelete }: {
    state: BudgetState;
    transaction?: Transaction;
    selectedAccountId?: string;
    onClose: () => void;
    onSubmit: (transaction: Omit<Transaction, 'id'>) => void;
    onDelete?: () => void;
}) => {
    const initialKind = transaction?.amount && transaction.amount >= 0 ? 'income' : 'expense';
    const [kind, setKind] = useState<'expense' | 'income'>(initialKind);
    const [accountId, setAccountId] = useState(transaction?.accountId ?? selectedAccountId ?? state.accounts[0]?.id ?? '');
    const [categoryId, setCategoryId] = useState(transaction?.categoryId ?? state.categories.find((category) => !category.hidden)?.id ?? '');
    const [date, setDate] = useState(transaction?.date ?? new Date().toISOString().slice(0, 10));
    const [payee, setPayee] = useState(transaction?.payee ?? '');
    const [memo, setMemo] = useState(transaction?.memo ?? '');
    const [amount, setAmount] = useState(transaction ? (Math.abs(transaction.amount) / 100).toFixed(2) : '');
    const [cleared, setCleared] = useState(transaction?.cleared ?? false);
    const submit = (event: FormEvent) => { event.preventDefault(); const parsed = Math.abs(parseMoney(amount)); if (!accountId || !payee.trim() || parsed === 0)
        return; onSubmit({ accountId, date, payee: payee.trim(), memo: memo.trim(), categoryId: kind === 'income' ? null : categoryId, amount: kind === 'income' ? parsed : -parsed, cleared }); };
    return <DialogFrame title={transaction ? 'Edit transaction' : 'New transaction'} subtitle="Record money exactly where it moved." onClose={onClose}><form onSubmit={submit}><div className="segmented-control"><button type="button" className={kind === 'expense' ? 'active' : ''} onClick={() => setKind('expense')}>Expense</button><button type="button" className={kind === 'income' ? 'active' : ''} onClick={() => setKind('income')}>Income</button></div>{state.accounts.length === 0 && <div className="form-warning">Add an account before recording transactions.</div>}<div className="form-grid"><label>Account<select value={accountId} onChange={(event) => setAccountId(event.target.value)} required>{state.accounts.filter((account) => !account.closed).map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}</select></label><label>Date<input type="date" value={date} onChange={(event) => setDate(event.target.value)} required/></label><label className="span-two">Payee<input value={payee} onChange={(event) => setPayee(event.target.value)} placeholder={kind === 'expense' ? 'Who did you pay?' : 'Where did it come from?'} autoFocus required/></label>{kind === 'expense' && <label className="span-two">Category<select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} required>{state.groups.map((group) => <optgroup label={group.name} key={group.id}>{state.categories.filter((category) => category.groupId === group.id && !category.hidden).map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</optgroup>)}</select></label>}<label>Amount<input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" required/></label><label>Status<select value={cleared ? 'cleared' : 'uncleared'} onChange={(event) => setCleared(event.target.value === 'cleared')}><option value="uncleared">Uncleared</option><option value="cleared">Cleared</option></select></label><label className="span-two">Memo <span className="optional">Optional</span><input value={memo} onChange={(event) => setMemo(event.target.value)} placeholder="A useful note for future you"/></label></div><footer className="dialog-actions split-actions">{onDelete ? <button type="button" className="danger-button" onClick={onDelete}>Delete</button> : <span />}<div><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button type="submit" className="primary-button" disabled={state.accounts.length === 0}>{transaction ? 'Save changes' : 'Save transaction'}</button></div></footer></form></DialogFrame>;
};
const CategoryDialog = ({ state, initial, groupId, onClose, onSubmit, onArchive }: {
    state: BudgetState;
    initial?: Category;
    groupId: string;
    onClose: () => void;
    onSubmit: (category: Omit<Category, 'id'>) => void;
    onArchive?: () => void;
}) => {
    const initialTarget = initial?.target;
    const initialSchedule = initialTarget?.schedule;
    const initialRepeat = initialTarget?.repeat;
    const fallbackTargetDate = initialTarget?.targetDate ?? (initialTarget?.targetMonth ? monthEndDate(initialTarget.targetMonth) : monthEndDate(shiftMonth(state.activeMonth, 6)));
    const [name, setName] = useState(initial?.name ?? '');
    const [selectedGroupId, setSelectedGroupId] = useState(initial?.groupId ?? groupId);
    const [targetType, setTargetType] = useState<CategoryTarget['type'] | 'none'>(initialTarget?.type ?? 'none');
    const [targetAmount, setTargetAmount] = useState(initialTarget ? (initialTarget.amount / 100).toFixed(2) : '');
    const [scheduleMode, setScheduleMode] = useState<'recurring' | 'custom'>(initialSchedule?.kind ?? 'recurring');
    const [scheduleUnit, setScheduleUnit] = useState<'week' | 'month' | 'year'>(initialSchedule?.kind === 'recurring' ? initialSchedule.unit : 'month');
    const [scheduleInterval, setScheduleInterval] = useState(initialSchedule?.kind === 'recurring' ? String(initialSchedule.interval) : '1');
    const [anchorDate, setAnchorDate] = useState(initialSchedule?.kind === 'recurring' ? initialSchedule.anchorDate : `${state.activeMonth}-01`);
    const [customScheduleDates, setCustomScheduleDates] = useState(initialSchedule?.kind === 'custom' ? initialSchedule.dates.join('\n') : '');
    const [targetDate, setTargetDate] = useState(fallbackTargetDate);
    const [repeatMode, setRepeatMode] = useState<'none' | 'recurring' | 'custom'>(initialRepeat?.kind ?? 'none');
    const [repeatUnit, setRepeatUnit] = useState<'month' | 'year'>(initialRepeat?.kind === 'recurring' ? initialRepeat.unit : 'year');
    const [repeatInterval, setRepeatInterval] = useState(initialRepeat?.kind === 'recurring' ? String(initialRepeat.interval) : '1');
    const [customRepeatDates, setCustomRepeatDates] = useState(initialRepeat?.kind === 'custom' ? initialRepeat.dates.join('\n') : '');
    const [note, setNote] = useState(initial?.note ?? '');
    const submit = (event: FormEvent) => {
        event.preventDefault();
        if (!name.trim())
            return;
        const amount = Math.abs(parseMoney(targetAmount));
        let target: CategoryTarget | undefined;
        if (targetType !== 'none' && amount > 0) {
            if (targetType === 'by-date') {
                const repeat = repeatMode === 'recurring'
                    ? { kind: 'recurring' as const, unit: repeatUnit, interval: Math.max(1, Number.parseInt(repeatInterval, 10) || 1) }
                    : repeatMode === 'custom'
                        ? { kind: 'custom' as const, dates: parseDateList(customRepeatDates).filter((date) => date !== targetDate) }
                        : undefined;
                target = { type: targetType, amount, targetDate, ...(repeat ? { repeat } : {}) };
            }
            else {
                const schedule = scheduleMode === 'custom'
                    ? { kind: 'custom' as const, dates: parseDateList(customScheduleDates) }
                    : {
                        kind: 'recurring' as const,
                        unit: scheduleUnit,
                        interval: Math.max(1, Number.parseInt(scheduleInterval, 10) || 1),
                        anchorDate,
                    };
                target = { type: targetType, amount, schedule };
            }
        }
        onSubmit({ groupId: selectedGroupId, name: name.trim(), note: note.trim(), ...(target ? { target } : {}) });
    };
    return <DialogFrame title={initial ? 'Edit category' : 'Add category'} subtitle="Categories are envelopes. Targets can follow regular or irregular schedules." onClose={onClose} wide><form onSubmit={submit}><div className="form-grid single-column"><label>Category name<input value={name} onChange={(event) => setName(event.target.value)} autoFocus required/></label><label>Group<select value={selectedGroupId} onChange={(event) => setSelectedGroupId(event.target.value)}>{state.groups.filter((group) => !group.hidden).map((group) => <option value={group.id} key={group.id}>{group.name}</option>)}</select></label><label>Target type<select value={targetType} onChange={(event) => setTargetType(event.target.value as CategoryTarget['type'] | 'none')}><option value="none">No target</option><option value="monthly-spending">Refill spending balance on a schedule</option><option value="monthly-savings">Assign a fixed amount on a schedule</option><option value="by-date">Save a total amount by a deadline</option></select></label>{targetType !== 'none' && <label>{targetType === 'by-date' ? 'Total target amount' : 'Amount per occurrence'}<input inputMode="decimal" value={targetAmount} onChange={(event) => setTargetAmount(event.target.value)} placeholder="0.00" required/></label>}{targetType !== 'none' && targetType !== 'by-date' && <section className="target-schedule-box"><div className="target-schedule-heading"><strong>Schedule</strong><span>Each matching date contributes one occurrence to that month’s target.</span></div><label>Schedule style<select value={scheduleMode} onChange={(event) => setScheduleMode(event.target.value as 'recurring' | 'custom')}><option value="recurring">Repeat at a regular interval</option><option value="custom">Use custom irregular dates</option></select></label>{scheduleMode === 'recurring' ? <div className="target-inline-grid"><label>Every<input type="number" min="1" max="999" value={scheduleInterval} onChange={(event) => setScheduleInterval(event.target.value)} required/></label><label>Period<select value={scheduleUnit} onChange={(event) => setScheduleUnit(event.target.value as 'week' | 'month' | 'year')}><option value="week">Week(s)</option><option value="month">Month(s)</option><option value="year">Year(s)</option></select></label><label>First due date<input type="date" value={anchorDate} onChange={(event) => setAnchorDate(event.target.value)} required/></label></div> : <label>Custom dates<textarea value={customScheduleDates} onChange={(event) => setCustomScheduleDates(event.target.value)} placeholder={'2026-08-15\n2026-10-01\n2027-02-14'} rows={4} required/><small className="field-help">Enter one ISO date per line. Commas and spaces also work.</small></label>}</section>}{targetType === 'by-date' && <section className="target-schedule-box"><div className="target-schedule-heading"><strong>Deadline</strong><span>Rubies spreads the remaining amount across the months before the next deadline.</span></div><label>First target date<input type="date" min={`${state.activeMonth}-01`} value={targetDate} onChange={(event) => setTargetDate(event.target.value)} required/></label><label>After this deadline<select value={repeatMode} onChange={(event) => setRepeatMode(event.target.value as 'none' | 'recurring' | 'custom')}><option value="none">Stop after this target</option><option value="recurring">Repeat at a regular interval</option><option value="custom">Use custom future deadlines</option></select></label>{repeatMode === 'recurring' && <div className="target-inline-grid repeat-grid"><label>Repeat every<input type="number" min="1" max="999" value={repeatInterval} onChange={(event) => setRepeatInterval(event.target.value)} required/></label><label>Period<select value={repeatUnit} onChange={(event) => setRepeatUnit(event.target.value as 'month' | 'year')}><option value="month">Month(s)</option><option value="year">Year(s)</option></select></label></div>}{repeatMode === 'custom' && <label>Additional target dates<textarea value={customRepeatDates} onChange={(event) => setCustomRepeatDates(event.target.value)} placeholder={'2027-01-31\n2027-06-15\n2028-03-01'} rows={4} required/><small className="field-help">The first target date is included automatically.</small></label>}</section>}<label>Notes <span className="optional">Optional</span><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Purpose, rules, or a reminder" rows={3}/></label></div><footer className="dialog-actions split-actions">{onArchive ? <button type="button" className="danger-button" onClick={() => { if (window.confirm('Archive this category? Existing history will be kept.'))
        onArchive(); }}>Archive</button> : <span />}<div><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button type="submit" className="primary-button">{initial ? 'Save category' : 'Add category'}</button></div></footer></form></DialogFrame>;
};
const MoveMoneyDialog = ({ state, readyToAssign, preset, onClose, onMove }: {
    state: BudgetState;
    readyToAssign: number;
    preset: {
        from?: string | null;
        to?: string | null;
    };
    onClose: () => void;
    onMove: (from: string | null, to: string | null, amount: number) => void;
}) => {
    const categories = state.categories.filter((category) => !category.hidden);
    const [from, setFrom] = useState<string>(preset.from === null ? 'rta' : preset.from ?? 'rta');
    const [to, setTo] = useState<string>(preset.to === null ? 'rta' : preset.to ?? categories.find((category) => category.id !== preset.from)?.id ?? 'rta');
    const [amount, setAmount] = useState('');
    const sourceId = from === 'rta' ? null : from;
    const destinationId = to === 'rta' ? null : to;
    const sourceAvailable = sourceId ? getCategorySummary(state, categories.find((category) => category.id === sourceId)!, state.activeMonth).available : readyToAssign;
    const parsed = Math.abs(parseMoney(amount));
    const valid = parsed > 0 && sourceId !== destinationId && parsed <= Math.max(0, sourceAvailable);
    const submit = (event: FormEvent) => { event.preventDefault(); if (valid)
        onMove(sourceId, destinationId, parsed); };
    const options = <><option value="rta">Ready to assign ({formatMoney(readyToAssign, state.currency)})</option>{state.groups.map((group) => <optgroup label={group.name} key={group.id}>{categories.filter((category) => category.groupId === group.id).map((category) => <option value={category.id} key={category.id}>{category.name} ({formatMoney(getCategorySummary(state, category, state.activeMonth).available, state.currency)})</option>)}</optgroup>)}</>;
    return <DialogFrame title="Move money" subtitle={`Reassign available money without changing your account balances in ${monthLabel(state.activeMonth)}.`} onClose={onClose}><form onSubmit={submit}><div className="move-flow"><label>From<select value={from} onChange={(event) => setFrom(event.target.value)}>{options}</select></label><span className="move-arrow">→</span><label>To<select value={to} onChange={(event) => setTo(event.target.value)}>{options}</select></label></div><label className="standalone-label">Amount<input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" autoFocus/></label><div className="source-balance">Available to move: <strong>{formatMoney(Math.max(0, sourceAvailable), state.currency)}</strong></div>{parsed > sourceAvailable && <div className="form-error">That source does not have enough available money.</div>}<footer className="dialog-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button type="submit" className="primary-button" disabled={!valid}>Move money</button></footer></form></DialogFrame>;
};
const GroupDialog = ({ initialName, onClose, onSubmit }: {
    initialName: string;
    onClose: () => void;
    onSubmit: (name: string) => void;
}) => {
    const [name, setName] = useState(initialName);
    return <DialogFrame title={initialName ? 'Rename group' : 'New category group'} subtitle="Use groups to organize related envelopes." onClose={onClose}><form onSubmit={(event) => { event.preventDefault(); if (name.trim())
        onSubmit(name.trim()); }}><div className="form-grid single-column"><label>Group name<input value={name} onChange={(event) => setName(event.target.value)} autoFocus required/></label></div><footer className="dialog-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit">Save group</button></footer></form></DialogFrame>;
};
const AccountDialog = ({ initial, onClose, onSubmit }: {
    initial?: Account;
    onClose: () => void;
    onSubmit: (account: Omit<Account, 'id'>, openingBalance: number) => void;
}) => {
    const [name, setName] = useState(initial?.name ?? '');
    const [type, setType] = useState<Account['type']>(initial?.type ?? 'cash');
    const [onBudget, setOnBudget] = useState(initial?.onBudget ?? true);
    const [closed, setClosed] = useState(initial?.closed ?? false);
    const [openingBalance, setOpeningBalance] = useState('');
    const submit = (event: FormEvent) => { event.preventDefault(); if (name.trim())
        onSubmit({ name: name.trim(), type, onBudget, closed }, parseMoney(openingBalance)); };
    return <DialogFrame title={initial ? 'Edit account' : 'Add account'} subtitle="Accounts tell Rubies where your real money lives." onClose={onClose}><form onSubmit={submit}><div className="form-grid single-column"><label>Account name<input value={name} onChange={(event) => setName(event.target.value)} autoFocus required/></label><label>Account type<select value={type} onChange={(event) => setType(event.target.value as Account['type'])}><option value="cash">Cash / checking / savings</option><option value="credit">Credit card</option><option value="tracking">Tracking account</option></select></label><label className="checkbox-label"><input type="checkbox" checked={onBudget} onChange={(event) => setOnBudget(event.target.checked)}/>Include this account in the budget</label>{!initial && <label>Current balance<input inputMode="decimal" value={openingBalance} onChange={(event) => setOpeningBalance(event.target.value)} placeholder="0.00 (use minus for debt)"/></label>}{initial && <label className="checkbox-label"><input type="checkbox" checked={closed} onChange={(event) => setClosed(event.target.checked)}/>Close this account</label>}</div><footer className="dialog-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit">{initial ? 'Save account' : 'Add account'}</button></footer></form></DialogFrame>;
};
const SettingsDialog = ({ state, mode, onClose, onExport, onImport, onChangePassword, onResetDemo, onLock }: {
    state: BudgetState;
    mode: Session['mode'];
    onClose: () => void;
    onExport: () => void;
    onImport: () => void;
    onChangePassword: (password: string) => Promise<void>;
    onResetDemo: () => void;
    onLock: () => void;
}) => {
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [message, setMessage] = useState('');
    const change = async (event: FormEvent) => { event.preventDefault(); if (password.length < 8) {
        setMessage('Use at least 8 characters.');
        return;
    } if (password !== confirm) {
        setMessage('The passwords do not match.');
        return;
    } await onChangePassword(password); setPassword(''); setConfirm(''); setMessage('Password changed and vault re-encrypted.'); };
    return <DialogFrame title="Settings & data" subtitle="Back up your budget and manage local protection." onClose={onClose} wide><div className="settings-body"><section className="settings-section"><h3>Data ownership</h3><p>Exports are readable JSON files. Keep them somewhere safe; they are not encrypted.</p><div className="settings-actions"><button className="secondary-button" onClick={onExport}><DownloadIcon />Export budget</button><button className="secondary-button" onClick={onImport}><UploadIcon />Import budget</button>{mode === 'demo' && <button className="secondary-button" onClick={onResetDemo}>Reset demo data</button>}<button className="secondary-button" onClick={onLock}><LockIcon />{mode === 'demo' ? 'Exit demo' : 'Lock now'}</button></div></section>{mode === 'protected' && <section className="settings-section"><h3>Change password</h3><p>This re-encrypts the current budget. Rubies cannot recover a forgotten password.</p><form onSubmit={change} className="password-change"><label>New password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password"/></label><label>Confirm password<input type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="new-password"/></label>{message && <div className={message.startsWith('Password changed') ? 'form-success' : 'form-error'}>{message}</div>}<button className="primary-button" type="submit">Change password</button></form></section>}<section className="settings-section"><h3>Budget summary</h3><dl className="summary-list"><div><dt>Budget</dt><dd>{state.name}</dd></div><div><dt>Accounts</dt><dd>{state.accounts.length}</dd></div><div><dt>Transactions</dt><dd>{state.transactions.length}</dd></div><div><dt>Storage</dt><dd>{mode === 'protected' ? 'Encrypted local vault' : 'Temporary demo memory'}</dd></div><div><dt>Version</dt><dd>{APP_VERSION}</dd></div></dl></section></div></DialogFrame>;
};
export default App;
