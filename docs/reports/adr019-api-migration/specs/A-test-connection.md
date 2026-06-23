# Spec A — Test Connection (Step 5/6) — ADR-019 Contract Migration

> Domain: **Test Connection** (5 endpoints). Authoritative contract: `docs/swagger/install-v1.yaml`.
> Implements ADR-019 D1 (one boundary) · D2 (camelCase domain) · D3 (request pass-through) · D4 (zod on completion-status + version) · D6 (loud API).
> This spec is implementation-ready: implement from it without re-reading the swagger. All wire field names/casing/enums below are **verbatim** from the swagger.

---

## 0. Summary

| # | Endpoint | operationId | vs current | Verdict |
|---|----------|-------------|-----------|---------|
| 1 | POST `…/test-connection/async` | requestTestConnection | path `…/test-connection` → `…/test-connection/async`; **request body removed**; response loses `id` | **RENAME + body/response change** |
| 2 | GET `…/test-connection/latest_version` | getLatestTestConnectionStatus | path `…/test-connection/latest` → `…/test-connection/latest_version`; **response fully reshaped** | **RENAME + RESHAPE** |
| 3 | GET `…/test-connection/latest-results` | getLatestTestConnectionResultSummaries | path `…/test-connection/results?page&size` → `…/test-connection/latest-results`; **paginated jobs → array of per-resource summaries** | **RENAME + RESHAPE** |
| 4 | GET `…/test-connection/completion-status` | getTestConnectionCompletionStatus | — | **NEW** (no current client/route/mock) |
| 5 | PUT `…/test-connection-acknowledgment` | updateTestConnectionConfirmation | — | **NEW** (no current client/route/mock; body `{confirmed:boolean}`) |

Counts: **NEW = 2** (completion-status, acknowledgment) · **RENAME/RESHAPE = 3** (async, latest_version, latest-results) · **SAME = 0**.

All 5 paths sit under `/install/v1` (prepended by `toUpstreamInfraApiPath` in `lib/bff/http.ts` / `lib/bff/mock-adapter` route layer — never hard-code the prefix in the client method).

---

## 1. Current code map (READ-ONLY — symbols + exact paths)

### Client (CSR-facing)
`app/lib/api/index.ts`:
- `triggerTestConnection(targetSourceId)` L673 → `POST /target-sources/{id}/test-connection` via **`fetchInfraJson`** (raw, no camel), with `{ method: 'POST' }` (no body sent, but route expects one). Returns `TestConnectionTriggerResponse { success, id }` (L640-643).
- `getTestConnectionLatest(targetSourceId)` L682 → `GET /target-sources/{id}/test-connection/latest` via `fetchInfraJson`. Returns `TestConnectionJob` (L657-665).
- `getTestConnectionResults(targetSourceId, page, size)` L690 → `GET /target-sources/{id}/test-connection/results?page&size` via `fetchInfraJson`, with `page.total_elements`/`total_pages` fallback merge. Returns `TestConnectionResultsResponse` (L667-670).
- Wire types (snake) defined inline in this file: `TestConnectionTriggerResponse` (L640), `TestConnectionStatus`='PENDING'|'SUCCESS'|'FAIL' (L645), `TestConnectionErrorStatus` (L646), `TestConnectionResourceResult` (L648-655), `TestConnectionJob` (L657-665), `TestConnectionResultsResponse` (L667-670).
- **No** `getTestConnectionCompletionStatus`, **no** `updateTestConnectionConfirmation` / acknowledgment caller anywhere (grep-confirmed absent).

### Polling hook
`app/hooks/useTestConnectionPolling.ts` — `useTestConnectionPolling(targetSourceId, interval=4000)`. Calls `triggerTestConnection` + `getTestConnectionLatest`. `shouldStop = !job || job.status !== 'PENDING'` (reads `job.status`). Returns `{ latestJob, uiState, loading, triggerError, hasHistory, trigger }`.

### UI components (`app/components/features/process-status/`)
- `ConnectionTestPanel.tsx` — owns the hook; reads `latestJob.status` (L77); renders `ProgressBar` + `ResultSummary` + `ResultDetailModal` + `TestConnectionHistoryModal` + `CredentialSetupModal`.
- `connection-test/ProgressBar.tsx` — reads `job.resource_results.length`.
- `connection-test/ResultSummary.tsx` — reads `job.resource_results[].status`, `job.status`, `job.completed_at`, `job.requested_at`.
- `connection-test/ResultDetailModal.tsx` — reads `job.resource_results[]`, `job.completed_at`, `job.requested_at`.
- `connection-test/ResourceResultRow.tsx` — reads `result.status`, `result.resource_type`, `result.resource_id`, `result.error_status`, `result.guide`.
- `connection-test/HistoryJobCard.tsx` — reads `job.status`, `job.resource_results[].status`, `job.requested_at`, `job.completed_at`.
- `connection-test/TestConnectionHistoryModal.tsx` — paginated history list (consumes `getTestConnectionResults`).

