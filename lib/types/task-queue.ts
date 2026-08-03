/**
 * Admin Task Queue — camel domain types + wire→domain reshapers.
 *
 * Casing boundary (ADR-019, per `design/pipeline/admin-taskqueue-api-spec.md`):
 * the route owns the wire→camel boundary for THIS feature. Routes validate the
 * snake/mixed wire with `schemas.X.parse(raw)` then reshape to these camel domain
 * types; the CSR consumes only the camel domain. This differs from the raw-snake
 * passthrough used by the cloud-status domains (azure/gcp/idc), where the CSR
 * adapter owns the boundary — see the api-spec gaps G3/G4.
 *
 * The wire schemas are ADR-019 loose codegen (every field optional/nullable), so
 * the reshapers coalesce absent values to `null` / `[]`.
 */
import type { z } from 'zod';
import type { schemas } from '@/lib/generated/install-v1';

export interface Paged<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
  first: boolean;
  last: boolean;
  numberOfElements: number;
  empty: boolean;
}

export interface DashboardSummary {
  pendingApprovalCount: number;
  rejectedApprovalCount: number;
  testConnectionCompletedCount: number;
  testConnectionRejectionCount: number;
  /** 운영 알림 — Step 3/4/5/6 targets waiting on an operator action. */
  confirmingCount: number;
  needInstallCount: number;
  needTestConnectionCount: number;
  needPiiAgentConfirmCount: number;
  evaluatedAt: string | null;
}

/**
 * 운영 알림 kinds. The value IS the `/dashboard/target-sources/{kind}` path
 * segment (contract), so it must not be renamed for display purposes.
 */
export const ALERT_TARGET_KINDS = [
  'confirming',
  'need-install',
  'need-test-connection',
  'need-pii-agent-confirm',
] as const;

export type AlertTargetKind = (typeof ALERT_TARGET_KINDS)[number];

export const isAlertTargetKind = (value: string): value is AlertTargetKind =>
  (ALERT_TARGET_KINDS as readonly string[]).includes(value);

export interface ProcessStatusRow {
  targetSourceId: number | null;
  processStatus: string | null;
  statusChangedAt: string | null;
  /** Server-computed delay (api-spec: front-end MUST NOT recompute). */
  delaySeconds: number | null;
  serviceName: string | null;
  serviceCode: string | null;
  serviceAbbr: string | null;
  cloudProvider: string | null;
}

export interface RequestListRow {
  targetSourceId: number | null;
  serviceName: string | null;
  /** TargetSourceInfo.description — what this target source is, in the owner's words. */
  description: string | null;
  serviceCode: string | null;
  cloudProvider: string | null;
  confirmStatus: string | null;
  latestApprovalRequest: {
    requestId: number | null;
    status: string | null;
    reason: string | null;
    requestedAt: string | null;
    processedAt: string | null;
  } | null;
}

export interface TestConnectionStatusRow {
  targetSourceId: number | null;
  status: string | null;
  serviceName: string | null;
  serviceCode: string | null;
  cloudProvider: string | null;
  rejectReason: string | null;
  rejectedAt: string | null;
  completedAt: string | null;
}

/**
 * GET /approval-history content item — CONTRACT GAP: the swagger 200 is the
 * generic `Page` (content: object[]), so the item fields are not in the
 * contract. Real response confirmed 2026-07-22: flat camelCase rows keyed by
 * `historyRecordId` (the ONLY unique id — requestId AND targetSourceId can both
 * repeat across records), with the acting admin in `actorId`.
 */
export interface ApprovalHistoryItemWire {
  /** Unique row id — requestId/targetSourceId may repeat, this does not. */
  historyRecordId?: number | null;
  requestId?: number | null;
  targetSourceId?: number | null;
  /** Approval status enum — PENDING | APPROVED | AUTO_APPROVED | REJECTED |
   *  CANCELLED | UNAVAILABLE | UNAVAILABLE_ACKNOWLEDGED (loose: string). */
  status?: string | null;
  createdAt?: string | null;
  serviceName?: string | null;
  serviceCode?: string | null;
  /** Who approved/rejected. */
  actorId?: string | null;
  /** Target source cloud — UPPERCASE wire (AWS | AZURE | GCP | IDC). */
  cloudProvider?: string | null;
}

export interface ApprovalHistoryRow {
  /** Unique row key (targetSourceId/requestId may repeat). Not rendered. */
  historyRecordId: number | null;
  /** Carried for the detail lookup (…/{targetSourceId}/approval-requests/{requestId}); not rendered. */
  requestId: number | null;
  targetSourceId: number | null;
  status: string | null;
  createdAt: string | null;
  serviceName: string | null;
  serviceCode: string | null;
  /** 수행자 — who approved/rejected. */
  actorId: string | null;
  cloudProvider: string | null;
}

// ── 지연 (delay) filter rule — shared by the P1 UI and the process-statuses
// route (contract gap G1: the upstream has no delay query param, so OUR route
// applies this filter over aggregated upstream pages). `delaySeconds` is
// server-computed; this only compares it. A null delay reads as 0.
export const DELAY_THRESHOLDS = {
  all: 0,
  d1: 3600, // 1시간
  d2: 86400, // 1일
  d3: 604800, // 7일
} as const;

export type DelayFilter = keyof typeof DELAY_THRESHOLDS;

export function isDelayFilter(value: string): value is DelayFilter {
  return value in DELAY_THRESHOLDS;
}

