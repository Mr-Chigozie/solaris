# SOLARIS architecture

## 1. Product model

SOLARIS is **the open marketplace and operating platform for the solar industry**. It is not a directory and not a calculator with a contact form. Customers, vendors and installers **transact and run their work inside the platform**.

| Capability | Customer | Vendor | Installer |
|---|---|---|---|
| Browse marketplace | ✓ | ✓ | ✓ |
| Publish products | – | ✓ | optional |
| Publish services | – | – | ✓ |
| In-app messaging | ✓ | ✓ | ✓ |
| Enquiries & quotations | request | respond | respond |
| Orders | track | manage | relevant jobs |
| Reviews | submit | receive | receive |
| Business dashboard | – | ✓ | ✓ |
| Projects | view own | related orders | manage |

**Open-marketplace principle.** SOLARIS is a participant, not the gatekeeper. SOLARIS's own trading entity is an `Organization` with `isPlatformOwned = true`. It runs a storefront and services under the same rules as every other business, and is labelled as official. Supply can then grow without SOLARIS owning inventory or employing installers.

### Three layers

| Layer | Purpose | Main models |
|---|---|---|
| **Commerce** | What is bought and sold | `Product`, `Service`, `Order`, `OrderItem`, `OrderEvent`, `Payment`, `Review` |
| **Operations** | How the work gets done | `Conversation`, `Message`, `Quotation`, `QuotationRevision`, `Project`, `ProjectMilestone`, `Installation`, `MaintenanceRecord` |
| **Intelligence** | Energy knowledge | `EnergyAudit`, `SolarDesign`, `EnergyReading`, and the `@solaris/solar-engine` package |

The connected flow, without leaving SOLARIS:

```
design → conversation with a business → quotation (immutable revisions) → accept
       → order (+ payment via provider) / project (+ milestones) → installation → readings & maintenance → review
```

## 2. Multi-tenant business accounts

- A **User** is a person. Everyone is a customer by default (`roles` includes `CONSUMER`).
- An **Organization** is a business tenant. `types` can be `VENDOR`, `INSTALLER` or both, since many Nigerian companies sell and install.
- **OrganizationMember** links people to businesses with a `role` (OWNER / ADMIN / MEMBER) and, for members, fine-grained `permissions` (`MANAGE_PRODUCTS`, `MANAGE_INVENTORY`, `MESSAGE_CUSTOMERS`, `MANAGE_QUOTATIONS`, `MANAGE_ORDERS`, `MANAGE_PROJECTS`, `VIEW_ANALYTICS`, `MANAGE_BILLING`, …).
- One person can buy from one business, work as staff at another and own a third. Registration as installer/vendor creates a business; an existing customer can open one later (`POST /organizations`).

Authorisation layers (API middleware):

| Check | Middleware | Example |
|---|---|---|
| Signed in | `requireAuth` | save a design |
| Platform role (re-read from DB) | `requireRole('ADMIN')` | verify a business |
| Member of *this* business | `requireOrgRole(getOrgId)` | open business workspace |
| Staff permission in *this* business | `requireOrgPermission(getOrgId, 'MANAGE_PRODUCTS')` | edit listings |
| Ownership of a personal record | query scoped by `userId` → 404 if not yours | view a design |

**Rules.** Every business-owned row carries `organizationId`. Never authorise on a role claim alone. Cross-tenant access returns 403 for workspaces and 404 for personal records, so the existence of other people's records is never revealed.

**Verification.** New businesses start `PENDING`. An admin moves them to `VERIFIED` / `REJECTED` / `SUSPENDED`, and every change is written to `AuditLog` with a note. The "verified" badge means SOLARIS reviewed business registration, credentials and evidence of past work. It does **not** mean SOLARIS certified technical competence.

## 3. System architecture

```
Next.js web (public site · customer · business workspace · admin)
        │  HTTPS / JSON  (access token in memory, rotating refresh token in httpOnly cookie)
Express API: modular monolith
  auth · catalog · calculator · designs · organizations · admin   (built)
  products · services · messaging · quotations · orders · payments · projects · reviews   (Release 2)
        │
PostgreSQL (Prisma 7, driver adapter) · object storage (images, documents) · Redis (later)
        │
Integrations: Paystack/Flutterwave · email/SMS · maps · inverter APIs / MQTT (Release 3)
```

**Why a modular monolith.** It is one deployable with clear module boundaries. Modules talk through service functions, not across each other's tables. The solar engine is a separate package so it can later ship as a paid API without change.

## 4. Commerce design decisions

