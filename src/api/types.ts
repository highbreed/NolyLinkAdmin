/**
 * Hand-derived types mirroring:
 *  - docs/api_reference.md for the REAL, already-existing endpoints this app calls for real.
 *  - docs/admin_portal_design.md §5/§7 for the PROPOSED `/admin/api/v1/*` endpoints that do
 *    not exist on the backend yet — served by MSW mocks only (see src/mocks/handlers.ts and
 *    docs/frontend_README.md for exactly which is which).
 *
 * No `any`. If a shape here drifts from the docs, fix the type — don't inline an ad-hoc cast.
 */

// ---- Real: Customer / Client(connector) split (2026-09-01) ------------------------------
// Customer = the paying business, owns branch access + billing. Client = one OAuth2
// connector credential integrating on a Customer's behalf — a Customer can have several.
// Confirmed against the live backend (app/db/models.py, app/api/v1/endpoints/customers.py).

export interface Customer {
  id: string;
  name: string;
  branch_codes: string[];
  created_at: string;
}

export interface CreateCustomerRequest {
  name: string;
  branch_codes: string[];
}

export interface UpdateCustomerRequest {
  name?: string | null;
  branch_codes?: string[] | null;
}

// ---- Real: POST /v1/customers/onboard — single-call stepper-form onboarding (2026-09-01) --
// Registers every branch (KRA device-init, plus VSCU app init for VSCU ones) and creates the
// Customer with whichever branches succeeded. Best-effort per branch, not atomic — KRA has no
// "delete device" API, so a real rollback would risk leaving KRA thinking a branch is
// registered with nothing local to show for it. Always 201s, even if every branch failed.

export interface CustomerOnboardBranchInput {
  branch_code: string;
  tin: string;
  bhf_id: string;
  device_type: DeviceType;
  /** The customer's own local VSCU app URL — required when device_type is "VSCU". */
  base_url?: string | null;
  kra_base_url_override?: string | null;
}

export interface CustomerOnboardRequest {
  name: string;
  branches: CustomerOnboardBranchInput[];
}

export type BranchOnboardStatus = "REGISTERED" | "FAILED";

export interface BranchOnboardResult {
  branch_code: string;
  device_type: DeviceType;
  status: BranchOnboardStatus;
  branch_id: string | null;
  error: string | null;
}

export interface CustomerOnboardResponse {
  customer: Customer;
  branches: BranchOnboardResult[];
}

export interface Connector {
  client_id: string;
  name: string;
  created_at: string;
}

export interface ConnectorSecretOnce {
  client_id: string;
  client_secret: string;
  name: string;
}

// ---- Real: device provisioning + branch admin read-model --------------------------------

export type DeviceType = "OSCU" | "VSCU";
export type BranchStatus = "ACTIVE" | "SUSPENDED";

/** Raw POST /v1/devices/initialize response — never includes cmc_key. */
export interface Branch {
  branch_code: string;
  tin: string;
  bhf_id: string;
  status: BranchStatus;
  device_type: DeviceType;
  kra_base_url_override: string | null;
  dvc_id: string | null;
  sdc_id: string | null;
  mrc_no: string | null;
}

export interface DeviceInitializeRequest {
  branch_code: string;
  tin: string;
  bhf_id: string;
  device_type: DeviceType;
  kra_base_url_override?: string | null;
}

export interface VscuHealth {
  base_url: string;
  initialized_at: string | null;
  last_sequence_sync_at: string | null;
  last_known_invc_no: number | null;
  last_known_sale_rcpt_no: number | null;
  last_successful_call_at: string | null;
  last_error: string | null;
}

/** GET /v1/admin/branches[/{code}] — the admin dashboard's read-model, not device-init's. */
export interface BranchAdmin {
  id: string;
  branch_code: string;
  tin: string;
  bhf_id: string;
  device_type: DeviceType;
  status: BranchStatus;
  created_at: string;
  vscu: VscuHealth | null;
}

// ---- Real: billing, keyed by customer_id (was client_id before the 2026-09-01 split) -----

export type SubscriptionStatus = "ACTIVE" | "SUSPENDED" | "CANCELLED";

export interface Subscription {
  customer_id: string;
  plan_name: string;
  status: SubscriptionStatus;
  current_period_end: string;
  grace_period_days: number | null;
  suspended_at: string | null;
  suspended_reason: string | null;
}

export type InvoiceStatus = "ISSUED" | "PAID";

export interface Invoice {
  id: string;
  customer_id: string;
  period_start: string;
  period_end: string;
  amount: string;
  currency: string;
  status: InvoiceStatus;
  issued_at: string;
  paid_at: string | null;
  notes: string | null;
}

// ---- Real: GET /v1/admin/call-logs — merged OSCU/VSCU log viewer ------------------------
// No true pagination server-side, only `limit` (most recent N) — see api/monitoring.ts.

export type CallLogProtocol = "OSCU" | "VSCU";

