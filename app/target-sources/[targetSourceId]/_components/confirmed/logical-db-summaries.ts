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
  target: number;
  excluded: number;
}

export type LogicalDbCountMap = ReadonlyMap<string, LogicalDbCounts>;

export const buildLogicalDbCountMap = (
  summaries: readonly TestConnectionLatestResultSummary[],
): LogicalDbCountMap => {
  const map = new Map<string, LogicalDbCounts>();
  for (const summary of summaries) {
    const resourceId = summary.resource_id;
    if (!resourceId) continue;
    const prev = map.get(resourceId) ?? { target: 0, excluded: 0 };
    map.set(resourceId, {
      target: prev.target + (summary.logical_database_count ?? 0),
      excluded: prev.excluded + (summary.excluded_logical_database_count ?? 0),
    });
  }
  return map;
};
