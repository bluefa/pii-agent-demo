'use client';

import type { ReactNode } from 'react';
import { cn, numericFeatures } from '@/lib/theme';

interface PaginationProps {
  /** 0-based page index */
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (next: number) => void;
  onPageSizeChange: (next: number) => void;
  pageSizeOptions?: ReadonlyArray<number>;
  /**
   * Edge-control set. `full` (default) renders first/prev/next/last; `prevNext`
   * renders single-chevron prev/next only — the v16 IDC step-table pager
   * (`이전 / [1] / 다음`, no first/last double-chevrons).
   */
  controls?: 'full' | 'prevNext';
}

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

/**
 * v15 `.pg-perpage select` custom chevron — inline data-URI (#9CA3AF stroke),
 * positioned `right 7px center no-repeat` over a `#fff` fill. Paired with
 * `appearance-none` so the native arrow is hidden. (05-tables.md §7c, line 2952.)
 */
const SELECT_CHEVRON_BG =
  "bg-[#fff] bg-[length:9px] bg-[right_7px_center] bg-no-repeat " +
  "bg-[url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='9' height='9' viewBox='0 0 24 24' fill='none' stroke='%239CA3AF' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>\")]";

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

/**
 * v15 `.pagination-row` footer (05-tables.md §7) — a standalone bar that sits
 * directly beneath a table: 1px #E5E7EB border with no top edge, `0 0 10px 10px`
 * radius, #FCFCFD fill, 10/14 padding, 12px/#374151. Numbered page buttons +
 * ellipsis only (no first/last/prev/next icon controls in v15).
 */
export const Pagination = ({
  page,
  pageSize,
  totalCount,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions,
  controls = 'full',
}: PaginationProps) => {
  const options = pageSizeOptions ?? DEFAULT_PAGE_SIZE_OPTIONS;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const start = totalCount === 0 ? 0 : page * pageSize + 1;
  const end = Math.min(totalCount, (page + 1) * pageSize);
  const visible = buildVisiblePages(page, totalPages);

  return (
    <div className="flex items-center px-[14px] py-[10px] border border-[#E5E7EB] border-t-0 rounded-b-[10px] bg-[#FCFCFD] text-[12px] text-[#6B7280]">
      <div className="inline-flex items-center gap-1.5">
        <span>표시</span>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className={cn(
            'h-[26px] rounded-[6px] border border-[#E5E7EB] pr-[22px] pl-[8px] text-[12px] text-[#111827] cursor-pointer appearance-none',
            SELECT_CHEVRON_BG,
          )}
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
      <span className={cn('ml-[16px] text-[#374151]', numericFeatures.tabular)}>
        <strong className="font-semibold text-[#111827]">
          {start}–{end}
        </strong>{' '}
        / 전체{' '}
        <strong className="font-semibold text-[#111827]">{totalCount}</strong>건
      </span>
      <div className="flex-1" />
      <div className="inline-flex gap-0.5">
        {/* first/prev/next/last kept for usability (v15 mockup shows numbers only).
            IDC step tables pass controls="prevNext" to drop the first/last
            double-chevrons (v16 IDC pager is 이전 / [1] / 다음). */}
        {controls === 'full' && (
          <PageBtn active={false} disabled={page <= 0} onClick={() => onPageChange(0)} ariaLabel="처음 페이지">
            ‹‹
          </PageBtn>
        )}
        <PageBtn active={false} disabled={page <= 0} onClick={() => onPageChange(page - 1)} ariaLabel="이전 페이지">
          ‹
        </PageBtn>
        {visible.map((entry, index) =>
          entry === '…' ? (
            <span
              key={`ellipsis-${index}`}
              className="inline-flex min-w-[20px] items-center justify-center self-center text-center text-[12px] text-[#9CA3AF]"
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
        <PageBtn active={false} disabled={page >= totalPages - 1} onClick={() => onPageChange(page + 1)} ariaLabel="다음 페이지">
          ›
        </PageBtn>
        {controls === 'full' && (
          <PageBtn active={false} disabled={page >= totalPages - 1} onClick={() => onPageChange(totalPages - 1)} ariaLabel="끝 페이지">
            ››
          </PageBtn>
        )}
      </div>
    </div>
  );
};

interface PageBtnProps {
  active: boolean;
  onClick: () => void;
  ariaLabel: string;
  children: ReactNode;
  disabled?: boolean;
}

/**
 * v15 `.pg-pages button` (05-tables.md §7g–7h): 28×28, radius 6, 0/8 padding,
 * transparent border + bg, #374151 text. Hover → #F9FAFB / #111827. Active
 * (`.current`) → #0064FF / #fff / 600. Disabled → opacity 0.35.
 */
const PageBtn = ({ active, onClick, ariaLabel, children, disabled }: PageBtnProps) => (
  <button
    type="button"
    aria-label={ariaLabel}
    aria-current={active ? 'page' : undefined}
    disabled={disabled}
    onClick={onClick}
    className={cn(
      'inline-grid min-w-[28px] h-[28px] place-items-center rounded-[6px] border px-[8px] text-[12px] transition-colors disabled:opacity-35 disabled:cursor-not-allowed',
      numericFeatures.tabular,
      active
        ? 'border-transparent bg-[#0064FF] text-white font-semibold'
        : 'border-transparent bg-transparent text-[#374151] hover:bg-[#F9FAFB] hover:text-[#111827]',
    )}
  >
    {children}
  </button>
);
