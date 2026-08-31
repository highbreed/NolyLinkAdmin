# OSCU Gateway — Admin Portal Design

**Status:** design proposal
**Builds on:** `api_reference.md`, `client_onboarding_and_monitoring.md`
**Problem it solves:** today, onboarding/monitoring a client is a mix of `curl` against admin
endpoints, a **direct SQL `INSERT` into `clients`** (there's no `POST /v1/clients` endpoint —
called out explicitly as a gap in the onboarding doc), and grepping logs/Prometheus by hand.
There's no UI, no per-admin-user attribution (everyone shares one `X-Admin-Api-Key`), and no
proactive view of "who's about to lose access" or "who's failing right now." This document
designs the portal that fixes that.

---

## 1. What this portal is (and isn't)

**Is:** an internal, admin-only web application for Amina's team to (a) register clients and
their KRA devices without touching SQL, (b) manage each client's billing/subscription status
and see the effect on their access in real time, and (c) monitor KRA call health, sync lag, and
outbox backlogs per client and system-wide.

**Isn't:** a customer-facing portal. Brian (Jitihada's developer) never logs into this — his
world stays exactly `sap_integration_guide.md` + `POST /oauth/token` + the client-bearer API.
Nothing here changes the client-facing contract in `api_reference.md`.

---

## 2. Users & roles

Today there is exactly one credential (`X-Admin-Api-Key`) and it can do everything, with no
record of *which human* did it. The portal replaces that with real admin accounts and RBAC.

| Role | Can do | Cannot do |
|---|---|---|
| **Superadmin** | Everything below, plus manage admin users/roles | — |
| **Ops** | Register clients/devices, view all monitoring, retry outbox items, reactivate a client whose grace period lapsed by accident | Suspend/cancel for billing reasons, manage admin users, edit alert-rule thresholds |
| **Billing admin** | Full billing lifecycle (subscriptions, invoices, suspend/reactivate/cancel) | Register devices, retry outbox items, manage admin users |
| **Auditor (read-only)** | View everything: dashboards, client detail, audit log, billing history | Any write action anywhere |

Every write action — regardless of role — is recorded in an **admin audit log** (§7) with who,
what, before/after values, and (where applicable, e.g. suspend) the reason text.

`X-Admin-Api-Key` is **kept but demoted** to a break-glass credential for bootstrap (creating
the first superadmin) and CI/scripted use — not the portal's normal auth path. It should be
rotatable independently and its use logged distinctly from named-admin actions so a shared-key
action never gets attributed to a specific person by mistake.

> **Frontend build note (2026-08-28):** the `/admin/api/v1/auth/*` + `admin_users` backend
> described in §4/§5.1 does not exist yet — confirmed against the live backend repo. Per
> product decision, v1 of this frontend authenticates with the existing real credential
> (`X-Admin-Api-Key`, entered once, held in memory, sent as a header) rather than building a
> login form against a backend that isn't there. The role concept in this table is preserved
> in the UI/types layer (so nothing has to be re-architected later) but is not currently
> enforced by a real per-user identity — see `docs/frontend_README.md` for exactly what's
> real vs. mocked.

---

## 3. Where this lives (architecture)

```
                        ┌─────────────────────────────┐
                        │   Admin Portal SPA (React)   │
                        │  served separately, own origin│
                        └───────────────┬──────────────┘
                                         │ HTTPS, cookie-based session (JWT)
                                         ▼
 ┌───────────────────────────────────────────────────────────────────────┐
 │                     Existing FastAPI app (oscu-gateway)                │
 │  ┌───────────────┐  ┌──────────────────────────────────────────────┐  │
 │  │ /v1/* (client) │  │ /admin/api/v1/* (NEW — this design)          │  │
 │  │ /oauth/token   │  │  auth · clients · devices · billing ·        │  │
 │  │ (unchanged)    │  │  monitoring · alerts · audit-log · users     │  │
 │  └───────┬────────┘  └───────────────┬──────────────────────────────┘  │
 │          │  reuses the same services (billing_service, code_cache,     │
 │          │  kra_adapter-facing read models) — no duplicate logic       │
 └──────────┼──────────────────────────┼─────────────────────────────────┘
            ▼                          ▼
      Postgres (branches, clients,  Postgres (NEW: admin_users, admin_sessions,
      subscriptions, invoices,      admin_audit_log, alert_rules, notifications_sent)
      kra_call_log, outbox, ...)
```

