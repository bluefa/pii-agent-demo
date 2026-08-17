/**
 * P3 resource-list query — verdict tabs, search, one provider axis and paging (LIN-82). `…/approval-requests/latest` returns every resource
 * inline, so a request with 40+ of them rendered one unbounded table and pushed
 * the 승인/반려 controls three screens above the row being judged.
 *
 * The provider decides the second axis and what the search matches: an IDC row's
 * visible identity is its host/IP + Oracle SID (resource_id is NEVER rendered —
 * design-spec §8), a cloud row's is its name + Resource ID.
 */
import { useCallback, useState } from 'react';
import type { RequestResourceRow } from '@/app/lib/api/task-queue-requests';

/** Default rows per page; the pager footer lets the admin raise it. */
export const RESOURCE_PAGE_SIZE = 10;

/** 'suspect' = 같은 DB 를 두 번 등록했을지 모르는 행만 (@see _duplicateAddress). */
export type ResourceFilter = 'all' | 'target' | 'excluded' | 'suspect';

export interface ResourceQuery {
  filter: ResourceFilter;
  search: string;
  /** '' = 전체. Matched against `databaseType` verbatim (wire casing). */
  databaseType: string;
  /** '' = 전체. Region for cloud, 구분 (IP/HOST) for IDC. */
  axis: string;
}

export const EMPTY_RESOURCE_QUERY: ResourceQuery = {
  filter: 'all',
  search: '',
  databaseType: '',
  axis: '',
};

export interface ResourceCounts {
  all: number;
  target: number;
  excluded: number;
}

/** Tab counts — always the whole request, never the filtered view. */
export function resourceCounts(rows: readonly RequestResourceRow[]): ResourceCounts {
  const target = rows.filter((row) => row.selected).length;
  return { all: rows.length, target, excluded: rows.length - target };
}

const uniqueSorted = (values: ReadonlyArray<string | null>): string[] =>
  [...new Set(values.filter((v): v is string => v != null && v !== ''))].sort();

export function databaseTypeOptions(rows: readonly RequestResourceRow[]): string[] {
  return uniqueSorted(rows.map((row) => row.databaseType));
}

/** Region (cloud) or 구분 (IDC) — only the values this request actually has. */
export function axisOptions(rows: readonly RequestResourceRow[], isIdc: boolean): string[] {
  return uniqueSorted(rows.map((row) => (isIdc ? row.idcKind : row.region)));
}

/** The searchable text of a row — exactly what that provider's table renders. */
function haystack(row: RequestResourceRow, isIdc: boolean): string {
  const parts = isIdc
    ? [...row.connectTargets, row.oracleSid, ...row.sourceIps]
    : [row.resourceName, row.resourceId];
  return parts.filter((v): v is string => v != null && v !== '').join(' ').toLowerCase();
}

export function queryResources(
  rows: readonly RequestResourceRow[],
  query: ResourceQuery,
  isIdc: boolean,
  /** 'suspect' 필터가 통과시킬 행들. 이 필터가 아닐 때는 쓰이지 않는다. */
  suspects?: ReadonlySet<RequestResourceRow>,
): RequestResourceRow[] {
  const search = query.search.trim().toLowerCase();
  return rows.filter((row) => {
    if (query.filter === 'target' && !row.selected) return false;
    if (query.filter === 'excluded' && row.selected) return false;
    // 집합을 안 받았으면 아무것도 통과시키지 않는다 — 의심 행을 모르는 채로 이 필터를
    // 켰다는 뜻이고, 그때 전부 보여 주면 '확인 필요 0건'이 전체 목록으로 읽힌다.
    if (query.filter === 'suspect' && !(suspects?.has(row) ?? false)) return false;
    if (query.databaseType !== '' && row.databaseType !== query.databaseType) return false;
    if (query.axis !== '' && (isIdc ? row.idcKind : row.region) !== query.axis) return false;
    if (search !== '' && !haystack(row, isIdc).includes(search)) return false;
    return true;
  });
}

export interface ResourcePage<T> {
  /** Clamped page — a shorter result must not leave the pager past its end. */
  page: number;
  totalPages: number;
  rows: T[];
}

export function pageResources<T>(
  rows: readonly T[],
  page: number,
  pageSize: number = RESOURCE_PAGE_SIZE,
): ResourcePage<T> {
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(Math.max(page, 0), totalPages - 1);
  const start = safePage * pageSize;
  return { page: safePage, totalPages, rows: rows.slice(start, start + pageSize) };
}

export interface ResourceListState {
  query: ResourceQuery;
  /** Any query change resets the page — narrowing while on page 3 would otherwise
   *  land on an empty table with no hint that the rows are simply elsewhere. */
  patchQuery: (patch: Partial<ResourceQuery>) => void;
  reset: () => void;
  page: number;
  setPage: (next: number) => void;
  pageSize: number;
  setPageSize: (next: number) => void;
}

/** Filter + page state for one request's resource list. Extracted so the detail page
 *  owns loading, NLB mutation and rendering, and not this too. */
export function useResourceListState(): ResourceListState {
  const [query, setQuery] = useState<ResourceQuery>(EMPTY_RESOURCE_QUERY);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSizeRaw] = useState(RESOURCE_PAGE_SIZE);

  // Stable identities — `reset` is called from a fetch effect, so a per-render
  // closure would either re-run that effect or have to be omitted from its deps.
  const patchQuery = useCallback((patch: Partial<ResourceQuery>) => {
    setQuery((prev) => ({ ...prev, ...patch }));
    setPage(0);
  }, []);
  const reset = useCallback(() => {
    setQuery(EMPTY_RESOURCE_QUERY);
    setPage(0);
  }, []);
  const setPageSize = useCallback((next: number) => {
    setPageSizeRaw(next);
    setPage(0);
  }, []);

  return { query, patchQuery, reset, page, setPage, pageSize, setPageSize };
}
