'use client';

import { bgColors, borderColors, cn, textColors } from '@/lib/theme';

interface SidebarPaginationProps {
  totalPages: number;
  currentPage: number;
  onPageChange: (page: number) => void;
}

const pageButtonClass = cn(
  'w-7 h-7 flex items-center justify-center rounded-md text-sm cursor-pointer transition-colors disabled:opacity-30 disabled:cursor-not-allowed',
  bgColors.surfaceHover,
  textColors.tertiary,
);

/** Pagination only — the hit count sits next to the search input. */
export const SidebarPagination = ({
  totalPages,
  currentPage,
  onPageChange,
}: SidebarPaginationProps) => {
  const start = Math.max(0, currentPage - 2);
  const end = Math.min(totalPages, start + 5);
  const pageNumbers = Array.from({ length: end - start }, (_, i) => start + i);

  return (
    <div className={cn('border-t px-4 py-3', borderColors.default)}>
      <div className="flex items-center justify-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(0, currentPage - 1))}
          disabled={currentPage === 0}
          className={pageButtonClass}
          aria-label="이전 페이지"
        >
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
            <path d="M8.75 3.5L5.25 7L8.75 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {pageNumbers.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onPageChange(n)}
            className={cn(
              'w-7 h-7 text-xs rounded-md cursor-pointer transition-colors flex items-center justify-center',
              // Current page reads as "pressed", not as an accent — paging is
              // navigation, not a branded action. A grey chip is invisible on the
              // gray-50 panel (1.05:1), so the marker is a lifted white key and its
              // border carries the shape.
              n === currentPage
                ? cn(
                    'border font-semibold',
                    bgColors.surface,
                    borderColors.emphasis,
                    textColors.secondary,
                  )
                : cn(textColors.tertiary, bgColors.surfaceHover),
            )}
          >
            {n + 1}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages - 1, currentPage + 1))}
          disabled={currentPage >= totalPages - 1}
          className={pageButtonClass}
          aria-label="다음 페이지"
        >
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
            <path d="M5.25 3.5L8.75 7L5.25 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
};
