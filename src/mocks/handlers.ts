/**
 * MSW handlers. Two categories, per docs/frontend_README.md:
 *  - REAL-shaped: /v1/devices/initialize, /v1/billing/* — mirror docs/api_reference.md's
 *    actual contract exactly, so swapping VITE_API_BASE_URL to a live gateway is a drop-in.
 *  - PROPOSED-only: /admin/api/v1/* — mirror admin_portal_design.md §5's proposal; this
 *    backend does not exist yet anywhere.
 */
import { http, HttpResponse } from "msw";
import { paginate } from "@/mocks/paginate";
import {
  adminUsersFixture,
  alertRulesFixture,
  auditLogFixture,
  branchesFixture,
  clientsFixture,
  invoicesFixture,
  kraCallLogFixture,
  notificationsFixture,
  outboxFixture,
  subscriptionsFixture,
  syncStatusFixture,
} from "@/mocks/fixtures";
import type {
  AdminUser,
  AlertRule,
  Branch,
  Client,
  DeviceInitializeRequest,
  Invoice,
  MonitoringSummary,
  OutboxItem,
  Subscription,
} from "@/api/types";

function requireAdminKey(request: Request): HttpResponse<{ detail: string }> | null {
  const key = request.headers.get("X-Admin-Api-Key");
  if (!key) {
    return HttpResponse.json({ detail: "Admin access required" }, { status: 403 });
  }
  return null;
}

let nextInvoiceSeq = invoicesFixture.length + 1;
let nextClientSeq = clientsFixture.length + 1;

