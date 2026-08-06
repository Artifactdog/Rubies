# Rubies architecture

## Current shape

Rubies 2026.08.06.0 is a static React PWA served by Nginx. It deliberately keeps the first useful release portable: no external cloud account, database, or runtime service is required.

### Layers

- `src/domain.ts` — integer-money domain types, monthly calculations, target progress, Ready to Assign, and demo/empty budget factories
- `src/vault.ts` — PBKDF2 password derivation and AES-GCM encrypted local persistence
- `src/store.ts` — state transitions for assignments, money movement, targets, categories, groups, accounts, and transactions
- `src/App.tsx` — password gate, responsive workspace, dialogs, demo mode, and interaction flows
- `public/sw.js` — PWA app-shell caching
- `nginx.conf` — SPA routing, static caching, and security headers

## Money representation

Every monetary value is stored as an integer number of minor currency units. For USD, `125000` means `$1,250.00`. Floating-point arithmetic is never used for stored budget values.

## Budget model

Ready to Assign is uncategorized on-budget inflow through the selected month minus cumulative category assignments through that month.

A category's available balance is:

```text
all prior assignments
+ all prior categorized activity
+ current month assignment
+ current month categorized activity
```

Moving money changes assignments only. It never changes account balances or creates fake transactions.

## Target model

Rubies currently supports:

- `monthly-spending`: refill the available balance to a target amount
- `monthly-savings`: assign a fixed target amount in the selected month
- `by-date`: calculate a suggested monthly contribution toward a total by a target month

Targets are planning metadata. They do not create transactions or future income.

## Local vault

Persistent state is serialized, encrypted with AES-256-GCM, and stored in browser localStorage. The encryption key is derived from the password using PBKDF2-SHA-256 with a random salt and 310,000 iterations. A random 96-bit IV is generated for every save.

The password is retained only while the budget is unlocked. The UI locks after 15 minutes of inactivity or on demand.

### Threat boundary

This protects local data at rest and prevents casual access to a copied browser storage record. It does not hide the static application shell, replace HTTPS, authenticate at the reverse proxy, defend a compromised browser extension, or provide multi-user server authorization.

## Next architecture step

The next durable release should move the encrypted payload to IndexedDB and add:

- transactional migrations
- append-only change log and undo
- scheduled transactions and reconciliation
- deterministic domain tests
- optional self-hosted API for encrypted multi-device replication

Server-side authentication belongs to that optional API/reverse-proxy layer, not to static client code pretending to be a server session.
