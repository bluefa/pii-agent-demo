// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePollingBase } from '@/app/hooks/usePollingBase';

/**
 * Error-path guarantees of the polling base:
 * - a hard-failing endpoint stops the session after 3 consecutive errors
 *   instead of polling forever (the last error stays exposed),
 * - a success in between resets the counter (transient blips survive),
 * - a refresh() resolving after unmount commits nothing.
 */
describe('usePollingBase', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('stops polling after 3 consecutive fetch errors and keeps the last error', async () => {
    const fetchOnce = vi.fn().mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() =>
      usePollingBase<number>({ interval: 1000, fetchOnce, shouldStop: () => false }),
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0); // initial tick → error #1
    });
    expect(result.current.isPolling).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000); // error #2
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000); // error #3 → stop
    });

    expect(result.current.isPolling).toBe(false);
    expect(result.current.error?.message).toBe('boom');

    const callsAtStop = fetchOnce.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(fetchOnce.mock.calls.length).toBe(callsAtStop);
  });

  it('a success in between resets the consecutive-error counter', async () => {
    const fetchOnce = vi
      .fn()
      .mockRejectedValueOnce(new Error('e1'))
      .mockRejectedValueOnce(new Error('e2'))
      .mockResolvedValueOnce(1)
      .mockRejectedValue(new Error('e3'));
    const { result } = renderHook(() =>
      usePollingBase<number>({ interval: 1000, fetchOnce, shouldStop: () => false }),
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0); // e1
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000); // e2
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000); // success → counter reset
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000); // e3 = consecutive error #1
    });

    expect(result.current.isPolling).toBe(true);
  });

  it('refresh() resolving after unmount does not fire onUpdate', async () => {
    let resolveFetch: (value: number) => void = () => {};
    const fetchOnce = vi.fn(
      () =>
        new Promise<number>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    const onUpdate = vi.fn();
    const { result, unmount } = renderHook(() =>
      usePollingBase<number>({
        interval: 1000,
        fetchOnce,
        shouldStop: () => true,
        onUpdate,
        enabled: false,
      }),
    );

    let refreshPromise: Promise<void> | undefined;
    act(() => {
      refreshPromise = result.current.refresh();
    });
    unmount();
    resolveFetch(42);
    await act(async () => {
      await refreshPromise;
    });

    expect(onUpdate).not.toHaveBeenCalled();
  });
});
