'use client';

import { useEffect, useState } from 'react';
import { ErrorState } from '@/app/components/ui/state';
import { Pagination } from '@/app/components/ui/Pagination';
import { ResourceTableSkeleton } from '@/app/target-sources/[targetSourceId]/_components/shared/async-state-views';
import { WaitingApprovalToolbar } from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalToolbar';
import { IdcResourceTable } from '@/app/target-sources/[targetSourceId]/_components/idc/IdcResourceTable';
import { useIdcApprovalTable } from '@/app/target-sources/[targetSourceId]/_components/idc/approval-table';
import {
  IDC_FILTER_EMPTY_MESSAGE,
  IDC_SEARCH_PLACEHOLDER,
} from '@/app/target-sources/[targetSourceId]/_components/idc/steps/step-copy';
import { LogicalDbSummaryModal } from '@/app/target-sources/[targetSourceId]/_components/logical-db/LogicalDbSummaryModal';
import {
  buildLogicalDbCountMap,
  type LogicalDbCountMap,
} from '@/app/target-sources/[targetSourceId]/_components/confirmed/logical-db-summaries';
import { getLatestTestConnectionResultSummaries } from '@/app/lib/api';
import type { IdcResourceView } from '@/app/lib/api/idc';
import type { ResourcesState } from '@/app/hooks/useIdcResources';

const EMPTY_RESOURCES: readonly IdcResourceView[] = [];
const EMPTY_COUNTS: LogicalDbCountMap = new Map();

interface IdcConfirmedResourcesPanelProps {
  targetSourceId: number;
  /** Confirmed-integration read owned by the host step (DR3/DR4/DR5/DR7 — one fetch per step). */
  state: ResourcesState;
  /**
   * Step 5 only. The logical-DB exclusion policy is still editable there, so that step owns
   * the modal (LogicalDbModalLoader, which writes) and the panel only reports the click.
   * Steps 6·7 omit it and get the read-only summary rendered below.
   */
  onLogicalOpen?: (resource: IdcResourceView) => void;
  /**
   * Step 5 only, and the two travel together: the credential column exists exactly when the
   * step can write one. Steps 6·7 pass neither and get the same table without the column.
   */
  credentials?: Readonly<Record<string, string>>;
  onCredentialOpen?: (resource: IdcResourceView) => void;
}

/**
 * Confirmed-resources block shared by IDC Steps 5·6·7 — the IDC counterpart of the
 * cloud ConfirmedResourcesSlot. The step owns the confirmed-integration fetch;
 * the panel owns the table chrome: search/filter toolbar, the `src` + logical-DB
 * table, pagination, the Step-5 logical-DB count map and the per-resource modal.
 */
export const IdcConfirmedResourcesPanel = ({
  targetSourceId,
  state,
  onLogicalOpen,
  credentials,
  onCredentialOpen,
}: IdcConfirmedResourcesPanelProps) => {
  // Step 5 counts for the whole table in one call; the per-resource lists load only on open.
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

  // The resource whose logical-DB list is open. null = closed.
  const [logicalTarget, setLogicalTarget] = useState<IdcResourceView | null>(null);

  // Search / filter / paging shared with the cloud step-6 table, via the same IDC projection
  // steps 1·2·3 use.
  const resources = state.status === 'ready' ? state.resources : EMPTY_RESOURCES;
  const { table, visibleResources } = useIdcApprovalTable(resources);

  return (
    <>
      {state.status === 'loading' && <ResourceTableSkeleton />}
      {state.status === 'error' && <ErrorState message="연동 대상을 불러오지 못했습니다." />}
      {state.status === 'ready' && (
        <>
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
            // 출발지가 마지막 — 이 화면들에선 결과(Credential·논리 DB)가 먼저 읽히고
            // 출발지는 참고값이다. 순서가 곧 자리다(IdcTableCol).
            cols={onCredentialOpen ? ['cred', 'logicalro', 'src'] : ['logicalro', 'src']}
            logicalDbCounts={logicalDbCounts}
            onLogicalOpen={onLogicalOpen ?? setLogicalTarget}
            credentials={credentials}
            onCredentialOpen={onCredentialOpen}
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
      {/* Mounted only while open so the hook fetches on open and drops its state on close.
          Never reached when the step owns the modal — `logicalTarget` stays null then. */}
      {logicalTarget && (
        <LogicalDbSummaryModal
          open
          targetSourceId={targetSourceId}
          resourceId={logicalTarget.resourceId}
          resourceName={logicalTarget.hosts[0] ?? logicalTarget.resourceId}
          onClose={() => setLogicalTarget(null)}
        />
      )}
    </>
  );
};
