# ADR-019 API Contract Migration Plan

> Status: **Draft for review** · Base: latest `origin/main` · Implements **[ADR-019](../../adr/019-bff-casing-boundary-and-runtime-validation.md)** (D1–D6, esp. **D6 loud API** + **D2.3 opaque maps**).
> New contract source: consolidated swagger (`/install/v1/*`, 50 endpoints) — to be imported into `docs/swagger/install-v1.yaml`.
> Reference (domain/UX, kept outside repo): `~/pii-agent-migration-notes/01-target-source-detail-spec.md`.

---

## 0. Goal & Non-negotiables

Deprecate every divergent existing API client path/schema and align the whole stack to the new swagger. **This is mechanically straightforward but contract-critical** — the value is exactness, not cleverness.

Top-priority invariants:
1. **Path exactness** — every client path matches the swagger path verbatim (incl. `by-resource-id`, `latest_version` vs `latest-results`, `target_source_id` path param on `azure/scan-app`).
2. **Schema exactness** — request/response wire shapes match swagger field-for-field, incl. enum spellings (`TEMP` not `TMP`) and casing.
3. **Response ↔ Adapter contract** — the wire→domain→UI mapping is honored end-to-end with zero silent drift. This is co-equal top priority with path/schema.
4. **Per-endpoint review ≥3×** (codex gpt-5.5 xhigh + opus), schema+path focused. An endpoint is not "done" until 3 reviews return zero contract findings. Overall ≥10 review rounds across the migration.
5. **ADR-019 D6** — every casing/validation exception is greppable in a method name or type (`getSnakeRaw`, `OpaqueKeys`), never a comment or a silent `as T`.

Out of scope: new product features (except the IDC `UNKNOWN`→"작업중" item below), UI redesign, BFF-side changes.

---

## 1. Three change streams (user's 1 / 2 / 3)

| # | Stream | What changes | Files |
|---|--------|--------------|-------|
| 1 | **API Path + Schema** | Path literals + wire request/response types aligned to swagger | `lib/bff/http.ts`, `lib/bff/types/*`, `app/lib/api/*` |
| 2 | **Mock responses** | Mock handlers emit the **swagger wire shape** (snake) so mock == contract; seed data updated to new fields/enums | `lib/bff/mock/*`, `lib/mock-*.ts`, `lib/bff/mock-adapter.ts` |
| 3 | **Response ↔ UI Adapter mapping** | Domain mappers/normalizers + UI adapters consume the new camel domain fields; new enums handled | `lib/*-response.ts` normalizers, `app/**/_components/**` adapters/hooks |

Plus one explicit feature: **IDC resource `UNKNOWN` status → render "작업중"** (§6).

---

## 2. Casing & ADR-019 application (the architectural spine)

The new swagger is **snake-dominant for responses** (`target_source_id`, `database_name`, `skip_reason`, `connection_status`, `test_connection_status`, `installation_status`, `logical_database_list`…) and **mixed for requests** (`UpdateCredentialRequest` is camel: `resourceId`/`credentialId`; `SkipLogicalDatabaseItem` is snake). This is exactly ADR-019's Problem 3.

Decisions (per ADR-019):
- **D1 — one boundary.** All response casing normalization happens once, in the proxy (`lib/bff/*`). CSR + route handlers consume already-camel domain data; no second transform.
- **D2 — camelCase by default.** Every JSON response is `camelCaseKeys`-d at the boundary. Domain shape = camelCase.
- **D2.3 — opaque maps.** Data-keyed maps (e.g. `resource_count_by_resource_type`) marked `OpaqueKeys<…>` so `camelCaseKeys` provably skips their values.
- **D3 — request pass-through.** No blanket `snakeCaseKeys`. Each request body matches its endpoint's contract casing via a typed wire body (camel where swagger says camel, snake where snake).
- **D4 — zod (incremental).** High-risk responses (completion-status, test-connection results, idc installation-status, approval) get `schema.parse(camelCaseKeys(data))`; `as T` retired on migrated paths. `ZodError` → `ProblemDetails` via existing pipeline.
- **D6 — loud API.** `getSnakeRaw<T>()` for sanctioned opt-outs (IDC mapper-owned per existing IDC design); `OpaqueKeys` for dynamic maps; validated-vs-`as T` visible at the call site.

