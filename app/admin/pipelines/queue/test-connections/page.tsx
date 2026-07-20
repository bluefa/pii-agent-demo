'use client';

/**
 * P4 연결 테스트 목록 (`/admin/pipelines/queue/test-connections`) — the two-tab
 * Test Connection queue (완료 / 재실행 요청). Same grammar as P2 (design-spec §4):
 * a seg.lg tab switch over the admin `tbl`, per-tab empty states, server paging
 * (contract size 10). Tab counts come from the dashboard summary (the two
 * test-connection KPIs), fetched once alongside the active page.
 */
import { useState, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';

import { useAbortableEffect } from '@/app/hooks/useAbortableEffect';
import { pipelineStyles } from '@/lib/theme';
import { integrationRoutes } from '@/lib/routes';
import { fmtDateTime } from '@/lib/pipeline/format';
import {
  getTestConnectionQueue,
  type TestConnectionQueueStatus,
} from '@/app/lib/api/task-queue-tc';
import { getDashboardSummary } from '@/app/lib/api/task-queue';
import type { Paged, TestConnectionStatusRow } from '@/lib/types/task-queue';

import { Card } from '@/app/admin/pipelines/_components/Card';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { PlPagination } from '@/app/admin/pipelines/_components/PlPagination';
import { ProvTag } from '@/app/admin/pipelines/_components/ProvTag';
import { PlRow, PlTd } from '@/app/admin/pipelines/_components/PlTable';
import { TqListTable, TqTh } from '@/app/admin/pipelines/queue/_components/TqListTable';
import { TqSegLg } from '@/app/admin/pipelines/queue/_components/TqSegLg';
import { DetailLink } from '@/app/admin/pipelines/queue/_components/DetailLink';
import { RejectReasonCell, TqEmptyState } from '@/app/admin/pipelines/queue/_components/bits';

const PAGE_SIZE = 10;

type Tab = 'COMPLETED' | 'REJECTED';

const TAB_STATUS: Record<Tab, TestConnectionQueueStatus> = {
  COMPLETED: 'TEST_CONNECTION_COMPLETED',
  REJECTED: 'TEST_CONNECTION_REJECTED',
};

const EMPTY: Record<Tab, { title: string; caption: string }> = {
  COMPLETED: {
    title: '완료된 연결 테스트가 없어요',
    caption: '연결 테스트가 끝나면 여기에서 승인을 진행해요',
  },
  REJECTED: {
    title: '재실행을 요청한 건이 없어요',
    caption: '연결 테스트를 반려하면 여기에 모여요',
  },
};

export default function TestConnectionsPage(): ReactElement {
  const router = useRouter();
  const { text } = pipelineStyles;

  const [tab, setTab] = useState<Tab>('COMPLETED');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paged<TestConnectionStatusRow> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [retry, setRetry] = useState(0);
  const [counts, setCounts] = useState<{ completed?: number; rejected?: number }>({});

  useAbortableEffect(
    (signal) => {
      setLoading(true);
      setError(null);
      return getTestConnectionQueue(
        { status: TAB_STATUS[tab], page: page - 1, size: PAGE_SIZE },
        { signal },
      )
        .then((res) => {
          if (signal.aborted) return;
          setData(res);
          setLoading(false);
        })
        .catch((err) => {
          if (signal.aborted) return;
          setError(err);
          setLoading(false);
        });
    },
    [tab, page, retry],
  );

  // Seg counts — the two test-connection KPIs. Best-effort: failure just leaves
  // the counts unset (the tabs still work off the active page's total).
  useAbortableEffect((signal) => {
    return getDashboardSummary({ signal })
      .then((summary) => {
        if (signal.aborted) return;
        setCounts({
          completed: summary.testConnectionCompletedCount,
          rejected: summary.testConnectionRejectionCount,
        });
      })
      .catch(() => {
        /* non-blocking */
      });
  }, [retry]);

  const rows = data?.content ?? [];
  const pages = Math.max(1, data?.totalPages ?? 1);
  const done = tab === 'COMPLETED';

  const changeTab = (next: Tab): void => {
    if (next === tab) return;
    setTab(next);
    setPage(1);
  };

  return (
    <>
      <h1 className={`${text.pageTitle} mb-2`}>연결 테스트</h1>
      <p className={`${text.sectionDesc} mb-6`}>
        완료 건은 관리자 승인(확정) 대상이에요 · 반려 건은 서비스에 재실행을 요청한 상태예요
      </p>

      <Card>
        <TqSegLg
          className="mb-4"
          ariaLabel="연결 테스트 상태"
          value={tab}
          onChange={changeTab}
          options={[
            { label: '완료', value: 'COMPLETED', count: counts.completed },
            { label: '재실행 요청', value: 'REJECTED', count: counts.rejected },
          ]}
        />

        {error != null ? (
          <TqEmptyState
            title="목록을 불러오지 못했어요"
            caption={
              <PlButton variant="secondary" size="sm" onClick={() => setRetry((n) => n + 1)}>
                재시도
              </PlButton>
            }
          />
        ) : loading || data === null ? (
          <div className="min-h-[240px]" aria-busy="true" />
        ) : rows.length === 0 ? (
          <TqEmptyState title={EMPTY[tab].title} caption={EMPTY[tab].caption} />
        ) : (
          <TqListTable
            head={
              <>
                <TqTh>서비스 이름</TqTh>
                <TqTh>서비스 코드</TqTh>
                <TqTh>Target Source</TqTh>
                <TqTh>Cloud</TqTh>
                {done ? <TqTh>완료 일자</TqTh> : <TqTh>반려 사유</TqTh>}
                {!done && <TqTh>반려 일자</TqTh>}
                <TqTh />
              </>
            }
          >
            {rows.map((row) => (
              <PlRow
                key={row.targetSourceId ?? row.serviceCode}
                onActivate={() =>
                  row.targetSourceId != null &&
                  router.push(integrationRoutes.pipelines.queue.testConnection(row.targetSourceId))
                }
              >
                <PlTd className="font-semibold text-[var(--pl-text-strong)]">
                  {row.serviceName ?? '—'}
                </PlTd>
                <PlTd mono>{row.serviceCode ?? '—'}</PlTd>
                <PlTd mono>{row.targetSourceId != null ? `#${row.targetSourceId}` : '—'}</PlTd>
                <PlTd>{row.cloudProvider ? <ProvTag provider={row.cloudProvider} /> : '—'}</PlTd>
                {done ? (
                  <PlTd muted>{fmtDateTime(row.completedAt)}</PlTd>
                ) : (
                  <PlTd>
                    {row.rejectReason ? <RejectReasonCell reason={row.rejectReason} /> : '—'}
                  </PlTd>
                )}
                {!done && <PlTd muted>{fmtDateTime(row.rejectedAt)}</PlTd>}
                <PlTd className="text-right whitespace-nowrap">
                  <DetailLink />
                </PlTd>
              </PlRow>
            ))}
          </TqListTable>
        )}

        {!error && !loading && rows.length > 0 && (
          <PlPagination
            className="mt-4"
            page={page}
            pages={pages}
            onPrev={() => setPage((n) => Math.max(1, n - 1))}
            onNext={() => setPage((n) => Math.min(pages, n + 1))}
          />
        )}
      </Card>
    </>
  );
}
