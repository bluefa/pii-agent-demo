/**
 * The two root tab bodies of the task drawer: Execution info (TerraformExec /
 * ConditionExec) and Definition/contract (DefinitionTab). Split out of
 * TaskDrawer to keep each unit focused (AP-B1).
 */
import { useState, type ReactElement } from 'react';
import { cn } from '@/lib/theme';
import { PipelineStatusBadge } from '@/app/admin/pipelines/_detail/PipelineStatusBadge';
import { fmtDateTime, KIND_POLICY, statusKo } from '@/lib/pipeline/format';
import { JobStatus } from '@/app/admin/pipelines/_detail/JobStatus';
import type { JobVerdict } from '@/app/admin/pipelines/_detail/jobRows';
import {
  conditionVerdict,
  d,
  FailureCause,
  j,
  MiniPill,
  OperatorDescription,
  Section,
  type ViewerTarget,
} from '@/app/admin/pipelines/_detail/taskDrawerShared';
import type { TaskDetail, TaskStatus } from '@/lib/pipeline/types';

/** Task status → the verdict tone it is spoken in (jobStyles.verdictTextTone). */
const STATUS_TONE: Record<TaskStatus, JobVerdict> = {
  DONE: 'success',
  FAILED: 'failed',
  IN_PROGRESS: 'running',
  READY: 'none',
  BLOCKED: 'none',
  CANCELLED: 'none',
};

/**
 * The verdict hero (design-benchmark 2026-08-14 시안 A) — how this task ended,
 * and under which code, before anything else. The progress log that used to open
 * this tab now sits on the flow card (시안 F), so the space it freed says what
 * the card deliberately does not: the judgment, in words. No tinted plate — the
 * tone rides the type and the supporting facts drop a tier (기존 규칙).
 */
function Verdict({
  tone,
  label,
  code,
  facts,
}: {
  tone: JobVerdict;
  label: string;
  code?: string | null;
  facts: ReactElement;
}): ReactElement {
  return (
    <div className={d.verdict}>
      <div className={cn(d.verdictHead, j.verdictTextTone[tone])}>
        <span className={d.verdictDot} aria-hidden="true" />
        {label}
        {code && <span className={d.verdictCode}>{code}</span>}
      </div>
      <p className={d.verdictFacts}>{facts}</p>
    </div>
  );
}

/** Execution info for TERRAFORM_JOB — verdict / job status / attempt history. */
export function TerraformExec({
  detail,
  onOpenAttempt,
  onOpenViewer,
  onOpenFailure,
}: {
  detail: TaskDetail;
  onOpenAttempt: (n: number) => void;
  onOpenViewer: (t: ViewerTarget) => void;
  onOpenFailure: (attemptNumber: number, cause: string) => void;
}): ReactElement {
  // Attempts arrive oldest-first — the root speaks for the latest one.
  const latest = detail.attempts.length > 0 ? detail.attempts[detail.attempts.length - 1] : null;
  const hasJobs = latest
    ? (latest.job_states?.length ?? 0) + (latest.terraform_results?.length ?? 0) > 0
    : false;
  return (
    <>
      <OperatorDescription detail={detail} />
      <Verdict
        tone={STATUS_TONE[detail.status]}
        label={statusKo(detail.status)}
        code={detail.error_code}
        facts={
          <>
            {/* Attempts actually made (attempts.length), not the failure count — a
                task that succeeded on the first run has fail_count 0 but 1 attempt. */}
            시도 {detail.attempts.length}/{detail.effective_max_fail_count}회
            {detail.next_check_at ? ` · 다음 확인 ${fmtDateTime(detail.next_check_at)}` : ''}
          </>
        }
      />

      {latest && hasJobs && (
        <JobStatus
          attempt={latest}
          operation={detail.operation}
          hint={detail.attempts.length > 1 ? `최신 시도 #${latest.attempt_number} 기준` : undefined}
          onOpenJob={(jobId) => onOpenViewer({ attemptNumber: latest.attempt_number, jobId })}
        />
      )}
      {/* No job row means no log viewer to reach — then `failure_detail` is the only
          cause the client has, so it takes the Job 현황 slot instead. */}
      {latest && !hasJobs && latest.status === 'FAILED' && (
        <FailureCause
          attempt={latest}
          onOpenFailure={(cause) => onOpenFailure(latest.attempt_number, cause)}
        />
      )}

      <Section label="시도 이력" hint="행을 눌러서 Job 로그 상세 정보를 확인하세요.">
        {detail.attempts.length === 0 ? (
          <div className={d.empty}>아직 시도 없음</div>
        ) : (
        <div className={j.list}>
          {[...detail.attempts].reverse().map((a) => (
            <button
              key={a.attempt_number}
              type="button"
              className={j.attemptRow}
              onClick={() => onOpenAttempt(a.attempt_number)}
            >
              <span className={j.attemptNo}>#{a.attempt_number}</span>
              <PipelineStatusBadge status={a.status} size="mini" />
              {a.error_code && <MiniPill tone="failed">{a.error_code}</MiniPill>}
              <span className={j.attemptDetail}>상세정보 보기</span>
            </button>
          ))}
        </div>
        )}
      </Section>
    </>
  );
}

