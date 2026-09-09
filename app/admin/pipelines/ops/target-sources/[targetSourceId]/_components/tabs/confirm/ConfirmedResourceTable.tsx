'use client';

/**
 * 확정 리소스를 보여 주는 표 — Step 6·7 리소스 테이블 그대로.
 *
 * 표는 Step 6·7 과 같은 `WaitingApprovalTable` 이다 — 툴바 + 표 + 페이지네이션이 한 장의
 * 카드로 붙고, RDS 클러스터·EC2 태그와 Resource ID 복사·이름 툴팁·행 리프트가 그대로 온다.
 * 확정 리소스를 보는 자리는 서비스 화면이든 운영 화면이든, 조회든 삭제 확인이든 **같은
 * 표여야 한다** — 자리마다 표를 새로 짜면 같은 사실이 자리마다 다른 문법으로 읽힌다.
 *
 * Step 6·7 과 다른 점은 둘이다.
 *
 * 1. 연동 논리 DB · 연동 제외 열이 없다 — **이 화면들이 관리하는 값이 아니다**(Step 5 주제).
 *    `plain` variant 가 그 열 쌍을 통째로 뺀다. 열을 떼면 그것을 채우던 test-connection
 *    요약 조회도 같이 필요 없어진다.
 * 2. Athena 가 **그룹 트리**다 — 리전 부모 하나 밑에 데이터베이스 자식들(`grouped`). Step 6·7
 *    은 리전 하나를 **한 행으로 접어서** 넘기지만(`foldedMembers`), 여기 오는 것은 확정 응답
 *    행 그대로라 Step 2·3 과 같은 DB 단위다 — 같은 행에는 같은 문법을 쓴다. 페이지도 그래서
 *    그룹 단위다(`useApprovalTableState` 의 `groupRows`): 평평하게 자르면 한 그룹이 페이지
 *    경계에서 갈린다.
 *
 * ⛔ 머리의 「리소스 N건」은 그룹 수가 아니라 **응답의 행 수**를 계속 읽는다(`panes.tsx` 의
 *    `resource_infos.length`) — 트리는 읽는 방식이고, 건수는 응답이 말한 사실이다.
 */
import { useMemo, type ReactElement } from 'react';
import { Pagination } from '@/app/components/ui/Pagination';
import { useColumnResize } from '@/app/components/ui/useColumnResize';
import {
  PLAIN_FLEX_KEYS,
  WaitingApprovalTable,
  type WaitingApprovalResource,
} from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalTable';
import { WaitingApprovalToolbar } from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalToolbar';
import { useApprovalTableState } from '@/app/target-sources/[targetSourceId]/_components/layout/useApprovalTableState';
import type { ConfirmedResource } from '@/lib/types/resources';
import type { ReconcileVerdict } from '@/lib/types/reconcile';

const FILTER_EMPTY_MESSAGE = '조건에 맞는 결과가 없어요.';

/**
 * A confirmed resource, optionally carrying the 대조 판정. The reconciled list also contains
 * rows the confirmed record does NOT have (approved but unconfirmed) — the caller shapes those
 * into this same type, because the table's question is "what does this row say", not "where
 * did it come from".
 *
 * `connectionStatus` turns optional for exactly that row. The domain type admits only
 * CONNECTED or DISCONNECTED, and a resource that was never confirmed has neither — filling in
 * either one would put a fabricated fact in the data, whatever this variant happens to render.
 */
export type ConfirmedResourceRow = Omit<ConfirmedResource, 'connectionStatus'> & {
  connectionStatus?: ConfirmedResource['connectionStatus'];
  reconcile?: ReconcileVerdict;
};

export function ConfirmedResourceTable({
  resources,
  className,
}: {
  resources: readonly ConfirmedResourceRow[];
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
        ...(resource.reconcile ? { reconcile: resource.reconcile } : {}),
      })),
    [resources],
  );
  // 그룹 하나가 곧 페이지 단위다 — Athena 리전 하나가 데이터베이스 전부를 데리고 한 칸을
  // 차지한다(`toPaginationUnits`). 그룹핑 키는 위에서 넣은 `resourceType`, 즉 엔진 이름
  // `athena` 다: `isGroupedResourceType` 가 `normalizeResourceType` 로 대문자화한 뒤 보므로
  // `ATHENA` 로 맞아떨어진다(최상위 종류를 나르는 `declaredResourceType` 의 `AWS_ATHENA_DATABASE`
  // 도 같은 집합에 있어 어느 쪽으로 재도 답은 같다). 두 필드 다 계약이 주는 값이고, 여기서
  // 새로 지어낸 것은 없다.
  const table = useApprovalTableState(approvalRows);
  // 콘솔 표의 리사이즈 인스턴스 — storage key 는 화면 이름(LIN-97). Step 6·7 의
  // confirmed-resources 와 열 하한은 같지만 화면이 다르므로 키를 나눠 갖는다.
  const resize = useColumnResize({
    clampToContent: true,
    storageKey: 'pii:colw:v1:ops-confirmed-resources',
    ephemeralKeys: PLAIN_FLEX_KEYS,
  });
  const showFilterEmpty = approvalRows.length > 0 && table.filteredCount === 0;
  // Asked of the FULL roster, which this component holds — the table below is handed one
  // page, so a page of all-confirmed rows must not take the column away (see `hasKindColumn`).
  const reconcileColumn = resources.some((resource) => resource.reconcile != null);

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
        // 이름으로 켠다 — `plain` 자체는 트리를 그리지 않는다(WaitingApprovalTable 의 `grouped`).
        grouped
        connected
        // 검색·필터가 목록을 좁히는 동안에는 열림 상태를 그쪽이 갖는다: 닫힌 그룹 안의
        // 데이터베이스에만 걸린 검색어는, 접힌 채로 두면 화면 어디에도 나타나지 않는다.
        expandFolds={!!table.searchValue.trim() || !!table.dbType || !!table.region}
        emptyMessage={showFilterEmpty ? FILTER_EMPTY_MESSAGE : undefined}
        reconcileColumn={reconcileColumn}
        columns={resize}
      />
      {table.filteredCount > 0 && (
        <Pagination
          size="md"
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
