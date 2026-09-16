'use client';

import { cardStyles, cn, primaryColors, statusColors, textColors } from '@/lib/theme';
import { ErrorState } from '@/app/components/ui/state';
import { Pagination } from '@/app/components/ui/Pagination';
import { formatDate } from '@/lib/utils/date';
import { ResourceTableSkeleton } from '@/app/target-sources/[targetSourceId]/_components/shared/async-state-views';
import { MetaField } from '@/app/target-sources/[targetSourceId]/_components/shared/MetaField';
import { WaitingApprovalCancelButton } from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalCancelButton';
import { WaitingApprovalStats } from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalStats';
import { WaitingApprovalToolbar } from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalToolbar';
import { ApprovalUnavailableCard } from '@/app/target-sources/[targetSourceId]/_components/layout/ApprovalUnavailableCard';
import { RejectionVerdict } from '@/app/target-sources/[targetSourceId]/_components/layout/RejectionVerdict';
import { RejectedTargetRecord } from '@/app/target-sources/[targetSourceId]/_components/layout/RejectedTargetRecord';
import { WaitingApprovalReselectButton } from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalReselectButton';
import { IdcResourceTable } from '@/app/target-sources/[targetSourceId]/_components/idc/IdcResourceTable';
import { useIdcApprovalTable } from '@/app/target-sources/[targetSourceId]/_components/idc/approval-table';
import { useLocale } from '@/app/components/LocaleProvider';
import { IDC_COPY } from '@/app/target-sources/[targetSourceId]/_components/idc/copy';
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
  rejected: null,
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
  onProjectUpdate,
}: IdcStepProps) => {
  const { locale } = useLocale();
  const t = IDC_COPY[locale];
  const { targetSourceId } = project;

  // Step 2 source: approval-requests/latest — the request as submitted. Rows, verdict and
  // signature all ride one response, and it is the only read that keeps the connection info on
  // EXCLUDED rows (approved-integration's excluded DTO drops it).
  const { state } = useIdcRead(targetSourceId, getIdcApprovalRequestLatest);

  const view = state.status === 'ready' ? state.data : EMPTY_VIEW;
  const { table, visibleResources } = useIdcApprovalTable(view.resources);

  const refreshProject = async () => onProjectUpdate(await getProject(targetSourceId));

  // Rejected keeps the table (the reason names a DB), only the header switches state — same as
  // the cloud WaitingApprovalCard. The verdict rides the same fetch as the rows.
  const rejected = view.rejected;
  const requestSummary =
    view.requestedAt && view.requestedBy
      ? { requestedAt: view.requestedAt, requestedBy: view.requestedBy }
      : null;

  // Same list in both states — pending shows it outright, rejected tucks it behind the record
  // disclosure (cloud WaitingApprovalCard grammar).
  const listBlock = (
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
        searchPlaceholder={t.searchPlaceholder}
      />
      <IdcResourceTable
        resources={visibleResources}
        // No 출발지: the BDC assigns it while the request is being reviewed, so at
        // 승인 대기 the column would be empty on every row. Step 3 onward shows it.
        cols={['excl']}
        connected
        emptyMessage={t.filterEmpty}
      />
      {table.filteredCount > 0 && (
        <Pagination
          size="md"
          page={table.safePage}
          pageSize={table.pageSize}
          totalCount={table.filteredCount}
          onPageChange={table.onPageChange}
          onPageSizeChange={table.onPageSizeChange}
          pageSizeOptions={[10, 20, 50, 100]}
        />
      )}
    </>
  );

  return (
    <>
      {view.unavailableReason != null ? (
        <ApprovalUnavailableCard
          targetSourceId={targetSourceId}
          reason={view.unavailableReason}
          onReselected={refreshProject}
        />
      ) : (
        <section className={cn(cardStyles.base, 'overflow-hidden')}>
          <header className={cardStyles.header}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className={cardStyles.stepTag}>{t.step(2)}</span>
                <h2 className={cardStyles.cardTitle}>{t.step2Title}</h2>
                <span
                  className={cn(
                    // Rejected matches the 반려 사유 tag in the verdict quote below (cloud grammar).
                    rejected
                      ? 'inline-flex items-center rounded-md px-1.5 py-0.5 text-[12px] font-medium'
                      : cardStyles.stepBadge,
                    statusColors.warning.bg,
                    statusColors.warning.textDark,
                  )}
                >
                  {rejected ? t.badgeRejected : t.badgePending}
                </span>
              </div>
              {/* Card CTA sits beside the title — in a bottom dock the user only meets it past
                  the whole table. */}
              {!rejected && (
                <div className="shrink-0">
                  <WaitingApprovalCancelButton
                    targetSourceId={targetSourceId}
                    onSuccess={refreshProject}
                  />
                </div>
              )}
            </div>
            {rejected ? (
              <RejectionVerdict
                reason={rejected.reason}
                processedAt={rejected.processedAt}
                processedBy={rejected.processedBy}
                action={
                  <WaitingApprovalReselectButton
                    targetSourceId={targetSourceId}
                    onSuccess={refreshProject}
                  />
                }
              />
            ) : (
              <>
                {/* Blue marks the status sentence only; the rest drops to the secondary tone. */}
                <p className={cn('mt-3', cardStyles.guidance)}>
                  <strong className={cn('font-semibold', primaryColors.text)}>{t.step2GuideEm}</strong>{' '}
                  {t.step2GuideRest}
                </p>
                {/* No top margin — the 1.55 leading is the paragraph break (cloud step-2 grammar). */}
                <p className={cardStyles.guidance}>
                  {t.step2RetryBefore}
                  <strong className={cn('font-semibold', textColors.secondary)}>{t.retryRequest}</strong>
                  {t.step2RetryAfter}
                </p>
                {view.requestedAt && view.requestedBy && (
                  // 24px above it — the widest gap in the header, marking the boundary between
                  // "what happened / what to do" and reference facts.
                  <div className="mt-6 flex flex-wrap gap-8">
                    <MetaField label={t.metaRequestedAt} value={formatDate(view.requestedAt, 'datetime', locale)} />
                    <MetaField label={t.metaRequestedBy} value={view.requestedBy} />
                  </div>
                )}
              </>
            )}
          </header>
          <div className={cardStyles.body}>
            {state.status === 'loading' && <ResourceTableSkeleton />}
            {state.status === 'error' && <ErrorState message={t.loadFailed} />}
            {state.status === 'ready' && !rejected && listBlock}
            {state.status === 'ready' && rejected && (
              <RejectedTargetRecord
                totalCount={table.countsByFilter.all}
                selectedCount={table.countsByFilter.target}
                excludedCount={table.countsByFilter.excluded}
                request={requestSummary}
              >
                {listBlock}
              </RejectedTargetRecord>
            )}
          </div>
        </section>
      )}
    </>
  );
};
