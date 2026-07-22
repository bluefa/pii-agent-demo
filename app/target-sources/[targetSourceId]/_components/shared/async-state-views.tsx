'use client';

import { borderColors, cn, getButtonClass, idcStyles, statusColors } from '@/lib/theme';

/** Skeleton frame shown while a resource table loads — mirrors the table shape. */
export const ResourceTableSkeleton = () => (
  <div className="px-6 py-6" aria-busy="true" aria-live="polite">
    <div className={cn('overflow-hidden rounded-xl border', borderColors.default)}>
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className={cn('flex items-center gap-3 px-4 py-3.5', i > 0 && cn('border-t', borderColors.light))}
        >
          <div className={cn(idcStyles.skeletonBar, 'h-4 w-4 rounded')} />
          <div className={cn(idcStyles.skeletonBar, 'h-4 flex-1 rounded')} />
          <div className={cn(idcStyles.skeletonBar, 'h-4 w-24 rounded')} />
          <div className={cn(idcStyles.skeletonBar, 'h-5 w-20 rounded-full')} />
        </div>
      ))}
    </div>
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
