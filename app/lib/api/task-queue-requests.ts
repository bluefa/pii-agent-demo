/**
 * Admin Task Queue — 연동 요청 (P2 list / P3 detail) client adapter.
 *
 * Boundary split (ADR-019, per `design/pipeline/admin-taskqueue-api-spec.md`):
 *  - P2 list + P3 header read `/admin/queue/target-sources`, whose ROUTE already
 *    reshapes the TargetSourceInfo camel-island + latest_approval_request snake
 *    into the camel `Paged<RequestListRow>` domain (lib/types/task-queue.ts). So
 *    those funcs just fetch the validated domain shape.
 *  - P3 resources read `/target-sources/{id}/approval-requests/latest`, a REUSED
 *    wire-passthrough route (returns the raw `ApprovalRequestLatestDto` snake
 *    wire). THIS adapter owns that wire→domain boundary — same pattern as
 *    app/lib/api/idc.ts / logical-db.ts.
 *  - NLB capacity reuses `@/app/lib/api/idc` (`getNlbTable`, camel wire) so both
 *    the Step-1 flow and this admin surface read one occupancy source.
 *
 * resource_id is carried through as an INTERNAL field only: it keys the per-row
 * NLB PUT, and it is the visible identity for non-IDC (AWS) rows — but it is
 * NEVER rendered in the IDC table (design-spec §8).
 */
import type { z } from 'zod';
import type { schemas } from '@/lib/generated/install-v1';
import { fetchInfra, fetchInfraJson } from '@/app/lib/api/infra';
import type { ApprovalHistoryRow, Paged, RequestListRow } from '@/lib/types/task-queue';

// Re-export the NLB capacity read from the IDC adapter — one occupancy source.
export { getNlbTable } from '@/app/lib/api/idc';
export type { NlbTableRow } from '@/app/lib/api/idc';

// ── Domain models (UI contract — stable across wire changes) ─────────────────

/** The latest approval request's summary (P3 header meta). */
export interface ApprovalRequestSummary {
  requestId: number | null;
  status: string | null;
  requestedBy: string | null;
  requestedAt: string | null;
  resourceTotalCount: number | null;
  resourceSelectedCount: number | null;
}

export type IdcHostKind = 'IP' | 'HOST';

/** One resource of an approval request (P3 연동 대상 리소스 table row). */
export interface RequestResourceRow {
  /** Internal only — NLB PUT key + non-IDC (AWS) 표시용 Resource ID. NEVER
   *  rendered in the IDC table. */
  resourceId: string | null;
  /** Human-readable resource name — non-IDC (AWS) table column. */
  resourceName: string | null;
  selected: boolean;
  exclusionReason: string | null;
  /**
   * `integration_category` — separates the scan's INSTALL_INELIGIBLE verdict from a
   * user's exclusion. Dropping it makes a system verdict render as a revisable 제외.
   */
  integrationCategory: string | null;
  /** `recommend_fail_reason` — why the scan judged it ineligible; absent for AWS/IDC. */
  recommendFailReason: string | null;
  databaseType: string | null;
  region: string | null;
  // IDC-only (present when the target source is IDC).
  idcKind: IdcHostKind | null;
  /** ips (IP mode) or [host] (HOST mode) — the "연동 대상" cell. */
  connectTargets: string[];
  port: number | null;
  oracleSid: string | null;
  sourceIps: string[];
  /** Assigned NLB index (metadata.nlb_index) — the select's current value. */
  nlbIndex: number | null;
}

export interface ApprovalRequestDetail {
  request: ApprovalRequestSummary;
  resources: RequestResourceRow[];
}

// ── Wire aliases + mappers (the ONLY wire↔domain conversion site) ────────────

type ApprovalRequestLatestWire = z.infer<typeof schemas.ApprovalRequestLatestDto>;
type ResourceItemWire = z.infer<typeof schemas.TargetSourceResourceItemDto>;

const strArray = (value: ReadonlyArray<string | null> | null | undefined): string[] =>
  (value ?? []).filter((v): v is string => v != null && v !== '');