/** Execution info for CONDITION_CHECK — progress log / retry budget / poll history. */
export function ConditionExec({ detail }: { detail: TaskDetail }): ReactElement {
  const reversed = [...detail.attempts].reverse();
  const latest = reversed.find((a) => a.check) ?? null;
  // Current verdict = the most recent settled poll (skip a trailing in-flight one).
  const judged = reversed.find((a) => a.status !== 'IN_PROGRESS') ?? reversed[0] ?? null;
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? reversed : reversed.slice(0, 5);
  const verdict = judged ? conditionVerdict(judged) : null;

  return (
    <>
      <OperatorDescription detail={detail} />
      <Verdict
        tone={verdict ? verdict.tone : 'none'}
        label={verdict ? verdict.label : '기록 없음'}
        code={latest?.check?.last_external_status ?? null}
        facts={
          <>
            {/* Attempts actually made (poll count), not the not-met failure count. */}
            확인 {detail.attempts.length}/{detail.effective_max_fail_count}회
            {detail.next_check_at ? ` · 다음 확인 ${fmtDateTime(detail.next_check_at)}` : ''}
          </>
        }
      />

      <Section label="확인 이력">
        {detail.attempts.length === 0 ? (
          <div className={d.empty}>아직 폴링 기록 없음</div>
        ) : (
        <div className={cn(d.tableWrap, 'mt-3')}>
          <table className={d.table}>
            <thead>
              <tr>
                <th className={d.th}>#</th>
                <th className={d.th}>판정</th>
                <th className={d.th}>외부 상태</th>
                <th className={cn(d.th, 'text-right')}>확인 시각</th>
              </tr>
            </thead>
            <tbody className={d.tbody}>
              {shown.map((a) => {
                const v = conditionVerdict(a);
                return (
                  <tr key={a.attempt_number}>
                    <td className={d.td}>{a.attempt_number}</td>
                    <td className={d.td}>
                      <span className={cn(j.verdictText, j.verdictTextTone[v.tone])}>{v.label}</span>
                    </td>
                    <td className={cn(d.td, '[font-family:var(--pl-font-mono)]')}>
                      {a.check?.last_external_status ?? '—'}
                    </td>
                    <td className={cn(d.td, 'text-right')}>{fmtDateTime(a.check?.last_checked_at ?? a.started_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {detail.attempts.length > 5 && (
            <button type="button" className={j.moreBtn} onClick={() => setExpanded((x) => !x)}>
              {expanded ? '접기' : `전체 ${detail.attempts.length}회 보기`}
            </button>
          )}
        </div>
        )}
      </Section>
    </>
  );
}

/** Definition/contract — definition rows + judgment-policy prose. */
export function DefinitionTab({ detail, displayName }: { detail: TaskDetail; displayName: string }): ReactElement {
  const cond = detail.kind === 'CONDITION_CHECK';
  const rows: Array<{ k: string; v: string; mono?: boolean }> = [
    { k: 'task_definition', v: detail.task_definition, mono: true },
    { k: 'operation', v: detail.operation ?? displayName, mono: true },
    { k: '실행 방식', v: detail.kind, mono: true },
    // The definition·contract tab shows the raw contract values verbatim — the
    // owner Figma (node 121-402) renders ISO-8601 durations as-is (PT10M / PT50M),
    // matching the raw enums/codes in the rows above. (Diverges from the Korean
    // display grammar in docs/api rule #4, which governs the human-facing meta
    // lines, not this raw-contract surface.)
    { k: 'polling_interval', v: detail.effective_polling_interval ?? '—', mono: true },
    { k: 'timeout', v: cond ? '—' : detail.effective_execution_timeout ?? '—', mono: true },
    { k: 'retry_budget', v: `${detail.effective_max_fail_count}회` },
  ];
  return (
    <>
      <div className={d.defCard}>
        {rows.map((row) => (
          <div key={row.k} className={d.defRow}>
            <span className={d.defKey}>{row.k}</span>
            <span className={row.mono ? d.defValMono : d.defVal}>{row.v}</span>
          </div>
        ))}
      </div>
      <div>
        <div className={d.policyLabel}>판정 정책</div>
        <p className={d.policyText}>{KIND_POLICY[detail.kind]}</p>
      </div>
    </>
  );
}
