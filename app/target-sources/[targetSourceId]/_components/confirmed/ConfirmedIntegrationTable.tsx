'use client';

import { useEffect, useMemo, useState } from 'react';
import { InfoTooltip } from '@/app/components/ui/Tooltip';
import { Pagination } from '@/app/components/ui/Pagination';
import { usePagination } from '@/app/hooks/usePagination';
import { getDatabaseShortLabel } from '@/app/components/ui/DatabaseIcon';
import { cn, idcStyles, tableStyles, textColors } from '@/lib/theme';
import { ResourceIdCell } from '@/app/target-sources/[targetSourceId]/_components/shared/ResourceIdCell';
import type { ConfirmedResource } from '@/lib/types/resources';
import { HealthBadge } from '@/app/target-sources/[targetSourceId]/_components/confirmed/HealthBadge';
import {
  WaitingApprovalTable,
  type WaitingApprovalResource,
} from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalTable';
import { WaitingApprovalToolbar } from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalToolbar';
import { useApprovalTableState } from '@/app/target-sources/[targetSourceId]/_components/layout/useApprovalTableState';
import { LogicalDbSummaryModal } from '@/app/target-sources/[targetSourceId]/_components/logical-db/LogicalDbSummaryModal';
import { getLatestTestConnectionResultSummaries } from '@/app/lib/api';
import {
  buildLogicalDbCountMap,
  type LogicalDbCountMap,
} from '@/app/target-sources/[targetSourceId]/_components/confirmed/logical-db-summaries';

export type ConfirmedIntegrationTableVariant = 'pre-install' | 'complete';

interface ConfirmedIntegrationTableProps {
  confirmed: readonly ConfirmedResource[];
  variant?: ConfirmedIntegrationTableVariant;
  targetSourceId: number;
}

const FILTER_EMPTY_MESSAGE = '조건에 맞는 결과가 없어요.';

const STATUS_TOOLTIP_CONTENT = (
  <div className="space-y-2 text-[12px] leading-[1.5]">
    <div className="font-semibold">Status 안내</div>
    <div className="flex items-start gap-2">
      <HealthBadge status="healthy" />
      <span>모든 DB가 정상이에요.</span>
    </div>
    <div className="flex items-start gap-2">
      <HealthBadge status="unhealthy" />
      <span>DB가 비정상이에요. Agent 또는 Credential 상태를 확인해주세요.</span>
    </div>
  </div>
);

