/**
 * Full-screen log/state viewer for a single Terraform job. Rendered inside
 * ModalShell (scrim/Esc/backdrop are the shell's). Lazily fetches the job's log
 * (#5a) and last state observation (#5b) and renders the log tail-first.
 */
import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { cn } from '@/lib/theme';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { ModalShell } from '@/app/admin/pipelines/_components/ModalShell';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { getJobResult, getJobState, OrchestratorApiError } from '@/app/lib/api/pipeline';
import { d, hms, j, MiniPill, type ViewerTarget } from '@/app/admin/pipelines/_detail/taskDrawerShared';
import type { TerraformJobResultDetail, TerraformJobStateDetail } from '@/lib/pipeline/types';

type ViewerTab = 'log' | 'raw';

const VIEWER_TABS: ReadonlyArray<{ key: ViewerTab; label: string }> = [
  { key: 'log', label: 'Terraform 로그' },
  { key: 'raw', label: '상태 응답 원문' },
];
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

function ViewerEmpty({ title, desc }: { title: string; desc: ReactNode }): ReactElement {
  return (
    <div className={j.vEmpty}>
      <Icon name="warn-tri" size="lg" className={j.vEmptyIcon} />
      <div className={j.vEmptyTitle}>{title}</div>
      <div className={j.vEmptyDesc}>{desc}</div>
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

export function JobViewer({
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
        ? `수집시간 ${hms(result.data.created_at)}`
        : live
          ? '방금 조회함'
          : ''
      : state.data?.last_polled_at
        ? `마지막 확인 ${hms(state.data.last_polled_at)}`
        : '';

  // The panel goes dark only when it actually renders a log/state body; empty and
  // error states stay on the white card. `dark` also drives the copy-button variant
  // and whether the tail-note footer is shown (owner Figma nodes 121-659 / 121-753).
  const dark =
    (tab === 'log' && result.phase === 'ok' && !!result.data?.content) ||
    (tab === 'raw' && state.phase === 'ok' && !!state.data?.last_response);

  // The verdict is a property of the job, not the active tab — show it on both
  // (owner Figma nodes 121-659 / 121-710).
  const resultBadge =
    succeeded !== null ? (
      <MiniPill tone={succeeded ? 'success' : 'failed'}>{succeeded ? '성공' : '실패'}</MiniPill>
    ) : null;

  let body: ReactElement;
  if (tab === 'log') {
    if (result.phase === 'loading') body = <div className={j.vLoading}>로그를 불러오는 중…</div>;
    else if (result.phase === 'notfound')
      body = <ViewerEmpty title="로그 기록이 없습니다" desc="이 job의 로그가 저장되지 않았습니다. 시도의 실패 코드에서 원인을 확인하세요." />;
    else if (result.phase === 'error')
      body = <ViewerEmpty title="로그를 불러오지 못했습니다" desc="잠시 후 다시 시도해 주세요." />;
    else if (result.data?.content === null && result.data.fetch_error)
      body = (
        <ViewerEmpty
          title="로그를 가져오지 못했습니다"
          desc="이 시도는 로그가 저장되기 전에 끝나, 실행 서버(InfraManager)에서 직접 조회했지만 응답이 없었습니다."
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
      body = <ViewerEmpty title="상태를 불러오지 못했습니다" desc="잠시 후 다시 시도해 주세요." />;
    else if (state.data?.last_response === null)
      body = (
        <ViewerEmpty
          title="저장된 상태 응답이 없습니다"
          desc="마지막 상태 확인 호출이 실패해 응답 본문이 남지 않았습니다."
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
            <span className={j.vJid}>TerraformJob #{jobId}</span>
            {resultBadge}
          </div>
          <div className={j.vSub}>
            {jobLabel} · 시도 #{attemptNumber}
          </div>
          {stamp && <div className={j.vStamp}>{stamp}</div>}
        </div>
        <button type="button" className={j.vClose} onClick={onClose} aria-label="닫기" title="닫기 (Esc)">
          <Icon name="x" size="lg" />
        </button>
      </div>

      <div className={d.nav}>
        {VIEWER_TABS.map((t) => {
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

      <div className={cn(j.panel, dark && j.panelDark)}>
        <div className={j.strip}>
          {truncated && <span className={j.warnPill}>16MB 초과 — 앞부분 절단</span>}
          {live && <span className={j.livePill}>실시간 조회 — 저장 전</span>}
          <span className={j.toolbarGrow} />
          <PlButton
            variant={dark ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => void navigator.clipboard?.writeText(copyText)}
            disabled={!copyText}
          >
            복사
          </PlButton>
        </div>
        {body}
      </div>
    </ModalShell>
  );
}
