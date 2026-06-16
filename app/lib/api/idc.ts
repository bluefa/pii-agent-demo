/**
 * IDC Provider — client API + the single wire↔domain boundary.
 *
 * UI/hooks consume ONLY the domain models below (`IdcResourceView`,
 * `IdcInstallationView`). Wire shape (snake_case, `lib/bff/types/idc.ts`) never
 * leaks past this file. A response-shape change touches `toIdcResourceView` /
 * `toIdcInstallationView` here and the wire types — nothing in the UI
 * (`design/idc-implementation-plan.md` §5).
 *
 * IDC responses are raw snake passthrough (no camelCase at the BFF layer), so
 * `fetchInfraJson` (not the camel variant) is used and this mapper owns the
 * conversion.
 */

import { fetchInfraJson } from '@/app/lib/api/infra';
import {
  idcDbTypeByLabel,
  idcDbTypeLabel,
} from '@/lib/constants/idc';
import type {
  IdcConfirmFirewallResponse,
  IdcDatabaseTypeWire,
  IdcInstallationStatus,
  IdcResourceInput,
  IdcResourcesResponse,
  IdcSourceIpRecommendation,
  IdcTfStatus,
} from '@/lib/bff/types/idc';

// ---------------------------------------------------------------------------
// Domain models (UI contract — stable across wire changes)
// ---------------------------------------------------------------------------

/** Wire enums re-exported so CSR components import them here, not from @/lib/bff/* (boundaries.md). */
export type { IdcDatabaseTypeWire, IdcTfStatus } from '@/lib/bff/types/idc';

export type IdcKind = 'SINGLE' | 'MULTIPLE_IP' | 'DOMAIN';
export type IdcConnState = 'PENDING' | 'SUCCESS';
export type IdcHealth = 'HEALTHY' | 'UNHEALTHY';