- **One order = one customer × one business.** A cart that spans several sellers is split into one order per seller, so each business only ever sees its own orders.
- **Snapshots, not live links.** `QuotationRevision.lineItems`, `OrderItem.snapshot` and `DesignComponent.snapshot` freeze price and specs at the time they are created. A vendor changing a price never silently changes a sent quote.
- **Commission captured on the order** (`commissionRate`, `commissionAmount`) so plan-specific rates are auditable.
- **Payments.** SOLARIS never holds card data or customer funds. Payment status changes only through verified provider webhooks (idempotent on `providerRef`). Split payouts / escrow will use the provider's subaccount features, subject to merchant onboarding and compliance.
- **Reviews require a completed order or project** (`orderId` / `projectId` unique), so only real customers can rate a business.
- **Promoted listings** use `promotedUntil` on `Product` / `Service`. They must always be visibly labelled as promoted.

## 5. Revenue model (built into the data model)

| Stream | Where it lives |
|---|---|
| Marketplace commission | `Order.commissionRate/commissionAmount` |
| Vendor / installer subscriptions | `Subscription.plan` per organisation (FREE by default; no fee to join) |
| Promoted listings | `Product.promotedUntil`, `Service.promotedUntil` |
| Premium intelligence | design/report features gated by plan |
| Engine API | `@solaris/solar-engine` behind API keys (later) |

**Liquidity first.** Joining and listing are free at launch. Charge for tools (CRM, quotations, analytics, inventory) and for visibility, not for access.

## 6. Roadmap

| Release | Scope |
|---|---|
| **Foundation v1** ✅ | Monorepo, solar engine, open calculator, auth (Argon2id, rotating refresh tokens, reuse detection), multi-tenant businesses + staff permissions, verification workflow, saved designs, admin, full commerce/operations schema |
| **R2 Commerce** | Storefronts, product & service listings (with images), marketplace search by state/category, messaging, quotation requests + revisions, orders, Paystack checkout + webhooks, reviews, business staff invitations |
| **R3 Operations & Intelligence** | Projects & milestones, installation registry (serials, warranties), manual + device energy readings, maintenance schedules, alerts, first inverter integrations |
| **R4 Expansion** | Mobile apps, financing / PAYG partners, public engine API, AI recommendations, other African markets |

## 7. Admin control panel

Admin users (`roles` includes `ADMIN`) get scoped **admin roles**. `SUPER_ADMIN` implies every other role.

| Area (`/admin/...`) | What it controls | Role |
|---|---|---|
| Site content | Homepage copy, footer, announcement banner | CONTENT_EDITOR |
| Branding & SEO | Name, logo, colours, font, corner style; search & social metadata | CONTENT_EDITOR |
| Features | Calculator, marketplace, directory, each sign-up type, demo monitoring, maintenance mode | SUPER_ADMIN |
| Marketplace | Feature/hide businesses (and products/services via API), appliance catalogue, reference prices | MARKETPLACE_CURATOR |
| Verification | Verify / reject / suspend businesses | OPERATIONS |
| Admin team | Grant, change, revoke admin roles (the last super admin can't be removed) | SUPER_ADMIN |
| Audit log | Browse every audited action | OPERATIONS |

**How it works**
- Settings are rows in `site_settings`, one per key. Each key has a Zod schema in `@solaris/validation` (`SITE_SETTING_SCHEMAS`) with built-in defaults. The API validates on save and re-validates on read.
- Every save appends an immutable `site_setting_revisions` row and an audit entry. Restoring an old version publishes it as a *new* version, so history is never rewritten.
- The web app reads `GET /site/config` on the server (revalidated every ~5 s). Admin changes go live without a redeploy. If the API is down, the site renders with defaults.
- Branding becomes CSS variables (`--brand-primary`, `--brand-secondary`, `--brand-bg`, `--brand-font`, `--brand-radius`…). Tailwind colour scales are derived from them with `color-mix`, so two colours re-theme the whole UI.
- Feature toggles are **enforced by the API** (registration returns 403 `REGISTRATION_CLOSED`, a disabled calculator returns 503 `FEATURE_DISABLED`, maintenance returns 503 `MAINTENANCE` for everyone except admins), as well as hidden in the UI.
- Reference prices are a server-side baseline for the engine (`referencePrices`), separate from user overrides. They are never exposed publicly.
- Page layout and icons are fixed in code, and editors change wording only. That keeps the premium design consistent no matter who edits content.

## 8. Security baseline

Argon2id (OWASP params) · short-lived JWT + rotating refresh tokens with theft detection and a 10 s multi-tab grace window · roles re-read from the DB for privileged routes · Zod validation on every input · rate limits (global, auth, calculator) · 100 kB body limit · Helmet headers · CORS allow-list · audit log for security, admin and financial actions · Nigeria Data Protection Act 2023 consent captured at registration.
