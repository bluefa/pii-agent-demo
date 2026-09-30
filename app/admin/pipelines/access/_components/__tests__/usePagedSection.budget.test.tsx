// @vitest-environment jsdom
/**
 * The hook's fetch budget: a hidden section costs nothing, a new fetcher (new query) starts
 * at page 0, and showing a section again refetches only if something changed while hidden.
 *
 * This repo has no RTL auto-cleanup — every render unmounts itself.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { usePagedSection } from '@/app/admin/pipelines/access/_components/PagedCard';
import type { AccessPage } from '@/app/lib/api/access';

const page = (n: number): AccessPage<string> => ({
  content: ['x'],
  totalElements: 10,
  totalPages: 2,
  number: n,
  size: 5,
});

const fetcherMock = () => vi.fn((n: number) => Promise.resolve(page(n)));

describe('usePagedSection fetch budget', () => {
  it('a hidden section does not fetch; showing it fetches once', async () => {
    const fetcher = fetcherMock();
    const { result, rerender, unmount } = renderHook(
      ({ enabled }: { enabled: boolean }) => usePagedSection(fetcher, enabled),
      { initialProps: { enabled: false } },
    );
    expect(fetcher).not.toHaveBeenCalled();

    rerender({ enabled: true });
    await waitFor(() => expect(result.current.paged).not.toBeNull());
    expect(fetcher).toHaveBeenCalledTimes(1);

    // Hide and show again with nothing changed — no second call.
    rerender({ enabled: false });
    rerender({ enabled: true });
    await act(async () => {});
    expect(fetcher).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('a new fetcher restarts at page 0 instead of asking the old page first', async () => {
    const first = fetcherMock();
    const second = fetcherMock();
    const { result, rerender, unmount } = renderHook(
      ({ fetcher }: { fetcher: ReturnType<typeof fetcherMock> }) => usePagedSection(fetcher),
      { initialProps: { fetcher: first } },
    );
    await waitFor(() => expect(result.current.paged).not.toBeNull());

    act(() => result.current.setPage(1));
    await waitFor(() => expect(result.current.paged?.number).toBe(1));

    rerender({ fetcher: second });
    await waitFor(() => expect(result.current.paged?.number).toBe(0));
    expect(second).toHaveBeenCalledTimes(1);
    expect(second.mock.calls[0][0]).toBe(0);
    unmount();
  });

  it('reload() fetches again with the same fetcher and page', async () => {
    const fetcher = fetcherMock();
    const { result, unmount } = renderHook(() => usePagedSection(fetcher));
    await waitFor(() => expect(result.current.paged).not.toBeNull());

    act(() => result.current.reload());
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    unmount();
  });
});
