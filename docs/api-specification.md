# SOLARIS API v1

Base URL: `http://localhost:5000/api/v1` (dev).

Envelope: `{ "success": true, "data": …, "meta"?: … }`, or `{ "success": false, "error": { "code", "message", "issues"? } }`.

Auth: `Authorization: Bearer <accessToken>` (15 min). The refresh token is the httpOnly cookie `solaris_rt` (30 days, rotating).

## Public (no account)

| Method | Path | Notes |
|---|---|---|
| GET | `/locations/states` | 36 states + FCT with solar resource; `meta.dataVersion` |
| GET | `/catalog/appliances` | Appliance catalogue (cached 1 h) |
| GET | `/solar/methodology` | Engine/data versions and default assumptions |
| POST | `/energy/audits/estimate` | Energy-only analysis |
| POST | `/solar/designs/estimate` | Full sizing + cost. Not stored |

Example body for `/solar/designs/estimate`:

```json
{
  "location": { "state": "FCT", "city": "Gwarinpa" },
  "gridAvailable": true,
  "backupHours": 8,
  "autonomyDays": 1,
  "batteryChemistry": "LIFEPO4",
  "appliances": [
    { "catalogId": "fridge", "name": "Refrigerator", "quantity": 1, "watts": 150, "hoursPerDay": 12 },
    { "name": "Fan", "quantity": 3, "watts": 60, "hoursPerDay": 10, "nightHoursPerDay": 6 }
  ],
  "assumptions": { "solarDesignBasis": "WORST_MONTH", "panelWatts": 450 }
}
```

## Auth

| Method | Path | Notes |
|---|---|---|
| POST | `/auth/register` | `accountType`: CONSUMER, INSTALLER or VENDOR (the last two need `businessName` and create a PENDING business). ADMIN cannot be self-assigned |
| POST | `/auth/login` | Generic error on bad credentials |
| POST | `/auth/refresh` | Rotates the cookie. A replayed token revokes the session family (`REFRESH_REUSED`); a near-simultaneous replay returns `REFRESH_RACE` |
| POST | `/auth/logout` | Revokes the refresh token |
| GET | `/auth/me` | User, roles and business memberships |

## Designs (signed in, owner only)

| Method | Path |
|---|---|
| POST | `/solar/designs` (body = estimate body + `title`) |
| GET | `/solar/designs?page=&pageSize=` |
| GET | `/solar/designs/:id` |
| POST | `/solar/designs/:id/recalculate` |
| POST | `/solar/designs/:id/request-review` |
| DELETE | `/solar/designs/:id` (archives) |

## Businesses

| Method | Path | Access |
|---|---|---|
| POST | `/organizations` | Any signed-in user. `types`: VENDOR and/or INSTALLER. Caller becomes OWNER |
| GET | `/organizations/mine` | Signed in |
| GET | `/organizations/:orgId` | Members of that business only |

## Admin (platform ADMIN, re-checked against the DB)

| Method | Path |
|---|---|
| GET | `/admin/overview` |
| GET | `/admin/organizations?verification=&type=` |
| PATCH | `/admin/organizations/:id/verification` (`status`, `note`). Audit-logged |
| GET | `/admin/audit-logs` |

## Site configuration (public)

| Method | Path | Notes |
|---|---|---|
| GET | `/site/config` | Branding, SEO, features, announcement, homepage and footer content (cached 10 s) |

## Admin control panel (ADMIN + scoped admin role; SUPER_ADMIN passes all)

| Method | Path | Role |
|---|---|---|
| GET | `/admin/settings` | any admin (returns `canEdit` per key) |
| PUT | `/admin/settings/:key` (`{ value, note? }`) | per key: content/branding/seo/announcement → CONTENT_EDITOR, features → SUPER_ADMIN, pricing → MARKETPLACE_CURATOR |
| GET | `/admin/settings/:key/revisions` | any admin |
| POST | `/admin/settings/:key/revisions/:id/restore` · `/admin/settings/:key/reset` | key's editor role |
| PATCH | `/admin/organizations/:id/curation` · `/admin/products/:id/curation` · `/admin/services/:id/curation` (`isFeatured`, `hidden`, `hiddenReason`) | MARKETPLACE_CURATOR |
| GET/POST/PATCH | `/admin/appliances`, `/admin/appliances/:id` | MARKETPLACE_CURATOR |
| GET/POST | `/admin/team` (grant by email) | SUPER_ADMIN |
| PATCH/DELETE | `/admin/team/:userId` | SUPER_ADMIN |
| GET | `/admin/audit-logs?action=` | OPERATIONS |

## Marketplace (public; verified businesses only)

