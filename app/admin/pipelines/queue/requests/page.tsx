'use client';

/**
 * P2 연동 요청 목록 (/admin/pipelines/queue/requests) — design-spec §2.
 *
 * Three stacked 계층 (no tabs): 연동 요청 확인 (PENDING), 연동 요청 반려 확인
 * (REJECTED), 전체 History 확인 (approval-history). Each section reads its own
 * source and paginates independently (server page param, size 10); the pager is
 * hidden when there is a single page. The PENDING and history rows navigate to
 * the detail; the rejected list keeps its 반려 사유 hover cell without navigation.
 */
import { useState, type ReactElement, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { integrationRoutes } from '@/lib/routes';
import { pipelineStyles } from '@/lib/theme';
import { fmtDateTime } from '@/lib/pipeline/format';
import { useAbortableEffect } from '@/app/hooks/useAbortableEffect';

import { Card } from '@/app/admin/pipelines/_components/Card';
import { SectionHeader } from '@/app/admin/pipelines/_components/SectionHeader';
import { ProvTag } from '@/app/admin/pipelines/_components/ProvTag';
import { PlPagination } from '@/app/admin/pipelines/_components/PlPagination';
import { PlEmptyState } from '@/app/admin/pipelines/_components/PlEmptyState';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { PlTd, PlRow } from '@/app/admin/pipelines/_components/PlTable';
import { TqListTable, TqTh } from '@/app/admin/pipelines/queue/_components/TqListTable';
import { DetailLink } from '@/app/admin/pipelines/queue/_components/DetailLink';
import { RejectReasonCell, TqEmptyState } from '@/app/admin/pipelines/queue/_components/bits';
import { HistoryStatusPill } from '@/app/admin/pipelines/queue/requests/_components/HistoryStatusPill';
import { getApprovalHistory, getRequestList } from '@/app/lib/api/task-queue-requests';
import type { ApprovalHistoryRow, Paged, RequestListRow } from '@/lib/types/task-queue';

const { text, section } = pipelineStyles;

const errorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);

// Stable (module-level) section fetchers — one server page (0-based) each, so
// the useAbortableEffect deps stay identity-stable and never re-fire per render.
const fetchPending = (page: number, opts: { signal: AbortSignal }): Promise<Paged<RequestListRow>> =>
  getRequestList('PENDING', page, opts);
const fetchRejected = (page: number, opts: { signal: AbortSignal }): Promise<Paged<RequestListRow>> =>
  getRequestList('REJECTED', page, opts);
const fetchHistory = (page: number, opts: { signal: AbortSignal }): Promise<Paged<ApprovalHistoryRow>> =>
  getApprovalHistory(page, opts);

interface PagedSection<T> {
  page: number;
  paged: Paged<T> | null;
  loading: boolean;
  error: unknown;
  setPage: (n: number) => void;
  reload: () => void;
}

/** One paginated section's data state (1-based page → 0-based server param). */
function usePagedSection<T>(
  fetcher: (page: number, opts: { signal: AbortSignal }) => Promise<Paged<T>>,
): PagedSection<T> {
  const [page, setPage] = useState(1);
  const [paged, setPaged] = useState<Paged<T> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [retry, setRetry] = useState(0);

  useAbortableEffect(
    (signal) => {
      setLoading(true);
      setError(null);
      return fetcher(page - 1, { signal })
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
    [fetcher, page, retry],
  );

  return { page, paged, loading, error, setPage, reload: () => setRetry((n) => n + 1) };
}

interface ListSectionProps<T> {
  title: string;
  desc: ReactNode;
  /** First section under the page head — drops the 64px top margin. */
  first?: boolean;
  state: PagedSection<T>;
  head: ReactNode;
  colSpan: number;
  empty: { title: string; caption: string };
  children: (rows: T[]) => ReactNode;
}

/** Section 계층 shell: header + card with per-section loading / error / pager. */
function ListSection<T>({
  title,
  desc,
  first,
  state,
  head,
  colSpan,
  empty,
  children,
}: ListSectionProps<T>): ReactElement {
  const { paged, loading, error, page, setPage, reload } = state;
  const rows = paged?.content ?? [];
  const totalPages = Math.max(1, paged?.totalPages ?? 1);

  return (
    <>
      <SectionHeader title={title} desc={desc} first={first} />
      <Card>
        {error != null ? (
          <PlEmptyState
            icon="inbox"
            message={errorMessage(error)}
            meta={
              <PlButton variant="secondary" size="sm" onClick={reload}>
                재시도
              </PlButton>
            }
          />
        ) : loading || paged === null ? (
          <div className="min-h-[240px]" aria-busy="true" />
        ) : (
          <>
            <TqListTable head={head}>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={colSpan} className="p-0">
                    <TqEmptyState title={empty.title} caption={empty.caption} />
                  </td>
                </tr>
              ) : (
                children(rows)
              )}
            </TqListTable>
            {rows.length > 0 && totalPages > 1 && (
              <PlPagination
                className="mt-4"
                page={page}
                pages={totalPages}
                onPrev={() => setPage(Math.max(1, page - 1))}
                onNext={() => setPage(Math.min(totalPages, page + 1))}
              />
            )}
          </>
        )}
      </Card>
    </>
  );
}

