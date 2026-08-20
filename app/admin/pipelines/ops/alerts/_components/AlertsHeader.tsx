'use client';

/**
 * 운영 알림 머리 — 총계 문장과 버킷 타일 넷.
 *
 * 타일은 이제 **링크**다 (`?kind=…`). 필터가 주소를 바꾸므로 버킷 하나를 그대로
 * 공유할 수 있고, 행을 열었다 뒤로 오면 보던 버킷으로 돌아온다. 클라이언트 state
 * 였을 때는 셋 다 안 됐다.
 *
 * `<button aria-pressed>` 이 아니라 `<Link aria-current>` 인 이유도 같다 — 누르면
 * 주소가 바뀌는 것은 버튼이 아니라 링크의 일이고, 가운데 클릭으로 새 탭에 여는
 * 것까지 공짜로 따라온다.
 *
 * 이 파일이 클라이언트인 것은 `useTransition`(전환 중 흐리게) 하나 때문이다. 서버
 * 왕복이 끼는 이상 누른 타일이 아무 반응도 없는 구간이 생기는데, 표만 스켈레톤이
 * 되면 "내가 누른 게 먹혔나"는 답이 안 된다.
 */
import Link from 'next/link';
import { useTransition, type ReactElement } from 'react';

import { cn, pipelineStyles } from '@/lib/theme';
import { passRoutes } from '@/lib/routes';
import type { AlertTargetKind } from '@/lib/types/task-queue';
import { ALERT_BUCKETS, type AlertCounts } from '@/app/admin/pipelines/ops/alerts/_components/buckets';

const alertsHeader = {
  head: 'flex items-start justify-between gap-6',
  context: 'mt-1 text-[14px] leading-[1.4] text-[var(--pl-text-weak)]',
  contextTotal: 'mx-0.5 align-baseline text-[32px] font-bold leading-none text-[var(--pl-primary)]',
  summaryRow: 'mt-6 grid grid-cols-4 gap-4',
  /**
   * border 는 비활성일 때도 자리를 차지해야 선택 시 타일 크기가 흔들리지 않는다.
   * border 색과 배경은 idle/active 가 배타적으로 소유한다 — cn 은 단순 join 이라
   * 같은 속성을 두 번 실으면 Tailwind 출력 순서가 승자를 정해버린다.
   */
  summary:
    'flex h-[120px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[8px] border transition-colors',
  /** hover 는 idle 에만 — active 위에 얹으면 hover 가 브랜드 스트로크를 덮는다. */
  summaryIdle:
    'border-transparent bg-[var(--pl-gray-100)] hover:border-[var(--pl-gray-300)] hover:bg-[var(--pl-gray-200)]',
  /** Selected = white face + brand stroke + sm shadow — the pipelines dashboard
   *  `bucketTileActive` levers, so "this tile filters the list" reads the same
   *  way in both screens. */
  summaryActive: 'border-[var(--pl-primary)] bg-[var(--pl-bg-card)] shadow-[var(--pl-shadow-sm)]',
  summaryLabel: 'text-[14px] leading-[1.4] text-[var(--pl-text-weak)]',
  summaryValue:
    'text-[40px] font-bold leading-[1.2] tracking-[-0.02em] tabular-nums text-[var(--pl-text-strong)]',
  summaryNeed: 'text-[12px] leading-[1.4] text-[var(--pl-text-weak)]',
  /** 전환 중 — 타일은 계속 누를 수 있게 두고 불투명도만 내린다. 막아 버리면
   *  잘못 누른 버킷을 되돌리려고 두 번째로 누르는 것이 막힌다. */
  pending: 'opacity-60 transition-opacity',
} as const;

export function AlertsHeader({
  total,
  counts,
  selected,
}: {
  total: number;
  counts: AlertCounts;
  selected: AlertTargetKind;
}): ReactElement {
  const [isPending, startTransition] = useTransition();

  return (
    <div className={isPending ? alertsHeader.pending : undefined}>
      <div className={alertsHeader.head}>
        <div>
          <h1 className={pipelineStyles.text.pageTitle}>운영 알림</h1>
          <p className={alertsHeader.context}>
            PII Agent 설치 운영 인력이 확인해야 될 사항이 총
            <strong className={alertsHeader.contextTotal}>{total}</strong>개 있어요
          </p>
        </div>
      </div>

      <div className={alertsHeader.summaryRow} role="group" aria-label="운영 알림 버킷 필터">
        {ALERT_BUCKETS.map((bucket) => {
          const active = selected === bucket.kind;
          return (
            <Link
              key={bucket.kind}
              // page 는 싣지 않는다 — 버킷을 바꾸는 것은 다른 목록을 여는 일이라
              // 이전 버킷의 페이지 번호를 가져가면 남의 자리를 가리킨다.
              href={`${passRoutes.pipelines.ops.alerts}?kind=${bucket.kind}`}
              aria-current={active ? 'true' : undefined}
              onClick={() => startTransition(() => {})}
              className={cn(
                alertsHeader.summary,
                active ? alertsHeader.summaryActive : alertsHeader.summaryIdle,
              )}
            >
              <span className={alertsHeader.summaryLabel}>{bucket.label}</span>
              <span className={alertsHeader.summaryValue}>{bucket.count(counts) ?? 0}</span>
              <span className={alertsHeader.summaryNeed}>{bucket.need}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
