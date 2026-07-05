/**
 * PipelineProgressBar — N/M task progress (design-inventory §3 `.pbar`).
 * Track 110px (160px `wide`, for status bars). Fill color precedence matches the
 * prototype stylesheet order: FAILED→err, CANCELLED→off, complete(N==M)→ok,
 * else primary. Works off explicit N/M (summary rows have no tasks[]).
 */
import type { ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import type { PipelineStatus, TaskStatus } from '@/lib/pipeline/types';

export interface PipelineProgressBarProps {
  n: number;
  m: number;
  status?: PipelineStatus | TaskStatus;
  /** 160px track (status bars) instead of the default 110px (list cells). */
  wide?: boolean;
  className?: string;
}

function fillClass(n: number, m: number, status?: PipelineStatus | TaskStatus): string {
  const { progress } = pipelineStyles;
  if (status === 'FAILED') return progress.fillErr;
  if (status === 'CANCELLED') return progress.fillOff;
  if (m > 0 && n === m) return progress.fillOk;
  return progress.fillPrimary;
}

export function PipelineProgressBar({
  n,
  m,
  status,
  wide,
  className,
}: PipelineProgressBarProps): ReactElement {
  const { progress } = pipelineStyles;
  const pct = m > 0 ? Math.round((n / m) * 100) : 0;
  return (
    <span className={cn(progress.wrap, className)}>
      <span className={cn(progress.track, wide ? progress.trackWide : progress.trackNarrow)}>
        <span className={cn(progress.fill, fillClass(n, m, status))} style={{ width: `${pct}%` }} />
      </span>
      <span className={progress.label}>
        {n}/{m}
      </span>
    </span>
  );
}
