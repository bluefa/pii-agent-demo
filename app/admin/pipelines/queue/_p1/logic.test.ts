import { describe, expect, it } from 'vitest';
import { DELAY_THRESHOLDS, delayCounts, filterByDelay } from '@/app/admin/pipelines/queue/_p1/logic';

const row = (delaySeconds: number | null) => ({ delaySeconds });

// A representative page: one under 1h, one ≥1h, one ≥1d, one ≥7d, one null.
const rows = [row(600), row(5430), row(99120), row(604800), row(null)];

describe('delayCounts', () => {
  it('counts each tier cumulatively over the fetched page', () => {
    expect(delayCounts(rows)).toEqual({ all: 5, d1: 3, d2: 2, d3: 1 });
  });

  it('treats a null delay as 0 — it counts only toward 전체', () => {
    expect(delayCounts([row(null), row(null)])).toEqual({ all: 2, d1: 0, d2: 0, d3: 0 });
  });

  it('counts a row exactly at a threshold', () => {
    expect(delayCounts([row(DELAY_THRESHOLDS.d1), row(DELAY_THRESHOLDS.d3)])).toEqual({
      all: 2,
      d1: 2,
      d2: 1,
      d3: 1,
    });
  });
});

describe('filterByDelay', () => {
  it('returns every row for the "전체" filter (threshold 0)', () => {
    expect(filterByDelay(rows, 'all')).toHaveLength(5);
  });

  it('keeps only rows meeting the tier threshold', () => {
    expect(filterByDelay(rows, 'd1').map((r) => r.delaySeconds)).toEqual([5430, 99120, 604800]);
    expect(filterByDelay(rows, 'd2').map((r) => r.delaySeconds)).toEqual([99120, 604800]);
    expect(filterByDelay(rows, 'd3').map((r) => r.delaySeconds)).toEqual([604800]);
  });

  it('does not mutate the input array', () => {
    const input = [row(10), row(3600)];
    filterByDelay(input, 'd1');
    expect(input).toHaveLength(2);
  });
});
