'use client';

import { bgColors, borderColors, cn, idcStyles, shadows, stackGap } from '@/lib/theme';

interface InstallationLoadingViewProps {
  provider: string;
  /** Mirror the grouped rail frame (gray wrapper + 224px rail + fixed 560px card). */
  grouped?: boolean;
}

const Bar = ({ className }: { className: string }) => (
  <div className={cn(idcStyles.skeletonBar, className)} />
);

/**
 * Skeleton frame for the Agent 설치 step while the installation status loads —
 * mirrors InstallStatusDetail's frame so the card keeps its shape instead of
 * reflowing when the data lands. `grouped` mirrors the grouped-rail frame
 * (AWS); the default mirrors the legacy master-detail frame.
 *
 * The action banner is deliberately NOT drawn: it only appears when the service
 * side has something to do, and a skeleton must not promise an alert that may
 * never materialize.
 */
export const InstallationLoadingView = ({ provider, grouped = false }: InstallationLoadingViewProps) =>
  grouped ? (
    <div
      aria-busy="true"
      aria-live="polite"
      aria-label={`${provider} 설치 상태 확인 중`}
      className={cn('rounded-2xl p-2', bgColors.panel)}
    >
      {/* metabar — title left, last-check caption right */}
      <div className="flex items-baseline gap-3 px-2.5 pt-1.5 pb-2.5">
        <Bar className="h-4 w-32 rounded" />
        <Bar className="ml-auto h-3 w-44 rounded" />
      </div>
      <div className="grid grid-cols-[224px_minmax(0,1fr)] gap-2 h-[560px]">
        {/* rail — group label + single-line items */}
        <div className="flex flex-col gap-0.5 pb-1">
          <Bar className="mx-2.5 mt-3 mb-1 h-3 w-24 rounded" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2 px-3.5 py-2">
              <Bar className="h-3.5 flex-1 rounded" />
              <Bar className="h-3 w-8 flex-shrink-0 rounded" />
            </div>
          ))}
        </div>
        {/* white content card — fixed header, table-row body */}
        <div className={cn('min-w-0 flex flex-col bg-white rounded-xl border', borderColors.default, shadows.hair)}>
          <div className={cn('flex flex-col gap-1.5 px-5 py-4 border-b', borderColors.light)}>
            <Bar className="h-4 w-40 rounded" />
            <Bar className="h-3 w-[60%] rounded" />
          </div>
          <div className="flex-1 min-h-0 overflow-hidden px-5 py-4 flex flex-col gap-2.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <Bar key={i} className="h-8 w-full rounded" />
            ))}
          </div>
        </div>
      </div>
    </div>
  ) : (
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
