# Rubies architecture

Rubies is a static React PWA designed for a single self-hosted user and a single budget. The browser contains the application logic, budgeting engine, encrypted persistence, import/export logic, and UI state. Nginx serves the compiled application and does not run a Rubies application backend.

## Runtime shape

```text
Browser
├─ React application
├─ budgeting/domain calculations
├─ in-memory undo/redo state
├─ encrypted local vault
├─ import/export processing
└─ service worker cache

Nginx
└─ static application shell + SPA routing + security headers
```

There is currently no Rubies database server, sync service, HTTP session store, or multi-user authorization layer.

## Single-budget invariant

Rubies intentionally exposes one budget only. There is no budget picker, plan switcher, or user-facing budget name.

The version-5 serialized model still contains a legacy `name` field so older Rubies files and nYNAB imports remain compatible. Imported source names may also be retained as provenance. Neither is part of the current product navigation model.

One encrypted Rubies vault is stored per browser origin/profile. A different hostname, browser profile, browser, or device is a separate local installation unless data is moved manually with an export/import.

## Source layers

- `src/domain.ts` — version-5 budget schema, money calculations, targets, Ready to Assign, migrations, and nYNAB import
- `src/store.ts` — state mutations for assignments, money movement, categories, groups, accounts, transactions, snoozing, undo/redo, and allocation history
- `src/vault.ts` — encrypted browser-local persistence
- `src/App.tsx` — access gate, budget/account views, dialogs, transaction and allocation workflows, import/export, settings, and demo mode
- `src/uiRuntime.ts` — small event-driven progressive UI enhancements that are difficult to express cleanly in the existing component tree
- `src/styles.css` — base desktop/responsive design
- `src/mobile-polish.css`, `src/ui-stability.css`, and `src/mobile-layout-fixes.css` — mobile and browser-specific layout corrections
- `tests/*.test.mjs` — budgeting, migration, import, performance-regression, and layout-regression tests
- `public/sw.js` — PWA application-shell cache
- `nginx.conf` — static serving, SPA fallback, caching rules, CSP, and browser hardening headers

### UI runtime constraint

`src/uiRuntime.ts` is event-driven and `requestAnimationFrame`-throttled. It must not use document-wide `MutationObserver` loops or DOM polling. Those patterns previously caused severe Chromium responsiveness regressions and are guarded against by regression tests.

React remains the owner of application and budgeting state. UI-runtime helpers must not become a second state-management system.

## Money representation

All Rubies monetary values use integer minor currency units.

For a two-decimal currency:

```text
125000 = 1,250.00
6500   = 65.00
```

Using integers avoids floating-point drift in assignments, transaction sums, category balances, and target calculations.

nYNAB exports use milliunits. Import converts those values according to the export's currency decimal precision before they enter the Rubies model.

## Budget state

The current serialized schema is `BudgetState.version = 5`.

Important collections are:

```text
groups
categories
accounts
transactions
months
allocationEvents
```

Each month stores category assignments. Category activity is derived from categorized transactions rather than duplicated into the month record.

Old Rubies payloads are normalized when unlocked or imported. Removed fields such as account notes, transaction memos, and month notes are discarded. Category notes are retained.

## Accounts

Rubies has one account type.

An account contains an ID, name, and optional closed state. There is no separate cash, checking, savings, credit-card, tracking, or off-budget behavior in the domain model.

An account balance is the sum of its transactions.

Closing an account hides it from normal new-transaction workflows without deleting its history.

## Transactions

A transaction contains:

```text
accountId
date
payee
categoryId
amount
```

`payee` may be an empty string. Transaction notes do not exist.

A negative amount is an expense. A positive amount is income.

Categorized transactions change category activity. A transaction whose `categoryId` is `null` contributes to or consumes Ready to Assign.

Rubies intentionally has no cleared/uncleared state, reconciliation state, credit-card payment workflow, or account-type-specific transaction behavior.

## Category balances

For a selected month, category available is based on prior carried positive balance plus the selected month's assignment and categorized activity.

Conceptually:

```text
carried positive available from prior months
+ selected-month assignment
+ selected-month categorized activity
= selected-month available
```

Negative category balances do not roll forward as negative category balances. Cash overspending is absorbed by the following month's Ready to Assign instead.

