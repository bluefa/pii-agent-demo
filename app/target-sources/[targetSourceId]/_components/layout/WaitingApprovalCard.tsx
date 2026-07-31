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
import { MetaField } from '@/app/target-sources/[targetSourceId]/_components/shared/MetaField';
import {
  ErrorRow,
  ResourceTableSkeleton,
} from '@/app/target-sources/[targetSourceId]/_components/shared/async-state-views';
import type { AsyncState } from '@/app/target-sources/[targetSourceId]/_components/shared/async-state';
import { cardStyles, cn, primaryColors, statusColors, textColors } from '@/lib/theme';

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
type LatestResourceItem = NonNullable<ApprovalRequestLatestResponse['resources']>[number];

const toResourceRow = (item: LatestResourceItem): WaitingApprovalResource => ({
  resourceId: item.resource_id ?? '',
  resourceType: item.resource_type ?? item.metadata?.database_type ?? '',
  region: item.metadata?.region ?? '',
  resourceName: item.resource_name ?? '',
  selected: item.selected ?? false,
  displayDbType: item.metadata?.database_type ?? item.resource_type ?? undefined,
  exclusionReason: item.exclusion_reason ?? undefined,
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
      {/* Left-aligned single stack: title + status, guidance copy, request meta.
          Secondary tiers differ by weight and color, not by a new font size. */}
      <div className={cardStyles.header}>
        <div className="flex items-start justify-between gap-4">
          <div>
            {/* Step position, matching INSTALL_STEPS order in InstallationProcessProgressBar. */}
            <span
              className={cn(
                'mb-1.5 inline-flex items-center rounded-[6px] px-2 py-0.5 text-[12px] font-bold',
                primaryColors.bgLight,
                primaryColors.text,
              )}
            >
              2번째 단계
            </span>
            <div className="flex items-center gap-2">
            <h2 className={cn(cardStyles.cardTitle)}>
              연동 대상 승인 대기
            </h2>
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium',
                statusColors.warning.bg,
                statusColors.warning.textDark,
              )}
            >
              승인 대기
            </span>
            </div>
          </div>
          {/* Card CTA sits beside the title — in the bottom dock the user only meets it past the whole table. */}
          {cancelSlot}
        </div>
        {/* Blue marks the status sentence only; the rest drops to the secondary tone.
            `cn` is a plain join, so stacking a size over the subtitle token leaves the winner to CSS
            order — declare the size here instead. */}
        <p className={cn('mt-3 text-[16px] font-medium leading-[1.55]', textColors.tertiary)}>
          <strong className={cn('font-semibold', primaryColors.text)}>
            관리자 승인을 기다리고 있어요.
          </strong>{' '}
          평균 1영업일 내 검토되며, 결과는 이 화면에서 확인할 수 있어요.
        </p>
        <p className={cn('mt-1 text-[16px] font-medium leading-[1.55]', textColors.tertiary)}>
          연동 대상을 다시 고르고 싶다면 우측 상단{' '}
          <strong className={cn('font-semibold', textColors.secondary)}>다시 요청하기</strong>를
          눌러주세요.
        </p>
        {requestSummary && (
          <div className="mt-4 flex flex-wrap gap-8">
            <MetaField label="요청일시" value={formatDate(requestSummary.requestedAt, 'datetime')} />
            <MetaField label="요청자" value={requestSummary.requestedBy} />
          </div>
        )}
      </div>

      {/* No body top padding, so the header's 12px bottom padding IS the meta-to-table gap. */}
      <div className="px-6 pb-6">
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
            {/* Toolbar (top-rounded) + table + pagination (bottom-rounded) join as one card, no gaps. */}
            <WaitingApprovalToolbar
              searchValue={table.searchValue}
              onSearchChange={table.onSearchChange}
              dbType={table.dbType}
              onDbTypeChange={table.onDbTypeChange}
              region={table.region}
              onRegionChange={table.onRegionChange}
              dbTypeOptions={table.dbTypeOptions}
              regionOptions={table.regionOptions}
            />
            <WaitingApprovalTable
              resources={table.visibleResources}
              connected
              emptyMessage={showFilterEmpty ? FILTER_EMPTY_MESSAGE : undefined}
            />
            {table.filteredCount > 0 && (
              <Pagination
                page={table.safePage}
                pageSize={table.pageSize}
                totalCount={table.filteredCount}
                onPageChange={table.onPageChange}
                onPageSizeChange={table.onPageSizeChange}
              />
            )}
          </div>
        )}

      </div>
      {/* C-2 action zone: reselect dock (sticky) at the card bottom. cancelSlot moved to the header. */}
      {reselectSlot && <CardActionBar>{reselectSlot}</CardActionBar>}
    </section>
  );
};
