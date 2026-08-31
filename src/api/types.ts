/**
 * Hand-derived types mirroring:
 *  - docs/api_reference.md ("Admin — Device Provisioning", "Admin — Billing") for the REAL,
 *    already-existing endpoints this app calls for real.
 *  - docs/admin_portal_design.md §5/§7 for the PROPOSED `/admin/api/v1/*` endpoints that do
 *    not exist on the backend yet — served by MSW mocks only (see src/mocks/handlers.ts and
 *    docs/frontend_README.md for exactly which is which).
 *
 * No `any`. If a shape here drifts from the docs, fix the type — don't inline an ad-hoc cast.
 */

// ---- Real, existing backend types ------------------------------------------------------

export type DeviceType = "OSCU" | "VSCU";
export type BranchStatus = "ACTIVE" | "SUSPENDED";

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
  /**
   * `cmc_key` itself is NEVER returned by any endpoint (admin_portal_design.md §9) — only
   * these two support/troubleshooting fields, populated on the admin branch-detail read-model.
   * Absent (undefined) on the raw POST /v1/devices/initialize response.
   */
  cmc_key_last_rotated_at?: string | null;
  cmc_key_fingerprint?: string | null;
  incident_no_local_record?: boolean;
}

export interface DeviceInitializeRequest {
  branch_code: string;
  tin: string;
  bhf_id: string;
  device_type: DeviceType;
  kra_base_url_override?: string | null;
}

export type SubscriptionStatus = "ACTIVE" | "SUSPENDED" | "CANCELLED";

export interface Subscription {
  client_id: string;
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
  client_id: string;
  period_start: string;
  period_end: string;
  amount: string;
  currency: string;
  status: InvoiceStatus;
  issued_at: string;
  paid_at: string | null;
  notes: string | null;
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

export interface Client {
  id: string;
  name: string;
  allowed_branch_ids: string[];
  created_at: string;
  subscription: Subscription | null;
  branch_count: number;
  last_kra_call_at: string | null;
  failing_calls_24h: number;
}

export interface ClientSecretOnce {
  client_id: string;
  client_secret: string;
}

export interface CreateClientRequest {
  name: string;
  allowed_branch_ids: string[];
}

export type OutboxStatus = "PENDING" | "RETRYING" | "FAILED" | "SENT" | "CANCELLED";

export interface OutboxItem {
  id: string;
  endpoint: string;
  branch_code: string | null;
  client_id: string | null;
  client_name: string | null;
  status: OutboxStatus;
  attempts: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface KraCallLogEntry {
  id: number;
  branch_code: string | null;
  client_id: string | null;
  endpoint: string;
  result_cd: string | null;
  result_msg: string | null;
  result_dt: string | null;
  retry_count: number;
  created_at: string;
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
  blocked_client_count: number;
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
  scope_client_id: string | null;
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
  scope_client_id?: string | null;
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
  target_type: "client" | "branch" | "invoice" | "alert_rule" | "admin_user" | "outbox";
  target_id: string;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  reason: string | null;
  created_at: string;
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