export interface IdcResourceView {
  /** React key + DR scoping. Server id when persisted, else a UI temp id. */
  resourceId: string;
  /** True when backed by a server `resource_id` (controls PUT serialization). */
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

export interface IdcResourceInstallView {
  resourceId: string;
  sourceIps: string[];
  firewallOpen: boolean;
}

export interface IdcInstallationView {
  bdcTf: IdcTfStatus;
  firewallOpened: boolean;
  resources: IdcResourceInstallView[];
  lastCheckedAt?: string;
}

export interface IdcFirewallConfirmation {
  confirmed: boolean;
  confirmedAt: string;
}

// ---------------------------------------------------------------------------
// Mappers (the ONLY wire↔domain conversion site)
// ---------------------------------------------------------------------------

const deriveKind = (wire: IdcResourceInput): IdcKind => {
  if (wire.input_format === 'HOST') return 'DOMAIN';
  return (wire.ips?.length ?? 0) > 1 ? 'MULTIPLE_IP' : 'SINGLE';
};

export const toIdcResourceView = (wire: IdcResourceInput): IdcResourceView => ({
  resourceId: wire.resource_id ?? '',
  persisted: wire.resource_id !== undefined,
  kind: deriveKind(wire),
  hosts: wire.input_format === 'IP' ? (wire.ips ?? []) : wire.host ? [wire.host] : [],
  port: wire.port,
  databaseTypeLabel: idcDbTypeLabel(wire.database_type),
  databaseTypeWire: wire.database_type,
  oracleSid: wire.service_id,
  credentialId: wire.credential_id,
  sourceIps: wire.source_ips ?? [],
  firewallOpen: wire.firewall_open ?? false,
  connection: wire.connection_status ?? 'PENDING',
  health: wire.health ?? 'HEALTHY',
  done: wire.done ?? '—',
  excluded: wire.exclusion_reason !== undefined && wire.exclusion_reason !== '',
  exclusionReason: wire.exclusion_reason,
});

export const toIdcResourceInput = (view: IdcResourceView): IdcResourceInput => ({
  resource_id: view.persisted ? view.resourceId : undefined,
  name: view.hosts[0] ?? '',
  input_format: view.kind === 'DOMAIN' ? 'HOST' : 'IP',
  ips: view.kind === 'DOMAIN' ? undefined : view.hosts,
  host: view.kind === 'DOMAIN' ? view.hosts[0] : undefined,
  port: view.port,
  database_type: view.databaseTypeWire,
  service_id: view.oracleSid,
  credential_id: view.credentialId,
  exclusion_reason: view.excluded ? view.exclusionReason : undefined,
});

/** Convert a display DB-type label (e.g. "MySQL") to its wire enum. */
export const idcDbTypeWireFromLabel = (label: string): IdcDatabaseTypeWire | undefined =>
  idcDbTypeByLabel(label)?.wire;

const toIdcInstallationView = (wire: IdcInstallationStatus): IdcInstallationView => ({
  bdcTf: wire.bdc_tf,
  firewallOpened: wire.firewall_opened,
  resources: (wire.resources ?? []).map((r) => ({
    resourceId: r.resource_id,
    sourceIps: r.source_ips,
    firewallOpen: r.firewall_open,
  })),
  lastCheckedAt: wire.last_checked_at,
});

// ---------------------------------------------------------------------------
// Client functions (GET variants accept an AbortSignal — DR3)
// ---------------------------------------------------------------------------

const idcBase = (targetSourceId: number) => `/idc/target-sources/${targetSourceId}`;

export const getIdcResources = async (
  targetSourceId: number,
  opts?: { signal?: AbortSignal },
): Promise<IdcResourceView[]> => {
  const res = await fetchInfraJson<IdcResourcesResponse>(`${idcBase(targetSourceId)}/resources`, {
    signal: opts?.signal,
  });
  return res.resources.map(toIdcResourceView);
};

export const getIdcPreviousRequest = async (
  targetSourceId: number,
  opts?: { signal?: AbortSignal },
): Promise<IdcResourceView[]> => {
  const res = await fetchInfraJson<IdcResourcesResponse>(
    `${idcBase(targetSourceId)}/previous-request`,
    { signal: opts?.signal },
  );
  return res.resources.map(toIdcResourceView);
};

export const updateIdcResources = async (
  targetSourceId: number,
  views: IdcResourceView[],
): Promise<IdcResourceView[]> => {
  const res = await fetchInfraJson<IdcResourcesResponse>(`${idcBase(targetSourceId)}/resources`, {
    method: 'PUT',
    body: { resources: views.map(toIdcResourceInput) },
  });
  return res.resources.map(toIdcResourceView);
};

export const getIdcInstallationStatus = async (
  targetSourceId: number,
  opts?: { signal?: AbortSignal },
): Promise<IdcInstallationView> => {
  const res = await fetchInfraJson<IdcInstallationStatus>(
    `${idcBase(targetSourceId)}/installation-status`,
    { signal: opts?.signal },
  );
  return toIdcInstallationView(res);
};

export const checkIdcInstallation = async (
  targetSourceId: number,
): Promise<IdcInstallationView> => {
  const res = await fetchInfraJson<IdcInstallationStatus>(
    `${idcBase(targetSourceId)}/check-installation`,
    { method: 'POST', body: {} },
  );
  return toIdcInstallationView(res);
};

export const confirmIdcFirewall = async (
  targetSourceId: number,
): Promise<IdcFirewallConfirmation> => {
  const res = await fetchInfraJson<IdcConfirmFirewallResponse>(
    `${idcBase(targetSourceId)}/confirm-firewall`,
    { method: 'POST', body: {} },
  );
  return { confirmed: res.confirmed, confirmedAt: res.confirmed_at };
};

export const getIdcSourceIpRecommendation = async (
  ipType: 'public' | 'private' | 'vpc',
  opts?: { signal?: AbortSignal },
): Promise<{ sourceIps: string[]; port: number; description: string }> => {
  const res = await fetchInfraJson<IdcSourceIpRecommendation>(
    `/idc/source-ip-recommendation?ipType=${ipType}`,
    { signal: opts?.signal },
  );
  return { sourceIps: res.source_ips, port: res.port, description: res.description };
};
