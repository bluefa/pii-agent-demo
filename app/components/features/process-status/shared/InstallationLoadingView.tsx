'use client';

import { borderColors, cn, idcStyles, stackGap } from '@/lib/theme';

interface InstallationLoadingViewProps {
  provider: string;
}

const Bar = ({ className }: { className: string }) => (
  <div className={cn(idcStyles.skeletonBar, className)} />
);

/**
 * Skeleton frame for the Agent 설치 step while the installation status loads —
 * mirrors InstallStatusDetail's master-detail frame (320px step rail + summary
 * panel) so the card keeps its shape instead of reflowing when the data lands.
 *
 * The action banner is deliberately NOT drawn: it only appears when the service
 * side has something to do, and a skeleton must not promise an alert that may
 * never materialize.
 */
export const InstallationLoadingView = ({ provider }: InstallationLoadingViewProps) => (
  <div aria-busy="true" aria-live="polite" aria-label={`${provider} 설치 상태 확인 중`}>
    <div className={cn('grid grid-cols-[320px_minmax(0,1fr)] rounded-xl border overflow-hidden', borderColors.default)}>
      {/* step rail — index circle + title + side tag, status pill on the second line */}
      <div className={cn('border-r p-2.5 flex flex-col gap-1 bg-white', borderColors.default)}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-1.5 px-2.5 py-2.5">
            <div className="flex items-start gap-2.5">
              <Bar className="h-6 w-6 flex-shrink-0 rounded-full" />
              <Bar className="mt-1 h-3.5 flex-1 rounded" />
              <Bar className="h-6 w-[88px] flex-shrink-0 rounded-md" />
            </div>
            <div className="flex items-center gap-1.5 pl-[34px]">
              <Bar className="h-6 w-12 rounded-md" />
              <Bar className="h-3 w-7 rounded" />
            </div>
          </div>
        ))}
      </div>

      {/* summary panel — title / desc / rollup line, then two action cards */}
      <div className={cn('flex flex-col bg-white p-5', stackGap.group)}>
        <Bar className="h-4 w-40 rounded" />
        <Bar className="h-3.5 w-[68%] rounded" />
        <Bar className="h-3 w-52 rounded" />
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className={cn('flex flex-col rounded-xl border p-4', stackGap.related, borderColors.light)}>
            <div className="flex items-center gap-2">
              <Bar className="h-4 w-36 rounded" />
              <Bar className="h-6 w-16 rounded-md" />
              <Bar className="h-6 w-[88px] rounded-md" />
            </div>
            <Bar className="h-3.5 w-[78%] rounded" />
            <Bar className="h-8 w-28 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  </div>
);
