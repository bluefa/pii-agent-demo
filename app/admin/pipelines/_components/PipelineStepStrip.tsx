/**
 * PipelineStepStrip — one segment per task instead of one fill for the whole run.
 *
 * PipelineProgressBar answers HOW MUCH is done. This answers WHICH step you are
 * on, which is the only way a list row can say "step 2 of 4 is where it failed"
 * without opening the run.
 *
 * Colour marks the step the run is SITTING ON, and nothing else (오너 2026-08-14,
 * "색상이 강하지 않게"): blue while it runs, red where it failed, neutral grey for
 * every step already done and lighter grey for every step not reached. The earlier
 * rule painted finished steps green, which put 62% of the table's coloured area on
 * the one thing needing no action. See the token comment for the reversal.
 */
import type { ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { PipelineProgressBar } from '@/app/admin/pipelines/_components/PipelineProgressBar';
import type { PipelineStatus, TaskStatus } from '@/lib/pipeline/types';

/**
 * Above this the segments are thinner than the 2px gaps between them, so the
 * strip stops reading as steps. 8 × (110px − 7 gaps) still gives each one 12px.
 */
const STRIP_MAX = 8;

export interface PipelineStepStripProps {
  n: number;
  m: number;
  status?: PipelineStatus | TaskStatus;
  className?: string;
}

function segTone(index: number, n: number, status?: PipelineStatus | TaskStatus): string {
  const { progress } = pipelineStyles;
  // Every finished step is neutral, cancelled or not. The branch that used to
  // grey out a cancelled run's steps existed to keep green from claiming success
  // on a run that never had it; with green gone there is nothing to separate.
  if (index < n) return progress.stripOk;
  if (index > n) return progress.stripRest;
  // The step the run is sitting on. PENDING has not entered it and CANCELLED
  // stopped before it, so for those it is still bare track.
  if (status === 'FAILED') return progress.fillErr;
  if (status === 'RUNNING' || status === 'IN_PROGRESS') return progress.stripActive;
  return progress.stripRest;
}

/** Says which step, then the tally — the count alone was all the old cell had. */
function caption(n: number, m: number, status?: PipelineStatus | TaskStatus): string {
  const tally = `${n}/${m}`;
  if (n >= m) return tally;
  if (status === 'FAILED') return `${n + 1}단계에서 실패 · ${tally}`;
  if (status === 'RUNNING' || status === 'IN_PROGRESS') return `${n + 1}단계 진행 중 · ${tally}`;
  if (status === 'PENDING') return `시작 대기 · ${tally}`;
  return tally;
}

export function PipelineStepStrip({
  n,
  m,
  status,
  className,
}: PipelineStepStripProps): ReactElement {
  const { progress } = pipelineStyles;
  // Nothing to cut into segments, or too many to tell apart — fall back to the
  // summary bar this is a variant of rather than drawing an unreadable strip.
  if (m < 1 || m > STRIP_MAX) {
    return <PipelineProgressBar n={n} m={m} status={status} className={className} />;
  }
  return (
    <span className={cn(progress.stripWrap, className)}>
      <span className={progress.strip} role="img" aria-label={`${m}단계 중 ${n}단계 완료`}>
        {Array.from({ length: m }, (_, index) => (
          <span key={index} className={cn(progress.stripSeg, segTone(index, n, status))} />
        ))}
      </span>
      <span className={progress.stripCaption}>{caption(n, m, status)}</span>
    </span>
  );
}
