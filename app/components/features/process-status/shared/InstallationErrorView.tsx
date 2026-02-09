'use client';

import { statusColors, cn } from '@/lib/theme';

interface InstallationErrorViewProps {
  message: string;
  onRetry: () => void;
}

export const InstallationErrorView = ({ message, onRetry }: InstallationErrorViewProps) => (
  <div className={cn('w-full px-4 py-3 rounded-lg border', statusColors.error.bg, statusColors.error.border)}>
    <div className="flex items-center justify-between">
      <span className={cn('text-sm', statusColors.error.textDark)}>{message}</span>
      <button onClick={onRetry} className={cn('text-sm hover:underline', statusColors.error.textDark)}>
        다시 시도
      </button>
    </div>
  </div>
);