**Mock parity decision (key):** today `mock-adapter.ts` returns `response.json() as T` with **no** `camelCaseKeys`, and mock handlers are authored inconsistently (some snake, some camel) — a latent `as T` drift. We fix this so **mocks author the swagger wire shape (snake) and route through the same `camelCaseKeys` boundary as `httpBff`**. Result: mock output == real output (true ADR-011 parity) **and** each mock is a literal example of the swagger schema (directly verifiable against the contract). This is the foundation phase (P1).

---

## 3. New contract inventory (50 endpoints)

`operationId` · request schema · 200/2xx response schema · status vs current code. (Actuator endpoints omitted; a few response schemas marked ⚠ are verification targets.)

### Test Connection (Step 5/6)
| Method | Path (`/install/v1` prefix) | operationId | Request | Response | vs current |
|---|---|---|---|---|---|
| POST | `…/test-connection/async` | requestTestConnection | — (query `collectorImageTag?`) | 202 `TestConnectionTriggerResponse` | **RENAME** from `…/test-connection` + **body removed** |
| GET | `…/test-connection/latest_version` | getLatestTestConnectionStatus | — | `TestConnectionVersionResult` | **RENAME** from `…/test-connection/latest` |
| GET | `…/test-connection/latest-results` | getLatestTestConnectionResultSummaries | — | `TestConnectionLatestResultSummaryResponse` | **RENAME/RESHAPE** from `…/test-connection/results?page&size` (now a summary, not a page) |
| GET | `…/test-connection/completion-status` | getTestConnectionCompletionStatus | — | `TestConnectionCompletionStatusResponse` | **NEW** |
| PUT | `…/test-connection-acknowledgment` | updateTestConnectionConfirmation | `UpdateTestConnectionConfirmationRequest` `{confirmed:boolean}` | `TestConnectionConfirmationResponse` | **body change** (see §5) |

### Logical DB (Step 5 modal)
| Method | Path | operationId | Request | Response | vs current |
|---|---|---|---|---|---|
| GET | `…/tested-logical-databases` | getTestedLogicalDatabases | — | `TestedLogicalDatabasesResponse` | **NEW** (stub today) |
| GET | `…/tested-logical-databases/by-resource-id` | getTestedLogicalDatabasesByResourceId | — (query `resourceId`) | `TestedLogicalDatabasesResponse` | **NEW** |
| GET | `…/excluded-databases` | getExcludedLogicalDatabases | — | `SkipLogicalDatabaseResponse` | **NEW** |
| PUT | `…/excluded-databases` | updateExcludedLogicalDatabases | `UpdateSkipLogicalDatabaseRequest` | `SkipLogicalDatabaseResponse` | **NEW** |
| GET | `…/excluded-databases/by-resource-id` | getExcludedLogicalDatabasesByResourceId | — (query `resourceId`) | `SkipLogicalDatabaseResponse` | **NEW** |
| PUT | `…/excluded-databases/by-resource-id` | updateExcludedLogicalDatabasesByResourceId | `UpdateSkipLogicalDatabaseRequest` | `SkipLogicalDatabaseResponse` | **NEW** |

`SkipLogicalDatabaseItem`: `{ database_name (req), schema_name?, skip_reason ∈ {STG,DEV,TEMP} (req), type ∈ {DATABASE,SCHEMA} (req) }`. `TestedLogicalDatabaseItem`: `{ database_name, schema_name?, type ∈ {DATABASE,SCHEMA} }`. ⚠ doc said `TMP` → swagger says **`TEMP`**.

### IDC (Step 1–4)
| Method | Path | operationId | Response | vs current |
|---|---|---|---|---|
| GET | `…/idc/previous-request` | getIdcPreviousRequest | `IdcPreviousRequestResponse` | **NEW** |
| GET | `…/idc/installation-status` | getIdcInstallationStatus | `IdcInstallationStatusResponse` | **NEW** |
| GET | `/idc/nlb/{nlbIndex}/resources` | getOccupiedResources | `NlbOccupiedResourceResponse` ⚠ | **NEW** |
| GET | `/idc/nlb/table` | getNlbTable | `NlbTableResponse` ⚠ | **NEW** |

`IdcResourceInstallationStatusDto.installation_status ∈ {COMPLETED,FAIL,IN_PROGRESS,SKIP,UNKNOWN}`; step statuses `bdc_side_cx_terraform_apply`/`bdc_side_bdp_terraform_apply`/`firewall_check` use `CloudInstallationStepStatusDto` (same enum). **`UNKNOWN`→"작업중"** (§6).

