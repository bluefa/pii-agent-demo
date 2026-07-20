/**
 * P4/P5 연결 테스트 — pure presentation logic (no React, no I/O).
 *
 * Kept out of the page/adapter so the results→row derivations and the ldb-cache
 * reducer are unit-testable in isolation.
 */
import type { TcResultRow } from '@/app/lib/api/task-queue-tc';
import type {
  TestedLogicalDatabase,
  ExcludedLogicalDatabase,
} from '@/app/lib/api/task-queue-tc';

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
      includedTotal: acc.includedTotal + row.includedCount,
      excludedTotal: acc.excludedTotal + row.excludedCount,
    }),
    { resourceCount: 0, includedTotal: 0, excludedTotal: 0 },
  );
}

export type LdbTab = 'inc' | 'exc';

/**
 * 논리 DB count cell value: the count for a SUCCESS row, or `null` for a FAILED
 * row (the design renders "—" with no drill-down link when the test failed).
 */
export function ldbCount(row: TcResultRow, tab: LdbTab): number | null {
  if (row.connectionStatus === 'FAILED') return null;
  return tab === 'inc' ? row.includedCount : row.excludedCount;
}

// ---------------------------------------------------------------------------
// 논리 DB modal cache — lazy per-resource fetch, reused while the modal cycles
// its 연동 대상 / 연동 제외 tabs (api-spec P5: "탭 전환은 캐시 재사용").
// ---------------------------------------------------------------------------

export interface LdbCacheEntry {
  included: TestedLogicalDatabase[];
  excluded: ExcludedLogicalDatabase[];
}

export type LdbCache = Record<string, LdbCacheEntry>;

/** Immutably store one resource's loaded lists. */
export function putLdbCache(
  cache: LdbCache,
  resourceId: string,
  entry: LdbCacheEntry,
): LdbCache {
  return { ...cache, [resourceId]: entry };
}
