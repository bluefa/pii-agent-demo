'use client';

import { cn, serviceSidebarStyles } from '@/lib/theme';
import { ChevronLeftIcon, ChevronRightIcon } from '@/app/components/ui/icons';
import { useLocale } from '@/app/components/LocaleProvider';
import { COPY } from '@/lib/copy';

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
  const { locale } = useLocale();
  const t = COPY[locale].services;
  const { totalPages, number: currentPage } = pageInfo;
  if (totalPages <= 1) return null;

  return (
    <div className={serviceSidebarStyles.footer}>
      <button
        type="button"
        onClick={() => onPageChange(Math.max(0, currentPage - 1))}
        disabled={currentPage === 0}
        className={cn('cursor-pointer', serviceSidebarStyles.pagerBtn)}
        aria-label={t.prevPage}
      >
        <ChevronLeftIcon />
      </button>
      <span className={serviceSidebarStyles.footerPage}>
        {t.railPageOf(currentPage + 1, totalPages)}
      </span>
      <button
        type="button"
        onClick={() => onPageChange(Math.min(totalPages - 1, currentPage + 1))}
        disabled={currentPage >= totalPages - 1}
        className={cn('cursor-pointer', serviceSidebarStyles.pagerBtn)}
        aria-label={t.nextPage}
      >
        <ChevronRightIcon />
      </button>
    </div>
  );
};
