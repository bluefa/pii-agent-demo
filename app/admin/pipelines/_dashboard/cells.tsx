/**
 * Dashboard list cell presenters — born page.tsx-exclusive; `TargetCell`,
 * `DashRow` and `RowAction` are now also worn by the ops 운영 알림 worklist,
 * which opens the same Target Source and should read the same way.
 *
 * These used to be deliberate LOCAL copies of the shared row parts: a gray
 * progress bar instead of PipelineProgressBar, plain cloud text instead of
 * ProvTag, a private type cell instead of PipelineTypeTag. The result was that
 * a FAILED row here looked like a running one, and a provider looked like
 * nothing at all — while every sibling table in this section said both at a
 * glance. The copies are gone; what is left is what only this list needs
 * (a two-line identity, a relative time with a tooltip, a hover-reveal action).
 */
import type { ReactElement, ReactNode } from 'react';

import { cn, pipelineStyles } from '@/lib/theme';
import {
  displayProvider,
  elapsedMs,
  fmtDateTime,
  fmtElapsedMs,
  providerLabel,
  statusKo,
} from '@/lib/pipeline/format';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { ProviderGlyph } from '@/app/components/ui/CloudProviderIcon';
import type { CloudProvider, PipelineStatus } from '@/lib/pipeline/types';

const { dashboard: d } = pipelineStyles;

/**
 * Which target this row is: the provider mark on the left, then two lines —
 * the Target Source identifier, and the service name under it (오너 2026-08-14).
 *
 * The identifier leads because it is what the row opens and what makes the row
 * unique. The service name repeats across rows — "PII Agent 설치 - 고객 DB" appears
 * three times in one page of mock data — so as the largest text in the column it
 * was the one thing that could not tell two rows apart.
 *
 * The glyph carries an accessible name of its own: alone it is only a shape, and
 * the provider label that used to sit beside it is no longer in the row.
 *
 * It is the one branded thing here (오너 2026-08-14). Status colour is spent on one
 * word per row, which left room for the marks to carry their vendors' own colours —
 * the fastest way to read "which cloud" without a label, and no cost to the status
 * channel because a logo says nothing about how the run is going. IDC and SDU are
 * ours and have no brand, so they stay on the column's grey.
 */
export function TargetCell({
  name,
  code,
  targetId,
  provider,
  isSdu,
}: {
  name: string;
  code: string;
  targetId: string;
  provider: CloudProvider | string;
  isSdu?: boolean;
}): ReactElement {
  const shown = displayProvider(provider, isSdu);
  return (
    <span className={d.identity}>
      <span className={d.identityGlyph} role="img" aria-label={providerLabel(shown)}>
        <ProviderGlyph provider={shown} tone="brand" className={d.identityGlyphMark} />
      </span>
      <span className={d.identityStack}>
        <span className={d.identityHead}>
          <span className={d.identityTarget}>
            Target #<span className={d.identityTargetValue}>{targetId}</span>
          </span>
          <span className={d.identityCode}>
            코드: <span className={d.identityCodeValue}>{code}</span>
          </span>
        </span>
        <span className={d.identityName}>{name}</span>
      </span>
    </span>
  );
}

/**
 * Status with the chip taken off, in the section's shared Korean label set
 * (`statusKo`: 대기 / 실행 중 / 완료 / 실패 / 중단).
 *
 * 중단은 노랑을 받는다 (오너 2026-08-15). 이전에는 색 예산을 아끼려고 마크를 달아
 * 채널을 하나 더 여는 쪽이었는데, 오너가 네 번째 색을 쓰기로 정하면서 그 전제가
 * 사라졌다 — 색이 그 일을 하면 마크는 같은 말을 두 번 하는 것이라 함께 뺐다.
 *
 * 남은 회색은 대기 하나뿐이다. 색이 없다는 것이 이제 "아직 시작하지 않았다"만 뜻한다.
 */
export function StatusText({ status }: { status: PipelineStatus }): ReactElement {
  return (
    <span className={cn(d.statusText, d.statusTextTone[status])}>{statusKo(status)}</span>
  );
}

/**
 * 생성 이후 경과 — 진행도 옆에서 "어디까지 갔나"에 "얼마나 걸렸나"를 붙인다.
 * 라이브 행은 렌더 시점의 시계로 잰다(옆 생성시간 열의 상대시각과 같은 성질 —
 * 폴링이 없으므로 다시 렌더될 때까지 멈춰 있다). 브라우저 시계와 서버 스탬프가
 * 어긋나 음수가 나오면 `fmtElapsedMs`가 '-'로 낮춘다.
 */
export function ElapsedTime({
  status,
  createdAt,
  lastActivityAt,
}: {
  status: PipelineStatus;
  createdAt: string;
  lastActivityAt: string;
}): ReactElement {
  return (
    <span className={d.elapsed}>
      {fmtElapsedMs(elapsedMs(status, createdAt, lastActivityAt))}
    </span>
  );
}

/**
 * 절대 시각 "YYYY-MM-DD HH:mm" (Asia/Seoul, 오너 2026-08-14).
 *
 * 상대시각("3시간 전")과 hover 툴팁이 있던 자리다. 옆에 경과 열이 생기면서 상대시각이
 * 그 열과 같은 축("얼마나 됐나")을 두 번 말하게 됐고, 정작 "언제"는 hover 해야만
 * 보였다 — 두 열이 서로 다른 사실을 말하도록 이쪽을 절대 시각으로 고정한다.
 * 툴팁이 보여 주던 값이 이제 셀 자체라 툴팁도 함께 없앴다.
 */
export function Timestamp({ iso }: { iso: string }): ReactElement {
  return <span className={d.timeText}>{fmtDateTime(iso)}</span>;
}

/** Hover-reveal dark action button (row hover drives the reveal via the group). */
export function RowAction(): ReactElement {
  return (
    <span className={d.action} aria-hidden="true">
      <Icon name="arrow-ur" size={18} />
    </span>
  );
}

/** Keyboard-activatable table row (role=button, Enter/Space) — mirrors PlRow. */
export function DashRow({
  onActivate,
  children,
}: {
  onActivate: () => void;
  children: ReactNode;
}): ReactElement {
  return (
    <tr
      className={d.row}
      role="button"
      tabIndex={0}
      onClick={onActivate}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onActivate();
        }
      }}
    >
      {children}
    </tr>
  );
}
