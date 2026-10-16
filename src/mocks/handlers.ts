/**
 * MSW handlers. Two categories, per docs/frontend_README.md:
 *  - REAL-shaped: /admin/login, /admin/users*, /v1/devices/initialize, /v1/billing/*,
 *    /v1/customers*, /v1/admin/branches*, /v1/admin/call-logs — mirror the live backend's
 *    actual contract (confirmed 2026-09-01) exactly, so these are only registered when
 *    there's no real backend to proxy to (src/mocks/browser.ts).
 *  - PROPOSED-only: /admin/api/v1/* — mirror admin_portal_design.md §5's proposal; this
 *    backend does not exist yet anywhere, real or otherwise.
 */
import { http, HttpResponse } from "msw";
import { paginate } from "@/mocks/paginate";
import {
  adminCallLogFixture,
  adminUsersFixture,
  alertRulesFixture,
  auditLogFixture,
  branchesFixture,
  connectorsFixture,
  customerCodeAllowlistFixture,
  customersFixture,
  invoicesFixture,
  itemClassesFixture,
  notificationsFixture,
  outboxFixture,
  referenceCodesFixture,
  referenceDataIndexFixture,
  subscriptionsFixture,
  syncStatusFixture,
} from "@/mocks/fixtures";
import type {
  AdminUser,
  AlertRule,
  Branch,
  BranchAdmin,
  BranchOnboardResult,
  Connector,
  CreateAdminUserRequest,
  Customer,
  CustomerCodeAllowlistEntry,
  CustomerOnboardBranchInput,
  DeviceInitializeRequest,
  Invoice,
  MonitoringSummary,
  OutboxItem,
  Subscription,
} from "@/api/types";

/** Mock stand-in for app/core/admin_auth.py's require_admin — any non-empty bearer token passes. */
function requireAdminAuth(request: Request): HttpResponse<{ detail: string }> | null {
  const auth = request.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ") || auth.length <= "Bearer ".length) {
    return HttpResponse.json({ detail: "Admin access required" }, { status: 403 });
  }
  return null;
}

function deriveCustomerStatusBucket(customerId: string): string {
  const sub = subscriptionsFixture[customerId];
  if (!sub) return "NO_SUBSCRIPTION";
  if (sub.status === "CANCELLED") return "CANCELLED";
  if (sub.status === "SUSPENDED") return "SUSPENDED";
  const periodEnd = new Date(sub.current_period_end).getTime();
  const graceEnd = periodEnd + (sub.grace_period_days ?? 7) * 86_400_000;
  const now = Date.now();
  if (now <= periodEnd) return "ACTIVE";
  if (now <= graceEnd) return "GRACE";
  return "BLOCKED";
}

let nextAdminUserSeq = adminUsersFixture.length + 1;
let nextInvoiceSeq = invoicesFixture.length + 1;
let nextCustomerSeq = customersFixture.length + 1;

/**
 * Real-shaped handlers — mock stand-ins for endpoints that genuinely exist on the backend.
 * src/mocks/browser.ts drops these from the registered set whenever VITE_USE_REAL_BACKEND is
 * set, so those specific calls pass through MSW (onUnhandledRequest: "bypass") and hit the
 * real gateway (via Vite's dev proxy) instead — everything else stays mocked so the rest of
 * the app remains fully click-through-able. server.ts (tests) always registers both groups,
 * since tests must never depend on a live backend.
 */