/** metadata.idc_host_format ("IP"/"HOST") → the 구분 tag; null for non-IDC rows. */
const toIdcKind = (format: string | null | undefined): IdcHostKind | null =>
  format === 'IP' ? 'IP' : format === 'HOST' ? 'HOST' : null;

/** ips (IP mode) or [host] (HOST mode) — the "연동 대상" cell content. */
const toConnectTargets = (kind: IdcHostKind | null, meta: {
  idc_ips?: ReadonlyArray<string | null> | null;
  idc_host?: string | null;
}): string[] => {
  if (kind === 'IP') return strArray(meta.idc_ips);
  if (kind === 'HOST') return meta.idc_host ? [meta.idc_host] : [];
  return [];
};

export function toRequestResourceRow(wire: ResourceItemWire): RequestResourceRow {
  const meta = wire.metadata ?? {};
  const kind = toIdcKind(meta.idc_host_format);
  return {
    resourceId: wire.resource_id ?? null,
    resourceName: wire.resource_name ?? null,
    // The contract's `selected` is the source of truth (defaults to true when
    // absent — an item on the request without an exclusion reason is a target).
    selected: wire.selected ?? wire.exclusion_reason == null,
    exclusionReason: wire.exclusion_reason ?? null,
    integrationCategory: wire.integration_category ?? null,
    recommendFailReason: wire.recommend_fail_reason ?? null,
    databaseType: meta.database_type ?? null,
    region: meta.region ?? null,
    idcKind: kind,
    connectTargets: toConnectTargets(kind, meta),
    port: meta.port ?? null,
    oracleSid: meta.oracle_service_id ?? null,
    sourceIps: strArray(meta.idc_source_ips),
    nlbIndex: meta.nlb_index ?? null,
  };
}

function toApprovalRequestDetail(wire: ApprovalRequestLatestWire): ApprovalRequestDetail {
  const req = wire.request ?? {};
  return {
    request: {
      requestId: req.id ?? null,
      status: req.status ?? null,
      requestedBy: req.requested_by?.user_id ?? null,
      requestedAt: req.requested_at ?? null,
      resourceTotalCount: req.resource_total_count ?? null,
      resourceSelectedCount: req.resource_selected_count ?? null,
    },
    resources: (wire.resources ?? []).map(toRequestResourceRow),
  };
}

// ── Client funcs ─────────────────────────────────────────────────────────────

/** P2 tab → contract confirmStatus (전체 omits the param). */
export type RequestTab = 'PENDING' | 'REJECTED' | 'ALL';
const confirmStatusFor = (tab: RequestTab): string | undefined =>
  tab === 'ALL' ? undefined : tab;

const REQUEST_PAGE_SIZE = 10;

/** GET /admin/queue/target-sources — the approval queue (route returns camel domain). */
export async function getRequestList(
  tab: RequestTab,
  page: number,
  opts?: { signal?: AbortSignal; size?: number },
): Promise<Paged<RequestListRow>> {
  const params = new URLSearchParams({
    page: String(page),
    size: String(opts?.size ?? REQUEST_PAGE_SIZE),
  });
  const confirmStatus = confirmStatusFor(tab);
  if (confirmStatus) params.set('confirmStatus', confirmStatus);
  return fetchInfraJson<Paged<RequestListRow>>(`/admin/queue/target-sources?${params}`, {
    signal: opts?.signal,
  });
}

/** GET /admin/queue/target-sources?targetSourceId= — single-row header lookup (P3). */
export async function getRequestHeader(
  targetSourceId: number,
  opts?: { signal?: AbortSignal },
): Promise<RequestListRow | null> {
  const params = new URLSearchParams({
    targetSourceId: String(targetSourceId),
    page: '0',
    size: '1',
  });
  const paged = await fetchInfraJson<Paged<RequestListRow>>(
    `/admin/queue/target-sources?${params}`,
    { signal: opts?.signal },
  );
  return paged.content[0] ?? null;
}

