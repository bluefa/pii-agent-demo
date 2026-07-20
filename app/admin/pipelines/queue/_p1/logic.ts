/**
 * P1 운영 대시보드 — pure client-side logic for the 지연 (delay) filter.
 *
 * Contract gap G1 (api-spec): the delay-tier filter (1시간↑/1일↑/7일↑) has NO
 * server query param, so it is applied CLIENT-side over the currently fetched page
 * of process-status rows. `delaySeconds` itself is server-computed — this module
 * only compares and counts it, never recomputes elapsed time. A null delay is
 * treated as 0 (counts toward "지연 전체" only).
 */
import type { ProcessStatusRow } from '@/lib/types/task-queue';

/** 지연 filter thresholds in seconds (0 = 전체 · no threshold). */
export const DELAY_THRESHOLDS = {
  all: 0,
  d1: 3600, // 1시간
  d2: 86400, // 1일
  d3: 604800, // 7일
} as const;

export type DelayFilter = keyof typeof DELAY_THRESHOLDS;

export interface DelayCounts {
  all: number;
  d1: number;
  d2: number;
  d3: number;
}

/** A null/absent delay reads as 0 (below every escalation threshold). */
function delayOf(row: Pick<ProcessStatusRow, 'delaySeconds'>): number {
  return row.delaySeconds ?? 0;
}

/** Rows whose delay meets the selected filter's threshold. */
export function filterByDelay<T extends Pick<ProcessStatusRow, 'delaySeconds'>>(
  rows: readonly T[],
  filter: DelayFilter,
): T[] {
  const threshold = DELAY_THRESHOLDS[filter];
  if (threshold === 0) return [...rows];
  return rows.filter((row) => delayOf(row) >= threshold);
}

/** Per-tier counts over the fetched page (each tier is cumulative: ≥1d ⊂ ≥1h). */
export function delayCounts(rows: readonly Pick<ProcessStatusRow, 'delaySeconds'>[]): DelayCounts {
  const counts: DelayCounts = { all: rows.length, d1: 0, d2: 0, d3: 0 };
  for (const row of rows) {
    const delay = delayOf(row);
    if (delay >= DELAY_THRESHOLDS.d1) counts.d1 += 1;
    if (delay >= DELAY_THRESHOLDS.d2) counts.d2 += 1;
    if (delay >= DELAY_THRESHOLDS.d3) counts.d3 += 1;
  }
  return counts;
}
