'use client';

/**
 * Pipeline detail (C2-b) — design-inventory §2.4. Identity (recipe + target),
 * status bar, and the Task 흐름 canvas. On load it fetches the pipeline (#4), the
 * task catalog once (#12, for display names), and EVERY task's detail (#5) in
 * parallel with a concurrency cap — the meta lines + modal need effective settings
 * / attempts / poll history that TaskSummary lacks (docs §2.4, deliberate). The
 * modal reuses the loaded detail (no refetch). 404 → a not-found state.
 */
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { cn, pipelineStyles } from '@/lib/theme';
import { integrationRoutes } from '@/lib/routes';
import { SectionHeader } from '@/app/integration/admin/pipelines/_components/SectionHeader';
import { Card } from '@/app/integration/admin/pipelines/_components/Card';
import { PlButton } from '@/app/integration/admin/pipelines/_components/PlButton';
import { PlBreadcrumb } from '@/app/integration/admin/pipelines/_components/PlBreadcrumb';
import { PlEmptyState } from '@/app/integration/admin/pipelines/_components/PlEmptyState';
import { usePlToast } from '@/app/integration/admin/pipelines/_components/usePlToast';
import { IdentityBar, IdentityFieldBlock } from '@/app/integration/admin/pipelines/_detail/IdentityBar';
import { PipelineStatusBar } from '@/app/integration/admin/pipelines/_detail/PipelineStatusBar';
import { TaskFlow } from '@/app/integration/admin/pipelines/_detail/TaskFlow';
import { TaskDetailModal } from '@/app/integration/admin/pipelines/_detail/TaskDetailModal';
import { CancelModal } from '@/app/integration/admin/pipelines/_detail/CancelModal';
import { RoundNavLink } from '@/app/integration/admin/pipelines/_detail/RoundNavLink';
import { detailStyles } from '@/app/integration/admin/pipelines/_detail/detailStyles';
import { pipelineCrumbs } from '@/app/integration/admin/pipelines/_detail/pipelineBreadcrumb';
import { taskDisplayName, retrySuffix } from '@/app/integration/admin/pipelines/_detail/statusModel';
import {
  buildTargetHref,
  fmtDateTime,
  parsePipelineNavContext,
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

/** Run `fn` over `items` with at most `limit` in flight; preserves order. */
async function mapPool<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const worker = async (): Promise<void> => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

type LoadStatus = 'loading' | 'ready' | 'notfound' | 'error';

export function PipelineDetailView(): ReactElement {
  const params = useParams<{ pipelineId: string }>();
  const searchParams = useSearchParams();
  const pipelineId = String(params.pipelineId);
  const ctx = parsePipelineNavContext(searchParams);
  const toast = usePlToast();
  const { text } = pipelineStyles;

  const [detail, setDetail] = useState<PipelineDetail | null>(null);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [catalog, setCatalog] = useState<ReadonlyMap<string, string>>(new Map());
  const [detailMap, setDetailMap] = useState<ReadonlyMap<number, TaskDetail | null>>(new Map());
  const [detailsLoaded, setDetailsLoaded] = useState(false);
  const [selected, setSelected] = useState<TaskSummary | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const loadTaskDetails = useCallback(async (d: PipelineDetail): Promise<Map<number, TaskDetail | null>> => {
    const entries = await mapPool(d.tasks, DETAIL_CONCURRENCY, async (t) => {
      try {
        return [t.task_id, await getTaskDetail(d.pipeline_id, t.task_id)] as const;
      } catch {
        return [t.task_id, null] as const;
      }
    });
    return new Map(entries);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStatus('loading');
      setDetail(null);
      setDetailMap(new Map());
      setDetailsLoaded(false);
      try {
        const d = await getPipeline(pipelineId);
        if (cancelled) return;
        setDetail(d);
        setStatus('ready');
        getTaskDefinitions(d.cloud_provider)
          .then((res) => !cancelled && setCatalog(new Map(res.task_definitions.map((c) => [c.name, c.display_name]))))
          .catch(() => {});
        const map = await loadTaskDetails(d);
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

  return (
    <div>
      <PlBreadcrumb crumbs={pipelineCrumbs(ctx, pipelineId, detail.target_source_id)} />
      <div className="mb-6">
        <h1 className={text.pageTitle}>
          파이프라인 <span className="[font-variant-numeric:tabular-nums]">#{detail.pipeline_id}</span>
        </h1>
      </div>

      <IdentityBar
        accentVar={providerAccentVar(provider)}
        icon="flow"
        pname={recipeDisplayName(detail.recipe_definition)}
        psub={detail.recipe_definition || '-'}
        psubMono
        fields={[
          { key: '파이프라인 유형', value: detail.type },
          { key: '생성', value: fmtDateTime(detail.created_at) },
          { key: '마지막 활동', value: fmtDateTime(detail.last_activity_at) },
        ]}
        trailing={
          <>
            <IdentityFieldBlock
              label="대상"
              value={`${detail.target_source_id} · ${providerLabel(provider)}`}
            />
            <RoundNavLink href={buildTargetHref(detail.target_source_id, ctx)} title="대상 상세로 이동" />
          </>
        }
        meta={recipeDesc ? <div className={detailStyles.idbar.note}>{recipeDesc}</div> : undefined}
      />

      <SectionHeader
        title="Task 흐름"
        desc="파이프라인의 현재 상태와 task 실행 순서 — 노드를 클릭하면 상세가 열리고, task가 많으면 좌우로 스크롤됩니다"
      />
      <PipelineStatusBar
        detail={detail}
        variant="pipeline"
        resolveName={resolveName}
        retryFor={retryFor}
        onCancel={() => setCancelOpen(true)}
      />
      <TaskFlow tasks={detail.tasks} detailMap={detailMap} resolveName={resolveName} onOpen={setSelected} />

      {selected && (
        <TaskDetailModal
          open
          onClose={() => setSelected(null)}
          task={selected}
          detail={selectedDetail}
          detailLoaded={detailsLoaded}
          displayName={resolveName(selected)}
          onRetry={retrySelectedDetail}
        />
      )}
      <CancelModal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        pipelineId={detail.pipeline_id}
        onCancelled={(d) => {
          setDetail(d);
          void loadTaskDetails(d).then(setDetailMap);
        }}
        showToast={toast.show}
      />
    </div>
  );
}
