'use client';

/**
 * Pipeline detail — Figma "pipeline-detail-improved" redesign. Data layer:
 * pipeline #4 + task catalog #12 (display names + descriptions) on load, plus
 * the R23 10s live-poll. Task detail #5 is fetched LAZILY — only for the task
 * the operator opens (never a page-load bulk fetch); the flow nodes render from
 * the catalog + summary alone. The presentation matches Figma node 70:35:
 *   · a full-bleed header — Korean title + #id, a recipe description line, and
 *     two column-aligned meta rows (작업 / Target Source). Status badge
 *     and [중단] appear here only when NOT running (the band carries them
 *     while live). No tab bar: the ownership meta now lives in the header.
 *   · a RUNNING-only dark progress band (현재 실행 중 · task · RUNNING pill /
 *     진행 단계 · bar · n/total) with [중단] at the right, then the flow canvas.
 * The header service line (name + code) comes from the reused target-source
 * detail (getRawTargetSourceDetail) — PipelineDetail carries neither field.
 */
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useModal } from '@/app/hooks/useModal';
import { useAbortableEffect } from '@/app/hooks/useAbortableEffect';
import { cn, pipelineStyles } from '@/lib/theme';
import { passRoutes } from '@/lib/routes';
import { ProviderLogo } from '@/app/components/features/admin/v7/ProviderLogo';
import { normalizeCloudProvider } from '@/lib/types';
import { Card } from '@/app/admin/pipelines/_components/Card';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { PlEmptyState } from '@/app/admin/pipelines/_components/PlEmptyState';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { usePlToast } from '@/app/admin/pipelines/_components/usePlToast';
import { TaskFlow } from '@/app/admin/pipelines/_detail/TaskFlow';
import { RestartBadge } from '@/app/admin/pipelines/_detail/r24Task';
import { TaskDrawer } from '@/app/admin/pipelines/_detail/TaskDrawer';
import { CancelModal } from '@/app/admin/pipelines/_detail/CancelModal';
import { RestartModal } from '@/app/admin/pipelines/_detail/RestartModal';
import { detailStyles } from '@/app/admin/pipelines/_detail/detailStyles';
import { improvedStyles } from '@/app/admin/pipelines/_detail/detailImprovedStyles';
import {
  changedTaskIds,
  currentTaskInfo,
  findFailedTask,
  taskDisplayName,
  retrySuffix,
} from '@/app/admin/pipelines/_detail/statusModel';
import {
  canCancel,
  displayProvider,
  fmtDateTime,
  fmtElapsedMs,
  isLivePipeline,
  progressCount,
  progressPhrase,
  providerLabel,
  recipeLabel,
  runWindow,
  statusKo,
  taskMetaLine,
  typeKo,
} from '@/lib/pipeline/format';
import {
  getLatestPipelineByTarget,
  getPipeline,
  getTaskDefinitions,
  getTaskDetail,
  OrchestratorApiError,
} from '@/app/lib/api/pipeline';
import type { PipelineDetail, PipelineSummary, TaskDetail, TaskSummary } from '@/lib/pipeline/types';

/** R23 (C안) — live-run poll cadence. */
const POLL_INTERVAL_MS = 10_000;

type LoadStatus = 'loading' | 'ready' | 'notfound' | 'error';

