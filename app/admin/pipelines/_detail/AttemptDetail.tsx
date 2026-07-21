/**
 * Attempt drill-down body: attempt info + the Terraform Job list (results ∪
 * states) + poll summary + the raw response fold. Each job row opens the
 * log/state viewer.
 *
 * NOTE: `attempt.failure_detail` stays out of the default UI while the attempt
 * has job rows — failure is conveyed by the compact error_code chip and the
 * cause is reachable through the per-job log viewer. The exception is a FAILED
 * attempt with NO job rows (e.g. the terraform dispatch call itself failed):
 * there is no job row, hence no log-viewer entry point, so the "실패 원인" block
 * below surfaces `failure_detail` — the only cause the client has — in its place.
 */
import { type ReactElement } from 'react';
import { jobRows, jobVerdict, type JobRow } from '@/app/admin/pipelines/_detail/jobRows';
import { fmtDateTime } from '@/lib/pipeline/format';
import { d, j, MiniPill, Section, spanLabel, type ViewerTarget } from '@/app/admin/pipelines/_detail/taskDrawerShared';
import type { TaskAttemptView, TaskOperation } from '@/lib/pipeline/types';

function JobRowItem(
  { row, operation, onOpen }: { row: JobRow; operation: TaskOperation | null; onOpen: () => void },
): ReactElement {
  const verdict = jobVerdict(row, operation);
  return (
    <div className={j.jobRow}>
      <MiniPill tone={verdict}>{j.verdictLabel[verdict]}</MiniPill>
      <span className={j.jobId}>{row.job_id}</span>
      <button
        type="button"
        className={j.logBtn}
        onClick={onOpen}
        aria-label={`TerraformJob ${row.job_id} 로그 열기`}
      >
        로그 보기
      </button>
    </div>
  );
}

export function AttemptDetail({
  attempt,
  operation,
  onOpenViewer,
}: {
  attempt: TaskAttemptView;
  operation: TaskOperation | null;
  onOpenViewer: (t: ViewerTarget) => void;
}): ReactElement {
  const rows = jobRows(attempt);

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

      {rows.length > 0 ? (
        <Section label="Terraform Job">
          <div className={j.listTight}>
            {rows.map((row) => (
              <JobRowItem
                key={row.job_id}
                row={row}
                operation={operation}
                onOpen={() => onOpenViewer({ attemptNumber: attempt.attempt_number, jobId: row.job_id })}
              />
            ))}
          </div>
        </Section>
      ) : attempt.status === 'FAILED' ? (
        <Section label="실패 원인">
          <p className={d.failReason}>{attempt.failure_detail ?? attempt.error_code ?? '원인 미기록'}</p>
        </Section>
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
