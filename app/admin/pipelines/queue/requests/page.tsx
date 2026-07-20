'use client';

/**
 * P2 연동 요청 목록 (/admin/pipelines/queue/requests) — design-spec §2.
 *
 * seg.lg tabs 승인 대기(PENDING) / 반려(REJECTED) / 전체(ALL) drive the
 * `confirmStatus` server filter. Tab counts come from three cheap size=1
 * `totalElements` reads (getRequestTabCounts) so all three counts show at once
 * (the prototype's seg always displays them), independent of the loaded tab.
 * Columns vary per tab; only 승인 대기 rows navigate to the detail. Server paging
 * size 10; the pager is hidden when empty.
 */
import { useState, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { integrationRoutes } from '@/lib/routes';
import { pipelineStyles } from '@/lib/theme';
import { fmtDateTime } from '@/lib/pipeline/format';
import { useAbortableEffect } from '@/app/hooks/useAbortableEffect';

import { Card } from '@/app/admin/pipelines/_components/Card';
import { ProvTag } from '@/app/admin/pipelines/_components/ProvTag';
import { PlPagination } from '@/app/admin/pipelines/_components/PlPagination';
import { PlEmptyState } from '@/app/admin/pipelines/_components/PlEmptyState';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { PlTd, PlRow } from '@/app/admin/pipelines/_components/PlTable';
import { TqListTable, TqTh } from '@/app/admin/pipelines/queue/_components/TqListTable';
import { TqSegLg } from '@/app/admin/pipelines/queue/_components/TqSegLg';
import { DetailLink } from '@/app/admin/pipelines/queue/_components/DetailLink';
import { RejectReasonCell, TqEmptyState } from '@/app/admin/pipelines/queue/_components/bits';
import {
  getRequestList,
  getRequestTabCounts,
  type RequestTab,
} from '@/app/lib/api/task-queue-requests';
import type { Paged, RequestListRow } from '@/lib/types/task-queue';

const { text, section } = pipelineStyles;

const EMPTY_COPY: Record<RequestTab, { title: string; caption: string }> = {
  PENDING: { title: '승인을 기다리는 요청이 없어요', caption: '새 연동 요청이 들어오면 여기에 표시돼요' },
  REJECTED: { title: '반려된 요청이 없어요', caption: '반려 처리한 요청이 여기에 모여요' },
  ALL: { title: '연동 요청이 없어요', caption: '서비스가 연동을 요청하면 여기에 표시돼요' },
};

const errorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);

export default function RequestsPage(): ReactElement {
  const router = useRouter();
  const [tab, setTab] = useState<RequestTab>('PENDING');
  const [page, setPage] = useState(1);
  const [paged, setPaged] = useState<Paged<RequestListRow> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [retry, setRetry] = useState(0);
  const [counts, setCounts] = useState<Record<RequestTab, number> | null>(null);

  useAbortableEffect(
    (signal) => {
      setLoading(true);
      setError(null);
      return getRequestList(tab, page - 1, { signal })
        .then((result) => {
          if (signal.aborted) return;
          setPaged(result);
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

  useAbortableEffect(
    (signal) =>
      getRequestTabCounts({ signal })
        .then((result) => {
          if (!signal.aborted) setCounts(result);
        })
        .catch(() => {
          /* counts are non-critical — leave them blank on failure */
        }),
    [retry],
  );

  const changeTab = (next: RequestTab): void => {
    setTab(next);
    setPage(1);
  };

  const rows = paged?.content ?? [];
  const totalPages = Math.max(1, paged?.totalPages ?? 1);
  const isRejected = tab === 'REJECTED';
  const isPending = tab === 'PENDING';
  const columnCount = 4 + (isRejected ? 2 : 0) + (isPending ? 1 : 0);
  const empty = EMPTY_COPY[tab];

  return (
    <div>
      <h1 className={text.pageTitle}>연동 요청</h1>
      <p className={section.desc}>서비스가 보낸 연동 승인 요청을 검토하고 처리해요</p>
      <Card>
        <TqSegLg
          className="mb-4"
          ariaLabel="연동 요청 상태 필터"
          value={tab}
          onChange={changeTab}
          options={[
            { label: '승인 대기', value: 'PENDING', count: counts?.PENDING },
            { label: '반려', value: 'REJECTED', count: counts?.REJECTED },
            { label: '전체', value: 'ALL', count: counts?.ALL },
          ]}
        />

        {error != null ? (
          <PlEmptyState
            icon="inbox"
            message={errorMessage(error)}
            meta={
              <PlButton variant="secondary" size="sm" onClick={() => setRetry((n) => n + 1)}>
                재시도
              </PlButton>
            }
          />
        ) : loading || paged === null ? (
          <div className="min-h-[240px]" aria-busy="true" />
        ) : (
          <>
            <TqListTable
              head={
                <>
                  <TqTh>서비스 이름</TqTh>
                  <TqTh>서비스 코드</TqTh>
                  <TqTh>Target Source</TqTh>
                  <TqTh>Cloud</TqTh>
                  {isRejected && (
                    <>
                      <TqTh>반려 사유</TqTh>
                      <TqTh>반려 일자</TqTh>
                    </>
                  )}
                  {isPending && <TqTh />}
                </>
              }
            >
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={columnCount} className="p-0">
                    <TqEmptyState title={empty.title} caption={empty.caption} />
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const id = row.targetSourceId;
                  const go =
                    isPending && id != null
                      ? () => router.push(integrationRoutes.pipelines.queue.request(id))
                      : undefined;
                  return (
                    <PlRow key={id ?? row.serviceCode} onActivate={go}>
                      <PlTd className="font-semibold text-[var(--pl-text-strong)]">
                        {row.serviceName ?? '—'}
                      </PlTd>
                      <PlTd mono>{row.serviceCode ?? '—'}</PlTd>
                      <PlTd mono>{id != null ? `#${id}` : '—'}</PlTd>
                      <PlTd>
                        <ProvTag provider={row.cloudProvider ?? ''} />
                      </PlTd>
                      {isRejected && (
                        <>
                          <PlTd>
                            <RejectReasonCell reason={row.latestApprovalRequest?.reason ?? '—'} />
                          </PlTd>
                          <PlTd muted>{fmtDateTime(row.latestApprovalRequest?.processedAt)}</PlTd>
                        </>
                      )}
                      {isPending && (
                        <PlTd className="text-right whitespace-nowrap">
                          <DetailLink />
                        </PlTd>
                      )}
                    </PlRow>
                  );
                })
              )}
            </TqListTable>
            {rows.length > 0 && (
              <PlPagination
                className="mt-4"
                page={page}
                pages={totalPages}
                onPrev={() => setPage((n) => Math.max(1, n - 1))}
                onNext={() => setPage((n) => Math.min(totalPages, n + 1))}
              />
            )}
          </>
        )}
      </Card>
    </div>
  );
}
