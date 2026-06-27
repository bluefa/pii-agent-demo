/**
 * IDC Provider — client API + the single wire↔domain boundary.
 *
 * UI/hooks consume ONLY the domain models below (`IdcResourceView`,
 * `IdcInstallationView`). Wire shape (now zod-generated) never leaks past
 * this file. A response-shape change touches the swagger, re-runs gen:api,
 * and updates the mappers here — nothing in the UI.
 *
 * Casing (ADR-019 zod-codegen): all four IDC GETs validate with
 * schemas.X.parse() at the route (no camelCaseKeys). This mapper receives
 * the validated snake shape and converts to domain models. Two wire shapes:
 *   - previous-request / installation-status: snake (standard swagger);
 *   - NLB endpoints: camelCase ON THE WIRE (per swagger), so NLB mappers are
 *     a near-identity copy.
 */

import type { z } from 'zod';
import type { schemas } from '@/lib/generated/install-v1';
import { fetchInfraJson } from '@/app/lib/api/infra';
import { getApprovedIntegration, getConfirmedIntegration } from '@/app/lib/api';
import type {
  ApprovedIntegrationExcludedResourceItem,
} from '@/app/lib/api';
import type { ConfirmedIntegrationResourceInfo, ResourceSnapshot } from '@/lib/types';
import { idcDbTypeByLabel, idcDbTypeByWire } from '@/lib/constants/idc';
import type { InstallTaskStatus } from '@/lib/constants/install-task';

// ---------------------------------------------------------------------------
// Local type aliases for generated schema types used as mapper inputs
// ---------------------------------------------------------------------------
type IdcResourceInputWire = z.infer<typeof schemas.IdcResourceInput>;
type IdcPreviousRequestResponseWire = z.infer<typeof schemas.IdcPreviousRequestResponse>;
type IdcInstallationStatusResponseWire = z.infer<typeof schemas.IdcInstallationStatusResponse>;
type IdcStepStatusWire = z.infer<typeof schemas.CloudInstallationStepStatusDto>;
type NlbOccupiedResourceResponseWire = z.infer<typeof schemas.NlbOccupiedResourceResponse>;
type NlbTableResponseWire = z.infer<typeof schemas.NlbTableResponse>;

// ---------------------------------------------------------------------------
// Domain models (UI contract — stable across wire changes)
// ---------------------------------------------------------------------------

/** Domain-side database type label lookup. swagger `database_type` is a plain
 *  string; we narrow to the known set for label resolution. */
export type IdcDatabaseTypeWire =
  | 'MYSQL'
  | 'POSTGRESQL'
  | 'ORACLE'
  | 'MSSQL'
  | 'MARIADB'
  | 'MONGODB'
  | 'REDIS';

export type IdcKind = 'SINGLE' | 'MULTIPLE_IP' | 'DOMAIN';
export type IdcConnState = 'PENDING' | 'SUCCESS';
export type IdcHealth = 'HEALTHY' | 'UNHEALTHY';

export interface IdcResourceView {
  /** React key + DR scoping. Server id when persisted, else a UI temp id. */
  resourceId: string;
  /** True when backed by a server id (controls write serialization). */
  persisted: boolean;
  kind: IdcKind;
  /** Hosts only (no port): ips for IP mode, [domain] for domain mode. */
  hosts: string[];
  port: number;
  databaseTypeLabel: string;
  databaseTypeWire: IdcDatabaseTypeWire;
  oracleSid?: string;
  credentialId?: string;
  /** Assigned from Step 2 (1..2). */
  sourceIps: string[];
  firewallOpen: boolean;
  connection: IdcConnState;
  health: IdcHealth;
  /** Step 1 "연동 완료 여부" display value. */
  done: string;
  excluded: boolean;
  exclusionReason?: string;
}

/** Shared 5-value install enum (verbatim from swagger). UNKNOWN is a real
 *  domain state, never collapsed at the domain layer — the →"작업중" collapse is
 *  UI-only (`idcInstallStatusLabel`) so the data stays faithful. */
export type IdcInstallStatus = NonNullable<
  z.infer<typeof schemas.IdcResourceInstallationStatusDto>['installation_status']
>;

export interface IdcInstallStepView {
  status: IdcInstallStatus;
  guide?: string;
}

