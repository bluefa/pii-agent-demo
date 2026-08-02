/**
 * 연결 테스트 — pure presentation logic (no React, no I/O).
 *
 * Kept out of the card/adapter so the results→row derivations are unit-testable
 * in isolation.
 */
import type { TcResultRow } from '@/app/lib/api/task-queue-tc';

/** Header/section summary counts derived from the fetched result rows. */
export interface TcResultStats {
  /** 리소스 건수 = row count. */
  resourceCount: number;
  /** 연동 대상 논리 DB 합계. */
  includedTotal: number;
  /** 연동 제외 논리 DB 합계. */
  excludedTotal: number;
  /** connection_status 가 명시적으로 SUCCESS 인 리소스. */
  successCount: number;
  /** 명시적으로 FAILED 인 리소스. */
  failedCount: number;
  /** wire 가 상태를 주지 않은 리소스 — 성공으로도 실패로도 세지 않는다. */
  unknownCount: number;
}

export function tcResultStats(rows: readonly TcResultRow[]): TcResultStats {
  return rows.reduce<TcResultStats>(
    (acc, row) => ({
      resourceCount: acc.resourceCount + 1,
      includedTotal: acc.includedTotal + (row.includedCount ?? 0),
      excludedTotal: acc.excludedTotal + (row.excludedCount ?? 0),
      successCount: acc.successCount + (row.connectionStatus === 'SUCCESS' ? 1 : 0),
      failedCount: acc.failedCount + (row.connectionStatus === 'FAILED' ? 1 : 0),
      unknownCount: acc.unknownCount + (row.connectionStatus === 'UNKNOWN' ? 1 : 0),
    }),
    {
      resourceCount: 0,
      includedTotal: 0,
      excludedTotal: 0,
      successCount: 0,
      failedCount: 0,
      unknownCount: 0,
    },
  );
}

/**
 * 실행 소요 시간(초). 두 시각이 모두 있고 순서가 맞을 때만 값을 낸다 — 진행 중인 실행이나
 * 시각이 빠진 행은 `null` 이고, 카드에서 "—" 로 표기된다.
 */
export function runDurationSeconds(
  requestedAt: string | null,
  completedAt: string | null,
): number | null {
  if (!requestedAt || !completedAt) return null;
  const start = Date.parse(requestedAt);
  const end = Date.parse(completedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return (end - start) / 1000;
}

export type LdbTab = 'inc' | 'exc';

/**
 * 논리 DB count cell value: the count only when the row is an explicit SUCCESS
 * AND the wire carried the count. Any other case (FAILED, UNKNOWN, or a SUCCESS
 * whose count the wire omitted) → `null`, which the table renders as "—" with no
 * drill-down link (never a false "0" or fabricated success).
 */
export function ldbCount(row: TcResultRow, tab: LdbTab): number | null {
  if (row.connectionStatus !== 'SUCCESS') return null;
  return tab === 'inc' ? row.includedCount : row.excludedCount;
}