/** Rows whose delay meets the selected filter's threshold. */
export function filterByDelay<T extends Pick<ProcessStatusRow, 'delaySeconds'>>(
  rows: readonly T[],
  filter: DelayFilter,
): T[] {
  const threshold = DELAY_THRESHOLDS[filter];
  if (threshold === 0) return [...rows];
  return rows.filter((row) => (row.delaySeconds ?? 0) >= threshold);
}

type WirePageMeta = {
  totalElements?: number | null;
  totalPages?: number | null;
  number?: number | null;
  size?: number | null;
  first?: boolean | null;
  last?: boolean | null;
  numberOfElements?: number | null;
  empty?: boolean | null;
};

function toPaged<W, T>(
  wire: WirePageMeta & { content?: W[] | null },
  mapRow: (row: W) => T,
): Paged<T> {
  const content = (wire.content ?? []).map(mapRow);
  return {
    content,
    totalElements: wire.totalElements ?? content.length,
    totalPages: wire.totalPages ?? 1,
    number: wire.number ?? 0,
    size: wire.size ?? content.length,
    first: wire.first ?? true,
    last: wire.last ?? true,
    numberOfElements: wire.numberOfElements ?? content.length,
    empty: wire.empty ?? content.length === 0,
  };
}

export function toDashboardSummary(
  wire: z.infer<typeof schemas.DashboardSummaryResponse>,
): DashboardSummary {
  return {
    pendingApprovalCount: wire.pending_approval_count ?? 0,
    rejectedApprovalCount: wire.rejected_approval_count ?? 0,
    testConnectionCompletedCount: wire.test_connection_completed_count ?? 0,
    testConnectionRejectionCount: wire.test_connection_rejection_count ?? 0,
    confirmingCount: wire.confirming_count ?? 0,
    needInstallCount: wire.need_install_count ?? 0,
    needTestConnectionCount: wire.need_test_connection_count ?? 0,
    needPiiAgentConfirmCount: wire.need_pii_agent_confirm_count ?? 0,
    evaluatedAt: wire.evaluated_at ?? null,
  };
}

function toProcessStatusRow(
  row: z.infer<typeof schemas.ProcessStatusCurrentResponse>,
): ProcessStatusRow {
  const info = row.target_source?.service_info;
  return {
    targetSourceId: row.target_source_id ?? null,
    processStatus: row.process_status ?? null,
    statusChangedAt: row.status_changed_at ?? null,
    delaySeconds: row.delay_seconds ?? null,
    serviceName: info?.serviceName ?? null,
    serviceCode: info?.code ?? null,
    serviceAbbr: info?.abbr ?? null,
    cloudProvider: row.target_source?.cloudProvider ?? null,
  };
}

export function toProcessStatusPage(
  wire: z.infer<typeof schemas.PageProcessStatusCurrentResponse>,
): Paged<ProcessStatusRow> {
  return toPaged(wire, toProcessStatusRow);
}

function toRequestListRow(row: z.infer<typeof schemas.TargetSourceInfo>): RequestListRow {
  const latest = row.latest_approval_request;
  return {
    targetSourceId: row.targetSourceId ?? null,
    serviceName: row.serviceName ?? null,
    description: row.description ?? null,
    serviceCode: row.serviceCode ?? null,
    cloudProvider: row.cloudProvider ?? null,
    confirmStatus: row.confirmStatus ?? null,
    latestApprovalRequest: latest
      ? {
          requestId: latest.request_id ?? null,
          status: latest.status ?? null,
          reason: latest.reason ?? null,
          requestedAt: latest.requested_at ?? null,
          processedAt: latest.processed_at ?? null,
        }
      : null,
  };
}

export function toRequestListPage(
  wire: z.infer<typeof schemas.PageTargetSourceInfo>,
): Paged<RequestListRow> {
  return toPaged(wire, toRequestListRow);
}

export function toTestConnectionStatusRow(
  row: z.infer<typeof schemas.TestConnectionRejectStatusResponse>,
): TestConnectionStatusRow {
  return {
    targetSourceId: row.target_source_id ?? null,
    status: row.status ?? null,
    serviceName: row.service_name ?? null,
    serviceCode: row.service_code ?? null,
    cloudProvider: row.cloud_provider ?? null,
    rejectReason: row.reject_reason ?? null,
    rejectedAt: row.rejected_at ?? null,
    completedAt: row.completed_at ?? null,
  };
}

export function toTestConnectionStatusPage(
  wire: z.infer<typeof schemas.PageTestConnectionRejectStatusResponse>,
): Paged<TestConnectionStatusRow> {
  return toPaged(wire, toTestConnectionStatusRow);
}

export function toApprovalHistoryRow(row: ApprovalHistoryItemWire): ApprovalHistoryRow {
  return {
    historyRecordId: row.historyRecordId ?? null,
    requestId: row.requestId ?? null,
    targetSourceId: row.targetSourceId ?? null,
    status: row.status ?? null,
    createdAt: row.createdAt ?? null,
    serviceName: row.serviceName ?? null,
    serviceCode: row.serviceCode ?? null,
    actorId: row.actorId ?? null,
    cloudProvider: row.cloudProvider ?? null,
  };
}

/** The generic `Page` schema's content is `object[]` — narrow it to the
 *  sanctioned item wire here (the gap is documented on ApprovalHistoryItemWire). */
export function toApprovalHistoryPage(
  wire: z.infer<typeof schemas.Page>,
): Paged<ApprovalHistoryRow> {
  return toPaged(wire, (row) => toApprovalHistoryRow(row as ApprovalHistoryItemWire));
}