export interface IdcResourceInstallView {
  resourceId: string;
  installationStatus: IdcInstallStatus;
  cxTerraform: IdcInstallStepView;
  bdpTerraform: IdcInstallStepView;
  firewallCheck: IdcInstallStepView;
}

export interface IdcInstallationView {
  lastCheck?: { status: IdcInstallStatus; checkedAt?: string; failReason?: string };
  resources: IdcResourceInstallView[];
}

/** One occupied-resource row for an NLB index (camel wire — identity copy). */
export interface NlbOccupiedResource {
  serviceCode: string;
  serviceName: string;
  targetSourceId: number;
  isLatest: boolean;
  ips: string[];
  port: number;
  databaseType: string;
  databaseName: string;
}

/** One NLB capacity row (camel wire — identity copy). */
export interface NlbTableRow {
  nlbIndex: number;
  nlbIpList: string[];
  occupiedListenerCount: number;
}

// ---------------------------------------------------------------------------
// Install-status → UI label/bucket adapters (UI layer; domain stays faithful)
// ---------------------------------------------------------------------------

/** IDC install enum → install-task card visual bucket. UNKNOWN shares the
 *  IN_PROGRESS bucket (it is work-in-progress, not an error/unknown state). */
export const IDC_INSTALL_TASK_STATUS: Record<IdcInstallStatus, InstallTaskStatus> = {
  COMPLETED: 'done',
  FAIL: 'failed',
  IN_PROGRESS: 'running',
  UNKNOWN: 'running',
  SKIP: 'done',
};

/** Human label for an IDC install status. UNKNOWN and IN_PROGRESS both render "작업중". */
export const idcInstallStatusLabel = (s: IdcInstallStatus): string =>
  s === 'UNKNOWN' || s === 'IN_PROGRESS'
    ? '작업중'
    : s === 'COMPLETED'
      ? '완료'
      : s === 'FAIL'
        ? '실패'
        : '제외'; // SKIP

// ---------------------------------------------------------------------------
// Mappers (the ONLY wire↔domain conversion site)
// ---------------------------------------------------------------------------

const deriveKind = (wire: IdcResourceInputWire): IdcKind => {
  if (wire.input_format === 'HOST') return 'DOMAIN';
  return (wire.ips?.length ?? 0) > 1 ? 'MULTIPLE_IP' : 'SINGLE';
};

const IDC_DB_TYPE_WIRES: readonly IdcDatabaseTypeWire[] = [
  'MYSQL',
  'POSTGRESQL',
  'ORACLE',
  'MSSQL',
  'MARIADB',
  'MONGODB',
  'REDIS',
];

/** swagger `database_type` is a plain string; narrow to the known wire union for
 *  the domain (label lookup) and fall back to MYSQL for an unrecognized value. */
const toDbTypeWire = (value: string | undefined): IdcDatabaseTypeWire =>
  IDC_DB_TYPE_WIRES.includes(value as IdcDatabaseTypeWire)
    ? (value as IdcDatabaseTypeWire)
    : 'MYSQL';

/**
 * swagger `IdcResourceInput` (previous-request item) → domain view. The schema
 * has NO `name`/`resource_id` and NO server-assigned fields (`source_ips`,
 * `firewall_open`, `connection_status`, `health`, `done`); those left the
 * contract, so every row is non-persisted (temp id `idc-row-${index}`) and the
 * server-assigned columns default to their idle/required values.
 */
export const toIdcResourceView = (wire: IdcResourceInputWire, index = 0): IdcResourceView => ({
  resourceId: `idc-row-${index}`,
  persisted: false,
  kind: deriveKind(wire),
  hosts: wire.input_format === 'IP' ? (wire.ips ?? []) : wire.host ? [wire.host] : [],
  port: wire.port ?? 0,
  databaseTypeLabel: idcDbTypeByWire(toDbTypeWire(wire.database_type))?.label ?? wire.database_type ?? '',
  databaseTypeWire: toDbTypeWire(wire.database_type),
  oracleSid: wire.service_id,
  credentialId: wire.credential_id,
  sourceIps: [],
  firewallOpen: false,
  connection: 'PENDING',
  health: 'HEALTHY',
  done: '—',
  excluded: wire.exclusion_reason !== undefined && wire.exclusion_reason !== '',
  exclusionReason: wire.exclusion_reason,
});