This keeps the category model cash-style while preserving the accounting behavior expected by imported nYNAB month snapshots.

## Ready to Assign

Ready to Assign starts with cumulative uncategorized cash flow, subtracts cumulative assignments, and accounts for prior cash overspending.

Past-month display needs one additional rule: money that was unassigned in an earlier month may have been assigned in a later month. Revisiting the earlier month must not resurrect that money.

Rubies therefore treats positive historical Ready to Assign changes as funding lots. Later deficits consume the oldest available lots first. A historical month shows only the portion of its funding that remains genuinely unassigned after later budget activity.

Current and future months can still show a negative Ready to Assign value when the budget is over-assigned.

## Assignments and money movement

Assignments are month-specific values stored on `BudgetMonth.assignments`.

Moving money changes assignments only. It does not create transactions and does not alter account balances.

The user-facing assignment editor uses a draft value. Typing or dragging does not change the budget until the user confirms the edit.

Confirmed assignment changes, Move Money operations, and Auto-assign operations create `allocationEvents`. This provides allocation history independently from transaction history.

The store also retains reversible state snapshots for Undo and Redo. Undoing an allocation restores the corresponding budget and allocation-history state together.

## Targets

Categories can have one of three target behaviors:

- set aside another amount on scheduled dates
- refill available balance on scheduled dates
- build a total balance by a deadline

Schedules can be recurring weekly, monthly, or yearly intervals, every-N-period intervals, or explicit custom dates. Deadline targets can stop after one deadline, repeat regularly, or use custom future deadlines.

Target calculation returns separate values for:

```text
requiredThisMonth
leftToAssign
overallLeft
progress
```

This separation is intentional. `requiredThisMonth` is the recommendation for the selected month; it is not simply the target's lifetime total.

Deadline targets divide remaining need across the months still available before the active deadline. Recommendations therefore recalculate as the selected month changes.

Snoozing suppresses the recommendation for one month without deleting the target.

## nYNAB import

The nYNAB importer recognizes API-style JSON containing `data.plan`.

It maps:

- accounts into the single Rubies account model
- user category groups and categories while excluding internal system categories
- category notes and hidden state
- month `budgeted` values into Rubies assignments
- transactions, optional payees, categories, income, and imported transfers
- nYNAB goal cadence/deadline fields into Rubies target schedules
- snoozed goal month data into target snoozing
- split subtransactions into ordinary Rubies transaction entries

If imported transactions do not sum to an exported account balance, Rubies adds an explicit imported balance-adjustment transaction so the resulting account total matches the source data.

Because nYNAB exports do not contain the original click-by-click allocation action log, imported allocation history is represented as month-level assignment snapshots rather than invented individual actions.

Scheduled transactions are not modeled yet and produce an import warning.

Import replaces the current budget only after explicit user confirmation.

## Local vault

Persistent state is JSON-serialized and encrypted before being written to browser `localStorage`.

`src/vault.ts` currently uses:

```text
PBKDF2-SHA-256
310,000 iterations
16-byte random salt per saved payload
AES-256-GCM
12-byte random IV per saved payload
```

The password is not persisted. While Rubies is unlocked, the password and decrypted budget necessarily exist in page memory so changes can be re-encrypted and saved.

Writes are serialized through an in-memory write queue so overlapping saves do not race each other.

See [`SECURITY.md`](../SECURITY.md) for the threat boundary.

## PWA and deployment

Vite builds the React application into static assets. The Docker image serves those assets through Nginx.

The service worker caches the application shell for PWA/offline startup. The encrypted budget itself remains browser-local data rather than service-worker cache data.

Nginx provides SPA routing and browser hardening headers. It does not authenticate users at the HTTP layer.

For a private network endpoint, put Rubies behind HTTPS and an authenticating reverse proxy or equivalent server-side access-control layer.

## Current architectural boundaries

Rubies is deliberately local and single-user today. The architecture does not currently provide:

- automatic cross-device synchronization
- a server database
- server-side Rubies accounts or sessions
- multi-user or household permissions
- scheduled transaction execution
- native split-transaction editing after import
- reconciliation/cleared workflows

These are product boundaries, not hidden behaviors in the current model.
