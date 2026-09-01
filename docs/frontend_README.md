# OSCU Admin Portal — Frontend

Internal admin dashboard for Amina's team: register customers/branches, manage billing, and
monitor KRA call health — see [`docs/admin_portal_design.md`](admin_portal_design.md) for the
full design and [`docs/api_reference.md`](api_reference.md) for the real backend contract this
app calls where it exists.

**Customer vs. Client, read this first**: the backend split its tenant model on 2026-09-01.
`Customer` is the paying business (owns branch access + billing) — this is what
`admin_portal_design.md`'s "Client" pages/design describe, and what `/customers` in this app
is. `Client` now means one OAuth2 **connector** credential integrating on a Customer's behalf
(a prod SAP instance, a staging environment, ...) — a Customer can have several. This app's
`/customers/:id` detail page has a Connectors tab for managing those. Don't confuse this with
the backend's `X-Admin-Api-Key`/JWT admin auth, which is unrelated and gates the portal itself.

## Running locally

```bash
npm install
npm run dev
```

By default the app is fully click-through-able with **zero backend running**: an in-browser
MSW worker intercepts every API call. Log in with any username/password on `/login` (the mock
accepts any password for a known fixture username — see `src/mocks/fixtures.ts`).

### Pointing at a real running backend

The real backend has no CORS middleware, so the frontend never makes a direct cross-origin
`fetch` to it — instead Vite's dev-server proxy forwards specific path prefixes server-side,
and the browser only ever talks to its own origin. Two env vars control this (`.env.example`
has the full explanation):

```bash
# .env
BACKEND_PROXY_TARGET=http://localhost:8010   # dev-server-only, never sent to the browser
VITE_USE_REAL_BACKEND=true                    # tells the browser to stop mocking real-shaped calls
```