**Decision: same FastAPI process, new router prefix — not a separate service.** The admin
endpoints are almost entirely read-models over tables the gateway already owns
(`clients`, `branches`, `kra_call_log`, `outbox`, `kra_sync_state`, the billing tables), plus a
thin write layer that wraps existing services (`billing_service`, device init, outbox retry).
Splitting this into a second deployable would mean either duplicating those services or calling
back into the gateway over HTTP for no real benefit at this scale — reconsider only if the
portal's traffic/release cadence genuinely needs to scale independently later.

**Frontend is a separate SPA** (its own repo/build, own origin) purely because it has a
different audience, different auth flow, and a different release cadence than the client API —
not for technical necessity. React + TypeScript, component library (shadcn/ui or MUI),
TanStack Table for the client/log tables, a charting library (Recharts or uPlot) for the
monitoring pages, polling every 15–30s for live tiles (no need for WebSockets at this scale;
revisit if "live-tail the call log" becomes a real requirement).

---

## 4. Admin auth flow

1. `POST /admin/api/v1/auth/login` — email + password. On success, if the account has MFA
   enabled (required for Superadmin/Billing admin roles), returns a challenge; otherwise issues
   session tokens directly.
2. `POST /admin/api/v1/auth/mfa/verify` — TOTP code, completes the login started above.
3. Session = short-lived access JWT (15 min) in memory on the frontend + a longer-lived refresh
   token in an `httpOnly`, `Secure`, `SameSite=Strict` cookie. `POST /admin/api/v1/auth/refresh`
   rotates both.
4. `POST /admin/api/v1/auth/logout` — revokes the refresh token server-side (so logout is real,
   not just "forget the cookie client-side").
5. Every `/admin/api/v1/*` route (except `/auth/*` itself) requires a valid access JWT **and**
   passes through an RBAC check for that specific route (§2).
6. Failed logins are rate-limited and locked out after N attempts (mirrors the existing
   `rate_limit.py` pattern already used for client-bearer routes).

---

## 5. New backend surface: `/admin/api/v1/*`

Everything below is new. It sits alongside, and reuses services from, the existing
`/v1/devices/initialize` and `/v1/billing/*` admin endpoints described in `api_reference.md`
(those remain as-is for scripted/CI use behind the break-glass key; the portal calls the new
session-authenticated equivalents instead, described here).

### 5.1 Admin users *(Superadmin only)*

| Endpoint | Purpose |
|---|---|
| `POST /admin/api/v1/admin-users` | Create an admin account (email, temp password, role) |
| `GET /admin/api/v1/admin-users` | List admins, their role, last login, MFA status |
| `PATCH /admin/api/v1/admin-users/{id}` | Change role, disable account |
| `POST /admin/api/v1/admin-users/{id}/reset-password` | Force a password reset |

### 5.2 Client management — the gap this portal closes first

| Endpoint | Purpose |
|---|---|
| `POST /admin/api/v1/clients` | **Replaces the direct SQL insert.** Creates the `clients` row, generates `client_id`/`client_secret` server-side (secret shown **once** in the response, never retrievable again — same principle as the existing raw-secret handoff, just no longer manual), takes a name and an initial `allowed_branch_ids` list |
| `GET /admin/api/v1/clients` | Paginated, filterable list: by billing status (active/grace/suspended/cancelled/no-subscription), by name, by "has failing calls in last 24h" |
| `GET /admin/api/v1/clients/{id}` | Full detail: profile, branches, subscription summary, recent activity summary (see §6.3) |
| `PATCH /admin/api/v1/clients/{id}` | Rename, edit `allowed_branch_ids` |
| `POST /admin/api/v1/clients/{id}/rotate-secret` | Issues a new `client_secret` (old one invalidated), shown once — for a suspected leak, without needing a full offboard/reboard |
| `POST /admin/api/v1/clients/{id}/branches` | Attach an already-initialized branch to this client's allow-list (for when a branch was set up before the client existed, or is shared/reassigned) |

