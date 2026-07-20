/**
 * CSR client for the Admin Task Queue — P4 연결 테스트 목록 + P5 상세.
 *
 * Sibling to the P1 adapter (`task-queue.ts`) and the P2/P3 adapter
 * (`task-queue-requests.ts`); each page owns its own file so page work never
 * collides. Add ONLY P4/P5 helpers here.
 *
 * Casing boundary (ADR-019, `design/pipeline/admin-taskqueue-api-spec.md`):
 *  - The list / single-status routes own the wire→camel boundary and already
 *    return the camel domain (`lib/types/task-queue.ts`); this layer forwards
 *    them verbatim.
 *  - The per-resource results endpoint returns the raw snake wire; THIS adapter
 *    owns that reshape (see `toTcResultRow`).
 *  - 논리 DB by-resource-id reuses the Step 5 adapter (`logical-db.ts`), which
 *    already camelizes — re-exported below so the P5 page has one import surface.
 *
 * CSR MUST NOT import `@/lib/bff/*` (route boundary).
 */
import { fetchInfraJson } from '@/app/lib/api/infra';
import type { Paged, TestConnectionStatusRow } from '@/lib/types/task-queue';

export type {
  TestedLogicalDatabase,
  ExcludedLogicalDatabase,
  LogicalDbType,
  SkipReason,
} from '@/app/lib/api/logical-db';
export {
  getTestedLogicalDatabases,
  getExcludedLogicalDatabases,
} from '@/app/lib/api/logical-db';

export type { Paged, TestConnectionStatusRow } from '@/lib/types/task-queue';

// ---------------------------------------------------------------------------
// P4 목록 — the two-tab Test Connection queue (완료 / 재실행 요청).
// ---------------------------------------------------------------------------

/** Contract-permitted queue filter values (the two P4 tabs). */
export type TestConnectionQueueStatus =
  | 'TEST_CONNECTION_COMPLETED'
  | 'TEST_CONNECTION_REJECTED';

export interface TestConnectionQueueParams {
  status: TestConnectionQueueStatus;
  /** 0-indexed page (contract). */
  page?: number;
  /** Page size (contract default 10). */
  size?: number;
}

/** GET /admin/queue/test-connections — one tab's page of rows (camel domain). */
export const getTestConnectionQueue = (
  params: TestConnectionQueueParams,
  options?: { signal?: AbortSignal },
): Promise<Paged<TestConnectionStatusRow>> => {
  const search = new URLSearchParams({ status: params.status });
  if (params.page != null) search.set('page', String(params.page));
  if (params.size != null) search.set('size', String(params.size));
  return fetchInfraJson<Paged<TestConnectionStatusRow>>(
    `/admin/queue/test-connections?${search.toString()}`,
    options?.signal ? { signal: options.signal } : undefined,
  );
};

// ---------------------------------------------------------------------------
// P5 상세 — header status + per-resource results.
// ---------------------------------------------------------------------------

/** GET …/{id}/test-connection/status (single) — detail header (camel domain). */
export const getTestConnectionDetail = (
  targetSourceId: number,
  options?: { signal?: AbortSignal },
): Promise<TestConnectionStatusRow> =>
  fetchInfraJson<TestConnectionStatusRow>(
    `/target-sources/${targetSourceId}/test-connection/status`,
    options?.signal ? { signal: options.signal } : undefined,
  );

/**
 * SUCCESS / FAILED are the two explicit contract states; UNKNOWN is the honest
 * fallback when the wire omits `connection_status` (a thin summary / real
 * upstream that does not enrich the row) — the UI must NOT claim Success then.
 */
export type TcConnectionStatus = 'SUCCESS' | 'FAILED' | 'UNKNOWN';

/** One row of the P5 연결 테스트 결과 table (camel domain). */
export interface TcResultRow {
  resourceId: string;
  /** DB type tag (blue). `null` when the wire omits it — renders "—". */
  databaseType: string | null;
  /** 연동 대상 label (mono host/uri). `null` → "—". */
  connectionTarget: string | null;
  /** 연동 대상 논리 DB count. `null` when the wire omits it — renders "—". */
  includedCount: number | null;
  /** 연동 제외 논리 DB count. `null` when the wire omits it. */
  excludedCount: number | null;
  connectionStatus: TcConnectionStatus;
}

/**
 * The `latest-results` wire row. `resource_id` + the two counts are the formal
 * `TestConnectionLatestResultSummaryResponse` contract fields. `database_type` /
 * `connection_target` / `connection_status` are NOT declared by that schema; the
 * ADR-019 codegen is `.passthrough()`, so an enriched BFF row surfaces them here.
 * Absent (thin mock / real upstream summary) → the column falls back to "—" and
 * the status to UNKNOWN (never a fabricated Success). See the P5 mock-gap note.
 */
interface TcResultWire {
  resource_id?: string | null;
  logical_database_count?: number | null;
  excluded_logical_database_count?: number | null;
  database_type?: string | null;
  connection_target?: string | null;
  connection_status?: string | null;
}

/** Only an explicit wire value maps to a claim; anything absent/unknown → UNKNOWN. */
function toConnectionStatus(raw: string | null | undefined): TcConnectionStatus {
  const status = (raw ?? '').toUpperCase();
  if (status === 'SUCCESS') return 'SUCCESS';
  if (status === 'FAIL' || status === 'FAILED') return 'FAILED';
  return 'UNKNOWN';
}

/** snake results wire → camel row. Absent status → UNKNOWN, absent counts → null. */
export function toTcResultRow(wire: TcResultWire): TcResultRow {
  return {
    resourceId: wire.resource_id ?? '',
    databaseType: wire.database_type ?? null,
    connectionTarget: wire.connection_target ?? null,
    includedCount: wire.logical_database_count ?? null,
    excludedCount: wire.excluded_logical_database_count ?? null,
    connectionStatus: toConnectionStatus(wire.connection_status),
  };
}

/** GET …/{id}/test-connection/latest-results — per-resource result rows. */
export const getTestConnectionResults = async (
  targetSourceId: number,
  options?: { signal?: AbortSignal },
): Promise<TcResultRow[]> => {
  const raw = await fetchInfraJson<TcResultWire[]>(
    `/target-sources/${targetSourceId}/test-connection/latest-results`,
    options?.signal ? { signal: options.signal } : undefined,
  );
  return (raw ?? []).map(toTcResultRow);
};

// ---------------------------------------------------------------------------
// P5 액션 — 재실행 요청 (reject) / 연동 승인 (confirm).
// ---------------------------------------------------------------------------

/** POST …/{id}/test-connection/reject — request a re-run. reason maxLength 512. */
export const rejectTestConnection = (
  targetSourceId: number,
  reason: string,
): Promise<unknown> =>
  fetchInfraJson<unknown>(`/target-sources/${targetSourceId}/test-connection/reject`, {
    method: 'POST',
    body: { reason },
  });

/** POST …/{id}/pii-agent-installation/confirm — approve the integration. */
export const confirmInstallation = (targetSourceId: number): Promise<unknown> =>
  fetchInfraJson<unknown>(
    `/target-sources/${targetSourceId}/pii-agent-installation/confirm`,
    { method: 'POST', body: { confirm: true } },
  );