export const ConfirmedIntegrationTable = ({
  confirmed,
  variant = 'pre-install',
  targetSourceId,
}: ConfirmedIntegrationTableProps) => {
  // Display-only pagination, mirroring IdcResourceTable. Hooks run before the
  // empty-state early return so hook order stays stable across renders.
  const { page, pageSize, setPage, setPageSize, pageItems: pageRows } = usePagination(confirmed, {
    initialPageSize: 10,
  });

  // Real per-resource logical-DB counts (연동 대상 / 연동 제외) from the latest
  // test-connection result summaries. Both variants render them: step 7 as plain cells,
  // step 6 as the links into the read-only list. A resource with no summary entry
  // renders "—" rather than a fabricated 0.
  const [logicalDbCounts, setLogicalDbCounts] = useState<LogicalDbCountMap>(new Map());
  useEffect(() => {
    const controller = new AbortController();
    void getLatestTestConnectionResultSummaries(targetSourceId, { signal: controller.signal })
      .then((summaries) => {
        if (controller.signal.aborted) return;
        setLogicalDbCounts(buildLogicalDbCountMap(summaries));
      })
      .catch(() => {
        // No summaries available → leave the map empty so cells render "—".
      });
    return () => controller.abort();
  }, [targetSourceId]);

  // Step 6 renders the step-2·3 approval table: every confirmed row is a target, so the
  // verdict/reason pair is swapped for the Step 5 logical-DB counts (`confirmed` variant).
  const approvalRows = useMemo<readonly WaitingApprovalResource[]>(
    () =>
      confirmed.map((resource) => {
        const counts = logicalDbCounts.get(resource.resourceId);
        return {
          resourceId: resource.resourceId,
          resourceType: resource.databaseType ?? '',
          region: resource.region ?? '',
          resourceName: resource.resourceName ?? '',
          selected: true,
          displayDbType: resource.databaseType ?? undefined,
          logicalDbCount: counts?.target ?? null,
          excludedLogicalDbCount: counts?.excluded ?? null,
        };
      }),
    [confirmed, logicalDbCounts],
  );
  const table = useApprovalTableState(approvalRows);

  // The resource whose logical-DB list is open (step 6). null = closed.
  const [logicalDbTarget, setLogicalDbTarget] = useState<WaitingApprovalResource | null>(null);

  if (confirmed.length === 0) {
    return (
      <div className={cn('px-6 py-12 text-sm text-center', textColors.tertiary)}>
        확정된 연동 대상 DB 가 없습니다.
      </div>
    );
  }

  const cellClass = cn(tableStyles.cell, 'text-xs', textColors.tertiary);
  const monoCellClass = cn(tableStyles.cell, 'font-mono text-xs', textColors.secondary);

  if (variant === 'complete') {
    return (
      <>
      <div className={idcStyles.table.frame}>
      <table className="w-full text-sm">
        <thead className={idcStyles.table.header}>
          <tr>
            <th className={idcStyles.table.headerCell}>Database Type</th>
            <th className={idcStyles.table.headerCell}>Resource ID</th>
            <th className={idcStyles.table.headerCell}>Region</th>
            <th className={idcStyles.table.headerCell}>Resource Name</th>
            <th className={idcStyles.table.headerCell}>DB Credential</th>
            <th className={idcStyles.table.headerCell}>연동 대상 논리 DB</th>
            <th className={idcStyles.table.headerCell}>연동 제외 논리 DB</th>
            <th className={idcStyles.table.headerCell}>
              <span className="inline-flex items-center gap-1">
                Status
                {/* 17px — same table-header (?) size as CSP step 1 and the IDC Source IP header. */}
                <InfoTooltip content={STATUS_TOOLTIP_CONTENT} position="top" size="md" iconSize={17} />
              </span>
            </th>
          </tr>
        </thead>
        <tbody className={tableStyles.body}>
          {pageRows.map((resource) => {
            const counts = logicalDbCounts.get(resource.resourceId);
            return (
              <tr key={resource.resourceId} className={cn(tableStyles.row, 'group')}>
                <td className={cellClass}>{resource.databaseType ? <span className={textColors.secondary}>{getDatabaseShortLabel(resource.databaseType)}</span> : '-'}</td>
                <td className={cellClass}>
                  <ResourceIdCell value={resource.resourceId} label="Resource ID" />
                </td>
                <td className={monoCellClass}>{resource.region ?? '-'}</td>
                <td className={monoCellClass}>{resource.resourceName ?? '-'}</td>
                <td className={cellClass}>{resource.credentialId ?? '-'}</td>
                <td className={cellClass}>{counts ? counts.target : '—'}</td>
                <td className={cellClass}>{counts ? counts.excluded : '—'}</td>
                {/* No per-resource health field in the confirmed-integration contract — render "—". */}
                <td className={cn(tableStyles.cell, textColors.quaternary)}>—</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
      <Pagination
        page={page}
        pageSize={pageSize}
        totalCount={confirmed.length}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        pageSizeOptions={[10, 20, 50, 100]}
      />
      </>
    );
  }

  // Step 6 — the step-2·3 approval table, minus the verdict pair (every confirmed row is a
  // target) and minus Connection Status: that field is NOT part of the confirmed-integration
  // contract (it only exists once a Step-5 test-connection run is fetched), so the column
  // could never render anything but a placeholder here.
  // Toolbar (top-rounded) + table + pagination join as one card, same as steps 2·3.
  // No margin of its own — the card body's top padding (cardStyles.body) is the gap, so the
  // table's left edge lines up with the header copy above it.
  return (
    <div>
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
        variant="confirmed"
        onLogicalDbOpen={setLogicalDbTarget}
        connected
        emptyMessage={FILTER_EMPTY_MESSAGE}
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
      {/* Mounted only while open so the hook fetches on open and drops its state on close. */}
      {logicalDbTarget && (
        <LogicalDbSummaryModal
          open
          targetSourceId={targetSourceId}
          resourceId={logicalDbTarget.resourceId}
          resourceName={logicalDbTarget.resourceName || logicalDbTarget.resourceId}
          onClose={() => setLogicalDbTarget(null)}
        />
      )}
    </div>
  );
};
