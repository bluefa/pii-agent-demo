/**
 * Approval — wire→domain normalizers (ADR-019 D2/D6).
 *
 * The single casing boundary lives in the approval route handlers: each
 * GET/POST does `normalizeX(camelCaseKeys(raw))`. These functions take the
 * already-camelCased payload as `unknown` and build a strictly-typed camel
 * domain object field-by-field — the "loud" alternative to a silent `as T`
 * (no zod dependency in this repo; mirrors `lib/test-connection-response.ts`).
 *
 * Wire DTOs are snake_case on the swagger (install-v1.yaml §Approval Requests);
 * `camelCaseKeys` at the boundary flips them to the camel domain fields below.
 * Enum values pass through verbatim; unknown values degrade to a contract
 * default rather than throwing, so a stray BFF value never 500s the UI.
 */

// ===== Domain types (camelCase) =====

// swagger ApprovalStatus — 7 values (install-v1.yaml). No `CONFIRMED`.
export type ApprovalRequestStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'AUTO_APPROVED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'UNAVAILABLE'
  | 'UNAVAILABLE_ACKNOWLEDGED';

// swagger ApprovalUnavailableConfirmResponseDto.confirm_status — distinct 7-value lifecycle.
export type ApprovalConfirmStatus =
  | 'IDLE'
  | 'PENDING'
  | 'UNAVAILABLE'
  | 'CONFIRMING'
  | 'RESOURCE_CLEANING'
  | 'RESOURCE_CLEAN_FAILED'
  | 'CONFIRMED';

export interface ApprovalActor {
  userId: string;
}

export interface ApprovalRequestSummary {
  id: number;
  targetSourceId: number;
  status: ApprovalRequestStatus;
  requestedBy: ApprovalActor | null;
  requestedAt: string;
  resourceTotalCount: number;
  resourceSelectedCount: number;
}

export interface ApprovalActionResponse {
  requestId: number;
  status: ApprovalRequestStatus;
  processedBy: ApprovalActor | null;
  processedAt: string;
  reason: string;
}

// swagger ApprovalRequestLatestDto.resources[] (TargetSourceResourceItemDto) is a
// large, mostly-optional shape; the waiting table is sourced from
// getApprovedIntegration (see D-approval §3.5), so we surface resources as
// opaque records rather than re-typing the 50-field item here.
export type ApprovalResourceItem = Record<string, unknown>;

export interface ApprovalRequestLatest {
  request: ApprovalRequestSummary | null;
  resources: ApprovalResourceItem[];
  result: ApprovalActionResponse | null;
}

// swagger Page.content[] is `type: object` (untyped). Shape agreed with BFF:
// each item is { request, result? }. Documented as out-of-swagger.
export interface ApprovalHistoryContentItem {
  request: ApprovalRequestSummary;
  result: ApprovalActionResponse | null;
}

export interface ApprovalHistoryPage {
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
  content: ApprovalHistoryContentItem[];
}

export interface ApprovalUnavailableResponse {
  requestId: number;
  status: ApprovalRequestStatus;
  processedBy: ApprovalActor | null;
  processedAt: string;
  reason: string;
}

export interface ApprovalUnavailableConfirmResponse {
  targetSourceId: number;
  confirmStatus: ApprovalConfirmStatus;
  processedAt: string;
  confirmedBy: string;
}

// ===== Helpers =====

type JsonRecord = Record<string, unknown>;

const asRecord = (value: unknown): JsonRecord =>
  typeof value === 'object' && value !== null ? (value as JsonRecord) : {};

const asString = (value: unknown): string => (typeof value === 'string' ? value : '');

const asNumber = (value: unknown): number => (typeof value === 'number' ? value : 0);

const REQUEST_STATUSES: readonly ApprovalRequestStatus[] = [
  'PENDING',
  'APPROVED',
  'AUTO_APPROVED',
  'REJECTED',
  'CANCELLED',
  'UNAVAILABLE',
  'UNAVAILABLE_ACKNOWLEDGED',
];

