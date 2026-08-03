'use client';

/**
 * P3 연동 대상 리소스 section — stat tiles that ARE the filter, toolbar, the provider's
 * table, pager footer. Split out of the page (AP-B1); it owns no data, only the query
 * state the list needs.
 */
import type { ReactElement } from 'react';
import { pipelineStyles } from '@/lib/theme';
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
import type { NlbAssignment } from '@/app/admin/pipelines/queue/requests/_useNlbAssignment';
import type { NlbTableRow, RequestResourceRow } from '@/app/lib/api/task-queue-requests';

const { text } = pipelineStyles;

export interface ResourceSectionProps {
  resources: readonly RequestResourceRow[];
  isIdc: boolean;
  list: ResourceListState;
  /** IDC only — the NLB table feeding each row's option list, and the edit state. */
  nlbTable: NlbTableRow[];
  nlb: NlbAssignment;
  /** Lock NLB editing: the request is no longer PENDING, so a save would 409. */
  nlbLocked: boolean;
  onShowNlbInfo: (row: RequestResourceRow) => void;
  onOpenNlbListeners: () => void;
}

export function ResourceSection({
  resources,
  isIdc,
  list,
  nlbTable,
  nlb,
  nlbLocked,
  onShowNlbInfo,
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

      {filtered.length === 0 ? (
        <PlEmptyState icon="inbox" message="조건에 맞는 리소스가 없어요." />
      ) : isIdc ? (
        <>
          <IdcResourceTable
            rows={paged.rows}
            nlbTable={nlbTable}
            draft={nlb.draft}
            savingResourceId={nlb.savingResourceId}
            disabled={nlbLocked}
            onSelect={nlb.select}
            onSave={nlb.save}
            onShowNlbInfo={onShowNlbInfo}
          />
          <p className={`${text.meta} mt-4`}>
            점유 리스너가 30개를 넘으면 주의, 50개에 이르면 새로 배정할 수 없어요
          </p>
        </>
      ) : (
        <CloudResourceTable rows={paged.rows} />
      )}

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
