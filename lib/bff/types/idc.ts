/**
 * IDC Provider — BFF wire DTOs (snake_case).
 *
 * Source of truth: `docs/swagger/idc.yaml` (v1.0.0, provisional — Forward
 * Compatibility). These types mirror the wire shape 1:1; the snake→domain
 * conversion lives ONLY in `app/lib/api/idc.ts` (`toIdcResourceView`), so a
 * response-shape change touches this file + that mapper and nothing else
 * (see `design/idc-implementation-plan.md` §5).
 *
 * Casing: IDC GET responses are raw snake passthrough (httpBff uses
 * `get(path, { raw: true })`), matching the mock and this file. The mapper
 * owns camel conversion — do not camelCase at the BFF layer for IDC.
 *
 * idc.yaml is reconciled to these DTOs 1:1 (no remaining schema divergence):
 *   - database_type: 7 values                     — G5 (yaml updated)
 *   - ips: up to 6                                — G2 (yaml updated)
 *   - exclusion_reason on the resource           — G3 (yaml updated)
 *   - per-resource source_ips / firewall_open    — G6 (installation-status.resources)
 * Remaining backend-dependent items (G1 approval transition, Step 5 test-connection
 * wiring) are tracked in `design/idc-implementation-plan.md` §6.
 */

export type IdcTfStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';

export type IdcInputFormatWire = 'IP' | 'HOST';

export type IdcDatabaseTypeWire =
  | 'MYSQL'
  | 'POSTGRESQL'
  | 'ORACLE'
  | 'MSSQL'
  | 'MARIADB'
  | 'MONGODB'
  | 'REDIS';

export type IdcConnectionStatusWire = 'PENDING' | 'SUCCESS';

export type IdcHealthWire = 'HEALTHY' | 'UNHEALTHY';

/**
 * One IDC integration target. Fields above `exclusion_reason` are the user
 * input (swagger `IdcResourceInput`); fields below are server-assigned and
 * present from Step 2 onward. For the v15 demo the mock co-locates the
 * server-assigned fields here; in the real contract source_ips/firewall_open
 * are surfaced via installation-status (§6 G6/G7).
 */
export interface IdcResourceInput {
  /** Assigned after confirm; absent for newly entered (temp) input. */
  resource_id?: string;
  name: string;
  input_format: IdcInputFormatWire;
  /** input_format=IP. Up to 6 (§6 G2). */
  ips?: string[];
  /** input_format=HOST. Max length 100 (§6 decision #56). */
  host?: string;
  port: number;
  database_type: IdcDatabaseTypeWire;
  /** Oracle only — required when database_type=ORACLE. */
  service_id?: string;
  credential_id?: string;
  /** Present when the target is excluded from integration (§6 G3). */
  exclusion_reason?: string;
  // ---- server-assigned, present from Step 2 (§6 G6/G7) ----
  source_ips?: string[];
  firewall_open?: boolean;
  connection_status?: IdcConnectionStatusWire;
  health?: IdcHealthWire;
  /** Step 1 "연동 완료 여부" display value (e.g. "연동 완료" / "연동 진행중" / "—"). */
  done?: string;
}

/**
 * Read-response resource — swagger `IdcResource` (allOf `IdcResourceInput` +
 * required `resource_id`). GET `/resources` and `/previous-request` return these,
 * so the id Step 4 merges by / edit-update keys on is guaranteed at the type
 * level. Write requests still use `IdcResourceInput` (new rows have no id).
 *
 * `app/lib/api/idc.ts` keeps an index fallback as runtime defense — `fetchInfraJson`
 * does not validate, so a non-conformant backend could still omit it at runtime.
 */
export interface IdcResourceWire extends IdcResourceInput {
  resource_id: string;
}

export interface IdcResourcesResponse {
  resources: IdcResourceWire[];
}

/** Per-resource install detail (§6 G6) — basis for the firewall column/modal. */
export interface IdcResourceInstallStatus {
  resource_id: string;
  source_ips: string[];
  firewall_open: boolean;
}

export interface IdcInstallationStatus {
  provider: 'IDC';
  /** BDC Terraform install — Step 4 task 1. */
  bdc_tf: IdcTfStatus;
  /** Roll-up: true only when every resource path is open — Step 4 task 2. */
  firewall_opened: boolean;
  /** Per-resource firewall/source-ip detail (§6 G6). */
  resources?: IdcResourceInstallStatus[];
  last_checked_at?: string;
  error?: { code: string; message: string };
}

export interface IdcSourceIpRecommendation {
  source_ips: string[];
  port: number;
  description: string;
}

export interface IdcConfirmFirewallResponse {
  confirmed: boolean;
  confirmed_at: string;
}
