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
 * A COMPLETE success: the count map is what makes the result readable. SUCCESS
 * without it is the aggregation tail, which the hook reports as still running.
 */
const successJob = (id?: number): ScanJob => ({
  scan_status: 'SUCCESS',
  target_source_id: 1,
  resource_count_by_resource_type: { AWS_RDS: 3 },
  ...(id === undefined ? {} : { id }),
});

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

  // Completion is detected by job identity, not by a SCANNING→terminal edge: a fast
  // scan can complete between polls so the edge is never seen. A pre-existing terminal
  // job on mount is adopted (no fire); a NEW terminal id fires even without an edge.
  it('fires onScanComplete on a new terminal job id, but not for a pre-existing one', async () => {
    const onScanComplete = vi.fn();
    vi.mocked(getLatestScanJob)
      .mockResolvedValueOnce(successJob(1))
      .mockResolvedValue(successJob(2));

    const { result } = renderHook(() => useScanPolling(1, { interval: 1000, onScanComplete }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0); // mount poll: SUCCESS id=1 → adopt, no fire
    });
    expect(onScanComplete).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.refresh(); // a new scan finished: SUCCESS id=2, never saw SCANNING
    });
    expect(onScanComplete).toHaveBeenCalledTimes(1);
  });

  // `id` is optional on ScanJobResponse (partial contract) — when a terminal job
  // has no id, fall back to the SCANNING→terminal edge so completion still fires.
  it('fires onScanComplete via the edge fallback when the terminal job has no id', async () => {
    const onScanComplete = vi.fn();
    vi.mocked(getLatestScanJob)
      .mockResolvedValueOnce(scanningJob) // no id
      .mockResolvedValue(successJob()); // no id

    renderHook(() => useScanPolling(1, { interval: 1000, onScanComplete }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0); // SCANNING observed
    });
    expect(onScanComplete).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000); // SUCCESS without id → edge fallback
    });
    expect(onScanComplete).toHaveBeenCalledTimes(1);
  });

  // expectCompletion() covers the remaining no-id gap: a client-started scan that is
  // already terminal (and id-less) on the very next read, with SCANNING never seen.
  it('fires onScanComplete for a fast id-less scan after expectCompletion()', async () => {
    const onScanComplete = vi.fn();
    vi.mocked(getLatestScanJob)
      .mockResolvedValueOnce(successJob()) // mount: old terminal, no id
      .mockResolvedValue(successJob()); // post-start read, still no id

    const { result } = renderHook(() => useScanPolling(1, { interval: 1000, onScanComplete }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0); // mount observation — no fire
    });
    expect(onScanComplete).not.toHaveBeenCalled();

    act(() => result.current.expectCompletion()); // user started a scan
    await act(async () => {
      await result.current.refresh(); // terminal again, no id, no SCANNING seen → fires
    });
    expect(onScanComplete).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.refresh(); // no longer armed → no duplicate fire
    });
    expect(onScanComplete).toHaveBeenCalledTimes(1);
  });

  // onScanComplete resets Step-1 selection and refetches — a scan that concluded
  // WITHOUT results (FAIL/TIMEOUT/CANCELED) must not wipe the user's work.
  it('does not fire onScanComplete for a new failed terminal job', async () => {
    const onScanComplete = vi.fn();
    vi.mocked(getLatestScanJob)
      .mockResolvedValueOnce(scanningJob)
      .mockResolvedValue({ scan_status: 'FAIL', id: 2, target_source_id: 1 });

    renderHook(() => useScanPolling(1, { interval: 1000, onScanComplete }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0); // SCANNING observed
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000); // new FAIL id — concluded, but no results
    });
    expect(onScanComplete).not.toHaveBeenCalled();
  });

  // An armed completion must survive an initial fetch error: the first successful
  // read after expectCompletion() is a real completion, not a mount adoption.
  it('fires an armed completion even when the very first fetch failed', async () => {
    const onScanComplete = vi.fn();
    vi.mocked(getLatestScanJob)
      .mockRejectedValueOnce(new Error('endpoint down'))
      .mockResolvedValue(successJob(5));

    const { result } = renderHook(() => useScanPolling(1, { interval: 1000, onScanComplete }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0); // first read errors — nothing observed yet
    });

    act(() => result.current.expectCompletion()); // user started a scan
    await act(async () => {
      await result.current.refresh(); // first OBSERVED job: terminal SUCCESS id=5
    });
    expect(onScanComplete).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.refresh(); // same id, no longer armed → no duplicate
    });
    expect(onScanComplete).toHaveBeenCalledTimes(1);
  });

  // An arm pinned to the started job's id must not be satisfied by a stale read
  // of an OLDER job — even when that older job was never observed before (initial
  // fetch error), its SUCCESS must neither fire nor consume the arm.
  it('ignores a stale older-job SUCCESS while armed for a specific job id', async () => {
    const onScanComplete = vi.fn();
    vi.mocked(getLatestScanJob)
      .mockRejectedValueOnce(new Error('endpoint down')) // old job never adopted
      .mockResolvedValueOnce(successJob(3)) // stale pre-start read
      .mockResolvedValue(successJob(7)); // the started scan

    const { result } = renderHook(() => useScanPolling(1, { interval: 1000, onScanComplete }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0); // first read errors
    });

    act(() => result.current.expectCompletion(7)); // startScan returned job id 7
    await act(async () => {
      await result.current.refresh(); // stale old job 3 → no fire, arm survives
    });
    expect(onScanComplete).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.refresh(); // job 7 SUCCESS → fires
    });
    expect(onScanComplete).toHaveBeenCalledTimes(1);
  });

  // Job ids are monotonic: a DELAYED stale response for an older job arriving
  // AFTER the newer job already completed must not re-fire (and re-wipe Step-1).
  it('ignores a delayed older-job SUCCESS arriving after the newer job completed', async () => {
    const onScanComplete = vi.fn();
    vi.mocked(getLatestScanJob)
      .mockResolvedValueOnce(scanningJob)
      .mockResolvedValueOnce(successJob(7))
      .mockResolvedValue(successJob(3)); // delayed stale

    const { result } = renderHook(() => useScanPolling(1, { interval: 1000, onScanComplete }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0); // SCANNING
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000); // SUCCESS id=7 → fires
    });
    expect(onScanComplete).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.refresh(); // delayed SUCCESS id=3 → older than 7, no re-fire
    });
    expect(onScanComplete).toHaveBeenCalledTimes(1);
  });

  // SUCCESS with no count map is the aggregation tail: the scan ran but its
  // numbers are not readable, so reporting it as COMPLETED would tell the user
  // "no resources found" and refetch Step 1 against results that do not exist.
  it('keeps a SUCCESS without counts in progress until the count map lands', async () => {
    const onScanComplete = vi.fn();
    vi.mocked(getLatestScanJob)
      .mockResolvedValueOnce(scanningJob)
      .mockResolvedValueOnce({ scan_status: 'SUCCESS', id: 9, target_source_id: 1, resource_count_by_resource_type: null })
      .mockResolvedValue(successJob(9));

    const { result } = renderHook(() => useScanPolling(1, { interval: 1000, onScanComplete }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0); // SCANNING
    });
    expect(result.current.uiState).toBe('IN_PROGRESS');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000); // SUCCESS, counts null → still finalizing
    });
    expect(result.current.uiState).toBe('IN_PROGRESS');
    expect(result.current.isPolling).toBe(true);
    expect(onScanComplete).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000); // counts land → really done
    });
    expect(result.current.uiState).toBe('COMPLETED');
    expect(result.current.isPolling).toBe(false);
    expect(onScanComplete).toHaveBeenCalledTimes(1);
  });

  // The id-less completion fallback watches a running→terminal edge. A job that
  // passes through the finalizing tail shows no SCANNING→terminal edge, so the
  // edge must be tracked as "was running", not as the raw SCANNING status.
  it('fires the id-less completion after a finalizing tail', async () => {
    const onScanComplete = vi.fn();
    vi.mocked(getLatestScanJob)
      .mockResolvedValueOnce(scanningJob) // no id
      .mockResolvedValueOnce({ scan_status: 'SUCCESS', target_source_id: 1 }) // no id, no counts
      .mockResolvedValue(successJob()); // no id, counts landed

    renderHook(() => useScanPolling(1, { interval: 1000, onScanComplete }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0); // SCANNING observed
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000); // finalizing — not a completion
    });
    expect(onScanComplete).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000); // counts land → edge fallback fires
    });
    expect(onScanComplete).toHaveBeenCalledTimes(1);
  });

  // A first poll that settles as an error must still end the initial load, or the
  // Run Infra Scan button (gated on `loading`) freezes disabled forever. (LIN-39)
  it('clears loading when the first poll fails', async () => {
    vi.mocked(getLatestScanJob).mockRejectedValue(new Error('endpoint down'));

    const { result } = renderHook(() => useScanPolling(1, { interval: 1000 }));
    expect(result.current.loading).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0); // first poll settles as an error
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error?.message).toBe('endpoint down');
  });
});
