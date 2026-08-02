/**
 * CSR client for the Admin Task Queue routes (`/admin/queue/**`).
 *
 * Owned by the P1 운영 대시보드 page agent. The three sibling pages keep their own
 * adapter files (`task-queue-requests.ts` / `task-queue-tc.ts`) so page work never
 * collides here. Add P2–P5 helpers to THOSE files, not this one.
 *
 * Casing boundary lives in the route (ADR-019, `lib/types/task-queue.ts`): the
 * route validates the snake/mixed wire with `schemas.X.parse` then reshapes to the
 * camel domain types imported below. This CSR layer only forwards query params and
 * returns the camel domain verbatim — no reshaping here. CSR MUST NOT import
 * `@/lib/bff/*` (route boundary).
 *
 * ── P1 운영 대시보드 ──────────────────────────────────────────────────────────
 */
import { fetchInfraJson } from '@/app/lib/api/infra';
import type {
  AlertTargetKind,
  DashboardSummary,
  DelayFilter,
  Paged,
  ProcessStatusRow,
  RequestListRow,
} from '@/lib/types/task-queue';

/** GET /admin/queue/dashboard-summary — the 4 operator KPI counts (camel domain). */
export const getDashboardSummary = (options?: { signal?: AbortSignal }): Promise<DashboardSummary> =>
  fetchInfraJson<DashboardSummary>(
    '/admin/queue/dashboard-summary',
    options?.signal ? { signal: options.signal } : undefined,
  );

export interface ProcessStatusesParams {
  /** Server-side process-status filter (STEP key) — omit for "전체". */
  processStatus?: string;
  /** Server-side single target-source filter (unused by P1; kept for parity). */
  targetSourceId?: number;
  /** Delay-tier filter (d1/d2/d3) — applied by OUR route over aggregated
   *  upstream pages (api-spec gap G1). Omit or 'all' for 전체. */
  delay?: DelayFilter;
  /** 0-indexed page (contract). */
  page?: number;
  /** Page size (contract default 20, max 100). */
  size?: number;
}

/**
 * GET /admin/queue/process-statuses — the Process Status monitor page.
 * Every filter drives an API call: `processStatus`/`targetSourceId` pass through
 * to the upstream, `delay` (1h/1d/7d) is applied by our route (api-spec gap G1).
 * `delay_seconds` is server-computed — never recompute it on the client.
 */
export const getProcessStatuses = (
  params: ProcessStatusesParams = {},
  options?: { signal?: AbortSignal },
): Promise<Paged<ProcessStatusRow>> => {
  const search = new URLSearchParams();
  if (params.processStatus) search.set('processStatus', params.processStatus);
  if (params.targetSourceId != null) search.set('targetSourceId', String(params.targetSourceId));
  if (params.delay && params.delay !== 'all') search.set('delay', params.delay);
  if (params.page != null) search.set('page', String(params.page));
  if (params.size != null) search.set('size', String(params.size));
  const qs = search.toString();
  return fetchInfraJson<Paged<ProcessStatusRow>>(
    qs ? `/admin/queue/process-statuses?${qs}` : '/admin/queue/process-statuses',
    options?.signal ? { signal: options.signal } : undefined,
  );
};

/** GET /admin/queue/alert-target-sources — 운영 알림 drill-down for one kind. */
export const getAlertTargetSources = (
  kind: AlertTargetKind,
  page = 0,
  size = 10,
  options?: { signal?: AbortSignal },
): Promise<Paged<RequestListRow>> =>
  fetchInfraJson<Paged<RequestListRow>>(
    `/admin/queue/alert-target-sources?kind=${kind}&page=${page}&size=${size}`,
    options?.signal ? { signal: options.signal } : undefined,
  );
