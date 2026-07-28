'use client';

import { borderColors, cn, idcStyles } from '@/lib/theme';

interface InstallationLoadingViewProps {
  provider: string;
}

/**
 * Skeleton frame for the Agent 설치 step while the installation status loads —
 * mirrors the real layout (3 stage tiles over the resource table) so the card
 * keeps its shape instead of collapsing to a one-line spinner and reflowing
 * when the data lands. IDC's step 4 already renders ResourceTableSkeleton;
 * this brings the three cloud providers to the same pattern.
 */
export const InstallationLoadingView = ({ provider }: InstallationLoadingViewProps) => (
  <div aria-busy="true" aria-live="polite" aria-label={`${provider} 설치 상태 확인 중`}>
    <div className="grid grid-cols-3 gap-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className={cn('rounded-xl border p-5', borderColors.light)}>
          <div className={cn(idcStyles.skeletonBar, 'h-7 w-7 rounded-full')} />
          <div className={cn(idcStyles.skeletonBar, 'mt-3 h-4 w-3/4 rounded')} />
          <div className={cn(idcStyles.skeletonBar, 'mt-2 h-3 w-full rounded')} />
          <div className={cn(idcStyles.skeletonBar, 'mt-3 h-5 w-14 rounded-full')} />
        </div>
      ))}
    </div>
    <div className={cn('mt-4 overflow-hidden rounded-xl border', borderColors.default)}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className={cn('flex items-center gap-3 px-4 py-3.5', i > 0 && cn('border-t', borderColors.light))}
        >
          <div className={cn(idcStyles.skeletonBar, 'h-5 w-20 rounded-full')} />
          <div className={cn(idcStyles.skeletonBar, 'h-4 flex-1 rounded')} />
          <div className={cn(idcStyles.skeletonBar, 'h-4 w-28 rounded')} />
          <div className={cn(idcStyles.skeletonBar, 'h-5 w-16 rounded-full')} />
        </div>
      ))}
    </div>
  </div>
);
