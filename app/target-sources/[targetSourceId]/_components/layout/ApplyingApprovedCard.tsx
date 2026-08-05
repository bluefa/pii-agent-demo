'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getApprovedIntegration,
  type ApprovedIntegrationExcludedResourceItem,
  type ApprovedIntegrationResourceItem,
} from '@/app/lib/api';
import { AppError, isMissingApprovedIntegrationError } from '@/lib/errors';
import { formatDate } from '@/lib/utils/date';
import { Pagination } from '@/app/components/ui/Pagination';
import {
  WaitingApprovalTable,
  type WaitingApprovalResource,
} from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalTable';
import { WaitingApprovalStats } from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalStats';
import { WaitingApprovalToolbar } from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalToolbar';
import { useApprovalTableState } from '@/app/target-sources/[targetSourceId]/_components/layout/useApprovalTableState';
import { MetaField } from '@/app/target-sources/[targetSourceId]/_components/shared/MetaField';
import {
  ErrorRow,
  ResourceTableSkeleton,
} from '@/app/target-sources/[targetSourceId]/_components/shared/async-state-views';
import type { AsyncState } from '@/app/target-sources/[targetSourceId]/_components/shared/async-state';
import { cardStyles, cn, idcStyles, primaryColors, statusColors } from '@/lib/theme';

interface ApplyingApprovedCardProps {
  targetSourceId: number;
}

const FETCH_ERROR_MESSAGE = '반영 정보를 불러오지 못했습니다.';
const FILTER_EMPTY_MESSAGE = '조건에 맞는 결과가 없어요.';

const toSelectedRow = (item: ApprovedIntegrationResourceItem): WaitingApprovalResource => ({
  resourceId: item.resource_id,
  // Same fallback as `toExcludedRow` below and as step 2 (WaitingApprovalCard): the approval
  // request this echoes never carries `resource_type` — the step-1 payload adapter sends only
  // metadata.{provider,region,database_type} — so a row that reaches here without it is the
  // normal case, not a broken one. This is the GROUPING key (useApprovalTableState reads it as
  // `type`), so leaving it empty un-folds the Athena regions on the selected half of the table
  // while the 제외 half, which does fall back, keeps folding — one table, two grammars.
  resourceType: item.resource_type ?? item.metadata?.database_type ?? '',
  // Contract: region/database_type live under metadata (TargetSourceResourceItemDto);
  // resource_type is the declared placeholder.
  region: item.metadata?.region ?? '',
  resourceName: item.resource_name ?? '',
  selected: true,
  displayDbType: item.metadata?.database_type ?? item.resource_type,
});

const toExcludedRow = (
  item: ApprovedIntegrationExcludedResourceItem,
): WaitingApprovalResource => ({
  resourceId: item.resource_id ?? '',
  // Same contract shape as a selected row — the split that produces these items reads
  // `ApprovedIntegrationResponseDto.resources`, so both halves are TargetSourceResourceItemDto:
  // `resource_type` is top-level and region/database_type live under metadata. The legacy
  // top-level `database_type` / `database_region` remain as the fallback because older
  // snapshots (and the IDC mock) still carry them there.
  resourceType: item.resource_type ?? item.database_type ?? '',
  region: item.metadata?.region ?? item.database_region ?? '',
  displayDbType: item.metadata?.database_type ?? item.database_type ?? undefined,
  resourceName: item.resource_name ?? '',
  selected: false,
  exclusionReason: item.exclusion_reason ?? undefined,
  integrationCategory: item.integration_category ?? undefined,
  recommendFailReason: item.recommend_fail_reason ?? undefined,
});

interface ApplyingView {
  resources: WaitingApprovalResource[];
  approvedAt: string | null;
  approver: string | null;
}

const EMPTY_VIEW: ApplyingView = { resources: [], approvedAt: null, approver: null };

/**
 * Step 3 (applying) — the same stats/toolbar/table/pagination card as step 2, with the
 * approval meta (approved at / approver) in place of the request meta and no CTA
 * (advance to step 4 surfaces on the user's next refresh).
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

  const loaded = state.status === 'ready';
  const showFilterEmpty = loaded && resources.length > 0 && table.filteredCount === 0;

  return (
    <section className={cn(cardStyles.base, 'overflow-hidden')}>
      {/* Same left-aligned stack as step 2: step tag, title + status, guidance copy, approval meta. */}
      <div className={cardStyles.header}>
        {/* Status tag and guidance copy wait for the fetch: asserting a state before the data lands
            means the header can contradict what resolves under it. Skeletons hold the space so the
            card does not jump when they arrive. */}
        <div className="flex items-center gap-2">
          <h2 className={cn(cardStyles.cardTitle)}>연동 대상 반영중</h2>
          {loaded ? (
            <span
              className={cn(
                cardStyles.stepBadge,
                statusColors.warning.bg,
                statusColors.warning.textDark,
              )}
            >
              반영중
            </span>
          ) : (
            <span className={cn(idcStyles.skeletonBar, 'h-[26px] w-[62px] rounded-full')} />
          )}
        </div>
        {/* Was said three times — this sentence, a green StepBanner below it, and the guide panel.
            The banner is gone; blue marks the status clause only. `cn` is a plain join, so the size
            is declared here rather than layered over cardStyles.subtitle. */}
        {loaded ? (
          <p className={cn('mt-3', cardStyles.guidance)}>
            <strong className={cn('font-semibold', primaryColors.text)}>승인이 완료됐어요.</strong>{' '}
            Agent 설치에 필요한 준비를 최대한 빠르게 진행하고 있어요.
          </p>
        ) : (
          <div className={cn('mt-3 h-[25px] w-[520px] max-w-full rounded', idcStyles.skeletonBar)} />
        )}
        {loaded && (view.approvedAt || view.approver) && (
          <div className="mt-4 flex flex-wrap gap-8">
            {view.approvedAt && (
              <MetaField label="승인일시" value={formatDate(view.approvedAt, 'datetime')} />
            )}
            {view.approver && <MetaField label="승인자" value={view.approver} />}
          </div>
        )}
      </div>

      <div className={cardStyles.body}>
        {state.status === 'loading' ? (
          <ResourceTableSkeleton />
        ) : state.status === 'error' ? (
          <ErrorRow message={state.message} onRetry={handleRetry} />
        ) : (
          <div>
            {/* Tiles carry the all/target/excluded counts and double as that filter — same as step 2. */}
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
    </section>
  );
};
