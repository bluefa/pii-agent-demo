'use client';

/**
 * Figma-style numbered pager (pYCA7zTWcZysYOpYykuYAN 4:2 — ‹ 1 2 3 ›).
 * Active page = filled primary square; numbers are 0-based externally,
 * 1-based on screen. Renders nothing for a single page.
 */
import type { ReactElement } from 'react';
import { cn } from '@/lib/theme';

const PAGE_BTN =
  'inline-flex h-6 min-w-6 items-center justify-center rounded-md px-1 text-[12px] font-medium transition-colors';

export interface OpsPaginationProps {
  /** 0-based current page. */
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}

/** Sliding window of up to 5 page indices centred on the current page. */
const windowPages = (page: number, totalPages: number): number[] => {
  const start = Math.max(0, Math.min(page - 2, totalPages - 5));
  return Array.from({ length: Math.min(5, totalPages) }, (_, i) => start + i);
};

export function OpsPagination({ page, totalPages, onChange }: OpsPaginationProps): ReactElement | null {
  if (totalPages <= 1) return null;
  return (
    <nav aria-label="페이지" className="mt-4 flex items-center justify-center gap-1">
      <button
        type="button"
        aria-label="이전 페이지"
        disabled={page === 0}
        onClick={() => onChange(page - 1)}
        className={cn(PAGE_BTN, 'text-[var(--pl-text-weak)] disabled:opacity-40')}
      >
        ‹
      </button>
      {windowPages(page, totalPages).map((p) => (
        <button
          key={p}
          type="button"
          aria-current={p === page ? 'page' : undefined}
          onClick={() => onChange(p)}
          className={cn(
            PAGE_BTN,
            p === page
              ? 'bg-[var(--pl-primary)] font-semibold text-white'
              : 'text-[var(--pl-text-weak)] hover:bg-[var(--pl-gray-100)]',
          )}
        >
          {p + 1}
        </button>
      ))}
      <button
        type="button"
        aria-label="다음 페이지"
        disabled={page >= totalPages - 1}
        onClick={() => onChange(page + 1)}
        className={cn(PAGE_BTN, 'text-[var(--pl-text-weak)] disabled:opacity-40')}
      >
        ›
      </button>
    </nav>
  );
}
