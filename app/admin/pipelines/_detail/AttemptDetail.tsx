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
 * A long cause is clamped to a preview with a "자세히" button that opens the full
 * text in FailureReasonModal (`onOpenFailure`).
 */
import { useState, type ReactElement } from 'react';
import { PlPagination } from '@/app/admin/pipelines/_components/PlPagination';
import { jobRows, jobVerdict, type JobRow } from '@/app/admin/pipelines/_detail/jobRows';
import { fmtDateTime } from '@/lib/pipeline/format';
import { d, j, MiniPill, Section, spanLabel, type ViewerTarget } from '@/app/admin/pipelines/_detail/taskDrawerShared';
import type { TaskAttemptView, TaskOperation } from '@/lib/pipeline/types';

/** A single attempt can hold 20+ terraform jobs — page the list so the drawer stays scannable. */
const JOBS_PER_PAGE = 5;

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
  onOpenFailure,
}: {
  attempt: TaskAttemptView;
  operation: TaskOperation | null;
  onOpenViewer: (t: ViewerTarget) => void;
  onOpenFailure: (detail: string) => void;
}): ReactElement {
  const rows = jobRows(attempt);
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(rows.length / JOBS_PER_PAGE));
  // Clamp — a poll refresh can shrink the list under the current page.
  const shownPage = Math.min(page, pages);
  const shownRows = rows.slice((shownPage - 1) * JOBS_PER_PAGE, shownPage * JOBS_PER_PAGE);
  const failureCause = attempt.failure_detail ?? attempt.error_code ?? '원인 미기록';
  // A dispatch-failure detail (Feign message) can run to ~512 chars; clamp the inline
  // preview and offer the full text in FailureReasonModal.
  const failureIsLong = (attempt.failure_detail?.length ?? 0) > 120;

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
        <Section label="Terraform Job" hint={rows.length > JOBS_PER_PAGE ? `총 ${rows.length}개` : undefined}>
          <div className={j.listTight}>
            {shownRows.map((row) => (
              <JobRowItem
                key={row.job_id}
                row={row}
                operation={operation}
                onOpen={() => onOpenViewer({ attemptNumber: attempt.attempt_number, jobId: row.job_id })}
              />
            ))}
          </div>
          {pages > 1 && (
            <PlPagination
              page={shownPage}
              pages={pages}
              onPrev={() => setPage(shownPage - 1)}
              onNext={() => setPage(shownPage + 1)}
              center
            />
          )}
        </Section>
      ) : attempt.status === 'FAILED' ? (
        <Section label="실패 원인">
          <p className={failureIsLong ? d.failReasonClamp : d.failReason}>{failureCause}</p>
          {failureIsLong && (
            <button type="button" className={d.failReasonMore} onClick={() => onOpenFailure(failureCause)}>
              자세히
            </button>
          )}
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
