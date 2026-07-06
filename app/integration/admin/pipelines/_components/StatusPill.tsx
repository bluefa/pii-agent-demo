/**
 * StatusPill — pipeline + task status badge (design-inventory §3 `.pill.s-*`).
 * Renders the wire status verbatim (uppercase). RUNNING / IN_PROGRESS pulse the
 * dot. `lg` = statusbar size (h28). READY is PRIMARY per the prototype CSS.
 */
import type { ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import type { PipelineStatus, TaskStatus } from '@/lib/pipeline/types';

export type PillStatus = PipelineStatus | TaskStatus;

const PULSING: readonly PillStatus[] = ['RUNNING', 'IN_PROGRESS'];

export interface StatusPillProps {
  status: PillStatus;
  size?: 'md' | 'lg';
  className?: string;
}

export function StatusPill({ status, size = 'md', className }: StatusPillProps): ReactElement {
  const { pill } = pipelineStyles;
  const lg = size === 'lg';
  return (
    <span className={cn(pill.base, lg ? pill.lg : pill.md, pill.tone[status], className)}>
      <span
        className={cn(
          pill.dot,
          lg ? pill.dotLg : pill.dotMd,
          pill.dotTone[status],
          PULSING.includes(status) && pill.dotPulse,
        )}
      />
      {status}
    </span>
  );
}
