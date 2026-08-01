'use client';

import { formatDate } from '@/lib/utils/date';
import { cardStyles, cn, primaryColors, statusColors } from '@/lib/theme';
import { ErrorState } from '@/app/components/ui/state';
import { Pagination } from '@/app/components/ui/Pagination';
import { ResourceTableSkeleton } from '@/app/target-sources/[targetSourceId]/_components/shared/async-state-views';
import { MetaField } from '@/app/target-sources/[targetSourceId]/_components/shared/MetaField';
import {
  ProjectPageMeta,
  RejectionAlert,
} from '@/app/target-sources/[targetSourceId]/_components/common';
import { WaitingApprovalStats } from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalStats';
import { WaitingApprovalToolbar } from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalToolbar';
import { IdcResourceTable } from '@/app/target-sources/[targetSourceId]/_components/idc/IdcResourceTable';
import { useIdcApprovalTable } from '@/app/target-sources/[targetSourceId]/_components/idc/approval-table';
import {
  IDC_FILTER_EMPTY_MESSAGE,
  IDC_SEARCH_PLACEHOLDER,
} from '@/app/target-sources/[targetSourceId]/_components/idc/steps/step-copy';
import type { IdcStepProps } from '@/app/target-sources/[targetSourceId]/_components/idc/types';
import {
  getIdcApprovedIntegration,
  type IdcApprovedIntegrationView,
} from '@/app/lib/api/idc';
import { useIdcRead } from '@/app/hooks/useIdcResources';

const EMPTY_VIEW: IdcApprovedIntegrationView = { resources: [], approvedAt: null, approver: null };

/**
 * IDC Step 3 — 연동 대상 반영중 (read-only). The cloud sibling's card (ApplyingApprovedCard):
 * step tag → title + 반영중 badge → guidance → approval meta, then the same stats / toolbar /
 * connected table / pager body. No CTA — advancing to step 4 surfaces on the next refresh.
 *
 * Each step fetches its own list under its `targetSourceId` (DR3/DR4/DR5/DR7):
 * AbortController cleanup + stale-id guard, never module-level state.
 */
export const IdcStep3Applying = ({
  project,
  identity,
  providerLabel,
  action,
}: IdcStepProps) => {
  // Step 3 source: the approved list + its approval signature (approved-integration).
  const { state } = useIdcRead(project.targetSourceId, getIdcApprovedIntegration);

  const view = state.status === 'ready' ? state.data : EMPTY_VIEW;
  const { table, visibleResources } = useIdcApprovalTable(view.resources);

  return (
    <>
      <ProjectPageMeta
        project={project}
        providerLabel={providerLabel}
        identity={identity}
        action={action}
      />
      <section className={cn(cardStyles.base, 'overflow-hidden')}>
        <header className={cardStyles.header}>
          <span className={cardStyles.stepTag}>3번째 단계</span>
          <div className="flex items-center gap-2">
            <h2 className={cardStyles.cardTitle}>연동 대상 반영중</h2>
            <span
              className={cn(
                cardStyles.stepBadge,
                statusColors.warning.bg,
                statusColors.warning.textDark,
              )}
            >
              반영중
            </span>
          </div>
          {/* Was said twice — this sentence and a green StepBanner right below it. The banner is
              gone; blue marks the status clause only. */}
          <p className={cn('mt-3', cardStyles.guidance)}>
            <strong className={cn('font-semibold', primaryColors.text)}>승인이 완료됐어요.</strong>{' '}
            Agent 설치에 필요한 준비를 최대한 빠르게 진행하고 있어요.
          </p>
          {/* Both come from the approved-integration response the rows came from. They used to be
              a hardcoded name and a hardcoded date fallback — the project payload has no approver,
              which is what made the invention tempting. */}
          {(view.approvedAt || view.approver) && (
            <div className="mt-4 flex flex-wrap gap-8">
              {view.approvedAt && (
                <MetaField label="승인일시" value={formatDate(view.approvedAt, 'datetime')} />
              )}
              {view.approver && <MetaField label="승인자" value={view.approver} />}
            </div>
          )}
        </header>
        <div className={cardStyles.body}>
          {state.status === 'loading' && <ResourceTableSkeleton />}
          {state.status === 'error' && <ErrorState message="연동 대상을 불러오지 못했습니다." />}
          {state.status === 'ready' && (
            <>
              <WaitingApprovalStats
                totalCount={table.countsByFilter.all}
                selectedCount={table.countsByFilter.target}
                excludedCount={table.countsByFilter.excluded}
                filter={table.filter}
                onFilterChange={table.onFilterChange}
              />
              <WaitingApprovalToolbar
                searchValue={table.searchValue}
                onSearchChange={table.onSearchChange}
                dbType={table.dbType}
                onDbTypeChange={table.onDbTypeChange}
                region={table.region}
                onRegionChange={table.onRegionChange}
                dbTypeOptions={table.dbTypeOptions}
                regionOptions={table.regionOptions}
                searchPlaceholder={IDC_SEARCH_PLACEHOLDER}
              />
              <IdcResourceTable
                resources={visibleResources}
                cols={['excl']}
                connected
                emptyMessage={IDC_FILTER_EMPTY_MESSAGE}
              />
              {table.filteredCount > 0 && (
                <Pagination
                  page={table.safePage}
                  pageSize={table.pageSize}
                  totalCount={table.filteredCount}
                  onPageChange={table.onPageChange}
                  onPageSizeChange={table.onPageSizeChange}
                  pageSizeOptions={[10, 20, 50, 100]}
                />
              )}
            </>
          )}
        </div>
      </section>
      <RejectionAlert project={project} />
    </>
  );
};
