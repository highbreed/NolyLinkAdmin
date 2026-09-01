/**
 * Hand-written mock fixtures mirroring the real shapes confirmed against the live backend
 * (kra_vscu_backend, 2026-09-01 Customer/Client(connector) split) and the proposed shapes in
 * admin_portal_design.md §5/§7 for what's still mocked-only. Kept in one mutable in-memory
 * module so MSW handlers can support real create/update/list mutations across a dev session.
 */
import type {
  AdminCallLogEntry,
  AdminUser,
  AlertRule,
  AuditLogEntry,
  BranchAdmin,
  Connector,
  Customer,
  Invoice,
  NotificationSent,
  OutboxItem,
  Subscription,
  SyncStatusRow,
} from "@/api/types";

const now = Date.now();
const hoursAgo = (h: number) => new Date(now - h * 60 * 60 * 1000).toISOString();
const daysFromNow = (d: number) => new Date(now + d * 24 * 60 * 60 * 1000).toISOString();
const daysAgo = (d: number) => new Date(now - d * 24 * 60 * 60 * 1000).toISOString();

export const branchesFixture: BranchAdmin[] = [
  {
    id: "b-0001",
    branch_code: "NAIROBI-HQ",
    tin: "A123456789Z",
    bhf_id: "00",
    status: "ACTIVE",
    device_type: "OSCU",
    created_at: daysAgo(400),
    vscu: null,
  },
  {
    id: "b-0002",
    branch_code: "MOMBASA-PORT",
    tin: "A123456789Z",
    bhf_id: "01",
    status: "ACTIVE",
    device_type: "VSCU",
    created_at: daysAgo(200),
    vscu: {
      base_url: "https://vscu-sbx.kra.go.ke",
      initialized_at: daysAgo(200),
      last_sequence_sync_at: hoursAgo(47 / 60),
      last_known_invc_no: 1042,
      last_known_sale_rcpt_no: 987,
      last_successful_call_at: hoursAgo(47 / 60),
      last_error: null,
    },
  },
  {
    id: "b-0003",
    branch_code: "KISUMU-WEST",
    tin: "B987654321Y",
    bhf_id: "00",
    status: "SUSPENDED",
    device_type: "VSCU",
    created_at: daysAgo(300),
    vscu: {
      base_url: "https://vscu-sbx.kra.go.ke",
      initialized_at: daysAgo(300),
      last_sequence_sync_at: daysAgo(2),
      last_known_invc_no: 512,
      last_known_sale_rcpt_no: 480,
      last_successful_call_at: daysAgo(2),
      last_error: "KRA 990: rate limited",
    },
  },
];

const customerIdActive = "cu111111-1111-1111-1111-111111111111";
const customerIdGrace = "cu222222-2222-2222-2222-222222222222";
const customerIdSuspended = "cu333333-3333-3333-3333-333333333333";
const customerIdNoSub = "cu444444-4444-4444-4444-444444444444";

export const subscriptionsFixture: Record<string, Subscription> = {
  [customerIdActive]: {
    customer_id: customerIdActive,
    plan_name: "STANDARD",
    status: "ACTIVE",
    current_period_end: daysFromNow(20),
    grace_period_days: null,
    suspended_at: null,
    suspended_reason: null,
  },
  [customerIdGrace]: {
    customer_id: customerIdGrace,
    plan_name: "STANDARD",
    status: "ACTIVE",
    current_period_end: daysAgo(2),
    grace_period_days: 7,
    suspended_at: null,
    suspended_reason: null,
  },
  [customerIdSuspended]: {
    customer_id: customerIdSuspended,
    plan_name: "PREMIUM",
    status: "SUSPENDED",
    current_period_end: daysFromNow(10),
    grace_period_days: null,
    suspended_at: daysAgo(3),
    suspended_reason: "Chargeback on invoice INV-0042",
  },
};

