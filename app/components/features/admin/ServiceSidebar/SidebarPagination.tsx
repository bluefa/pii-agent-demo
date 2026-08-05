'use client';

import { cn, serviceSidebarStyles } from '@/lib/theme';

interface SidebarPaginationProps {
  pageInfo: {
    totalElements: number;
    totalPages: number;
    number: number;
    size: number;
  };
  onPageChange: (page: number) => void;
}

/**
 * Page indicator — "‹ 1 / 2 페이지 ›" on the rail's bottom edge.
 *
 * It says which page you are on, nothing else: the total moved to the pill beside
 * the rail title, so the old "1–12 / 20" range said the same number twice and read
 * as a table footer. Numbered page buttons are data-table chrome too — at 296px a
 * pair of arrows is the whole control.
 *
 * Renders nothing at one page. A lone "1 / 1" under a complete list is a control
 * with nowhere to go, and it was the awkward part of every short search result.
 */
export const SidebarPagination = ({ pageInfo, onPageChange }: SidebarPaginationProps) => {
  const { totalPages, number: currentPage } = pageInfo;
  if (totalPages <= 1) return null;

  return (
    <div className={serviceSidebarStyles.footer}>
      <button
        type="button"
        onClick={() => onPageChange(Math.max(0, currentPage - 1))}
        disabled={currentPage === 0}
        className={cn('cursor-pointer', serviceSidebarStyles.pagerBtn)}
        aria-label="이전 페이지"
      >
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
          <path d="M8.75 3.5L5.25 7L8.75 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <span className={serviceSidebarStyles.footerPage}>
        {currentPage + 1} / {totalPages} 페이지
      </span>
      <button
        type="button"
        onClick={() => onPageChange(Math.min(totalPages - 1, currentPage + 1))}
        disabled={currentPage >= totalPages - 1}
        className={cn('cursor-pointer', serviceSidebarStyles.pagerBtn)}
        aria-label="다음 페이지"
      >
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
          <path d="M5.25 3.5L8.75 7L5.25 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
};