### Approval (Step 2)
| Method | Path | operationId | Request | Response | vs current |
|---|---|---|---|---|---|
| POST | `…/approval-requests` | createApprovalRequest | `ApprovalRequestInputDto` | `ApprovalRequestSummaryDto` | SAME path |
| POST | `…/approval-requests/reject` | rejectApprovalRequest | `ApprovalRejectRequestDto` | `ApprovalActionResponseDto` | SAME |
| POST | `…/approval-requests/cancel` | cancelApprovalRequest | — | `ApprovalActionResponseDto` | SAME |
| POST | `…/approval-requests/approve` | approveApprovalRequest | `ApprovalApproveRequestDto` | `ApprovalActionResponseDto` | SAME |
| GET | `…/approval-requests/latest` | getLatestApprovalRequest | — | `ApprovalRequestLatestDto` ⚠ | SAME |
| GET | `…/approval-history` | getApprovalHistory | — | `Page` ⚠ | SAME |
| POST | `…/approval-unavailable` | markApprovalRequestUnavailable | `ApprovalRejectRequestDto` | `ApprovalUnavailableResponseDto` | **NEW** |
| POST | `…/approval-unavailable/confirm` | confirmApprovalUnavailable | — | `ApprovalUnavailableConfirmResponseDto` | **NEW** |

