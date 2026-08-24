// @vitest-environment jsdom
import { createElement, useEffect } from 'react';
import { act, render, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useInstallationStatus } from '@/app/hooks/useInstallationStatus';

interface Frame {
  id: number;
  status: string | null;
  loading: boolean;
  error: string | null;
}

/**
 * Stale-response guard: the fetch effect refires on targetSourceId change
 * without cancelling the in-flight request, so a slow response (or error)
 * for the previous id must never overwrite the current one.
 */
describe('useInstallationStatus', () => {
  afterEach(() => vi.clearAllMocks());

  const makeDeferredFetcher = <T,>() => {
    const handles = new Map<number, { resolve: (v: T) => void; reject: (e: unknown) => void }>();
    const fetcher = vi.fn(
      (id: number) =>
        new Promise<T>((resolve, reject) => {
          handles.set(id, { resolve, reject });
        }),
    );
    return { fetcher, handles };
  };

  it('ignores a late response from a previous targetSourceId', async () => {
    const { fetcher, handles } = makeDeferredFetcher<string>();

    const { result, rerender } = renderHook(
      ({ id }) => useInstallationStatus<string>({ targetSourceId: id, getFn: fetcher }),
      { initialProps: { id: 1 } },
    );
    rerender({ id: 2 });

    await act(async () => {
      handles.get(2)?.resolve('status-2');
    });
    await act(async () => {
      handles.get(1)?.resolve('status-1'); // late response for the old id
    });

    expect(result.current.status).toBe('status-2');
    expect(result.current.loading).toBe(false);
  });

  it('ignores a late error from a superseded request', async () => {
    const { fetcher, handles } = makeDeferredFetcher<string>();

    const { result, rerender } = renderHook(
      ({ id }) => useInstallationStatus<string>({ targetSourceId: id, getFn: fetcher }),
      { initialProps: { id: 1 } },
    );
    rerender({ id: 2 });

    await act(async () => {
      handles.get(2)?.resolve('status-2');
    });
    await act(async () => {
      handles.get(1)?.reject(new Error('old fetch failed'));
    });

    expect(result.current.status).toBe('status-2');
    expect(result.current.error).toBeNull();
  });

  it('does not report onComplete for a stale response', async () => {
    const { fetcher, handles } = makeDeferredFetcher<string>();
    const onComplete = vi.fn();

    const { rerender } = renderHook(
      ({ id }) =>
        useInstallationStatus<string>({
          targetSourceId: id,
          getFn: fetcher,
          isComplete: (s) => s === 'stale-complete',
          onComplete,
        }),
      { initialProps: { id: 1 } },
    );
    rerender({ id: 2 });

    await act(async () => {
      handles.get(2)?.resolve('in-progress');
    });
    await act(async () => {
      handles.get(1)?.resolve('stale-complete');
    });

    expect(onComplete).not.toHaveBeenCalled();
  });

  /**
   * DR4 — the effect's reset lands after paint and the install cards are not
   * remounted by key, so without a render-phase reset the first COMMITTED frame
   * for a new target carries the previous target's status/error. All three
   * providers gate on `error`/`loading`, so that frame is what they paint.
   *
   * This has to observe committed frames, not `result.current`: renderHook's
   * act() flushes the effect before the assertion runs, so the hook's final
   * state looks identical either way and an assertion on it proves nothing.
   */
  const recordFrames = () => {
    const frames: Frame[] = [];
    const Probe = ({ id, getFn }: { id: number; getFn: (i: number) => Promise<string> }) => {
      const { status, loading, error } = useInstallationStatus<string>({
        targetSourceId: id,
        getFn,
      });
      // No dep array — one call per commit, so discarded render passes are not
      // recorded and every painted frame is.
      useEffect(() => {
        frames.push({ id, status, loading, error });
      });
      return null;
    };
    return { frames, Probe };
  };

  it('never commits a frame carrying the previous target state after a switch', async () => {
    const { fetcher, handles } = makeDeferredFetcher<string>();
    const { frames, Probe } = recordFrames();

    const { rerender } = render(createElement(Probe, { id: 1, getFn: fetcher }));
    await act(async () => {
      handles.get(1)?.resolve('status-1');
    });
    await act(async () => {
      handles.get(1)?.reject(new Error('never')); // no-op; handle already settled
    });

    frames.length = 0;
    await act(async () => {
      rerender(createElement(Probe, { id: 2, getFn: fetcher }));
    });

    const leaked = frames.filter((f) => f.id === 2 && f.status !== null);
    expect(leaked).toEqual([]);
    // ...and never "settled with nothing", which is the shape that renders a
    // 0-resource card rather than a skeleton.
    expect(frames.filter((f) => f.id === 2 && f.status === null && !f.loading)).toEqual([]);
  });

  it('never commits the previous target error after a switch', async () => {
    const { fetcher, handles } = makeDeferredFetcher<string>();
    const { frames, Probe } = recordFrames();

    const { rerender } = render(createElement(Probe, { id: 1, getFn: fetcher }));
    await act(async () => {
      handles.get(1)?.reject(new Error('target-1 failed'));
    });

    frames.length = 0;
    await act(async () => {
      rerender(createElement(Probe, { id: 2, getFn: fetcher }));
    });

    expect(frames.filter((f) => f.id === 2 && f.error !== null)).toEqual([]);
  });
});

