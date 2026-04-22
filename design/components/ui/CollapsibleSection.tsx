'use client';

import { useState } from 'react';
import { cn, textColors, bgColors } from '@/lib/theme';

interface CollapsibleSectionProps {
  label: string;
  count: number;
  icon?: React.ReactNode;
  labelClassName?: string;
  contentClassName?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

const ChevronIcon = ({ isOpen }: { isOpen: boolean }) => (
  <svg
    className={cn('w-4 h-4 transition-transform duration-200', isOpen && 'rotate-90')}
    viewBox="0 0 20 20"
    fill="currentColor"
  >
    <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
  </svg>
);

export const CollapsibleSection = ({
  label,
  count,
  icon,
  labelClassName,
  contentClassName,
  defaultOpen = false,
  children,
}: CollapsibleSectionProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="mt-4">
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className={cn('flex items-center gap-2 px-6 py-3 w-full text-left transition-colors rounded-lg', `hover:${bgColors.muted}`)}
      >
        <ChevronIcon isOpen={isOpen} />
        {icon}
        <span className={cn('text-sm font-semibold', labelClassName || textColors.secondary)}>
          {label}
        </span>
        <span className={cn('text-sm', textColors.tertiary)}>
          ({count})
        </span>
      </button>

      {isOpen && (
        <div className={contentClassName}>
          {children}
        </div>
      )}
    </div>
  );
};
