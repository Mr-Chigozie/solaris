# SOLARIS

**The open marketplace and operating platform for the solar industry.** Nigeria first, Africa next.

Customers size systems, buy equipment and hire installers. Vendors run storefronts. Installers quote, schedule and manage installations. Everyone works inside one connected platform. SOLARIS Intelligence (solar sizing, monitoring, analytics) runs underneath.

> Status: **Foundation v1 + Release 2**. Open solar calculator, accounts, multi-tenant businesses with staff permissions, verification, saved designs, admin control panel, public storefronts, listings with photos, marketplace search, installer directory, in-app messaging, **quotations, orders and Paystack split payments with seller payouts**. See [docs/architecture.md](docs/architecture.md) for what comes next.

## Repository layout

```
apps/
  api/                 Express 5 + TypeScript REST API (modular monolith)
    prisma/            PostgreSQL schema, migrations, seed
    src/modules/       auth · catalog · calculator · designs · organizations · business ·
                       marketplace · messaging · uploads · settings · admin
  web/                 Next.js 16 + Tailwind 4 web app (public site + role dashboards)
packages/
  solar-engine/        Pure-TypeScript solar sizing engine (no framework/DB deps, unit-tested)
  validation/          Zod request schemas shared by API and web
docs/                  Architecture, calculation methodology, API reference
```

## Prerequisites

- Node.js 22+ (developed on 24)
- PostgreSQL 15+ with a **UTF-8** database (needed for "₦", Nigerian names and emoji; the API warns at startup otherwise). **Optional for local dev:** `npm run db:local` starts a bundled UTF-8 PostgreSQL with no installation.

## First-time setup

```bash
npm install                                   # installs all workspaces + generates the Prisma client
cp apps/api/.env.example apps/api/.env        # then set JWT_ACCESS_SECRET (command in the file)
cp apps/web/.env.example apps/web/.env.local
```

Start a database (pick one):

```bash
npm run db:local -w @solaris/api              # terminal 1, leave it running (data in apps/api/.pgdata)
# or point DATABASE_URL in apps/api/.env at your own PostgreSQL / Neon / Supabase
```

Create the schema and seed reference data (appliances, the SOLARIS platform business and the first admin):

```bash
npm run db:migrate
npm run db:seed
```

Optional demo marketplace data (two clearly labelled demo businesses with listings and logins):

```bash
npm run db:seed:demo -w @solaris/api              # remove again with: npm run db:seed:demo -w @solaris/api -- --remove
```

### Payments

Local development uses a **simulated checkout** (`PAYMENTS_PROVIDER=mock`, the default). No keys or real money are involved. To test with Paystack, put your **test** secret key in `apps/api/.env`:

```bash
PAYMENTS_PROVIDER=paystack
PAYSTACK_SECRET_KEY=<your test secret key, starts with sk_test_>   # never commit this
```

Sellers connect a payout bank account under *My business → Payouts*. Payments settle to them directly through Paystack subaccounts, minus SOLARIS's commission.

## Run

```bash
npm run dev            # API on :5000 and web on :3000
```

- Web: http://localhost:3000. The calculator at `/calculator` needs no account.
- API: http://localhost:5000/api/v1. Health check: http://localhost:5000/health
- Admin login: the `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` from `apps/api/.env`. **Change these before any shared deployment.**

## Test & build

```bash
npm test               # engine unit tests + API tests (DB integration tests auto-skip without a database)
npm run typecheck
npm run build          # API bundle (apps/api/dist) + Next.js production build
```

## Principles

1. **Open marketplace.** SOLARIS is a participant, not the gatekeeper. Any verified business can sell and install here, and SOLARIS's own store follows the same rules.
2. **Estimate ≠ approved design ≠ measurement.** These are always labelled and stored separately.
3. **Reproducible engineering.** Each saved design stores its engine version, data version and every assumption.
4. **Tenant-scoped security.** Being staff at one business grants nothing at another.
5. **Never hold funds.** Payments go through licensed providers (Paystack / Flutterwave).