/**
 * Polling — the card used to read once on mount and never again, so its
 * "마지막 확인" stamp counted up forever against a number nothing refreshed.
 */
describe('useInstallationStatus — 폴링', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  const settledAfter = (n: number) => {
    let calls = 0;
    return vi.fn(async () => {
      calls += 1;
      return calls > n ? 'DONE' : 'RUNNING';
    });
  };

  it('정착할 때까지 주기적으로 다시 읽고, 정착하면 멈춘다', async () => {
    vi.useFakeTimers();
    const getFn = settledAfter(2);
    const onComplete = vi.fn();

    renderHook(() =>
      useInstallationStatus<string>({
        targetSourceId: 1,
        getFn,
        isComplete: (s) => s === 'DONE',
        onComplete,
        pollIntervalMs: 30_000,
      }),
    );

    // mount fetch
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(getFn).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(getFn).toHaveBeenCalledTimes(2);

    // 세 번째 응답이 DONE — 이후로는 타이머가 아무리 흘러도 더 부르지 않는다.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(getFn).toHaveBeenCalledTimes(3);
    expect(onComplete).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000);
    });
    expect(getFn).toHaveBeenCalledTimes(3);
  });

  it('주기를 주지 않으면 마운트 때 한 번만 읽는다', async () => {
    vi.useFakeTimers();
    const getFn = vi.fn(async () => 'RUNNING');

    renderHook(() =>
      useInstallationStatus<string>({
        targetSourceId: 1,
        getFn,
        isComplete: () => false,
      }),
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000);
    });
    expect(getFn).toHaveBeenCalledTimes(1);
  });

  it('폴 한 번이 실패해도 마지막 스냅샷을 지우지 않는다', async () => {
    vi.useFakeTimers();
    let calls = 0;
    const getFn = vi.fn(async () => {
      calls += 1;
      if (calls === 2) throw new Error('502');
      return 'RUNNING';
    });

    const { result } = renderHook(() =>
      useInstallationStatus<string>({
        targetSourceId: 1,
        getFn,
        isComplete: (s) => s === 'DONE',
        pollIntervalMs: 30_000,
      }),
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.status).toBe('RUNNING');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    // 실패한 폴은 화면을 에러 뷰로 바꾸지 않는다 — 확인에 실패한 것이지
    // 알고 있던 것이 틀린 것이 아니다.
    expect(result.current.error).toBeNull();
    expect(result.current.status).toBe('RUNNING');
  });
});
