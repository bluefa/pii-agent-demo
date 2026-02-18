'use client';

import { cn, statusColors } from '@/lib/theme';

interface FilterTabProps {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}

export const FilterTab = ({ label, count, active, onClick }: FilterTabProps) => (
  <button
    onClick={onClick}
    className={cn(
      'px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
      active ? cn(statusColors.info.bg, statusColors.info.textDark) : 'text-gray-600 hover:bg-gray-100'
    )}
  >
    {label}
    <span
      className={cn(
        'ml-1.5 px-1.5 py-0.5 text-xs rounded-full',
        active ? cn(statusColors.info.bg, statusColors.info.textDark) : 'bg-gray-200 text-gray-600'
      )}
    >
      {count}
    </span>
  </button>
);