export default function RequestsPage(): ReactElement {
  const router = useRouter();
  const pending = usePagedSection(fetchPending);
  const rejected = usePagedSection(fetchRejected);
  const history = usePagedSection(fetchHistory);

  const goDetail = (targetSourceId: number | null): (() => void) | undefined =>
    targetSourceId != null
      ? () => router.push(integrationRoutes.pipelines.queue.request(targetSourceId))
      : undefined;

  const pendingCount = pending.paged?.totalElements ?? null;

  return (
    <div>
      <h1 className={text.pageTitle}>연동 요청</h1>
      <p className={section.desc}>서비스가 보낸 연동 승인 요청을 검토하고 처리해요</p>

      {/* 계층 1 — 연동 요청 확인 (승인 대기) */}
      <ListSection
        first
        title="연동 요청 확인"
        desc={
          pendingCount != null
            ? `승인이 필요한 연동 요청 ${pendingCount.toLocaleString()}건`
            : '승인이 필요한 연동 요청'
        }
        state={pending}
        colSpan={5}
        empty={{ title: '승인을 기다리는 요청이 없어요', caption: '새 연동 요청이 들어오면 여기에 표시돼요' }}
        head={
          <>
            <TqTh>서비스 이름</TqTh>
            <TqTh>서비스 코드</TqTh>
            <TqTh>Target Source</TqTh>
            <TqTh>Cloud</TqTh>
            <TqTh />
          </>
        }
      >
        {(rows) =>
          rows.map((row) => {
            const id = row.targetSourceId;
            return (
              <PlRow key={id ?? row.serviceCode} onActivate={goDetail(id)}>
                <PlTd className="font-semibold text-[var(--pl-text-strong)]">
                  {row.serviceName ?? '—'}
                </PlTd>
                <PlTd mono>{row.serviceCode ?? '—'}</PlTd>
                <PlTd mono>{id != null ? `#${id}` : '—'}</PlTd>
                <PlTd>
                  <ProvTag provider={row.cloudProvider ?? ''} />
                </PlTd>
                <PlTd className="text-right whitespace-nowrap">
                  <DetailLink />
                </PlTd>
              </PlRow>
            );
          })
        }
      </ListSection>

      {/* 계층 2 — 연동 요청 반려 확인 (반려) */}
      <ListSection
        title="연동 요청 반려 확인"
        desc="반려했으나 서비스 측 담당자가 아직 확인하지 않았어요"
        state={rejected}
        colSpan={6}
        empty={{ title: '확인 대기 중인 반려 건이 없어요', caption: '반려 처리한 요청이 여기에 모여요' }}
        head={
          <>
            <TqTh>서비스 이름</TqTh>
            <TqTh>서비스 코드</TqTh>
            <TqTh>Target Source</TqTh>
            <TqTh>Cloud</TqTh>
            <TqTh>반려 사유</TqTh>
            <TqTh>반려 일자</TqTh>
          </>
        }
      >
        {(rows) =>
          rows.map((row) => {
            const id = row.targetSourceId;
            return (
              <PlRow key={id ?? row.serviceCode}>
                <PlTd className="font-semibold text-[var(--pl-text-strong)]">
                  {row.serviceName ?? '—'}
                </PlTd>
                <PlTd mono>{row.serviceCode ?? '—'}</PlTd>
                <PlTd mono>{id != null ? `#${id}` : '—'}</PlTd>
                <PlTd>
                  <ProvTag provider={row.cloudProvider ?? ''} />
                </PlTd>
                <PlTd>
                  <RejectReasonCell reason={row.latestApprovalRequest?.reason ?? '—'} />
                </PlTd>
                <PlTd muted>{fmtDateTime(row.latestApprovalRequest?.processedAt)}</PlTd>
              </PlRow>
            );
          })
        }
      </ListSection>

      {/* 계층 3 — 전체 History 확인 (approval-history) */}
      <ListSection
        title="전체 History 확인"
        desc="모든 연동 요청의 승인 처리 이력이에요"
        state={history}
        colSpan={6}
        empty={{ title: '표시할 승인 이력이 없어요', caption: '연동 요청이 처리되면 이력이 여기에 쌓여요' }}
        head={
          <>
            <TqTh>서비스</TqTh>
            <TqTh>Code</TqTh>
            <TqTh>요청 ID</TqTh>
            <TqTh>상태</TqTh>
            <TqTh>일시</TqTh>
            <TqTh />
          </>
        }
      >
        {(rows) =>
          rows.map((row) => (
            <PlRow key={row.requestId ?? row.serviceCode} onActivate={goDetail(row.targetSourceId)}>
              <PlTd className="font-semibold text-[var(--pl-text-strong)]">
                {row.serviceName ?? '—'}
              </PlTd>
              <PlTd mono>{row.serviceCode ?? '—'}</PlTd>
              <PlTd mono>{row.requestId != null ? `#${row.requestId}` : '—'}</PlTd>
              <PlTd>
                <HistoryStatusPill status={row.status} />
              </PlTd>
              <PlTd muted>{fmtDateTime(row.createdAt)}</PlTd>
              <PlTd className="text-right whitespace-nowrap">
                <DetailLink />
              </PlTd>
            </PlRow>
          ))
        }
      </ListSection>
    </div>
  );
}