// ---------------------------------------------------------------------------
// Post-submission integration mappers (Step 2–7). The IDC steps render
// IdcResourceView, so these adapt the SHARED approved/confirmed domain shapes
// (and the excluded list) returned by the standard endpoints. The shared
// approved/confirmed normalizers preserve the swagger idc_* fields
// (idc_host_format/idc_ips/idc_host/idc_source_ips), so IDC rows surface real
// kind/hosts/Source IPs; non-IDC rows fall back to host/port.
// ---------------------------------------------------------------------------

/** The idc_* subset shared by the confirmed/approved domain rows. */
interface IdcWireFields {
  idc_host_format?: 'IP' | 'HOST';
  idc_ips?: string[];
  idc_host?: string;
  idc_source_ips?: string[];
}

/** kind from the idc fields: HOST→DOMAIN, >1 ip→MULTIPLE_IP, else SINGLE. */
const deriveKindFromIdcFields = (fields: IdcWireFields): IdcKind => {
  if (fields.idc_host_format === 'HOST') return 'DOMAIN';
  return (fields.idc_ips?.length ?? 0) > 1 ? 'MULTIPLE_IP' : 'SINGLE';
};

/** Hosts (no port) from the idc fields: ips for IP mode, [host] for domain mode. */
const hostsFromIdcFields = (fields: IdcWireFields): string[] =>
  fields.idc_host_format === 'IP'
    ? (fields.idc_ips ?? [])
    : fields.idc_host
      ? [fields.idc_host]
      : [];

/**
 * Shared `ConfirmedIntegrationResourceInfo` (confirmed-integration, Step 4–7) →
 * domain view. Confirmed rows are always integration targets. IDC rows carry
 * idc_* fields (host format, ips, host, source_ips) passed through by the
 * confirmed normalizer; non-IDC rows fall back to host/port.
 */
export const toIdcResourceViewFromConfirmed = (
  wire: ConfirmedIntegrationResourceInfo,
  index = 0,
): IdcResourceView => {
  const dbWire = toDbTypeWire(wire.database_type ?? undefined);
  const idcFields: IdcWireFields = {
    idc_host_format: wire.idc_host_format,
    idc_ips: wire.idc_ips,
    idc_host: wire.idc_host,
    idc_source_ips: wire.idc_source_ips,
  };
  const hasIdcFields = !!wire.idc_host_format;
  return {
    resourceId: wire.resource_id || `idc-confirmed-${index}`,
    persisted: !!wire.resource_id,
    kind: hasIdcFields ? deriveKindFromIdcFields(idcFields) : 'SINGLE',
    hosts: hasIdcFields ? hostsFromIdcFields(idcFields) : wire.host ? [wire.host] : [],
    port: wire.port ?? 0,
    databaseTypeLabel: idcDbTypeByWire(dbWire)?.label ?? wire.database_type ?? '',
    databaseTypeWire: dbWire,
    oracleSid: wire.oracle_service_id ?? undefined,
    credentialId: wire.credential_id ?? undefined,
    sourceIps: wire.idc_source_ips ?? [],
    firewallOpen: false,
    connection: 'PENDING',
    health: 'HEALTHY',
    done: '—',
    excluded: false,
    exclusionReason: undefined,
  };
};

/**
 * Shared `ResourceSnapshot` (approved-integration, Step 3) → domain view. IDC
 * rows carry idc_* fields passed through by the approved-integration normalizer;
 * non-IDC rows fall back to endpoint_config host/port.
 */
export const toIdcResourceViewFromSnapshot = (
  wire: ResourceSnapshot,
  index = 0,
): IdcResourceView => {
  const ec = wire.endpoint_config;
  const idcFields: IdcWireFields = {
    idc_host_format: wire.idc_host_format,
    idc_ips: wire.idc_ips,
    idc_host: wire.idc_host,
    idc_source_ips: wire.idc_source_ips,
  };
  const hasIdcFields = !!wire.idc_host_format;
  const dbWire = toDbTypeWire(ec?.db_type);
  return {
    resourceId: wire.resource_id || `idc-approved-${index}`,
    persisted: !!wire.resource_id,
    kind: hasIdcFields ? deriveKindFromIdcFields(idcFields) : 'SINGLE',
    hosts: hasIdcFields ? hostsFromIdcFields(idcFields) : ec?.host ? [ec.host] : [],
    port: ec?.port ?? 0,
    databaseTypeLabel: idcDbTypeByWire(dbWire)?.label ?? ec?.db_type ?? '',
    databaseTypeWire: dbWire,
    oracleSid: ec?.oracleServiceId,
    credentialId: wire.credential_id ?? undefined,
    sourceIps: wire.idc_source_ips ?? [],
    firewallOpen: false,
    connection: 'PENDING',
    health: 'HEALTHY',
    done: '—',
    excluded: false,
    exclusionReason: undefined,
  };
};

