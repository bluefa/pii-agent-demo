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
  evaluatedAt: string | null;
}

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
