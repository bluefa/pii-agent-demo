'use client';

import {
  bgColors,
  borderColors,
  cn,
  interactiveColors,
  numericFeatures,
  primaryColors,
  textColors,
} from '@/lib/theme';

interface InfraListToolbarProps {
  totalCount: number;
  query: string;
  onQueryChange: (value: string) => void;
  onFilterClick?: () => void;
}

/**
 * Sheet header — the list's title bar, sitting inside the same border as the rows
 * and the pager rather than floating above them. The count belongs here, not in the
 * page header: it describes this list, not the service.
 */
export const InfraListToolbar = ({
  totalCount,
  query,
  onQueryChange,
  onFilterClick,
}: InfraListToolbarProps) => (
  <div
    className={cn(
      'flex h-12 items-center justify-between gap-4 px-5 border-b rounded-t-[10px]',
      bgColors.muted,
      borderColors.light,
    )}
  >
    <div className={cn('flex items-center gap-2 text-[14px] font-bold', textColors.primary)}>
      연동 대상 계정
      <span
        className={cn(
          'rounded-full px-2.5 py-0.5 text-[12px] font-bold',
          primaryColors.bgLight,
          primaryColors.textOnLight,
          numericFeatures.tabular,
        )}
      >
        {totalCount}건
      </span>
    </div>
    <div className="flex items-center gap-2">
      <div
        className={cn(
          'flex items-center gap-2 px-2.5 h-8 rounded-lg border w-[240px]',
          borderColors.default,
          bgColors.surface,
        )}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={textColors.quaternary}
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="계정, 설명으로 검색"
          className={cn(
            'flex-1 min-w-0 bg-transparent outline-none text-[12px] placeholder:font-normal',
            textColors.primary,
          )}
        />
      </div>
      <button
        type="button"
        onClick={onFilterClick}
        className={cn(
          'flex items-center gap-1.5 h-8 px-3 rounded-lg border text-[12px] font-semibold transition-colors',
          interactiveColors.unselectedBorder,
          bgColors.surface,
          textColors.secondary,
        )}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </svg>
        필터
      </button>
    </div>
  </div>
);
