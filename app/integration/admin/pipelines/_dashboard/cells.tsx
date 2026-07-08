/**
 * Dashboard list cell presenters (Figma Make redesign) — page.tsx-exclusive.
 *
 * These deliberately do NOT reuse the shared StatusPill / PipelineProgressBar /
 * ProvTag / PlTable (those keep their pill/colored look on the detail pages).
 * The dashboard row is a distinct visual language: #id chip, dot+text status,
 * gray progress, plain cloud text, relative time with a hover tooltip, and a
 * hover-reveal dark action button. All classes route through `dashboard.*`
 * tokens (no raw colors).
 */
import type { ReactElement, ReactNode } from 'react';

import { cn, pipelineStyles } from '@/lib/theme';
import { fmtDateTime, fmtRelativeTime, providerLabel } from '@/lib/pipeline/format';
import { Icon, type IconName } from '@/app/integration/admin/pipelines/_components/icons';
import type { CloudProvider, PipelineStatus, PipelineType } from '@/lib/pipeline/types';

const { dashboard: d } = pipelineStyles;

const TYPE_ICON: Record<PipelineType, IconName> = {
  INSTALL: 'install',
  DELETE: 'trash',
  CUSTOM: 'sliders',
};

/** Service column — service name over a mono "{code} · #{targetId}" meta line. */
export function ServiceCell({
  code,
  name,
  targetId,
}: {
  code: string;
  name: string;
  targetId: string;
}): ReactElement {
  return (
    <span className={d.serviceCell}>
      <span className={d.serviceName}>{name}</span>
      <span className={d.serviceMeta}>
        {code} · #{targetId}
      </span>
    </span>
  );
}

/** Cloud provider — plain medium text (no brand dot). */
export function CloudText({ provider }: { provider: CloudProvider | string }): ReactElement {
  return <span className={d.cloudText}>{providerLabel(provider)}</span>;
}

/** Pipeline type — icon + enum text. */
export function TypeCell({ type }: { type: PipelineType }): ReactElement {
  return (
    <span className={d.typeCell}>
      <Icon name={TYPE_ICON[type]} size="sm" />
      {type}
    </span>
  );
}

/** Status — colored dot + wire status text (no pill). */
export function StatusDot({ status }: { status: PipelineStatus }): ReactElement {
  const tone = d.statusTone[status] ?? d.statusTone.CANCELLED;
  return (
    <span className={cn(d.status, tone.text)}>
      <span className={cn(d.statusDot, tone.dot)} />
      {status}
    </span>
  );
}

/** Progress — gray track + gray fill + N/M count. */
export function GrayProgress({ n, m }: { n: number; m: number }): ReactElement {
  const pct = m === 0 ? 0 : Math.round((n / m) * 100);
  return (
    <span className={d.progressWrap}>
      <span className={d.progressTrack}>
        <span className={d.progressFill} style={{ width: `${pct}%` }} />
      </span>
      <span className={d.progressCount}>
        {n}/{m}
      </span>
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
