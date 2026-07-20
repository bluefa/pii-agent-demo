'use client';

/**
 * P5 연결 테스트 상세 (`/admin/pipelines/queue/test-connections/[targetSourceId]`).
 *
 * Header/status comes from the single test-connection/status route (works for
 * every queue row). The per-resource 결과 table + 논리 DB modal come from the
 * latest-results / by-resource-id routes, fetched independently so the header +
 * reject-box still render if those results are unavailable. Actions (재실행 요청 /
 * 연동 승인) show only in the 완료 state; a 재실행 요청 flips the status (refetch).
 *
 * NOTE (mock gap, reported to the lead): the demo queue target ids are not backed
 * by mock projects, so latest-results / by-resource-id return 404 in mock mode —
 * the 결과 section degrades to its empty state until the fixtures are wired.
 */
import { useCallback, useState, type ReactElement } from 'react';
import { useParams } from 'next/navigation';

import { useAbortableEffect } from '@/app/hooks/useAbortableEffect';
import { useApiAction, useApiMutation } from '@/app/hooks/useApiMutation';
import { cn, pipelineStyles } from '@/lib/theme';
import { integrationRoutes } from '@/lib/routes';
import { fmtDateTime } from '@/lib/pipeline/format';
import {
  getTestConnectionDetail,
  getTestConnectionResults,
  getTestedLogicalDatabases,
  getExcludedLogicalDatabases,
  rejectTestConnection,
  confirmInstallation,
  type TcResultRow,
} from '@/app/lib/api/task-queue-tc';
import type { TestConnectionStatusRow } from '@/lib/types/task-queue';

import { Card } from '@/app/admin/pipelines/_components/Card';
import { PlBreadcrumb } from '@/app/admin/pipelines/_components/PlBreadcrumb';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { ProvTag } from '@/app/admin/pipelines/_components/ProvTag';
import { SectionHeader } from '@/app/admin/pipelines/_components/SectionHeader';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { usePlToast } from '@/app/admin/pipelines/_components/usePlToast';
import { tqStyles } from '@/app/admin/pipelines/queue/_components/tqStyles';
import { TqEmptyState } from '@/app/admin/pipelines/queue/_components/bits';
import { TcStatePill } from '@/app/admin/pipelines/queue/test-connections/_tc/TcStatePill';
import { TcResultsTable } from '@/app/admin/pipelines/queue/test-connections/_tc/TcResultsTable';
import { LdbModal } from '@/app/admin/pipelines/queue/test-connections/_tc/LdbModal';
import {
  TcRerunModal,
  TcApproveModal,
} from '@/app/admin/pipelines/queue/test-connections/_tc/TcActionModals';
import {
  tcResultStats,
  putLdbCache,
  type LdbCache,
  type LdbTab,
} from '@/app/admin/pipelines/queue/test-connections/_tc/logic';

const COMPLETED = 'TEST_CONNECTION_COMPLETED';

interface LdbTarget {
  resourceId: string;
  databaseType: string | null;
  targetLabel: string;
  tab: LdbTab;
}