/**
 * Shared `ExcludedResourceInfoDto` (approved-integration excluded list, Step 2/3)
 * → domain view (비대상 row). Only id/name/type/reason are available; endpoint and
 * source-IP fields are absent for excluded rows (the `excl` column shows the reason).
 */
export const toIdcResourceViewFromExcluded = (
  wire: ApprovedIntegrationExcludedResourceItem,
  index = 0,
): IdcResourceView => {
  const dbWire = toDbTypeWire(wire.database_type ?? undefined);
  return {
    resourceId: wire.resource_id || `idc-excluded-${index}`,
    persisted: !!wire.resource_id,
    kind: 'SINGLE',
    hosts: [],
    port: 0,
    databaseTypeLabel: idcDbTypeByWire(dbWire)?.label ?? wire.database_type ?? '',
    databaseTypeWire: dbWire,
    oracleSid: undefined,
    credentialId: undefined,
    sourceIps: [],
    firewallOpen: false,
    connection: 'PENDING',
    health: 'HEALTHY',
    done: '—',
    excluded: true,
    exclusionReason: wire.exclusion_reason,
  };
};

/** Convert a display DB-type label (e.g. "MySQL") to its wire enum. */
export const idcDbTypeWireFromLabel = (label: string): IdcDatabaseTypeWire | undefined =>
  idcDbTypeByLabel(label)?.wire;

const toStepView = (wire: IdcStepStatusWire | undefined): IdcInstallStepView => ({
  // A missing status is "작업중", never silently COMPLETED (faithful default).
  status: wire?.status ?? 'UNKNOWN',
  guide: wire?.guide,
});

export const toIdcInstallationView = (
  wire: IdcInstallationStatusResponseWire,
): IdcInstallationView => ({
  lastCheck: wire.last_check
    ? {
        status: wire.last_check.status ?? 'UNKNOWN',
        checkedAt: wire.last_check.checked_at,
        failReason: wire.last_check.fail_reason,
      }
    : undefined,
  resources: (wire.resources ?? []).map((r) => ({
    resourceId: r.resource_id ?? '',
    installationStatus: r.installation_status ?? 'UNKNOWN',
    cxTerraform: toStepView(r.bdc_side_cx_terraform_apply),
    bdpTerraform: toStepView(r.bdc_side_bdp_terraform_apply),
    firewallCheck: toStepView(r.firewall_check),
  })),
});

const toNlbOccupiedResource = (w: NlbOccupiedResourceResponseWire): NlbOccupiedResource => ({
  serviceCode: w.serviceCode ?? '',
  serviceName: w.serviceName ?? '',
  targetSourceId: w.targetSourceId ?? 0,
  isLatest: w.isLatest ?? false,
  ips: w.ipSet ?? [],
  port: w.port ?? 0,
  databaseType: w.databaseType ?? '',
  databaseName: w.databaseName ?? '',
});

const toNlbTableRow = (w: NlbTableResponseWire): NlbTableRow => ({
  nlbIndex: w.nlbIndex ?? 0,
  nlbIpList: w.nlbIpList ?? [],
  occupiedListenerCount: w.occupiedListenerCount ?? 0,
});

// ---------------------------------------------------------------------------
// Client functions (GET variants accept an AbortSignal — DR3)
// ---------------------------------------------------------------------------

// Internal Next proxy base (app routing). The route handler forwards to
// `bff.idc.*`, which targets the swagger-verbatim upstream path
// (`/target-sources/{id}/idc/...` in lib/bff/http.ts) — so this internal
// segment order is a free, app-local choice and matches the existing route dir.
const idcTargetBase = (targetSourceId: number) => `/idc/target-sources/${targetSourceId}`;

