'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getApprovedIntegration,
  type ApprovedIntegrationExcludedResourceItem,
  type ApprovedIntegrationResourceItem,
} from '@/app/lib/api';
import { AppError, isMissingApprovedIntegrationError } from '@/lib/errors';
import { readRdsInstanceMetadata } from '@/lib/rds-instances';
import { formatDate } from '@/lib/utils/date';
import { Pagination } from '@/app/components/ui/Pagination';
import {
  useApprovalColumnResize,
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
import { useLocale } from '@/app/components/LocaleProvider';
import { LAYOUT_COPY } from '@/app/target-sources/[targetSourceId]/_components/layout/copy';

interface ApplyingApprovedCardProps {
  targetSourceId: number;
}

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
  // Top-level type, no fallback: this drives the RDS Cluster tag, and `resourceType`
  // above falls back to an engine name.
  declaredResourceType: item.resource_type ?? undefined,
  // An RDS cluster lists its member instances under the row and marks the one the agent
  // connects through. Any other resource gets neither key back and is unchanged.
  ...readRdsInstanceMetadata(item.metadata, item.resource_type),
});

const toExcludedRow = (
  item: ApprovedIntegrationExcludedResourceItem,
): WaitingApprovalResource => {
  // Only the member list, never the choice: nothing was chosen for a row that is not being
  // installed, so a wire that echoed a selection anyway must not raise a 선택됨 chip here.
  // Dropped explicitly rather than assumed absent.
  const { rdsInstanceCandidates } = readRdsInstanceMetadata(item.metadata, item.resource_type);
  return {
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
    declaredResourceType: item.resource_type ?? undefined,
    // The list is the evidence for the exclusion, so it stays.
    ...(rdsInstanceCandidates ? { rdsInstanceCandidates } : {}),
  };
};

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
  const { locale } = useLocale();
  const copy = LAYOUT_COPY[locale];
  const t = copy.applying;
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
        setState({ status: 'error', message: t.fetchError });
      });

    return () => controller.abort();
  }, [targetSourceId, retryNonce, t.fetchError]);

  const handleRetry = useCallback(() => {
    setState({ status: 'loading' });
    setRetryNonce((n) => n + 1);
  }, []);

  const view = state.status === 'ready' ? state.data : EMPTY_VIEW;
  const resources = useMemo<readonly WaitingApprovalResource[]>(() => view.resources, [view]);

  const table = useApprovalTableState(resources);
  // Drag-resizable column widths, shared with step 2's waiting card — see the hook.
  const columns = useApprovalColumnResize();

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
          {/* Step position, matching INSTALL_STEPS order in InstallationProcessProgressBar. */}
          <span className={cardStyles.stepTag}>{copy.common.step(3)}</span>
          <h2 className={cn(cardStyles.cardTitle)}>{t.title}</h2>
          {loaded ? (
            <span
              className={cn(
                cardStyles.stepBadge,
                statusColors.warning.bg,
                statusColors.warning.textDark,
              )}
            >
              {t.badge}
            </span>
          ) : (
            /* 24px, not 26: the title's line box is 20 × 1.2 since the tag moved onto this row,
               so the 26px skeleton became the tallest thing in it and the row settled 2px on
               resolve — the jump the comment above promises it prevents. `stepBadge` is 24. */
            <span className={cn(idcStyles.skeletonBar, 'h-[24px] w-[62px] rounded-full')} />
          )}
        </div>
        {/* Was said three times — this sentence, a green StepBanner below it, and the guide panel.
            The banner is gone; blue marks the status clause only. `cn` is a plain join, so the size
            is declared here rather than layered over cardStyles.subtitle. */}
        {loaded ? (
          <>
            <p className={cn('mt-3', cardStyles.guidance)}>
              <strong className={cn('font-semibold', primaryColors.text)}>
                {t.approvedLead}
              </strong>{' '}
              {t.approvedTail}
            </p>
            {/* mt 없음 — 행간 여백(leading 1.55)만으로 문단을 가른다 (2·6단계 문법). */}
            <p className={cardStyles.guidance}>{t.eta}</p>
          </>
        ) : (
          /* 안내가 두 문단이 됐으니 스켈레톤도 두 줄이다 — 한 줄짜리 25px 바 하나만 두면
             resolve 시점에 아래 메타 행이 한 줄(25px)만큼 밀린다. 줄 사이 간격은 없다:
             25px 는 guidance 의 줄 상자(16px × 1.55)라 두 바가 맞닿아야 실제 높이가 된다. */
          <div className="mt-3 flex flex-col">
            <div className={cn('h-[25px] w-[520px] max-w-full rounded', idcStyles.skeletonBar)} />
            <div className={cn('h-[25px] w-[270px] max-w-full rounded', idcStyles.skeletonBar)} />
          </div>
        )}
        {loaded && (view.approvedAt || view.approver) && (
          <div className="mt-4 flex flex-wrap gap-8">
            {view.approvedAt && (
              <MetaField label={t.approvedAt} value={formatDate(view.approvedAt, 'datetime', locale)} />
            )}
            {view.approver && <MetaField label={t.approver} value={view.approver} />}
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
              raisedRows
              emptyMessage={showFilterEmpty ? copy.common.filterEmpty : undefined}
              // Same as step 2 — see WaitingApprovalCard: closed groups must not swallow what a
              // filter narrowed to, and the group's count line describes the filtered set.
              expandFolds={
                !!table.searchValue.trim()
                || !!table.dbType
                || !!table.region
                || table.filter !== 'all'
              }
              columns={columns}
            />
            {table.filteredCount > 0 && (
              <Pagination
                size="md"
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