### Route handlers (proxy boundary, `app/integration/api/v1/target-sources/[targetSourceId]/`)
- `test-connection/route.ts` — `POST`; calls `bff.confirm.testConnection(id, {})`; returns `{ success: true, id: data.id ?? requestId }` @202. **No camelCaseKeys.**
- `test-connection/latest/route.ts` — `GET`; calls `bff.confirm.getTestConnectionLatest(id)`; `NextResponse.json(data)` (raw passthrough).
- `test-connection/results/route.ts` — `GET`; parses `page`/`size`; calls `bff.confirm.getTestConnectionResults(id, page, size)`; raw passthrough.
- **No** `completion-status/route.ts`, **no** `test-connection-acknowledgment/route.ts`.

### BFF client interface + impls
- `lib/bff/types.ts` L237-239 — `confirm.testConnection(id, body) => Promise<{ id?: string }>`, `getTestConnectionResults(id, page, size) => Promise<unknown>`, `getTestConnectionLatest(id) => Promise<unknown>`. (No completion-status / acknowledgment members.)
- `lib/bff/http.ts` L277-284 — `testConnection` → `post('/target-sources/{id}/test-connection', body)`; `getTestConnectionResults` → `get('/target-sources/{id}/test-connection/results?page&size')`; `getTestConnectionLatest` → `get('/target-sources/{id}/test-connection/latest')`. `get()` applies `camelCaseKeys` (L43); `post()` is raw passthrough (I-3, L67-68).
- `lib/bff/mock-adapter.ts` L246-253 — delegates to `mockConfirm.*`; `unwrap()` does `response.json() as T` with **NO camelCaseKeys** (L68). This is the latent `as T` drift P1 fixes.

### Mock
- `lib/bff/mock/confirm.ts` — `testConnection` L1551 (returns `{ id: job.id }` @202), `getTestConnectionResults` L1598 (returns `{ content: [...toJobResponse], page }`), `getTestConnectionLatest` L1616 (returns `toJobResponse(job)`). No completion-status / acknowledgment handler.
- `lib/mock-test-connection.ts` — simulation engine. `toJobResponse(job)` L271 emits snake `{ id, target_source_id, status, requested_at, completed_at, requested_by, resource_results }`. Seed jobs live in `getStore().testConnectionJobs`.

### Boundary helpers
- `lib/object-case.ts` — `camelCaseKeys` / `snakeCaseKeys` only. **No `getSnakeRaw`, no `OpaqueKeys`** (introduced in P1 — grep-confirmed absent repo-wide).
- `lib/infra-api.ts` — `UPSTREAM_INFRA_API_PREFIX='/install/v1'`, `INTERNAL_INFRA_API_PREFIX='/integration/api/v1'`.

---

## 2. Target wire schemas (VERBATIM from swagger)

> Wire = snake (responses). `camelCaseKeys` at the boundary → domain (camel). Requests pass through as-authored.

```
# TestConnectionTriggerResponse   (202 of #1)
{ success: boolean }

# TestConnectionVersionResult   (200 of #2)
{
  target_source_id: int64,
  test_connection_version: int64,
  connection_status: enum { PENDING, RUNNING, SUCCESS, FAIL },
  requested_at: date-time (string),
  completed_at: date-time (string),
  test_connection_agent_results: TestConnectionAgentResult[]
}
# TestConnectionAgentResult
{
  agent_id: string,
  gcp_region: string,
  resource_id: string,
  connection_status: enum { PENDING, RUNNING, SUCCESS, FAIL },
  database_uri_list: string[]
}

# TestConnectionLatestResultSummaryResponse   (item type of #3 — 200 is an ARRAY of these)
{
  resource_id: string,
  agent_id: string,
  logical_database_count: int64,
  excluded_logical_database_count: int64
}

# TestConnectionCompletionStatusResponse   (200 of #4)
{
  target_source_id: int64,
  latest_test_connection_requested_at: date-time (string),
  logical_database_updated_at: date-time (string),
  latest_test_connection_success: boolean,
  test_connection_status: enum {
    CONFIRMED, LATEST_TEST_CONNECTION_SUCCESS,
    TEST_CONNECTION_REQUIRED, LOGICAL_DATABASE_RECENTLY_UPDATED
  },
  test_connection_confirmed: boolean
}

# UpdateTestConnectionConfirmationRequest   (request body of #5; required: [confirmed])
{ confirmed: boolean }

# TestConnectionConfirmationResponse   (200 of #5)
{
  target_source_id: int64,
  confirmed: boolean,
  confirmed_at: date-time (string)
}
```

