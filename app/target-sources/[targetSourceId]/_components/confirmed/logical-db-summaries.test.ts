import { describe, it, expect } from 'vitest';
import { buildLogicalDbCountMap } from '@/app/target-sources/[targetSourceId]/_components/confirmed/logical-db-summaries';
import type { TestConnectionLatestResultSummary } from '@/app/lib/api';

const summary = (over: Partial<TestConnectionLatestResultSummary>): TestConnectionLatestResultSummary =>
  ({ resource_id: 'r1', agent_id: 'a1', ...over }) as TestConnectionLatestResultSummary;

describe('buildLogicalDbCountMap', () => {
  it('sums a resource across its agent rows', () => {
    const map = buildLogicalDbCountMap([
      summary({ agent_id: 'a1', logical_database_count: 4, excluded_logical_database_count: 1 }),
      summary({ agent_id: 'a2', logical_database_count: 2, excluded_logical_database_count: 0 }),
    ]);
    expect(map.get('r1')).toEqual({ target: 6, excluded: 1 });
  });

  // The response schema is .partial() — an absent count is "not reported", not zero. Folding it
  // in as 0 would claim the resource has no logical DBs on a screen that promises an em-dash.
  it('keeps an unreported count null rather than counting it as 0', () => {
    const map = buildLogicalDbCountMap([summary({ excluded_logical_database_count: 2 })]);
    expect(map.get('r1')).toEqual({ target: null, excluded: 2 });
  });

  it('reports a real 0 as 0', () => {
    const map = buildLogicalDbCountMap([
      summary({ logical_database_count: 5, excluded_logical_database_count: 0 }),
    ]);
    expect(map.get('r1')).toEqual({ target: 5, excluded: 0 });
  });

  it('skips rows with no resource_id', () => {
    const map = buildLogicalDbCountMap([summary({ resource_id: undefined, logical_database_count: 9 })]);
    expect(map.size).toBe(0);
  });
});