export const realHandlers = [
  // ---- Real: device provisioning -------------------------------------------------------
  http.post("*/v1/devices/initialize", async ({ request }) => {
    const denied = requireAdminAuth(request);
    if (denied) return denied;

    const body = (await request.json()) as DeviceInitializeRequest;
    const existing = branchesFixture.find((b) => b.tin === body.tin && b.bhf_id === body.bhf_id);
    if (existing) {
      const response: Branch = {
        branch_code: existing.branch_code,
        tin: existing.tin,
        bhf_id: existing.bhf_id,
        status: existing.status,
        device_type: existing.device_type,
        kra_base_url_override: null,
        dvc_id: "DVC-EXISTING",
        sdc_id: "SDC-EXISTING",
        mrc_no: "MRC-EXISTING",
      };
      return HttpResponse.json(response, { status: 201 });
    }
    if (body.device_type === "VSCU" && !body.kra_base_url_override) {
      return HttpResponse.json(
        { detail: "device_type=VSCU requires kra_base_url_override or a configured VSCU host." },
        { status: 422 },
      );
    }
    const seq = String(branchesFixture.length + 1).padStart(4, "0");
    const newBranch: BranchAdmin = {
      id: `b-mock-${seq}`,
      branch_code: body.branch_code,
      tin: body.tin,
      bhf_id: body.bhf_id,
      status: "ACTIVE",
      device_type: body.device_type,
      created_at: new Date().toISOString(),
      vscu:
        body.device_type === "VSCU"
          ? {
              base_url: body.kra_base_url_override ?? "https://vscu-sbx.kra.go.ke",
              initialized_at: new Date().toISOString(),
              last_sequence_sync_at: null,
              last_known_invc_no: null,
              last_known_sale_rcpt_no: null,
              last_successful_call_at: null,
              last_error: null,
            }
          : null,
    };
    branchesFixture.push(newBranch);
    const response: Branch = {
      branch_code: newBranch.branch_code,
      tin: newBranch.tin,
      bhf_id: newBranch.bhf_id,
      status: newBranch.status,
      device_type: newBranch.device_type,
      kra_base_url_override: body.kra_base_url_override ?? null,
      dvc_id: `DVC-${seq}`,
      sdc_id: `SDC-${seq}`,
      mrc_no: `MRC-${seq}`,
    };
    return HttpResponse.json(response, { status: 201 });
  }),

  // ---- Real: billing, keyed by customer_id -----------------------------------------------
  http.get("*/v1/billing/subscriptions/:customerId", ({ request, params }) => {
    const denied = requireAdminAuth(request);
    if (denied) return denied;
    const sub = subscriptionsFixture[params.customerId as string];
    if (!sub) return HttpResponse.json({ detail: "No subscription on file for this customer" }, { status: 404 });
    return HttpResponse.json(sub);
  }),

  http.put("*/v1/billing/subscriptions/:customerId", async ({ request, params }) => {
    const denied = requireAdminAuth(request);
    if (denied) return denied;
    const customerId = params.customerId as string;
    if (!customersFixture.some((c) => c.id === customerId)) {
      return HttpResponse.json({ detail: "No customer with that id" }, { status: 404 });
    }
    const body = (await request.json()) as {
      plan_name?: string;
      current_period_end: string;
      grace_period_days?: number | null;
    };
    const existing = subscriptionsFixture[customerId];
    const updated: Subscription = {
      customer_id: customerId,
      plan_name: body.plan_name ?? existing?.plan_name ?? "STANDARD",
      status: existing?.status ?? "ACTIVE",
      current_period_end: body.current_period_end,
      grace_period_days: body.grace_period_days ?? null,
      suspended_at: existing?.suspended_at ?? null,
      suspended_reason: existing?.suspended_reason ?? null,
    };
    subscriptionsFixture[customerId] = updated;
    return HttpResponse.json(updated);
  }),

  http.post("*/v1/billing/subscriptions/:customerId/suspend", async ({ request, params }) => {
    const denied = requireAdminAuth(request);
    if (denied) return denied;
    const customerId = params.customerId as string;
    const existing = subscriptionsFixture[customerId];
    if (!existing) return HttpResponse.json({ detail: "No subscription on file" }, { status: 404 });
    const body = (await request.json()) as { reason: string };
    const updated: Subscription = {
      ...existing,
      status: "SUSPENDED",
      suspended_at: new Date().toISOString(),
      suspended_reason: body.reason,
    };
    subscriptionsFixture[customerId] = updated;
    return HttpResponse.json(updated);
  }),

  http.post("*/v1/billing/subscriptions/:customerId/reactivate", ({ request, params }) => {
    const denied = requireAdminAuth(request);
    if (denied) return denied;
    const customerId = params.customerId as string;
    const existing = subscriptionsFixture[customerId];
    if (!existing) return HttpResponse.json({ detail: "No subscription on file" }, { status: 404 });
    const updated: Subscription = {
      ...existing,
      status: "ACTIVE",
      suspended_at: null,
      suspended_reason: null,
    };
    subscriptionsFixture[customerId] = updated;
    return HttpResponse.json(updated);
  }),

  http.post("*/v1/billing/subscriptions/:customerId/cancel", ({ request, params }) => {
    const denied = requireAdminAuth(request);
    if (denied) return denied;
    const customerId = params.customerId as string;
    const existing = subscriptionsFixture[customerId];
    if (!existing) return HttpResponse.json({ detail: "No subscription on file" }, { status: 404 });
    const updated: Subscription = { ...existing, status: "CANCELLED" };
    subscriptionsFixture[customerId] = updated;
    return HttpResponse.json(updated);
  }),

  http.get("*/v1/billing/customers/:customerId/invoices", ({ request, params }) => {
    const denied = requireAdminAuth(request);
    if (denied) return denied;
    const customerId = params.customerId as string;
    return HttpResponse.json(invoicesFixture.filter((i) => i.customer_id === customerId));
  }),

  http.post("*/v1/billing/customers/:customerId/invoices", async ({ request, params }) => {
    const denied = requireAdminAuth(request);
    if (denied) return denied;
    const customerId = params.customerId as string;
    if (!customersFixture.some((c) => c.id === customerId)) {
      return HttpResponse.json({ detail: "No customer with that id" }, { status: 404 });
    }
    const body = (await request.json()) as {
      period_start: string;
      period_end: string;
      amount: string;
      currency?: string;
      notes?: string;
    };
    const invoice: Invoice = {
      id: `inv-${String(nextInvoiceSeq++).padStart(4, "0")}`,
      customer_id: customerId,
      period_start: body.period_start,
      period_end: body.period_end,
      amount: body.amount,
      currency: body.currency ?? "KES",
      status: "ISSUED",
      issued_at: new Date().toISOString(),
      paid_at: null,
      notes: body.notes ?? null,
    };
    invoicesFixture.push(invoice);
    return HttpResponse.json(invoice, { status: 201 });
  }),

  http.post("*/v1/billing/invoices/:invoiceId/mark-paid", async ({ request, params }) => {
    const denied = requireAdminAuth(request);
    if (denied) return denied;
    const invoice = invoicesFixture.find((i) => i.id === params.invoiceId);
    if (!invoice) return HttpResponse.json({ detail: "No Invoice row with that id" }, { status: 404 });
    const body = (await request.json()) as { extend_subscription_to?: string | null };
    invoice.status = "PAID";
    invoice.paid_at = new Date().toISOString();
    if (body.extend_subscription_to) {
      const sub = subscriptionsFixture[invoice.customer_id];
      if (sub) sub.current_period_end = body.extend_subscription_to;
    }
    return HttpResponse.json(invoice);
  }),

  // ---- Real: customer onboarding + connectors --------------------------------------------
  http.get("*/v1/customers", ({ request }) => {
    const denied = requireAdminAuth(request);
    if (denied) return denied;
    return HttpResponse.json(customersFixture);
  }),

  http.post("*/v1/customers", async ({ request }) => {
    const denied = requireAdminAuth(request);
    if (denied) return denied;
    const body = (await request.json()) as { name: string; branch_codes: string[] };
    const unknown = body.branch_codes.filter((code) => !branchesFixture.some((b) => b.branch_code === code));
    if (unknown.length) {
      return HttpResponse.json({ detail: `Unknown branch_code(s): ${unknown.join(", ")}` }, { status: 422 });
    }
    const customer: Customer = {
      id: `cu-mock-${String(nextCustomerSeq++).padStart(4, "0")}`,
      name: body.name,
      branch_codes: body.branch_codes,
      created_at: new Date().toISOString(),
    };
    customersFixture.push(customer);
    connectorsFixture[customer.id] = [];
    return HttpResponse.json(customer, { status: 201 });
  }),

  http.get("*/v1/customers/:id", ({ request, params }) => {
    const denied = requireAdminAuth(request);
    if (denied) return denied;
    const customer = customersFixture.find((c) => c.id === params.id);
    if (!customer) return HttpResponse.json({ detail: "No customer with that id" }, { status: 404 });
    return HttpResponse.json(customer);
  }),

  http.patch("*/v1/customers/:id", async ({ request, params }) => {
    const denied = requireAdminAuth(request);
    if (denied) return denied;
    const customer = customersFixture.find((c) => c.id === params.id);
    if (!customer) return HttpResponse.json({ detail: "No customer with that id" }, { status: 404 });
    const body = (await request.json()) as { name?: string | null; branch_codes?: string[] | null };
    if (body.name != null) customer.name = body.name;
    if (body.branch_codes != null) {
      const unknown = body.branch_codes.filter((code) => !branchesFixture.some((b) => b.branch_code === code));
      if (unknown.length) {
        return HttpResponse.json({ detail: `Unknown branch_code(s): ${unknown.join(", ")}` }, { status: 422 });
      }
      customer.branch_codes = body.branch_codes;
    }
    return HttpResponse.json(customer);
  }),

  http.get("*/v1/customers/:id/connectors", ({ request, params }) => {
    const denied = requireAdminAuth(request);
    if (denied) return denied;
    return HttpResponse.json(connectorsFixture[params.id as string] ?? []);
  }),

  http.post("*/v1/customers/:id/connectors", async ({ request, params }) => {
    const denied = requireAdminAuth(request);
    if (denied) return denied;
    const customerId = params.id as string;
    if (!customersFixture.some((c) => c.id === customerId)) {
      return HttpResponse.json({ detail: "No customer with that id" }, { status: 404 });
    }
    const body = (await request.json()) as { name: string };
    const connector: Connector = {
      client_id: `co-mock-${crypto.randomUUID()}`,
      name: body.name,
      created_at: new Date().toISOString(),
    };
    connectorsFixture[customerId] = [...(connectorsFixture[customerId] ?? []), connector];
    return HttpResponse.json(
      { client_id: connector.client_id, client_secret: `secret_${crypto.randomUUID().replace(/-/g, "")}`, name: connector.name },
      { status: 201 },
    );
  }),

  // ---- Real: stepper-form onboarding (customer + branch device registration in one call) ---
  http.post("*/v1/customers/onboard", async ({ request }) => {
    const denied = requireAdminAuth(request);
    if (denied) return denied;
    const body = (await request.json()) as { name: string; branches: CustomerOnboardBranchInput[] };

    // Mirrors the real backend's request-level (pydantic) validation exactly, including its
    // shape: a Pydantic model_validator raising turns into FastAPI's standard 422 body — an
    // ARRAY of error objects under `detail`, not a plain string (confirmed via curl against
    // the live backend, 2026-09-01) — rejecting the WHOLE request before any branch is
    // registered, not a per-branch FAILED outcome.
    const missingBaseUrl = body.branches.find((b) => b.device_type === "VSCU" && !b.base_url);
    if (missingBaseUrl) {
      return HttpResponse.json(
        {
          detail: [
            {
              type: "value_error",
              loc: ["body", "branches", body.branches.indexOf(missingBaseUrl)],
              msg: `Value error, branch '${missingBaseUrl.branch_code}': base_url is required for VSCU`,
              input: missingBaseUrl,
              ctx: { error: {} },
            },
          ],
        },
        { status: 422 },
      );
    }

    const outcomes: BranchOnboardResult[] = [];
    const registeredBranchCodes: string[] = [];
    for (const b of body.branches) {
      const existing = branchesFixture.find((br) => br.tin === b.tin && br.bhf_id === b.bhf_id);
      if (existing) {
        const owner = customersFixture.find((c) => c.branch_codes.includes(existing.branch_code));
        if (owner) {
          outcomes.push({
            branch_code: b.branch_code,
            device_type: b.device_type,
            status: "FAILED",
            branch_id: null,
            error: `(tin, bhfId) is already registered under a different customer ('${owner.name}') — check for a data-entry mistake`,
          });
          continue;
        }
        // Idempotent per the real backend: an existing, unowned branch registers as success.
        outcomes.push({ branch_code: existing.branch_code, device_type: existing.device_type, status: "REGISTERED", branch_id: existing.id, error: null });
        registeredBranchCodes.push(existing.branch_code);
        continue;
      }
      const seq = String(branchesFixture.length + 1).padStart(4, "0");
      const newBranch: BranchAdmin = {
        id: `b-mock-${seq}`,
        branch_code: b.branch_code,
        tin: b.tin,
        bhf_id: b.bhf_id,
        status: "ACTIVE",
        device_type: b.device_type,
        created_at: new Date().toISOString(),
        vscu:
          b.device_type === "VSCU"
            ? {
                base_url: b.base_url ?? "",
                initialized_at: new Date().toISOString(),
                last_sequence_sync_at: null,
                last_known_invc_no: null,
                last_known_sale_rcpt_no: null,
                last_successful_call_at: null,
                last_error: null,
              }
            : null,
      };
      branchesFixture.push(newBranch);
      outcomes.push({ branch_code: b.branch_code, device_type: b.device_type, status: "REGISTERED", branch_id: newBranch.id, error: null });
      registeredBranchCodes.push(newBranch.branch_code);
    }

    const customer: Customer = {
      id: `cu-mock-${String(nextCustomerSeq++).padStart(4, "0")}`,
      name: body.name,
      branch_codes: registeredBranchCodes,
      created_at: new Date().toISOString(),
    };
    customersFixture.push(customer);
    connectorsFixture[customer.id] = [];

    return HttpResponse.json({ customer, branches: outcomes }, { status: 201 });
  }),

  // ---- Real: admin dashboard read-model (branches + merged call log) ---------------------
  http.get("*/v1/admin/branches", ({ request }) => {
    const denied = requireAdminAuth(request);
    if (denied) return denied;
    return HttpResponse.json(branchesFixture);
  }),

  http.get("*/v1/admin/branches/:code", ({ request, params }) => {
    const denied = requireAdminAuth(request);
    if (denied) return denied;
    const branch = branchesFixture.find((b) => b.branch_code === params.code);
    if (!branch) return HttpResponse.json({ detail: "No branch with that branch_code" }, { status: 404 });
    return HttpResponse.json(branch);
  }),

  http.get("*/v1/admin/call-logs", ({ request }) => {
    const denied = requireAdminAuth(request);
    if (denied) return denied;
    const url = new URL(request.url);
    const branchCode = url.searchParams.get("branch_code");
    const protocol = url.searchParams.get("protocol");
    const resultCd = url.searchParams.get("result_cd");
    const limit = Number(url.searchParams.get("limit") ?? "50");

    let items = adminCallLogFixture;
    if (branchCode) items = items.filter((c) => c.branch_code === branchCode);
    if (protocol) items = items.filter((c) => c.protocol === protocol);
    if (resultCd) items = items.filter((c) => c.result_cd === resultCd);

    const sorted = [...items].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return HttpResponse.json(sorted.slice(0, limit));
  }),

  // ---- Real: admin portal login + admin user management ---------------------------------
  http.post("*/admin/login", async ({ request }) => {
    const body = (await request.json()) as { username: string; password: string };
    const user = adminUsersFixture.find((u) => u.username === body.username && u.is_active);
    // Mock accepts any password for a known, active username — this is a mock stand-in, not a
    // real credential check (see requireAdminAuth above for the token-shaped gate every other
    // admin route uses).
    if (!user) {
      return HttpResponse.json({ detail: "Invalid username or password" }, { status: 401 });
    }
    user.last_login_at = new Date().toISOString();
    return HttpResponse.json({
      access_token: `mock.${crypto.randomUUID().replace(/-/g, "")}`,
      token_type: "bearer",
      expires_in: 3600,
    });
  }),

  http.get("*/admin/users", ({ request }) => {
    const denied = requireAdminAuth(request);
    if (denied) return denied;
    return HttpResponse.json(adminUsersFixture);
  }),

  http.post("*/admin/users", async ({ request }) => {
    const denied = requireAdminAuth(request);
    if (denied) return denied;
    const body = (await request.json()) as CreateAdminUserRequest;
    if (adminUsersFixture.some((u) => u.username === body.username)) {
      return HttpResponse.json({ detail: `Username '${body.username}' is already taken` }, { status: 409 });
    }
    const user: AdminUser = {
      id: `au-${String(nextAdminUserSeq++).padStart(4, "0")}`,
      username: body.username,
      full_name: body.full_name ?? null,
      is_active: true,
      last_login_at: null,
      created_at: new Date().toISOString(),
    };
    adminUsersFixture.push(user);
    return HttpResponse.json(user, { status: 201 });
  }),

  http.post("*/admin/users/:id/deactivate", ({ request, params }) => {
    const denied = requireAdminAuth(request);
    if (denied) return denied;
    const user = adminUsersFixture.find((u) => u.id === params.id);
    if (!user) return HttpResponse.json({ detail: `No admin user with id=${params.id}` }, { status: 404 });
    user.is_active = false;
    return HttpResponse.json(user);
  }),

  http.post("*/admin/users/:id/reactivate", ({ request, params }) => {
    const denied = requireAdminAuth(request);
    if (denied) return denied;
    const user = adminUsersFixture.find((u) => u.id === params.id);
    if (!user) return HttpResponse.json({ detail: `No admin user with id=${params.id}` }, { status: 404 });
    user.is_active = true;
    return HttpResponse.json(user);
  }),

  // ---- Real: reference-data browsing + per-customer code allow-lists ----------------------
  // kra_vscu_backend/docs/reference_data_and_code_assignment.md §3/§4.
  http.get("*/v1/admin/reference-data/codes", ({ request }) => {
    const denied = requireAdminAuth(request);
    if (denied) return denied;
    return HttpResponse.json(referenceDataIndexFixture);
  }),

  http.get("*/v1/admin/reference-data/codes/:classification", ({ request, params }) => {
    const denied = requireAdminAuth(request);
    if (denied) return denied;
    const codes = referenceCodesFixture[params.classification as string];
    if (!codes) return HttpResponse.json({ detail: "Unknown classification" }, { status: 404 });
    const q = new URL(request.url).searchParams.get("q")?.toLowerCase();
    const filtered = q ? codes.filter((c) => c.cd.toLowerCase().includes(q) || c.cd_nm.toLowerCase().includes(q)) : codes;
    return HttpResponse.json(filtered);
  }),

  http.get("*/v1/admin/reference-data/item-classes", ({ request }) => {
    const denied = requireAdminAuth(request);
    if (denied) return denied;
    const params = new URL(request.url).searchParams;
    const level = params.get("level");
    const prefix = params.get("prefix");
    const q = params.get("q")?.toLowerCase();
    let filtered = itemClassesFixture;
    if (level) filtered = filtered.filter((c) => c.item_cls_lvl === level);
    if (prefix) filtered = filtered.filter((c) => c.item_cls_cd.startsWith(prefix));
    if (q) filtered = filtered.filter((c) => c.item_cls_nm.toLowerCase().includes(q));
    return HttpResponse.json(filtered);
  }),

  http.get("*/v1/customers/:id/code-allowlist", ({ request, params }) => {
    const denied = requireAdminAuth(request);
    if (denied) return denied;
    const customerId = params.id as string;
    if (!customersFixture.some((c) => c.id === customerId)) {
      return HttpResponse.json({ detail: "No customer with that id" }, { status: 404 });
    }
    return HttpResponse.json(customerCodeAllowlistFixture[customerId] ?? []);
  }),

  http.put("*/v1/customers/:id/code-allowlist/:classification", async ({ request, params }) => {
    const denied = requireAdminAuth(request);
    if (denied) return denied;
    const customerId = params.id as string;
    if (!customersFixture.some((c) => c.id === customerId)) {
      return HttpResponse.json({ detail: "No customer with that id" }, { status: 404 });
    }
    const classification = params.classification as string;
    const body = (await request.json()) as { codes: string[] };
    const existing = customerCodeAllowlistFixture[customerId] ?? [];
    const withoutThis = existing.filter((e) => e.classification !== classification);
    const entry: CustomerCodeAllowlistEntry = { classification, codes: body.codes };
    customerCodeAllowlistFixture[customerId] = body.codes.length ? [...withoutThis, entry] : withoutThis;
    return HttpResponse.json(entry);
  }),
];