No `OpaqueKeys` needed for this domain — no data-keyed maps in any schema. No `getSnakeRaw` opt-out needed — all responses are plain and camelCase-safe.

---

## 3. Per-endpoint delta (path → schema → adapter → UI)

### Endpoint 1 — POST `…/test-connection/async` (requestTestConnection)
- **Path:** `/install/v1/target-sources/{targetSourceId}/test-connection/async` (path param `targetSourceId` int64). **Query:** `collectorImageTag` (string, optional). **Request body: NONE.** **2xx:** `202` → `TestConnectionTriggerResponse { success }`.
- **Current → target:**
  - Client path `…/test-connection` → `…/test-connection/async`.
  - Current client sends `{ method: 'POST' }` (no body) — fine; but the **route** calls `bff.confirm.testConnection(id, {})` passing a body. Drop the body param.
  - Optional `collectorImageTag` query: thread it client → route → `bff.confirm`. (Current UI never sets it; pass-through only when present, via `buildQuery`.)
  - **Response shape change:** swagger `TestConnectionTriggerResponse = { success }` — **no `id`**. Current client type `{ success, id }` and route `{ success: true, id: data.id ?? requestId }` must drop `id`. The polling hook does NOT use the trigger's `id` (it re-fetches `latest_version`), so dropping `id` is safe — **verify no caller reads `.id` from `trigger()`** (current `trigger` discards the return — safe).
- **Wire type (snake):** `TestConnectionTriggerResponse { success: boolean }`.
- **Domain type (camel):** `{ success: boolean }`.
- **Field map:** `success → success`. (No other fields.)
- **Casing (D3):** request has no body; no casing concern. Response `{ success }` — casing-invariant.
- **Mock:** `mockConfirm.testConnection` currently returns `{ id: job.id }` @202 → change to **`{ success: true }`** @202 (wire == swagger). Keep the internal `createTestConnectionJob` simulation (drives `latest_version`). Drop the `_body` param usage. **Mock-parity:** once P1 routes mock through `camelCaseKeys`, `{ success: true }` is already camel-safe.

### Endpoint 2 — GET `…/test-connection/latest_version` (getLatestTestConnectionStatus)
- **Path:** `/install/v1/target-sources/{targetSourceId}/test-connection/latest_version` (note **underscore** `latest_version`, not `latest-version`). Path param int64. No query. **2xx:** `200` → `TestConnectionVersionResult`.
- **Current → target:** path `…/test-connection/latest` → `…/test-connection/latest_version`. **Response fully reshaped** (see field map). This is the polling endpoint (4s interval).
- **Wire type (snake) `TestConnectionVersionResultWire`:** as §2 (`connection_status`, `test_connection_agent_results[]`, etc.).
- **Domain type (camel) `TestConnectionVersionResult`:**
  ```
  {
    targetSourceId: number,
    testConnectionVersion: number,
    connectionStatus: 'PENDING'|'RUNNING'|'SUCCESS'|'FAIL',
    requestedAt: string,
    completedAt: string,
    testConnectionAgentResults: {
      agentId: string, gcpRegion: string, resourceId: string,
      connectionStatus: 'PENDING'|'RUNNING'|'SUCCESS'|'FAIL',
      databaseUriList: string[],
    }[],
  }
  ```
