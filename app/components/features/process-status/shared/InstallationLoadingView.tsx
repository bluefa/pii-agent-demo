'use client';

import { bgColors, borderColors, cn, idcStyles, stackGap } from '@/lib/theme';

type InstallationLoadingViewProps = { provider: string } & (
  | {
      /** Mirror the grouped rail frame (bordered container + 224px rail + fixed 560px). */
      grouped: true;
      railRows?: never;
    }
  | {
      grouped?: false;
      /**
       * Rail rows to draw = 설치 현황 요약 + the provider's steps. A hardcoded count
       * reflows the card on data arrival — exactly what the skeleton exists to stop.
       */
      railRows: number;
    }
);

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
 * `grouped` mirrors the grouped-rail frame (AWS); the default mirrors the
 * legacy frame: 224px rail on bgColors.panel, borderColors.light container,
 * px-5 py-4 right pane, one bordered stats card, bar heights = the real
 * tokens' line-heights — so nothing shifts horizontally and the stats card
 * keeps its y. A skeleton that only approximates the frame reintroduces the
 * reflow it exists to prevent.
 *
 * The card's total HEIGHT still changes on arrival, deliberately: the action
 * banner is not drawn, because it only appears when the service side has
 * something to do, and a skeleton must not promise an alert that may never
 * materialize. Nor is the step description's second line, which wraps or not
 * depending on the provider's copy.
 */
export const InstallationLoadingView = (props: InstallationLoadingViewProps) =>
  props.grouped ? (
    <div
      aria-busy="true"
      aria-live="polite"
      aria-label={`${props.provider} 설치 상태 확인 중`}
      className="flex flex-col gap-3"
    >
      {/* last-check caption — right aligned, no title (the card header carries it) */}
      <div className="flex justify-end">
        <Bar className="h-4 w-44 rounded" />
      </div>
      <div
        className={cn(
          'grid grid-cols-[224px_minmax(0,1fr)] rounded-xl border overflow-hidden h-[560px]',
          borderColors.light,
        )}
      >
        {/* rail — 그룹 머리글은 항상 둘이다(내가 할 일 / BDC 진행).
            항목 수 1/3 은 AWS 자동 설치의 모양이고 나머지는 다르다(Azure 3/1,
            GCP·IDC 1/2, AWS 수동 1/2). 프로바이더별로 맞추지 않는 이유는 프레임
            높이가 h-[560px] 로 고정이라 레일 안에서 바가 움직여도 카드를 밀지
            못하기 때문이다 — 이 근사는 reflow 를 만들지 않는다. */}
        <div className={cn('flex flex-col gap-0.5 p-2 border-r', bgColors.panel, borderColors.light)}>
          {[1, 3].map((rows, group) => (
            <div key={group} className="flex flex-col gap-0.5">
              <Bar tone={RAIL_BAR} className="mx-2.5 mt-3 mb-1 h-3 w-24 rounded" />
              {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="flex items-center gap-2 px-3.5 py-2">
                  <Bar tone={RAIL_BAR} className="h-3.5 flex-1 rounded" />
                  <Bar tone={RAIL_BAR} className="h-3 w-8 flex-shrink-0 rounded" />
                </div>
              ))}
            </div>
          ))}
        </div>
        {/* content cell — fixed header, table-row body, on the card's own white */}
        <div className="min-w-0 flex flex-col">
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
    <div aria-busy="true" aria-live="polite" aria-label={`${props.provider} 설치 상태 확인 중`}>
      <div className={cn('grid grid-cols-[224px_minmax(0,1fr)] rounded-xl border overflow-hidden', borderColors.light)}>
        {/* 레일 — 24px 인덱스 원 + 제목, 두 번째 줄은 상태·주체(pl-[34px] 정렬) */}
        <div className={cn('flex flex-col gap-0.5 p-2 border-r', bgColors.panel, borderColors.light)}>
          {Array.from({ length: props.railRows }).map((_, i) => (
            <div key={i} className="flex flex-col gap-1 px-2.5 py-2">
              <div className="flex items-start gap-2.5">
                <Bar tone={RAIL_BAR} className="h-6 w-6 flex-shrink-0 rounded-full" />
                <Bar tone={RAIL_BAR} className="mt-1 h-3.5 flex-1 rounded" />
              </div>
              {/* 상태·주체 한 줄 = caption 16px */}
              <Bar tone={RAIL_BAR} className="ml-[34px] h-4 w-24 rounded" />
            </div>
          ))}
        </div>

        {/* 우측 — 제목/부제(tight 4px) 뒤 mt-4 지표 카드 하나 */}
        <div className="min-w-0 px-5 py-4">
          {/* 바 높이는 자리 채우는 값이 아니라 실제 토큰의 line-height다 —
              cardTitle 24px, caption 16px. 어긋나면 아래 지표 카드가 위아래로 뛴다. */}
          <div className={cn('flex flex-col', stackGap.tight)}>
            <Bar className="h-6 w-40 rounded" />
            <Bar className="h-4 w-[68%] rounded" />
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
            {/* 마지막 확인 시각 = caption 16px */}
            <Bar className="h-4 w-52 rounded" />
          </div>
        </div>
      </div>
    </div>
  );
