'use client';

/**
 * 확정 리소스를 보여 주는 표 — Step 6·7 리소스 테이블 그대로.
 *
 * 표는 Step 6·7 과 같은 `WaitingApprovalTable` 이다 — 툴바 + 표 + 페이지네이션이 한 장의
 * 카드로 붙고, RDS 클러스터·EC2 태그와 Resource ID 복사·이름 툴팁·행 리프트가 그대로 온다.
 * 확정 리소스를 보는 자리는 서비스 화면이든 운영 화면이든, 조회든 삭제 확인이든 **같은
 * 표여야 한다** — 자리마다 표를 새로 짜면 같은 사실이 자리마다 다른 문법으로 읽힌다.
 *
 * Step 6·7 과 다른 점은 둘뿐이다.
 *
 * 1. 연동 논리 DB · 연동 제외 열이 없다 — **이 화면들이 관리하는 값이 아니다**(Step 5 주제).
 *    `plain` variant 가 그 열 쌍을 통째로 뺀다. 열을 떼면 그것을 채우던 test-connection
 *    요약 조회도 같이 필요 없어진다.
 * 2. Athena 를 리전으로 접지 않는다 — 접기는 Step 4 부터 리전이 곧 리소스이기 때문인데,
 *    여기가 보여 주는 것은 확정 응답 그 자체다. 접으면 행 수가 "리소스 N건" 과 어긋나고,
 *    같은 응답을 읽는 비교·Raw 렌즈와도 갈라진다.
 */
import { useMemo, type ReactElement } from 'react';
import { Pagination } from '@/app/components/ui/Pagination';
import {
  WaitingApprovalTable,
  type WaitingApprovalResource,
} from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalTable';
import { WaitingApprovalToolbar } from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalToolbar';
import { useApprovalTableState } from '@/app/target-sources/[targetSourceId]/_components/layout/useApprovalTableState';
import type { ConfirmedResource } from '@/lib/types/resources';

const FILTER_EMPTY_MESSAGE = '조건에 맞는 결과가 없어요.';

export function ConfirmedResourceTable({
  resources,
  className,
}: {
  resources: readonly ConfirmedResource[];
  /** 놓이는 자리마다 바깥 여백이 다르다 — 표 자체는 같고 여백만 호출부가 정한다. */
  className?: string;
}): ReactElement {
  const approvalRows = useMemo<readonly WaitingApprovalResource[]>(
    () =>
      resources.map((resource) => ({
        resourceId: resource.resourceId,
        // 엔진 이름이 들어간다 — Database Type 셀이 읽는 값이자 툴바 옵션의 출처다
        // (`ConfirmedIntegrationTable` 과 같은 규칙). 실제 리소스 종류는 아래 필드가 나른다.
        resourceType: resource.databaseType ?? '',
        declaredResourceType: resource.type,
        region: resource.region ?? '',
        resourceName: resource.resourceName ?? '',
        // 확정된 리소스는 전부 대상이다 — 판정 열이 없는 variant 라 화면에 나타나지는 않지만,
        // 행 틴트가 이 값을 읽는다.
        selected: true,
        displayDbType: resource.databaseType ?? undefined,
      })),
    [resources],
  );
  // 접기가 없으므로 행 하나가 곧 페이지 단위다 — Step 6·7 과 같은 이유로 그룹핑을 끈다.
  const table = useApprovalTableState(approvalRows, undefined, false);
  const showFilterEmpty = approvalRows.length > 0 && table.filteredCount === 0;

  return (
    <div className={className}>
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
        variant="plain"
        connected
        emptyMessage={showFilterEmpty ? FILTER_EMPTY_MESSAGE : undefined}
      />
      {table.filteredCount > 0 && (
        <Pagination
          page={table.safePage}
          pageSize={table.pageSize}
          totalCount={table.filteredCount}
          onPageChange={table.onPageChange}
          onPageSizeChange={table.onPageSizeChange}
        />
      )}
    </div>
  );
}
