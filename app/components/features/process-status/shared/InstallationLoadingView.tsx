'use client';

import { bgColors, borderColors, cn, idcStyles, stackGap } from '@/lib/theme';

interface InstallationLoadingViewProps {
  provider: string;
  /**
   * Rail rows to draw = 설치 현황 요약 + the provider's steps. A hardcoded count
   * reflows the card on data arrival — exactly what the skeleton exists to stop.
   */
  railRows: number;
}

// 레일은 panel(gray-100) 위에 앉는데 기본 스켈레톤 바도 gray-100 이라 그 위에서는
// 보이지 않는다 — 레일 안에서만 divider(gray-200)로 한 단 올린다.
const RAIL_BAR = cn('animate-pulse', bgColors.divider);

const Bar = ({ className, tone }: { className: string; tone?: string }) => (
  <div className={cn(tone ?? idcStyles.skeletonBar, className)} />
);

/**
 * Skeleton frame for the Agent 설치 step while the installation status loads.
 *
 * Every frame value here is copied from InstallStatusDetail's own markup —
 * 224px rail on bgColors.panel, borderColors.light container, px-5 py-4 right
 * pane, one bordered stats card — so the card does not resize or repaint when
 * the data lands. A skeleton that only approximates the frame reintroduces the
 * reflow it exists to prevent.
 *
 * The action banner is deliberately NOT drawn: it only appears when the service
 * side has something to do, and a skeleton must not promise an alert that may
 * never materialize.
 */
export const InstallationLoadingView = ({ provider, railRows }: InstallationLoadingViewProps) => (
  <div aria-busy="true" aria-live="polite" aria-label={`${provider} 설치 상태 확인 중`}>
    <div className={cn('grid grid-cols-[224px_minmax(0,1fr)] rounded-xl border overflow-hidden', borderColors.light)}>
      {/* 레일 — 24px 인덱스 원 + 제목, 두 번째 줄은 상태·주체(pl-[34px] 정렬) */}
      <div className={cn('flex flex-col gap-0.5 p-2 border-r', bgColors.panel, borderColors.light)}>
        {Array.from({ length: railRows }).map((_, i) => (
          <div key={i} className="flex flex-col gap-1 px-2.5 py-2">
            <div className="flex items-start gap-2.5">
              <Bar tone={RAIL_BAR} className="h-6 w-6 flex-shrink-0 rounded-full" />
              <Bar tone={RAIL_BAR} className="mt-1 h-3.5 flex-1 rounded" />
            </div>
            <Bar tone={RAIL_BAR} className="ml-[34px] h-3 w-24 rounded" />
          </div>
        ))}
      </div>

      {/* 우측 — 제목/부제(tight 4px) 뒤 mt-4 지표 카드 하나 */}
      <div className="min-w-0 px-5 py-4">
        <div className={cn('flex flex-col', stackGap.tight)}>
          <Bar className="h-5 w-40 rounded" />
          <Bar className="h-3.5 w-[68%] rounded" />
        </div>
        <div className={cn('mt-4 rounded-xl border px-5 py-4 flex flex-col', stackGap.related, borderColors.light)}>
          <div className="flex items-start gap-8">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <Bar className="h-6 w-8 rounded" />
                <Bar className="h-3 w-12 rounded" />
              </div>
            ))}
          </div>
          <Bar className="h-3 w-52 rounded" />
        </div>
      </div>
    </div>
  </div>
);