### 5.3 Device / branch management

| Endpoint | Purpose |
|---|---|
| `POST /admin/api/v1/devices/initialize` | Session-authenticated equivalent of the existing `POST /v1/devices/initialize`; same request/response contract (spec §12), just under admin-portal auth instead of the shared key, and automatically logged with the initiating admin's identity |
| `GET /admin/api/v1/branches` | List all branches system-wide: `branch_code`, `tin`, `bhf_id`, `device_type`, `status`, which client(s) it's allow-listed under, last successful KRA call timestamp |
| `GET /admin/api/v1/branches/{branch_code}` | Detail: full device metadata (never `cmc_key` itself — only `cmc_key_last_rotated_at` and a masked fingerprint for support purposes), recent `kra_call_log` entries for this branch, current `kra_sync_state` per resource |
| `PATCH /admin/api/v1/branches/{branch_code}` | Manually set `status` (e.g. `SUSPENDED`) — for taking a single misbehaving branch offline without touching the client's whole billing status |

Device **re-initialization** is deliberately **not** exposed as a one-click portal action — per
the existing spec, a `902` (already installed) with no local record needs manual escalation
because the old `cmcKey` can't be recovered from KRA (§12 of the original build spec). The
portal surfaces this as a clearly-flagged incident state on the branch detail page, not a retry
button.

### 5.4 Billing

Wraps the existing `/v1/billing/*` endpoints (unchanged contracts — see `api_reference.md`) with
session auth and adds the views a dashboard actually needs:

| Endpoint | Purpose |
|---|---|
| `GET /admin/api/v1/billing/overview` | Counts by status (active / in grace / suspended / cancelled / no subscription), and a list of subscriptions expiring or entering grace within the next N days |
| `GET /admin/api/v1/billing/subscriptions/{client_id}` … `POST .../suspend` … `/reactivate` … `/cancel` | Same semantics as the existing endpoints, just admin-session-authenticated and audit-logged with the acting admin's identity |
| `GET /admin/api/v1/billing/clients/{client_id}/invoices` / `POST .../invoices` / `POST /admin/api/v1/billing/invoices/{id}/mark-paid` | Same as existing |

**Access-control enforcement itself does not move** — it stays exactly where it is today
(`billing_service.py`, evaluated on every client-bearer request, returning `402`). The portal
is purely a management/visibility layer on top of that existing enforcement; it doesn't
reimplement it. See §8 for how the "why was this client blocked" story is presented.

### 5.5 Monitoring

| Endpoint | Purpose |
|---|---|
| `GET /admin/api/v1/monitoring/summary` | System-wide tiles: overall KRA call success rate (last 1h/24h), total outbox backlog by status, count of branches with stale sync (no successful poll in > threshold), count of clients currently blocked by billing |
| `GET /admin/api/v1/monitoring/kra-calls` | Filterable/paginated view over `kra_call_log`: by `branch_code`, `client_id` (joined via branch→allowed_branch_ids), `endpoint`, `result_cd`, date range |
| `GET /admin/api/v1/monitoring/kra-calls/timeseries` | Bucketed counts (e.g. per 5 min) by `result_cd`, for the charts on the monitoring page |
| `GET /admin/api/v1/monitoring/outbox` | Filterable view over `outbox`: by `status`, `endpoint`, `branch_code`, age |
| `POST /admin/api/v1/monitoring/outbox/{id}/retry` | Manually re-enqueue a `FAILED` outbox item (resets `attempts`, sets `status=PENDING`) |
| `POST /admin/api/v1/monitoring/outbox/{id}/cancel` | Marks an outbox item `CANCELLED` so the dispatcher stops retrying it (e.g. known-bad data that a client needs to resubmit correctly instead) |
| `GET /admin/api/v1/monitoring/sync-status` | Per-branch, per-resource `kra_sync_state.last_req_dt` vs "now" — this is `kra_sync_lag_seconds` from Prometheus, but browsable/filterable rather than just a gauge |

