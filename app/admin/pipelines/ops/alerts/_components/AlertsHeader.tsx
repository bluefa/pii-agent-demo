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
 * 이 파일이 클라이언트인 것은 `useLinkStatus`(전환 중 흐리게) 하나 때문이다. 서버
 * 왕복이 끼는 이상 누른 타일이 아무 반응도 없는 구간이 생기는데, 표만 스켈레톤이
 * 되면 "내가 누른 게 먹혔나"는 답이 안 된다.
 */
import Link, { useLinkStatus } from 'next/link';
import type { ReactElement } from 'react';

import { cn, pipelineStyles } from '@/lib/theme';
import { passRoutes } from '@/lib/routes';
import type { AlertTargetKind } from '@/lib/types/task-queue';
import {
  ALERT_BUCKETS,
  type AlertCounts,
  type AlertStageIcon,
} from '@/app/admin/pipelines/ops/alerts/_components/buckets';
import { alertsHeader } from '@/app/admin/pipelines/ops/alerts/_components/alertsHeaderStyles';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { TerraformLogo } from '@/app/admin/pipelines/_components/brandMarks';

/**
 * 누른 타일 하나만 흐려진다. `useLinkStatus` 는 **그 Link 의** 이동이 실제로 진행 중인
 * 동안에만 pending 이라, 아무것도 스케줄하지 않는 빈 transition 과 달리 서버 왕복을
 * 끝까지 따라간다. 값은 Link 의 자식에서만 나오므로 얼굴이 별도 컴포넌트다.
 */
function TileFace({
  label,
  count,
  need,
  icon,
}: {
  label: string;
  /** null = 요약 실패. 자리는 지키되 값은 지어내지 않는다. */
  count: number | null;
  need: string;
  icon: AlertStageIcon;
}): ReactElement {
  const { pending } = useLinkStatus();
  return (
    <span className={cn(alertsHeader.face, pending && alertsHeader.pending)}>
      <span className={alertsHeader.summaryLabel}>
        <span className={alertsHeader.summaryLabelGlyph}>
          {icon === 'terraform' ? <TerraformLogo size={18} /> : <Icon name={icon} size={18} />}
        </span>
        {label}
      </span>
      <span className={alertsHeader.summaryValue}>{count ?? '—'}</span>
      <span className={alertsHeader.summaryNeed}>{need}</span>
    </span>
  );
}

export function AlertsHeader({
  total,
  counts,
  selected,
}: {
  /** null = 요약을 못 읽었다. 0 건이 아니라 **모른다**는 뜻이라 문장 자체가 바뀐다. */
  total: number | null;
  counts: AlertCounts | null;
  selected: AlertTargetKind;
}): ReactElement {
  return (
    <>
      <div className={alertsHeader.head}>
        <div>
          <h1 className={pipelineStyles.text.pageTitle}>운영 알림</h1>
          {total === null ? (
            <p className={alertsHeader.context}>
              확인해야 될 사항의 건수를 불러오지 못했어요. 아래 목록은 그대로 볼 수 있어요.
            </p>
          ) : (
            <p className={alertsHeader.context}>
              PII Agent 설치 운영 인력이 확인해야 될 사항이 총
              <strong className={alertsHeader.contextTotal}>{total}</strong>개 있어요
            </p>
          )}
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
              aria-current={active ? 'page' : undefined}
              className={cn(
                alertsHeader.summary,
                active ? alertsHeader.summaryActive : alertsHeader.summaryIdle,
              )}
            >
              <TileFace
                label={bucket.label}
                count={counts ? (bucket.count(counts) ?? 0) : null}
                need={bucket.need}
                icon={bucket.icon}
              />
            </Link>
          );
        })}
      </div>
    </>
  );
}