With both set, `/admin/login`, `/admin/users*`, `/v1/devices/initialize`, `/v1/billing/*`,
`/v1/customers*`, `/v1/admin/branches*`, and `/v1/admin/call-logs` travel through the proxy to
the real backend; everything else (`/admin/api/v1/*` — no real backend for that exists
anywhere yet) stays mocked. Confirmed working end-to-end against a live instance at
`localhost:8010` on 2026-09-01 (`curl` through the dev server's proxy, and directly against
the backend, for every real endpoint listed below — including creating a customer and a
connector and seeing the exact response shape this app's types expect).

`VITE_API_BASE_URL` still exists for a **production** build served from a different origin
than the API, where the deployment's own reverse proxy/CORS is expected to make cross-origin
calls work — it's not the local-dev path, which is the proxy above instead.

### What's real vs. mocked — read this before trusting a page's behavior

This matters more than usual here because `admin_portal_design.md` is a **design proposal**
for a `/admin/api/v1/*` surface (customers CRUD, monitoring read-models, alert rules, audit log)
that has never been built — but the backend's *actual* admin surface has evolved since that
doc was written and now includes real login and admin-user management, just under different
paths (`/admin/login`, `/admin/users*`, not `/admin/api/v1/auth`, `/admin/api/v1/admin-users`).

| Area | Status | Notes |
|---|---|---|
| Auth (`/login`) | **Real** | `POST /admin/login` — username/password → JWT `access_token`, sent as `Authorization: Bearer <token>` on every request thereafter. No MFA, no roles server-side. |
| Admin users (`/admin-users`) | **Real** | `GET/POST /admin/users`, `POST /admin/users/{id}/deactivate`/`reactivate`. No `role`/`email`/`mfa_enabled` fields exist server-side — only `username`, `full_name`, `is_active`. |
| Customers CRUD + connectors (`/customers*`) | **Real** | `POST/GET/PATCH /v1/customers`, `POST/GET /v1/customers/{id}/connectors`. No rotate/delete for connectors yet — losing a secret means creating a new connector. |
| Customer onboarding (`/customers/new`) | **Real** | `POST /v1/customers/onboard` — one call registers every branch's device (KRA + VSCU app init) and creates the Customer with whichever succeeded. Best-effort per branch, not atomic: a partial failure still creates the customer with what registered. Retrying the whole form creates a **second** customer — fix a failed branch via `/branches/new` + attach it from the customer's Branches tab instead, per the result screen's own guidance. |
| Device init (`/branches/new`) | **Real** | Calls `POST /v1/devices/initialize` exactly per `api_reference.md`. |
| Branch/call-log read-model (`/branches`, monitoring's Activity/Recent calls) | **Real** | `GET /v1/admin/branches[/{code}]`, `GET /v1/admin/call-logs`. No server-side pagination for either — both a flat array (branches) or `limit`-capped (call-logs), paginated/filtered client-side in this app. |
| Billing actions (suspend/reactivate/cancel/invoices/mark-paid) | **Real** | Calls `/v1/billing/*`, keyed by `customer_id`. One mutation implementation, reused by the customer detail billing tab and the billing overview page. |
| Dashboard summary tiles, KRA-call timeseries chart, outbox, sync-lag summary, alert rules, audit log, global invoice list | **Mocked only** | No backend exists yet anywhere for these. Served by `src/mocks/handlers.ts`'s `mockOnlyHandlers`, shaped to match `admin_portal_design.md` §5/§7. |

Every `src/api/*.ts` module has a comment at the top saying which category it's in. When in
doubt, check there before assuming a button "really" does something server-side.
`src/mocks/handlers.ts` itself is split into `realHandlers` (mock stand-ins for the real
endpoints above — only registered when there's no real backend to proxy to, see
`src/mocks/browser.ts`) and `mockOnlyHandlers` (always registered).

### Auth model — why it's not the JWT+MFA+RBAC flow in the design doc

`admin_portal_design.md` §2/§4 proposes MFA and per-role permissions on top of JWT login. The
real backend has JWT login but no MFA and no roles column at all — every admin user is equally
privileged. The frontend's `/login` (`src/auth/LoginPage.tsx`) is the real thing: real
username/password, real `POST /admin/login` call, the returned JWT held in memory only (never
`localStorage` — lost on a hard refresh; there's no refresh-token endpoint either, so a reload
always means a real re-login, not a silent one).

The RBAC **role table** from design doc §2 is still fully wired up in the UI
(`src/auth/session-store.ts`, `RequireRole`, the sidebar's per-item role gating) — every
session defaults to `SUPERADMIN` (there's no picker on the login screen; the backend has no
per-user roles to pick between) — but it is **not a real security boundary**: any logged-in
admin can already do everything the real backend allows. It exists so the RBAC nav/route-
gating UX is exercisable and testable now, ready to wire up to a real roles column if the
backend ever adds one. Don't extend this into "real" authorization logic — that belongs
server-side.

The static `X-Admin-Api-Key` header remains the backend's real break-glass credential
(bootstrapping the very first admin user, scripted/CI use) exactly as `admin_portal_design.md`
§2 describes — the portal's login screen just doesn't collect it, since real per-admin login
now exists to use instead.

## Adding a new page

1. Add the feature folder under `src/features/<name>/` with its page component(s).
2. Add typed API functions + TanStack Query hooks in `src/api/<resource>.ts` (mirror the
   pattern in `src/api/customers.ts` — no inline `any`-typed `fetch` calls in components).
3. Add MSW handlers in `src/mocks/handlers.ts` if the backend doesn't exist yet, using fixtures
   from `src/mocks/fixtures.ts`.
4. Register the route in `src/routes/router.tsx`, wrapped in `wrap(<YourPage />)` for the
   shared error boundary. If it's role-restricted, nest it under a `<RequireRole roles={[...]}>`
   element like `/admin-users` is.
5. Add the nav entry to `src/components/layout/nav-items.ts` with its allowed roles — the
   sidebar filters automatically, nothing else to wire up.

## Shared primitives — reuse these, don't reinvent them

- **`StatusBadge`** (`src/components/ui/StatusBadge.tsx`) — the only status-badge component in
  the app. Every status vocabulary (billing, branch, outbox, alerts) is a variant here, each
  pairing an icon + text label with color (color-blind-safe by construction). Adding a new
  status value anywhere? Add it to `STATUS_MAP` here, don't hand-roll a new badge.
- **`DataTable`** (`src/components/data-table/DataTable.tsx`) + **`useDataTableState`**
  (`src/components/data-table/useDataTableState.ts`) — server-side pagination/sorting/search
  wired straight to URL query params. A new table page supplies `columns` and a query hook
  keyed off `useDataTableState`'s output; it must never fetch everything and filter
  client-side once data could realistically grow.
- **`ConfirmDialog`** (`src/components/ui/ConfirmDialog.tsx`) — every destructive/high-stakes
  action goes through this: `requireReason` for suspend-style actions, `confirmPhrase` for
  cancel-style ones. Suspend/reactivate/cancel specifically live in ONE place
  (`src/features/billing/SubscriptionActions.tsx`) reused by both the customer detail billing tab
  and the billing overview page — don't add a second copy of that mutation logic.
- **`AuditLogTable`** (`src/features/audit-log/AuditLogTable.tsx`) — reused as-is by both the
  global `/audit-log` page and the per-customer Audit tab (scoped via `targetId`).

## Testing

- `npm run test` — Vitest + React Testing Library, MSW mocks the network in tests via
  `src/mocks/server.ts` (`src/test/setup.ts` wires the lifecycle). Tests always register both
  `realHandlers` and `mockOnlyHandlers` regardless of `VITE_USE_REAL_BACKEND` — a test suite
  must never depend on a live backend.
- `npm run e2e` — Playwright, against `vite preview` of a production build, MSW mocks enabled.
  **Known sandbox limitation**: this repo's dev sandbox has no root access, and Playwright's
  headless Chromium needs system libraries (`libatk-1.0.so.0` etc.) that require
  `apt-get`/root to install — `npx playwright install chromium` succeeds (downloads the
  browser) but launching it fails there. This is an environment limitation, not a code issue:
  GitHub Actions' `ubuntu-latest` runner has root, so `npx playwright install --with-deps
  chromium` in `.github/workflows/ci.yml` installs cleanly and the suite runs there.
- Regression-style tests worth knowing about: `BranchDetailPage.test.tsx` asserts a raw
  `cmc_key` never appears in the DOM even if a response accidentally included one (the real
  branch read-model has no cmc_key-shaped field at all — there's nothing to mask, but the page
  must still never render it if a bug ever put it there); `ConnectorsTab.test.tsx` asserts the
  connector secret is shown exactly once and nowhere else persists it; `SubscriptionActions
  .test.tsx` asserts suspend is blocked until a reason is typed and cancel is blocked until the
  exact confirm phrase is typed; `RequireRole.test.tsx` asserts `/admin-users` redirects a
  non-Superadmin session by URL, not just hides the nav link; `LoginPage.test.tsx` covers the
  real login happy path, a rejected/unknown username, and an unreachable-gateway error;
  `CustomerNewPage.test.tsx` covers the onboarding stepper's multi-branch success, a per-branch
  FAILED result rendering alongside REGISTERED ones, and client-side VSCU `base_url` validation;
  `client.test.ts` asserts `apiRequest` normalizes FastAPI's array-shaped validation-error
  `detail` (confirmed live on `POST /v1/customers/onboard`'s VSCU check) into a readable
  string, never `"[object Object]"` or a React child-rendering crash.

## Known gaps (intentional, not oversights)

- No MFA UI — the real backend has none to log into.
- `/admin-users`'s RBAC guard (Superadmin-only) is real UI logic but the underlying account
  system has no roles at all — any admin user can already call every `/admin/users` endpoint.
- No rotate/delete for connectors — the real backend doesn't have those endpoints yet
  (`app/services/customer_service.py`'s own docstring flags this); a lost secret means
  creating a new connector, not recovering the old one.
- `/customers/new` no longer lets you attach *existing* branches at creation time — it only
  registers brand-new devices via `POST /v1/customers/onboard`. Attaching an already-
  initialized branch to a customer is still there, just moved to the customer detail page's
  Branches tab (`PATCH /v1/customers/{id}` with the full new `branch_codes` list).
- No "resubmit only the failed branches into this same customer" recovery flow after a partial
  onboarding failure — the onboarding endpoint always creates a new Customer, so resubmitting
  the whole form would create a second one. The result screen instead points at the existing
  `/branches/new` (register the fixed device individually) + Branches-tab-attach path.
- `CustomersListPage`'s status filter/sort and the billing overview's expirations list fetch
  every customer's subscription individually (`useQueries`) since the real customer list has
  no billing fields — fine at the scale an admin tool deals with, would need a real aggregate
  endpoint to stay reasonable at real scale.
- The alert-rule "would have fired N times in the last 7 days" preview
  (`src/api/alerts.ts#useAlertRulePreview`) is a mocked, clearly-non-authoritative stand-in —
  no real backend endpoint for this exists to call.
- Bundle isn't code-split yet (`vite build` warns about a >500kB chunk) — fine for an internal
  tool's v1, revisit with route-level `React.lazy` if load time becomes a real complaint.
