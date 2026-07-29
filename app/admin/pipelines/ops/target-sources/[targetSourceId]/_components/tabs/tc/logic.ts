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
}

export function tcResultStats(rows: readonly TcResultRow[]): TcResultStats {
  return rows.reduce<TcResultStats>(
    (acc, row) => ({
      resourceCount: acc.resourceCount + 1,
      includedTotal: acc.includedTotal + (row.includedCount ?? 0),
      excludedTotal: acc.excludedTotal + (row.excludedCount ?? 0),
    }),
    { resourceCount: 0, includedTotal: 0, excludedTotal: 0 },
  );
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
