# Rubies Budget

Rubies is a self-hosted, local-first budget management PWA inspired by zero-based envelope budgeting and Obsidian-style workspace principles: calm density, keyboard-friendly navigation, offline resilience, and user-owned data.

> Rubies is an independent project. It is not affiliated with or endorsed by YNAB or Obsidian.

## What works in 2026.08.06.0

### Budgeting

- Monthly zero-based assignments with category balance rollover
- Editable category names, groups, notes, and targets
- Three target behaviors:
  - Refill a category balance on its schedule
  - Assign a fixed amount on its schedule
  - Save a total amount by a deadline
- Weekly, monthly, yearly, and every-N-period schedules
- Exact first due dates, including weekday/day-of-month alignment
- Repeating deadline goals every N months or years
- Custom irregular occurrence dates and custom future deadlines
- Monthly target calculations automatically count every scheduled occurrence
- One-click target funding and target auto-assignment
- Move money between categories or back to Ready to Assign
- Direct assignment editing with immediate budget recalculation
- Editable and collapsible category groups
- Category archiving without destroying transaction history

### Accounts and transactions

- Add and edit cash, credit, and tracking accounts
- Opening balances
- Add, edit, and delete income or expense transactions
- Account filtering and live balances
- Cleared and uncleared transaction state

### Access and data protection

- Mandatory password setup before creating a persistent budget
- Password-gated unlock screen on every new browser session
- PBKDF2-SHA-256 password derivation and AES-256-GCM encrypted local vault
- Automatic lock after 15 minutes of inactivity
- Manual lock and password change
- One-click temporary demo mode with realistic pre-filled data
- Human-readable JSON export and import

### App and deployment

- Responsive desktop and mobile layouts
- Installable PWA with offline app-shell caching
- Docker and Docker Compose deployment
- CSP and browser hardening headers in the bundled Nginx configuration
- Keyboard shortcuts: `P` Plan, `A` Accounts, `N` New transaction, `M` Move money

## Security model

The current version is a static, single-device PWA. The saved budget is encrypted before it is written to browser storage. The password is kept only in the unlocked page's memory and is not stored. Locking or closing the page removes access to decrypted data.

This protects budget data at rest in the browser, but it is not server-side user authentication. The HTML and JavaScript application shell remains publicly downloadable from the web server. For network-level access control, place Rubies behind HTTPS and an authenticating reverse proxy such as Authelia, Authentik, OAuth2 Proxy, or your server platform's access-control layer.

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

For PWA installation outside localhost, serve Rubies through HTTPS. A reverse proxy such as Caddy, Traefik, or Nginx can terminate TLS in front of the container.

## Build and verify

```bash
npm install
npm run typecheck
npm test
npm run build
docker build -t rubies-budget .
```

## Storage and recovery

The encrypted vault is stored in browser `localStorage` on the current device and browser profile. There is no password recovery because Rubies never stores the password. Keep regular exports until the optional self-hosted sync service is implemented.

Clearing browser site data deletes the local vault. Changing browsers or devices does not transfer it automatically.

## Versioning

Rubies releases use `YYYY.MM.DD.N`. The first release made on a date uses iteration `0`; later releases that same date increment it.

## Roadmap

1. **Current 2026.08.06.0 — useful local budgeting**
   - Protected local vault, editable categories, full target scheduling, money movement, accounts, editable transactions, demo mode
2. **Durable local data**
   - IndexedDB repository, migrations, undo history, scheduled transactions, reconciliation, split transactions
3. **Full nYNAB-style behavior**
   - Credit-card payment categories, cash overspending treatment, payee rules, CSV import, bulk editing
4. **Optional self-hosted sync and authentication**
   - API service, PostgreSQL, server sessions, multi-device encrypted replication, conflict handling
5. **Reflection and collaboration**
   - Spending and net-worth reports, household sharing, permissions, audit log, command palette
