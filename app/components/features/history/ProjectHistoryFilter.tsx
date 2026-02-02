'use client';

import { cn } from '@/lib/theme';

export type HistoryFilterType = 'all' | 'approval';

interface FilterOption {
  value: HistoryFilterType;
  label: string;
}

const filterOptions: FilterOption[] = [
  { value: 'all', label: '전체' },
  { value: 'approval', label: '승인/반려' },
];

interface ProjectHistoryFilterProps {
  value: HistoryFilterType;
  onChange: (filter: HistoryFilterType) => void;
}

export const ProjectHistoryFilter = ({ value, onChange }: ProjectHistoryFilterProps) => {
  return (
    <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
      {filterOptions.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'px-3 py-1.5 text-sm font-medium rounded-md transition-all',
            value === option.value
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
};
