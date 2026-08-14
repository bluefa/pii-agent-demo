/**
 * Attempt drill-down body: attempt info + this attempt's Job 현황 (JobStatus) +
 * poll summary + the raw response fold. Each job row opens the log/state viewer.
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
  spanLabel,
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
      <Section label="시도 정보">
        <div className={d.rowsGap}>
          <div className={d.kvRow}>
            <span className={d.kvKey}>Started</span>
            <span className={d.kvVal}>{fmtDateTime(attempt.started_at)}</span>
          </div>
          <div className={d.kvRow}>
            <span className={d.kvKey}>Finished</span>
            <span className={d.kvVal}>{fmtDateTime(attempt.finished_at)}</span>
          </div>
          {attempt.finished_at && (
            <div className={d.kvRow}>
              <span className={d.kvKey}>소요</span>
              <span className={d.kvVal}>{spanLabel(attempt.started_at, attempt.finished_at) || '—'}</span>
            </div>
          )}
        </div>
      </Section>

      {hasJobs ? (
        <JobStatus
          attempt={attempt}
          operation={operation}
          onOpenJob={(jobId) => onOpenViewer({ attemptNumber: attempt.attempt_number, jobId })}
        />
      ) : attempt.status === 'FAILED' ? (
        <FailureCause attempt={attempt} onOpenFailure={onOpenFailure} />
      ) : null}

      {attempt.check && (
        <Section label="확인 요약">
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
        </Section>
      )}

      {attempt.response && (
        <details className={j.respFold} open>
          <summary className={j.respSummary}>
            <span className={j.respTri} aria-hidden="true">▼</span>Response 원문
          </summary>
          <pre className={j.respPre}>{attempt.response}</pre>
        </details>
      )}
    </>
  );
}
