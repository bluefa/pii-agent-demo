'use client';

import { cn, textColors, bgColors, borderColors, interactiveColors } from '@/lib/theme';

interface InfraListToolbarProps {
  totalCount: number;
  query: string;
  onQueryChange: (value: string) => void;
  onFilterClick?: () => void;
}

export const InfraListToolbar = ({
  totalCount,
  query,
  onQueryChange,
  onFilterClick,
}: InfraListToolbarProps) => (
  <div className="flex items-center justify-between mb-3">
    <div className={cn('text-sm', textColors.secondary)}>
      전체 <strong className={cn('font-semibold', textColors.primary)}>{totalCount}</strong>개 인프라
    </div>
    <div className="flex items-center gap-2">
      <div
        className={cn(
          'flex items-center gap-2 px-3 h-9 rounded-lg border w-[280px]',
          borderColors.default,
          bgColors.surface,
        )}
      >
        <svg
          width="14"
          height="14"
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
          placeholder="Provider, 계정, DB 이름으로 검색"
          className={cn(
            'flex-1 bg-transparent outline-none text-sm placeholder:font-normal',
            textColors.primary,
          )}
        />
      </div>
      <button
        type="button"
        onClick={onFilterClick}
        className={cn(
          'flex items-center gap-1.5 h-9 px-3 rounded-lg border text-xs font-medium transition-colors',
          interactiveColors.unselectedBorder,
          bgColors.surface,
          textColors.secondary,
        )}
      >
        <svg
          width="13"
          height="13"
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
