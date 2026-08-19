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
 * One row of the 논리 DB 건수 join (camel domain) — exactly what
 * `TestConnectionLatestResultSummaryResponse` declares.
 *
 * This endpoint answers "리소스별 논리 DB 몇 개" for the latest SUCCESS run and
 * nothing else. 연결 성패는 `latest_version`(TestConnectionAgentResult)에서 읽는다 —
 * 예전엔 이 응답의 `connection_status` 를 passthrough 로 주워 썼는데, 계약이 선언하지
 * 않는 필드라 실 BFF 에서는 사라질 수 있다.
 */
export interface TcResultRow {
  resourceId: string;
  /** 연동 대상 논리 DB count. `null` when the wire omits it — renders "—". */
  includedCount: number | null;
  /** 연동 제외 논리 DB count. `null` when the wire omits it. */
  excludedCount: number | null;
}

/** The `latest-results` wire row — contract fields only. */
interface TcResultWire {
  resource_id?: string | null;
  logical_database_count?: number | null;
  excluded_logical_database_count?: number | null;
}

/** snake results wire → camel row. Absent counts → null (never a false 0). */
export function toTcResultRow(wire: TcResultWire): TcResultRow {
  return {
    resourceId: wire.resource_id ?? '',
    includedCount: wire.logical_database_count ?? null,
    excludedCount: wire.excluded_logical_database_count ?? null,
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

/** POST …/{id}/pii-agent-installation/confirm — approve the integration. No body. */
export const confirmInstallation = (targetSourceId: number): Promise<unknown> =>
  fetchInfraJson<unknown>(
    `/target-sources/${targetSourceId}/pii-agent-installation/confirm`,
    { method: 'POST' },
  );

// ---------------------------------------------------------------------------
// TC 이력 — Complete/Reject/Reset trail (swagger getTestConnectionHistory).
// ---------------------------------------------------------------------------

interface TcHistoryWire {
  target_source_id?: number;
  status?: string | null;
  reason?: string | null;
  created_at?: string | null;
}

export interface TcHistoryRow {
  status: string;
  reason: string | null;
  createdAt: string | null;
}

export interface TcHistoryPage {
  totalPages: number;
  content: TcHistoryRow[];
}

// ---------------------------------------------------------------------------
// TC 실행 기록 — the runs themselves (swagger getTestConnectionExecutionHistory).
// Sibling to the trail below: this is "언제 돌렸고 결과가 무엇이었나", that one is
// "누가 완료를 확인했고 누가 재실행을 요청했나".
// ---------------------------------------------------------------------------

interface TcExecutionWire {
  test_connection_version?: number | null;
  status?: string | null;
  requested_at?: string | null;
  completed_at?: string | null;
}

/** Contract enum; anything else (or absent) stays UNKNOWN — never a claimed success. */
export type TcExecutionStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAIL' | 'UNKNOWN';

const EXECUTION_STATUSES: readonly TcExecutionStatus[] = ['PENDING', 'RUNNING', 'SUCCESS', 'FAIL'];

export interface TcExecutionRow {
  /** Run ordinal — `null` when the wire omits it. */
  version: number | null;
  status: TcExecutionStatus;
  requestedAt: string | null;
  completedAt: string | null;
}

export interface TcExecutionPage {
  totalElements: number;
  totalPages: number;
  content: TcExecutionRow[];
}

/** GET …/{id}/test-connection/execution-history?page&size — newest first. */
export const getTestConnectionExecutionHistory = async (
  targetSourceId: number,
  page = 0,
  size = 5,
): Promise<TcExecutionPage> => {
  const raw = await fetchInfraJson<{
    totalElements?: number | null;
    totalPages?: number | null;
    content?: TcExecutionWire[] | null;
  }>(`/target-sources/${targetSourceId}/test-connection/execution-history?page=${page}&size=${size}`);

  const content = (raw.content ?? []).map((w) => {
    const status = (w.status ?? '').toUpperCase() as TcExecutionStatus;
    return {
      version: w.test_connection_version ?? null,
      status: EXECUTION_STATUSES.includes(status) ? status : 'UNKNOWN',
      requestedAt: w.requested_at ?? null,
      completedAt: w.completed_at ?? null,
    };
  });
  return {
    totalElements: raw.totalElements ?? content.length,
    totalPages: Math.max(1, raw.totalPages ?? 1),
    content,
  };
};

/** GET …/{id}/test-connection/history?page&size — Spring page, newest first. */
export const getTestConnectionHistory = async (
  targetSourceId: number,
  page = 0,
  size = 5,
): Promise<TcHistoryPage> => {
  const raw = await fetchInfraJson<{ totalPages?: number; content?: TcHistoryWire[] | null }>(
    `/target-sources/${targetSourceId}/test-connection/history?page=${page}&size=${size}`,
  );
  return {
    totalPages: Math.max(1, raw.totalPages ?? 1),
    content: (raw.content ?? []).map((w) => ({
      status: w.status ?? 'UNKNOWN',
      reason: w.reason ?? null,
      createdAt: w.created_at ?? null,
    })),
  };
};

// ---------------------------------------------------------------------------
// Pod 로그 — TC pod 의 StackDriver 캡처본 (DRAFT CONTRACT, swagger 미랜딩).
// ---------------------------------------------------------------------------

/** severity + content 한 줄 — StackDriver LogSeverity 원문 어휘. */
export interface TcPodLogEntry {
  severity: string;
  content: string;
}

export interface TcPodLog {
  podId: string;
  /** 완료 시점 캡처 도장 — 뷰어 헤더의 "…에 캡처". */
  capturedAt: string | null;
  entries: TcPodLogEntry[];
}

interface TcPodLogWire {
  pod_id?: string | null;
  captured_at?: string | null;
  entries?: readonly { severity?: string | null; content?: string | null }[] | null;
}

/**
 * GET …/{id}/test-connection/pod-logs/{podId} — 캡처본 조회. 404 = 캡처 없음
 * (실행 이력이 없거나, pod 가 최신 실행의 것이 아니거나, 아직 정착 전).
 * DRAFT 라 스키마 검증이 없으므로 이 어댑터가 방어적으로 접는다.
 */
export const getTestConnectionPodLog = async (
  targetSourceId: number,
  podId: string,
): Promise<TcPodLog> => {
  const raw = await fetchInfraJson<TcPodLogWire>(
    `/target-sources/${targetSourceId}/test-connection/pod-logs/${encodeURIComponent(podId)}`,
  );
  return {
    podId: raw.pod_id || podId,
    capturedAt: raw.captured_at ?? null,
    entries: (raw.entries ?? [])
      .filter((entry) => Boolean(entry?.content))
      .map((entry) => ({
        severity: (entry.severity ?? '').toUpperCase() || 'DEFAULT',
        content: entry.content ?? '',
      })),
  };
};
