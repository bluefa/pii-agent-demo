'use client';

/**
 * Pipeline detail (C2-b) — design-inventory §2.4, restructured per R18
 * (admin-pipeline-improvement-r18.md §6·§7): h1 "파이프라인 현황" + [중단]
 * dangerSolid CTA, target-first identity strip, and ONE merged flow card
 * (run-level / task-level header zones + canvas + inline right panel). On load
 * it fetches the pipeline (#4), the task catalog once (#12), and EVERY task's
 * detail (#5) with a concurrency cap — the meta lines + panel need effective
 * settings / attempts that TaskSummary lacks. 404 → a not-found state.
 */
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useModal } from '@/app/hooks/useModal';
import { cn, pipelineStyles } from '@/lib/theme';
import { integrationRoutes } from '@/lib/routes';
import { SectionHeader } from '@/app/integration/admin/pipelines/_components/SectionHeader';
import { Card } from '@/app/integration/admin/pipelines/_components/Card';
import { PlButton } from '@/app/integration/admin/pipelines/_components/PlButton';
import { PlBreadcrumb } from '@/app/integration/admin/pipelines/_components/PlBreadcrumb';
import { PlEmptyState } from '@/app/integration/admin/pipelines/_components/PlEmptyState';
import { StatusPill } from '@/app/integration/admin/pipelines/_components/StatusPill';
import { PipelineProgressBar } from '@/app/integration/admin/pipelines/_components/PipelineProgressBar';
import { PipelineTypeTag } from '@/app/integration/admin/pipelines/_components/PipelineTypeTag';
import { Icon } from '@/app/integration/admin/pipelines/_components/icons';
import { usePlToast } from '@/app/integration/admin/pipelines/_components/usePlToast';
import { IdentityBar, IdentityFieldBlock } from '@/app/integration/admin/pipelines/_detail/IdentityBar';
import { TaskFlow } from '@/app/integration/admin/pipelines/_detail/TaskFlow';
import { TaskDetailPanel } from '@/app/integration/admin/pipelines/_detail/TaskDetailPanel';
import { CancelModal } from '@/app/integration/admin/pipelines/_detail/CancelModal';
import { RoundNavLink } from '@/app/integration/admin/pipelines/_detail/RoundNavLink';
import { detailStyles } from '@/app/integration/admin/pipelines/_detail/detailStyles';
import { pipelineCrumbs } from '@/app/integration/admin/pipelines/_detail/pipelineBreadcrumb';
import { mapPool } from '@/app/integration/admin/pipelines/_detail/mapPool';
import {
  currentTaskInfo,
  findFailedTask,
  taskDisplayName,
  retrySuffix,
} from '@/app/integration/admin/pipelines/_detail/statusModel';
import {
  canCancel,
  fmtDateTime,
  progressCount,
  providerAccentVar,
  providerLabel,
  recipeDisplayName,
  recipeLabel,
} from '@/lib/pipeline/format';
import {
  getPipeline,
  getTaskDefinitions,
  getTaskDetail,
  OrchestratorApiError,
} from '@/app/lib/api/pipeline';
import type { PipelineDetail, TaskDetail, TaskSummary } from '@/lib/pipeline/types';

const DETAIL_CONCURRENCY = 6;

type LoadStatus = 'loading' | 'ready' | 'notfound' | 'error';

