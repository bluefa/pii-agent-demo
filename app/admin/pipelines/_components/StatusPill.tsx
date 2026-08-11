/**
 * StatusPill — pipeline + task status badge (design-inventory §3 `.pill.s-*`).
 * Renders the wire status verbatim (uppercase). `lg` = statusbar size (h28).
 *
 * Text only: the state is in the hue now (theme.ts PILL_*), and the glyph that
 * used to carry it made RUNNING read as an outlined button rather than a badge.
 */
import type { ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import type { PipelineStatus, TaskStatus } from '@/lib/pipeline/types';

export type PillStatus = PipelineStatus | TaskStatus;

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
      {status}
    </span>
  );
}
