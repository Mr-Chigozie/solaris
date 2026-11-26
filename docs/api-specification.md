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

## Release 2 (planned)

`/marketplace/products`, `/marketplace/services`, `/businesses/:slug` (storefront), `/organizations/:orgId/products|services|members|orders|quotations`, `/conversations`, `/conversations/:id/messages`, `/quotations/:id/revisions`, `/quotations/:id/accept`, `/orders`, `/payments/paystack/webhook`, `/reviews`.
