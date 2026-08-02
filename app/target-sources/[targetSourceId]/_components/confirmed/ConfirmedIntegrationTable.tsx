'use client';

import { useEffect, useMemo, useState } from 'react';
import { Pagination } from '@/app/components/ui/Pagination';
import { cn, textColors } from '@/lib/theme';
import type { ConfirmedResource } from '@/lib/types/resources';
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

interface ConfirmedIntegrationTableProps {
  confirmed: readonly ConfirmedResource[];
  targetSourceId: number;
}

const FILTER_EMPTY_MESSAGE = '조건에 맞는 결과가 없어요.';
const EMPTY_COUNTS: LogicalDbCountMap = new Map();

/**
 * Confirmed-integration table shared by cloud Steps 6·7 — the step-2·3 approval
 * table, minus the verdict pair (every confirmed row is a target) and minus
 * Connection Status / DB Credential: neither is part of the confirmed-integration
 * contract review; the credential pick is a step-5 decision whose evidence is the
 * passing test itself. (The step-7-only "complete" variant with its DB Credential
 * and placeholder Status columns was a v15 leftover and is gone.)
 */
export const ConfirmedIntegrationTable = ({
  confirmed,
  targetSourceId,
}: ConfirmedIntegrationTableProps) => {
  // Real per-resource logical-DB counts (연동 대상 / 연동 제외) from the latest
  // test-connection result summaries, rendered as links into the read-only list.
  // A resource with no summary entry renders "—" rather than a fabricated 0.
  const [fetched, setFetched] = useState<{ targetSourceId: number; counts: LogicalDbCountMap }>({
    targetSourceId,
    counts: EMPTY_COUNTS,
  });
  useEffect(() => {
    const controller = new AbortController();
    void getLatestTestConnectionResultSummaries(targetSourceId, { signal: controller.signal })
      .then((summaries) => {
        if (controller.signal.aborted) return;
        setFetched({ targetSourceId, counts: buildLogicalDbCountMap(summaries) });
      })
      .catch(() => {
        // No summaries available → leave the map empty so cells render "—".
      });
    return () => controller.abort();
  }, [targetSourceId]);
  // Stamped with the id it was fetched for, so a switch to another target shows "—" until its own
  // counts land. Resource ids can repeat across target sources — a stale map would silently
  // attribute one target's counts to another's rows.
  const logicalDbCounts = fetched.targetSourceId === targetSourceId ? fetched.counts : EMPTY_COUNTS;

  // Every confirmed row is a target, so the verdict/reason pair is swapped for the
  // Step 5 logical-DB counts (`confirmed` variant).
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
  // No Athena grouping here (LIN-85): from step 4 on the region IS the resource, so steps 6·7
  // want one folded region row rather than a parent with database children. Until that fold
  // lands, page these flat — one row, one unit.
  const table = useApprovalTableState(approvalRows, undefined, false);

  // The resource whose logical-DB list is open. null = closed.
  const [logicalDbTarget, setLogicalDbTarget] = useState<WaitingApprovalResource | null>(null);

  if (confirmed.length === 0) {
    return (
      <div className={cn('px-6 py-12 text-sm text-center', textColors.tertiary)}>
        확정된 연동 대상 DB 가 없습니다.
      </div>
    );
  }

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
