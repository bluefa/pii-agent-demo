/**
 * DelayText — the monitor "지연" cell: a humanized Korean elapsed duration with a
 * 4-tier tone ramp (design spec §1 / prototype `humanDelay` + `.delay.d1/2/3`).
 * Thresholds are the prototype's assumption — <1h weak, ≥1h/≥1d/≥7d escalate.
 * The raw second count rides in `title` for exact inspection; tabular-nums keeps
 * columns aligned.
 */
import type { ReactElement } from 'react';
import { cn } from '@/lib/theme';
import { tqStyles } from '@/app/admin/pipelines/queue/_components/tqStyles';

const HOUR = 3600;
const DAY = 86400;
const WEEK = 604800;

type DelayTier = 'd0' | 'd1' | 'd2' | 'd3';

/** Threshold tier — d0 <1h · d1 ≥1h · d2 ≥1d · d3 ≥7d. */
export function delayTier(seconds: number): DelayTier {
  if (seconds >= WEEK) return 'd3';
  if (seconds >= DAY) return 'd2';
  if (seconds >= HOUR) return 'd1';
  return 'd0';
}

/** Humanize an elapsed second count to Korean (e.g. "1일 3시간", "18분", "42초"). */
export function humanizeDelay(seconds: number): string {
  if (seconds < 60) return `${seconds}초`;
  if (seconds < HOUR) return `${Math.floor(seconds / 60)}분`;
  if (seconds < DAY) {
    const h = Math.floor(seconds / HOUR);
    const m = Math.floor((seconds % HOUR) / 60);
    return m ? `${h}시간 ${m}분` : `${h}시간`;
  }
  const d = Math.floor(seconds / DAY);
  const h = Math.floor((seconds % DAY) / HOUR);
  return h ? `${d}일 ${h}시간` : `${d}일`;
}

export interface DelayTextProps {
  /** Elapsed seconds since the last status change. */
  delaySeconds: number;
  className?: string;
}

export function DelayText({ delaySeconds, className }: DelayTextProps): ReactElement {
  const { delay } = tqStyles;
  const tier = delayTier(delaySeconds);
  return (
    <span
      className={cn(delay.base, delay.tone[tier], className)}
      title={`${delaySeconds.toLocaleString()}s`}
    >
      {humanizeDelay(delaySeconds)}
    </span>
  );
}
