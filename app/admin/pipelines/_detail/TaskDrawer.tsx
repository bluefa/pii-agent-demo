'use client';

/**
 * TaskDrawer — the right-docked task panel (Figma "pipeline-detail-improved"
 * node 70:35, extended with the R23 job-result surface).
 *
 * Two root sub-tabs:
 *   · Execution info — progress log · attempt count · attempt history
 *     (TERRAFORM_JOB) or progress log · retry budget · poll history
 *     (CONDITION_CHECK)
 *   · Definition/contract — task_definition / operation / execution kind /
 *     polling / timeout / retry_budget / judgment_policy
 *
 * A TERRAFORM_JOB attempt-history row drills into the attempt (← replaces the
 * header), which lists its Terraform Job rows (results ∪ states). A "로그" button
 * opens a full-screen viewer that lazily fetches the job's log (#5a) and last
 * state observation (#5b). Esc layering: viewer → attempt → drawer.
 *
 * The pipeline detail (#5) is already loaded by the page; only the per-job log
 * and state are fetched on demand. The parent remounts per task (`key={task_id}`)
 * so all local view state resets.
 */
import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { cn } from '@/lib/theme';
import { useModal } from '@/app/hooks/useModal';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { ModalShell } from '@/app/admin/pipelines/_components/ModalShell';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { PipelineStatusBadge } from '@/app/admin/pipelines/_detail/PipelineStatusBadge';
import { improvedStyles } from '@/app/admin/pipelines/_detail/detailImprovedStyles';
import { jobStyles } from '@/app/admin/pipelines/_detail/detailJobStyles';
import { jobRows, jobVerdict, type JobRow, type JobVerdict } from '@/app/admin/pipelines/_detail/jobRows';
import { detailStyles } from '@/app/admin/pipelines/_detail/detailStyles';
import { fmtDateTime, KIND_POLICY } from '@/lib/pipeline/format';
import { getJobResult, getJobState, OrchestratorApiError } from '@/app/lib/api/pipeline';
import type {
  TaskAttemptView,
  TaskDetail,
  TaskSummary,
  TerraformJobResultDetail,
  TerraformJobStateDetail,
} from '@/lib/pipeline/types';

const TITLE_ID = 'pl-task-drawer-title';
type DrawerTab = 'exec' | 'definition';
type DrawerView = { name: 'root' } | { name: 'attempt'; n: number };
type ViewerTarget = { attemptNumber: number; jobId: string };

const TABS: ReadonlyArray<{ key: DrawerTab; label: string }> = [
  { key: 'exec', label: '실행 정보' },
  { key: 'definition', label: '정의·계약' },
];

const d = improvedStyles.drawer;
const j = jobStyles;

/** "YYYY-MM-DD HH:MM" → "HH:MM" (Seoul tz, via fmtDateTime); null → "—". */
const hm = (iso: string | null | undefined): string => {
  const s = fmtDateTime(iso);
  return s === '-' ? '—' : s.slice(11);
};

/** Elapsed between two instants → "Xm Ys" / "Ys"; empty when either is missing. */
const spanLabel = (start: string | null, end: string | null): string => {
  if (!start || !end) return '';
  const secs = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000);
  if (Number.isNaN(secs) || secs < 0) return '';
  return secs >= 60 ? `${Math.floor(secs / 60)}m ${secs % 60}s` : `${secs}s`;
};

/** A CONDITION_CHECK attempt's verdict pill. */
function conditionVerdict(a: TaskAttemptView): { label: string; tone: JobVerdict } {
  if (a.status === 'DONE') return { label: '충족', tone: 'success' };
  if (a.status === 'IN_PROGRESS') return { label: '확인 중', tone: 'running' };
  if (a.error_code === 'CONDITION_NOT_MET') return { label: '미충족', tone: 'none' };
  return { label: a.error_code === 'CALL_TIMEOUT' ? '타임아웃' : 'API 오류', tone: 'failed' };
}

function MiniPill({ tone, children }: { tone: JobVerdict; children: ReactNode }): ReactElement {
  return <span className={cn(j.miniBadge, j.verdictTone[tone])}>{children}</span>;
}

