'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getApprovedIntegration,
  type ApprovedIntegrationExcludedResourceItem,
  type ApprovedIntegrationResourceItem,
} from '@/app/lib/api';
import { AppError, isMissingApprovedIntegrationError } from '@/lib/errors';
import { formatDate } from '@/lib/utils/date';
import { CheckIcon } from '@/app/components/ui/icons';
import { Pagination } from '@/app/components/ui/Pagination';
import { StepBanner } from '@/app/components/ui/StepBanner';
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
import { cardStyles, cn, idcStyles, textColors } from '@/lib/theme';

interface ApplyingApprovedCardProps {
  targetSourceId: number;
}

const FETCH_ERROR_MESSAGE = '반영 정보를 불러오지 못했습니다.';
const FILTER_EMPTY_MESSAGE = '조건에 맞는 결과가 없어요.';

const toSelectedRow = (item: ApprovedIntegrationResourceItem): WaitingApprovalResource => ({
  resourceId: item.resource_id,
  resourceType: item.resource_type,
  region: item.database_region ?? '',
  resourceName: item.resource_name ?? '',
  selected: true,
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

interface ApplyingView {
  resources: WaitingApprovalResource[];
  approvedAt: string | null;
  approver: string | null;
}

const EMPTY_VIEW: ApplyingView = { resources: [], approvedAt: null, approver: null };

/**
 * Step 3 (연동 대상 반영중) — the step-2 rich approval table re-skinned for the
 * "applying" state: 승인일시/승인자 subtitle, green success banner, a 연동 이력 column,
 * and no cancel action (advance to step 4 is driven by ProcessStatusCard polling).
 */
export const ApplyingApprovedCard = ({ targetSourceId }: ApplyingApprovedCardProps) => {
  const [state, setState] = useState<AsyncState<ApplyingView>>({ status: 'loading' });
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    void getApprovedIntegration(targetSourceId, { signal: controller.signal })
      .then((response) => {
        const approved = response.approved_integration;
        if (!approved) {
          setState({ status: 'ready', data: EMPTY_VIEW });
          return;
        }
        const selectedRows = approved.resource_infos.map(toSelectedRow);
        const excludedRows = approved.excluded_resource_infos.map(toExcludedRow);
        setState({
          status: 'ready',
          data: {
            resources: [...selectedRows, ...excludedRows],
            approvedAt: approved.approved_at || null,
            approver: approved.approved_by || null,
          },
        });
      })
      .catch((error: unknown) => {
        if (error instanceof AppError && error.code === 'ABORTED') return;
        if (isMissingApprovedIntegrationError(error)) {
          setState({ status: 'ready', data: EMPTY_VIEW });
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

  const view = state.status === 'ready' ? state.data : EMPTY_VIEW;
  const resources = useMemo<readonly WaitingApprovalResource[]>(() => view.resources, [view]);

  const table = useApprovalTableState(resources);

  const { selectedCount, integratedCount } = useMemo(() => {
    let selected = 0;
    let integrated = 0;
    for (const resource of resources) {
      if (!resource.selected) continue;
      selected += 1;
      if (resource.integrationStatus === 'INTEGRATED') integrated += 1;
    }
    return { selectedCount: selected, integratedCount: integrated };
  }, [resources]);

  const showFilterEmpty =
    state.status === 'ready' && resources.length > 0 && table.filteredCount === 0;

  return (
    <section className={cn(cardStyles.base, 'overflow-hidden')}>
      <div className={cn(cardStyles.header, 'flex items-center justify-between')}>
        <div>
          <h2 className={cn(cardStyles.cardTitle)}>연동 대상 반영중</h2>
          <p className={cn('mt-1 text-[12px]', textColors.tertiary)}>
            관리자 승인 후 Agent 설치를 위한 사전 작업이 자동으로 진행됩니다.
            {view.approvedAt && (
              <>
                {' · '}승인일시{' '}
                <strong className={cn('font-semibold', textColors.secondary)}>
                  {formatDate(view.approvedAt, 'datetime')}
                </strong>
              </>
            )}
            {view.approver && (
              <>
                {' · '}승인자{' '}
                <strong className={cn('font-semibold', textColors.secondary)}>
                  {view.approver}
                </strong>
              </>
            )}
          </p>
        </div>
        <span className={cn(idcStyles.status.base, idcStyles.status.partial.text)}>
          <span className={cn(idcStyles.status.dot, idcStyles.status.partial.dot)} />
          반영중
        </span>
      </div>

      <div className="p-6">
        <StepBanner variant="success" icon={<CheckIcon className="w-[18px] h-[18px]" />}>
          <strong className="font-semibold">승인이 완료되어 시스템에 반영 중입니다.</strong>
          {selectedCount > 0 && (
            <>
              {' '}전체 {selectedCount}건 중 {integratedCount}건 완료
            </>
          )}
          {' · '}평균 5분 내외 소요
        </StepBanner>

        {state.status === 'loading' ? (
          <LoadingRow message="반영 중인 리소스 목록을 불러오는 중입니다." />
        ) : state.status === 'error' ? (
          <ErrorRow message={state.message} onRetry={handleRetry} />
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            <WaitingApprovalToolbar
              searchValue={table.searchValue}
              onSearchChange={table.onSearchChange}
              filter={table.filter}
              onFilterChange={table.onFilterChange}
              dbType={table.dbType}
              onDbTypeChange={table.onDbTypeChange}
              region={table.region}
              onRegionChange={table.onRegionChange}
              dbTypeOptions={table.dbTypeOptions}
              regionOptions={table.regionOptions}
              countsByFilter={table.countsByFilter}
              visibleStart={table.visibleStart}
              visibleEnd={table.visibleEnd}
              totalCount={table.filteredCount}
            />
            <WaitingApprovalTable
              resources={table.visibleResources}
              variant="applying"
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
    </section>
  );
};
