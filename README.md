# oscu-admin-portal

Internal admin dashboard for the OSCU Gateway — register clients/devices, manage billing, and
monitor KRA call health without touching SQL or curl.

See [`docs/frontend_README.md`](docs/frontend_README.md) for how to run this locally (with or
without a real backend), what's real vs. MSW-mocked, and how to add a new page. See
[`docs/admin_portal_design.md`](docs/admin_portal_design.md) for the full design this
implements, and [`docs/api_reference.md`](docs/api_reference.md) /
[`docs/client_onboarding_and_monitoring.md`](docs/client_onboarding_and_monitoring.md) for the
real backend contract.

```bash
npm install
npm run dev
```