- **Response → Adapter → UI field map (trace EVERY field):**

  | Wire (snake) | Domain (camel) | UI consumer | Notes |
  |---|---|---|---|
  | `connection_status` | `connectionStatus` | polling `shouldStop` (was `job.status`), `ResultSummary.isSuccess`, `HistoryJobCard.isSuccess/isFail`, `computeUIState` | enum now includes **`RUNNING`** (was PENDING/SUCCESS/FAIL). Map `PENDING`+`RUNNING` → UI `PENDING`/in-progress; `SUCCESS`/`FAIL` unchanged. |
  | `test_connection_agent_results[]` | `testConnectionAgentResults[]` | `ProgressBar` (`.length`), `ResultSummary`/`ResultDetailModal`/`HistoryJobCard` row maps | **replaces `resource_results[]`**. |
  | `…[].connection_status` | `…[].connectionStatus` | `ResourceResultRow.status` (was `result.status`) | per-resource enum, same 4 values. |
  | `…[].resource_id` | `…[].resourceId` | `ResourceResultRow.resource_id`, row `key` | SAME concept. |
  | `…[].agent_id` | `…[].agentId` | (new) | not previously shown; available for display. |
  | `…[].gcp_region` | `…[].gcpRegion` | (new) | GCP-only region; optional display. |
  | `…[].database_uri_list` | `…[].databaseUriList` | (new) | discovered DB URIs; optional. |
  | `requested_at` | `requestedAt` | `ResultSummary`/`ResultDetailModal`/`HistoryJobCard` date | SAME concept. |
  | `completed_at` | `completedAt` | same date displays | SAME concept. |
  | `target_source_id` | `targetSourceId` | — | echo. |
  | `test_connection_version` | `testConnectionVersion` | (new) | version cursor; useful to detect a fresh run. |
  | — (was `resource_results[].resource_type`) | — | `ResourceResultRow.resource_type` | **GAP: swagger has no per-agent `resource_type`.** UI shows it today. See §5.1. |
  | — (was `resource_results[].error_status`) | — | `ResourceResultRow.error_status` | **GAP: swagger has no `error_status`.** §5.1. |
  | — (was `resource_results[].guide`) | — | `ResourceResultRow.guide` | **GAP: swagger has no failure `guide`.** §5.1. |

- **Casing (D2 + D4):** parse at the **route handler** boundary: `schema.parse(camelCaseKeys(data))` using a zod schema for `TestConnectionVersionResult` (D4 — high-risk polling response). Retire `as T`.
- **Mock:** rewrite `mockConfirm.getTestConnectionLatest` to emit the **wire-snake `TestConnectionVersionResult`** shape (not the old `toJobResponse`). Map the simulation's per-resource results to `test_connection_agent_results[]`: `agent_id` (synth e.g. `agent-{resourceId}`), `gcp_region` (project region or `''`), `resource_id`, `connection_status` (PENDING→RUNNING while mid-run, SUCCESS/FAIL on completion), `database_uri_list` ([] for unfinished). Top-level `connection_status` from job status; `test_connection_version` = monotonically increasing per run; `requested_at`/`completed_at` from the job. Keep `lib/mock-test-connection.ts` simulation timing; only change the **response projection** (replace `toJobResponse` for this endpoint with a `toVersionResultResponse`).

### Endpoint 3 — GET `…/test-connection/latest-results` (getLatestTestConnectionResultSummaries)
- **Path:** `/install/v1/target-sources/{targetSourceId}/test-connection/latest-results` (hyphen `latest-results`). Path param int64. No query. **2xx:** `200` → **ARRAY** of `TestConnectionLatestResultSummaryResponse`.
- **Current → target:** path `…/test-connection/results?page&size` → `…/test-connection/latest-results` (**no pagination params**). Shape: paginated `{ content: TestConnectionJob[], page }` → **flat array of per-resource summaries**. This is a semantic change: results were past **jobs**; now it's the **latest run's per-resource logical-DB counts** — the data source for the FinalLogicalDbApprovalModal table (제목 "연동 대상 논리 DB 최종 확인"; columns Database Type / Resource ID / 연동 대상 논리 DB 개수 / 연동 제외 논리 DB 개수, per domain doc §7).
- **Wire type (snake):** `TestConnectionLatestResultSummaryResponse[]` — each `{ resource_id, agent_id, logical_database_count, excluded_logical_database_count }`.
- **Domain type (camel):** `TestConnectionLatestResultSummary[]` — `{ resourceId, agentId, logicalDatabaseCount, excludedLogicalDatabaseCount }`.
- **Response → Adapter → UI field map:**

  | Wire | Domain | UI (FinalLogicalDbApprovalModal — NEW) | Notes |
  |---|---|---|---|
  | `resource_id` | `resourceId` | Resource ID column | SAME concept. |
  | `agent_id` | `agentId` | (key / join) | new. |
  | `logical_database_count` | `logicalDatabaseCount` | 연동 대상 논리 DB (개수) | new. |
  | `excluded_logical_database_count` | `excludedLogicalDatabaseCount` | 연동 제외 논리 DB (개수) | new. |
  | — | — | "Database Type" column | **GAP: not in this schema.** Resolve by joining on `resourceId` against `getConfirmedIntegration` / catalog (which carries `database_type`). See §5.2. |

