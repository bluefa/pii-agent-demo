'use client';

/**
 * P3 연동 대상 리소스 section — stat tiles that ARE the filter, toolbar, the provider's
 * table, pager footer. Split out of the page (AP-B1); it owns no data, only the query
 * state the list needs.
 */
import type { ReactElement } from 'react';
import { cn } from '@/lib/theme';
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
import {
  groupSuspectRows,
  suspectMarksByRow,
  suspectRows,
  type SuspectGroup,
} from '@/app/admin/pipelines/queue/requests/_duplicateAddress';
import type { RequestResourceRow } from '@/app/lib/api/task-queue-requests';

export interface ResourceSectionProps {
  resources: readonly RequestResourceRow[];
  isIdc: boolean;
  list: ResourceListState;
  /** 같은 DB 를 두 번 등록했을지 모르는 그룹 — 상단 알림과 같은 목록을 표에도 흘린다. */
  suspectGroups?: readonly SuspectGroup[];
  /** Lock NLB editing: the request is no longer PENDING, so a save would 409. */
  nlbLocked: boolean;
  /** IDC only — open the NLB assignment modal over one resource. */
  onAssignNlb: (row: RequestResourceRow) => void;
  /**
   * IDC only — open that resource's 서비스별 NLB 배정 list, and the NLB 리스너 현황
   * table. Both read CURRENT infrastructure, so a surface that reports a past request
   * (승인 요청 상세) omits them; the column and the toolbar button go with them.
   */
  onShowServices?: (row: RequestResourceRow) => void;
  onOpenNlbListeners?: () => void;
  /**
   * NLB 점유표(getNlbTable)가 아직(또는 끝내) 없는 동안, 그걸 여는 버튼들(리스너 현황 ·
   * 행 배정)을 이 이유(title)로 잠근다. 페이지는 그 fetch 를 기다리지 않는다 — 버튼만
   * 기다린다.
   */
  nlbDisabledReason?: string;
  /** 사용 서비스 조회(getNlbIndexMappings)도 같은 문법. */
  servicesDisabledReason?: string;
}

export function ResourceSection({
  resources,
  isIdc,
  list,
  suspectGroups = [],
  nlbLocked,
  onAssignNlb,
  onShowServices,
  onOpenNlbListeners,
  nlbDisabledReason,
  servicesDisabledReason,
}: ResourceSectionProps): ReactElement {
  const { query, patchQuery } = list;
  // Counts stay whole-request (the tiles are the split); only the table pages.
  const counts = resourceCounts(resources);
  const marks = suspectMarksByRow(suspectGroups);
  const flagged = suspectRows(suspectGroups);
  // 기본 목록도 한 그룹의 행들을 붙여 세운다 — 요청 목록의 순서에는 의미가 없고(오너 확인),
  // 짝의 주소를 행 안에 적어도 두 값을 나란히 놓고 보는 일은 대신하지 못한다.
  const base = query.filter === 'suspect' ? flagged : groupSuspectRows(resources, suspectGroups);
  const filtered = queryResources(base, query, isIdc, new Set(flagged));
  const paged = pageResources(filtered, list.page, list.pageSize);

  return (
    <>
      {/* The counts ARE the filter, not a read-only line — so that finding why 9 rows
          were excluded out of 44 does not mean paging through all of them. */}
      <ResourceStatTiles
        counts={counts}
        filter={query.filter}
        onFilterChange={(next) => patchQuery({ filter: next })}
        suspectCount={flagged.length}
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
          isIdc && onOpenNlbListeners ? (
            <PlButton
              variant="secondary"
              size="sm"
              onClick={onOpenNlbListeners}
              disabled={nlbDisabledReason != null}
              title={nlbDisabledReason}
            >
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
            suspectMarks={marks}
            assignDisabledReason={nlbDisabledReason}
            servicesDisabledReason={servicesDisabledReason}
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

const SKELETON_BAR = 'animate-pulse rounded-[6px] bg-[var(--pl-gray-100)]';
// gray-100 위(타일 안은 white 지만 툴바 밴드는 gray-100)에서는 같은 gray-100 바가
// 안 보인다 — opsStyles 의 함정 그대로. 밴드 위 바만 한 단 어두운 gray-200.
const SKELETON_BAR_ON_BAND = 'animate-pulse rounded-[6px] bg-[var(--pl-gray-200)]';

/**
 * The section while approval-requests/latest is in flight. Containers and paddings are
 * copied from the real pieces above (tile: px-5 py-[18px] rounded-xl; toolbar:
 * px-4 py-[14px] gray-100 band; cells: approvalCell 18px/16px) so nothing shifts when
 * the rows land. Not drawn: the 확인 필요 tile (whether one exists is what's loading),
 * the pager (below everything — nothing sits under it to shift), and real columns
 * (their set depends on the provider and the rows).
 */
export function ResourceSectionSkeleton(): ReactElement {
  return (
    <div aria-busy="true">
      <div className="grid gap-3 mb-[18px] grid-cols-3">
        {['전체 요청', '연동 요청 대상', '연동 요청 제외대상'].map((label) => (
          <div
            key={label}
            className="flex flex-col items-center gap-1.5 rounded-xl border border-[var(--pl-border)] bg-[var(--pl-bg-card)] px-5 py-[18px] shadow-[var(--pl-shadow-xs)]"
          >
            {/* 라벨은 정적 사실이라 실물로 찍는다 — 기다리는 건 숫자뿐이다. */}
            <span className="text-[14px] font-semibold text-[var(--pl-text-weak)]">{label}</span>
            {/* 숫자 줄: 40px bold leading-[1.2] = 48px 라인 박스. */}
            <span className="flex h-12 items-center">
              <span className={cn(SKELETON_BAR, 'h-6 w-12')} />
            </span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-[10px] rounded-t-[12px] border border-b-0 border-[var(--pl-border)] bg-[var(--pl-gray-100)] px-4 py-[14px]">
        {/* SearchBox 자리 — h32, min-w 220. */}
        <span className={cn(SKELETON_BAR_ON_BAND, 'h-8 w-[260px] rounded-lg')} />
        <span className={cn(SKELETON_BAR_ON_BAND, 'ml-auto h-8 w-8 rounded-lg')} />
      </div>
      <div className="rounded-b-[12px] border border-t-0 border-[var(--pl-border)] bg-[var(--pl-bg-card)]">
        {/* 헤더 밴드: approvalHeaderChrome(gray-100) + approvalHeaderCell(py-3, 12px). */}
        <div className="flex items-center gap-10 bg-[var(--pl-gray-100)] px-[18px] py-3">
          {[112, 88, 64, 96].map((w, i) => (
            <span key={i} className={cn(SKELETON_BAR_ON_BAND, 'h-[18px]')} style={{ width: w }} />
          ))}
        </div>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center gap-10 border-t border-[var(--pl-gray-100)] px-[18px] py-4">
            {/* 본문 셀 줄: 14px 텍스트의 21px 라인 박스 안에 바. */}
            {[160, 96, 48, 72].map((w, j) => (
              <span key={j} className="flex h-[21px] items-center">
                <span className={cn(SKELETON_BAR, 'h-3.5')} style={{ width: w }} />
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
