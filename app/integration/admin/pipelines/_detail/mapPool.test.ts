import { describe, expect, it } from 'vitest';
import { mapPool } from '@/app/integration/admin/pipelines/_detail/mapPool';

describe('mapPool', () => {
  it('processes every item in order with the default shouldContinue', async () => {
    const started: number[] = [];
    const results = await mapPool([1, 2, 3, 4, 5], 2, async (n) => {
      started.push(n);
      return n * 10;
    });
    expect(started).toEqual([1, 2, 3, 4, 5]);
    expect(results).toEqual([10, 20, 30, 40, 50]);
  });

  it('caps concurrency at the limit', async () => {
    let inFlight = 0;
    let peak = 0;
    await mapPool([1, 2, 3, 4, 5, 6], 3, async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await Promise.resolve();
      inFlight--;
    });
    expect(peak).toBeLessThanOrEqual(3);
  });

  it('stops launching new items once shouldContinue flips false (sequential)', async () => {
    const started: number[] = [];
    let cont = true;
    const results = await mapPool(
      [1, 2, 3, 4, 5],
      1,
      async (n) => {
        started.push(n);
        if (n === 2) cont = false; // flip mid-run
        return n * 10;
      },
      () => cont,
    );
    // Items 3–5 must never START; in-flight item 2 finished normally.
    expect(started).toEqual([1, 2]);
    // Unstarted slots are holes — compacting drops them.
    expect(results.filter((r) => r !== undefined)).toEqual([10, 20]);
  });

  it('lets in-flight items finish but starts no new ones (concurrent)', async () => {
    const started: number[] = [];
    let cont = true;
    const gates: Array<(value: number) => void> = [];
    const pool = mapPool(
      [1, 2, 3, 4],
      2,
      (n) => {
        started.push(n);
        return new Promise<number>((resolve) => gates.push(resolve));
      },
      () => cont,
    );
    // Both workers have launched their first items synchronously.
    expect(started).toEqual([1, 2]);
    cont = false; // abort while both are in flight
    gates.forEach((resolve, i) => resolve((i + 1) * 10));
    const results = await pool;
    expect(started).toEqual([1, 2]); // 3 and 4 never started
    expect(results.filter((r) => r !== undefined)).toEqual([10, 20]);
  });

  it('starts nothing when shouldContinue is already false', async () => {
    const started: number[] = [];
    const results = await mapPool([1, 2, 3], 2, async (n) => {
      started.push(n);
      return n;
    }, () => false);
    expect(started).toEqual([]);
    expect(results.filter((r) => r !== undefined)).toEqual([]);
  });
});