### 5.6 Alerts

| Endpoint | Purpose |
|---|---|
| `GET/POST/PATCH /admin/api/v1/alert-rules` | Configure thresholds: e.g. "sync lag for any resource > 30 min", "outbox `FAILED` count for a client > 5", "subscription entering grace period", "subscription's grace period ends in ≤ 2 days" |
| `GET /admin/api/v1/notifications` | History of fired/resolved alerts |

Delivery channels: email (to a distribution list per rule) and/or a webhook (Slack-compatible
incoming webhook URL) — configurable per rule, not hardcoded.

### 5.7 Audit log

| Endpoint | Purpose |
|---|---|
| `GET /admin/api/v1/audit-log` | Every admin write action, searchable by admin user, action type, target client/branch, date range |

---

## 6. Portal pages (site map)

```
/login
/dashboard                         — Overview
/clients                           — Client list
/clients/new                       — Register client (replaces the SQL insert)
/clients/:id                       — Client detail (tabs below)
    ?tab=overview
    ?tab=branches
    ?tab=billing
    ?tab=activity
    ?tab=audit
/branches                          — All branches, system-wide
/branches/:branch_code
/branches/new                      — Initialize a device (wraps POST .../devices/initialize)
/billing                           — Billing overview / expirations calendar
/billing/invoices/:id
/monitoring                        — KRA calls, outbox, sync-lag dashboards
/monitoring/outbox/:id
/alert-rules
/audit-log
/admin-users                       — Superadmin only
/settings                          — deployment-level config (grace period default, etc.)
```

### 6.1 Dashboard (`/dashboard`) — the "is everything OK" page

Answers, at a glance, the same questions the onboarding doc's "Monitoring" table lists for
Amina today — just visually instead of via curl/SQL/Grafana:

- **System health tile**: green/yellow/red rollup of `/v1/health` + `/metrics`.
- **KRA call success rate** (last hour, last 24h) as a sparkline, with a breakdown by
  `result_cd` if it dips (so a spike in `990` rate-limit vs `999` unknown-error is visible
  immediately, not just "something's wrong").
