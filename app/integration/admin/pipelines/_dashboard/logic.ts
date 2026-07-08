/**
 * Dashboard list pure logic (LIN-25 Phase C1-a).
 *
 * The upstream `GET /pipelines` (#3) supports only status/provider/type/period
 * filtering + property sort — so the search-box substring search and the
 * 5/page pagination are applied CLIENT-side over the fetched window (size=200).
 * Row ORDER always follows the API response verbatim — no client re-sort.
 * These functions hold that client pipeline; the page component wires them
 * to state.
 *
 * Verbatim from design/pipeline/admin-pipeline.html renderList()/renderStats().
 */
import type {
  PipelineStatus,
  PipelineSummary,
  PipelineType,
  StatisticsPeriodToken,
} from '@/lib/pipeline/types';

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

/** Segmented control options (default 1d) — Figma Make labels (24시간, not 1일). */
export const PERIOD_OPTIONS: ReadonlyArray<{ value: StatisticsPeriodToken; label: string }> = [
  { value: '1h', label: '1시간' },
  { value: '1d', label: '24시간' },
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
  { value: '', label: 'Cloud 전체' },
  { value: 'AWS', label: 'AWS' },
  { value: 'AZURE', label: 'Azure' },
  { value: 'GCP', label: 'GCP' },
  { value: 'IDC', label: 'IDC' },
];

/** Pipeline-type filter options — '' = 전체; values are wire PipelineType. */
export const TYPE_OPTIONS: ReadonlyArray<{ value: '' | PipelineType; label: string }> = [
  { value: '', label: '유형 전체' },
  { value: 'INSTALL', label: 'INSTALL' },
  { value: 'DELETE', label: 'DELETE' },
  { value: 'CUSTOM', label: 'CUSTOM' },
];

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

/** Full client projection: substring search only — order always follows the API response. */
export function projectRows(rows: readonly PipelineSummary[], q: string): PipelineSummary[] {
  return filterBySearch(rows, q);
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

