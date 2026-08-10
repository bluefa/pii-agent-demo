/**
 * PipelineStepStrip — one segment per task instead of one fill for the whole run.
 *
 * PipelineProgressBar answers HOW MUCH is done. This answers WHICH step you are
 * on, which is the only way a list row can say "step 2 of 4 is where it failed"
 * without opening the run.
 *
 * Steps are coloured — green finished, blue current, red failed, grey untouched
 * (owner: "완료된건 초록색, 현재 진행중인건 파란색"). That is a deliberate exception to
 * the section's monochrome status ramp, and the exception is what makes the strip
 * work: a pill carries one status, but three neighbouring 12px blocks carrying
 * three different ones cannot be told apart by weight. See the token comment.
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
  // A cancelled run's finished steps stay grey: they ran, but the run did not
  // succeed, and green here would read as one that did.
  if (index < n) return status === 'CANCELLED' ? progress.fillOff : progress.stripOk;
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
