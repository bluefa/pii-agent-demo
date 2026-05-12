'use client';

import type { ReactNode } from 'react';
import {
  ChevronFirstIcon,
  ChevronLastIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@/app/components/ui/icons';
import {
  bgColors,
  borderColors,
  cn,
  interactiveColors,
  numericFeatures,
  primaryColors,
  textColors,
} from '@/lib/theme';

interface PaginationProps {
  /** 0-based page index */
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (next: number) => void;
  onPageSizeChange: (next: number) => void;
  pageSizeOptions?: ReadonlyArray<number>;
}

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

/**
 * Returns the page numbers (0-based) and ellipses to render in the page-numbers
 * row. Always shows first/last; collapses the middle to current ±1 with '…'
 * separators when the total exceeds 7 pages.
 */
export const buildVisiblePages = (current: number, total: number): Array<number | '…'> => {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i);
  const out: Array<number | '…'> = [0];
  const left = Math.max(1, current - 1);
  const right = Math.min(total - 2, current + 1);
  if (left > 1) out.push('…');
  for (let p = left; p <= right; p++) out.push(p);
  if (right < total - 2) out.push('…');
  out.push(total - 1);
  return out;
};

export const Pagination = ({
  page,
  pageSize,
  totalCount,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions,
}: PaginationProps) => {
  const options = pageSizeOptions ?? DEFAULT_PAGE_SIZE_OPTIONS;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const start = totalCount === 0 ? 0 : page * pageSize + 1;
  const end = Math.min(totalCount, (page + 1) * pageSize);
  const visible = buildVisiblePages(page, totalPages);
  const isFirst = page === 0;
  const isLast = page >= totalPages - 1;

  return (
    <div className="flex flex-wrap items-center gap-3 py-3">
      <div className={cn('flex items-center gap-2 text-[12px]', textColors.secondary)}>
        <span>표시</span>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className={cn('h-7 rounded-md border px-1 text-[12px]', borderColors.default, textColors.primary)}
          aria-label="페이지당 표시 건수"
        >
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        <span>건씩</span>
      </div>
      <span className={cn('text-[12px]', textColors.tertiary, numericFeatures.tabular)}>
        <strong className={cn('font-semibold', textColors.secondary)}>
          {start}–{end}
        </strong>{' '}
        / 전체{' '}
        <strong className={cn('font-semibold', textColors.secondary)}>{totalCount}</strong>건
      </span>
      <div className="ml-auto flex items-center gap-1">
        <IconBtn aria-label="처음 페이지" disabled={isFirst} onClick={() => onPageChange(0)}>
          <ChevronFirstIcon className="h-3.5 w-3.5" />
        </IconBtn>
        <IconBtn aria-label="이전 페이지" disabled={isFirst} onClick={() => onPageChange(page - 1)}>
          <ChevronLeftIcon className="h-3.5 w-3.5" />
        </IconBtn>
        {visible.map((entry, index) =>
          entry === '…' ? (
            <span
              key={`ellipsis-${index}`}
              className={cn('px-1 text-[12px]', textColors.quaternary)}
              aria-hidden="true"
            >
              …
            </span>
          ) : (
            <PageBtn
              key={entry}
              active={entry === page}
              onClick={() => onPageChange(entry)}
              ariaLabel={`${entry + 1} 페이지`}
            >
              {entry + 1}
            </PageBtn>
          ),
        )}
        <IconBtn aria-label="다음 페이지" disabled={isLast} onClick={() => onPageChange(page + 1)}>
          <ChevronRightIcon className="h-3.5 w-3.5" />
        </IconBtn>
        <IconBtn aria-label="끝 페이지" disabled={isLast} onClick={() => onPageChange(totalPages - 1)}>
          <ChevronLastIcon className="h-3.5 w-3.5" />
        </IconBtn>
      </div>
    </div>
  );
};

interface IconBtnProps {
  'aria-label': string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}

const IconBtn = ({ 'aria-label': ariaLabel, disabled, onClick, children }: IconBtnProps) => (
  <button
    type="button"
    aria-label={ariaLabel}
    disabled={disabled}
    onClick={onClick}
    className={cn(
      'inline-flex h-7 w-7 items-center justify-center rounded-md border transition-colors disabled:cursor-not-allowed disabled:opacity-40',
      borderColors.default,
      interactiveColors.closeButton,
    )}
  >
    {children}
  </button>
);

interface PageBtnProps {
  active: boolean;
  onClick: () => void;
  ariaLabel: string;
  children: ReactNode;
}

const PageBtn = ({ active, onClick, ariaLabel, children }: PageBtnProps) => (
  <button
    type="button"
    aria-label={ariaLabel}
    aria-current={active ? 'page' : undefined}
    onClick={onClick}
    className={cn(
      'inline-flex h-7 min-w-[28px] items-center justify-center rounded-md border px-1.5 text-[12px] font-semibold transition-colors',
      numericFeatures.tabular,
      active
        ? cn(primaryColors.bg, primaryColors.border, textColors.inverse)
        : cn(borderColors.default, textColors.secondary, bgColors.mutedHover),
    )}
  >
    {children}
  </button>
);
