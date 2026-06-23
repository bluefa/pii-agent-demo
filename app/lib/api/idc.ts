/**
 * IDC Provider — client API + the single wire↔domain boundary.
 *
 * UI/hooks consume ONLY the domain models below (`IdcResourceView`,
 * `IdcInstallationView`). Wire shape (`lib/bff/types/idc.ts`) never leaks past
 * this file. A response-shape change touches the mappers here and the wire types
 * — nothing in the UI (`design/idc-implementation-plan.md` §5).
 *
 * Casing (ADR-019 D6 IDC carve-out): all four IDC GETs use `fetchInfraJson`
 * (raw, no boundary camelCaseKeys) and this mapper owns the conversion — it IS
 * the documented sanctioned raw passthrough. Two shapes coexist on the wire:
 *   - previous-request / installation-status are raw **snake** passthrough;
 *   - the NLB endpoints (`/idc/nlb/...`) are raw **camel** passthrough (the
 *     swagger authors those schemas camelCase on the wire), so their mappers are
 *     a near-identity copy and never run camelCaseKeys (a second transform would
 *     violate the "mapper owns it" rule).
 */

import { fetchInfraJson } from '@/app/lib/api/infra';
import { idcDbTypeByLabel, idcDbTypeByWire } from '@/lib/constants/idc';
import type { InstallTaskStatus } from '@/lib/constants/install-task';
import type {
  IdcDatabaseTypeWire,
  IdcInstallationStatusResponseWire,
  IdcInstallStatusWire,
  IdcPreviousRequestResponseWire,
  IdcResourceInputWire,
  IdcStepStatusWire,
  NlbOccupiedResourceResponseWire,
  NlbTableResponseWire,
} from '@/lib/bff/types/idc';

// ---------------------------------------------------------------------------
// Domain models (UI contract — stable across wire changes)
// ---------------------------------------------------------------------------

/** Wire enums re-exported so CSR components import them here, not from @/lib/bff/* (boundaries.md). */
export type { IdcDatabaseTypeWire } from '@/lib/bff/types/idc';

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

/** Shared 5-value install enum (kept verbatim from swagger). UNKNOWN is a real
 *  domain state, never collapsed at the domain layer — the →"작업중" collapse is
 *  UI-only (`idcInstallStatusLabel`) so the data stays faithful. */
export type IdcInstallStatus = IdcInstallStatusWire;

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
