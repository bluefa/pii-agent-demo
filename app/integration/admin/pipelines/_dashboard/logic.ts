/**
 * Dashboard list pure logic (LIN-25 Phase C1-a).
 *
 * The upstream `GET /pipelines` (#3) supports only status/provider/period
 * filtering + property sort — so the design's TargetSourceId substring search,
 * the "실패 → 진행 중 → 최신순" priority ordering, and the 5/page pagination are
 * all applied CLIENT-side over the fetched window (size=200). These functions
 * hold that client pipeline; the page component wires them to state.
 *
 * Verbatim from design/pipeline/admin-pipeline.html renderList()/renderStats().
 */
import type { PipelineStatus, PipelineSummary, StatisticsPeriodToken } from '@/lib/pipeline/types';

/** Design PAGE_SIZE — 5 rows per client page. */
export const DASH_PAGE_SIZE = 5;

/** The upstream fetch window (size=200); rows beyond it are not shown (§3 gap #6). */
export const DASH_FETCH_SIZE = 200;

/** Period token → the human window label (PERIOD_LABEL, prototype line 532). */
export const PERIOD_LABELS: Record<StatisticsPeriodToken, string> = {
  '1h': '최근 1시간',
  '1d': '최근 24시간',
  '7d': '최근 7일',
};

/** Segmented control options (default 1d). */
export const PERIOD_OPTIONS: ReadonlyArray<{ value: StatisticsPeriodToken; label: string }> = [
  { value: '1h', label: '1시간' },
  { value: '1d', label: '1일' },
  { value: '7d', label: '7일' },
];

/** Status filter options — '' = 전체; values are wire PipelineStatus. */
export const STATUS_OPTIONS: ReadonlyArray<{ value: '' | PipelineStatus; label: string }> = [
  { value: '', label: '상태 전체' },
  { value: 'PENDING', label: 'PENDING' },
  { value: 'RUNNING', label: 'RUNNING' },
  { value: 'DONE', label: 'DONE' },
  { value: 'FAILED', label: 'FAILED' },
  { value: 'CANCELLED', label: 'CANCELLED' },
];

/**
 * CSP filter options — '' = 전체; values are the WIRE CloudProvider (UPPERCASE),
 * which is what the list endpoint's `provider` param expects. The prototype's
 * lowercase option values were an in-memory-fixture artifact.
 */
export const PROVIDER_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: '', label: 'CSP 전체' },
  { value: 'AWS', label: 'AWS' },
  { value: 'AZURE', label: 'Azure' },
  { value: 'GCP', label: 'GCP' },
  { value: 'IDC', label: 'IDC' },
];

/** Priority rank: FAILED(0) → RUNNING(1) → PENDING(2) → everything else(3). */
const PRIORITY_RANK: Record<string, number> = { FAILED: 0, RUNNING: 1, PENDING: 2 };

export function priorityRank(status: PipelineStatus): number {
  return PRIORITY_RANK[status] ?? 3;
}

/**
 * Priority sort: FAILED → RUNNING → PENDING → rest, ties broken by pipeline_id
 * descending (newest first). Pure — returns a new array (never mutates input).
 */
export function sortByPriority(rows: readonly PipelineSummary[]): PipelineSummary[] {
  return [...rows].sort(
    (a, b) => priorityRank(a.status) - priorityRank(b.status) || b.pipeline_id - a.pipeline_id,
  );
}

/** Client substring filter on target_source_id (trimmed; empty → passthrough). */
export function filterByTarget(rows: readonly PipelineSummary[], q: string): PipelineSummary[] {
  const term = q.trim();
  if (!term) return [...rows];
  return rows.filter((p) => String(p.target_source_id).includes(term));
}

/** Full client projection: substring filter → priority sort. */
export function projectRows(rows: readonly PipelineSummary[], q: string): PipelineSummary[] {
  return sortByPriority(filterByTarget(rows, q));
}

export interface PageSlice<T> {
  total: number;
  pages: number;
  /** Page number after clamping into [1, pages]. */
  current: number;
  slice: T[];
}

/** Clamp `page` into range and slice the rows for that page (5/page). */
export function paginate<T>(rows: readonly T[], page: number, size = DASH_PAGE_SIZE): PageSlice<T> {
  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / size));
  const current = Math.min(Math.max(1, page), pages);
  const start = (current - 1) * size;
  return { total, pages, current, slice: rows.slice(start, start + size) };
}

/** 현황 section description (prototype line 762). */
export function buildStatsDesc(period: StatisticsPeriodToken): string {
  return `${PERIOD_LABELS[period]}(생성시간 기준) 실패·성공 집계 — 기간 필터와 동기화 · 동작 중은 현재 순간값`;
}

