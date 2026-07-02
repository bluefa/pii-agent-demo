// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { z } from 'zod';
import type { schemas } from '@/lib/generated/install-v1';
import { useScanPolling } from '@/app/hooks/useScanPolling';
import { getLatestScanJob } from '@/app/lib/api/scan';

vi.mock('@/app/lib/api/scan', () => ({ getLatestScanJob: vi.fn() }));

type ScanJob = z.infer<typeof schemas.ScanJobResponse>;
const scanningJob: ScanJob = { scan_status: 'SCANNING', target_source_id: 1 };

/**
 * The auto-restart effect (stale SCANNING job + not polling → start()) must
 * not revive a session that usePollingBase stopped after consecutive fetch
 * errors — otherwise the error stop is defeated in a stop/restart loop.
 */
describe('useScanPolling', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('does not auto-restart polling after an error-stopped session', async () => {
    vi.mocked(getLatestScanJob)
      .mockResolvedValueOnce(scanningJob)
      .mockRejectedValue(new Error('endpoint down'));

    const { result } = renderHook(() => useScanPolling(1, { interval: 1000 }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0); // SCANNING → keeps polling
    });
    expect(result.current.isPolling).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000); // error #1
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000); // error #2
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000); // error #3 → session stops
    });
    expect(result.current.isPolling).toBe(false);
    expect(result.current.error?.message).toBe('endpoint down');

    const callsAtStop = vi.mocked(getLatestScanJob).mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(vi.mocked(getLatestScanJob).mock.calls.length).toBe(callsAtStop);
    expect(result.current.isPolling).toBe(false);
  });
});
