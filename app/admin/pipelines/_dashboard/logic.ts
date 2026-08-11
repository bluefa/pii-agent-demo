/**
 * Dashboard list pure logic (LIN-25 Phase C1-a).
 *
 * The upstream `GET /pipelines` (#3) supports only status/provider/type/period
 * filtering + property sort — so the search-box substring search and the
 * pagination are applied CLIENT-side over the fetched window (size=200).
 * Row ORDER always follows the API response verbatim — no client re-sort.
 * These functions hold that client pipeline; the page component wires them
 * to state.
 *
 * Verbatim from design/pipeline/admin-pipeline.html renderList()/renderStats().
 */
import type {
  PipelineStatistics,
  PipelineStatus,
  PipelineSummary,
  PipelineType,
  StatisticsPeriodToken,
} from '@/lib/pipeline/types';

/**
 * Rows per client page. 5 left roughly 400px of the list card empty at
 * 1600×1100 while turning a 200-row window into 40 pages; 12 fills the card
 * that the 5-row table only reached a third of the way down.
 */
export const DASH_PAGE_SIZE = 12;

/** The upstream fetch window (size=200); rows beyond it are not shown (§3 gap #6). */
export const DASH_FETCH_SIZE = 200;

/** Period token → the human window label (PERIOD_LABEL, prototype line 532). */
export const PERIOD_LABELS: Record<StatisticsPeriodToken, string> = {
  '1h': '최근 1시간',
  '1d': '최근 24시간',
  '7d': '최근 7일',
};

/** Segmented control options (default 7d) — Figma Make labels (24시간, not 1일). */
export const PERIOD_OPTIONS: ReadonlyArray<{ value: StatisticsPeriodToken; label: string }> = [
  { value: '1h', label: '1시간' },
  { value: '1d', label: '24시간' },
  { value: '7d', label: '7일' },
];

/**
 * The summary buckets. These are what the top tiles count AND what clicking one
 * filters to — the same four names, so a number and the list under it can never
 * disagree about what they mean.
 *
 * `attention` deliberately holds FAILED only. A stalled PENDING/RUNNING belongs
 * here too, but "stalled" is a threshold nobody has set yet, and a bucket that
 * guesses is worse than one that under-reports. See
 * docs/ux/benchmark/pipelines-dashboard.md §4.
 */
export type DashBucket = 'attention' | 'active' | 'closed' | 'all';

/**
 * Bucket → the statuses it holds. The three named buckets PARTITION
 * PipelineStatus: every one of the five lands in exactly one, which is what lets
 * 확인 필요 + 진행 중 + 종료 add up to 전체. Adding a status without placing it
 * here would silently break that sum.
 */
export const BUCKET_STATUSES: Record<Exclude<DashBucket, 'all'>, readonly PipelineStatus[]> = {
  attention: ['FAILED'],
  active: ['PENDING', 'RUNNING'],
  closed: ['DONE', 'CANCELLED'],
};

/** Rows in one bucket; 'all' passes through. */
export function filterByBucket(
  rows: readonly PipelineSummary[],
  bucket: DashBucket,
): PipelineSummary[] {
  if (bucket === 'all') return [...rows];
  const wanted = BUCKET_STATUSES[bucket];
  return rows.filter((p) => wanted.includes(p.status));
}

/**
 * Bucket counts for the period. These come from the statistics endpoint, not
 * from the fetched rows: the list stops at DASH_FETCH_SIZE, and a tile that
 * counted only what fit would under-report the very backlog it exists to show.
 * When the two disagree the pager is the place that says why.
 */
export function bucketCounts(stats: PipelineStatistics | null): Record<DashBucket, number | null> {
  if (!stats) return { attention: null, active: null, closed: null, all: null };
  return {
    attention: stats.failed_count,
    active: stats.pending_count + stats.running_count,
    closed: stats.done_count + stats.cancelled_count,
    all: stats.total_count,
  };
}

/*
 * Filter-menu options. Each list is the CHOICES only — the "전체" entry is drawn
 * by the menu itself (`FilterMenu` renders it above every group), so carrying a
 * '' row here would put two of them in the popover. The old {value,label} pairs
 * existed to fill a native <select>; the labels were identical to the values
 * except for Azure, which now comes from the shared `providerLabel`.
 */

/** Wire PipelineStatus, in run order rather than alphabetical. */
export const STATUS_FILTERS: ReadonlyArray<PipelineStatus> = [
  'PENDING',
  'RUNNING',
  'DONE',
  'FAILED',
  'CANCELLED',
];

/**
 * WIRE CloudProvider (UPPERCASE), which is what the list endpoint's `provider`
 * param expects. The prototype's lowercase values were an in-memory-fixture
 * artifact.
 */
export const PROVIDER_FILTERS: ReadonlyArray<string> = ['AWS', 'AZURE', 'GCP', 'IDC'];

/** Wire PipelineType. */
export const TYPE_FILTERS: ReadonlyArray<PipelineType> = ['INSTALL', 'DELETE', 'CUSTOM'];

/**
 * Client substring search across service_code / target_source_id / service_name
 * (case-insensitive; matches if ANY field contains the term). Trimmed; empty →
 * passthrough. Preserves the input order (the API response order) verbatim.
 */
export function filterBySearch(rows: readonly PipelineSummary[], q: string): PipelineSummary[] {
  const term = q.trim().toLowerCase();
  if (!term) return [...rows];
  return rows.filter(
    (p) =>
      String(p.target_source_id).toLowerCase().includes(term)
      || p.service_code.toLowerCase().includes(term)
      || p.service_name.toLowerCase().includes(term),
  );
}

/**
 * Full client projection: bucket, then substring search — order always follows
 * the API response.
 */
export function projectRows(
  rows: readonly PipelineSummary[],
  q: string,
  bucket: DashBucket = 'all',
): PipelineSummary[] {
  return filterBySearch(filterByBucket(rows, bucket), q);
}

export interface PageSlice<T> {
  total: number;
  pages: number;
  /** Page number after clamping into [1, pages]. */
  current: number;
  slice: T[];
}

/** Clamp `page` into range and slice the rows for that page (DASH_PAGE_SIZE/page). */
export function paginate<T>(rows: readonly T[], page: number, size = DASH_PAGE_SIZE): PageSlice<T> {
  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / size));
  const current = Math.min(Math.max(1, page), pages);
  const start = (current - 1) * size;
  return { total, pages, current, slice: rows.slice(start, start + size) };
}

/** 현황 section description (prototype line 762). */
export function buildStatsDesc(period: StatisticsPeriodToken): string {
  return `${PERIOD_LABELS[period]}(생성시간 기준) 실패·성공 집계입니다. 기간 필터와 동기화되며, 동작 중은 현재 순간값입니다.`;
}

