# Rubies Budget

Rubies is a self-hosted, local-first budget management PWA inspired by zero-based envelope budgeting and Obsidian-style workspace principles: calm density, keyboard-friendly navigation, offline resilience, and user-owned data.

This repository currently contains the first functional vertical slice. It supports monthly envelope assignments, category rollover, account registers, expenses and inflows, installable PWA behavior, JSON backup/restore, and Docker deployment.

> Rubies is an independent project. It is not affiliated with or endorsed by YNAB or Obsidian.

## What works

- Give available cash a job through monthly category assignments
- Automatically roll positive or negative category balances into later months
- Record categorized expenses and uncategorized inflows
- View all transactions or filter by account
- Track monthly targets with funded, underfunded, and overspent states
- Persist the entire budget locally in the browser
- Export and import a human-readable JSON backup
- Install the app to a phone home screen or desktop app launcher
- Use the app offline after it has been loaded once
- Deploy as one static Docker container
- Keyboard shortcuts: `P` for Plan, `A` for Accounts, `N` for New transaction

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

For browser-promoted PWA installation outside localhost, serve Rubies through HTTPS. A reverse proxy such as Caddy, Traefik, or Nginx can terminate TLS in front of the container.

## Build and verify

```bash
npm install
npm run typecheck
npm run build
docker build -t rubies-budget .
```

## Current storage model

The current release stores one budget in browser `localStorage`. This gives the first version immediate local ownership, offline behavior, and zero server configuration. Export regularly while the sync layer is under development.

The planned persistence architecture is local-first IndexedDB plus an optional self-hosted sync API. See [docs/architecture.md](docs/architecture.md).

## Product roadmap

1. **Foundation — current slice**
   - Zero-based plan, account register, rollover, PWA, local backup, Docker image
2. **Durable local data**
   - IndexedDB repository, schema migrations, undo history, reconciliation, scheduled transactions
3. **Self-hosted sync**
   - Optional API, PostgreSQL, encrypted sessions, multi-device replication, conflict handling
4. **Full budgeting workflow**
   - Credit-card payment categories, loans, targets, auto-assign, payee rules, split transactions, CSV import
5. **Reflection and collaboration**
   - Spending and net-worth reports, household sharing, permissions, audit log, accessible command palette

## Design principles

- **Plan only money that exists.** Future income is not available until recorded.
- **Every number is inspectable.** Budget totals derive from assignments and transaction ledgers.
- **Local is the default.** The app works without an account or external service.
- **Export is a feature, not an escape hatch.** Data remains portable and understandable.
- **Dense, calm, keyboard-friendly UI.** Desktop power without making mobile feel secondary.
- **Progressive enhancement.** The website remains usable while PWA installation adds app-like behavior.