- **Casing (D2):** `camelCaseKeys` at the route boundary, applied per-array-element (the existing recursive `camelCaseKeys` already maps array items). zod optional here (lower-risk than version/completion); if added, parse `z.array(schema)`.
- **Mock:** replace `mockConfirm.getTestConnectionResults` (paginated jobs) with **`getLatestTestConnectionResultSummaries`** returning a **bare JSON array** of `{ resource_id, agent_id, logical_database_count, excluded_logical_database_count }`, one element per selected/connected resource of the latest successful run. Counts can derive from seed (e.g. tested-logical-db count minus excluded). **Drop `page`/`size`.**
- **History note:** the old paginated `…/results` backed `TestConnectionHistoryModal` + `HistoryJobCard`. Swagger has **no** `test-connection/history` or paginated results endpoint (§5.4) — confirm whether the history UI is dropped or re-sourced before deleting `getTestConnectionResults`.

### Endpoint 4 — GET `…/test-connection/completion-status` (getTestConnectionCompletionStatus) — NEW
- **Path:** `/install/v1/target-sources/{targetSourceId}/test-connection/completion-status`. Path param int64. No query. **2xx:** `200` → `TestConnectionCompletionStatusResponse`.
- **Current → target:** **NEW** — no client, route, mock, or hook today. Add all.
- **Wire type (snake):** as §2. **Domain type (camel) `TestConnectionCompletionStatus`:**
  ```
  {
    targetSourceId: number,
    latestTestConnectionRequestedAt: string,
    logicalDatabaseUpdatedAt: string,
    latestTestConnectionSuccess: boolean,
    testConnectionStatus: 'CONFIRMED'|'LATEST_TEST_CONNECTION_SUCCESS'|'TEST_CONNECTION_REQUIRED'|'LOGICAL_DATABASE_RECENTLY_UPDATED',
    testConnectionConfirmed: boolean,
  }
  ```
- **Response → Adapter → UI field map (drives the Step 5 badge + 완료 승인 요청 button, per domain doc §2/§7):**

  | Wire | Domain | UI | Notes |
  |---|---|---|---|
  | `test_connection_status` | `testConnectionStatus` | badge + button enable | `LATEST_TEST_CONNECTION_SUCCESS` → 완료 승인 요청 enabled; all others disabled. Domain doc §2 badge table. |
  | `latest_test_connection_requested_at` | `latestTestConnectionRequestedAt` | badge hover "최근 요청 시간" | §4.8 of PLAN. |
  | `logical_database_updated_at` | `logicalDatabaseUpdatedAt` | badge hover "제외 DB 업데이트 시간" | §4.8. |
  | `latest_test_connection_success` | `latestTestConnectionSuccess` | (supporting) | corroborates status. |
  | `test_connection_confirmed` | `testConnectionConfirmed` | (supporting) | corroborates `CONFIRMED`. |
  | `target_source_id` | `targetSourceId` | — | echo. |

- **Casing (D2 + D4):** **zod-parse** `schema.parse(camelCaseKeys(data))` at the route boundary (high-risk — gates the approval CTA). `ZodError` → `ProblemDetails` via existing pipeline.
- **Mock:** NEW `mockConfirm.getTestConnectionCompletionStatus(targetSourceId)` returning wire-snake. Derive `test_connection_status` from project state: latest job SUCCESS + confirmed → `CONFIRMED`; latest job SUCCESS + not confirmed → `LATEST_TEST_CONNECTION_SUCCESS`; excluded-DB changed after last run → `LOGICAL_DATABASE_RECENTLY_UPDATED`; otherwise → `TEST_CONNECTION_REQUIRED`. Populate the two timestamps from job/excluded-DB store; `latest_test_connection_success` + `test_connection_confirmed` accordingly. Add a `confirm`-namespace member to `BffClient` + a `completion-status/route.ts`.

### Endpoint 5 — PUT `…/test-connection-acknowledgment` (updateTestConnectionConfirmation) — NEW
- **Path:** `/install/v1/target-sources/{targetSourceId}/test-connection-acknowledgment` — **sibling of `test-connection`, NOT under `…/test-connection/`** (no slash before `acknowledgment`). Path param int64. **Request body REQUIRED:** `UpdateTestConnectionConfirmationRequest { confirmed: boolean }` (required). **2xx:** `200` → `TestConnectionConfirmationResponse`.
- **Current → target:** **NEW** — no caller today. Summary "Test Connection 완료 확인 설정/롤백". Two call sites (PLAN §5):
  - **완료 승인 요청** (Step 5 final approval, FinalLogicalDbApprovalModal approve) → body **`{ confirmed: true }`** → moves completion-status to `CONFIRMED` → process advances (domain doc §7 "완료 승인 → 상태 전이").
  - **연결 테스트 재실행 Modal** (Step 6) → body **`{ confirmed: false }`** (rollback) → moves completion-status off `CONFIRMED` so the test can re-run.
