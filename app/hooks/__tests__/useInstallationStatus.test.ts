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
