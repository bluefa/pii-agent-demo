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
import { Card } from '@/app/admin/pipelines/_components/Card';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { PlEmptyState } from '@/app/admin/pipelines/_components/PlEmptyState';
import { PipelineTypeTag } from '@/app/admin/pipelines/_components/PipelineTypeTag';
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
  taskDisplayName,
  retrySuffix,
} from '@/app/admin/pipelines/_detail/statusModel';
import {
  canCancel,
  displayProvider,
  fmtDateTime,
  isLivePipeline,
  progressCount,
  providerLabel,
  recipeLabel,
  taskMetaLine,
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
        if (deepLinked) setSelected(deepLinked);
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
          .catch(() => {});
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
  const svcName = latest?.service_name || latest?.service_code || `Target ${detail.target_source_id}`;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  // §8.4 — the band's right slot is "what you can do in this state": live → cancel,
  // restartable failure → restart, DONE → nothing (decision 5). An already-restarted run
  // (restarted_by_pipeline_id) drops the CTA so it is never restarted twice.
  const restartable =
    (detail.status === 'FAILED' || detail.status === 'CANCELLED') &&
    latest?.pipeline_id === detail.pipeline_id &&
    detail.restarted_by_pipeline_id == null;
  const origin = detail.origin ?? null;

  return (
    <div className={improvedStyles.bleed}>
      {/* Header (node 70:35) */}
      <header className={h.root}>
        <div className={h.topRow}>
          <div className={h.titleWrap}>
            <div className={h.titleRow}>
              <h1 className={h.title}>작업 현황</h1>
              <span className={h.id}>#{detail.pipeline_id}</span>
              {/* The restart identity belongs next to the run's own id — an operator
                  must not have to read the meta grid to learn this is a re-run. */}
              {detail.origin_pipeline_id != null && (
                <Link
                  href={passRoutes.pipelines.pipeline(detail.origin_pipeline_id)}
                  title={`원본 작업 #${detail.origin_pipeline_id} 상세로 이동`}
                >
                  <RestartBadge
                    originPipelineId={detail.origin_pipeline_id}
                    className="!text-[12.5px] !px-3 !py-[4px] hover:brightness-95"
                  />
                </Link>
              )}
              {/* Status is shown in the exec band (below) for every state. */}
              {detail.cancel_requested && (
                <span className={detailStyles.ftag.ext} title="cancel_requested=true 입니다. 다음 실행 사이클에 취소가 반영됩니다.">
                  취소 요청됨
                </span>
              )}
            </div>
            {recipeDesc && <p className={h.desc}>{recipeDesc}</p>}
          </div>
        </div>

        <div className={h.metaGrid}>
          <span className={h.groupLabel}>작업</span>
          <div className={h.pair}>
            <span className={h.k}>유형</span>
            <PipelineTypeTag type={detail.type} />
          </div>
          <div className={h.pair}>
            <span className={h.k}>서비스 이름</span>
            <span className={h.vStrong}>{svcName}</span>
            {detail.recipe_definition && <span className={h.vMono}>{detail.recipe_definition}</span>}
          </div>
          <div className={h.pair}>
            <span className={h.k}>생성 시간</span>
            <span className={h.v}>{fmtDateTime(detail.created_at)}</span>
          </div>

          <span className={h.groupLabel}>Target Source</span>
          <div className={h.pair}>
            <span className={h.k}>Cloud</span>
            <span className={h.v}>{providerLabel(provider)}</span>
          </div>
          <div className={h.pair}>
            <span className={h.k}>TargetSourceId</span>
            <span className={cn(h.v, 'tabular-nums')}>{detail.target_source_id}</span>
          </div>
          {/* Lands on the ops console's 인프라 작업 tab: the operator came from a
              pipeline, so the tab that continues that thread is the one to open. */}
          <Link
            href={passRoutes.pipelines.ops.targetSource(detail.target_source_id, 'infra')}
            className={h.link}
          >
            Target 상세 확인 <Icon name="arrow-ur" size="sm" />
          </Link>

          {/* §8.4 — bidirectional provenance. Walking to the origin and to the restart from
              one place is what tells an operator "this was already handled". */}
          {(detail.origin_pipeline_id != null || detail.restarted_by_pipeline_id != null) && (
            <>
              <span className={h.groupLabel}>계보</span>
              {detail.origin_pipeline_id != null && (
                <div className={h.pair}>
                  <span className={h.k}>원본 작업</span>
                  <Link
                    href={passRoutes.pipelines.pipeline(detail.origin_pipeline_id)}
                    className={h.link}
                  >
                    #{detail.origin_pipeline_id} <Icon name="arrow-ur" size="sm" />
                  </Link>
                </div>
              )}
              {detail.restarted_by_pipeline_id != null && (
                <div className={h.pair}>
                  <span className={h.k}>재시작됨</span>
                  <Link
                    href={passRoutes.pipelines.pipeline(detail.restarted_by_pipeline_id)}
                    className={h.link}
                  >
                    ↻ #{detail.restarted_by_pipeline_id} <Icon name="arrow-ur" size="sm" />
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      </header>

      {/* Exec band (node 70:35) — dark, two rows + (live) 중단 at right. Shown for
          every state: 현재 실행 중 / 시작 대기 / 실패 태스크 / 결과 + task + status
          pill, then 진행 단계 · n/total. */}
      <div className={improvedStyles.band.root}>
        <div className={improvedStyles.band.main}>
          <span className={improvedStyles.band.label}>{running ? '현재 실행 중' : cur.label}</span>
          <div className={improvedStyles.band.cell}>
            <span className={improvedStyles.band.curName}>{cur.name}</span>
            <span className={cn(improvedStyles.band.pill, improvedStyles.band.pillTone[detail.status])}>
              {detail.status}
            </span>
          </div>
          <span className={improvedStyles.band.label}>진행 단계</span>
          <div className={improvedStyles.band.cell}>
            <span className={improvedStyles.band.track}>
              <span className={improvedStyles.band.fill} style={{ width: `${pct}%` }} />
            </span>
            <span className={improvedStyles.band.count}>
              {done} / {total}
            </span>
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