| Method | Path | Notes |
|---|---|---|
| GET | `/marketplace/products?q&category&state&minPrice&maxPrice&inStock&seller&sort&page` | `sort`: relevance (featured first), price_asc, price_desc, newest |
| GET | `/marketplace/products/:orgSlug/:productSlug` | Product detail + seller card |
| GET | `/marketplace/services?q&category&state` | Installer services |
| GET | `/marketplace/businesses?q&type&state` | Sellers / installers directory |
| GET | `/marketplace/businesses/:slug` | Storefront with published products and services |

## Business workspace (member of `:orgId`; permission noted)

| Method | Path | Permission |
|---|---|---|
| GET | `/organizations/:orgId/workspace` | any member |
| PATCH | `/organizations/:orgId/profile` | MANAGE_PROFILE |
| GET/POST | `/organizations/:orgId/products` | read: member · write: MANAGE_PRODUCTS |
| GET/PATCH/DELETE | `/organizations/:orgId/products/:id` | MANAGE_PRODUCTS (DELETE archives) |
| PATCH | `/organizations/:orgId/products/:id/stock` | MANAGE_INVENTORY |
| GET/POST/PATCH/DELETE | `/organizations/:orgId/services[/:id]` | MANAGE_SERVICES |
| POST | `/uploads/images` (multipart `file`) | any business member · JPEG/PNG/WebP ≤ 5 MB |

## Messaging (signed in)

| Method | Path | Notes |
|---|---|---|
| POST | `/conversations` | `{ organizationId, contextType?, contextId?, subject?, message }`. Continues an existing thread about the same thing |
| GET | `/conversations?inbox=customer\|<orgId>` | My threads, or a business inbox (needs MESSAGE_CUSTOMERS) |
| GET | `/conversations/unread-count` | `{ customer, businesses: { [orgId]: n }, total }` |
| GET | `/conversations/:id` | Thread + context (product / service / shared design). 404 for non-participants |
| POST | `/conversations/:id/messages` · `/conversations/:id/read` | Reply · mark read |

## Quotations

| Method | Path | Who |
|---|---|---|
| POST | `/organizations/:orgId/quotations` | MANAGE_QUOTATIONS. `{ conversationId, title?, lineItems[{kind: PRODUCT\|SERVICE\|CUSTOM, productId?, serviceId?, description, quantity, unitPrice}], discount, applyVat, notes?, validDays?, send }`. Totals are computed by the server |
| GET | `/organizations/:orgId/quotations?status=` | MANAGE_QUOTATIONS |
| POST | `/organizations/:orgId/quotations/:id/revisions` | MANAGE_QUOTATIONS. Creates revision n+1 (earlier revisions are immutable) |
| POST | `/organizations/:orgId/quotations/:id/withdraw` | MANAGE_QUOTATIONS |
| GET | `/quotations` · `/quotations/:id` | customer (drafts hidden), or staff with MANAGE_QUOTATIONS / MESSAGE_CUSTOMERS |
| POST | `/quotations/:id/accept` | customer. `{ revision, deliveryAddress }`. Must be the current revision → creates the order |
| POST | `/quotations/:id/reject` | customer. `{ reason? }` |

## Orders & payments

| Method | Path | Who |
|---|---|---|
| GET | `/orders` · `/orders/:id` | customer, or seller staff (MANAGE_ORDERS / MESSAGE_CUSTOMERS). Seller view includes `sellerReceives` |
| POST | `/orders/:id/pay` | customer → `{ authorizationUrl, reference }`. 409 `SELLER_PAYOUTS_NOT_READY` if the seller hasn't connected payouts |
| POST | `/orders/:id/verify-payment` | participant. `{ reference }`. Speeds up confirmation; the webhook is the source of truth |
| POST | `/orders/:id/cancel` | customer or seller (awaiting payment only) |
| POST | `/orders/:id/confirm-delivery` | customer |
| GET | `/organizations/:orgId/orders` | MANAGE_ORDERS |
| PATCH | `/organizations/:orgId/orders/:id/status` | MANAGE_ORDERS. Allowed: PAID→PROCESSING→READY/SHIPPED→DELIVERED; PENDING_PAYMENT→CANCELLED |
| POST | `/payments/paystack/webhook` | Paystack only (HMAC-SHA512 signature), outside `/api/v1` rate limits; re-verifies the charge with Paystack |
| GET | `/payments/banks` | signed in |
| GET/PUT | `/organizations/:orgId/payouts`, POST `/organizations/:orgId/payouts/resolve` | MANAGE_BILLING. Creates the Paystack subaccount; stores masked details only |
| POST | `/payments/mock/:reference/complete` | development only (`PAYMENTS_PROVIDER=mock`) |

## Planned

`/reviews`, `/organizations/:orgId/members` (staff invitations), projects & installations.
