'use client';

import { useState, useEffect } from 'react';
import { cn, textColors, cardStyles, getInputClass, getButtonClass } from '@/lib/theme';

interface QueueBoardHeaderProps {
  requestType: string | null;
  search: string;
  onRequestTypeChange: (value: string | null) => void;
  onSearchChange: (value: string) => void;
  onReset: () => void;
}

const REQUEST_TYPE_OPTIONS = [
  { value: '', label: '전체' },
  { value: 'TARGET_CONFIRMATION', label: '연동 대상 확정' },
  { value: 'END_OF_SERVICE', label: 'EoS 처리' },
] as const;

export const QueueBoardHeader = ({
  requestType,
  search,
  onRequestTypeChange,
  onSearchChange,
  onReset,
}: QueueBoardHeaderProps) => {
  const [localSearch, setLocalSearch] = useState(search);

  // Sync external search changes (e.g. reset)
  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  // Debounce: propagate after 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== search) {
        onSearchChange(localSearch);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [localSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasFilter = !!requestType || !!search;

  return (
    <div className="flex flex-col gap-4">
      {/* Title */}
      <h1 className={cn('text-2xl font-bold flex items-center gap-2.5', textColors.primary)}>
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
        Admin Tasks
      </h1>

      {/* Filter Bar */}
      <div className={cn(cardStyles.base, 'inline-flex items-center gap-3 px-4 py-2.5 w-auto')}>
        {/* Filter Icon */}
        <div className={cn('flex items-center gap-1.5 flex-shrink-0', textColors.tertiary)}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
            />
          </svg>
          <span className="text-xs font-medium">필터</span>
        </div>

        <div className="w-px h-5 bg-gray-200 flex-shrink-0" />

        {/* Request Type Select */}
        <select
          value={requestType ?? ''}
          onChange={(e) => onRequestTypeChange(e.target.value || null)}
          className={cn(getInputClass(), 'w-48 h-8 py-0 text-xs')}
        >
          {REQUEST_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {/* Search Input */}
        <div className="relative w-64 flex-shrink-0">
          <svg
            className={cn('absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5', textColors.quaternary)}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="서비스코드 또는 서비스명"
            className={cn(getInputClass(), 'pl-8 h-8 py-0 text-xs')}
          />
        </div>

        {/* Reset Button */}
        {hasFilter && (
          <button
            type="button"
            onClick={onReset}
            className={cn(getButtonClass('ghost', 'sm'), 'flex items-center gap-1 flex-shrink-0 h-8 px-2 text-xs')}
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            초기화
          </button>
        )}
      </div>
    </div>
  );
};
