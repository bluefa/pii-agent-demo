'use client';

import { LoadingSpinner } from '@/app/components/ui/LoadingSpinner';
import { cn, getButtonClass, statusColors, textColors } from '@/lib/theme';

interface LoadingRowProps {
  message: string;
}

export const LoadingRow = ({ message }: LoadingRowProps) => (
  <div className="px-6 py-12 flex items-center justify-center gap-3">
    <LoadingSpinner />
    <span className={cn('text-sm', textColors.tertiary)}>{message}</span>
  </div>
);

interface ErrorRowProps {
  message: string;
  onRetry: () => void;
}

export const ErrorRow = ({ message, onRetry }: ErrorRowProps) => (
  <div className={cn('px-6 py-6 space-y-3', statusColors.error.bg)}>
    <p className={cn('text-sm font-medium', statusColors.error.textDark)}>{message}</p>
    <button onClick={onRetry} className={getButtonClass('secondary', 'sm')}>
      다시 시도
    </button>
  </div>
);
