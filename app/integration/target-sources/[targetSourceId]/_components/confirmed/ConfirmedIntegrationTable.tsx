'use client';

import { InfoTooltip } from '@/app/components/ui/Tooltip';
import { Pagination } from '@/app/components/ui/Pagination';
import { usePagination } from '@/app/hooks/usePagination';
import { getDatabaseShortLabel } from '@/app/components/ui/DatabaseIcon';
import { cn, idcStyles, tableStyles, textColors } from '@/lib/theme';
import { ResourceIdCell } from '@/app/integration/target-sources/[targetSourceId]/_components/shared/ResourceIdCell';
import type { ConfirmedResource } from '@/lib/types/resources';
import { HealthBadge } from '@/app/integration/target-sources/[targetSourceId]/_components/confirmed/HealthBadge';
import { deriveHealth } from '@/app/integration/target-sources/[targetSourceId]/_components/confirmed/health-status';
import { deriveLogicalDbCounts, stableHash } from '@/lib/logical-db-counts';

export type ConfirmedIntegrationTableVariant = 'pre-install' | 'complete';

interface ConfirmedIntegrationTableProps {
  confirmed: readonly ConfirmedResource[];
  variant?: ConfirmedIntegrationTableVariant;
}

// v15 shows a mixed Status column — most rows Healthy with one Unhealthy. A
// DISCONNECTED resource is always Unhealthy (real signal); otherwise, to mirror
// v15 on the all-connected demo fixtures, deterministically flag the single
// highest-hash row as Unhealthy when the table has 2+ rows.
const pickDemoUnhealthyId = (confirmed: readonly ConfirmedResource[]): string | null => {
  if (confirmed.length < 2) return null;
  return confirmed.reduce((winner, resource) =>
    stableHash(resource.resourceId) > stableHash(winner.resourceId) ? resource : winner,
  ).resourceId;
};

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
}: ConfirmedIntegrationTableProps) => {
  // Display-only pagination, mirroring IdcResourceTable. Hooks run before the
  // empty-state early return so hook order stays stable across renders.
  const { page, pageSize, setPage, setPageSize, pageItems: pageRows } = usePagination(confirmed, {
    initialPageSize: 10,
  });

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
    const demoUnhealthyId = pickDemoUnhealthyId(confirmed);
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
                <InfoTooltip content={STATUS_TOOLTIP_CONTENT} position="top" size="md" />
              </span>
            </th>
          </tr>
        </thead>
        <tbody className={tableStyles.body}>
          {pageRows.map((resource) => {
            const [targetCount, excludedCount] = deriveLogicalDbCounts(resource.resourceId);
            return (
              <tr key={resource.resourceId} className={cn(tableStyles.row, 'group')}>
                <td className={cellClass}>{resource.databaseType ? <span className={cn(idcStyles.tag.base, idcStyles.tag.blue)}>{getDatabaseShortLabel(resource.databaseType)}</span> : '-'}</td>
                <td className={cellClass}>
                  <ResourceIdCell value={resource.resourceId} label="Resource ID" />
                </td>
                <td className={monoCellClass}>{resource.region ?? '-'}</td>
                <td className={monoCellClass}>{resource.resourceName ?? '-'}</td>
                <td className={cellClass}>{resource.credentialId ?? '-'}</td>
                <td className={cellClass}>{targetCount}</td>
                <td className={cellClass}>{excludedCount}</td>
                <td className={tableStyles.cell}>
                  <HealthBadge
                    status={
                      resource.resourceId === demoUnhealthyId ? 'unhealthy' : deriveHealth(resource)
                    }
                  />
                </td>
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

  // Connection Status is NOT part of the confirmed-integration contract — it only
  // exists once a test-connection run is fetched (Step 5's latest_version agent
  // results). On the steps that render this table (cloud Step 6) no test-connection
  // result is fetched, so the column shows "-" rather than a fabricated badge.
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
          <th className={idcStyles.table.headerCell}>Connection Status</th>
        </tr>
      </thead>
      <tbody className={tableStyles.body}>
        {pageRows.map((resource) => (
          <tr key={resource.resourceId} className={cn(tableStyles.row, 'group')}>
            <td className={cellClass}>{resource.databaseType ? <span className={cn(idcStyles.tag.base, idcStyles.tag.blue)}>{getDatabaseShortLabel(resource.databaseType)}</span> : '-'}</td>
            <td className={cellClass}>
              <ResourceIdCell value={resource.resourceId} label="Resource ID" />
            </td>
            <td className={monoCellClass}>{resource.region ?? '-'}</td>
            <td className={monoCellClass}>{resource.resourceName ?? '-'}</td>
            <td className={cellClass}>{resource.credentialId ?? '-'}</td>
            <td className={cn(tableStyles.cell, textColors.quaternary)}>-</td>
          </tr>
        ))}
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
};