### Target source / scan / resources / install / misc
| Method | Path | operationId | Request | Response | vs current |
|---|---|---|---|---|---|
| GET | `…/{targetSourceId}` | getTargetSourceDetail | — | `TargetSourceDetail` | SAME |
| GET | `…/process-status` | getProcessStatus | — | `ProcessStatusResponseDto` | SAME |
| GET | `…/resources` | getRecommendedResources | — | `CloudResourceResponse` | SAME |
| GET | `…/confirmed-integration` | getConfirmedIntegration | — | `ConfirmedIntegrationResponse` | SAME |
| GET | `…/approved-integration` | getApprovedIntegration | — | `ApprovedIntegrationResponseDto` ⚠ | SAME |
| GET | `…/secrets` | getTargetSourceSecrets | — | `SecretResponse` | SAME |
| PUT | `…/resources/credential` | updateResourceCredential | `UpdateCredentialRequest` (camel) | `UpdateCredentialResponse` | SAME |
| POST | `…/scan` | startScan | — | 202 `ScanJobResponse` | SAME |
| GET | `…/scanJob/latest` | getLatestScan | — | `ScanJobResponse` | SAME |
| GET | `…/scan/history` | getScanHistory | — | `PageScanJobResponse` | SAME |
| POST | `…/pii-agent-installation/confirm` | confirmPiiAgentInstallation | `PiiAgentInstallationConfirmRequest` | `TargetSourceResponse` | SAME |
| POST | `…/services/{serviceCode}/creation-candidates` | getTargetSourceCreationCandidates | `TargetSourceCreationCandidateRequest` | `TargetSourceCreationCandidateResponse` | **RENAME** from `registration-preview` |
| POST | `…/services/{serviceCode}/target-sources` | createTargetSource | `TargetSourceCreationCandidateResponse` | 201 `TargetSourceInfo` | SAME path; ⚠ req body = the candidate response |
| GET | `…/services/{serviceCode}` | getTargetSourcesByServiceCode | — | `TargetSourceDetail` ⚠ | SAME |
| GET | `/services/{serviceCode}/authorized-users` | getServiceAuthorizedUsers | — | `AuthorizedUsersResponse` ⚠ | **NEW** |
| GET | `…/{target_source_id}/azure/scan-app` | getAzureScanApp | — | `AzureServicePrincipalVerificationResponse` | SAME (raw passthrough — `getSnakeRaw`, transitional Issue#222) |
| GET | `…/azure/installation-status` | getInstallationStatus | — | `AzureInstallationStatusResponse` ⚠ | SAME |
| GET | `…/aws/installation-status` | getAwsInstallationStatus | — | ⚠ (parsed as `ErrorMessage` — verify) | SAME |
| GET | `…/aws/verify-scan-role` / `…/aws/verify-execution-role` | verifyAwsScanRole / verifyAwsExecutionRole | — | `AwsRoleVerificationResponse` ⚠ | SAME |
| GET | `…/aws/terraform-script/download` | (download) | — | binary — `getRaw` | SAME (non-JSON, legitimate) |
| GET | `…/gcp/scan-service-account` / `…/gcp/terraform-service-account` | getGcpScanServiceAccount / getGcpTerraformServiceAccount | — | `GcpServiceAccountInfoResponse` | SAME |
| GET | `…/gcp/installation-status` | getGcpInstallationStatus | — | `GcpInstallationStatusResponse` | SAME |
| GET | `/users/search` · `/user/services/page` · `/user/me` | searchUsers / getUserServices / getUserMe | — | `UserSearchResponse` / `PageServiceItem` / `UserMeResponse` | SAME |
| GET/PUT | `/admin/guides/{name}` | getGuide / updateGuide | `GuideUpdateRequest` | `GuideDetail` | SAME |
| GET | `/infra/target-sources/{id}/azure-private-link-health-check` | getAzurePrivateLinkHealthCheck | — | `AzureHealthCheckResult` ⚠ | SAME |

---

## 4. Discrepancies — resolve before/while coding (verification targets)

These are why per-API review matters. Each must reach an explicit resolution in the verification log (§7).

1. **`skip_reason`: `TEMP` (swagger) vs `TMP` (domain doc).** → swagger authoritative; use `TEMP`. Confirm with BFF that emitted value is `TEMP`.
2. **`idc/resources` GET/PUT (Step 1 save) — absent in swagger.** Step 1 must save the DB list somehow. Candidates: generic `…/resources`, or a not-yet-published endpoint. **Blocker for Step 1 write path** — verify before implementing.
3. **`test-connection/history?page` (Step 5 past records) — absent in swagger.** Source of paginated history? Possibly dropped in favor of `latest-results`. Verify.
4. **`approval-requests/system-reset` (current `http.ts`) — absent in swagger.** Keep (out-of-contract dev helper) or drop? Verify.
5. **`latest-results` reshape.** Was paginated `results`; now `TestConnectionLatestResultSummaryResponse` (per-resource `logical_database_count` / `excluded_logical_database_count`). The FinalLogicalDbApprovalModal table maps to this — confirm field mapping.
6. **`aws/installation-status` 200 parsed as `ErrorMessage`.** Likely a swagger authoring bug or parser artifact — read the raw block and confirm the real 200 schema.
7. **`createTargetSource` request body = `TargetSourceCreationCandidateResponse`.** Confirm the round-trip (candidate fetched → posted back verbatim).
8. **`completion-status` richer than doc** — has `latest_test_connection_requested_at`, `logical_database_updated_at`, `latest_test_connection_success`, `test_connection_confirmed` beyond `test_connection_status`. Wire the badge hover tooltips (최근 요청 시간 / 제외 DB 업데이트 시간) to these real fields.

---

## 5. Request-body-only changes (user hint)

Both are small, body/param-level, no path change:

- **`PUT …/test-connection-acknowledgment`** — body `UpdateTestConnectionConfirmationRequest = { confirmed: boolean }` (required). Summary: *"완료 확인 설정/롤백"*. Therefore:
  - **"완료 승인 요청"** (Step 5 final approval) → `{ confirmed: true }`.
  - **"연결 테스트 재실행" Modal** (Step 6) → `{ confirmed: false }` (rollback), which moves completion-status off CONFIRMED so the test can be re-run.
  - Same endpoint; only the boolean differs. Audit current callers and ensure both send the correct value.
- **`POST …/test-connection/async`** ("요청하기" / 연결 테스트 실행) — **no request body**; optional query `collectorImageTag`. Migrate the current body-bearing trigger to a no-body call (+ pass `collectorImageTag` when present). Response is `202 TestConnectionTriggerResponse`.

---

## 6. Feature: IDC `UNKNOWN` → "작업중"

- Where: `IdcResourceInstallationStatusDto.installation_status` (per-resource) and the `CloudInstallationStepStatusDto.status` step rows, enum `{COMPLETED, FAIL, IN_PROGRESS, SKIP, UNKNOWN}`.
- Behavior: in the IDC installation-status **UI adapter**, map `UNKNOWN` to the **in-progress** visual bucket labeled **"작업중"** — same rendering as `IN_PROGRESS` (spinner/진행 톤), not an error/unknown state.
- Scope: IDC only (the user scoped it to IDC resources). Keep cloud adapters' `UNKNOWN` handling unchanged unless a separate decision says otherwise.
- Test: adapter unit test asserting `UNKNOWN → "작업중"` for resource status and step status.

---

## 7. Contract verification protocol (the core discipline)

**Single source of truth:** import the swagger to `docs/swagger/install-v1.yaml`. Mark superseded files (`install-v1-client.yaml`, `confirm.yaml`, `test-connection.yaml`, `logical-db-status.yaml`, `idc.yaml`, …) deprecated in `docs/swagger/README.md`; remove only after their endpoints are fully migrated.

**Per-endpoint gate — minimum 3 reviews, schema+path focused.** An endpoint advances only when 3 consecutive reviews return zero contract findings:
- Review dimensions: (a) path verbatim incl. params; (b) request schema field/casing/required/enum; (c) response schema field/casing/enum; (d) **Response→Adapter→UI mapping** preserves every field, no silent drop/rename; (e) mock wire shape == swagger; (f) ADR-019 D6 (no silent `as T`, opt-outs greppable).
- Reviewers: **codex (gpt-5.5, reasoning=xhigh)** via `/codex-review` + **opus** self-review, alternating, ≥3 passes per endpoint.
- Overall ≥10 review rounds across the migration (per-endpoint ×3 across 50 endpoints far exceeds this; the ≥10 is the floor for whole-contract convergence sweeps).

**Verification log:** `docs/reports/adr019-api-migration/contract-verification.md` — one row per endpoint: `path | reviews passed (n/3) | findings | resolution | status`. No code for a domain merges until its endpoints are 3/3 clean.

---

## 8. Phasing (PR breakdown — each its own worktree off latest main)

| Phase | Scope | Gate |
|---|---|---|
| **P0** (this) | Plan + import swagger to `docs/swagger/install-v1.yaml` + verification log skeleton | docs review |
| **P1 — casing foundation** | `mock-adapter` routes through `camelCaseKeys`; mocks → wire-snake; `getSnakeRaw` + `OpaqueKeys` introduced (ADR-019 D1/D2/D2.3/D6) | all existing tests green; mock==wire |
| **P2 — test-connection** | async/latest_version/latest-results/completion-status/acknowledgment: path+schema+mock+adapter; §5 body changes; zod on completion-status & results (D4) | endpoints 3/3 clean |
| **P3 — logical DB** | tested + excluded (+by-resource-id), `SkipLogicalDatabaseItem` (TEMP), parent-child, modal adapter; replace stub `useLogicalDatabases` | 3/3 clean |
| **P4 — IDC** | previous-request, installation-status (+`UNKNOWN`→"작업중"), nlb/*; resolve `idc/resources` gap (§4.2) | 3/3 clean |
| **P5 — approval** | approval-unavailable(+confirm); reconcile latest/history/`system-reset` | 3/3 clean |
| **P6 — remainder** | creation-candidates rename, scan, resources, secrets, gcp/aws/azure status, users, guides, infra | 3/3 clean |
| **P7 — cleanup** | remove superseded swagger files + dead types; final whole-contract sweep (≥10th round) | zero open findings |

Each phase: own worktree, `tsc`+`lint`+`test`+`build` green, codex+opus ≥3 per endpoint, immediate commit & push, PR.

---

## 9. Done criteria

- Every client path/schema matches `docs/swagger/install-v1.yaml` verbatim (enums incl. `TEMP`; casing per D2/D3).
- One casing boundary; mock output == real output == swagger wire (post-`camelCaseKeys`).
- No `as T` on migrated response paths (zod or generated types); every opt-out greppable (`getSnakeRaw`/`OpaqueKeys`) — ADR-019 D6 satisfied.
- Response↔Adapter↔UI mapping verified for every endpoint; IDC `UNKNOWN`→"작업중" shipped with a test.
- Every endpoint 3/3 review-clean in the verification log; ≥10 whole-contract rounds; zero open discrepancies (§4 all resolved).
- `tsc`/`lint`/`test`/`build` green.

---

## 10. Open questions for the user (do not block P0/P1)

1. §4 discrepancies — for `idc/resources`, `test-connection/history`, `system-reset`: is the swagger the complete contract (i.e. these are intentionally gone), or are some endpoints still pending publication?
2. IDC `UNKNOWN`→"작업중": apply to step-status rows too, or resource-level `installation_status` only?
3. Superseded swagger files: delete in P7, or keep as historical reference under a `docs/swagger/_deprecated/` folder?
