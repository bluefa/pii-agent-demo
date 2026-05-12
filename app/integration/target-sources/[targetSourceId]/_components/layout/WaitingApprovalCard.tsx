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
import {
  WaitingApprovalToolbar,
  type ApprovalFilter,
} from '@/app/integration/target-sources/[targetSourceId]/_components/layout/WaitingApprovalToolbar';
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
const DEFAULT_PAGE_SIZE = 10;

const toSelectedRow = (item: ApprovedIntegrationResourceItem): WaitingApprovalResource => ({
  resourceId: item.resource_id,
  resourceType: item.resource_type,
  region: item.database_region ?? '',
  resourceName: item.resource_name ?? '',
  selected: true,
  scanStatus: item.scan_status ?? null,
});

const toExcludedRow = (
  item: ApprovedIntegrationExcludedResourceItem,
): WaitingApprovalResource => ({
  resourceId: item.resource_id ?? '',
  resourceType: item.database_type ?? '',
  region: item.database_region ?? '',
  resourceName: item.resource_name ?? '',
  selected: false,
  scanStatus: item.scan_status ?? null,
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

const collectOptions = (
  resources: readonly WaitingApprovalResource[],
  accessor: (resource: WaitingApprovalResource) => string,
): ReadonlyArray<{ value: string; label: string }> => {
  const unique = new Set<string>();
  for (const resource of resources) {
    const value = accessor(resource).trim();
    if (value) unique.add(value);
  }
  return Array.from(unique)
    .sort((a, b) => a.localeCompare(b))
    .map((value) => ({ value, label: value }));
};

export const WaitingApprovalCard = ({
  targetSourceId,
  cancelSlot,
  reselectSlot,
}: WaitingApprovalCardProps) => {
  const [state, setState] = useState<AsyncState<WaitingApprovalResource[]>>({ status: 'loading' });
  const [retryNonce, setRetryNonce] = useState(0);
  const [requestSummary, setRequestSummary] = useState<RequestSummary | null>(null);

  const [searchValue, setSearchValue] = useState('');
  const [filter, setFilter] = useState<ApprovalFilter>('all');
  const [dbType, setDbType] = useState('');
  const [region, setRegion] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

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

  const dbTypeOptions = useMemo(
    () => collectOptions(resources, (resource) => resource.resourceType),
    [resources],
  );
  const regionOptions = useMemo(
    () => collectOptions(resources, (resource) => resource.region),
    [resources],
  );

  const countsByFilter = useMemo(() => {
    let target = 0;
    let excluded = 0;
    for (const resource of resources) {
      if (resource.selected) target += 1;
      else excluded += 1;
    }
    return { all: resources.length, target, excluded };
  }, [resources]);

  const filteredResources = useMemo(() => {
    const search = searchValue.trim().toLowerCase();
    return resources.filter((resource) => {
      if (dbType && resource.resourceType !== dbType) return false;
      if (region && resource.region !== region) return false;
      if (filter === 'target' && !resource.selected) return false;
      if (filter === 'excluded' && resource.selected) return false;
      if (search) {
        const hayId = resource.resourceId.toLowerCase();
        const hayName = resource.resourceName.toLowerCase();
        if (!hayId.includes(search) && !hayName.includes(search)) return false;
      }
      return true;
    });
  }, [resources, dbType, region, filter, searchValue]);

  const filteredCount = filteredResources.length;
  const totalPages = Math.max(1, Math.ceil(filteredCount / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const sliceStart = safePage * pageSize;
  const sliceEnd = Math.min(filteredCount, sliceStart + pageSize);
  const visibleResources = filteredResources.slice(sliceStart, sliceEnd);
  const visibleStart = filteredCount === 0 ? 0 : sliceStart + 1;
  const visibleEnd = sliceEnd;

  const handleFilterChange = useCallback((next: ApprovalFilter) => {
    setFilter(next);
    setPage(0);
  }, []);

  const handleSearchChange = useCallback((next: string) => {
    setSearchValue(next);
    setPage(0);
  }, []);

  const handleDbTypeChange = useCallback((next: string) => {
    setDbType(next);
    setPage(0);
  }, []);

  const handleRegionChange = useCallback((next: string) => {
    setRegion(next);
    setPage(0);
  }, []);

  const handlePageSizeChange = useCallback((next: number) => {
    setPageSize(next);
    setPage(0);
  }, []);

  const showFilterEmpty =
    state.status === 'ready' && resources.length > 0 && filteredCount === 0;

  return (
    <section className={cn(cardStyles.base, 'overflow-hidden')}>
      <div className={cn(cardStyles.header, 'flex items-center justify-between')}>
        <div>
          <h2 className={cn('text-lg font-semibold', textColors.primary)}>
            연동 대상 승인 대기
          </h2>
          <p className={cn('mt-1 text-[12px]', textColors.tertiary)}>
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
          <div className="mt-4 flex flex-col gap-3">
            <WaitingApprovalStats
              totalCount={countsByFilter.all}
              selectedCount={countsByFilter.target}
              excludedCount={countsByFilter.excluded}
            />
            <WaitingApprovalToolbar
              searchValue={searchValue}
              onSearchChange={handleSearchChange}
              filter={filter}
              onFilterChange={handleFilterChange}
              dbType={dbType}
              onDbTypeChange={handleDbTypeChange}
              region={region}
              onRegionChange={handleRegionChange}
              dbTypeOptions={dbTypeOptions}
              regionOptions={regionOptions}
              countsByFilter={countsByFilter}
              visibleStart={visibleStart}
              visibleEnd={visibleEnd}
              totalCount={filteredCount}
            />
            <WaitingApprovalTable
              resources={visibleResources}
              emptyMessage={showFilterEmpty ? FILTER_EMPTY_MESSAGE : undefined}
            />
            {filteredCount > 0 && (
              <Pagination
                page={safePage}
                pageSize={pageSize}
                totalCount={filteredCount}
                onPageChange={setPage}
                onPageSizeChange={handlePageSizeChange}
              />
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
