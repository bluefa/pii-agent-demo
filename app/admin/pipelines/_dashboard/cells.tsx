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
import { fmtDateTime, fmtRelativeTime } from '@/lib/pipeline/format';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { ProvTag } from '@/app/admin/pipelines/_components/ProvTag';
import type { CloudProvider, PipelineStatus } from '@/lib/pipeline/types';

const { dashboard: d } = pipelineStyles;

/**
 * Which target this row is, in one column and two lines: the service name, then
 * the code chip, the Target Source number, and the provider mark.
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
  return (
    <span className={d.identity}>
      <span className={d.identityName}>{name}</span>
      <span className={d.identityMeta}>
        <span className={d.identityCode}>{code}</span>
        <span className={d.identityTarget}>#{targetId}</span>
        <ProvTag provider={provider} isSdu={isSdu} tone="link" />
      </span>
    </span>
  );
}

/** The row's leading 3px. Painted for FAILED only — see the token comment. */
export function StatusRail({ status }: { status: PipelineStatus }): ReactElement {
  return <td className={cn(d.railCell, status === 'FAILED' && d.railErr)} />;
}

/** Status with the chip taken off — colour is all that is left of the pill. */
export function StatusText({ status }: { status: PipelineStatus }): ReactElement {
  return <span className={cn(d.statusText, d.statusTextTone[status])}>{status}</span>;
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
      <Icon name="arrow-ur" size="sm" />
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
