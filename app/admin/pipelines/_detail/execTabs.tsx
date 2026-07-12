/**
 * The two root tab bodies of the task drawer: Execution info (TerraformExec /
 * ConditionExec) and Definition/contract (DefinitionTab). Split out of
 * TaskDrawer to keep each unit focused (AP-B1).
 */
import { useState, type ReactElement } from 'react';
import { cn } from '@/lib/theme';
import { PipelineStatusBadge } from '@/app/admin/pipelines/_detail/PipelineStatusBadge';
import { fmtDateTime, KIND_POLICY } from '@/lib/pipeline/format';
import {
  conditionVerdict,
  d,
  j,
  MiniPill,
  OperatorDescription,
  Section,
} from '@/app/admin/pipelines/_detail/taskDrawerShared';
import type { TaskDetail } from '@/lib/pipeline/types';

/** Execution info for TERRAFORM_JOB — progress log / attempt count / attempt history. */
export function TerraformExec({
  detail,
  onOpenAttempt,
}: {
  detail: TaskDetail;
  onOpenAttempt: (n: number) => void;
}): ReactElement {
  const failed = detail.status === 'FAILED';
  return (
    <>
      <OperatorDescription detail={detail} />
      <Section label="진행 기록">
        <div className={d.rowsGap}>
          <div className={d.kvRow}>
            <span className={d.kvKey}>Started</span>
            <span className={d.kvVal}>{fmtDateTime(detail.started_at)}</span>
          </div>
          <div className={d.kvRow}>
            <span className={d.kvKey}>{failed ? 'Failed' : 'Finished'}</span>
            <span className={failed ? d.kvValErr : d.kvVal}>{fmtDateTime(detail.finished_at)}</span>
          </div>
          {failed && detail.error_code && (
            <div className={d.kvRow}>
              <span className={d.kvKey}>실패 코드</span>
              <span className={cn(d.kvValErr, '[font-family:var(--pl-font-mono)]')}>{detail.error_code}</span>
            </div>
          )}
          {detail.next_check_at && (
            <div className={d.kvRow}>
              <span className={d.kvKey}>다음 확인</span>
              <span className={d.kvVal}>{fmtDateTime(detail.next_check_at)}</span>
            </div>
          )}
        </div>
      </Section>

      <div className={d.attemptRow}>
        <span className={d.sectionLabel}>시도 횟수</span>
        <span className={failed ? d.bigValErr : d.bigVal}>
          {detail.fail_count} / {detail.effective_max_fail_count}
        </span>
      </div>

      <Section label="시도 이력" hint="행을 눌러서 Job 로그 상세 정보를 확인하세요.">
        {detail.attempts.length === 0 ? (
          <div className={d.empty}>아직 시도 없음</div>
        ) : (
        <div className={j.list}>
          {[...detail.attempts].reverse().map((a, i) => (
            <button
              key={a.attempt_number}
              type="button"
              className={j.attemptRow}
              onClick={() => onOpenAttempt(a.attempt_number)}
            >
              <span className={j.attemptNo}>#{a.attempt_number}</span>
              <PipelineStatusBadge status={a.status} size="mini" />
              {a.error_code && <MiniPill tone="failed">{a.error_code}</MiniPill>}
              <span className={j.attemptTime}>{fmtDateTime(a.started_at)}</span>
              {i === 0 && <span className={j.attemptCur}>현재</span>}
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
      <Section label="진행 기록">
        <div className={d.rowsGap}>
          <div className={d.kvRow}>
            <span className={d.kvKey}>Started</span>
            <span className={d.kvVal}>{fmtDateTime(detail.started_at)}</span>
          </div>
          <div className={d.kvRow}>
            <span className={d.kvKey}>현재 판정</span>
            <span className={d.kvVal}>
              {verdict ? (
                <span className={cn(j.verdictText, j.verdictTextTone[verdict.tone])}>{verdict.label}</span>
              ) : (
                '—'
              )}
            </span>
          </div>
          <div className={d.kvRow}>
            <span className={d.kvKey}>외부 상태</span>
            <span className={cn(d.kvVal, '[font-family:var(--pl-font-mono)]')}>
              {latest?.check?.last_external_status ?? '—'}
            </span>
          </div>
          {detail.next_check_at && (
            <div className={d.kvRow}>
              <span className={d.kvKey}>다음 확인</span>
              <span className={d.kvVal}>{fmtDateTime(detail.next_check_at)}</span>
            </div>
          )}
        </div>
      </Section>

      <div className={d.attemptRow}>
        <span className={d.sectionLabel}>시도 횟수</span>
        <span className={d.bigVal}>
          {detail.fail_count} / {detail.effective_max_fail_count}
        </span>
      </div>

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
