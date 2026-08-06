# Rubies architecture

## Product model

Rubies follows a zero-based envelope model:

- Budget accounts contain money that can be assigned.
- Uncategorized inflows increase **Ready to Assign**.
- Monthly assignments move money from Ready to Assign into categories.
- Categorized transactions change category activity and account balances.
- Category availability is cumulative: prior availability + current assignment + current activity.
- Positive and negative category balances roll into later months.

All monetary values use integer minor units to avoid floating-point rounding errors.

## Current application boundary

The first release is a client-only React application built with Vite and served by Nginx.

```text
Browser / installed PWA
├── React workspace UI
├── Pure budget calculations
├── localStorage repository
├── JSON import/export
└── Service worker app-shell cache

Docker container
└── Nginx static server
```

This boundary is intentional: it validates the budgeting interaction model and responsive workspace before introducing authentication and distributed state.

## Target architecture

```text
Browser / installed PWA
├── React workspace UI
├── Domain command layer
├── IndexedDB local event store
├── Background sync worker
└── Encrypted export/import
          │
          │ optional HTTPS sync
          ▼
Self-hosted API
├── Authentication and household membership
├── Change feed / replication protocol
├── Validation and idempotency
├── Import jobs and bank adapters
└── PostgreSQL
```

### Local-first repository

The next storage layer should expose a repository interface rather than allowing components to access IndexedDB directly. Commands write immutable changes and projections derive the current budget view. This enables:

- schema migrations
- undo and audit history
- deterministic sync
- optimistic UI
- offline writes
- testable budget calculations

### Sync strategy

Use client-generated UUIDs, monotonic per-device sequence numbers, idempotent mutation IDs, and server-assigned change cursors. Most records can use last-write-wins metadata, but financial records should prefer explicit conflicts over silent overwrites. Reconciliation state and transaction edits need an auditable history.

### Server deployment

The production Docker Compose profile should eventually contain:

- `web`: static UI and reverse proxy
- `api`: stateless application server
- `db`: PostgreSQL with a persistent volume
- optional `worker`: imports, notifications, and scheduled jobs

Single-user installations should retain a one-command setup and support an embedded database profile when safe migrations and backups are in place.

## Domain modules planned

- budgets and households
- accounts and reconciliation
- payees and rules
- transactions and splits
- category groups and categories
- monthly assignments and targets
- credit-card payment handling
- scheduled transactions
- imports and duplicate matching
- reports and net worth
- sync changes and audit events

## Security baseline for the sync phase

- HTTPS-only session cookies
- password hashing with a memory-hard algorithm
- CSRF protection on state-changing requests
- strict content security policy
- encrypted secrets at rest
- rate limiting on authentication and imports
- per-household authorization on every record access
- backup verification and documented restore procedures

## Accessibility baseline

- complete keyboard operation
- visible focus states
- semantic tables or equivalent grid relationships
- no status conveyed by color alone
- reduced-motion support
- minimum mobile touch target sizing
- screen-reader labels for monetary inputs and icon controls
