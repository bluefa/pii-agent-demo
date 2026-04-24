'use client';

import type { Dispatch, SetStateAction } from 'react';
import { cn, primaryColors, textColors } from '@/lib/theme';

interface QueueBoardPaginationProps {
  page: number;
  totalPages: number;
  totalElements: number;
  pageSize: number;
  onPageChange: Dispatch<SetStateAction<number>>;
}

export const QueueBoardPagination = ({
  page,
  totalPages,
  totalElements,
  pageSize,
  onPageChange,
}: QueueBoardPaginationProps) => {
  if (totalPages <= 1) return null;

  const paginationStart = Math.max(0, page - 2);
  const paginationEnd = Math.min(totalPages, paginationStart + 5);
  const pageNumbers = Array.from(
    { length: paginationEnd - paginationStart },
    (_, i) => paginationStart + i,
  );

  const rangeStart = totalElements === 0 ? 0 : page * pageSize + 1;
  const rangeEnd = Math.min((page + 1) * pageSize, totalElements);

  return (
    <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
      <p className={cn('text-sm', textColors.tertiary)}>
        {totalElements}건 중 {rangeStart}-{rangeEnd} 표시
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange((p) => Math.max(0, p - 1))}
          disabled={page === 0}
          className={cn(
            'px-3 py-1.5 text-sm rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
            textColors.secondary,
            'hover:bg-gray-100',
          )}
        >
          이전
        </button>
        {pageNumbers.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onPageChange(n)}
            className={cn(
              'w-8 h-8 text-sm rounded-md transition-colors flex items-center justify-center',
              n === page
                ? `${primaryColors.bg} text-white`
                : `${textColors.tertiary} hover:bg-gray-100`,
            )}
          >
            {n + 1}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onPageChange((p) => Math.min(totalPages - 1, p + 1))}
          disabled={page >= totalPages - 1}
          className={cn(
            'px-3 py-1.5 text-sm rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
            textColors.secondary,
            'hover:bg-gray-100',
          )}
        >
          다음
        </button>
      </div>
    </div>
  );
};
