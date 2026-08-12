import { describe, expect, it } from 'vitest';
import { filterByDelay, pageRange } from '@/app/admin/pipelines/queue/_p1/logic';

const row = (delaySeconds: number | null) => ({ delaySeconds });

// A representative set: one under 1h, one ≥1h, one ≥1d, one ≥7d, one null.
const rows = [row(600), row(5430), row(99120), row(604800), row(null)];

describe('filterByDelay', () => {
  it('returns every row for the "전체" filter (threshold 0)', () => {
    expect(filterByDelay(rows, 'all')).toHaveLength(5);
  });

  it('keeps only rows meeting the tier threshold', () => {
    expect(filterByDelay(rows, 'd1').map((r) => r.delaySeconds)).toEqual([5430, 99120, 604800]);
    expect(filterByDelay(rows, 'd2').map((r) => r.delaySeconds)).toEqual([99120, 604800]);
    expect(filterByDelay(rows, 'd3').map((r) => r.delaySeconds)).toEqual([604800]);
  });

  it('treats a null delay as 0 — excluded from every tier', () => {
    expect(filterByDelay([row(null)], 'd1')).toHaveLength(0);
  });

  it('does not mutate the input array', () => {
    const input = [row(10), row(3600)];
    filterByDelay(input, 'd1');
    expect(input).toHaveLength(2);
  });
});

describe('pageRange', () => {
  it('starts the first page at 1 — the input is 0-based', () => {
    expect(pageRange(0, 20, 23)).toEqual([1, 20]);
  });

  it('advances by exactly one page', () => {
    expect(pageRange(1, 20, 45)).toEqual([21, 40]);
    expect(pageRange(2, 20, 45)).toEqual([41, 45]);
  });

  it('clamps the last page to the total, never past it', () => {
    expect(pageRange(1, 20, 23)).toEqual([21, 23]);
  });

  it('never returns a reversed range on the last page', () => {
    const [first, last] = pageRange(1, 20, 23);
    expect(first).toBeLessThanOrEqual(last);
  });
});
