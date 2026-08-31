/**
 * Hand-written mock fixtures mirroring the shapes in admin_portal_design.md §5/§7 and the real
 * models in kra_vscu_backend/app/db/models.py. Kept in one mutable in-memory module so MSW
 * handlers can support real create/update/list mutations across a dev session.
 */
import type {
  AdminUser,
  AlertRule,
  AuditLogEntry,
  Branch,
  Client,
  Invoice,
  KraCallLogEntry,
  NotificationSent,
  OutboxItem,
  Subscription,
  SyncStatusRow,
} from "@/api/types";

const now = Date.now();
const hoursAgo = (h: number) => new Date(now - h * 60 * 60 * 1000).toISOString();
const daysFromNow = (d: number) => new Date(now + d * 24 * 60 * 60 * 1000).toISOString();
const daysAgo = (d: number) => new Date(now - d * 24 * 60 * 60 * 1000).toISOString();

export const branchesFixture: Branch[] = [
  {
    branch_code: "NAIROBI-HQ",
    tin: "A123456789Z",
    bhf_id: "00",
    status: "ACTIVE",
    device_type: "OSCU",
    kra_base_url_override: null,
    dvc_id: "DVC-0001",
    sdc_id: "SDC-0001",
    mrc_no: "MRC-0001",
    cmc_key_last_rotated_at: daysAgo(90),
    cmc_key_fingerprint: "…a91f",
  },
  {
    branch_code: "MOMBASA-PORT",
    tin: "A123456789Z",
    bhf_id: "01",
    status: "ACTIVE",
    device_type: "VSCU",
    kra_base_url_override: null,
    dvc_id: "DVC-0002",
    sdc_id: "SDC-0002",
    mrc_no: "MRC-0002",
    cmc_key_last_rotated_at: daysAgo(30),
    cmc_key_fingerprint: "…7c02",
  },
  {
    branch_code: "KISUMU-WEST",
    tin: "B987654321Y",
    bhf_id: "00",
    status: "SUSPENDED",
    device_type: "OSCU",
    kra_base_url_override: null,
    dvc_id: "DVC-0003",
    sdc_id: "SDC-0003",
    mrc_no: "MRC-0003",
    cmc_key_last_rotated_at: daysAgo(300),
    cmc_key_fingerprint: "…f001",
  },
];

const clientIdActive = "c1111111-1111-1111-1111-111111111111";
const clientIdGrace = "c2222222-2222-2222-2222-222222222222";
const clientIdSuspended = "c3333333-3333-3333-3333-333333333333";
const clientIdNoSub = "c4444444-4444-4444-4444-444444444444";

export const subscriptionsFixture: Record<string, Subscription> = {
  [clientIdActive]: {
    client_id: clientIdActive,
    plan_name: "STANDARD",
    status: "ACTIVE",
    current_period_end: daysFromNow(20),
    grace_period_days: null,
    suspended_at: null,
    suspended_reason: null,
  },
  [clientIdGrace]: {
    client_id: clientIdGrace,
    plan_name: "STANDARD",
    status: "ACTIVE",
    current_period_end: daysAgo(2),
    grace_period_days: 7,
    suspended_at: null,
    suspended_reason: null,
  },
  [clientIdSuspended]: {
    client_id: clientIdSuspended,
    plan_name: "PREMIUM",
    status: "SUSPENDED",
    current_period_end: daysFromNow(10),
    grace_period_days: null,
    suspended_at: daysAgo(3),
    suspended_reason: "Chargeback on invoice INV-0042",
  },
};

export const clientsFixture: Client[] = [
  {
    id: clientIdActive,
    name: "Jitihada Traders Ltd",
    allowed_branch_ids: ["NAIROBI-HQ"],
    created_at: daysAgo(120),
    subscription: subscriptionsFixture[clientIdActive],
    branch_count: 1,
    last_kra_call_at: hoursAgo(1),
    failing_calls_24h: 0,
  },
  {
    id: clientIdGrace,
    name: "Coastal Retail Group",
    allowed_branch_ids: ["MOMBASA-PORT"],
    created_at: daysAgo(200),
    subscription: subscriptionsFixture[clientIdGrace],
    branch_count: 1,
    last_kra_call_at: hoursAgo(6),
    failing_calls_24h: 3,
  },
  {
    id: clientIdSuspended,
    name: "Lakeview Wholesale",
    allowed_branch_ids: ["KISUMU-WEST"],
    created_at: daysAgo(300),
    subscription: subscriptionsFixture[clientIdSuspended],
    branch_count: 1,
    last_kra_call_at: daysAgo(3),
    failing_calls_24h: 12,
  },
  {
    id: clientIdNoSub,
    name: "New Prospect Stores",
    allowed_branch_ids: [],
    created_at: hoursAgo(2),
    subscription: null,
    branch_count: 0,
    last_kra_call_at: null,
    failing_calls_24h: 0,
  },
];

export const invoicesFixture: Invoice[] = [
  {
    id: "inv-0001",
    client_id: clientIdActive,
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
    client_id: clientIdSuspended,
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
    client_id: clientIdGrace,
    client_name: "Coastal Retail Group",
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
    client_id: clientIdSuspended,
    client_name: "Lakeview Wholesale",
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
    client_id: clientIdActive,
    client_name: "Jitihada Traders Ltd",
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
    client_id: null,
    client_name: null,
    status: "PENDING",
    attempts: 0,
    last_error: null,
    created_at: hoursAgo(0.2),
    updated_at: hoursAgo(0.2),
  },
];

export const kraCallLogFixture: KraCallLogEntry[] = [
  { id: 1, branch_code: "NAIROBI-HQ", client_id: clientIdActive, endpoint: "/v1/sales", result_cd: "000", result_msg: "Success", result_dt: hoursAgo(1), retry_count: 0, created_at: hoursAgo(1) },
  { id: 2, branch_code: "MOMBASA-PORT", client_id: clientIdGrace, endpoint: "/v1/purchases", result_cd: "999", result_msg: "Unknown error", result_dt: hoursAgo(2), retry_count: 3, created_at: hoursAgo(2) },
  { id: 3, branch_code: "KISUMU-WEST", client_id: clientIdSuspended, endpoint: "/v1/stock", result_cd: "990", result_msg: "Rate limited", result_dt: hoursAgo(3), retry_count: 1, created_at: hoursAgo(3) },
  { id: 4, branch_code: "NAIROBI-HQ", client_id: clientIdActive, endpoint: "/v1/sales", result_cd: "000", result_msg: "Success", result_dt: hoursAgo(4), retry_count: 0, created_at: hoursAgo(4) },
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
    scope_client_id: null,
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
    scope_client_id: null,
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
    action: "client.suspend",
    target_type: "client",
    target_id: clientIdSuspended,
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
    email: "amina@oscu-gateway.example",
    role: "SUPERADMIN",
    mfa_enabled: true,
    is_active: true,
    last_login_at: hoursAgo(2),
    created_at: daysAgo(400),
  },
  {
    id: "au-0002",
    email: "ops@oscu-gateway.example",
    role: "OPS",
    mfa_enabled: false,
    is_active: true,
    last_login_at: hoursAgo(5),
    created_at: daysAgo(300),
  },
];
