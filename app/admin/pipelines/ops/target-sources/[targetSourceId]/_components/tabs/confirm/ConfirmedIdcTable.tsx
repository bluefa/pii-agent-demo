'use client';

/**
 * IDC 확정 리소스 표 — 옆 칸(연동 요청 확인)이 쓰는 그 표(`IdcResourceTable`)에 확정
 * 응답을 물린다.
 *
 * IDC 행에는 Resource Name 도 Resource ID 도 없다. 클라우드용 표에 태우면 정체를 말하는
 * 열 둘이 통째로 비고, 오퍼레이터가 확정 정보에서 실제로 확인하는 값 — 접속 주소·Port·
 * 출발지 IP·NLB 배정 — 은 실릴 자리가 아예 없다. 계약은 그 값들을 확정 응답에도 요청과
 * 같은 이름으로 싣는다(`ResourceConfigDto`), 그러니 표도 같은 것을 쓴다.
 *
 * 읽기 전용이다: NLB 배정 편집은 승인 전 요청의 일이고(`disabled`), 사용 서비스 조회는
 * 현재 인프라를 묻는 다른 질문이라 열지 않는다 — 같은 이유로 연동 요청 pane 도 잠근다.
 */
import { useMemo, type ReactElement } from 'react';
import { getDatabaseShortLabel } from '@/app/components/ui/DatabaseIcon';
import { Pagination } from '@/app/components/ui/Pagination';
import { PlEmptyState } from '@/app/admin/pipelines/_components/PlEmptyState';
import { ResourceToolbar } from '@/app/admin/pipelines/queue/requests/_components/ResourceFilterBar';
import { IdcResourceTable } from '@/app/admin/pipelines/queue/requests/_components/IdcResourceTable';
import {
  axisOptions,
  databaseTypeOptions,
  pageResources,
  queryResources,
  useResourceListState,
} from '@/app/admin/pipelines/queue/requests/_resourceQuery';
import { confirmedToIdcRows } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/confirm/confirmedIdcRows';
import type { ConfirmedIntegrationResourceInfo } from '@/lib/types';

/** 배정 버튼이 내려가지 않으므로(`disabled`) 호출될 일이 없다 — prop 이 필수라 둔다. */
const NOOP = (): void => {};

export function ConfirmedIdcTable({
  rows,
  className,
}: {
  rows: readonly ConfirmedIntegrationResourceInfo[];
  /** 놓이는 자리마다 바깥 여백이 다르다 — 표 자체는 같고 여백만 호출부가 정한다. */
  className?: string;
}): ReactElement {
  const idcRows = useMemo(() => confirmedToIdcRows(rows), [rows]);
  const list = useResourceListState();
  const filtered = queryResources(idcRows, list.query, true);
  const paged = pageResources(filtered, list.page, list.pageSize);

  return (
    <div className={className}>
      <ResourceToolbar
        searchValue={list.query.search}
        onSearchChange={(next) => list.patchQuery({ search: next })}
        searchPlaceholder="호스트 · IP · Oracle SID 검색"
        groups={[
          {
            key: 'dbType',
            label: 'Database Type',
            value: list.query.databaseType,
            onChange: (next) => list.patchQuery({ databaseType: next }),
            options: databaseTypeOptions(idcRows),
            formatOption: getDatabaseShortLabel,
          },
          {
            key: 'axis',
            label: '구분',
            value: list.query.axis,
            onChange: (next) => list.patchQuery({ axis: next }),
            options: axisOptions(idcRows, true),
            formatOption: (value) => (value === 'HOST' ? 'Host' : 'IP'),
          },
        ]}
      />

      {/* 표는 자기 테두리를 갖지 않는다(CONNECTED_FRAME) — 위는 툴바가, 아래는 페이저가
          닫고 옆면만 여기서 그린다. 연동 요청 pane 의 구성과 같다. */}
      <div className="border-x border-[var(--pl-border)] bg-[var(--pl-bg-card)]">
        {filtered.length === 0 ? (
          <PlEmptyState icon="inbox" message="조건에 맞는 리소스가 없어요." />
        ) : (
          <IdcResourceTable rows={paged.rows} disabled onAssignNlb={NOOP} showVerdict={false} />
        )}
      </div>

      {filtered.length > 0 && (
        <Pagination
          page={paged.page}
          pageSize={list.pageSize}
          totalCount={filtered.length}
          onPageChange={list.setPage}
          onPageSizeChange={list.setPageSize}
        />
      )}
    </div>
  );
}
