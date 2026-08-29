import { beforeEach, describe, expect, it } from 'vitest';
import { mockScan } from '@/lib/bff/mock/scan';
import { resetStore } from '@/lib/mock-store';

/** A step-1 seed target outside the set — its scan is current, like every other target. */
const CURRENT_SCAN_TARGET_SOURCE_ID = 1006;

const STALE_SCAN_TARGET_SOURCE_IDS = [1430, 1005, 1980];

const oldScanOf = async (targetSourceId: number): Promise<unknown> => {
  const response = await mockScan.getStatus(String(targetSourceId));
  const body = (await response.json()) as { old_scan?: unknown };
  return body.old_scan;
};

/**
 * The stale state is only reachable in demo mode if some target answers with it, and
 * only useful if every other target keeps answering with a scan the step-1 screen still
 * trusts — one flipped fixture too many and the whole step-1 walkthrough goes stale.
 */
describe('mockScan.getStatus — seeded stale scans', () => {
  beforeEach(() => {
    resetStore();
  });

  it.each(STALE_SCAN_TARGET_SOURCE_IDS)('target %i reports its seed scan as stale', async (id) => {
    expect(await oldScanOf(id)).toBe(true);
  });

  it('a seed target outside the set reports a scan within its policy age', async () => {
    expect(await oldScanOf(CURRENT_SCAN_TARGET_SOURCE_ID)).toBe(false);
  });
});
