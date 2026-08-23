'use client';

import { useEffect, useMemo, useState } from 'react';
import { Pagination } from '@/app/components/ui/Pagination';
import { useColumnResize } from '@/app/components/ui/useColumnResize';
import { cn, textColors } from '@/lib/theme';
import type { ConfirmedResource } from '@/lib/types/resources';
import {
  CONFIRMED_FLEX_KEYS,
  hasKindColumn,
  WaitingApprovalTable,
  type WaitingApprovalResource,
} from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalTable';
import {
  FilterMenu,
  SearchBox,
} from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalToolbar';
import { useApprovalTableState } from '@/app/target-sources/[targetSourceId]/_components/layout/useApprovalTableState';
import { LogicalDbSummaryModal } from '@/app/target-sources/[targetSourceId]/_components/logical-db/LogicalDbSummaryModal';
import { getLatestTestConnectionResultSummaries } from '@/app/lib/api';
import { resultUnitId } from '@/lib/resource-grouping';
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
  //
  // Athena folds to ONE row per region, the same unit steps 4·5 operate on: from step 4 on the
  // region IS the resource. The confirmed-integration contract still answers per database
  // (`…:AwsDataCatalog/<db>`), so the fold happens here, keyed on `athena_region_resource_id`
  // through `resultUnitId` — nothing parses an id. Counts add across the region and stay null
  // while no member has one, so the cell renders — rather than a fabricated 0.
  const approvalRows = useMemo<readonly WaitingApprovalResource[]>(() => {
    const rows: WaitingApprovalResource[] = [];
    const byUnit = new Map<string, WaitingApprovalResource>();
    const addCount = (a: number | null, b: number | null | undefined): number | null =>
      a === null && (b === null || b === undefined) ? null : (a ?? 0) + (b ?? 0);
    // A folded row is named by its engine, so its databases would go unfindable once collapsed.
    // Kept OFF `resourceName`: that field feeds the count cells' aria-labels and the modal, and
    // a row whose engine is unknown renders those — it would then read "db_a db_b 연동 논리 DB
    // 목록 보기".
    const addSearchText = (row: WaitingApprovalResource, name: string) => {
      row.searchText = row.searchText ? `${row.searchText} ${name}` : name;
    };

    for (const resource of confirmed) {
      const counts = logicalDbCounts.get(resource.resourceId);
      const name = resource.resourceName ?? '';
      const unitId = resultUnitId(resource);
      const existing = byUnit.get(unitId);
      if (existing) {
        existing.foldedMembers = [
          ...(existing.foldedMembers ?? []),
          { resourceId: resource.resourceId, resourceName: name },
        ];
        addSearchText(existing, name);
        existing.logicalDbCount = addCount(existing.logicalDbCount ?? null, counts?.target);
        existing.excludedLogicalDbCount = addCount(
          existing.excludedLogicalDbCount ?? null,
          counts?.excluded,
        );
        continue;
      }
      const row: WaitingApprovalResource = {
        resourceId: unitId,
        // Stays the ENGINE: here this field doubles as the grouping key and the Athena fold's
        // printed label. The real resource type rides `declaredResourceType` rather than
        // overloading this one — see that field's note on WaitingApprovalResource.
        resourceType: resource.databaseType ?? '',
        declaredResourceType: resource.type,
        region: resource.region ?? '',
        resourceName: name,
        selected: true,
        displayDbType: resource.databaseType ?? undefined,
        logicalDbCount: counts?.target ?? null,
        excludedLogicalDbCount: counts?.excluded ?? null,
      };
      if (resource.athenaRegionResourceId) {
        row.foldedMembers = [{ resourceId: resource.resourceId, resourceName: name }];
        // The fold prints the engine, not this name, so it moves to the haystack.
        row.resourceName = '';
        addSearchText(row, name);
      }
      rows.push(row);
      byUnit.set(unitId, row);
    }
    return rows;
  }, [confirmed, logicalDbCounts]);
  // Each row — a folded region or a single resource — is already one unit, so page them flat.
  const table = useApprovalTableState(approvalRows, undefined, false);

  // The resource whose logical-DB list is open. null = closed.
  const [logicalDbTarget, setLogicalDbTarget] = useState<WaitingApprovalResource | null>(null);

  // Round 3 — drag-resizable columns, capped at each column's longest value, widths kept
  // across sessions. Lives here rather than in the table because the storage key names
  // THIS screen's table; the shell only consumes the instance.
  const columns = useColumnResize({
    clampToContent: true,
    storageKey: 'pii:colw:v1:confirmed-resources',
    // …except the flex columns: a stored width there pins the column, and pinning every one
    // of them leaves nobody absorbing, so the table stops following the container with
    // nothing on screen saying why and no control to undo it (round 19). Drag them, keep the
    // width for the session, get the responsive default back on reload.
    ephemeralKeys: CONFIRMED_FLEX_KEYS,
  });

  // 시안 D (via F): search and filters appear only past Cloudscape's own ">5 items" line —
  // below it the counter says everything they could. An active condition keeps its control
  // visible even if the list shrinks under the line, mirroring FilterMenu's own rule.
  const showChrome =
    approvalRows.length > 5 || !!table.searchValue || !!table.dbType || !!table.region;

  if (confirmed.length === 0) {
    return (
      <div className={cn('px-6 py-12 text-sm text-center', textColors.tertiary)}>
        확정된 연동 대상 DB 가 없습니다.
      </div>
    );
  }

  // Round 3 console band + naked table; round 15 moved the total OUT of the band and into
  // the footer (owner), so the band is now search/filter only and renders nothing at all
  // below the ">5 items" line — the table starts at its own thead.
  return (
    <div>
      {showChrome && (
        <div className="flex flex-wrap items-center justify-end gap-[10px] pb-3">
          <SearchBox value={table.searchValue} onChange={table.onSearchChange} />
          <FilterMenu
            pinRight={false}
            groups={[
              {
                key: 'dbType',
                label: 'Database Type',
                value: table.dbType,
                onChange: table.onDbTypeChange,
                options: table.dbTypeOptions,
              },
              {
                key: 'region',
                label: 'Region',
                value: table.region,
                onChange: table.onRegionChange,
                options: table.regionOptions,
              },
            ]}
          />
        </div>
      )}
      <WaitingApprovalTable
        resources={table.visibleResources}
        variant="confirmed"
        // Asked of the whole roster, not of `visibleResources` — otherwise the column, and
        // 128px of table width, appear and disappear as the user pages or filters.
        kindColumn={hasKindColumn(approvalRows)}
        onLogicalDbOpen={setLogicalDbTarget}
        connected
        emptyMessage={FILTER_EMPTY_MESSAGE}
        // While the list is narrowed, a region may be here because of a database inside its
        // fold. Leaving it shut shows a row that does not visibly contain what was typed.
        expandFolds={!!table.searchValue.trim() || !!table.dbType || !!table.region}
        columns={columns}
      />
      {/* Round 17 (owner): "target-sources/1006 에서 보여지는 pagination footer 디자인
          차용" — the v15 bar the other 20 tables use, at 14px. Always mounted, count and
          controls alike; 시안 D's "pagination earns its row" is retired for this table. */}
      <Pagination
        size="md"
        page={table.safePage}
        pageSize={table.pageSize}
        totalCount={table.filteredCount}
        onPageChange={table.onPageChange}
        onPageSizeChange={table.onPageSizeChange}
        pageSizeOptions={[10, 20, 50, 100]}
      />
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