- **Wire request (per swagger casing — already snake-safe):** `{ confirmed: boolean }`. **D3:** pass body through as-is (no `snakeCaseKeys`). `confirmed` is a single lower-case word — identical in both casings, so no transform either way.
- **Wire response (snake):** `TestConnectionConfirmationResponse { target_source_id, confirmed, confirmed_at }`. **Domain (camel):** `{ targetSourceId, confirmed, confirmedAt }`.
- **Response → Adapter → UI field map:**

  | Wire | Domain | UI | Notes |
  |---|---|---|---|
  | `confirmed` | `confirmed` | success branch (true → advance; false → re-enable re-run) | drives onApproved / re-run callback. |
  | `confirmed_at` | `confirmedAt` | (optional display / toast) | timestamp. |
  | `target_source_id` | `targetSourceId` | — | echo. |

- **Casing (D2):** response via `camelCaseKeys` at route boundary. zod optional (small, low-risk); add if convenient for symmetry.
- **Mock:** NEW `mockConfirm.updateTestConnectionConfirmation(targetSourceId, body)`. Read `body.confirmed`; flip the project's "test-connection confirmed" flag accordingly (true → set confirmed + advance to CONNECTION_VERIFIED equivalent; false → clear confirmed so completion-status returns off-`CONFIRMED`). Return wire-snake `{ target_source_id, confirmed, confirmed_at: now }`. Add `confirm`-namespace member + a `test-connection-acknowledgment/route.ts` (PUT).

---

## 4. Mock change summary (exact new wire shapes)

> All mocks author the **swagger wire (snake)** shape so mock == contract; P1 routes them through `camelCaseKeys`.

1. **`testConnection` (→ requestTestConnection):** return `NextResponse.json({ success: true }, { status: 202 })`. Drop `{ id: job.id }`. Keep `createTestConnectionJob` simulation; drop `_body`. Honor optional `collectorImageTag` (ignore in mock logic, accept param).
2. **`getTestConnectionLatest` (→ getLatestTestConnectionStatus, path `latest_version`):** return wire `TestConnectionVersionResult`:
   ```json
   {
     "target_source_id": 123,
     "test_connection_version": 1,
     "connection_status": "RUNNING",
     "requested_at": "2026-06-23T01:00:00.000Z",
     "completed_at": "2026-06-23T01:00:20.000Z",
     "test_connection_agent_results": [
       { "agent_id": "agent-i-0abc", "gcp_region": "", "resource_id": "i-0abc",
         "connection_status": "SUCCESS", "database_uri_list": ["mysql://…/db1"] }
     ]
   }
   ```
   (Project per-resource results → `test_connection_agent_results[]`; top-level `connection_status` from job status.)
3. **`getTestConnectionResults` → replace with `getLatestTestConnectionResultSummaries` (path `latest-results`):** return a **bare array**:
   ```json
   [
     { "resource_id": "i-0abc", "agent_id": "agent-i-0abc",
       "logical_database_count": 12, "excluded_logical_database_count": 3 }
   ]
   ```
   Drop `page`/`size`. One element per connected resource of the latest successful run.
4. **NEW `getTestConnectionCompletionStatus`:**
   ```json
   {
     "target_source_id": 123,
     "latest_test_connection_requested_at": "2026-06-23T01:00:00.000Z",
     "logical_database_updated_at": "2026-06-23T00:50:00.000Z",
     "latest_test_connection_success": true,
     "test_connection_status": "LATEST_TEST_CONNECTION_SUCCESS",
     "test_connection_confirmed": false
   }
   ```
5. **NEW `updateTestConnectionConfirmation`:** accept `{ confirmed: boolean }`; return:
   ```json
   { "target_source_id": 123, "confirmed": true, "confirmed_at": "2026-06-23T01:01:00.000Z" }
   ```

**Seed adjustments:** ensure at least one seeded project at WAITING_CONNECTION_TEST with a completed-SUCCESS job so `latest_version` returns SUCCESS, `latest-results` returns non-empty counts, and `completion-status` returns `LATEST_TEST_CONNECTION_SUCCESS`. To exercise `LOGICAL_DATABASE_RECENTLY_UPDATED`, seed an excluded-DB update timestamp newer than the last run. `test_connection_version` should increment per simulated run.

