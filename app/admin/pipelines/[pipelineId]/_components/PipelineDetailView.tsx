'use client';

/**
 * Pipeline detail — Figma "pipeline-detail-improved" redesign. The data layer
 * (pipeline #4 + task catalog #12 + every task detail #5 under a concurrency
 * cap, plus the R23 10s live-poll) is unchanged from the R22 version; only the
 * presentation is restructured to match Figma node 70:35:
 *   · a full-bleed header — Korean title + #id, a recipe description line, and
 *     two column-aligned meta rows (파이프라인 / Target Source). Status badge
 *     and [중단] appear here only when NOT running (the band carries them
 *     while live). No tab bar: the ownership meta now lives in the header.
 *   · a RUNNING-only dark progress band (현재 실행 중 · task · RUNNING pill /
 *     진행 단계 · bar · n/total) with [중단] at the right, then the flow canvas.
 * The header service line (name + code) comes from the reused target-source
 * detail (getRawTargetSourceDetail) — PipelineDetail carries neither field.
 */
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useModal } from '@/app/hooks/useModal';
import { cn, pipelineStyles } from '@/lib/theme';
import { integrationRoutes } from '@/lib/routes';
import { Card } from '@/app/admin/pipelines/_components/Card';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { PlEmptyState } from '@/app/admin/pipelines/_components/PlEmptyState';
import { PipelineTypeTag } from '@/app/admin/pipelines/_components/PipelineTypeTag';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { usePlToast } from '@/app/admin/pipelines/_components/usePlToast';
import { TaskFlow } from '@/app/admin/pipelines/_detail/TaskFlow';
import { TaskDrawer } from '@/app/admin/pipelines/_detail/TaskDrawer';
import { CancelModal } from '@/app/admin/pipelines/_detail/CancelModal';
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
  fmtDateTime,
  isLivePipeline,
  progressCount,
  providerLabel,
  recipeLabel,
  taskMetaLine,
} from '@/lib/pipeline/format';
import {
  getPipeline,
  getTaskDefinitions,
  getTaskDetail,
  listPipelinesByTarget,
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
  // Owning-service identity for the header — the SAME value the dashboard shows
  // (PipelineSummary.service_*, i.e. project code/name). PipelineDetail omits it,
  // so we read it off any of this target's pipeline summaries (all share it).
  const [svc, setSvc] = useState<Pick<PipelineSummary, 'service_code' | 'service_name'> | null>(null);
  const [selected, setSelected] = useState<TaskSummary | null>(null);
  const cancelModal = useModal();
  const [reloadKey, setReloadKey] = useState(0);

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
        getTaskDefinitions(d.cloud_provider)
          .then((res) => {
            if (cancelled) return;
            setCatalog(new Map(res.task_definitions.map((c) => [c.name, c.display_name])));
            setDescMap(new Map(res.task_definitions.map((c) => [c.name, c.description])));
          })
          .catch(() => {});
        // Service name/code for the header (PipelineDetail carries neither) —
        // read off any of this target's pipeline summaries so it matches the
        // dashboard exactly; degrade silently on failure.
        listPipelinesByTarget(d.target_source_id, { page: 0, size: 1 })
          .then((page) => !cancelled && setSvc(page.content[0] ?? null))
          .catch(() => {});
      } catch (err) {
        if (cancelled) return;
        setStatus(err instanceof OrchestratorApiError && err.status === 404 ? 'notfound' : 'error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pipelineId, reloadKey]);

  // Lazy task-detail fetch: only when the operator opens a task and its detail
  // isn't cached yet. `detailMap.has` gates both the fetch and the drawer skeleton.
  useEffect(() => {
    if (!selected || !detail || detailMap.has(selected.task_id)) return;
    const taskId = selected.task_id;
    const pipeId = detail.pipeline_id;
    let cancelled = false;
    getTaskDetail(pipeId, taskId)
      .then((d) => !cancelled && setDetailMap((prev) => new Map(prev).set(taskId, d)))
      .catch(() => !cancelled && setDetailMap((prev) => new Map(prev).set(taskId, null)));
    return () => {
      cancelled = true;
    };
  }, [selected, detail, detailMap]);

  // R23 (C안) — 10s poll while live: refetch pipeline + only the details whose
  // summary moved (+ the open task). Terminalizing drops the interval.
  useEffect(() => {
    if (status !== 'ready' || !detail || !isLivePipeline(detail.status)) return;
    let cancelled = false;
    const tick = async (): Promise<void> => {
      if (document.hidden) return;
      try {
        const next = await getPipeline(pipelineId);
        // Only the OPEN task's detail is refetched (it's the only one shown); every
        // other cached detail whose summary moved is evicted so a later re-open
        // refetches it fresh.
        let openDetail: TaskDetail | null | undefined;
        if (selected) {
          try {
            openDetail = await getTaskDetail(next.pipeline_id, selected.task_id);
          } catch {
            openDetail = undefined;
          }
        }
        if (cancelled) return;
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
        /* transient poll failure — silent, the next tick retries */
      }
    };
    const id = window.setInterval(() => {
      void tick();
    }, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
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

  // Node subtitle without a per-task fetch: FAILED → 실패 N회 — CODE (fail_count
  // from the summary; the precise f/m retry budget lives in the drawer, which
  // loads the task detail). Otherwise catalog description → operator description
  // → status meta line.
  const resolveMeta = useCallback(
    (t: TaskSummary): string => {
      if (t.status === 'FAILED') {
        return `실패 ${t.fail_count}회 — ${t.error_code ?? '원인 미기록'}`;
      }
      return descMap.get(t.task_definition) || t.description || taskMetaLine(t, null);
    },
    [descMap],
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
                <Link href={integrationRoutes.pipelines.dashboard} className={text.link}>
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
        <PlEmptyState icon="inbox" message="파이프라인을 불러오지 못했습니다" center />
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

  const provider = detail.cloud_provider;
  const recipeDesc = recipeLabel(detail.recipe_definition)?.desc;
  const selectedDetail = selected ? detailMap.get(selected.task_id) ?? null : null;
  const cancellable = canCancel(detail.status, detail.cancel_requested);
  const { done, total } = progressCount(detail.tasks);
  const running = detail.status === 'RUNNING';
  // Live (PENDING/RUNNING) → the dark exec band carries status + progress + 중단;
  // terminal (DONE/FAILED/CANCELLED) → a plain status badge in the header.
  const live = isLivePipeline(detail.status);
  const cur = currentTaskInfo(detail.status, detail.next_due_at, detail.tasks, resolveName, retryFor);
  const svcName = svc?.service_name || svc?.service_code || `Target ${detail.target_source_id}`;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <div className={improvedStyles.bleed}>
      {/* Header (node 70:35) */}
      <header className={h.root}>
        <div className={h.topRow}>
          <div className={h.titleWrap}>
            <div className={h.titleRow}>
              <h1 className={h.title}>파이프라인 현황</h1>
              <span className={h.id}>#{detail.pipeline_id}</span>
              {/* Status is shown in the exec band (below) for every state. */}
              {detail.cancel_requested && (
                <span className={detailStyles.ftag.ext} title="cancel_requested=true — 다음 실행 사이클에 취소가 반영됩니다">
                  취소 요청됨
                </span>
              )}
            </div>
            {recipeDesc && <p className={h.desc}>{recipeDesc}</p>}
          </div>
        </div>

        <div className={h.metaGrid}>
          <span className={h.groupLabel}>파이프라인</span>
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
          <Link href={integrationRoutes.pipelines.target(detail.target_source_id)} className={h.link}>
            Target 상세 확인 <Icon name="arrow-ur" size="sm" />
          </Link>
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
        {live && (
          <PlButton
            variant="dangerSolid"
            disabled={!cancellable}
            onClick={() => cancelModal.open()}
            title={cancellable ? '이 파이프라인을 중단합니다' : '취소 처리 대기 중'}
          >
            중단
          </PlButton>
        )}
      </div>

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
    </div>
  );
}
