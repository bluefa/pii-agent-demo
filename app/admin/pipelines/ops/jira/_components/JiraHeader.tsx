'use client';

/**
 * Jira Ticket 머리 — 총계 문장과 버킷 타일 둘.
 *
 * 운영 알림 머리(AlertsHeader)와 같은 문법이다: 타일은 `?kind=` 링크라 버킷 하나를
 * 공유할 수 있고, 뒤로 오면 보던 버킷으로 돌아온다. 4열 그리드에 두 칸만 찬다 —
 * 타일 폭이 운영 알림과 같아야 두 화면이 한 콘솔로 읽힌다.
 */
import Link, { useLinkStatus } from 'next/link';
import type { ReactElement } from 'react';

import { cn, pipelineStyles } from '@/lib/theme';
import { passRoutes } from '@/lib/routes';
import type { JiraAlertKind } from '@/lib/types/task-queue';
import { alertsHeader } from '@/app/admin/pipelines/ops/alerts/_components/alertsHeaderStyles';
import {
  JIRA_BUCKETS,
  type JiraBucketIcon,
  type JiraCounts,
} from '@/app/admin/pipelines/ops/jira/_components/jiraBuckets';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { JiraLogo } from '@/app/admin/pipelines/_components/brandMarks';

export function JiraBucketGlyph({ icon, size }: { icon: JiraBucketIcon; size: number }): ReactElement {
  return icon === 'jira' ? <JiraLogo size={size} /> : <Icon name={icon} size={size} />;
}

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
  icon: JiraBucketIcon;
}): ReactElement {
  const { pending } = useLinkStatus();
  return (
    <span className={cn(alertsHeader.face, pending && alertsHeader.pending)}>
      <span className={alertsHeader.summaryLabel}>
        <span className={alertsHeader.summaryLabelGlyph}>
          <JiraBucketGlyph icon={icon} size={18} />
        </span>
        {label}
      </span>
      <span className={alertsHeader.summaryValue}>{count ?? '—'}</span>
      <span className={alertsHeader.summaryNeed}>{need}</span>
    </span>
  );
}

export function JiraHeader({
  total,
  counts,
  selected,
}: {
  /** null = 요약을 못 읽었다. 0 건이 아니라 모른다는 뜻이라 문장 자체가 바뀐다. */
  total: number | null;
  counts: JiraCounts | null;
  selected: JiraAlertKind;
}): ReactElement {
  return (
    <>
      <div className={alertsHeader.head}>
        <div>
          <h1 className={pipelineStyles.text.pageTitle}>Jira Ticket</h1>
          {total === null ? (
            <p className={alertsHeader.context}>
              확인해야 될 사항의 건수를 불러오지 못했어요. 아래 목록은 그대로 볼 수 있어요.
            </p>
          ) : (
            <p className={alertsHeader.context}>
              자동 생성한 Jira 티켓 중 관리자가 직접 처리해야 할 대상이 총
              <strong className={alertsHeader.contextTotal}>{total}</strong>개 있어요
            </p>
          )}
        </div>
      </div>

      <div className={alertsHeader.summaryRow} role="group" aria-label="Jira Ticket 버킷 필터">
        {JIRA_BUCKETS.map((bucket) => {
          const active = selected === bucket.kind;
          return (
            <Link
              key={bucket.kind}
              href={`${passRoutes.pipelines.ops.jira}?kind=${bucket.kind}`}
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
