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
 * List-card footer: a range summary ("1–15 / 100") plus prev/next. Numbered
 * page buttons are data-table chrome — in a 296px rail the summary carries
 * more information ("how many, where am I") in less space, and search is the
 * primary lookup path anyway. Arrows render only when there is a second page,
 * so a single page shows a quiet count line instead of dead controls.
 */
export const SidebarPagination = ({ pageInfo, onPageChange }: SidebarPaginationProps) => {
  const { totalElements, totalPages, number: currentPage, size } = pageInfo;
  const start = currentPage * size + 1;
  const end = Math.min((currentPage + 1) * size, totalElements);
  const range = start === end ? `${end}` : `${start}–${end}`;

  return (
    <div className={serviceSidebarStyles.footer}>
      <span className={serviceSidebarStyles.footerRange}>
        {range} / {totalElements}
      </span>
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
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
      )}
    </div>
  );
};
