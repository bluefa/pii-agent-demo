'use client';

import { useMemo, useState } from 'react';

interface UsePaginationOptions {
  /** Initial rows-per-page. Defaults to 10 (the common table default). */
  initialPageSize?: number;
}

interface UsePaginationReturn<T> {
  /** Clamped (safe) 0-based page index — never out of range for the current item count. */
  page: number;
  /** Current rows-per-page. */
  pageSize: number;
  /** Set the desired page (gets clamped on read via `page`). */
  setPage: (next: number) => void;
  /** Change the page size; resets back to page 0. */
  setPageSize: (next: number) => void;
  /** The items on the current (clamped) page. */
  pageItems: T[];
}

/**
 * Client-side pagination state for an in-memory list. Collapses the
 * `page`/`pageSize`/clamp/slice boilerplate that the `<Pagination>` footer needs:
 * `page` is already clamped to the current item count and `pageItems` is the
 * matching slice, so the same value drives both the slice and `<Pagination page>`.
 * `setPageSize` resets to page 0 (matching the existing reset-on-size-change call sites).
 */
export const usePagination = <T>(
  items: readonly T[],
  options: UsePaginationOptions = {},
): UsePaginationReturn<T> => {
  const { initialPageSize = 10 } = options;
  const [page, setPage] = useState(0);
  const [pageSize, setPageSizeState] = useState(initialPageSize);

  const safePage = Math.min(page, Math.max(0, Math.ceil(items.length / pageSize) - 1));
  const pageItems = useMemo(
    () => items.slice(safePage * pageSize, safePage * pageSize + pageSize),
    [items, safePage, pageSize],
  );

  const setPageSize = (next: number) => {
    setPageSizeState(next);
    setPage(0);
  };

  return { page: safePage, pageSize, setPage, setPageSize, pageItems };
};

export default usePagination;