/** GET …/idc/previous-request — the submitted integration request. Also the
 *  read source for the read-only steps (the contract exposes no live-list GET). */
export const getIdcPreviousRequest = async (
  targetSourceId: number,
  opts?: { signal?: AbortSignal },
): Promise<IdcResourceView[]> => {
  const res = await fetchInfraJson<IdcPreviousRequestResponseWire>(
    `${idcTargetBase(targetSourceId)}/previous-request`,
    { signal: opts?.signal },
  );
  return (res.resources ?? []).map((r, i) => toIdcResourceView(r, i));
};

// The post-submission integration reads (Step 2–7) call the STANDARD swagger
// endpoints (the same ones cloud uses) via the shared client funcs, then adapt
// the response to IdcResourceView so the IDC tables keep their existing design.
// These funcs are thin adapters; the row data is seeded into project.resources
// (lib/mock-data.ts) so the shared confirmed/approved/approval mocks return it.
//
// NOTE (source IP): the shared approved/confirmed normalizers currently drop the
// idc_* fields (idc_source_ips/idc_host_format/...), so `sourceIps` is empty for
// Step 3–7 until that passthrough is added at the shared layer.

/** Step 2 (승인 대기) + Step 3 (반영중) both source the approved integration, which
 *  carries the requested set: `resource_infos` (targets) + `excluded_resource_infos`
 *  (비대상 rows with their reasons, shown in the `excl` column). Mirrors the cloud
 *  WaitingApprovalCard, whose rows come from getApprovedIntegration (approval-latest
 *  carries only the summary). */
const getIdcApprovedView = async (
  targetSourceId: number,
  opts?: { signal?: AbortSignal },
): Promise<IdcResourceView[]> => {
  const res = await getApprovedIntegration(targetSourceId, opts);
  const approved = res.approved_integration;
  if (!approved) return [];
  const targets = approved.resource_infos.map((r, i) => toIdcResourceViewFromSnapshot(r, i));
  const excluded = approved.excluded_resource_infos.map((r, i) =>
    toIdcResourceViewFromExcluded(r, i),
  );
  return [...targets, ...excluded];
};

/** Step 2 source — the requested list (targets + excluded), via approved-integration. */
export const getIdcApprovalRequestResources = getIdcApprovedView;

/** Step 3 source — the approved list (targets + excluded), via approved-integration. */
export const getIdcApprovedResources = getIdcApprovedView;

/** confirmed-integration (Step 4–7 source) — shared ConfirmedIntegration rows → IdcResourceView. */
export const getIdcConfirmedResources = async (
  targetSourceId: number,
  opts?: { signal?: AbortSignal },
): Promise<IdcResourceView[]> => {
  const res = await getConfirmedIntegration(targetSourceId, opts);
  return (res.resource_infos ?? []).map((r, i) => toIdcResourceViewFromConfirmed(r, i));
};

/** GET …/idc/installation-status — Step 4 install progress (per-resource steps). */
export const getIdcInstallationStatus = async (
  targetSourceId: number,
  opts?: { signal?: AbortSignal },
): Promise<IdcInstallationView> => {
  const res = await fetchInfraJson<IdcInstallationStatusResponseWire>(
    `${idcTargetBase(targetSourceId)}/installation-status`,
    { signal: opts?.signal },
  );
  return toIdcInstallationView(res);
};

/** GET /idc/nlb/{nlbIndex}/resources — occupied resources for an NLB index.
 *  Client added per contract; no UI consumer in the Step1–7 flow yet. */
export const getOccupiedResources = async (
  nlbIndex: number,
  opts?: { signal?: AbortSignal },
): Promise<NlbOccupiedResource[]> => {
  const res = await fetchInfraJson<NlbOccupiedResourceResponseWire[]>(
    `/idc/nlb/${nlbIndex}/resources`,
    { signal: opts?.signal },
  );
  return res.map(toNlbOccupiedResource);
};

/** GET /idc/nlb/table — NLB capacity table. Client added per contract; no UI
 *  consumer in the Step1–7 flow yet. */
export const getNlbTable = async (opts?: { signal?: AbortSignal }): Promise<NlbTableRow[]> => {
  const res = await fetchInfraJson<NlbTableResponseWire[]>(`/idc/nlb/table`, {
    signal: opts?.signal,
  });
  return res.map(toNlbTableRow);
};
