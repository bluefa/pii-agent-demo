// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useInstallationStatus } from '@/app/hooks/useInstallationStatus';

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
});
