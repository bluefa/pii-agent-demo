/**
 * One attempt's body — Job 현황 + poll summary + the raw response fold. Each job
 * row opens the log/state viewer. The exec tab renders exactly one of these at a
 * time, for whichever attempt the picker above it selects (owner 2026-08-16); it
 * used to be folded shut inside an attempt-history row.
 *
 * The run window is NOT here: with the fold gone this block is always on screen,
 * and for a single-attempt task it would print the same two timestamps the flow
 * card does. The verdict hero carries it instead, and only from the second
 * attempt on (2차 라운드 rule — the card's values are never repeated).
 *
 * NOTE: `attempt.failure_detail` stays out of the default UI while the attempt
 * has job rows — the per-job rows now carry `last_fail_reason` themselves. The
 * exception is a FAILED attempt with NO job rows (e.g. the terraform dispatch
 * call itself failed): there is no job row, hence no log-viewer entry point, so
 * `FailureCause` surfaces `failure_detail` — the only cause the client has — in
 * its place.
 */
import { type ReactElement } from 'react';
import { JobStatus } from '@/app/admin/pipelines/_detail/JobStatus';
import { fmtDateTime } from '@/lib/pipeline/format';
import {
  d,
  FailureCause,
  j,
  Section,
  type ViewerTarget,
} from '@/app/admin/pipelines/_detail/taskDrawerShared';
import type { TaskAttemptView, TaskOperation } from '@/lib/pipeline/types';

export function AttemptDetail({
  attempt,
  operation,
  onOpenViewer,
  onOpenFailure,
}: {
  attempt: TaskAttemptView;
  operation: TaskOperation | null;
  onOpenViewer: (t: ViewerTarget) => void;
  onOpenFailure: (detail: string) => void;
}): ReactElement {
  const hasJobs = (attempt.job_states?.length ?? 0) + (attempt.terraform_results?.length ?? 0) > 0;

  return (
    <>
      {hasJobs ? (
        <JobStatus
          attempt={attempt}
          operation={operation}
          onOpenJob={(jobId) => onOpenViewer({ attemptNumber: attempt.attempt_number, jobId })}
        />
      ) : !hasJobs && attempt.status === 'FAILED' ? (
        <FailureCause attempt={attempt} onOpenFailure={onOpenFailure} />
      ) : null}

      {/* Folded shut: these are the orchestrator's polling counters for the attempt,
          and the job rows above already say how many times each job was polled.
          Open it when a call errored or timed out — not on the way to the failure. */}
      {attempt.check && (
        <details className={j.respFold}>
          <summary className={d.foldSummary}>
            <span className={j.respTri} aria-hidden="true">▼</span>확인 요약
          </summary>
          <div className={d.rowsGap}>
            <div className={d.kvRow}>
              <span className={d.kvKey}>확인 횟수</span>
              <span className={d.kvVal}>{attempt.check.call_count}회</span>
            </div>
            <div className={d.kvRow}>
              <span className={d.kvKey}>API 오류 / 타임아웃</span>
              <span className={d.kvVal}>
                {attempt.check.api_error_count} / {attempt.check.call_timeout_count}
              </span>
            </div>
            <div className={d.kvRow}>
              <span className={d.kvKey}>마지막 확인</span>
              <span className={d.kvVal}>{fmtDateTime(attempt.check.last_checked_at)}</span>
            </div>
          </div>
        </details>
      )}

      {/* Closed by default — the raw dispatch response is the last thing anyone reads. */}
      {attempt.response && (
        <details className={j.respFold}>
          <summary className={d.foldSummary}>
            <span className={j.respTri} aria-hidden="true">▼</span>Response 원문
          </summary>
          <pre className={j.respPre}>{attempt.response}</pre>
        </details>
      )}
    </>
  );
}
