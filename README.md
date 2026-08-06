# Rubies Budget

Rubies is a self-hosted, local-first envelope budgeting PWA with a calm, information-dense workspace, offline support, and user-owned data.

> Rubies is an independent project. It is not affiliated with or endorsed by YNAB or Obsidian.

## What works in 2026.8.6.3

- Compact mobile category rows with dense assigned, activity, and available values
- Mobile-safe dialogs that do not auto-focus or trigger browser zoom
- Optional transaction payees; notes exist only on categories
### Budgeting

- Monthly zero-based assignments with positive category balance rollover
- Cash overspending resets at month end and reduces the next month’s Ready to Assign
- Editable category names, groups, category notes, and targets
- Three target behaviors:
  - Set aside another amount on each scheduled date
  - Refill an available balance on each scheduled date
  - Build a total balance by a deadline
- Weekly, monthly, yearly, every-N-period, repeating-deadline, and irregular custom schedules
- Exact first due dates and custom future deadlines
- Target snoozing for individual budget months
- A clear target breakdown for every category:
  - required this month
  - assigned this month
  - left to assign this month
  - overall amount left for deadline goals
- Future-month recommendations recalculate as the deadline approaches
- One-click target funding and target auto-assignment
- Move money between categories or back to Ready to Assign
- Dense desktop rows that keep category, target, assigned, activity, and available values visible together
- Confirmed assignment editor with exact entry, a linear mouse/touch slider, Enter-to-save, and cancel-to-discard
- Undo and redo from buttons or `Ctrl/⌘ Z` and `Ctrl/⌘ Shift Z`
- Persistent allocation history for assignments, moves, and auto-assign actions
- Editable and collapsible category groups
- Category archiving without destroying transaction history
- A **Today** button and `T` keyboard shortcut to return to the current month

### nYNAB import

Rubies accepts nYNAB API-style JSON plan exports in addition to Rubies JSON backups.

The importer preserves:

- plan name and ISO currency
- accounts and current account balances
- category groups, categories, category notes, hidden state, and archived state
- historical and future month assignments
- transactions, optional payee names, categories, income, and transfers
- monthly, every-N-month, annual, and one-time deadline targets
- goal target amounts, due days, target months, and snoozed months
- month-level assignment snapshots for allocation history
- split transactions by flattening their subtransactions into normal Rubies entries

nYNAB milliunits are converted to Rubies minor currency units. Internal Ready to Assign, Uncategorized, and credit-card payment categories are excluded. Scheduled transactions are reported as an import warning because Rubies does not schedule transactions yet.

Importing replaces the current budget only after an explicit confirmation.

### Accounts and transactions

Rubies deliberately uses one account model:

- no cash/credit/tracking account types
- no credit-card payment workflow
- no cleared/uncleared or reconciliation state
- add, rename, annotate, close, and reopen accounts
- add, edit, and delete income or expense transactions
- account filtering and live balances

Existing Rubies budgets migrate automatically to the current model when unlocked or imported.

### Access and data protection

- Mandatory password setup before creating a persistent budget
- Password-gated unlock screen on every new browser session
- PBKDF2-SHA-256 password derivation and AES-256-GCM encrypted local vault
- Automatic lock after 15 minutes of inactivity
- Manual lock and password change
- One-click temporary demo mode with realistic pre-filled data
- Human-readable JSON export

### App and deployment

- Larger responsive desktop and mobile layouts
- Installable PWA with offline app-shell caching
- Docker and Docker Compose deployment
- CSP and browser hardening headers in the bundled Nginx configuration
- Visible keyboard shortcuts: `P` Plan, `A` Accounts, `N` New transaction, `M` Move money, `T` Today, `Ctrl/⌘ Z` Undo, and `?` Help

## Security model

The current version is a static, single-device PWA. The saved budget is encrypted before it is written to browser storage. The password is kept only in the unlocked page's memory and is not stored. Locking or closing the page removes access to decrypted data.

This protects budget data at rest in the browser, but it is not server-side user authentication. The HTML and JavaScript application shell remains publicly downloadable from the web server. For network-level access control, place Rubies behind HTTPS and an authenticating reverse proxy.

Export files are intentionally portable JSON and are **not encrypted**. Store them securely.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

## Run with Docker

```bash
docker compose up --build
```

Open `http://localhost:8080`.

For PWA installation outside localhost, serve Rubies through HTTPS.

## Build and verify

```bash
npm install
npm run typecheck
npm test
npm run build
docker build -t rubies-budget .
```

## Storage and recovery

The encrypted vault is stored in browser `localStorage` on the current device and browser profile. There is no password recovery because Rubies never stores the password. Keep regular exports.

Clearing browser site data deletes the local vault. Changing browsers or devices does not transfer it automatically.

## Versioning

Rubies releases use `YYYY.M.D.N` without zero-padding the month or day. The first release made on a date uses iteration `0`; later releases that same date increment it.

## Roadmap

1. **Current 2026.8.6.3 — practical local budgeting**
   - Protected vault, nYNAB import, month-aware targets, simple accounts, editable transactions, money movement, and demo mode
2. **Durable local data**
   - IndexedDB repository and safer large-budget persistence
3. **Transaction workflow**
   - Scheduled transactions, native split editing, payee rules, CSV import, and bulk editing
4. **Optional self-hosted sync and authentication**
   - API service, PostgreSQL, server sessions, multi-device encrypted replication, and conflict handling
5. **Reflection and collaboration**
   - Spending reports, net-worth reports, household sharing, permissions, and audit history
