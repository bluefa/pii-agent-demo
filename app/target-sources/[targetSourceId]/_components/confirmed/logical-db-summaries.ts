import type { TestConnectionLatestResultSummary } from '@/app/lib/api';
import type { TestUnit } from '@/lib/resource-grouping';

/**
 * Real per-resource logical-DB counts (연동 대상 / 연동 제외), keyed by resource_id.
 *
 * Source: `getLatestTestConnectionResultSummaries` (test-connection latest-results,
 * snake wire). The response is one row per resource+agent, so counts are summed
 * across a resource's agent rows. A resource with no summary row is absent from
 * the map — callers render `—` for it rather than a fabricated value.
 */
export interface LogicalDbCounts {
  /** `null` when no agent row for the resource carried the field — the cell renders —, not 0. */
  target: number | null;
  excluded: number | null;
}

export type LogicalDbCountMap = ReadonlyMap<string, LogicalDbCounts>;

/**
 * The response schema is `.partial()`, so a row can arrive with the count absent. Absent is not
 * zero: folding it in as 0 reports "no logical DBs" for a resource the API never answered for.
 * Each field stays null until at least one row carries a number.
 */
const addCount = (prev: number | null, next: number | null | undefined): number | null =>
  next == null ? prev : (prev ?? 0) + next;

export const buildLogicalDbCountMap = (
  summaries: readonly TestConnectionLatestResultSummary[],
): LogicalDbCountMap => {
  const map = new Map<string, LogicalDbCounts>();
  for (const summary of summaries) {
    const resourceId = summary.resource_id;
    if (!resourceId) continue;
    const prev = map.get(resourceId) ?? { target: null, excluded: null };
    map.set(resourceId, {
      target: addCount(prev.target, summary.logical_database_count),
      excluded: addCount(prev.excluded, summary.excluded_logical_database_count),
    });
  }
  return map;
};

/**
 * 한 행(= 한 테스트 단위)이 커버하는 논리 DB 수.
 *
 * **단위의 id 로 찾는다**(`TestUnit.unitId` = `resultUnitId`). Athena 는 4단계부터 리전이
 * 리소스라 결과가 `athena_region_resource_id` 한 줄로 달려 오고, 데이터베이스 각자의 id 로는
 * 어떤 결과도 키가 잡히지 않는다. 멤버별로 찾던 동안 접힌 Athena 행은 실행이 그 리전의 수를
 * 보고했는데도 늘 `—` 였다. 다른 타입은 `unitId === resourceId` 라 달라지는 게 없다.
 *
 * 없는 값은 0 이 아니다 — 이번 실행이 이 단위를 말하지 않았으면 null 로 남겨 `—` 를 찍는다.
 *
 * 클라우드 5단계 카드(`ConnectionTestCard`)와 완료 승인 모달(`CloudReqApprovalModal`)이
 * 같은 행 집합(`toTestUnits`)을 그리므로 **같은** 함수를 쓴다 — 손으로 베낀 두 번째 사본은
 * 이 주석의 이유까지 같이 베끼지 못한다.
 */
export const unitCounts = (unit: TestUnit, counts: LogicalDbCountMap): LogicalDbCounts =>
  counts.get(unit.unitId) ?? { target: null, excluded: null };