/** Proposed-only handlers — admin_portal_design.md §5/§7, no real backend exists yet. */
export const mockOnlyHandlers = [
  // ---- Proposed: global invoice list (no per-tenant equivalent exists on the real backend,
  // which only has GET /v1/billing/customers/{customer_id}/invoices) --------------------------
  http.get("*/admin/api/v1/billing/invoices/:id", ({ params }) => {
    const invoice = invoicesFixture.find((i) => i.id === params.id);
    if (!invoice) return HttpResponse.json({ detail: "Invoice not found" }, { status: 404 });
    return HttpResponse.json(invoice);
  }),

  http.get("*/admin/api/v1/billing/invoices", ({ request }) => {
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    let items = invoicesFixture;
    if (status) items = items.filter((i) => i.status === status);
    return HttpResponse.json(paginate(items, url, { searchFields: (i) => [i.id, i.customer_id] }));
  }),

  // ---- Proposed: billing overview ---------------------------------------------------------
  http.get("*/admin/api/v1/billing/overview", () => {
    const counts = { ACTIVE: 0, GRACE: 0, BLOCKED: 0, SUSPENDED: 0, CANCELLED: 0, NO_SUBSCRIPTION: 0 };
    for (const customer of customersFixture) {
      const bucket = deriveCustomerStatusBucket(customer.id) as keyof typeof counts;
      counts[bucket]++;
    }
    return HttpResponse.json({ counts });
  }),

  // ---- Proposed: monitoring summary/timeseries/outbox/sync-status ------------------------
  http.get("*/admin/api/v1/monitoring/summary", () => {
    const outboxCounts = outboxFixture.reduce(
      (acc, item) => {
        acc[item.status] = (acc[item.status] ?? 0) + 1;
        return acc;
      },
      {} as Record<OutboxItem["status"], number>,
    );
    const successCalls = adminCallLogFixture.filter((c) => c.result_cd === "000").length;
    const summary: MonitoringSummary = {
      kra_call_success_rate_1h: successCalls / adminCallLogFixture.length,
      kra_call_success_rate_24h: successCalls / adminCallLogFixture.length,
      outbox_counts: {
        PENDING: outboxCounts.PENDING ?? 0,
        RETRYING: outboxCounts.RETRYING ?? 0,
        FAILED: outboxCounts.FAILED ?? 0,
        SENT: outboxCounts.SENT ?? 0,
        CANCELLED: outboxCounts.CANCELLED ?? 0,
      },
      stale_branch_count: syncStatusFixture.filter((s) => s.lag_seconds > 1800).length,
      blocked_customer_count: customersFixture.filter((c) => deriveCustomerStatusBucket(c.id) === "BLOCKED").length,
      worst_sync_offender: [...syncStatusFixture].sort((a, b) => b.lag_seconds - a.lag_seconds)[0] ?? null,
    };
    return HttpResponse.json(summary);
  }),

  http.get("*/admin/api/v1/monitoring/kra-calls/timeseries", ({ request }) => {
    const url = new URL(request.url);
    const rangeHours = Number(url.searchParams.get("range_hours") ?? "24");
    const points = Array.from({ length: 12 }).map((_, i) => {
      const hoursBack = (rangeHours / 12) * (11 - i);
      const bucketStart = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();
      return {
        bucket_start: bucketStart,
        counts_by_result_cd: {
          "000": 20 + Math.round(Math.sin(i) * 5) + 15,
          "999": i === 8 ? 6 : Math.round(Math.random() * 2),
          "990": i === 5 ? 4 : 0,
        },
      };
    });
    return HttpResponse.json(points);
  }),

  http.get("*/admin/api/v1/monitoring/outbox", ({ request }) => {
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    let items = outboxFixture;
    if (status) items = items.filter((o) => o.status === status);
    return HttpResponse.json(
      paginate(items, url, {
        searchFields: (o) => [o.endpoint, o.branch_code ?? "", o.customer_name ?? ""],
        sortAccessor: (o, id) => (o as unknown as Record<string, string | number>)[id] ?? "",
      }),
    );
  }),

  http.get("*/admin/api/v1/monitoring/outbox/:id", ({ params }) => {
    const item = outboxFixture.find((o) => o.id === params.id);
    if (!item) return HttpResponse.json({ detail: "Outbox item not found" }, { status: 404 });
    return HttpResponse.json(item);
  }),

  http.post("*/admin/api/v1/monitoring/outbox/:id/retry", ({ params }) => {
    const item = outboxFixture.find((o) => o.id === params.id);
    if (!item) return HttpResponse.json({ detail: "Outbox item not found" }, { status: 404 });
    item.status = "PENDING";
    item.attempts = 0;
    item.last_error = null;
    return HttpResponse.json(item);
  }),

  http.post("*/admin/api/v1/monitoring/outbox/:id/cancel", ({ params }) => {
    const item = outboxFixture.find((o) => o.id === params.id);
    if (!item) return HttpResponse.json({ detail: "Outbox item not found" }, { status: 404 });
    item.status = "CANCELLED";
    return HttpResponse.json(item);
  }),

  http.get("*/admin/api/v1/monitoring/sync-status", ({ request }) => {
    const url = new URL(request.url);
    const branchCode = url.searchParams.get("branch_code");
    let items = syncStatusFixture;
    if (branchCode) items = items.filter((s) => s.branch_code === branchCode);
    return HttpResponse.json([...items].sort((a, b) => b.lag_seconds - a.lag_seconds));
  }),

  // ---- Proposed: alert rules --------------------------------------------------------------
  http.get("*/admin/api/v1/alert-rules", () => HttpResponse.json(alertRulesFixture)),

  http.post("*/admin/api/v1/alert-rules", async ({ request }) => {
    const body = (await request.json()) as Omit<AlertRule, "id" | "created_at">;
    const rule: AlertRule = { ...body, id: `ar-${crypto.randomUUID().slice(0, 8)}`, created_at: new Date().toISOString() };
    alertRulesFixture.push(rule);
    return HttpResponse.json(rule, { status: 201 });
  }),

  http.patch("*/admin/api/v1/alert-rules/:id", async ({ params, request }) => {
    const rule = alertRulesFixture.find((r) => r.id === params.id);
    if (!rule) return HttpResponse.json({ detail: "Alert rule not found" }, { status: 404 });
    const body = (await request.json()) as Partial<AlertRule>;
    Object.assign(rule, body);
    return HttpResponse.json(rule);
  }),

  http.get("*/admin/api/v1/alert-rules/preview", ({ request }) => {
    const url = new URL(request.url);
    const metric = url.searchParams.get("metric");
    // Deterministic-but-plausible mock preview count — clearly a mock, never presented as
    // a real backend computation (see docs/frontend_README.md "Ask before assuming" #6).
    const seed = metric ? metric.length : 3;
    return HttpResponse.json({ fired_count_last_7_days: (seed * 3) % 11 });
  }),

  http.get("*/admin/api/v1/notifications", ({ request }) => {
    const url = new URL(request.url);
    return HttpResponse.json(paginate(notificationsFixture, url));
  }),

  // ---- Proposed: audit log ------------------------------------------------------------------
  http.get("*/admin/api/v1/audit-log", ({ request }) => {
    const url = new URL(request.url);
    const targetType = url.searchParams.get("target_type");
    const targetId = url.searchParams.get("target_id");
    let items = auditLogFixture;
    if (targetType) items = items.filter((e) => e.target_type === targetType);
    if (targetId) items = items.filter((e) => e.target_id === targetId);
    return HttpResponse.json(
      paginate(items, url, { searchFields: (e) => [e.action, e.admin_user_email ?? "break-glass key"] }),
    );
  }),
  // Admin user management, customers, connectors, branches, and call-logs are real now — see
  // realHandlers above, not here.
];

/** Full set — used by tests (src/mocks/server.ts), which must never depend on a live backend. */
export const handlers = [...realHandlers, ...mockOnlyHandlers];
