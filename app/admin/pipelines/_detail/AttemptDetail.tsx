/**
 * Attempt drill-down body: 시도 정보 + the Terraform Job list (results ∪ states)
 * + 폴 요약 + the raw response fold. Each job row opens the log/state viewer.
 */
import { type ReactElement } from 'react';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { jobRows, jobVerdict, type JobRow } from '@/app/admin/pipelines/_detail/jobRows';
import { d, hm, j, MiniPill, Section, spanLabel, type ViewerTarget } from '@/app/admin/pipelines/_detail/taskDrawerShared';
import type { TaskAttemptView } from '@/lib/pipeline/types';

function JobRowItem({ row, onOpen }: { row: JobRow; onOpen: () => void }): ReactElement {
  const verdict = jobVerdict(row);
  const meta = row.result?.created_at
    ? hm(row.result.created_at)
    : row.state
      ? `폴 ${row.state.poll_count}회`
      : '';
  return (
    <div className={j.jobRow}>
      <MiniPill tone={verdict}>{j.verdictLabel[verdict]}</MiniPill>
      <span className={j.jobId}>{row.job_id}</span>
      {meta && <span className={j.jobMeta}>{meta}</span>}
      <span className={meta ? '' : 'ml-auto'}>
        <PlButton variant="secondary" size="sm" onClick={onOpen}>
          로그
        </PlButton>
      </span>
    </div>
  );
}

export function AttemptDetail({
  attempt,
  onOpenViewer,
}: {
  attempt: TaskAttemptView;
  onOpenViewer: (t: ViewerTarget) => void;
}): ReactElement {
  const rows = jobRows(attempt);
  const inProgress = attempt.status === 'IN_PROGRESS';
  const foot = inProgress
    ? '실행 중 로그는 실시간 조회입니다 — 시도가 종결되면 저장본이 남습니다.'
    : '"진행 중" · "기록 없음"은 이 시도가 종결되던 시점의 마지막 관측입니다.';

  return (
    <>
      <Section label="시도 정보">
        <div className={d.rowsGap}>
          <div className={d.kvRow}>
            <span className={d.kvKey}>Started</span>
            <span className={d.kvVal}>{hm(attempt.started_at)}</span>
          </div>
          <div className={d.kvRow}>
            <span className={d.kvKey}>Finished</span>
            <span className={d.kvVal}>{hm(attempt.finished_at)}</span>
          </div>
          {attempt.finished_at && (
            <div className={d.kvRow}>
              <span className={d.kvKey}>소요</span>
              <span className={d.kvVal}>{spanLabel(attempt.started_at, attempt.finished_at) || '—'}</span>
            </div>
          )}
        </div>
      </Section>

      {rows.length > 0 && (
        <Section label="Terraform Job" hint={`— ${rows.length}건`}>
          <div className={j.cardList}>
            {rows.map((row) => (
              <JobRowItem
                key={row.job_id}
                row={row}
                onOpen={() => onOpenViewer({ attemptNumber: attempt.attempt_number, jobId: row.job_id })}
              />
            ))}
            <div className={j.cardFoot}>{foot}</div>
          </div>
        </Section>
      )}

      {attempt.check && (
        <Section label="폴 요약">
          <div className={d.rowsGap}>
            <div className={d.kvRow}>
              <span className={d.kvKey}>폴 횟수</span>
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
              <span className={d.kvVal}>{hm(attempt.check.last_checked_at)}</span>
            </div>
          </div>
        </Section>
      )}

      {attempt.response && (
        <details className={j.respFold}>
          <summary className={j.respSummary}>response 원문 — dispatch 응답, 파싱하지 않음</summary>
          <pre className={j.respPre}>{attempt.response}</pre>
        </details>
      )}
    </>
  );
}
