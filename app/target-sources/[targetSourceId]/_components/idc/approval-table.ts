'use client';

import { useMemo } from 'react';
import type { IdcResourceView } from '@/app/lib/api/idc';
import { useApprovalTableState } from '@/app/target-sources/[targetSourceId]/_components/layout/useApprovalTableState';
import type { WaitingApprovalResource } from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalTable';

/**
 * The projection below puts the IDC display label in `resourceType`, so the hook's default
 * accessor (which runs the cloud `getDatabaseShortLabel` map and would turn MSSQL into SQL
 * Server) must be replaced — the filter option has to read exactly as the column does.
 */
const idcDbTypeLabelOf = (row: WaitingApprovalResource): string => row.resourceType;

/**
 * Search / DB-type filter / paging for the IDC step tables, driven by the same
 * `useApprovalTableState` the cloud steps use so both sides derive identically.
 *
 * IDC rows are identified by host, not by a scan-assigned name/id pair, so the projection maps
 * hosts onto `resourceName` (what the 연동 대상 column shows and what a user would type) and
 * leaves `region` empty — IDC has no region, and the toolbar drops a filter group with no
 * options rather than opening onto a lone 전체.
 *
 * Returns the original rows (not the projection) so callers keep their own row type.
 */
export const useIdcApprovalTable = <T extends IdcResourceView>(resources: readonly T[]) => {
  const rows = useMemo<readonly WaitingApprovalResource[]>(
    () =>
      resources.map((r) => ({
        resourceId: r.resourceId,
        resourceType: r.databaseTypeLabel,
        region: '',
        resourceName: r.hosts.join(' '),
        selected: !r.excluded,
      })),
    [resources],
  );

  const table = useApprovalTableState(rows, idcDbTypeLabelOf);

  const byId = useMemo(() => new Map(resources.map((r) => [r.resourceId, r])), [resources]);
  const visibleResources = useMemo(
    () =>
      table.visibleResources
        .map((row) => byId.get(row.resourceId))
        .filter((r): r is T => r != null),
    [table.visibleResources, byId],
  );

  return { table, visibleResources };
};
