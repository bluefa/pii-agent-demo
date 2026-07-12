/**
 * The two root tab bodies of the task drawer: Execution info (TerraformExec /
 * ConditionExec) and Definition/contract (DefinitionTab). Split out of
 * TaskDrawer to keep each unit focused (AP-B1).
 */
import { useState, type ReactElement } from 'react';
import { cn } from '@/lib/theme';
import { PipelineStatusBadge } from '@/app/admin/pipelines/_detail/PipelineStatusBadge';
import { KIND_POLICY } from '@/lib/pipeline/format';
import { conditionVerdict, d, hm, j, MiniPill, Section } from '@/app/admin/pipelines/_detail/taskDrawerShared';
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
      <Section label="진행 기록">
        <div className={d.rowsGap}>
          <div className={d.kvRow}>
            <span className={d.kvKey}>Started</span>
            <span className={d.kvVal}>{hm(detail.started_at)}</span>
          </div>
          <div className={d.kvRow}>
            <span className={d.kvKey}>{failed ? 'Failed' : 'Finished'}</span>
            <span className={failed ? d.kvValErr : d.kvVal}>{hm(detail.finished_at)}</span>
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
              <span className={d.kvVal}>{hm(detail.next_check_at)}</span>
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

      <Section label="시도 이력" hint="— 행을 누르면 job·로그 상세">
        <div className={j.cardList}>
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
              <span className={j.attemptTime}>
                {hm(a.started_at)} → {hm(a.finished_at)}
              </span>
              {i === 0 && <span className={j.attemptCur}>현재</span>}
              <span className={j.attemptChev}>›</span>
            </button>
          ))}
        </div>
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
      <Section label="진행 기록">
        <div className={d.rowsGap}>
          <div className={d.kvRow}>
            <span className={d.kvKey}>Started</span>
            <span className={d.kvVal}>{hm(detail.started_at)}</span>
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
              <span className={d.kvVal}>{hm(detail.next_check_at)}</span>
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

      <Section
        label="폴 이력"
        hint={`— ${expanded ? '전체' : `최근 ${Math.min(5, detail.attempts.length)}`} / ${detail.attempts.length}회`}
      >
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
                    <td className={cn(d.td, 'text-right')}>{hm(a.check?.last_checked_at ?? a.started_at)}</td>
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
    { k: 'polling_interval', v: detail.effective_polling_interval ?? '—' },
    { k: 'timeout', v: cond ? '—' : detail.effective_execution_timeout ?? '—' },
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
