'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  getApprovalRequestLatest,
  type ApprovalRequestLatestResponse,
} from '@/app/lib/api';
import { AppError } from '@/lib/errors';
import { formatDate } from '@/lib/utils/date';
import { Pagination } from '@/app/components/ui/Pagination';
import {
  WaitingApprovalStats,
} from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalStats';
import {
  WaitingApprovalTable,
  type WaitingApprovalResource,
} from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalTable';
import { CardActionBar } from '@/app/target-sources/[targetSourceId]/_components/common';
import { WaitingApprovalToolbar } from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalToolbar';
import { ApprovalUnavailableCard } from '@/app/target-sources/[targetSourceId]/_components/layout/ApprovalUnavailableCard';
import { useApprovalTableState } from '@/app/target-sources/[targetSourceId]/_components/layout/useApprovalTableState';
import {
  ErrorRow,
  ResourceTableSkeleton,
} from '@/app/target-sources/[targetSourceId]/_components/shared/async-state-views';
import type { AsyncState } from '@/app/target-sources/[targetSourceId]/_components/shared/async-state';
import { cardStyles, cn, identityBarStyles, statusColors } from '@/lib/theme';

interface WaitingApprovalCardProps {
  targetSourceId: number;
  cancelSlot?: ReactNode;
  reselectSlot?: ReactNode;
  // Called after the integration-unavailable verdict is acknowledged (go-back → Step 1)
  // so the parent re-fetches the project and re-renders the new step.
  onReselected?: () => Promise<void> | void;
}

const FETCH_ERROR_MESSAGE = '승인 요청 정보를 불러오지 못했습니다.';
const FILTER_EMPTY_MESSAGE = '조건에 맞는 결과가 없어요.';

// Step 2 sources its table from approval-requests/latest.resources (which the BFF
// already returns alongside the request meta), split by `selected` — so the separate
// approved-integration GET is no longer needed here (that endpoint stays on step 3).
// integration_status is a step-3 column with no source in this DTO, so it stays null.
type LatestResourceItem = NonNullable<ApprovalRequestLatestResponse['resources']>[number];

const toResourceRow = (item: LatestResourceItem): WaitingApprovalResource => ({
  resourceId: item.resource_id ?? '',
  resourceType: item.resource_type ?? item.metadata?.database_type ?? '',
  region: item.metadata?.region ?? '',
  resourceName: item.resource_name ?? '',
  selected: item.selected ?? false,
  displayDbType: item.metadata?.database_type ?? item.resource_type ?? undefined,
  exclusionReason: item.exclusion_reason ?? undefined,
  integrationStatus: null,
});

interface RequestSummary {
  requestedAt: string;
  requestedBy: string;
}

const toRequestSummary = (response: ApprovalRequestLatestResponse): RequestSummary | null => {
  const requestedAt = response.request?.requested_at;
  const requestedBy = response.request?.requested_by?.user_id;
  if (!requestedAt || !requestedBy) return null;
  return { requestedAt, requestedBy };
};