**Client + route + interface additions (Stream 1):**
- `app/lib/api/index.ts`: rewrite `triggerTestConnection` (path `/async`, no body, optional `collectorImageTag`, return `{ success }`); rewrite `getTestConnectionLatest` (path `/latest_version`, new domain type); replace `getTestConnectionResults` with `getLatestTestConnectionResultSummaries` (path `/latest-results`, array, no paging); add `getTestConnectionCompletionStatus`; add `updateTestConnectionConfirmation(id, confirmed)`. Switch reshaped GETs to camel domain (route already camels under D1). Remove obsolete snake wire types (`TestConnectionJob`, `TestConnectionResourceResult`, `TestConnectionResultsResponse`, the `id` on trigger).
- `lib/bff/types.ts` `confirm`: change `testConnection` return to `{ success: boolean }`; replace `getTestConnectionResults` with `getLatestTestConnectionResultSummaries(id) => Promise<…[]>`; change `getTestConnectionLatest` return to the version-result type; add `getTestConnectionCompletionStatus(id)` + `updateTestConnectionConfirmation(id, body)`.
- `lib/bff/http.ts` `confirm`: update paths to `/test-connection/async`, `/test-connection/latest_version`, `/test-connection/latest-results`; add `completion-status` (GET) + `test-connection-acknowledgment` (PUT). Note GET `get()` already camels; for the version + completion-status, wrap with zod parse (D4) at the route layer (not in `http.ts`, to keep one boundary).
- Routes: rename/add under `app/integration/api/v1/target-sources/[targetSourceId]/`: `test-connection/async/route.ts` (POST), `test-connection/latest_version/route.ts` (GET), `test-connection/latest-results/route.ts` (GET), `test-connection/completion-status/route.ts` (GET), `test-connection-acknowledgment/route.ts` (PUT). Apply `camelCaseKeys` (+ zod for version & completion-status) in each GET handler. Old `test-connection/route.ts`, `…/latest/route.ts`, `…/results/route.ts` are superseded — remove after migration (P7).

---

## 5. Discrepancies (swagger vs current code vs domain doc) — each flagged explicitly

1. **§5.1 `latest_version` drops per-resource `resource_type`, `error_status`, `guide`.** The current `ResourceResultRow` shows DB type, an error-status label, and a remediation `guide` string on failure. The new `TestConnectionAgentResult` has none of these — only `connection_status` + `database_uri_list` + ids + `gcp_region`. **Resolution needed:** (a) drop the failure-guide/error-label UI, or (b) re-source `resource_type` by joining `resource_id` against `getConfirmedIntegration`/catalog and drop `error_status`/`guide` (no contract source exists for them). **Flag for product decision; default = (b) join for type, remove error_status/guide.** This is the single biggest UI-facing gap in the domain.

2. **§5.2 `latest-results` lacks "Database Type"** that the FinalLogicalDbApprovalModal column needs. Schema only has `resource_id`, `agent_id`, and the two counts. **Resolution:** join `resourceId` → `database_type` via `getConfirmedIntegration` (Spec for confirmed-integration owns that field). Note as a cross-domain dependency.

3. **§5.3 `latest-results` 200 is an ARRAY** (`type: array, items: $ref`), but PLAN §3 table lists the response as a bare `TestConnectionLatestResultSummaryResponse`. **Swagger is authoritative — it is an array.** The domain/UI must iterate. (PLAN wording is shorthand, not a contradiction, but the array-ness is load-bearing.)

4. **§5.4 `test-connection/history?page` (domain doc §5/§7 "이전 내역") is ABSENT in swagger.** No paginated history or `…/results` endpoint exists in the new contract. The current `TestConnectionHistoryModal`/`HistoryJobCard`/`getTestConnectionResults` have no replacement source. **Resolution:** either drop the history UI or confirm a pending endpoint with BFF before deleting `getTestConnectionResults`. **Blocker for removing the history components.**

5. **§5.5 Trigger response loses `id`.** `TestConnectionTriggerResponse = { success }` only — the current client `{ success, id }` and route fallback `data.id ?? requestId` are out of contract. Safe to drop (`trigger()` discards the value; polling uses `latest_version`). Verified no consumer reads `.id`.

6. **§5.6 Trigger request body removed.** Current route passes `bff.confirm.testConnection(id, {})`; swagger declares **no requestBody** on `…/async`. Remove the body param end-to-end.

