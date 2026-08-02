'use client';

import { cardStyles, cn, primaryColors, statusColors, textColors } from '@/lib/theme';
import { ErrorState } from '@/app/components/ui/state';
import { Pagination } from '@/app/components/ui/Pagination';
import { formatDate } from '@/lib/utils/date';
import { ResourceTableSkeleton } from '@/app/target-sources/[targetSourceId]/_components/shared/async-state-views';
import { MetaField } from '@/app/target-sources/[targetSourceId]/_components/shared/MetaField';
import {
  ProjectPageMeta,
  RejectionAlert,
} from '@/app/target-sources/[targetSourceId]/_components/common';
import { WaitingApprovalCancelButton } from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalCancelButton';
import { WaitingApprovalStats } from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalStats';
import { WaitingApprovalToolbar } from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalToolbar';
import { ApprovalUnavailableCard } from '@/app/target-sources/[targetSourceId]/_components/layout/ApprovalUnavailableCard';
import { IdcResourceTable } from '@/app/target-sources/[targetSourceId]/_components/idc/IdcResourceTable';
import { useIdcApprovalTable } from '@/app/target-sources/[targetSourceId]/_components/idc/approval-table';
import {
  IDC_FILTER_EMPTY_MESSAGE,
  IDC_SEARCH_PLACEHOLDER,
} from '@/app/target-sources/[targetSourceId]/_components/idc/steps/step-copy';
import type { IdcStepProps } from '@/app/target-sources/[targetSourceId]/_components/idc/types';
import { getProject } from '@/app/lib/api';
import {
  getIdcApprovalRequestLatest,
  type IdcApprovalRequestView,
} from '@/app/lib/api/idc';
import { useIdcRead } from '@/app/hooks/useIdcResources';

const EMPTY_VIEW: IdcApprovalRequestView = {
  resources: [],
  unavailableReason: null,
  requestedAt: null,
  requestedBy: null,
};

/**
 * IDC Step 2 — 연동 대상 승인 대기 (read-only).
 *
 * Same card as the cloud sibling (WaitingApprovalCard): step tag → title + state badge →
 * guidance copy → submission meta in the header, then the stats filter, the search toolbar,
 * the connected-skin table and its pager in the body. The green/blue StepBanner is gone —
 * it repeated the guidance sentence directly above it.
 *
 * Each step fetches its own list under its `targetSourceId` (DR3/DR4/DR5/DR7):
 * AbortController cleanup + stale-id guard, never module-level state.
 */
export const IdcStep2WaitingApproval = ({
  project,
  identity,
  providerLabel,
  action,
  onProjectUpdate,
}: IdcStepProps) => {
  const { targetSourceId } = project;

  // Step 2 source: approval-requests/latest — the request as submitted. Rows, verdict and
  // signature all ride one response, and it is the only read that keeps the connection info on
  // EXCLUDED rows (approved-integration's excluded DTO drops it).
  const { state } = useIdcRead(targetSourceId, getIdcApprovalRequestLatest);

  const view = state.status === 'ready' ? state.data : EMPTY_VIEW;
  const { table, visibleResources } = useIdcApprovalTable(view.resources);

  const refreshProject = async () => onProjectUpdate(await getProject(targetSourceId));

  return (
    <>
      <ProjectPageMeta
        project={project}
        providerLabel={providerLabel}
        identity={identity}
        action={action}
      />
      {view.unavailableReason != null ? (
        <ApprovalUnavailableCard
          targetSourceId={targetSourceId}
          reason={view.unavailableReason}
          onReselected={refreshProject}
        />
      ) : (
        <section className={cn(cardStyles.base, 'overflow-hidden')}>
          <header className={cardStyles.header}>
            <span className={cardStyles.stepTag}>2번째 단계</span>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-2">
                <h2 className={cardStyles.cardTitle}>연동 대상 승인 대기</h2>
                <span
                  className={cn(
                    cardStyles.stepBadge,
                    statusColors.warning.bg,
                    statusColors.warning.textDark,
                  )}
                >
                  승인 대기
                </span>
              </div>
              {/* Card CTA sits beside the title — in a bottom dock the user only meets it past
                  the whole table. */}
              <div className="shrink-0">
                <WaitingApprovalCancelButton
                  targetSourceId={targetSourceId}
                  onSuccess={refreshProject}
                />
              </div>
            </div>
            {/* Blue marks the status sentence only; the rest drops to the secondary tone. */}
            <p className={cn('mt-3', cardStyles.guidance)}>
              <strong className={cn('font-semibold', primaryColors.text)}>
                관리자 승인을 기다리고 있어요.
              </strong>{' '}
              평균 1영업일 내 검토되며, 결과는 이 화면에서 확인할 수 있어요.
            </p>
            {/* No top margin — the 1.55 leading is the paragraph break (cloud step-2 grammar). */}
            <p className={cardStyles.guidance}>
              연동 대상을 다시 고르고 싶다면 우측 상단{' '}
              <strong className={cn('font-semibold', textColors.secondary)}>다시 요청하기</strong>를
              눌러주세요.
            </p>
            {view.requestedAt && view.requestedBy && (
              // 24px above it — the widest gap in the header, marking the boundary between
              // "what happened / what to do" and reference facts.
              <div className="mt-6 flex flex-wrap gap-8">
                <MetaField label="요청일시" value={formatDate(view.requestedAt, 'datetime')} />
                <MetaField label="요청자" value={view.requestedBy} />
              </div>
            )}
          </header>
          <div className={cardStyles.body}>
            {state.status === 'loading' && <ResourceTableSkeleton />}
            {state.status === 'error' && <ErrorState message="연동 대상을 불러오지 못했습니다." />}
            {state.status === 'ready' && (
              <>
                {/* Tiles carry the all/target/excluded counts and double as that filter. */}
                <WaitingApprovalStats
                  totalCount={table.countsByFilter.all}
                  selectedCount={table.countsByFilter.target}
                  excludedCount={table.countsByFilter.excluded}
                  filter={table.filter}
                  onFilterChange={table.onFilterChange}
                />
                {/* Toolbar (top-rounded) + table + pagination (bottom-rounded): one card, no gaps. */}
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
                  // No Source IP: the BDC assigns it while the request is being reviewed, so at
                  // 승인 대기 the column would be empty on every row. Step 3 onward shows it.
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
      )}
      <RejectionAlert project={project} />
    </>
  );
};