export const customersFixture: Customer[] = [
  {
    id: customerIdActive,
    name: "Jitihada Traders Ltd",
    branch_codes: ["NAIROBI-HQ"],
    created_at: daysAgo(120),
  },
  {
    id: customerIdGrace,
    name: "Coastal Retail Group",
    branch_codes: ["MOMBASA-PORT"],
    created_at: daysAgo(200),
  },
  {
    id: customerIdSuspended,
    name: "Lakeview Wholesale",
    branch_codes: ["KISUMU-WEST"],
    created_at: daysAgo(300),
  },
  {
    id: customerIdNoSub,
    name: "New Prospect Stores",
    branch_codes: [],
    created_at: hoursAgo(2),
  },
];

export const connectorsFixture: Record<string, Connector[]> = {
  [customerIdActive]: [
    { client_id: "co-0001-0000-0000-0000-000000000001", name: "Production SAP", created_at: daysAgo(119) },
  ],
  [customerIdGrace]: [
    { client_id: "co-0002-0000-0000-0000-000000000001", name: "POS middleware", created_at: daysAgo(199) },
  ],
  [customerIdSuspended]: [
    { client_id: "co-0003-0000-0000-0000-000000000001", name: "Legacy ERP", created_at: daysAgo(299) },
  ],
  [customerIdNoSub]: [],
};

export const invoicesFixture: Invoice[] = [
  {
    id: "inv-0001",
    customer_id: customerIdActive,
    period_start: daysAgo(50),
    period_end: daysAgo(20),
    amount: "5000.00",
    currency: "KES",
    status: "PAID",
    issued_at: daysAgo(50),
    paid_at: daysAgo(48),
    notes: null,
  },
  {
    id: "inv-0042",
    customer_id: customerIdSuspended,
    period_start: daysAgo(60),
    period_end: daysAgo(30),
    amount: "12000.00",
    currency: "KES",
    status: "ISSUED",
    issued_at: daysAgo(60),
    paid_at: null,
    notes: "Chargeback disputed by card issuer",
  },
];

export const outboxFixture: OutboxItem[] = [
  {
    id: "ob-0001",
    endpoint: "/v1/purchases",
    branch_code: "MOMBASA-PORT",
    customer_id: customerIdGrace,
    customer_name: "Coastal Retail Group",
    status: "FAILED",
    attempts: 5,
    last_error: "KRA 999: unknown error",
    created_at: hoursAgo(10),
    updated_at: hoursAgo(1),
  },
  {
    id: "ob-0002",
    endpoint: "/v1/stock",
    branch_code: "KISUMU-WEST",
    customer_id: customerIdSuspended,
    customer_name: "Lakeview Wholesale",
    status: "RETRYING",
    attempts: 2,
    last_error: "KRA 990: rate limited",
    created_at: hoursAgo(4),
    updated_at: hoursAgo(1),
  },
  {
    id: "ob-0003",
    endpoint: "/v1/imports",
    branch_code: "NAIROBI-HQ",
    customer_id: customerIdActive,
    customer_name: "Jitihada Traders Ltd",
    status: "SENT",
    attempts: 1,
    last_error: null,
    created_at: hoursAgo(20),
    updated_at: hoursAgo(19),
  },
  {
    id: "ob-0004",
    endpoint: "/v1/notices",
    branch_code: null,
    customer_id: null,
    customer_name: null,
    status: "PENDING",
    attempts: 0,
    last_error: null,
    created_at: hoursAgo(0.2),
    updated_at: hoursAgo(0.2),
  },
];

export const adminCallLogFixture: AdminCallLogEntry[] = [
  { protocol: "OSCU", id: 1, branch_code: "NAIROBI-HQ", endpoint: "/v1/sales", result_cd: "000", result_msg: "Success", result_dt: hoursAgo(1), http_status: null, latency_ms: null, retry_count: 0, created_at: hoursAgo(1) },
  { protocol: "VSCU", id: 2, branch_code: "MOMBASA-PORT", endpoint: "/v1/purchases", result_cd: "999", result_msg: "Unknown error", result_dt: hoursAgo(2), http_status: 500, latency_ms: 340, retry_count: null, created_at: hoursAgo(2) },
  { protocol: "VSCU", id: 3, branch_code: "KISUMU-WEST", endpoint: "/v1/stock", result_cd: "990", result_msg: "Rate limited", result_dt: hoursAgo(3), http_status: 429, latency_ms: 120, retry_count: null, created_at: hoursAgo(3) },
  { protocol: "OSCU", id: 4, branch_code: "NAIROBI-HQ", endpoint: "/v1/sales", result_cd: "000", result_msg: "Success", result_dt: hoursAgo(4), http_status: null, latency_ms: null, retry_count: 0, created_at: hoursAgo(4) },
];