export function PipelineDetailView(): ReactElement {
  const params = useParams<{ pipelineId: string }>();
  const pipelineId = String(params.pipelineId);
  const toast = usePlToast();
  const { text } = pipelineStyles;

  const [detail, setDetail] = useState<PipelineDetail | null>(null);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [catalog, setCatalog] = useState<ReadonlyMap<string, string>>(new Map());
  const [detailMap, setDetailMap] = useState<ReadonlyMap<number, TaskDetail | null>>(new Map());
  const [detailsLoaded, setDetailsLoaded] = useState(false);
  // R18 §7-3: task detail is an INLINE panel (not a modal), so plain state —
  // the useModal rule applies to dialog flows only. CancelModal stays a modal.
  const [selected, setSelected] = useState<TaskSummary | null>(null);
  const cancelModal = useModal();
  const [reloadKey, setReloadKey] = useState(0);

  const loadTaskDetails = useCallback(
    async (
      d: PipelineDetail,
      shouldContinue: () => boolean = () => true,
    ): Promise<Map<number, TaskDetail | null>> => {
      const entries = await mapPool(
        d.tasks,
        DETAIL_CONCURRENCY,
        async (t) => {
          try {
            return [t.task_id, await getTaskDetail(d.pipeline_id, t.task_id)] as const;
          } catch {
            return [t.task_id, null] as const;
          }
        },
        shouldContinue,
      );
      // Aborted pools leave holes — .filter compacts them (skips sparse slots).
      return new Map(entries.filter((entry) => entry !== undefined));
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStatus('loading');
      setDetail(null);
      setDetailMap(new Map());
      setDetailsLoaded(false);
      setSelected(null);
      try {
        const d = await getPipeline(pipelineId);
        if (cancelled) return;
        setDetail(d);
        setStatus('ready');
        getTaskDefinitions(d.cloud_provider)
          .then((res) => !cancelled && setCatalog(new Map(res.task_definitions.map((c) => [c.name, c.display_name]))))
          .catch(() => {});
        // Stop LAUNCHING task-detail fetches once unmounted / route changed
        // (in-flight ones may finish; their map is discarded below).
        const map = await loadTaskDetails(d, () => !cancelled);
        if (!cancelled) {
          setDetailMap(map);
          setDetailsLoaded(true);
        }
      } catch (err) {
        if (cancelled) return;
        setStatus(err instanceof OrchestratorApiError && err.status === 404 ? 'notfound' : 'error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pipelineId, reloadKey, loadTaskDetails]);

  const resolveName = useCallback(
    (t: TaskSummary): string => taskDisplayName(t, detailMap.get(t.task_id), catalog),
    [detailMap, catalog],
  );

  const retryFor = useCallback(
    (t: TaskSummary): string | null =>
      retrySuffix(t.fail_count, detailMap.get(t.task_id)?.effective_max_fail_count),
    [detailMap],
  );

  // Plain function (React Compiler memoizes; a manual useCallback here conflicts
  // with the compiler's inferred deps for the functional setState update).
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
  const fc = detailStyles.flowCard;
  const failed = detail.status === 'FAILED';
  const cancellable = canCancel(detail.status, detail.cancel_requested);
  const { done, total } = progressCount(detail.tasks);
  const cur = currentTaskInfo(detail.status, detail.next_due_at, detail.tasks, resolveName, retryFor);
  const failedTask = findFailedTask(detail.tasks);

  return (
    <div>
      <PlBreadcrumb crumbs={pipelineCrumbs(pipelineId, detail.target_source_id)} />
      {/* R18 §6·§7-1 — id demoted out of the h1; [중단] is the page's danger CTA. */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className={text.pageTitle}>파이프라인 현황</h1>
        <PlButton
          variant="dangerSolid"
          disabled={!cancellable}
          onClick={() => cancelModal.open()}
          title={
            cancellable
              ? '이 파이프라인을 중단합니다'
              : detail.cancel_requested
                ? '취소 처리 대기 중'
                : '진행·대기 중만 중단 가능'
          }
        >
          <Icon name="stop" size="sm" />
          중단
        </PlButton>
      </div>

      {/* R18 §6 — target-first identity: 어떤 Target Source인지가 먼저다. */}
      <IdentityBar
        accentVar={providerAccentVar(provider)}
        icon="cloud"
        pname={
          <span className="tabular-nums">
            {detail.target_source_id} · {providerLabel(provider)}
          </span>
        }
        psub={recipeDisplayName(detail.recipe_definition)}
        fields={[
          { key: '유형', value: <PipelineTypeTag type={detail.type} /> },
          { key: '생성', value: fmtDateTime(detail.created_at) },
          { key: '마지막 활동', value: fmtDateTime(detail.last_activity_at) },
        ]}
        trailing={
          <>
            <IdentityFieldBlock
              label="실행 ID"
              value={<span className="text-[var(--pl-text-faint)]">#{detail.pipeline_id}</span>}
            />
            <RoundNavLink
              href={integrationRoutes.pipelines.target(detail.target_source_id)}
              title="대상 상세로 이동"
            />
          </>
        }
        meta={
          recipeDesc || detail.recipe_definition ? (
            <div className={detailStyles.idbar.note}>
              {detail.recipe_definition && <span className={text.mono}>{detail.recipe_definition}</span>}
              {detail.recipe_definition && recipeDesc ? ' — ' : null}
              {recipeDesc}
            </div>
          ) : undefined
        }
      />

      <SectionHeader
        title="Task 흐름"
        desc="노드를 클릭하면 상세가 우측 패널로 열립니다 · task가 많으면 캔버스가 좌우로 스크롤됩니다"
      />

      {/* R20 — ONE card, one fact per header row: 태스크 / 상태 / 진행 상태. */}
      <Card>
        <div className={cn(fc.head, failed ? fc.headFailed : fc.headIdle)}>
          <div className={fc.row}>
            <span className={fc.rowLabel}>{cur.label}</span>
            <span className={fc.taskName}>{cur.name}</span>
            {cur.retry && <span className={fc.taskRetry}>{cur.retry}</span>}
            {failedTask?.error_code && (
              <span className={fc.err} title={resolveName(failedTask)}>
                {failedTask.error_code}
              </span>
            )}
          </div>

          <div className={fc.row}>
            <span className={fc.rowLabel}>상태</span>
            <StatusPill
              status={detail.status}
              size="lg"
              className={failed ? fc.pillFailedRing : undefined}
            />
            {detail.cancel_requested && (
              <span
                className={detailStyles.ftag.ext}
                title="cancel_requested=true — 다음 실행 사이클에 취소가 반영됩니다"
              >
                취소 요청됨
              </span>
            )}
          </div>

          <div className={fc.row}>
            <span className={fc.rowLabel}>진행 상태</span>
            <PipelineProgressBar n={done} m={total} status={detail.status} wide />
            {detail.status === 'RUNNING' && detail.next_due_at && (
              <span className={fc.rowMeta} title="next_due_at — 다음 폴링/실행 예정 시각">
                다음 실행 {fmtDateTime(detail.next_due_at)}
              </span>
            )}
          </div>
        </div>

        <div className={fc.body}>
          <TaskFlow
            className={fc.canvas}
            tasks={detail.tasks}
            detailMap={detailMap}
            resolveName={resolveName}
            provider={provider}
            selectedId={selected?.task_id ?? null}
            onOpen={(t) => setSelected((prev) => (prev?.task_id === t.task_id ? null : t))}
            panel={
              selected ? (
                <TaskDetailPanel
                  onClose={() => setSelected(null)}
                  task={selected}
                  detail={selectedDetail}
                  detailLoaded={detailsLoaded}
                  displayName={resolveName(selected)}
                  onRetry={retrySelectedDetail}
                />
              ) : undefined
            }
          />
        </div>
      </Card>

      <CancelModal
        open={cancelModal.isOpen}
        onClose={cancelModal.close}
        pipelineId={detail.pipeline_id}
        onCancelled={(d) => {
          setDetail(d);
          setSelected(null);
          void loadTaskDetails(d).then(setDetailMap);
        }}
        showToast={toast.show}
      />
    </div>
  );
}
