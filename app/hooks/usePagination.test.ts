// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { usePagination } from '@/app/hooks/usePagination';

const items = Array.from({ length: 25 }, (_, i) => i);

describe('usePagination', () => {
  it('slices the current page and respects initialPageSize', () => {
    const { result } = renderHook(() => usePagination(items, { initialPageSize: 10 }));

    expect(result.current.page).toBe(0);
    expect(result.current.pageSize).toBe(10);
    expect(result.current.pageItems).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);

    act(() => result.current.setPage(1));
    expect(result.current.page).toBe(1);
    expect(result.current.pageItems).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
  });

  it('clamps the page to the last available page', () => {
    const { result } = renderHook(() => usePagination(items, { initialPageSize: 10 }));

    // 25 items / 10 per page → last page index is 2.
    act(() => result.current.setPage(99));
    expect(result.current.page).toBe(2);
    expect(result.current.pageItems).toEqual([20, 21, 22, 23, 24]);
  });

  it('clamps to page 0 for an empty list', () => {
    const { result } = renderHook(() => usePagination<number>([], { initialPageSize: 5 }));

    act(() => result.current.setPage(3));
    expect(result.current.page).toBe(0);
    expect(result.current.pageItems).toEqual([]);
  });

  it('resets to page 0 when the page size changes', () => {
    const { result } = renderHook(() => usePagination(items, { initialPageSize: 10 }));

    act(() => result.current.setPage(2));
    expect(result.current.page).toBe(2);

    act(() => result.current.setPageSize(5));
    expect(result.current.page).toBe(0);
    expect(result.current.pageSize).toBe(5);
    expect(result.current.pageItems).toEqual([0, 1, 2, 3, 4]);
  });

  it('defaults to a page size of 10 when no option is given', () => {
    const { result } = renderHook(() => usePagination(items));
    expect(result.current.pageSize).toBe(10);
    expect(result.current.pageItems).toHaveLength(10);
  });
});