- **Sync lag** — worst-offending resource/branch surfaced directly (e.g. "`stock_moves` for
  `MOMBASA-PORT` hasn't synced in 47 min"), not just a number.
- **Outbox backlog** — pending/retrying count and failed count, each clickable straight into
  the filtered `/monitoring` view.
- **Billing status counts** — active / in grace / suspended / cancelled / no-subscription, each
  clickable into `/clients?status=...`.
- **Upcoming expirations** — clients entering grace or hitting hard-cutoff within the next 7
  days, front and center (this is the proactive view that doesn't exist today — right now a
  lapsed payment is only discovered when a client's calls start returning `402`).
- **Recent alerts** — last N fired notifications.

### 6.2 Client list (`/clients`)

Table: name, status badge (Active / Grace / Suspended / Cancelled / No subscription — computed
from the subscription, not a separate field to keep in sync), branch count, plan, paid-through
date, "last KRA call" timestamp, "calls failing in last 24h" count. Filters on all of the above.
Row actions: view, suspend, reactivate (subject to role).

### 6.3 Client detail (`/clients/:id`)

- **Overview tab**: client metadata, `client_id` (never the secret — that's shown once at
  creation/rotation time only), subscription summary card with the suspend/reactivate/cancel
  buttons right there (mirrors the onboarding doc's Part 4 flow, just as buttons instead of
  curl).
- **Branches tab**: every branch in this client's `allowed_branch_ids`, with device type, KRA
  environment, last successful call, current sync state per resource. "Attach branch" action.
- **Billing tab**: full subscription history, invoice list with mark-paid action, the "why is
  this client blocked" explanation rendered in plain language when applicable (§8).
- **Activity tab**: recent `kra_call_log` entries for this client's branches (endpoint,
  `result_cd`, timestamp — never the raw payload, matching the existing "hash, not payload"
  logging principle), recent outbox items and their status, recent sales-invoice
  fiscalizations (`sales_invoices` rows) with `kra_rcpt_sign` masked/truncated for display.
- **Audit tab**: admin actions taken against *this* client specifically (suspensions,
  reactivations, secret rotations, branch attachments), each with who/when/why.

### 6.4 Monitoring (`/monitoring`)

- Time-series chart of KRA calls by `result_cd` (stacked area or line), with a date-range
  picker and a client/branch filter.
- Outbox table: status, endpoint, branch, client, attempts, last error, age — sortable,
  filterable, with inline Retry/Cancel actions for `Ops`/`Superadmin` roles.
- Sync-status table: one row per `(branch, resource)`, `last_req_dt`, computed lag, with the
  worst offenders sorted to the top.

### 6.5 Billing (`/billing`)

- Expirations calendar/list view: everyone whose `current_period_end` (or grace-period end)
  falls in the selected window, so renewals can be worked proactively instead of reactively.
- Global invoice list across all clients, filterable by status (issued/paid).

### 6.6 Alert rules (`/alert-rules`)

Simple form-driven CRUD: metric (dropdown of the monitorable things in §5.5/5.6), condition
(`>`, `>=`, `==`), threshold, channel, enabled toggle. A live preview of "this rule would have
fired N times in the last 7 days" helps set sane thresholds before enabling.

### 6.7 Audit log (`/audit-log`)

Global, searchable version of the per-client audit tab — every admin action, system-wide.

---

## 7. New data model

```sql
CREATE TABLE admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL,                      -- SUPERADMIN | OPS | BILLING_ADMIN | AUDITOR
    mfa_secret TEXT,                          -- null until enrolled
    mfa_enabled BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE admin_refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id UUID NOT NULL REFERENCES admin_users(id),
    token_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE admin_audit_log (
    id BIGSERIAL PRIMARY KEY,
    admin_user_id UUID REFERENCES admin_users(id),   -- null = break-glass key used
    action TEXT NOT NULL,                             -- e.g. "client.suspend", "device.initialize"
    target_type TEXT NOT NULL,                        -- "client" | "branch" | "invoice" | ...
    target_id TEXT NOT NULL,
    before_state JSONB,
    after_state JSONB,
    reason TEXT,
    ip_address TEXT,
    request_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE alert_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    metric TEXT NOT NULL,             -- "sync_lag_seconds" | "outbox_failed_count" |
                                       -- "subscription_grace_period_ending" | ...
    scope TEXT,                       -- optional: specific client_id or branch_code, else global
    condition TEXT NOT NULL,          -- ">" | ">=" | "=="
    threshold NUMERIC NOT NULL,
    channel TEXT NOT NULL,            -- "email" | "webhook"
    channel_target TEXT NOT NULL,     -- email address or webhook URL
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES admin_users(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE notifications_sent (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_rule_id UUID NOT NULL REFERENCES alert_rules(id),
    fired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ,
    payload JSONB NOT NULL
);
```

No changes needed to the existing `clients`/`branches`/`client_subscriptions`/`invoices`
tables — the portal reads and writes them through the same services the gateway already has;
it just adds the admin-identity and audit layer on top.

---

## 8. How "deny access for non-payment/expired license" is surfaced

This is worth spelling out precisely since it's the headline feature requested:

1. **Enforcement is unchanged** — it already happens on every client-bearer request in
   `billing_service.py`, returning `402` with a human-readable reason once a subscription is
   `SUSPENDED`, `CANCELLED`, or past its grace period. The portal does not duplicate this logic.
2. **The portal's job is visibility + control**, specifically:
   - **Reactive**: client detail page shows current status plainly (`Active` / `In grace period,
     ends 2027-01-07` / `Blocked — grace period ended 2027-01-08` / `Suspended: chargeback on
     invoice INV-0042` / `Cancelled`), pulled straight from `GET
     /admin/api/v1/billing/subscriptions/{client_id}`.
   - **Proactive**: the dashboard's "Upcoming expirations" widget and the `billing.overview`
     endpoint surface clients *before* they get blocked, so renewal is worked ahead of time
     instead of discovered via a support ticket when Brian's calls start failing.
   - **Alerting**: an `alert_rule` on `subscription_grace_period_ending` (e.g. threshold = 2
     days) emails/Slacks the billing team automatically — this is the gap the onboarding doc
     implicitly relies on Amina remembering to check manually today.
   - **Manual override, always available and always attributed**: the suspend/reactivate/cancel
     buttons on the client detail page call the exact same endpoints as the `curl` commands in
     the onboarding doc, just through session auth — every click writes an `admin_audit_log`
     row with who did it and why (the `reason` field is required in the suspend form, mirroring
     the existing API's required `reason` on `POST .../suspend`).
3. **What a blocked client sees** stays exactly as documented in `api_reference.md` — a `402`
   with `detail` explaining why. Nothing about the client-facing contract changes.

---

## 9. Security notes specific to the portal

- Separate origin from the client-facing API surface; separate auth entirely (admin JWT
  sessions, not client OAuth2 tokens) — a leaked client bearer token must never grant portal
  access, and vice versa.
- MFA required for `SUPERADMIN` and `BILLING_ADMIN` roles (the two roles that can affect a
  client's access or move money-adjacent records).
- `cmc_key` is never rendered anywhere in the portal, full stop — branch detail shows only
  `cmc_key_last_rotated_at` and a short masked fingerprint (e.g. last 4 chars of a hash) for
  support/troubleshooting correlation, never the key itself.
- Every list/detail view that could expose tax data (invoice amounts, customer PINs on sales
  invoices) is restricted to roles that need it; `AUDITOR` sees everything read-only but the
  UI should still avoid displaying full customer PINs unmasked unless explicitly required for a
  support task — default to masked, add an explicit "reveal" action that itself gets audit
  logged.
- Session cookies `httpOnly` + `Secure` + `SameSite=Strict`; CSRF token on state-changing
  requests since the session travels via cookie.
- Consider IP allow-listing or a VPN requirement for the portal's origin, given it's pure
  internal tooling with no legitimate public use case.

---

## 10. Suggested build order

1. Admin auth (`admin_users`, login/MFA/session) + RBAC middleware — nothing else is safe to
   build on top of the shared key.
2. `POST /admin/api/v1/clients` + client list/detail (closes the direct-SQL gap first, since
   it's the most-cited pain point in the onboarding doc).
3. Billing wrapper endpoints + billing tab/overview page (reuses existing service, low risk).
4. Monitoring read-models (`kra-calls`, `outbox`, `sync-status`) + dashboard/monitoring pages —
   pure read-only, safe to ship incrementally per widget.
5. Audit log (should really land alongside step 1–3, not after — retrofit before the first real
   suspend/reactivate happens through the portal so there's no attribution gap).
6. Alert rules + notification delivery — depends on (4) existing first.
7. Device/branch management pages, admin-user management (Superadmin) — lower urgency, round
   out the feature set last.

---

*This design intentionally does not touch `api_reference.md`'s client-facing contract at all —
Brian's integration is unaffected by anything in this document. It only adds an
admin-authenticated surface (`/admin/api/v1/*`) and a UI on top of data the gateway already
collects.*