export function PipelineDetailView(): ReactElement {
  const params = useParams<{ pipelineId: string }>();
  const pipelineId = String(params.pipelineId);
  const toast = usePlToast();
  const { text } = pipelineStyles;
  const h = improvedStyles.header;

  const [detail, setDetail] = useState<PipelineDetail | null>(null);
  const [status, setStatus] = useState<LoadStatus>('loading');
  // Task-definition catalog (one bulk call): display names + descriptions for the
  // flow nodes, so a node needs NO per-task detail to render its name/subtitle.
  const [catalog, setCatalog] = useState<ReadonlyMap<string, string>>(new Map());
  const [descMap, setDescMap] = useState<ReadonlyMap<string, string>>(new Map());
  // Per-task detail is fetched lazily — only the task the operator opens. `has(id)`
  // distinguishes "not fetched yet" (skeleton) from "fetched, value null" (error).
  const [detailMap, setDetailMap] = useState<ReadonlyMap<number, TaskDetail | null>>(new Map());
  // The target's LATEST run (#8). Two jobs: the owning-service identity for the
  // header (PipelineDetail carries neither field, and every run of a target
  // shares it), and the restart gate — only the latest run is restartable
  // (decision 5), so the band CTA needs to know whether THIS run is it.
  const [latest, setLatest] = useState<PipelineSummary | null>(null);
  // Service-name text is drawn only after #8 settles (success OR failure);
  // until then the slot is a skeleton.
  const [latestSettled, setLatestSettled] = useState(false);
  const [selected, setSelected] = useState<TaskSummary | null>(null);
  const cancelModal = useModal();
  const restartModal = useModal();
  const [reloadKey, setReloadKey] = useState(0);
  // `?task=` (restart drawer deep-link) — applied as the pipeline loads.
  const searchParams = useSearchParams();
  const taskParam = searchParams.get('task');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStatus('loading');
      setDetail(null);
      setDetailMap(new Map());
      setSelected(null);
      // Skeleton first, so the previous target's service identity never bleeds
      // into the new run's header.
      setLatest(null);
      setLatestSettled(false);
      try {
        const d = await getPipeline(pipelineId);
        if (cancelled) return;
        setDetail(d);
        setStatus('ready');
        // Restart deep-link (`?task=<originTaskId>` from the drawer's origin link):
        // open that task's drawer as the page settles.
        const deepLinked = taskParam
          ? d.tasks.find((t) => String(t.task_id) === taskParam)
          : undefined;
        if (deepLinked) {
          setSelected(deepLinked);
        } else if (d.status === 'FAILED') {
          // 실패 우선 랜딩 (시안 1) — the operator's first question on a FAILED
          // run is "why"; open the failed task's drawer for them. Load-time
          // only: closing it stays closed (no re-open on poll).
          const failed = findFailedTask(d.tasks);
          if (failed) setSelected(failed);
        }
        getTaskDefinitions(d.cloud_provider)
          .then((res) => {
            if (cancelled) return;
            setCatalog(new Map(res.task_definitions.map((c) => [c.name, c.display_name])));
            setDescMap(new Map(res.task_definitions.map((c) => [c.name, c.description])));
          })
          .catch(() => {});
        // Latest run of the owning target — service identity + restart gate.
        // Degrades silently: no latest ⇒ no restart CTA (server is the authority).
        getLatestPipelineByTarget(d.target_source_id)
          .then((p) => !cancelled && setLatest(p))
          .catch(() => {})
          .finally(() => !cancelled && setLatestSettled(true));
      } catch (err) {
        if (cancelled) return;
        setStatus(err instanceof OrchestratorApiError && err.status === 404 ? 'notfound' : 'error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pipelineId, reloadKey, taskParam]);

  // Lazy task-detail fetch: only when the operator opens a task and its detail
  // isn't cached yet. `detailMap.has` gates both the fetch and the drawer skeleton.
  // useAbortableEffect cancels the in-flight request (and discards its result)
  // the instant the selection changes, so a slow response for a previously-open
  // task can never land in the newly-open task's drawer.
  useAbortableEffect(
    (signal) => {
      if (!selected || !detail || detailMap.has(selected.task_id)) return;
      const taskId = selected.task_id;
      return getTaskDetail(detail.pipeline_id, taskId, { signal })
        .then((d) => {
          if (!signal.aborted) setDetailMap((prev) => new Map(prev).set(taskId, d));
        })
        .catch(() => {
          if (!signal.aborted) setDetailMap((prev) => new Map(prev).set(taskId, null));
        });
    },
    [selected, detail, detailMap],
  );

  // R23 (C안) — 10s poll while live: refetch pipeline + only the details whose
  // summary moved (+ the open task). Terminalizing drops the interval.
  useEffect(() => {
    if (status !== 'ready' || !detail || !isLivePipeline(detail.status)) return;
    const controller = new AbortController();
    const { signal } = controller;
    const tick = async (): Promise<void> => {
      if (document.hidden) return;
      try {
        const next = await getPipeline(pipelineId, { signal });
        // Only the OPEN task's detail is refetched (it's the only one shown); every
        // other cached detail whose summary moved is evicted so a later re-open
        // refetches it fresh.
        let openDetail: TaskDetail | null | undefined;
        if (selected) {
          try {
            openDetail = await getTaskDetail(next.pipeline_id, selected.task_id, { signal });
          } catch {
            openDetail = undefined;
          }
        }
        if (signal.aborted) return;
        const moved = new Set(changedTaskIds(detail.tasks, next.tasks));
        setDetail(next);
        setDetailMap((prev) => {
          const merged = new Map(prev);
          for (const id of moved) merged.delete(id);
          if (selected && openDetail !== undefined) merged.set(selected.task_id, openDetail);
          return merged;
        });
        setSelected((prev) =>
          prev ? next.tasks.find((t) => t.task_id === prev.task_id) ?? null : prev,
        );
      } catch {
        /* transient poll failure (incl. abort) — silent, the next tick retries */
      }
    };
    const id = window.setInterval(() => {
      void tick();
    }, POLL_INTERVAL_MS);
    return () => {
      controller.abort();
      window.clearInterval(id);
    };
  }, [status, detail, selected, pipelineId]);

  // Render-pure clock for the live 경과 readout (the compiler forbids Date.now()
  // in render; the first tick runs as a timeout so the effect body sets no
  // state). 30s granularity — the readout is minutes-scale.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = (): void => setNow(Date.now());
    const first = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, 30_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, []);

  // Owning-service identity (#8, async) — read by the title effect and header.
  const svcName =
    latest?.service_name ||
    latest?.service_code ||
    (detail ? `Target ${detail.target_source_id}` : '');

  // Every run's tab used to read the layout's static title — indistinguishable
  // in browser history/tabs (시안 5). Imperative on purpose: the identity is
  // client-fetched, out of generateMetadata's reach. Restored on unmount.
  useEffect(() => {
    if (!detail) return;
    const prev = document.title;
    document.title = `작업 #${detail.pipeline_id} · ${svcName}`;
    return () => {
      document.title = prev;
    };
  }, [detail, svcName]);

  const resolveName = useCallback(
    (t: TaskSummary): string => taskDisplayName(t, detailMap.get(t.task_id), catalog),
    [detailMap, catalog],
  );

  // Retry budget denominator comes from the pipeline detail's current-task fields
  // (no per-task detail needed): they describe exactly the failing/current task.
  const retryFor = useCallback(
    (t: TaskSummary): string =>
      retrySuffix(
        t.fail_count,
        t.sequence === detail?.current_task_sequence ? detail?.current_max_fail_count : undefined,
      ),
    [detail],
  );

  // Node subtitle without a per-task fetch. FAILED → a failure line built from the
  // summary (fail_count + error code); the precise f/m retry budget lives in the
  // drawer, which loads the task detail. A RETRYING task (fail_count>0, back to
  // READY between attempts or IN_PROGRESS on the re-run) says so explicitly —
  // otherwise the node reads "running/waiting" while the drawer's attempt list
  // shows FAILED rows, which operators flagged as contradictory. Otherwise:
  // catalog description → operator description → status meta line.
  const resolveMeta = useCallback(
    (t: TaskSummary): string => {
      if (t.status === 'FAILED') {
        return `${t.fail_count}회 실패했습니다. 원인은 ${t.error_code ?? '기록되지 않았습니다'}.`;
      }
      if (t.fail_count > 0 && (t.status === 'IN_PROGRESS' || t.status === 'READY')) {
        const max =
          t.sequence === detail?.current_task_sequence ? detail?.current_max_fail_count : null;
        const budget = `${t.fail_count}/${max ?? '?'}`;
        return t.status === 'READY'
          ? `직전 시도가 실패해 재시도를 기다리고 있습니다. (${budget})`
          : `직전 시도가 실패해 재시도를 실행하고 있습니다. (${budget})`;
      }
      return descMap.get(t.task_definition) || t.description || taskMetaLine(t, null);
    },
    [descMap, detail],
  );

  const retrySelectedDetail = async (): Promise<void> => {
    if (!selected || !detail) return;
    try {
      const d = await getTaskDetail(detail.pipeline_id, selected.task_id);
      setDetailMap((prev) => new Map(prev).set(selected.task_id, d));
    } catch {
      /* keep degraded view */
    }
  };

  if (status === 'notfound') {
    return (
      <div>
        <div className="mb-6">
          <h1 className={text.pageTitle}>페이지를 찾을 수 없어요</h1>
        </div>
        <Card>
          <PlEmptyState
            icon="compass"
            message={
              <>
                알 수 없는 경로입니다.{' '}
                <Link href={passRoutes.pipelines.dashboard} className={text.link}>
                  대시보드로 이동
                </Link>
              </>
            }
            center
          />
        </Card>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <Card>
        <PlEmptyState icon="inbox" message="작업을 불러오지 못했습니다." center />
        <div className="flex justify-center">
          <PlButton variant="secondary" size="sm" onClick={() => setReloadKey((k) => k + 1)}>
            재시도
          </PlButton>
        </div>
      </Card>
    );
  }

  if (!detail) {
    return <div className={cn(detailStyles.skeleton, 'h-40')} aria-hidden="true" />;
  }

  // SDU targets read as "SDU" (over the AWS/GCP/… CSP). The task-definition
  // catalog fetch above still uses the real cloud_provider — SDU is a display
  // concern, not an orchestrator provider.
  const provider = displayProvider(detail.cloud_provider, detail.is_sdu_type);
  const recipeDesc = recipeLabel(detail.recipe_definition)?.desc;
  const selectedDetail = selected ? detailMap.get(selected.task_id) ?? null : null;
  const cancellable = canCancel(detail.status, detail.cancel_requested);
  const { done, total } = progressCount(detail.tasks);
  const running = detail.status === 'RUNNING';
  // Live (PENDING/RUNNING) → the dark exec band carries status + progress + 중단;
  // terminal (DONE/FAILED/CANCELLED) → a plain status badge in the header.
  const live = isLivePipeline(detail.status);
  const cur = currentTaskInfo(detail.status, detail.next_due_at, detail.tasks, resolveName, retryFor);
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  // §8.4 — the band's right slot is "what you can do in this state": live → cancel,
  // restartable failure → restart, DONE → nothing (decision 5). An already-restarted run
  // (restarted_by_pipeline_id) drops the CTA so it is never restarted twice.
  const restartable =
    (detail.status === 'FAILED' || detail.status === 'CANCELLED') &&
    latest?.pipeline_id === detail.pipeline_id &&
    detail.restarted_by_pipeline_id == null;
  const origin = detail.origin ?? null;
  // 실행 구간 (시안 2·5) — 태스크 타임스탬프에서 유도; 시작 전이면 둘 다 null.
  const win = runWindow(detail.status, detail.tasks, detail.last_activity_at);
  const winEndMs = win.end != null ? Date.parse(win.end) : now;
  // Clamped: on a live run winEndMs is the BROWSER clock against a server
  // start — server-ahead skew must read as 0초, not the '-' NaN fallback.
  const elapsedMs =
    win.start != null && winEndMs != null ? Math.max(0, winEndMs - Date.parse(win.start)) : null;
  // 실패 스트립 (시안 1) — FAILED 런의 원인 요약. 재시작이 최신 런(supersededBy)
  // 소관이라 이 화면에 CTA가 없을 때, 그 사유도 이 스트립이 말한다 (침묵 금지).
  const failedTask = detail.status === 'FAILED' ? findFailedTask(detail.tasks) : null;
  const supersededBy =
    (detail.status === 'FAILED' || detail.status === 'CANCELLED') &&
    latest != null &&
    latest.pipeline_id !== detail.pipeline_id
      ? latest.pipeline_id
      : null;

  return (
    <div className={improvedStyles.bleed}>
      {/* Header (design-benchmark round 2, proposal E) — ops target-card grammar:
          bare provider mark + 3-tier identity, CTA at right. The subject
          (target + service) leads; run # and the static page label are the
          context row; the recipe description is the ⓘ tooltip. */}
      <header className={h.root}>
        <div className={h.titleRow}>
          <h1 className={text.pageTitle}>Infra 작업 현황</h1>
          {/* Promoted CTA (owner: "Target 상세 확인 이게 더 중요") — lands on the
              ops console's 인프라 작업 tab. The header's only blue. */}
          <Link
            href={passRoutes.pipelines.ops.targetSource(detail.target_source_id, 'infra')}
            className={cn(
              pipelineStyles.button.base,
              pipelineStyles.button.md,
              pipelineStyles.button.primary,
              h.cta,
            )}
          >
            Target 상세 확인 <Icon name="arrow-ur" size="sm" />
          </Link>
        </div>
        <div className={h.main}>
          <ProviderLogo
            provider={normalizeCloudProvider(detail.cloud_provider)}
            isSdu={detail.is_sdu_type}
            variant="bare"
            className="flex-none self-center"
          />
          <div className={h.body}>
            <div className={h.idRow}>
              {/* Same rule as the ops card: SDU is a classification so it gets a
                  chip, every other provider stays plain — the mark on the left
                  already says the provider, so no tag doubles it. Order is the
                  owner's: "GCP #1002" — provider first. */}
              {detail.is_sdu_type ? (
                <span className={h.sduChip}>SDU</span>
              ) : (
                <span className={h.prov}>{providerLabel(provider)}</span>
              )}
              <span className={h.id}>
                <span className={h.idHash}>#</span>
                {detail.target_source_id}
              </span>
            </div>
            <div className={h.nameRow}>
              <span className={h.klabel}>서비스 이름</span>
              {latest || latestSettled ? (
                <span className={h.name} title={svcName}>
                  {svcName}
                </span>
              ) : (
                /* Before #8 lands — fixed-width skeleton. Drawing the "Target N"
                   fallback first and then swapping it is the text jump this
                   removes; the fallback is for a failed fetch only. */
                <span className={cn(detailStyles.skeleton, 'h-4 w-[220px]')} aria-hidden="true" />
              )}
              {latest?.service_code && (
                <>
                  <span className={h.klabel}>코드</span>
                  <span className={h.code}>{latest.service_code}</span>
                </>
              )}
            </div>
            <div className={h.subRow}>
              {detail.origin_pipeline_id != null && (
                <Link
                  href={passRoutes.pipelines.pipeline(detail.origin_pipeline_id)}
                  title={`원본 작업 #${detail.origin_pipeline_id} 상세로 이동`}
                >
                  <RestartBadge
                    originPipelineId={detail.origin_pipeline_id}
                    className="!text-[12px] !px-2 !py-[3px] hover:brightness-95"
                  />
                </Link>
              )}
              {detail.cancel_requested && (
                <span
                  className={detailStyles.ftag.ext}
                  title="cancel_requested=true 입니다. 다음 실행 사이클에 취소가 반영됩니다."
                >
                  취소 요청됨
                </span>
              )}
              <span className={cn(h.typeTag, detail.type === 'DELETE' && h.typeTagDelete)}>
                {/* "AWS 설치" — provider 에 붙여 한 개념으로 읽히게 한다. */}
                {providerLabel(provider)} {typeKo(detail.type)}
                {recipeDesc && (
                  <span className={h.tipWrap} tabIndex={0} aria-label="레시피 설명 보기">
                    <Icon name="info" size="sm" />
                    <span role="tooltip" className={h.tip}>
                      <span className={h.tipName}>{detail.recipe_definition}</span>
                      <span className={h.tipDesc}>{recipeDesc}</span>
                    </span>
                  </span>
                )}
              </span>
              <span className="whitespace-nowrap tabular-nums">
                작업 등록 {fmtDateTime(detail.created_at)}
              </span>
              {detail.restarted_by_pipeline_id != null && (
                <Link
                  href={passRoutes.pipelines.pipeline(detail.restarted_by_pipeline_id)}
                  className={h.link}
                >
                  재시작됨 ↻ #{detail.restarted_by_pipeline_id} <Icon name="arrow-ur" size="sm" />
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Exec band (node 70:35) — dark, two rows + (live) 중단 at right. Shown for
          every state: 현재 실행 중 / 시작 대기 / 실패 태스크 / 결과 + task + status
          pill, then 진행 단계 · n/total. */}
      <div className={improvedStyles.band.root}>
        <div className={improvedStyles.band.main}>
          <span className={improvedStyles.band.label}>{running ? '현재 실행 중' : cur.label}</span>
          <div className={improvedStyles.band.cell}>
            {/* The 16/bold slot belongs to a task name. A PENDING run's
                scheduled start is context, not a task, so it drops one tier
                (owner). */}
            <span
              className={
                detail.status === 'PENDING' ? improvedStyles.band.curSched : improvedStyles.band.curName
              }
            >
              {cur.name}
            </span>
            <span className={cn(improvedStyles.band.pill, improvedStyles.band.pillTone[detail.status])}>
              {statusKo(detail.status)}
            </span>
          </div>
          <span className={improvedStyles.band.label}>진행 단계</span>
          <div className={improvedStyles.band.cell}>
            {/* 태스크당 세그먼트 (시안 2, GitLab mini-graph 문법) — 어느 단계가
                어떤 상태인지 색으로 직독. 12노드 초과 커스텀 체인은 연속 바 폴백. */}
            {total > 0 && total <= 12 ? (
              <span className={improvedStyles.band.segTrack} aria-hidden="true">
                {detail.tasks.map((t) => (
                  <span
                    key={t.task_id}
                    className={cn(
                      improvedStyles.band.seg,
                      t.status === 'READY' && t.fail_count > 0
                        ? improvedStyles.band.segRetry
                        : improvedStyles.band.segTone[t.status],
                    )}
                  />
                ))}
              </span>
            ) : (
              <span className={improvedStyles.band.track}>
                <span className={improvedStyles.band.fill} style={{ width: `${pct}%` }} />
              </span>
            )}
            <span
              className={improvedStyles.band.count}
              title={
                win.start
                  ? `${fmtDateTime(win.start)} 시작${win.end ? ` → ${fmtDateTime(win.end)} 종료` : ''}`
                  : undefined
              }
            >
              {progressPhrase(detail.status, detail.tasks)}
            </span>
            {elapsedMs != null && (
              <span className={improvedStyles.band.elapsed}>
                · {live ? '경과' : '소요'} {fmtElapsedMs(elapsedMs)}
              </span>
            )}
          </div>
        </div>
        {live ? (
          <PlButton
            variant="dangerSolid"
            disabled={!cancellable}
            onClick={() => cancelModal.open()}
            title={cancellable ? '이 작업을 중단합니다' : '취소 처리 대기 중'}
          >
            중단
          </PlButton>
        ) : restartable ? (
          <PlButton
            variant="primary"
            onClick={() => restartModal.open()}
            title="멈춘 Task부터 새 작업으로 다시 실행합니다."
          >
            <Icon name="play" size="sm" />
            재시작
          </PlButton>
        ) : null}
      </div>

      {/* 실패 스트립 (시안 1 — Step Functions error-banner 문법): 원인 요약과, CTA가
          없을 때 그 사유(최신 실행이 따로 있음)를 한 줄로. 상세 드로어는 로드 시
          자동으로 열린다. */}
      {failedTask && (
        <div className={improvedStyles.failStrip}>
          <span aria-hidden="true">⚠</span>
          <span>
            <b className="font-semibold">{resolveName(failedTask)}</b> 태스크가{' '}
            {failedTask.fail_count}회 실패했습니다
            {failedTask.error_code && (
              <>
                {' · 원인 '}
                <b className="font-semibold">{failedTask.error_code}</b>
              </>
            )}
          </span>
          {supersededBy != null && (
            <span className={improvedStyles.failStripRight}>
              재시작은 최신 실행에서만 가능합니다
              <Link
                href={passRoutes.pipelines.pipeline(supersededBy)}
                className={improvedStyles.failStripLink}
              >
                #{supersededBy} 열기
              </Link>
            </span>
          )}
        </div>
      )}

      {/* §8.4 — restart context strip. Progress (0/N) stays on this run's own suffix;
          this one line explains where it sits in the origin chain (no ghost nodes). */}
      {origin && (
        <div className={improvedStyles.originStrip}>
          <span>↻</span>
          <span>
            원본 <b className="font-semibold">#{origin.pipeline_id}</b>의{' '}
            {origin.total_task_count}단계 중 {origin.done_task_count}단계를 완료했습니다.{' '}
            {origin.resumed_from_sequence != null
              ? `${origin.resumed_from_sequence + 1}단계부터 재실행합니다.`
              : '남은 단계부터 재실행합니다.'}
          </span>
        </div>
      )}

      <TaskFlow
        className="flex-1"
        tasks={detail.tasks}
        resolveName={resolveName}
        resolveMeta={resolveMeta}
        selectedId={selected?.task_id ?? null}
        onOpen={(t) => setSelected((prev) => (prev?.task_id === t.task_id ? null : t))}
        panel={
          selected ? (
            <TaskDrawer
              key={selected.task_id}
              onClose={() => setSelected(null)}
              task={selected}
              detail={selectedDetail}
              detailLoaded={detailMap.has(selected.task_id)}
              displayName={resolveName(selected)}
              onRetry={retrySelectedDetail}
              originHref={
                detail.origin_pipeline_id != null && selected.origin_task_id != null
                  ? `${passRoutes.pipelines.pipeline(detail.origin_pipeline_id)}?task=${selected.origin_task_id}`
                  : null
              }
            />
          ) : undefined
        }
      />

      <CancelModal
        open={cancelModal.isOpen}
        onClose={cancelModal.close}
        pipelineId={detail.pipeline_id}
        onCancelled={(d) => {
          setDetail(d);
          setSelected(null);
          setDetailMap(new Map());
        }}
        showToast={toast.show}
      />

      {/* Mounted only while open — see RestartModal (fresh state per open). */}
      {restartModal.isOpen && (
      <RestartModal
        open={restartModal.isOpen}
        onClose={restartModal.close}
        targetSourceId={detail.target_source_id}
        pipelineId={detail.pipeline_id}
        provider={detail.cloud_provider}
        showToast={toast.show}
        onStale={() => setReloadKey((k) => k + 1)}
      />
      )}
    </div>
  );
}
