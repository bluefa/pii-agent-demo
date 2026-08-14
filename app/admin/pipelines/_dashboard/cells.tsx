/**
 * Dashboard list cell presenters — page.tsx-exclusive.
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
  fmtDateTime,
  fmtRelativeTime,
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
 * It is the one branded thing here (오너 2026-08-14). This list dropped status colour
 * down to two words per page, which left room for the marks to carry their vendors'
 * own colours — the fastest way to read "which cloud" without a label, and no cost to
 * the status channel because a logo says nothing about how the run is going. IDC and
 * SDU are ours and have no brand, so they stay on the column's grey.
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

/** The row's leading 3px. Painted for FAILED only — see the token comment. */
export function StatusRail({ status }: { status: PipelineStatus }): ReactElement {
  return <td className={cn(d.railCell, status === 'FAILED' && d.railErr)} />;
}

/**
 * Status with the chip taken off, in the section's shared Korean label set
 * (`statusKo`: 대기 / 실행 중 / 완료 / 실패 / 중단).
 *
 * 중단만 마크를 단다 (오너). 완료와 같은 "끝난 상태"인데 초록을 주면 성공했다고
 * 말하게 되고, 회색만 주면 대기와 구별되지 않는다 — 색을 하나 더 쓰는 대신
 * 채널을 하나 더 열었다. 마크는 낱말 색을 그대로 물려받는다.
 */
export function StatusText({ status }: { status: PipelineStatus }): ReactElement {
  return (
    <span className={cn(d.statusWrap, d.statusText, d.statusTextTone[status])}>
      {status === 'CANCELLED' && <Icon name="stop" size="sm" />}
      {statusKo(status)}
    </span>
  );
}

/** Relative time ("3시간 전") with an absolute-time hover tooltip. */
export function RelativeTime({ iso }: { iso: string }): ReactElement {
  return (
    <span className={d.timeWrap}>
      <span className={d.timeText}>{fmtRelativeTime(iso)}</span>
      <span className={d.timeTip}>{fmtDateTime(iso)}</span>
    </span>
  );
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
