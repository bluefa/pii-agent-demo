import type { TestConnectionLatestResultSummary } from '@/app/lib/api';

/**
 * Real per-resource logical-DB counts (연동 대상 / 연동 제외), keyed by resource_id.
 *
 * Source: `getLatestTestConnectionResultSummaries` (test-connection latest-results,
 * snake wire). The response is one row per resource+agent, so counts are summed
 * across a resource's agent rows. A resource with no summary row is absent from
 * the map — callers render `—` for it rather than a fabricated value.
 */
export interface LogicalDbCounts {
  /** `null` when no agent row for the resource carried the field — the cell renders —, not 0. */
  target: number | null;
  excluded: number | null;
}

export type LogicalDbCountMap = ReadonlyMap<string, LogicalDbCounts>;

/**
 * The response schema is `.partial()`, so a row can arrive with the count absent. Absent is not
 * zero: folding it in as 0 reports "no logical DBs" for a resource the API never answered for.
 * Each field stays null until at least one row carries a number.
 */
const addCount = (prev: number | null, next: number | null | undefined): number | null =>
  next == null ? prev : (prev ?? 0) + next;

export const buildLogicalDbCountMap = (
  summaries: readonly TestConnectionLatestResultSummary[],
): LogicalDbCountMap => {
  const map = new Map<string, LogicalDbCounts>();
  for (const summary of summaries) {
    const resourceId = summary.resource_id;
    if (!resourceId) continue;
    const prev = map.get(resourceId) ?? { target: null, excluded: null };
    map.set(resourceId, {
      target: addCount(prev.target, summary.logical_database_count),
      excluded: addCount(prev.excluded, summary.excluded_logical_database_count),
    });
  }
  return map;
};
