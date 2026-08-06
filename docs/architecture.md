# Rubies architecture

## Current shape

Rubies 2026.8.6.3 is a static React PWA served by Nginx. It requires no external cloud account, database, or runtime service.

### Layers

- `src/domain.ts` — version-4 data model, integer-money calculations, target recommendations, Ready to Assign, migration, and nYNAB import
- `src/vault.ts` — PBKDF2 password derivation and AES-GCM encrypted local persistence
- `src/store.ts` — assignments, money movement, target snoozing, categories, groups, simple accounts, and transactions
- `src/App.tsx` — password gate, responsive workspace, confirmed allocation editing, undo, and allocation history, dialogs, import, and demo mode
- `tests/domain.test.mjs` — schedule, future-month funding, migration, snoozing, and nYNAB import regression tests
- `public/sw.js` — PWA app-shell caching
- `nginx.conf` — SPA routing, static caching, and security headers

## Money representation

Every monetary value is stored as an integer number of minor currency units. For USD, `125000` means `$1,250.00`.

nYNAB exports use milliunits. The importer converts them according to `currency_format.decimal_digits`; for a two-decimal currency, `14520000` nYNAB milliunits become `1452000` Rubies minor units, or `14,520.00`.

## Version-4 budget model

Accounts intentionally have no type. Every account participates in the budget, and its balance is the sum of its transactions.

Transactions intentionally have no cleared state or credit-card behavior. A transaction either belongs to a category or has a null category and therefore affects Ready to Assign.

Ready to Assign starts from uncategorized account cash flow and cumulative assignments. For past months, later assignment deficits consume older unassigned funding lots first, so revisiting June cannot resurrect money that was subsequently assigned in July. Current or latest months still show a negative value when the plan is over-assigned.

A category's available balance is:

```text
all prior assignments
+ all prior categorized activity
+ selected-month assignment
+ selected-month categorized activity
```

Moving money changes assignments only. It never changes account balances or creates transactions.

Confirmed assignment changes, moves, and auto-assign operations append a persistent allocation event. Imported nYNAB budgets receive month-level assignment snapshots because the export does not contain the original click-by-click allocation log. The in-memory store keeps reversible state snapshots for undo and redo; restoring a snapshot also restores the corresponding allocation log.

Because Rubies has only cash-style accounts, a negative category balance does not roll into the next month. The category starts the next month at zero and the deficit is deducted from the next month’s Ready to Assign. This matches the month snapshots in nYNAB exports.

## Target recommendations

Every target result contains distinct values for:

```text
requiredThisMonth
leftToAssign
overallLeft
progress
```

Recurring set-aside targets calculate `requiredThisMonth` from the number of due occurrences in the selected month. Refill targets account for carried available money. Deadline targets divide the remaining balance by the number of months left, so selecting a later future month produces a larger recommendation when nothing was funded in the intervening months.

Snoozed months produce a zero recommendation without deleting the target.

## nYNAB import boundary

The importer recognizes the `data.plan` JSON shape and maps:

- accounts to the single Rubies account model
- user categories and groups while dropping internal system categories
- month category `budgeted` values to Rubies assignments
- optional transaction payees, categories, transfers, and amounts
- nYNAB goal cadence fields to Rubies schedules and deadlines
- `goal_snoozed_at` month snapshots to target snoozing
- subtransactions to flattened normal transactions

Account balance adjustments are added only when the imported transaction sum does not match the exported account balance.

Scheduled transactions are not yet represented and result in a visible warning.

## Local vault

Persistent state is serialized, encrypted with AES-256-GCM, and stored in browser localStorage. The encryption key is derived from the password using PBKDF2-SHA-256 with a random salt and 310,000 iterations. A random 96-bit IV is generated for every save.

Older vault payloads are normalized to version 5 when unlocked. Account notes, transaction memos, and month notes are intentionally discarded; category notes are retained.

## Threat boundary

The vault protects local data at rest. It does not hide the static application shell, replace HTTPS, authenticate at the reverse proxy, defend a compromised browser extension, or provide multi-user server authorization.