export default function TestConnectionDetailPage(): ReactElement {
  const params = useParams<{ targetSourceId: string }>();
  const targetSourceId = Number(params.targetSourceId);
  const toast = usePlToast();
  const { text } = pipelineStyles;

  const [detail, setDetail] = useState<TestConnectionStatusRow | null>(null);
  const [detailLoading, setDetailLoading] = useState(true);
  const [detailError, setDetailError] = useState<unknown>(null);

  const [results, setResults] = useState<TcResultRow[] | null>(null);
  const [resultsError, setResultsError] = useState<unknown>(null);

  const [reload, setReload] = useState(0);
  const refetch = useCallback(() => setReload((n) => n + 1), []);

  // 논리 DB modal + per-resource cache (reused across tab cycles).
  const [ldbCache, setLdbCache] = useState<LdbCache>({});
  const [ldbTarget, setLdbTarget] = useState<LdbTarget | null>(null);

  const [rerunOpen, setRerunOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);

  // Header/status — gates the page.
  useAbortableEffect(
    (signal) => {
      if (!Number.isFinite(targetSourceId)) {
        setDetailError(new Error('잘못된 대상입니다'));
        setDetailLoading(false);
        return;
      }
      setDetailLoading(true);
      setDetailError(null);
      return getTestConnectionDetail(targetSourceId, { signal })
        .then((row) => {
          if (signal.aborted) return;
          setDetail(row);
          setDetailLoading(false);
        })
        .catch((err) => {
          if (signal.aborted) return;
          setDetailError(err);
          setDetailLoading(false);
        });
    },
    [targetSourceId, reload],
  );

  // Per-resource results — independent (failure keeps the header/reject-box).
  useAbortableEffect(
    (signal) => {
      if (!Number.isFinite(targetSourceId)) return;
      setResultsError(null);
      return getTestConnectionResults(targetSourceId, { signal })
        .then((rows) => {
          if (signal.aborted) return;
          setResults(rows);
        })
        .catch((err) => {
          if (signal.aborted) return;
          setResultsError(err);
          setResults([]);
        });
    },
    [targetSourceId, reload],
  );

  // Lazy per-resource load. A failure caches an `error` entry (NOT empty arrays)
  // so the modal shows a retry affordance instead of a false "no logical DBs".
  const loadLdb = useCallback(
    (resourceId: string) => {
      void Promise.all([
        getTestedLogicalDatabases(targetSourceId, resourceId),
        getExcludedLogicalDatabases(targetSourceId, resourceId),
      ])
        .then(([included, excluded]) => {
          setLdbCache((prev) => putLdbCache(prev, resourceId, { included, excluded }));
        })
        .catch(() => {
          setLdbCache((prev) =>
            putLdbCache(prev, resourceId, { included: [], excluded: [], error: true }),
          );
        });
    },
    [targetSourceId],
  );

  const openLdb = useCallback(
    (resourceId: string, tab: LdbTab) => {
      const row = results?.find((r) => r.resourceId === resourceId);
      setLdbTarget({
        resourceId,
        databaseType: row?.databaseType ?? null,
        targetLabel: row?.connectionTarget || resourceId,
        tab,
      });
      // Skip the fetch only when a successful entry is already cached; a prior
      // error re-attempts on reopen.
      const cached = ldbCache[resourceId];
      if (cached && !cached.error) return;
      loadLdb(resourceId);
    },
    [results, ldbCache, loadLdb],
  );

  const retryLdb = useCallback(
    (resourceId: string) => {
      // Drop the errored entry so the modal shows loading, then re-fetch.
      setLdbCache((prev) => {
        const next = { ...prev };
        delete next[resourceId];
        return next;
      });
      loadLdb(resourceId);
    },
    [loadLdb],
  );

  // On failure the modal stays open (onSuccess is skipped, submitting resets) and
  // the error surfaces via the section toast — the pipeline pages' norm.
  const rerun = useApiMutation((reason: string) => rejectTestConnection(targetSourceId, reason), {
    onSuccess: () => {
      setRerunOpen(false);
      toast.show('재실행을 요청했어요');
      refetch();
    },
    onError: () => toast.show('재실행 요청에 실패했어요'),
  });

  const approve = useApiAction(() => confirmInstallation(targetSourceId), {
    onSuccess: () => {
      setApproveOpen(false);
      toast.show('연동을 승인했어요 — 연동이 완료됐어요');
      refetch();
    },
    onError: () => toast.show('연동 승인에 실패했어요'),
  });

  const crumbs = [
    { label: 'Task Queue', href: integrationRoutes.pipelines.queue.dashboard },
    { label: '연결 테스트', href: integrationRoutes.pipelines.queue.testConnections },
    { label: `${detail?.serviceName ?? '연결 테스트'} #${params.targetSourceId}` },
  ];

  if (detailLoading) {
    return (
      <>
        <PlBreadcrumb crumbs={crumbs} className="mb-4" />
        <div className="min-h-[280px]" aria-busy="true" />
      </>
    );
  }

  if (detailError != null || detail == null || detail.status == null) {
    return (
      <>
        <PlBreadcrumb crumbs={crumbs} className="mb-4" />
        <Card>
          <TqEmptyState
            title="연결 테스트 상세를 찾을 수 없어요"
            caption="완료 또는 재실행 요청 상태의 연결 테스트만 상세를 볼 수 있어요"
          />
        </Card>
      </>
    );
  }

  const isDone = detail.status === COMPLETED;
  const stats = tcResultStats(results ?? []);
  const resultRows = results ?? [];

  const sectionDesc = isDone
    ? `완료 일자 ${fmtDateTime(detail.completedAt)} · 연동 대상 논리 DB ${stats.includedTotal}개 · 제외 논리 DB ${stats.excludedTotal}개`
    : `반려 일자 ${fmtDateTime(detail.rejectedAt)} · 서비스에 재실행을 요청한 상태예요`;

  return (
    <>
      <PlBreadcrumb crumbs={crumbs} className="mb-4" />

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className={text.pageTitle}>
            {detail.serviceName ?? '연결 테스트'}{' '}
            <span className="font-medium text-[var(--pl-text-weak)]">
              #{params.targetSourceId}
            </span>
          </h1>
          <div className="flex items-center gap-2 mt-2">
            {detail.cloudProvider && <ProvTag provider={detail.cloudProvider} />}
            <span className={text.mono}>{detail.serviceCode ?? '—'}</span>
            <TcStatePill done={isDone} />
          </div>
        </div>
        {isDone && (
          <div className="flex gap-2">
            <PlButton variant="danger" onClick={() => setRerunOpen(true)}>
              연결 테스트 재실행 요청
            </PlButton>
            <PlButton variant="primary" onClick={() => setApproveOpen(true)}>
              연동 승인
            </PlButton>
          </div>
        )}
      </div>

      <SectionHeader first title="연결 테스트 결과" desc={sectionDesc} />

      <Card>
        {!isDone && detail.rejectReason && (
          <div className={tqStyles.rejectBox.wrap}>
            <span className={tqStyles.rejectBox.icon}>
              <Icon name="warn-tri" size="md" />
            </span>
            <div>
              <div className={tqStyles.rejectBox.title}>재실행 요청 사유</div>
              <div className={tqStyles.rejectBox.body}>{detail.rejectReason}</div>
              <div className={tqStyles.rejectBox.meta}>
                반려 일자 {fmtDateTime(detail.rejectedAt)}
              </div>
            </div>
          </div>
        )}

        {resultsError != null ? (
          <TqEmptyState
            title="연결 테스트 결과를 불러오지 못했어요"
            caption={
              <PlButton variant="secondary" size="sm" onClick={refetch}>
                재시도
              </PlButton>
            }
          />
        ) : results === null ? (
          <div className="min-h-[200px]" aria-busy="true" />
        ) : resultRows.length === 0 ? (
          <TqEmptyState
            title="표시할 연결 테스트 결과가 없어요"
            caption="리소스별 연결 결과가 준비되면 여기에 표시돼요"
          />
        ) : (
          <>
            <TcResultsTable rows={resultRows} onOpenLdb={openLdb} />
            <p className={cn(text.sectionDesc, 'mt-4 mb-0')}>
              논리 DB 개수를 누르면 연동 대상·제외 목록을 바로 볼 수 있어요
            </p>
          </>
        )}
      </Card>

      {ldbTarget && (
        <LdbModal
          key={`${ldbTarget.resourceId}:${ldbTarget.tab}`}
          open
          onClose={() => setLdbTarget(null)}
          targetSourceId={targetSourceId}
          databaseType={ldbTarget.databaseType}
          targetLabel={ldbTarget.targetLabel}
          defaultTab={ldbTarget.tab}
          entry={ldbCache[ldbTarget.resourceId]}
          onRetry={() => retryLdb(ldbTarget.resourceId)}
        />
      )}

      <TcRerunModal
        key={rerunOpen ? 'rerun-open' : 'rerun-closed'}
        open={rerunOpen}
        onClose={() => setRerunOpen(false)}
        targetSourceId={targetSourceId}
        onSubmit={(reason) => void rerun.mutate(reason)}
        submitting={rerun.loading}
      />

      <TcApproveModal
        open={approveOpen}
        onClose={() => setApproveOpen(false)}
        targetSourceId={targetSourceId}
        serviceName={detail.serviceName ?? '이 서비스'}
        stats={stats}
        onSubmit={() => void approve.execute()}
        submitting={approve.loading}
      />
    </>
  );
}
