# OSCU Admin Portal — Frontend

Internal admin dashboard for Amina's team: register clients/branches, manage billing, and
monitor KRA call health — see [`docs/admin_portal_design.md`](admin_portal_design.md) for the
full design and [`docs/api_reference.md`](api_reference.md) for the real backend contract this
app calls where it exists.

## Running locally

```bash
npm install
npm run dev
```

By default `VITE_ENABLE_MOCKS` is unset, which means **on** — the app boots with an in-browser
MSW worker intercepting every API call, so it is fully click-through-able with zero backend
running. Log in with any non-empty string as the "Admin API key" on `/login`.

To point at a real running gateway instead:

```bash
VITE_API_BASE_URL=http://localhost:8000 VITE_ENABLE_MOCKS=false npm run dev
```

### What's real vs. mocked — read this before trusting a page's behavior

This matters more than usual here because the two source documents disagree on what backend
exists: `admin_portal_design.md` is a **design proposal** for a `/admin/api/v1/*` surface
(admin-user accounts, JWT+MFA sessions, RBAC, clients CRUD, monitoring read-models, alert
rules, audit log) — none of that backend has been built. The only real, working admin-gated
endpoints today are documented in `api_reference.md`: `POST /v1/devices/initialize` and all of
`/v1/billing/*`, both behind a single shared `X-Admin-Api-Key` header.

| Area | Status | Notes |
|---|---|---|
| Auth (`/login`) | **Real**, adapted | A simple "enter the admin API key" gate, not the JWT/MFA login `admin_portal_design.md` §4 proposes — see "Auth model" below. |
| Device init (`/branches/new`) | **Real** | Calls `POST /v1/devices/initialize` exactly per `api_reference.md`. |
| Billing actions (suspend/reactivate/cancel/invoices/mark-paid) | **Real** | Calls `/v1/billing/*` exactly per `api_reference.md`. One mutation implementation, reused by the client detail billing tab and the billing overview page. |
| Clients CRUD, branch list/detail read-model, monitoring, alert rules, audit log, admin users | **Mocked only** | No backend exists yet. Served by `src/mocks/handlers.ts`, shaped to match `admin_portal_design.md` §5/§7. Swapping `VITE_API_BASE_URL` to a real gateway will 404 on these until that backend is built. |

Every `src/api/*.ts` module has a comment at the top saying which category it's in. When in
doubt, check there before assuming a button "really" does something server-side.

### Auth model — why it's not the JWT/MFA/RBAC flow in the design doc

`admin_portal_design.md` §2/§4 proposes real per-admin accounts, TOTP MFA, and JWT sessions.
That backend doesn't exist. Building a login/MFA UI against nothing would be UI theater, so v1
instead uses the credential that actually works today: the admin API key, entered once,
held in memory only (never `localStorage` — lost on a hard refresh, same principle the design
doc wanted for a JWT), and sent as `X-Admin-Api-Key` on every request via `src/api/client.ts`.

The RBAC **role table** from §2 is still fully wired up in the UI (`src/auth/session-store.ts`,
`RequireRole`, the sidebar's per-item role gating) — the login screen has an "Acting as" role
picker — but it is **not a real security boundary**: anyone holding the shared key can already
do everything the real backend allows, regardless of which role is picked. It exists so the
RBAC nav/route-gating UX is ready to wire up to the real thing the moment
`/admin/api/v1/auth` + `admin_users` ships, and so it's testable now. Don't extend this into
"real" authorization logic — that belongs server-side.

## Adding a new page

1. Add the feature folder under `src/features/<name>/` with its page component(s).
2. Add typed API functions + TanStack Query hooks in `src/api/<resource>.ts` (mirror the
   pattern in `src/api/clients.ts` — no inline `any`-typed `fetch` calls in components).
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
  (`src/features/billing/SubscriptionActions.tsx`) reused by both the client detail billing tab
  and the billing overview page — don't add a second copy of that mutation logic.
- **`AuditLogTable`** (`src/features/audit-log/AuditLogTable.tsx`) — reused as-is by both the
  global `/audit-log` page and the per-client Audit tab (scoped via `targetId`).

## Testing

- `npm run test` — Vitest + React Testing Library, MSW mocks the network in tests via
  `src/mocks/server.ts` (`src/test/setup.ts` wires the lifecycle).
- `npm run e2e` — Playwright, against `vite preview` of a production build, MSW mocks enabled.
  **Known sandbox limitation**: this repo's dev sandbox has no root access, and Playwright's
  headless Chromium needs system libraries (`libatk-1.0.so.0` etc.) that require
  `apt-get`/root to install — `npx playwright install chromium` succeeds (downloads the
  browser) but launching it fails there. This is an environment limitation, not a code issue:
  GitHub Actions' `ubuntu-latest` runner has root, so `npx playwright install --with-deps
  chromium` in `.github/workflows/ci.yml` installs cleanly and the suite runs there.
- Regression-style tests worth knowing about: `BranchDetailPage.test.tsx` asserts a raw
  `cmc_key` never appears in the DOM even if a fixture/response accidentally included one;
  `SubscriptionActions.test.tsx` asserts suspend is blocked until a reason is typed and cancel
  is blocked until the exact confirm phrase is typed; `RequireRole.test.tsx` asserts
  `/admin-users` redirects a non-Superadmin session by URL, not just hides the nav link.

## Known gaps vs. the original build prompt (intentional, not oversights)

- No MFA UI, no JWT refresh-on-reload — see "Auth model" above.
- `/admin-users`'s RBAC guard is real UI logic but not backed by real per-user identity yet.
- The alert-rule "would have fired N times in the last 7 days" preview
  (`src/api/alerts.ts#useAlertRulePreview`) is a mocked, clearly-non-authoritative stand-in —
  no real backend endpoint for this exists to call.
- Bundle isn't code-split yet (`vite build` warns about a >500kB chunk) — fine for an internal
  tool's v1, revisit with route-level `React.lazy` if load time becomes a real complaint.