export const handlers = [
  // ---- Real: device provisioning -------------------------------------------------------
  http.post("*/v1/devices/initialize", async ({ request }) => {
    const denied = requireAdminKey(request);
    if (denied) return denied;

    const body = (await request.json()) as DeviceInitializeRequest;
    const existing = branchesFixture.find((b) => b.tin === body.tin && b.bhf_id === body.bhf_id);
    if (existing) {
      return HttpResponse.json(existing, { status: 201 });
    }
    if (body.device_type === "VSCU" && !body.kra_base_url_override) {
      return HttpResponse.json(
        { detail: "device_type=VSCU requires kra_base_url_override or a configured VSCU host." },
        { status: 422 },
      );
    }
    const created: Branch = {
      branch_code: body.branch_code,
      tin: body.tin,
      bhf_id: body.bhf_id,
      status: "ACTIVE",
      device_type: body.device_type,
      kra_base_url_override: body.kra_base_url_override ?? null,
      dvc_id: `DVC-${branchesFixture.length + 1}`.padStart(8, "0"),
      sdc_id: `SDC-${branchesFixture.length + 1}`.padStart(8, "0"),
      mrc_no: `MRC-${branchesFixture.length + 1}`.padStart(8, "0"),
    };
    branchesFixture.push(created);
    return HttpResponse.json(created, { status: 201 });
  }),

  // ---- Real: billing --------------------------------------------------------------------
  http.get("*/v1/billing/subscriptions/:clientId", ({ request, params }) => {
    const denied = requireAdminKey(request);
    if (denied) return denied;
    const sub = subscriptionsFixture[params.clientId as string];
    if (!sub) return HttpResponse.json({ detail: "No subscription on file" }, { status: 404 });
    return HttpResponse.json(sub);
  }),

  http.put("*/v1/billing/subscriptions/:clientId", async ({ request, params }) => {
    const denied = requireAdminKey(request);
    if (denied) return denied;
    const clientId = params.clientId as string;
    if (!clientsFixture.some((c) => c.id === clientId)) {
      return HttpResponse.json({ detail: "No Client row with that id" }, { status: 404 });
    }
    const body = (await request.json()) as {
      plan_name?: string;
      current_period_end: string;
      grace_period_days?: number | null;
    };
    const existing = subscriptionsFixture[clientId];
    const updated: Subscription = {
      client_id: clientId,
      plan_name: body.plan_name ?? existing?.plan_name ?? "STANDARD",
      status: existing?.status ?? "ACTIVE",
      current_period_end: body.current_period_end,
      grace_period_days: body.grace_period_days ?? null,
      suspended_at: existing?.suspended_at ?? null,
      suspended_reason: existing?.suspended_reason ?? null,
    };
    subscriptionsFixture[clientId] = updated;
    return HttpResponse.json(updated);
  }),

  http.post("*/v1/billing/subscriptions/:clientId/suspend", async ({ request, params }) => {
    const denied = requireAdminKey(request);
    if (denied) return denied;
    const clientId = params.clientId as string;
    const existing = subscriptionsFixture[clientId];
    if (!existing) return HttpResponse.json({ detail: "No subscription on file" }, { status: 404 });
    const body = (await request.json()) as { reason: string };
    const updated: Subscription = {
      ...existing,
      status: "SUSPENDED",
      suspended_at: new Date().toISOString(),
      suspended_reason: body.reason,
    };
    subscriptionsFixture[clientId] = updated;
    return HttpResponse.json(updated);
  }),

  http.post("*/v1/billing/subscriptions/:clientId/reactivate", ({ request, params }) => {
    const denied = requireAdminKey(request);
    if (denied) return denied;
    const clientId = params.clientId as string;
    const existing = subscriptionsFixture[clientId];
    if (!existing) return HttpResponse.json({ detail: "No subscription on file" }, { status: 404 });
    const updated: Subscription = {
      ...existing,
      status: "ACTIVE",
      suspended_at: null,
      suspended_reason: null,
    };
    subscriptionsFixture[clientId] = updated;
    return HttpResponse.json(updated);
  }),

  http.post("*/v1/billing/subscriptions/:clientId/cancel", ({ request, params }) => {
    const denied = requireAdminKey(request);
    if (denied) return denied;
    const clientId = params.clientId as string;
    const existing = subscriptionsFixture[clientId];
    if (!existing) return HttpResponse.json({ detail: "No subscription on file" }, { status: 404 });
    const updated: Subscription = { ...existing, status: "CANCELLED" };
    subscriptionsFixture[clientId] = updated;
    return HttpResponse.json(updated);
  }),

  http.get("*/v1/billing/clients/:clientId/invoices", ({ request, params }) => {
    const denied = requireAdminKey(request);
    if (denied) return denied;
    const clientId = params.clientId as string;
    return HttpResponse.json(invoicesFixture.filter((i) => i.client_id === clientId));
  }),

  http.post("*/v1/billing/clients/:clientId/invoices", async ({ request, params }) => {
    const denied = requireAdminKey(request);
    if (denied) return denied;
    const clientId = params.clientId as string;
    if (!clientsFixture.some((c) => c.id === clientId)) {
      return HttpResponse.json({ detail: "No Client row with that id" }, { status: 404 });
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
      client_id: clientId,
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
    const denied = requireAdminKey(request);
    if (denied) return denied;
    const invoice = invoicesFixture.find((i) => i.id === params.invoiceId);
    if (!invoice) return HttpResponse.json({ detail: "No Invoice row with that id" }, { status: 404 });
    const body = (await request.json()) as { extend_subscription_to?: string | null };
    invoice.status = "PAID";
    invoice.paid_at = new Date().toISOString();
    if (body.extend_subscription_to) {
      const sub = subscriptionsFixture[invoice.client_id];
      if (sub) sub.current_period_end = body.extend_subscription_to;
    }
    return HttpResponse.json(invoice);
  }),

  // ---- Proposed: global invoice list (no per-tenant equivalent exists on the real backend,
  // which only has GET /v1/billing/clients/{client_id}/invoices) ------------------------------
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
    return HttpResponse.json(paginate(items, url, { searchFields: (i) => [i.id, i.client_id] }));
  }),

  // ---- Proposed: billing overview ---------------------------------------------------------
  http.get("*/admin/api/v1/billing/overview", () => {
    const counts = { ACTIVE: 0, GRACE: 0, BLOCKED: 0, SUSPENDED: 0, CANCELLED: 0, NO_SUBSCRIPTION: 0 };
    for (const client of clientsFixture) {
      const sub = client.subscription;
      if (!sub) counts.NO_SUBSCRIPTION++;
      else if (sub.status === "CANCELLED") counts.CANCELLED++;
      else if (sub.status === "SUSPENDED") counts.SUSPENDED++;
      else {
        const periodEnd = new Date(sub.current_period_end).getTime();
        const graceEnd = periodEnd + (sub.grace_period_days ?? 7) * 86_400_000;
        const now = Date.now();
        if (now <= periodEnd) counts.ACTIVE++;
        else if (now <= graceEnd) counts.GRACE++;
        else counts.BLOCKED++;
      }
    }
    return HttpResponse.json({ counts });
  }),

  // ---- Proposed: clients ------------------------------------------------------------------
  http.get("*/admin/api/v1/clients", ({ request }) => {
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    let items = clientsFixture;
    if (status) {
      items = items.filter((c) => deriveStatusBucket(c) === status);
    }
    return HttpResponse.json(
      paginate(items, url, { searchFields: (c) => [c.name, c.id] }),
    );
  }),

  http.get("*/admin/api/v1/clients/:id", ({ params }) => {
    const client = clientsFixture.find((c) => c.id === params.id);
    if (!client) return HttpResponse.json({ detail: "Client not found" }, { status: 404 });
    return HttpResponse.json(client);
  }),

  http.post("*/admin/api/v1/clients", async ({ request }) => {
    const body = (await request.json()) as { name: string; allowed_branch_ids: string[] };
    const id = `c-mock-${String(nextClientSeq++).padStart(4, "0")}-0000-0000-000000000000`;
    const client: Client = {
      id,
      name: body.name,
      allowed_branch_ids: body.allowed_branch_ids,
      created_at: new Date().toISOString(),
      subscription: null,
      branch_count: body.allowed_branch_ids.length,
      last_kra_call_at: null,
      failing_calls_24h: 0,
    };
    clientsFixture.push(client);
    return HttpResponse.json(
      { client_id: id, client_secret: `secret_${crypto.randomUUID().replace(/-/g, "")}` },
      { status: 201 },
    );
  }),

  http.post("*/admin/api/v1/clients/:id/rotate-secret", ({ params }) => {
    const client = clientsFixture.find((c) => c.id === params.id);
    if (!client) return HttpResponse.json({ detail: "Client not found" }, { status: 404 });
    return HttpResponse.json({
      client_id: client.id,
      client_secret: `secret_${crypto.randomUUID().replace(/-/g, "")}`,
    });
  }),

  http.post("*/admin/api/v1/clients/:id/branches", async ({ params, request }) => {
    const client = clientsFixture.find((c) => c.id === params.id);
    if (!client) return HttpResponse.json({ detail: "Client not found" }, { status: 404 });
    const body = (await request.json()) as { branch_code: string };
    if (!client.allowed_branch_ids.includes(body.branch_code)) {
      client.allowed_branch_ids.push(body.branch_code);
      client.branch_count = client.allowed_branch_ids.length;
    }
    return HttpResponse.json(client);
  }),

  // ---- Proposed: branches -----------------------------------------------------------------
  http.get("*/admin/api/v1/branches", ({ request }) => {
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    let items = branchesFixture;
    if (status) items = items.filter((b) => b.status === status);
    return HttpResponse.json(
      paginate(items, url, { searchFields: (b) => [b.branch_code, b.tin] }),
    );
  }),

  http.get("*/admin/api/v1/branches/:code", ({ params }) => {
    const branch = branchesFixture.find((b) => b.branch_code === params.code);
    if (!branch) return HttpResponse.json({ detail: "Branch not found" }, { status: 404 });
    return HttpResponse.json(branch);
  }),

  // ---- Proposed: monitoring ---------------------------------------------------------------
  http.get("*/admin/api/v1/monitoring/summary", () => {
    const outboxCounts = outboxFixture.reduce(
      (acc, item) => {
        acc[item.status] = (acc[item.status] ?? 0) + 1;
        return acc;
      },
      {} as Record<OutboxItem["status"], number>,
    );
    const successCalls = kraCallLogFixture.filter((c) => c.result_cd === "000").length;
    const summary: MonitoringSummary = {
      kra_call_success_rate_1h: successCalls / kraCallLogFixture.length,
      kra_call_success_rate_24h: successCalls / kraCallLogFixture.length,
      outbox_counts: {
        PENDING: outboxCounts.PENDING ?? 0,
        RETRYING: outboxCounts.RETRYING ?? 0,
        FAILED: outboxCounts.FAILED ?? 0,
        SENT: outboxCounts.SENT ?? 0,
        CANCELLED: outboxCounts.CANCELLED ?? 0,
      },
      stale_branch_count: syncStatusFixture.filter((s) => s.lag_seconds > 1800).length,
      blocked_client_count: clientsFixture.filter((c) => deriveStatusBucket(c) === "BLOCKED").length,
      worst_sync_offender: [...syncStatusFixture].sort((a, b) => b.lag_seconds - a.lag_seconds)[0] ?? null,
    };
    return HttpResponse.json(summary);
  }),

  http.get("*/admin/api/v1/monitoring/kra-calls", ({ request }) => {
    const url = new URL(request.url);
    const resultCd = url.searchParams.get("result_cd");
    const branchCode = url.searchParams.get("branch_code");
    let items = kraCallLogFixture;
    if (resultCd) items = items.filter((c) => c.result_cd === resultCd);
    if (branchCode) items = items.filter((c) => c.branch_code === branchCode);
    return HttpResponse.json(paginate(items, url, { searchFields: (c) => [c.endpoint, c.branch_code ?? ""] }));
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
        searchFields: (o) => [o.endpoint, o.branch_code ?? "", o.client_name ?? ""],
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

  // ---- Proposed: admin users (Superadmin only) ----------------------------------------------
  http.get("*/admin/api/v1/admin-users", () => HttpResponse.json(adminUsersFixture)),

  http.post("*/admin/api/v1/admin-users", async ({ request }) => {
    const body = (await request.json()) as { email: string; role: AdminUser["role"] };
    const user: AdminUser = {
      id: `au-${crypto.randomUUID().slice(0, 8)}`,
      email: body.email,
      role: body.role,
      mfa_enabled: false,
      is_active: true,
      last_login_at: null,
      created_at: new Date().toISOString(),
    };
    adminUsersFixture.push(user);
    return HttpResponse.json(user, { status: 201 });
  }),

  http.patch("*/admin/api/v1/admin-users/:id", async ({ params, request }) => {
    const user = adminUsersFixture.find((u) => u.id === params.id);
    if (!user) return HttpResponse.json({ detail: "Admin user not found" }, { status: 404 });
    const body = (await request.json()) as Partial<AdminUser>;
    Object.assign(user, body);
    return HttpResponse.json(user);
  }),

  http.post("*/admin/api/v1/admin-users/:id/reset-password", () => HttpResponse.json({ ok: true })),
];

function deriveStatusBucket(client: Client): string {
  const sub = client.subscription;
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
