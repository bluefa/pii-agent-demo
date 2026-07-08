/**
 * StatusPill — pipeline + task status badge (design-inventory §3 `.pill.s-*`).
 * Renders the wire status verbatim (uppercase). `lg` = statusbar size (h28).
 * READY is PRIMARY per the prototype CSS.
 */
import type { ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { Icon, type IconName } from '@/app/integration/admin/pipelines/_components/icons';
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
      <Icon name={pill.icon[status] as IconName} size="sm" />
      {status}
    </span>
  );
}