export interface AdminCallLogEntry {
  protocol: CallLogProtocol;
  id: number;
  branch_code: string | null;
  endpoint: string;
  result_cd: string | null;
  result_msg: string | null;
  result_dt: string | null;
  http_status: number | null;
  latency_ms: number | null;
  retry_count: number | null;
  created_at: string;
}

// ---- Real: admin portal login (POST /admin/login, /admin/users*) -----------------------
// No MFA, no roles — confirmed against the live backend (2026-08-31). `AdminRole` below is a
// frontend-only concept for exercising the RBAC nav/route-gating UI ahead of a real roles
// backend; it has no server-side counterpart.

export interface AdminLoginRequest {
  username: string;
  password: string;
}

export interface AdminLoginResponse {
  access_token: string;
  token_type: "bearer";
  expires_in: number;
}

export interface AdminUser {
  id: string;
  username: string;
  full_name: string | null;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
}

export interface CreateAdminUserRequest {
  username: string;
  password: string;
  full_name?: string | null;
}

// ---- Frontend-only RBAC concept (design doc §2) — not backed by a real roles column ------

export type AdminRole = "SUPERADMIN" | "OPS" | "BILLING_ADMIN" | "AUDITOR";

// ---- Mocked-only: no real backend for any of these yet -----------------------------------

export type OutboxStatus = "PENDING" | "RETRYING" | "FAILED" | "SENT" | "CANCELLED";

export interface OutboxItem {
  id: string;
  endpoint: string;
  branch_code: string | null;
  customer_id: string | null;
  customer_name: string | null;
  status: OutboxStatus;
  attempts: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface KraCallTimeseriesPoint {
  bucket_start: string;
  counts_by_result_cd: Record<string, number>;
}

export interface SyncStatusRow {
  branch_code: string;
  resource: string;
  last_req_dt: string;
  updated_at: string;
  lag_seconds: number;
}

export interface MonitoringSummary {
  kra_call_success_rate_1h: number;
  kra_call_success_rate_24h: number;
  outbox_counts: Record<OutboxStatus, number>;
  stale_branch_count: number;
  blocked_customer_count: number;
  worst_sync_offender: SyncStatusRow | null;
}

export interface BillingOverview {
  counts: Record<"ACTIVE" | "GRACE" | "BLOCKED" | "SUSPENDED" | "CANCELLED" | "NO_SUBSCRIPTION", number>;
}

export type AlertMetric =
  | "sync_lag_seconds"
  | "outbox_failed_count"
  | "subscription_grace_period_ending"
  | "kra_call_failure_rate";

export type AlertCondition = ">" | ">=" | "==" | "<=";
export type AlertChannel = "email" | "webhook";

export interface AlertRule {
  id: string;
  name: string;
  metric: AlertMetric;
  scope_customer_id: string | null;
  scope_branch_code: string | null;
  condition: AlertCondition;
  threshold: number;
  channel: AlertChannel;
  channel_target: string;
  enabled: boolean;
  created_at: string;
}

export interface AlertRuleInput {
  name: string;
  metric: AlertMetric;
  scope_customer_id?: string | null;
  scope_branch_code?: string | null;
  condition: AlertCondition;
  threshold: number;
  channel: AlertChannel;
  channel_target: string;
  enabled: boolean;
}

export interface NotificationSent {
  id: string;
  alert_rule_id: string;
  alert_rule_name: string;
  fired_at: string;
  resolved_at: string | null;
  summary: string;
}

export interface AuditLogEntry {
  id: number;
  admin_user_email: string | null; // null = break-glass X-Admin-Api-Key used
  action: string;
  target_type: "customer" | "connector" | "branch" | "invoice" | "alert_rule" | "admin_user" | "outbox";
  target_id: string;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  reason: string | null;
  created_at: string;
}

// ---- Real: reference-data cache (KRA code lists + item classes) + per-customer allow-lists --
// See kra_vscu_backend/docs/reference_data_and_code_assignment.md. `classification` is the
// friendly slug (code_cache_service.CLASSIFICATION_SLUGS) when one exists, otherwise the raw
// `cd_cls`, plus the pseudo-slug "item-classification" for kra_item_classes.

export interface ReferenceCodeClassification {
  classification: string;
  cd_cls: string;
  code_count: number;
}

export interface ReferenceCode {
  cd: string;
  cd_nm: string;
  cd_desc: string;
  srt_ord: number;
  use_yn: "Y" | "N";
}

export interface ItemClass {
  item_cls_cd: string;
  item_cls_nm: string;
  item_cls_lvl: string;
  tax_ty_cd: string | null;
  mjr_tg_yn: string | null;
  use_yn: string;
}

export interface CustomerCodeAllowlistEntry {
  classification: string;
  codes: string[];
}

// ---- Shared list/query envelope ----------------------------------------------------------

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface SortParam {
  id: string;
  desc: boolean;
}