const asRequestStatus = (value: unknown): ApprovalRequestStatus =>
  REQUEST_STATUSES.includes(value as ApprovalRequestStatus)
    ? (value as ApprovalRequestStatus)
    : 'PENDING';

const CONFIRM_STATUSES: readonly ApprovalConfirmStatus[] = [
  'IDLE',
  'PENDING',
  'UNAVAILABLE',
  'CONFIRMING',
  'RESOURCE_CLEANING',
  'RESOURCE_CLEAN_FAILED',
  'CONFIRMED',
];

const asConfirmStatus = (value: unknown): ApprovalConfirmStatus =>
  CONFIRM_STATUSES.includes(value as ApprovalConfirmStatus)
    ? (value as ApprovalConfirmStatus)
    : 'IDLE';

const asActor = (value: unknown): ApprovalActor | null => {
  const r = asRecord(value);
  const userId = asString(r.userId);
  return userId ? { userId } : null;
};

// ===== Normalizers (input = camelCased payload) =====

export const normalizeApprovalRequestSummary = (raw: unknown): ApprovalRequestSummary => {
  const r = asRecord(raw);
  return {
    id: asNumber(r.id),
    targetSourceId: asNumber(r.targetSourceId),
    status: asRequestStatus(r.status),
    requestedBy: asActor(r.requestedBy),
    requestedAt: asString(r.requestedAt),
    resourceTotalCount: asNumber(r.resourceTotalCount),
    resourceSelectedCount: asNumber(r.resourceSelectedCount),
  };
};

export const normalizeApprovalActionResponse = (raw: unknown): ApprovalActionResponse => {
  const r = asRecord(raw);
  return {
    requestId: asNumber(r.requestId),
    status: asRequestStatus(r.status),
    processedBy: asActor(r.processedBy),
    processedAt: asString(r.processedAt),
    reason: asString(r.reason),
  };
};

export const normalizeApprovalRequestLatest = (raw: unknown): ApprovalRequestLatest => {
  const r = asRecord(raw);
  return {
    request: r.request === undefined || r.request === null
      ? null
      : normalizeApprovalRequestSummary(r.request),
    resources: Array.isArray(r.resources) ? (r.resources as ApprovalResourceItem[]) : [],
    result: r.result === undefined || r.result === null
      ? null
      : normalizeApprovalActionResponse(r.result),
  };
};

export const normalizeApprovalHistoryPage = (raw: unknown): ApprovalHistoryPage => {
  const r = asRecord(raw);
  const content = Array.isArray(r.content)
    ? r.content.map((item): ApprovalHistoryContentItem => {
        const entry = asRecord(item);
        return {
          request: normalizeApprovalRequestSummary(entry.request),
          result:
            entry.result === undefined || entry.result === null
              ? null
              : normalizeApprovalActionResponse(entry.result),
        };
      })
    : [];

  return {
    totalElements: asNumber(r.totalElements),
    totalPages: asNumber(r.totalPages),
    number: asNumber(r.number),
    size: asNumber(r.size),
    content,
  };
};

export const normalizeApprovalUnavailableResponse = (
  raw: unknown,
): ApprovalUnavailableResponse => {
  const r = asRecord(raw);
  return {
    requestId: asNumber(r.requestId),
    status: asRequestStatus(r.status),
    processedBy: asActor(r.processedBy),
    processedAt: asString(r.processedAt),
    reason: asString(r.reason),
  };
};

export const normalizeApprovalUnavailableConfirmResponse = (
  raw: unknown,
): ApprovalUnavailableConfirmResponse => {
  const r = asRecord(raw);
  return {
    targetSourceId: asNumber(r.targetSourceId),
    confirmStatus: asConfirmStatus(r.confirmStatus),
    processedAt: asString(r.processedAt),
    confirmedBy: asString(r.confirmedBy),
  };
};