export const WaitingApprovalCard = ({
  targetSourceId,
  cancelSlot,
  reselectSlot,
  onReselected,
}: WaitingApprovalCardProps) => {
  const [state, setState] = useState<AsyncState<WaitingApprovalResource[]>>({ status: 'loading' });
  const [retryNonce, setRetryNonce] = useState(0);
  const [requestSummary, setRequestSummary] = useState<RequestSummary | null>(null);
  const [unavailable, setUnavailable] = useState<{ reason: string } | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    void getApprovalRequestLatest(targetSourceId, { signal: controller.signal })
      .then((response) => {
        const rows = (response.resources ?? []).map(toResourceRow);
        setState({ status: 'ready', data: rows });
        setRequestSummary(toRequestSummary(response));
        setUnavailable(
          response.result?.status === 'UNAVAILABLE'
            ? { reason: response.result?.reason ?? '' }
            : null,
        );
      })
      .catch((error: unknown) => {
        if (error instanceof AppError && error.code === 'ABORTED') return;
        if (error instanceof AppError && error.code === 'NOT_FOUND') {
          setState({ status: 'ready', data: [] });
          setRequestSummary(null);
          setUnavailable(null);
          return;
        }
        setState({ status: 'error', message: FETCH_ERROR_MESSAGE });
      });

    return () => controller.abort();
  }, [targetSourceId, retryNonce]);

  const handleRetry = useCallback(() => {
    setState({ status: 'loading' });
    setRetryNonce((n) => n + 1);
  }, []);

  const resources = useMemo<readonly WaitingApprovalResource[]>(
    () => (state.status === 'ready' ? state.data : []),
    [state],
  );

  const table = useApprovalTableState(resources);

  const showFilterEmpty =
    state.status === 'ready' && resources.length > 0 && table.filteredCount === 0;

  // Integration-unavailable verdict — replace the whole waiting card with the distinct
  // unavailable notice + go-back action (the normal table / cancel no longer apply).
  if (state.status === 'ready' && unavailable) {
    return (
      <ApprovalUnavailableCard
        targetSourceId={targetSourceId}
        reason={unavailable.reason}
        onReselected={onReselected}
      />
    );
  }

  return (
    // No overflow-hidden: it would establish a clip box and kill the sticky CardActionBar.
    <section className={cardStyles.base}>
      {/* 좌측 정렬 1단 스택 — 제목+상태, 강조 안내문, 요청 메타 순.
          보조 텍스트 계층은 크기가 아니라 굵기·색상으로만 구분한다. */}
      <div className={cardStyles.header}>
        <div className="flex items-center gap-2">
          <h2 className={cn(cardStyles.cardTitle)}>
            연동 대상 승인 대기
          </h2>
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
              statusColors.warning.bg,
              statusColors.warning.textDark,
            )}
          >
            <span className={cn('w-1.5 h-1.5 rounded-full', statusColors.warning.dot)} />
            승인 대기
          </span>
        </div>
        <p className={cn('mt-2.5', cardStyles.subtitle, 'font-semibold', statusColors.info.text)}>
          관리자 승인을 기다리고 있어요. 평균 1영업일 내 검토되며, 결과는 이 화면에서 확인할 수 있어요.
        </p>
        {requestSummary && (
          // 라벨 위 / 값 아래 2열 — 페이지 상단 identity bar(Account ID·TF 실행 권한)와
          // 같은 패턴이라 "라벨인지 값인지" 헷갈리지 않는다.
          <div className="mt-3 flex flex-wrap gap-8">
            <div className={identityBarStyles.field}>
              <span className={identityBarStyles.key}>요청일시</span>
              <span className={identityBarStyles.value}>
                {formatDate(requestSummary.requestedAt, 'datetime')}
              </span>
            </div>
            <div className={identityBarStyles.field}>
              <span className={identityBarStyles.key}>요청자</span>
              <span className={identityBarStyles.value}>{requestSummary.requestedBy}</span>
            </div>
          </div>
        )}
      </div>

      <div className="p-6">
        {state.status === 'loading' ? (
          <ResourceTableSkeleton />
        ) : state.status === 'error' ? (
          <ErrorRow message={state.message} onRetry={handleRetry} />
        ) : (
          <div className="mt-4">
            <WaitingApprovalStats
              totalCount={table.countsByFilter.all}
              selectedCount={table.countsByFilter.target}
              excludedCount={table.countsByFilter.excluded}
              filter={table.filter}
              onFilterChange={table.onFilterChange}
            />
            {/* v16: toolbar (top-rounded) + approval table (bottom-rounded) join as one connected card — no gap. */}
            <WaitingApprovalToolbar
              variant="waiting"
              searchValue={table.searchValue}
              onSearchChange={table.onSearchChange}
              filter={table.filter}
              onFilterChange={table.onFilterChange}
              dbType={table.dbType}
              onDbTypeChange={table.onDbTypeChange}
              region={table.region}
              onRegionChange={table.onRegionChange}
              integrationStatus={table.integrationStatus}
              onIntegrationStatusChange={table.onIntegrationStatusChange}
              dbTypeOptions={table.dbTypeOptions}
              regionOptions={table.regionOptions}
              integrationStatusOptions={table.integrationStatusOptions}
              countsByFilter={table.countsByFilter}
              visibleStart={table.visibleStart}
              visibleEnd={table.visibleEnd}
              totalCount={table.filteredCount}
            />
            <WaitingApprovalTable
              resources={table.visibleResources}
              connected
              emptyMessage={showFilterEmpty ? FILTER_EMPTY_MESSAGE : undefined}
            />
            {table.filteredCount > 0 && (
              <div className="mt-3">
                <Pagination
                  page={table.safePage}
                  pageSize={table.pageSize}
                  totalCount={table.filteredCount}
                  onPageChange={table.onPageChange}
                  onPageSizeChange={table.onPageSizeChange}
                />
              </div>
            )}
          </div>
        )}

      </div>
      {/* C-2 action zone: cancel/reselect dock (sticky) at the card bottom. */}
      {(cancelSlot || reselectSlot) && (
        <CardActionBar>
          {reselectSlot}
          {cancelSlot}
        </CardActionBar>
      )}
    </section>
  );
};
