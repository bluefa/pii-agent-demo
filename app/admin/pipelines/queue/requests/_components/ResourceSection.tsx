'use client';

/**
 * P3 연동 대상 리소스 section — stat tiles that ARE the filter, toolbar, the provider's
 * table, pager footer. Split out of the page (AP-B1); it owns no data, only the query
 * state the list needs.
 */
import type { ReactElement } from 'react';
import { getDatabaseShortLabel } from '@/app/components/ui/DatabaseIcon';
import { Pagination } from '@/app/components/ui/Pagination';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { PlEmptyState } from '@/app/admin/pipelines/_components/PlEmptyState';
import {
  ResourceStatTiles,
  ResourceToolbar,
} from '@/app/admin/pipelines/queue/requests/_components/ResourceFilterBar';
import { CloudResourceTable } from '@/app/admin/pipelines/queue/requests/_components/CloudResourceTable';
import { IdcResourceTable } from '@/app/admin/pipelines/queue/requests/_components/IdcResourceTable';
import {
  axisOptions,
  databaseTypeOptions,
  pageResources,
  queryResources,
  resourceCounts,
  type ResourceListState,
} from '@/app/admin/pipelines/queue/requests/_resourceQuery';
import type { RequestResourceRow } from '@/app/lib/api/task-queue-requests';

export interface ResourceSectionProps {
  resources: readonly RequestResourceRow[];
  isIdc: boolean;
  list: ResourceListState;
  /** Lock NLB editing: the request is no longer PENDING, so a save would 409. */
  nlbLocked: boolean;
  /** IDC only — open the NLB assignment modal over one resource. */
  onAssignNlb: (row: RequestResourceRow) => void;
  /** IDC only — open that resource's 서비스별 NLB 배정 list. */
  onShowServices: (row: RequestResourceRow) => void;
  onOpenNlbListeners: () => void;
}

export function ResourceSection({
  resources,
  isIdc,
  list,
  nlbLocked,
  onAssignNlb,
  onShowServices,
  onOpenNlbListeners,
}: ResourceSectionProps): ReactElement {
  const { query, patchQuery } = list;
  // Counts stay whole-request (the tiles are the split); only the table pages.
  const counts = resourceCounts(resources);
  const filtered = queryResources(resources, query, isIdc);
  const paged = pageResources(filtered, list.page, list.pageSize);

  return (
    <>
      {/* The counts ARE the filter, not a read-only line — so that finding why 9 rows
          were excluded out of 44 does not mean paging through all of them. */}
      <ResourceStatTiles
        counts={counts}
        filter={query.filter}
        onFilterChange={(next) => patchQuery({ filter: next })}
      />

      <ResourceToolbar
        searchValue={query.search}
        onSearchChange={(next) => patchQuery({ search: next })}
        searchPlaceholder={
          isIdc ? '호스트 · IP · Oracle SID 검색' : 'Resource Name 또는 Resource ID 검색'
        }
        groups={[
          {
            key: 'dbType',
            label: 'Database Type',
            value: query.databaseType,
            onChange: (next) => patchQuery({ databaseType: next }),
            options: databaseTypeOptions(resources),
            // The option VALUE stays the wire string (that is what the filter
            // compares); only its label is cased like the column shows it.
            formatOption: getDatabaseShortLabel,
          },
          {
            key: 'axis',
            label: isIdc ? '구분' : 'Region',
            value: query.axis,
            onChange: (next) => patchQuery({ axis: next }),
            options: axisOptions(resources, isIdc),
            formatOption: isIdc ? (value) => (value === 'HOST' ? 'Host' : 'IP') : undefined,
          },
        ]}
        actions={
          isIdc ? (
            <PlButton variant="secondary" size="sm" onClick={onOpenNlbListeners}>
              NLB 리스너 현황
            </PlButton>
          ) : undefined
        }
      />

      {/* The section carries no card, so the toolbar → content → pager stack draws its
          own edges: the toolbar owns the top, the pager the bottom, this the sides.
          The tables' CONNECTED_FRAME is deliberately borderless (it is shared with step
          1, which does sit in a card), so the side borders belong here. */}
      <div className="border-x border-[var(--pl-border)] bg-[var(--pl-bg-card)]">
        {resources.length === 0 ? (
          // No condition was set, so "조건에 맞는" would blame a filter for an empty request.
          <PlEmptyState icon="inbox" message="요청 리소스가 없습니다." />
        ) : filtered.length === 0 ? (
          <PlEmptyState icon="inbox" message="조건에 맞는 리소스가 없어요." />
        ) : isIdc ? (
          <IdcResourceTable
            rows={paged.rows}
            disabled={nlbLocked}
            onAssignNlb={onAssignNlb}
            onShowServices={onShowServices}
          />
        ) : (
          <CloudResourceTable rows={paged.rows} />
        )}
      </div>

      {/* The pager footer closes the card the toolbar opened — bordered on three sides,
          bottom-rounded (step 1's composition). */}
      {filtered.length > 0 && (
        <Pagination
          page={paged.page}
          pageSize={list.pageSize}
          totalCount={filtered.length}
          onPageChange={list.setPage}
          onPageSizeChange={list.setPageSize}
        />
      )}
    </>
  );
}
