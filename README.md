# Rubies

Rubies is a self-hosted, single-user, local-first zero-based budgeting PWA. It is designed around one budget, one owner, simple accounts, category-based allocation, and data that stays under your control.

Rubies runs as a static web application. Persistent budget data is encrypted in the browser before it is stored locally.

## Quick start with Docker

```bash
docker compose up --build
```

Open `http://localhost:8080`.

For installation as a PWA outside localhost, serve Rubies through HTTPS.

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

To run the same checks used by CI:

```bash
npm run typecheck
npm test
npm run build
docker build -t rubies-budget .
```

## Product model

Rubies intentionally keeps the budgeting model small and predictable:

- One budget per browser origin/profile. There is no user-facing plan naming or multi-budget switcher.
- Categories belong to editable groups and can have notes and month-aware targets.
- Money can be assigned, unassigned, auto-assigned, or moved between categories and Ready to Assign.
- Allocation changes are undoable and recorded separately from transaction history.
- All accounts use the same account model. There are no credit-card, cash, tracking, cleared/uncleared, or reconciliation modes.
- Transactions are income or expenses. Payee is optional. Notes exist only on categories.
- Category targets support recurring schedules, refill behavior, set-aside behavior, deadlines, custom dates, and snoozing.
- Desktop and mobile use the same budget data and calculations, with layouts tailored to each form factor.

## nYNAB import

Rubies can import nYNAB API-style JSON plan exports as well as Rubies JSON backups.

The importer maps accounts, categories, groups, category notes, assignments, transactions, payees, targets, snoozed months, and historical month data into the Rubies model. Internal system categories are excluded. Split transactions are flattened into normal Rubies transaction entries.

Scheduled transactions are not yet represented in Rubies and are reported as an import warning.

The source plan name may be retained internally for import provenance and backward-compatible serialized data, but Rubies itself does not expose a budget-name feature.

Importing replaces the current budget only after explicit confirmation.

## Storage and backups

The encrypted vault is stored in browser `localStorage` for the current origin and browser profile. Clearing site data deletes that vault. Moving to another browser, profile, device, or hostname does not transfer it automatically.

Rubies JSON exports are intentionally portable and human-readable. They are **not encrypted**, so store them as you would any other sensitive financial document.

There is no password recovery. Keep regular exports somewhere safe.

## Security boundary

The Rubies password decrypts the locally stored budget vault. It is not HTTP authentication and does not stop someone who can reach the server from downloading the public HTML, CSS, and JavaScript application shell.

Use HTTPS in normal deployments. If the Rubies URL itself must be private, place it behind an authenticating reverse proxy or another server-side access-control layer.

See [SECURITY.md](SECURITY.md) for the full threat boundary and cryptographic details.

## Architecture

See [docs/architecture.md](docs/architecture.md) for the data model, budgeting calculations, persistence, import behavior, UI/runtime structure, and deployment architecture.

## Versioning

Rubies releases use `YYYY.M.D.N` without zero-padding the month or day. The first release on a date uses iteration `0`; subsequent releases that day increment the final number.