function Section({ label, hint, children }: { label: string; hint?: string; children: ReactNode }): ReactElement {
  return (
    <div>
      <div className={d.sectionLabel}>
        {label}
        {hint && <span className={j.labelHint}> {hint}</span>}
      </div>
      {children}
    </div>
  );
}

// ── Execution info (root) ───────────────────────────────────────────────────

function TerraformExec({
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

function ConditionExec({ detail }: { detail: TaskDetail }): ReactElement {
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

// ── Attempt detail (drill-down) ─────────────────────────────────────────────

function AttemptDetail({
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

// ── Definition / contract ───────────────────────────────────────────────────

function DefinitionTab({ detail, displayName }: { detail: TaskDetail; displayName: string }): ReactElement {
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

// ── Log / state viewer ──────────────────────────────────────────────────────

type ViewerTab = 'log' | 'raw';
type Loadable<T> = { phase: 'loading' | 'ok' | 'notfound' | 'error'; data: T | null; error: string | null };

function useLoadable<T>(fetcher: () => Promise<T>, deps: ReadonlyArray<unknown>): Loadable<T> {
  const [state, setState] = useState<Loadable<T>>({ phase: 'loading', data: null, error: null });
  useEffect(() => {
    let alive = true;
    setState({ phase: 'loading', data: null, error: null });
    fetcher()
      .then((data) => alive && setState({ phase: 'ok', data, error: null }))
      .catch((e: unknown) => {
        if (!alive) return;
        if (e instanceof OrchestratorApiError && e.status === 404) {
          setState({ phase: 'notfound', data: null, error: null });
        } else {
          setState({ phase: 'error', data: null, error: e instanceof Error ? e.message : String(e) });
        }
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

function ViewerEmpty({
  title,
  desc,
  detail,
}: {
  title: string;
  desc: ReactNode;
  detail?: string | null;
}): ReactElement {
  return (
    <div className={j.vEmpty}>
      <div className={j.vEmptyTitle}>{title}</div>
      <div className={j.vEmptyDesc}>{desc}</div>
      {detail && <div className={j.vEmptyDetail}>{detail}</div>}
    </div>
  );
}

/** Pretty-print a compact JSON string; leaves non-JSON untouched. */
function prettyJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

function JobViewer({
  pipelineId,
  taskId,
  target,
  jobLabel,
  onClose,
}: {
  pipelineId: number;
  taskId: number;
  target: ViewerTarget;
  jobLabel: string;
  onClose: () => void;
}): ReactElement {
  const { attemptNumber, jobId } = target;
  const [tab, setTab] = useState<ViewerTab>('log');
  const logRef = useRef<HTMLDivElement>(null);

  const result = useLoadable<TerraformJobResultDetail>(
    () => getJobResult(pipelineId, taskId, attemptNumber, jobId),
    [pipelineId, taskId, attemptNumber, jobId],
  );
  const state = useLoadable<TerraformJobStateDetail>(
    () => getJobState(pipelineId, taskId, attemptNumber, jobId),
    [pipelineId, taskId, attemptNumber, jobId],
  );

  // Open the log at its tail — terraform errors are at the end.
  useEffect(() => {
    if (tab === 'log' && result.phase === 'ok' && result.data?.content && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [tab, result.phase, result.data]);

  const copyText = tab === 'log' ? result.data?.content ?? '' : state.data?.last_response ?? '';
  const succeeded = result.data?.succeeded ?? null;
  const truncated = tab === 'log' && result.phase === 'ok' && result.data?.truncated === true;
  const live = tab === 'log' && result.phase === 'ok' && result.data?.source === 'live' && !!result.data?.content;

  const stamp =
    tab === 'log'
      ? result.data?.created_at
        ? `수집 ${hm(result.data.created_at)}`
        : live
          ? '방금 조회함'
          : ''
      : state.data?.last_polled_at
        ? `마지막 확인 ${hm(state.data.last_polled_at)}`
        : '';

  const resultBadge =
    tab === 'log' && succeeded !== null ? (
      <MiniPill tone={succeeded ? 'success' : 'failed'}>{succeeded ? '성공' : '실패'}</MiniPill>
    ) : null;

  let body: ReactElement;
  if (tab === 'log') {
    if (result.phase === 'loading') body = <div className={j.vLoading}>로그를 불러오는 중…</div>;
    else if (result.phase === 'notfound')
      body = <ViewerEmpty title="로그 기록이 없습니다" desc="이 job의 로그가 저장되지 않았습니다. 시도의 실패 코드에서 원인을 확인하세요." />;
    else if (result.phase === 'error')
      body = <ViewerEmpty title="로그를 불러오지 못했습니다" desc="잠시 후 다시 시도해 주세요." detail={result.error} />;
    else if (result.data?.content === null && result.data.fetch_error)
      body = (
        <ViewerEmpty
          title="로그를 가져오지 못했습니다"
          desc="이 시도는 로그가 저장되기 전에 끝나, 실행 서버(InfraManager)에서 직접 조회했지만 응답이 없었습니다."
          detail={result.data.fetch_error}
        />
      );
    else if (result.data?.content === null)
      body = (
        <ViewerEmpty
          title="저장된 로그 본문이 없습니다"
          desc="job은 종결됐지만 로그 본문 수집에 실패한 기록입니다. 성공·실패 판정과 시각 정보는 유효합니다."
        />
      );
    else
      body = (
        <div ref={logRef} className={j.logBody}>
          <pre className={j.logPre}>
            {truncated && <span className={j.logCut}>— 이 지점 위 로그는 16MB 초과로 절단되었습니다 —</span>}
            {result.data?.content}
          </pre>
        </div>
      );
  } else {
    if (state.phase === 'loading') body = <div className={j.vLoading}>상태를 불러오는 중…</div>;
    else if (state.phase === 'notfound' || (state.phase === 'ok' && !state.data))
      body = <ViewerEmpty title="상태 관측이 없습니다" desc="이 job은 상태 확인이 기록되기 전에 시도가 끝났습니다." />;
    else if (state.phase === 'error')
      body = <ViewerEmpty title="상태를 불러오지 못했습니다" desc="잠시 후 다시 시도해 주세요." detail={state.error} />;
    else if (state.data?.last_response === null)
      body = (
        <ViewerEmpty
          title="저장된 상태 응답이 없습니다"
          desc="마지막 상태 확인 호출이 실패해 응답 본문이 남지 않았습니다."
          detail={state.data.last_error}
        />
      );
    else
      body = (
        <div className={j.logBody}>
          <pre className={j.logPre}>{prettyJson(state.data?.last_response ?? '')}</pre>
        </div>
      );
  }

  return (
    <ModalShell open onClose={onClose} labelledBy="pl-job-viewer-title" className={j.viewer}>
      <div className={j.vHead}>
        <div className="min-w-0">
          <div className={j.vTitle} id="pl-job-viewer-title">
            <span className={j.vJid}>Job {jobId}</span>
            {resultBadge}
          </div>
          <div className={j.vSub}>
            {jobLabel} · 시도 #{attemptNumber}
            {stamp && ` · ${stamp}`}
          </div>
        </div>
        <button type="button" className={j.vClose} onClick={onClose} aria-label="닫기" title="닫기 (Esc)">
          <Icon name="x" size="lg" />
        </button>
      </div>

      <div className={j.toolbar}>
        <span className={j.seg}>
          <button
            type="button"
            className={cn(j.segBtn, tab === 'log' ? j.segOn : j.segOff)}
            onClick={() => setTab('log')}
          >
            Terraform 로그
          </button>
          <button
            type="button"
            className={cn(j.segBtn, tab === 'raw' ? j.segOn : j.segOff)}
            onClick={() => setTab('raw')}
          >
            상태 응답 원문
          </button>
        </span>
        {truncated && <span className={j.warnPill}>16MB 초과 — 앞부분 절단</span>}
        {live && <span className={j.livePill}>실시간 조회 — 저장 전</span>}
        <span className={j.toolbarGrow} />
        <PlButton
          variant="secondary"
          size="sm"
          onClick={() => void navigator.clipboard?.writeText(copyText)}
          disabled={!copyText}
        >
          복사
        </PlButton>
      </div>

      {body}

      <div className={j.vFoot}>
        로그는 열릴 때 맨 아래(tail)에서 시작합니다 — terraform 오류는 끝에 있고, 절단도 tail을 우선 보존합니다.
      </div>
    </ModalShell>
  );
}

// ── Drawer shell ─────────────────────────────────────────────────────────────

export interface TaskDrawerProps {
  task: TaskSummary;
  detail: TaskDetail | null;
  detailLoaded?: boolean;
  displayName: string;
  onClose: () => void;
  onRetry?: () => void;
}

export function TaskDrawer({
  task,
  detail,
  detailLoaded = true,
  displayName,
  onClose,
  onRetry,
}: TaskDrawerProps): ReactElement {
  const [tab, setTab] = useState<DrawerTab>('exec');
  const [view, setView] = useState<DrawerView>({ name: 'root' });
  const viewerModal = useModal<ViewerTarget>();
  const description = detail ? detail.definition?.description ?? detail.description : null;

  // Esc layering: viewer (ModalShell owns it) → attempt → close drawer.
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      if (viewerModal.isOpen) return;
      if (view.name === 'attempt') {
        setView({ name: 'root' });
        return;
      }
      onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, viewerModal.isOpen, view]);

  const attempt =
    detail && view.name === 'attempt'
      ? detail.attempts.find((a) => a.attempt_number === view.n) ?? null
      : null;

  return (
    <aside role="complementary" aria-labelledby={TITLE_ID} className={d.root}>
      {view.name === 'attempt' && attempt && detail ? (
        <div className={j.subHeader}>
          <button
            type="button"
            className={j.back}
            onClick={() => setView({ name: 'root' })}
            aria-label="뒤로"
            title="뒤로 (Esc)"
          >
            ←
          </button>
          <div className="min-w-0">
            <div className={j.subTitle}>
              시도 #{attempt.attempt_number}
              <PipelineStatusBadge status={attempt.status} size="mini" />
              {attempt.error_code && <MiniPill tone="failed">{attempt.error_code}</MiniPill>}
            </div>
            <div className={j.subCrumb}>{displayName}</div>
          </div>
        </div>
      ) : (
        <>
          <div className={d.header}>
            <div className="min-w-0">
              <h3 id={TITLE_ID} className={d.title}>
                {displayName}
                <PipelineStatusBadge status={task.status} className={d.titleBadge} />
              </h3>
              {description && <p className={d.headerDesc}>{description}</p>}
              <div className={d.typeRow}>
                <span className={d.typeLabel}>타입</span>
                <span className={d.tag}>{task.kind}</span>
              </div>
            </div>
            <button type="button" className={d.close} onClick={onClose} aria-label="Task 상세 닫기" title="닫기">
              <Icon name="chev-r" size="lg" />
            </button>
          </div>

          <div className={d.nav}>
            {TABS.map((t) => {
              const active = t.key === tab;
              return (
                <button
                  key={t.key}
                  type="button"
                  className={cn(d.navTab, active ? d.navActive : d.navIdle)}
                  onClick={() => setTab(t.key)}
                  aria-pressed={active}
                >
                  {t.label}
                  <span className={active ? d.navUnderline : d.navUnderlineHidden} />
                </button>
              );
            })}
          </div>
        </>
      )}

      <div className={d.body}>
        {detail ? (
          view.name === 'attempt' && attempt ? (
            <AttemptDetail attempt={attempt} onOpenViewer={viewerModal.open} />
          ) : tab === 'exec' ? (
            detail.kind === 'CONDITION_CHECK' ? (
              <ConditionExec detail={detail} />
            ) : (
              <TerraformExec detail={detail} onOpenAttempt={(n) => setView({ name: 'attempt', n })} />
            )
          ) : (
            <DefinitionTab detail={detail} displayName={displayName} />
          )
        ) : !detailLoaded ? (
          <div className={cn(detailStyles.skeleton, 'h-24')} aria-hidden="true" />
        ) : (
          <div className="flex flex-col items-start gap-3">
            <div className={d.empty}>상세를 불러오지 못했습니다</div>
            {onRetry && (
              <PlButton variant="secondary" size="sm" onClick={onRetry}>
                재시도
              </PlButton>
            )}
          </div>
        )}
      </div>

      {viewerModal.isOpen && viewerModal.data && detail && (
        <JobViewer
          pipelineId={detail.pipeline_id}
          taskId={detail.task_id}
          target={viewerModal.data}
          jobLabel={displayName}
          onClose={viewerModal.close}
        />
      )}
    </aside>
  );
}