7. **§5.7 `connection_status` enum gains `RUNNING`.** Current `TestConnectionStatus = PENDING|SUCCESS|FAIL`; swagger `connection_status = PENDING|RUNNING|SUCCESS|FAIL` (both top-level and per-agent). The polling `shouldStop`/`computeUIState` must treat `RUNNING` as in-progress (not stop). **Update the UI state machine.**

8. **§5.8 Domain doc `skip_reason` `TMP` is wrong** (doc §1 lists `TMP|STG|DEV`); swagger `SkipLogicalDatabaseItem.skip_reason = STG|DEV|TEMP` → **`TEMP`**. (Belongs to the Logical-DB domain, not this one, but the doc that grounds this domain repeats `TMP` — noting so the implementer doesn't carry `TMP` over.)

9. **§5.9 Confirm-v1 vs install-v1 base.** Domain doc §6/§8 reference `/confirm/v1/...` for Step 6 latest_version/confirmed-integration. The new swagger is `/install/v1/...`. **Use `/install/v1` (the swagger) — the `/confirm/v1` paths in the doc are stale.** Step 6's re-run also uses `…/test-connection-acknowledgment` `{ confirmed: false }` (this domain).

---

## 6. ADR-019 D6 compliance (this domain)

- **No `getSnakeRaw`** — every response here is plain and camelCase-safe; nothing opts out of the boundary.
- **No `OpaqueKeys`** — no data-keyed maps in any of the 5 schemas.
- **No silent `as T`** on migrated paths — `latest_version` and `completion-status` use `schema.parse(camelCaseKeys(data))` (zod, D4); the rest use typed `camelCaseKeys` at the single route boundary (D1).
- **Request pass-through (D3)** — acknowledgment body `{ confirmed }` sent as-is (no blanket snake transform); `confirmed` is casing-invariant.

---

## 7. Self-review log (3 passes — schema + path focused)

**Review 1: clean — checked** all 5 paths char-by-char vs swagger lines 51, 655, 1976, 2043, 2115 → `test-connection/async`, `test-connection/latest_version` (underscore), `test-connection/latest-results` (hyphen), `test-connection/completion-status`, `test-connection-acknowledgment` (no slash). Path param `targetSourceId` int64 on all; `collectorImageTag` query (optional, string) only on #1. 2xx codes: #1 = 202, #2–#5 = 200. Confirmed #5 path is a sibling of `test-connection`, not nested.

**Review 2: clean — checked** every response/request field name, type, casing, enum vs swagger schema blocks (lines 4323-4340, 4425-4429, 5194-5275): `TestConnectionTriggerResponse{success}` (no id); `TestConnectionVersionResult{target_source_id, test_connection_version, connection_status[PENDING,RUNNING,SUCCESS,FAIL], requested_at, completed_at, test_connection_agent_results[]}`; `TestConnectionAgentResult{agent_id, gcp_region, resource_id, connection_status[…], database_uri_list[]}`; `TestConnectionLatestResultSummaryResponse{resource_id, agent_id, logical_database_count, excluded_logical_database_count}` (200 = **array**); `TestConnectionCompletionStatusResponse{target_source_id, latest_test_connection_requested_at, logical_database_updated_at, latest_test_connection_success, test_connection_status[CONFIRMED,LATEST_TEST_CONNECTION_SUCCESS,TEST_CONNECTION_REQUIRED,LOGICAL_DATABASE_RECENTLY_UPDATED], test_connection_confirmed}`; `UpdateTestConnectionConfirmationRequest{confirmed}` required; `TestConnectionConfirmationResponse{target_source_id, confirmed, confirmed_at}`. Enum spellings verbatim (incl. `RUNNING`, `TEMP` cross-note). camel mappings are mechanical `toCamelCase` of each.

**Review 3: clean — checked** Response→Adapter→UI mapping completeness and current-code symbol accuracy: every wire field has a domain + UI destination or is explicitly flagged as a gap (§5.1 resource_type/error_status/guide; §5.2 database_type); every UI field consumed today (`ProgressBar`/`ResultSummary`/`ResultDetailModal`/`ResourceResultRow`/`HistoryJobCard` at the line refs in §1) is traced to a new source or a gap; current paths/symbols verified against `app/lib/api/index.ts` L640-714, `lib/bff/http.ts` L277-284, `lib/bff/mock/confirm.ts` L1551/1598/1616, route files, and `lib/object-case.ts` (no `getSnakeRaw`/`OpaqueKeys`). All 3 passes find zero path/schema errors.