export const syncStatusFixture: SyncStatusRow[] = [
  { branch_code: "MOMBASA-PORT", resource: "stock_moves", last_req_dt: hoursAgo(47 / 60), updated_at: hoursAgo(47 / 60), lag_seconds: 47 * 60 },
  { branch_code: "NAIROBI-HQ", resource: "sales", last_req_dt: hoursAgo(0.1), updated_at: hoursAgo(0.1), lag_seconds: 6 * 60 },
  { branch_code: "KISUMU-WEST", resource: "purchases", last_req_dt: daysAgo(2), updated_at: daysAgo(2), lag_seconds: 2 * 24 * 60 * 60 },
];

export const alertRulesFixture: AlertRule[] = [
  {
    id: "ar-0001",
    name: "Sync lag over 30 min",
    metric: "sync_lag_seconds",
    scope_customer_id: null,
    scope_branch_code: null,
    condition: ">",
    threshold: 1800,
    channel: "email",
    channel_target: "ops@oscu-gateway.example",
    enabled: true,
    created_at: daysAgo(30),
  },
  {
    id: "ar-0002",
    name: "Grace period ending soon",
    metric: "subscription_grace_period_ending",
    scope_customer_id: null,
    scope_branch_code: null,
    condition: "<=",
    threshold: 2,
    channel: "webhook",
    channel_target: "https://hooks.slack.com/services/T000/B000/mockmockmockmock",
    enabled: true,
    created_at: daysAgo(30),
  },
];

export const notificationsFixture: NotificationSent[] = [
  {
    id: "ns-0001",
    alert_rule_id: "ar-0001",
    alert_rule_name: "Sync lag over 30 min",
    fired_at: hoursAgo(1),
    resolved_at: null,
    summary: "MOMBASA-PORT / stock_moves lag reached 47 min",
  },
  {
    id: "ns-0002",
    alert_rule_id: "ar-0002",
    alert_rule_name: "Grace period ending soon",
    fired_at: daysAgo(1),
    resolved_at: hoursAgo(20),
    summary: "Coastal Retail Group enters grace period in 2 days",
  },
];

export const auditLogFixture: AuditLogEntry[] = [
  {
    id: 1,
    admin_user_email: "amina@oscu-gateway.example",
    action: "customer.suspend",
    target_type: "customer",
    target_id: customerIdSuspended,
    before_state: { status: "ACTIVE", suspended_at: null, suspended_reason: null },
    after_state: { status: "SUSPENDED", suspended_at: daysAgo(3), suspended_reason: "Chargeback on invoice INV-0042" },
    reason: "Chargeback on invoice INV-0042",
    created_at: daysAgo(3),
  },
  {
    id: 2,
    admin_user_email: null,
    action: "device.initialize",
    target_type: "branch",
    target_id: "KISUMU-WEST",
    before_state: null,
    after_state: { branch_code: "KISUMU-WEST", status: "ACTIVE" },
    reason: null,
    created_at: daysAgo(300),
  },
];

export const adminUsersFixture: AdminUser[] = [
  {
    id: "au-0001",
    username: "amina",
    full_name: "Amina",
    is_active: true,
    last_login_at: hoursAgo(2),
    created_at: daysAgo(400),
  },
  {
    id: "au-0002",
    username: "ops",
    full_name: "Ops Team",
    is_active: true,
    last_login_at: hoursAgo(5),
    created_at: daysAgo(300),
  },
];