/** GET …/approval-requests/latest — the request summary + its resources (P3). */
export async function getApprovalRequestLatest(
  targetSourceId: number,
  opts?: { signal?: AbortSignal },
): Promise<ApprovalRequestDetail> {
  const wire = await fetchInfraJson<ApprovalRequestLatestWire>(
    `/target-sources/${targetSourceId}/approval-requests/latest`,
    { signal: opts?.signal },
  );
  return toApprovalRequestDetail(wire);
}

/** PUT …/approval-requests/nlb-indices — override one resource's NLB index
 *  (api-spec G5: per-row save = one { resource_id, nlb_index } call). */
export async function putNlbIndex(
  targetSourceId: number,
  resourceId: string,
  nlbIndex: number,
): Promise<void> {
  const res = await fetchInfra(`/target-sources/${targetSourceId}/approval-requests/nlb-indices`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resource_id: resourceId, nlb_index: nlbIndex }),
  });
  if (!res.ok) throw new Error(`NLB 배정 저장에 실패했어요 (${res.status})`);
}

/** GET /admin/queue/approval-history — global history (route returns camel
 *  domain; item fields are the documented contract gap in lib/types/task-queue).
 *  `toStatuses` omitted = 전체. */
export async function getApprovalHistory(
  page: number,
  opts?: { signal?: AbortSignal; size?: number; toStatuses?: string[] },
): Promise<Paged<ApprovalHistoryRow>> {
  const params = new URLSearchParams({
    page: String(page),
    size: String(opts?.size ?? REQUEST_PAGE_SIZE),
  });
  if (opts?.toStatuses?.length) params.set('toStatuses', opts.toStatuses.join(','));
  return fetchInfraJson<Paged<ApprovalHistoryRow>>(`/admin/queue/approval-history?${params}`, {
    signal: opts?.signal,
  });
}

// ── NLB index mappings (P3 IDC "NLB 정보" modal) ─────────────────────────────
// OFF-CONTRACT wire (user-provided, 2026-07-21) — this adapter owns the
// wire→camel boundary, same as the other reused passthrough routes.

export interface NlbIndexMapping {
  serviceCode: string | null;
  nlbIndex: number | null;
}

export interface ResourceNlbMappings {
  resourceId: string;
  mappings: NlbIndexMapping[];
}

interface NlbIndexMappingItemWire {
  resource_id?: string | null;
  nlb_index_mapping_list?:
    | { service_code?: string | null; nlb_index?: number | null }[]
    | null;
}

/** GET …/approval-requests/latest/nlb-index-mappings — per-resource current
 *  NLB listener assignments (one entry per consuming service). */
export async function getNlbIndexMappings(
  targetSourceId: number,
  opts?: { signal?: AbortSignal },
): Promise<ResourceNlbMappings[]> {
  const wire = await fetchInfraJson<NlbIndexMappingItemWire[]>(
    `/target-sources/${targetSourceId}/approval-requests/latest/nlb-index-mappings`,
    { signal: opts?.signal },
  );
  return (wire ?? [])
    .filter((item): item is NlbIndexMappingItemWire & { resource_id: string } =>
      item.resource_id != null && item.resource_id !== '')
    .map((item) => ({
      resourceId: item.resource_id,
      mappings: (item.nlb_index_mapping_list ?? []).map((m) => ({
        serviceCode: m.service_code ?? null,
        nlbIndex: m.nlb_index ?? null,
      })),
    }));
}

/** POST …/approval-requests/approve — comment optional (UI 1,024자). */
export async function approveRequest(targetSourceId: number, comment: string): Promise<void> {
  const res = await fetchInfra(`/target-sources/${targetSourceId}/approval-requests/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ comment }),
  });
  if (!res.ok) throw new Error(`승인 처리에 실패했어요 (${res.status})`);
}

/** POST …/approval-requests/reject — reason required (contract max 1,000자). */
export async function rejectRequest(targetSourceId: number, reason: string): Promise<void> {
  const res = await fetchInfra(`/target-sources/${targetSourceId}/approval-requests/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) throw new Error(`반려 처리에 실패했어요 (${res.status})`);
}
