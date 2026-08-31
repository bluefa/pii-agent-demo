'use client';

import { formatDate } from '@/lib/utils/date';
import { cardStyles, cn, primaryColors, statusColors } from '@/lib/theme';
import { ErrorState } from '@/app/components/ui/state';
import { Pagination } from '@/app/components/ui/Pagination';
import { ResourceTableSkeleton } from '@/app/target-sources/[targetSourceId]/_components/shared/async-state-views';
import { MetaField } from '@/app/target-sources/[targetSourceId]/_components/shared/MetaField';
import {
  RejectionAlert,
} from '@/app/target-sources/[targetSourceId]/_components/common';
import { WaitingApprovalStats } from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalStats';
import { WaitingApprovalToolbar } from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalToolbar';
import { IdcResourceTable } from '@/app/target-sources/[targetSourceId]/_components/idc/IdcResourceTable';
import { useIdcApprovalTable } from '@/app/target-sources/[targetSourceId]/_components/idc/approval-table';
import { useLocale } from '@/app/components/LocaleProvider';
import { IDC_COPY } from '@/app/target-sources/[targetSourceId]/_components/idc/copy';
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
}: IdcStepProps) => {
  const { locale } = useLocale();
  const t = IDC_COPY[locale];
  // Step 3 source: the approved list + its approval signature (approved-integration).
  const { state } = useIdcRead(project.targetSourceId, getIdcApprovedIntegration);

  const view = state.status === 'ready' ? state.data : EMPTY_VIEW;
  const { table, visibleResources } = useIdcApprovalTable(view.resources);

  return (
    <>
      <section className={cn(cardStyles.base, 'overflow-hidden')}>
        <header className={cardStyles.header}>
          <div className="flex items-center gap-2">
            <span className={cardStyles.stepTag}>{t.step(3)}</span>
            <h2 className={cardStyles.cardTitle}>{t.step3Title}</h2>
            <span
              className={cn(
                cardStyles.stepBadge,
                statusColors.warning.bg,
                statusColors.warning.textDark,
              )}
            >
              {t.badgeApplying}
            </span>
          </div>
          {/* Was said twice — this sentence and a green StepBanner right below it. The banner is
              gone; blue marks the status clause only. */}
          <p className={cn('mt-3', cardStyles.guidance)}>
            <strong className={cn('font-semibold', primaryColors.text)}>{t.step3GuideEm}</strong>{' '}
            {t.step3GuideRest}
          </p>
          {/* No top margin — the 1.55 leading is the paragraph break (step-2 grammar). */}
          <p className={cardStyles.guidance}>{t.step3GuideEta}</p>
          {/* Both come from the approved-integration response the rows came from. They used to be
              a hardcoded name and a hardcoded date fallback — the project payload has no approver,
              which is what made the invention tempting. */}
          {(view.approvedAt || view.approver) && (
            <div className="mt-4 flex flex-wrap gap-8">
              {view.approvedAt && (
                <MetaField label={t.metaApprovedAt} value={formatDate(view.approvedAt, 'datetime', locale)} />
              )}
              {view.approver && <MetaField label={t.metaApprover} value={view.approver} />}
            </div>
          )}
        </header>
        <div className={cardStyles.body}>
          {state.status === 'loading' && <ResourceTableSkeleton />}
          {state.status === 'error' && <ErrorState message={t.loadFailed} />}
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
                searchPlaceholder={t.searchPlaceholder}
              />
              <IdcResourceTable
                resources={visibleResources}
                cols={['src', 'excl']}
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
          )}
        </div>
      </section>
      <RejectionAlert project={project} />
    </>
  );
};
