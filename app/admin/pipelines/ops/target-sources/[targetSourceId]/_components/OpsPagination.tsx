'use client';

/**
 * Figma-style numbered pager (pYCA7zTWcZysYOpYykuYAN 4:2 — ‹ 1 2 3 ›).
 * Active page = filled primary square; numbers are 0-based externally,
 * 1-based on screen. Renders nothing for a single page.
 */
import type { ReactElement } from 'react';
import { cn } from '@/lib/theme';
import { Icon } from '@/app/admin/pipelines/_components/icons';

/**
 * 32×32 / 14px — the median of MUI, Ant Design and Primer pagination, and the
 * desktop-density control height the design guide allows. The prior 24×24 / 12px
 * sat exactly on the WCAG 2.5.8 (AA) 24px target floor with the smallest type in
 * the set, which is what made it hard to hit and hard to read.
 */
const PAGE_BTN =
  'inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-1.5 text-[14px] font-medium transition-colors';

export interface OpsPaginationProps {
  /** 0-based current page. */
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  /**
   * Render the pager even for a single page. Used by the side-by-side 진행 상태
   * cards, where a disappearing footer would make the two cards different
   * heights depending on how much data each happens to hold.
   */
  always?: boolean;
}

/** Sliding window of up to 5 page indices centred on the current page. */
const windowPages = (page: number, totalPages: number): number[] => {
  const start = Math.max(0, Math.min(page - 2, totalPages - 5));
  return Array.from({ length: Math.min(5, totalPages) }, (_, i) => start + i);
};

export function OpsPagination({
  page,
  totalPages,
  onChange,
  always,
}: OpsPaginationProps): ReactElement | null {
  if (totalPages <= 1 && !always) return null;
  return (
    <nav aria-label="페이지" className="mt-4 flex items-center justify-center gap-1">
      <button
        type="button"
        aria-label="이전 페이지"
        disabled={page === 0}
        onClick={() => onChange(page - 1)}
        className={cn(
          PAGE_BTN,
          'text-[var(--pl-text-weak)] enabled:hover:bg-[var(--pl-gray-100)] disabled:opacity-40',
        )}
      >
        <Icon name="chev-l" />
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
        className={cn(
          PAGE_BTN,
          'text-[var(--pl-text-weak)] enabled:hover:bg-[var(--pl-gray-100)] disabled:opacity-40',
        )}
      >
        <Icon name="chev-r" />
      </button>
    </nav>
  );
}
