/**
 * The two root tab bodies of the task drawer: Execution info (TerraformExec /
 * ConditionExec) and Definition/contract (DefinitionTab). Split out of
 * TaskDrawer to keep each unit focused (AP-B1).
 */
import { useState, type ReactElement, type ReactNode } from 'react';
import { cn } from '@/lib/theme';
import { fmtDateTime, KIND_POLICY, statusKo } from '@/lib/pipeline/format';
import { PlSelect } from '@/app/admin/pipelines/_components/PlSelect';
import { AttemptDetail } from '@/app/admin/pipelines/_detail/AttemptDetail';
import type { JobVerdict } from '@/app/admin/pipelines/_detail/jobRows';
import {
  attemptWindow,
  conditionVerdict,
  d,
  j,
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
  pick,
  facts,
}: {
  tone: JobVerdict;
  label: string;
  code?: string | null;
  /** Retry budget + the attempt picker, on the hero's last line (owner
   *  2026-08-16) — below the judgment and the times it applies to. */
  pick?: ReactNode;
  facts?: string;
}): ReactElement {
  return (
    <div className={d.verdict}>
      {/* No dot (owner 2026-08-16) — the word IS the verdict here, unlike a job
          row where the id carries no judgment of its own. */}
      <div className={cn(d.verdictHead, j.verdictTextTone[tone])}>
        {label}
        {code && <span className={d.verdictCode}>{code}</span>}
      </div>
      {/* No facts, no line — a first-attempt task says nothing here that the
          flow card has not already said. */}
      {facts && <p className={d.verdictFacts}>{facts}</p>}
      {pick && <div className={d.verdictPick}>{pick}</div>}
    </div>
  );
}

/** Execution info for TERRAFORM_JOB — verdict / job status / attempt history. */
export function TerraformExec({
  detail,
  onOpenViewer,
  onOpenFailure,
}: {
  detail: TaskDetail;
  onOpenViewer: (t: ViewerTarget) => void;
  onOpenFailure: (attemptNumber: number, cause: string) => void;
}): ReactElement {
  // Attempts arrive oldest-first; the panel opens on the newest one and the
  // picker below switches which one the body belongs to (owner 2026-08-16 —
  // the older attempts' jobs used to be two clicks deep in a fold nobody found).
  const attempts = [...detail.attempts].reverse();
  const [picked, setPicked] = useState<number | null>(null);
  const current = attempts.find((a) => a.attempt_number === picked) ?? attempts[0] ?? null;
  // The SELECTED attempt's window, from the second attempt on: with a single
  // attempt these are the same three values the flow card already prints, and
  // the card's values are never repeated here (2차 라운드 rule). It captions the
  // Job list rather than the hero (시안 C) — it is the window those jobs ran in,
  // and under the hero nothing said which of the two it belonged to.
  const runWindow = attempts.length > 1 && current ? attemptWindow(current) : '';
  return (
    <>
      <OperatorDescription detail={detail} />
      <Verdict
        tone={STATUS_TONE[detail.status]}
        label={statusKo(detail.status)}
        // No error code (design-benchmark 2026-08-16 시안 C): JOB_FAILED was
        // printed four times on one screen. The failure strip states it at the
        // top of the page and the flow card beside this panel repeats it in
        // prose ("원인은 JOB_FAILED"), so the hero's chip was the fourth.
        facts={detail.next_check_at ? `다음 확인 ${fmtDateTime(detail.next_check_at)}` : ''}
        pick={
          <>
            {/* Attempts actually made (attempts.length), not the failure count — a
                task that succeeded on the first run has fail_count 0 but 1 attempt.
                It doubles as the picker's label, so the picker needs none. */}
            시도 {attempts.length}/{detail.effective_max_fail_count}회
            {attempts.length > 1 && (
              /* A dropdown, not one button per attempt (시안 C): the retry budget
                 runs to 5, and the segments grew the hero's line with it. The dot
                 the segments carried becomes the option's own verdict word. */
              <PlSelect
                aria-label="시도 선택"
                value={current?.attempt_number ?? ''}
                onChange={(e) => setPicked(Number(e.target.value))}
              >
                {attempts.map((a) => (
                  <option key={a.attempt_number} value={a.attempt_number}>
                    시도 #{a.attempt_number} · {statusKo(a.status)}
                  </option>
                ))}
              </PlSelect>
            )}
          </>
        }
      />

      {current ? (
        <AttemptDetail
          attempt={current}
          operation={detail.operation}
          runWindow={runWindow}
          onOpenViewer={onOpenViewer}
          onOpenFailure={(cause) => onOpenFailure(current.attempt_number, cause)}
        />
      ) : (
        <div className={d.empty}>아직 시도 없음</div>
      )}
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
        // Attempts actually made (poll count), not the not-met failure count.
        facts={[
          `확인 ${detail.attempts.length}/${detail.effective_max_fail_count}회`,
          detail.next_check_at ? `다음 확인 ${fmtDateTime(detail.next_check_at)}` : '',
        ]
          .filter(Boolean)
          .join(' · ')}
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
