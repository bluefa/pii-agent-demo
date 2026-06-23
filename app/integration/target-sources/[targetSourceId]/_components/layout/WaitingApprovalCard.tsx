'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  getApprovalRequestLatest,
  getApprovedIntegration,
  type ApprovalRequestLatestResponse,
  type ApprovedIntegrationExcludedResourceItem,
  type ApprovedIntegrationResourceItem,
} from '@/app/lib/api';
import { AppError, isMissingApprovedIntegrationError } from '@/lib/errors';
import { formatDate } from '@/lib/utils/date';
import { ClockIcon } from '@/app/components/ui/icons';
import { Pagination } from '@/app/components/ui/Pagination';
import { StepBanner } from '@/app/components/ui/StepBanner';
import {
  WaitingApprovalStats,
} from '@/app/integration/target-sources/[targetSourceId]/_components/layout/WaitingApprovalStats';
import {
  WaitingApprovalTable,
  type WaitingApprovalResource,
} from '@/app/integration/target-sources/[targetSourceId]/_components/layout/WaitingApprovalTable';
import { WaitingApprovalToolbar } from '@/app/integration/target-sources/[targetSourceId]/_components/layout/WaitingApprovalToolbar';
import { useApprovalTableState } from '@/app/integration/target-sources/[targetSourceId]/_components/layout/useApprovalTableState';
import {
  ErrorRow,
  LoadingRow,
} from '@/app/integration/target-sources/[targetSourceId]/_components/shared/async-state-views';
import type { AsyncState } from '@/app/integration/target-sources/[targetSourceId]/_components/shared/async-state';
import { cardStyles, cn, statusColors, textColors } from '@/lib/theme';

interface WaitingApprovalCardProps {
  targetSourceId: number;
  cancelSlot?: ReactNode;
  reselectSlot?: ReactNode;
}

const FETCH_ERROR_MESSAGE = '승인 요청 정보를 불러오지 못했습니다.';
const FILTER_EMPTY_MESSAGE = '조건에 맞는 결과가 없어요.';

const toSelectedRow = (item: ApprovedIntegrationResourceItem): WaitingApprovalResource => ({
  resourceId: item.resource_id,
  resourceType: item.resource_type,
  region: item.database_region ?? '',
  resourceName: item.resource_name ?? '',
  selected: true,
  displayDbType: item.endpoint_config?.db_type ?? item.resource_type,
  integrationStatus: item.integration_status ?? null,
});

const toExcludedRow = (
  item: ApprovedIntegrationExcludedResourceItem,
): WaitingApprovalResource => ({
  resourceId: item.resource_id ?? '',
  resourceType: item.database_type ?? '',
  region: item.database_region ?? '',
  resourceName: item.resource_name ?? '',
  selected: false,
  exclusionReason: item.exclusion_reason ?? undefined,
});

interface RequestSummary {
  requestedAt: string;
  requestedBy: string;
}

const toRequestSummary = (response: ApprovalRequestLatestResponse): RequestSummary | null => {
  const requestedAt = response.request?.requestedAt;
  const requestedBy = response.request?.requestedBy?.userId;
  if (!requestedAt || !requestedBy) return null;
  return { requestedAt, requestedBy };
};

export const WaitingApprovalCard = ({
  targetSourceId,
  cancelSlot,
  reselectSlot,
}: WaitingApprovalCardProps) => {
  const [state, setState] = useState<AsyncState<WaitingApprovalResource[]>>({ status: 'loading' });
  const [retryNonce, setRetryNonce] = useState(0);
  const [requestSummary, setRequestSummary] = useState<RequestSummary | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    void getApprovedIntegration(targetSourceId, { signal: controller.signal })
      .then((response) => {
        const approved = response.approved_integration;
        if (!approved) {
          setState({ status: 'ready', data: [] });
          return;
        }
        const selectedRows = approved.resource_infos.map(toSelectedRow);
        const excludedRows = approved.excluded_resource_infos.map(toExcludedRow);
        setState({ status: 'ready', data: [...selectedRows, ...excludedRows] });
      })
      .catch((error: unknown) => {
        if (error instanceof AppError && error.code === 'ABORTED') return;
        if (isMissingApprovedIntegrationError(error)) {
          setState({ status: 'ready', data: [] });
          return;
        }
        setState({ status: 'error', message: FETCH_ERROR_MESSAGE });
      });

    void getApprovalRequestLatest(targetSourceId, { signal: controller.signal })
      .then((response) => {
        setRequestSummary(toRequestSummary(response));
      })
      .catch((error: unknown) => {
        if (error instanceof AppError && error.code === 'ABORTED') return;
        setRequestSummary(null);
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

  return (
    <section className={cn(cardStyles.base, 'overflow-hidden')}>
      <div className={cn(cardStyles.header, 'flex items-center justify-between')}>
        <div>
          <h2 className={cn(cardStyles.cardTitle)}>
            연동 대상 승인 대기
          </h2>
          <p className={cn('mt-2.5', cardStyles.subtitle)}>
            요청하신 DB 목록을 관리자가 확인하고 있어요.
            {requestSummary && (
              <>
                {' · '}요청일시{' '}
                <strong className={cn('font-semibold', textColors.secondary)}>
                  {formatDate(requestSummary.requestedAt, 'datetime')}
                </strong>
                {' · '}요청자{' '}
                <strong className={cn('font-semibold', textColors.secondary)}>
                  {requestSummary.requestedBy}
                </strong>
              </>
            )}
          </p>
        </div>
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

      <div className="p-6">
        <StepBanner variant="info" icon={<ClockIcon className="w-[18px] h-[18px]" />}>
          <strong className="font-semibold">관리자 승인을 기다리고 있어요.</strong>
          {' '}평균 1영업일 내 검토되며, 승인되면 메일로 안내됩니다.
        </StepBanner>

        {state.status === 'loading' ? (
          <LoadingRow message="승인 요청 리소스를 불러오는 중입니다." />
        ) : state.status === 'error' ? (
          <ErrorRow message={state.message} onRetry={handleRetry} />
        ) : (
          <div className="mt-4">
            <WaitingApprovalStats
              totalCount={table.countsByFilter.all}
              selectedCount={table.countsByFilter.target}
              excludedCount={table.countsByFilter.excluded}
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

        {(cancelSlot || reselectSlot) && (
          <div className="flex justify-end items-center gap-2 mt-4">
            {reselectSlot}
            {cancelSlot}
          </div>
        )}
      </div>
    </section>
  );
};
