# D — Approval Domain (Step 2) — ADR-019 Contract Migration Spec

> Phase **P5** of [PLAN.md](../PLAN.md). Source of truth: `docs/swagger/install-v1.yaml` (lines cited inline).
> Reference (domain/UX): `~/pii-agent-migration-notes/01-target-source-detail-spec.md` §4 (Step2 승인 대기).
> Scope: the 8 Approval endpoints + `ActorDto`. **2 NEW** (`approval-unavailable`, `approval-unavailable/confirm`). 1 out-of-contract helper to reconcile (`approval-requests/system-reset`).
> ADR-019 spine: D1 one boundary · D2 camel domain · D3 request casing per swagger · D4 zod on high-risk · D6 loud opt-outs. **I-3 flip**: POST/PUT responses go from raw passthrough → camel-at-boundary, and the snake-consuming `normalize*` in `lib/approval-bff.ts` migrate in lockstep.

---

## 0. The I-3 flip — the central risk for this domain (read first)

Today **every** approval client call uses `fetchInfraJson` (raw passthrough, **no** `camelCaseKeys`), then runs the result through a hand-written `normalize*` in `lib/approval-bff.ts`. Those normalizers are **snake→snake**: they read snake wire keys (`record.target_source_id`, `record.requested_by`, `record.status`, `record.processed_by`) **and emit snake domain DTOs** (`target_source_id`, `requested_by`, …). The UI then reads snake off those DTOs (e.g. `response.request?.requested_at`).

`fetchInfra*` boundary (`app/lib/api/infra.ts`):
- `fetchInfraJson<T>` → `fetchJson<T>` — **raw**, returns wire as-is (snake).
- `fetchInfraCamelJson<T>` → `camelCaseKeys(await fetchInfraJson<T>())` — the camel boundary.

**Decision (matches PLAN §2 D1/D2 + I-3):** migrate every approval read/write to `fetchInfraCamelJson` (or zod-parse `camelCaseKeys(...)` per D4), delete the snake→snake `normalize*` shims, and re-point both the `app/lib/api/index.ts` mappers and the Step2 UI readers to **camelCase domain fields**. This is a 3-layer lockstep change per endpoint:

```
WIRE (snake, swagger)  →  camelCaseKeys @ boundary  →  DOMAIN (camel)  →  UI reads camel
```

A half-migration (flip boundary but leave snake normalizer) silently produces empty fields — `normalizeApprovalRequestSummary` reading `record.target_source_id` on a camel `{targetSourceId}` payload returns `undefined`. **The normalizer change and the boundary change must land in the same commit.**

`normalize*` functions to **retire** (snake-in/snake-out, all in `lib/approval-bff.ts`): `normalizeApprovalRequestSummary`, `normalizeApprovalActionResponse`, `normalizeApprovalHistoryPage` + its helper `buildApprovalHistoryPage`. (`normalizeApprovalRequestBody` is a **request** builder — see §2.1, it stays but its output casing is re-confirmed against swagger.) The snake DTO interfaces `ApprovalRequestSummaryDto`/`ApprovalActionResponseDto`/`ApprovalHistoryItemDto`/`ApprovalHistoryPageDto` in `lib/approval-bff.ts` are replaced by camel wire/domain types (§3).

> Note: `normalizeApprovedIntegration`, `normalizeConfirmedIntegration`, `normalizeProcessStatusResponse` also live in `lib/approval-bff.ts` but belong to **other** domains (approved-integration / confirmed-integration / process-status). They are **out of scope** for D-approval — do not touch them here.

---

## 1. Endpoint inventory (verbatim from swagger)

Path prefix in code: `CONFIRM_BASE = '/target-sources'` (`app/lib/api/index.ts:274`). Internal proxy prefix `/integration/api/v1` (`lib/infra-api.ts:1`) ↔ upstream `/install/v1` (`lib/infra-api.ts:2`). So `${CONFIRM_BASE}/${id}/approval-requests` resolves to swagger `/install/v1/target-sources/{targetSourceId}/approval-requests`. **All 6 existing paths already match swagger verbatim** — no path edits.

| # | Method | Path (`/install/v1` prefix) | operationId | Request | 200 Response | swagger lines |
|---|--------|------------------------------|-------------|---------|--------------|---------------|
| 1 | POST | `…/{targetSourceId}/approval-requests` | createApprovalRequest | `ApprovalRequestInputDto` (req) | `ApprovalRequestSummaryDto` | 1022–1097 |
| 2 | POST | `…/{targetSourceId}/approval-requests/reject` | rejectApprovalRequest | `ApprovalRejectRequestDto` (req) | `ApprovalActionResponseDto` | 1098–1173 |
| 3 | POST | `…/{targetSourceId}/approval-requests/cancel` | cancelApprovalRequest | — (no body) | `ApprovalActionResponseDto` | 1174–1243 |
| 4 | POST | `…/{targetSourceId}/approval-requests/approve` | approveApprovalRequest | `ApprovalApproveRequestDto` (**body optional**) | `ApprovalActionResponseDto` | 1244–1318 |
| 5 | GET | `…/{targetSourceId}/approval-requests/latest` | getLatestApprovalRequest | — | `ApprovalRequestLatestDto` | 3384–3453 |
| 6 | GET | `…/{targetSourceId}/approval-history` | getApprovalHistory | query `page` (int32, def 0), `size` (int32, def 10) | `Page` (content items **untyped**) | 3454–3541 |
| 7 | POST | `…/{targetSourceId}/approval-unavailable` **(NEW)** | markApprovalRequestUnavailable | `ApprovalRejectRequestDto` (req) | `ApprovalUnavailableResponseDto` | 876–951 |
| 8 | POST | `…/{targetSourceId}/approval-unavailable/confirm` **(NEW)** | confirmApprovalUnavailable | — (no body) | `ApprovalUnavailableConfirmResponseDto` | 952–1021 |

Path param `targetSourceId`: `integer / int64`, required, all endpoints.
Every endpoint's error responses are uniformly `400/403/404/409/500/501/502/503` → `ErrorMessage` (swagger 4239+). `createApprovalRequest` adds business `409 "Conflict - pending request already exists"`; `cancel` adds `409 "… or applying in progress"`. These map to the existing `ProblemDetails` pipeline — no per-endpoint error typing needed.

> ⚠ **No `201`.** `createApprovalRequest` returns **`200`** ("Approval request created successfully", swagger 1092) despite "create" naming. Do not assume 201.

---

## 1.1 Exact schemas (every field, casing, required, enum — verbatim)

All response DTOs are **snake_case on the wire**. The shared `ApprovalStatus` enum (7 values) appears on every status field:

```
PENDING | APPROVED | AUTO_APPROVED | REJECTED | CANCELLED | UNAVAILABLE | UNAVAILABLE_ACKNOWLEDGED
```

> ⚠ **Enum drift vs current code.** `lib/approval-bff.ts:32` `ApprovalStatus` = `PENDING|APPROVED|AUTO_APPROVED|REJECTED|CANCELLED|UNAVAILABLE|CONFIRMED`. Swagger has **NO `CONFIRMED`** and **adds `UNAVAILABLE_ACKNOWLEDGED`**. The domain `ApprovalStatus` type must become the swagger 7-value set. `CONFIRMED` in the current code is a synthetic fold (`mapApprovalStatus` maps `CONFIRMED|COMPLETED → CONFIRMED`, line 198-200) — it is **not** a wire value; drop it from the approval-status enum. (Process status `CONFIRMED` is a separate concept owned by process-status, not approval.)

**`ActorDto`** (4570–4574):
```yaml
{ user_id?: string }
```
→ this is the ONLY reviewer/actor carrier. There is **no name / email / role** field — `user_id` is the sole identifier the 반려/요청 UI can show.

**`ApprovalRequestInputDto`** (4619–4626) — REQUEST body for #1:
```yaml
{ resources?: TargetSourceResourceItemDto[] }
```
⚠ This is the **new** request contract: a `resources` array of `TargetSourceResourceItemDto` (4636–4828). The current client request shape is completely different (`{ resource_inputs: [...] }`, `normalizeApprovalRequestBody`) — see §2.1 for the reconciliation.

**`TargetSourceResourceItemDto`** (4636–4712), `required: [metadata]`:
```yaml
selected?: boolean
metadata: TargetSourceResourceMetadataDto      # required
resource_id?: string
resource_name?: string
resource_type?: enum(<50 values: AWS_*, AZURE_*, GCP_*, IDC_RESOURCE>)   # 4651-4698
integration_category?: enum(TARGET | NO_INSTALL_NEEDED | INSTALL_INELIGIBLE)
recommend_fail_reason?: enum(GCP_CLOUD_SQL_HAS_PUBLIC_IP | GCP_CLOUD_SQL_HAS_INTERNAL_HTTP_LOAD_BALANCER_SUBNET | AZURE_RESOURCE_PRIVATE_ENDPOINT_CONNECTION_FAILED)
exclusion_reason?: string
```
**`TargetSourceResourceMetadataDto`** (4713–4828) — large, snake-dominant but with **camel exceptions**: `networkInterfaces` (camel; array of `NetworkInterfaceDto`). `NetworkInterfaceDto` (4627–4635) is **fully camel**: `{ networkInterfaceId?, ipConfigurationName?: string[] }`. The rest are snake: `provider`(enum AWS|GCP|AZURE|IDC|UNKNOWN), `region`, `host`, `port`(int32), `resource_type`(same enum), `database_type`, `oracle_service_id`, `credential_id`, `network_interface_id`, `ip_configuration`, `project_id`, `instance_name`, `host_network`, `host_project`, `cloud_sql_type`, `subscription_id`, `resource_group`, `server_name`, `idc_host_format`(enum IP|HOST), `idc_ips`(string[]), `idc_host`, `idc_source_ips`(string[]), `nlb_index`(int32). → **mixed-casing object**; flag for camelCaseKeys handling (§2.1, request side — D3).

**`ApprovalRequestSummaryDto`** (4829–4858) — response for #1, and the `request` field of #5:
```yaml
id?: integer(int64)
target_source_id?: integer(int64)
status?: ApprovalStatus
requested_by?: ActorDto
requested_at?: string(date-time)
resource_total_count?: integer(int32)
resource_selected_count?: integer(int32)
```

**`ApprovalActionResponseDto`** (4859–4881) — response for #2/#3/#4, and `result` field of #5:
```yaml
request_id?: integer(int64)
status?: ApprovalStatus
processed_by?: ActorDto
processed_at?: string(date-time)
reason?: string
```

**`ApprovalApproveRequestDto`** (4882–4887) — REQUEST body for #4 (optional):
```yaml
{ comment?: string }
```

**`ApprovalRejectRequestDto`** (4560–4569) — REQUEST body for #2 and #7, `required: [reason]`:
```yaml
{ reason: string (maxLength 1000, minLength 0) }   # required
```

**`ApprovalRequestLatestDto`** (5702–5712) — response for #5:
```yaml
request?:   ApprovalRequestSummaryDto
resources?: TargetSourceResourceItemDto[]      # ⚠ NEW field vs current code
result?:    ApprovalActionResponseDto
```
⚠ Current `ApprovalRequestLatestResponse` (`app/lib/api/index.ts:569`) has only `{request, result}` and **omits `resources[]`**. Swagger adds it. See §3.5.

**`Page`** (5713–5746) — response for #6, **flat Spring page**:
```yaml
totalPages?: int32
totalElements?: int64
pageable?:  PageableObject        # (5077) camelCase: paged,pageNumber,pageSize,unpaged,offset,sort
first?: boolean
last?: boolean
size?: int32
content?: object[]                # ⚠ items: { type: object } — UNTYPED
number?: int32
sort?: SortObject[]               # (5104) camelCase: direction,nullHandling,ascending,property,ignoreCase
numberOfElements?: int32
empty?: boolean
```
⚠ Two contract facts: (a) `Page` keys + `PageableObject`/`SortObject` are **camelCase on the wire** (Spring serializes pagination metadata camel) — `camelCaseKeys` is a no-op on them, which is correct. (b) `content[]` is **untyped** (`type: object`) — the swagger does **not** define the approval-history item shape. See §3.6 for how to type it.

**`ApprovalUnavailableResponseDto`** (4575–4597) — response for #7 **(NEW)**:
```yaml
request_id?: integer(int64)
status?: ApprovalStatus              # 7-value enum
processed_by?: ActorDto
processed_at?: string(date-time)
reason?: string
```
(Structurally identical to `ApprovalActionResponseDto`, but a distinct named DTO — keep separate type for D6 greppability.)

**`ApprovalUnavailableConfirmResponseDto`** (4598–4618) — response for #8 **(NEW)**:
```yaml
target_source_id?: integer(int64)
confirm_status?: enum(IDLE | PENDING | UNAVAILABLE | CONFIRMING | RESOURCE_CLEANING | RESOURCE_CLEAN_FAILED | CONFIRMED)
processed_at?: string(date-time)
confirmed_by?: string              # ⚠ plain string, NOT ActorDto
```
⚠ `confirm_status` is a **distinct 7-value enum** (process-confirm lifecycle), unrelated to `ApprovalStatus`. `confirmed_by` is a bare `string`, not an `ActorDto`.

---

## 2. Current code map (paths + symbols)

### 2.1 `app/lib/api/index.ts` — client functions
| Symbol | Lines | Endpoint | Today | Migration |
|--------|-------|----------|-------|-----------|
| `createApprovalRequest` | 373–394 | #1 | `fetchInfraJson` → `normalizeApprovalRequestSummary`; **body** = `normalizeApprovalRequestBody(input)` (`{resource_inputs:[...]}`) | flip to camel boundary; **request body reconcile** (see ⚠ below); map summary from camel |
| `getApprovedIntegration` | 427–456 | (other domain) | — | **out of scope** (approved-integration) |
| `getApprovalHistory` | 483–528 | #6 | `fetchInfraJson` → `normalizeApprovalHistoryPage`; discards `input_data.resource_inputs` (always `[]`) | flip; type `content[]`; map camel |
| `approveApprovalRequestV1` | 530–546 | #4 | `fetchInfraJson` POST `{comment}` → `normalizeApprovalActionResponse` | flip; body `{comment?}` per swagger |
| `rejectApprovalRequestV1` | 548–565 | #2 | `fetchInfraJson` POST `{reason}` → `normalizeApprovalActionResponse` | flip; body `{reason}` (required) |
| `getApprovalRequestLatest` | 588–595 | #5 | `fetchInfraJson<ApprovalRequestLatestResponse>` **`as T`, NO normalizer**, snake type | **D4 zod or camel type**; add `resources[]`; UI re-point (§3.5) |
| `cancelApprovalRequest` | 597–606 | #3 | `fetchInfraJson` POST, **ignores body**, returns `{success}` | response is `ApprovalActionResponseDto` — surface it (§3.3) |
| `systemResetApprovalRequest` | 608–617 | (no swagger) | `fetchInfraJson` POST | **discrepancy** — §5 |
| Type `ApprovalRequestResult` | 335–343 | #1 domain | camel already (`targetSourceId`, `requestedAt`, `requestedBy`…) | keep; source from camel summary |
| Type `ApprovalHistoryResponse` | 458–481 | #6 domain | nested `{content[], page{}}`, snake item fields | keep public shape; remap from camel |
| Type `ApprovalRequestLatestResponse` | 569–586 | #5 domain | **snake** (`target_source_id`, `requested_by{user_id}`, `request_id`); no `resources` | → camel + add `resources` (§3.5) |

⚠ **`createApprovalRequest` request-body reconciliation (the one genuinely hard spot).** Swagger `ApprovalRequestInputDto = { resources: TargetSourceResourceItemDto[] }`. Current code builds `{ resource_inputs: ApprovalRequestResourceInput[] }` via `normalizeApprovalRequestBody` (and the mock `createApprovalRequest` at `confirm.ts:417` *consumes* `normalizeApprovalRequestBody(body)`). These are **two different request contracts**. Options:
- **(A) Adopt swagger now**: change the client to POST `{ resources: TargetSourceResourceItemDto[] }`, update the mock to read `body.resources`, rewrite `normalizeApprovalRequestBody` → a `resources`-builder. Largest blast radius (touches Step1→Step2 "승인 요청" callers that assemble `resource_inputs`).
- **(B) Defer body, migrate response only**: keep the `{resource_inputs}` request as a sanctioned out-of-contract shape **for this phase**, migrate only the **response** to camel. Flag the request-body divergence in the verification log as an open item gated on BFF confirmation that the BFF actually accepts `resources` (the mock is our only "BFF" today).
- **Recommendation: (B) for P5**, because (i) the request casing/shape change is orthogonal to the I-3 *response* flip that defines this domain's migration, (ii) the swagger `ApprovalRequestInputDto` fields are mostly `?optional` with only `metadata` required, so round-trip fidelity from the current selection UI is unverified, and (iii) PLAN §0 scopes this migration to *response↔adapter exactness*; a request-shape rewrite is a feature change. **Explicitly record (B) and the divergence**; do not silently keep the old shape — make it greppable (e.g. keep `normalizeApprovalRequestBody` named and add a `// ADR-019: out-of-contract request shape, pending BFF` marker, D6 spirit).

> If the user/BFF confirms `resources` is live, switch to (A) in the same PR; the response migration below is unchanged either way.

### 2.2 `lib/approval-bff.ts` — normalizers (retire per §0)
- Request: `normalizeApprovalRequestBody` (379–394) — **keep** (see §2.1); re-confirm output casing matches whichever request contract (A/B) is chosen.
- Retire: `normalizeApprovalRequestSummary` (396–427), `normalizeApprovalActionResponse` (429–451), `normalizeApprovalHistoryPage` (486–510), `buildApprovalHistoryPage` (453–484).
- Retire snake DTO types: `ApprovalRequestSummaryDto` (82–90), `ApprovalActionResponseDto` (92–98), `ApprovalHistoryItemDto` (100–103), `ApprovalHistoryPageDto` (105–124). Replace with camel wire+domain types (§3).
- `ApprovalStatus` (32–39) → swagger 7-value set (drop `CONFIRMED`, add `UNAVAILABLE_ACKNOWLEDGED`).
- `mapApprovalStatus` (184–204) — once boundary is camel and zod validates the enum, this string-folding mapper is redundant for approval; remove its `CONFIRMED/COMPLETED` fold. (Other callers? grep: only approval uses it — safe to retire with the normalizers.)

### 2.3 `lib/bff/http.ts` — upstream client methods
| Symbol | Lines | Note |
|--------|-------|------|
| `createApprovalRequest` | 239–240 | `post<unknown>('…/approval-requests', body)` — path OK |
| `getApprovalHistory` | 250–251 | path OK |
| `getApprovalRequestLatest` | 253–254 | path OK |
| `approveApprovalRequest` | 259–260 | path OK |
| `rejectApprovalRequest` | 262–263 | path OK |
| `cancelApprovalRequest` | 265–266 | `post('…/cancel', {})` — path OK |
| `systemResetApprovalRequest` | 268–269 | **not in swagger** — §5 |
| **(missing)** `markApprovalRequestUnavailable` | — | **ADD** #7 |
| **(missing)** `confirmApprovalUnavailable` | — | **ADD** #8 |

Interface in `lib/bff/types.ts:223–240` (`confirm: {...}`): currently all `Promise<unknown>`. Add `markApprovalRequestUnavailable(id, body): Promise<unknown>` and `confirmApprovalUnavailable(id): Promise<unknown>`; optionally tighten return types to the camel domain types (§3) once D4 zod lands.

### 2.4 Mocks — `lib/bff/mock/confirm.ts` (mock-adapter wires at `lib/bff/mock-adapter.ts:222`)
| Mock handler | Lines | Wire shape today | Target (swagger snake) |
|--------------|-------|------------------|------------------------|
| `createApprovalRequest` | 373–~690 | reads `normalizeApprovalRequestBody(body)`; returns summary-ish | emit `ApprovalRequestSummaryDto` snake (§4.1) |
| `getApprovalHistory` | 756–914 | `{content:[{request{...},result{...}}], page:{...}}` nested; item uses `result:`/`process_info{user_id,reason}` (legacy) | emit **flat `Page`** with camel meta + content items in agreed shape (§4.6) |
| `getApprovalRequestLatest` | 916–997 | `{request{snake},result{snake}}`, **no `resources`** | emit `ApprovalRequestLatestDto` snake incl. `resources[]` (§4.5) |
| `approveApprovalRequest` | 1102–1185 | returns `{success,result:'APPROVED',processed_at}` (legacy custom) | emit `ApprovalActionResponseDto` snake (§4.2) |
| `rejectApprovalRequest` | 1187–1248 | returns `{success,result:'REJECTED',processed_at,reason}` (legacy custom) | emit `ApprovalActionResponseDto` snake w/ `processed_by`,`reason` (§4.2, rejected example) |
| `cancelApprovalRequest` | 1250–1343 | returns `{success,result:'CANCELLED',processed_at}` | emit `ApprovalActionResponseDto` snake (§4.2) |
| `systemResetApprovalRequest` | 1345–1413 | returns `{success,result:'CANCELLED',…,reason:'system-reset'}` | §5 |
| **(missing)** `markApprovalRequestUnavailable` | — | — | **ADD** → `ApprovalUnavailableResponseDto` snake (§4.7) |
| **(missing)** `confirmApprovalUnavailable` | — | — | **ADD** → `ApprovalUnavailableConfirmResponseDto` snake (§4.8) |

Rejection state stored on the project: `confirm.ts:1224` (`approval:{status:'REJECTED',rejectedAt,rejectionReason}`) + `1232-1234` (`isRejected,rejectionReason,rejectedAt`). Reviewer for the latest/history mock = `historyItem.actor` (`{id,name}`) via `mockHistory.addRejectionHistory(id, {id,name}, reason)` (`confirm.ts:1237`).

> ⚠ **Mock authors a legacy custom shape today, NOT the swagger wire.** The POST mocks return `{success, result, processed_at}` and the normalizer bridges via `record.status ?? record.result` and `process_info`. Per PLAN §2 mock-parity decision, mocks must emit the **swagger snake DTO** and route through the same `camelCaseKeys` boundary as `httpBff`. After migration the `success`/`result`/`process_info` legacy keys are **gone**.

### 2.5 Route handlers (`app/integration/api/v1/.../approval-requests/`)
| Route | File | Today | Migration |
|-------|------|-------|-----------|
| `latest` GET | `…/latest/route.ts` | `NextResponse.json(await bff.confirm.getApprovalRequestLatest(id))` — pass-through | with camel boundary in `bff.confirm.*` this returns camel; **or** keep route thin + camelize in the client (decide one boundary — §3.0) |
| `cancel` POST | `…/cancel/route.ts` | ⚠ **discards** cancel response; re-fetches `getApprovalHistory(id,0,1)`, `normalizeApprovalHistoryPage`, returns `content[0]?.result`; fallback `normalizeApprovalActionResponse(payload,{fallbackStatus:'CANCELLED'})` | with swagger cancel returning `ApprovalActionResponseDto` directly, **drop the history re-fetch** and return the (camelized) cancel response; remove `normalize*` import |
| `system-reset` POST | `…/system-reset/route.ts` | `normalizeApprovalActionResponse(payload,{fallbackStatus:'CANCELLED'})` | §5 (keep-as-dev-helper or drop) |
| **(missing)** `approval-unavailable` POST | — | — | **ADD** route #7 |
| **(missing)** `approval-unavailable/confirm` POST | — | — | **ADD** route #8 |

> ⚠ The `cancel` route's history-re-fetch workaround exists because the BFF cancel body was thin. Swagger now specifies cancel → `ApprovalActionResponseDto`, so the workaround can be deleted — but **verify the BFF actually populates** `status/processed_by/processed_at` on cancel before removing the fallback. If unverified, keep a `fallbackStatus:'CANCELLED'` guard (without the history re-fetch).

### 2.6 Step2 UI consumers (read-only display; reviewer/반려 fields)
| Component | File | Reads | After migration |
|-----------|------|-------|-----------------|
| `RejectionAlert` | `…/_components/common/RejectionAlert.tsx` | `project.isRejected/rejectionReason/rejectedAt` (from **`TargetSource`**, not approval API) | **no change** — sourced from `TargetSource` domain (target-source-response / getProject), independent of the approval endpoints |
| `IdcStep2WaitingApproval` | `…/_components/idc/steps/IdcStep2WaitingApproval.tsx` | renders `RejectionAlert`; `useIdcResources`; `WaitingApprovalCancelButton` | cancel button → #3 (camel) |
| `WaitingApprovalCard` | `…/_components/layout/WaitingApprovalCard.tsx:67-72,106-113` | #5 latest: `response.request?.requested_at`, `response.request?.requested_by?.user_id` (**snake**) | re-point to **camel**: `response.request?.requestedAt`, `response.request?.requestedBy?.userId` |
| `ApprovalApplyingBanner` | `…/process-status/ApprovalApplyingBanner.tsx:19` | #5 latest: `latestResponse?.request?.resource_selected_count` (**snake**) | → `latestResponse?.request?.resourceSelectedCount` |
| `WaitingApprovalCancelButton` | `…/_components/layout/WaitingApprovalCancelButton.tsx` | calls `cancelApprovalRequest`; only needs `{success}` | unaffected by response-shape change (still derive success) |

> **반려 UI field availability (PLAN §5 / ref §4.3):** the reference UI wants 상태 배지 + 반려 사유 + 반려일시 + 검토자(ID). Sources after migration:
> - 반려 사유 / 반려일시 / isRejected → **`TargetSource`** (`rejectionReason`/`rejectedAt`/`isRejected`) — already wired, unchanged.
> - 검토자(reviewer ID) → only available via **#5 latest** `result.processed_by.user_id` (or #6 history `content[].result.processed_by.user_id`). `ActorDto` carries **`user_id` only** (no name). `TargetSource` does **not** currently carry a reviewer field. **Gap:** if the 반려 UI must show the reviewer ID, wire `WaitingApprovalCard`/`RejectionAlert` to read `result.processedBy.userId` from #5, OR add a `reviewer` field to `TargetSource`. Flag for the Step2 반려 UI owner. The new endpoints (#7/#8) also expose `processed_by`/`confirmed_by` for the unavailable path.

---

## 3. Per-endpoint Response → Adapter → UI mapping (target, camel)

**§3.0 Boundary decision (one place).** Pick the camel boundary **at the client function** (`app/lib/api/index.ts`) by switching `fetchInfraJson` → `fetchInfraCamelJson` (or zod-parse `camelCaseKeys(...)` for D4 endpoints). Route handlers (`latest`, `cancel`, …) then stay thin pass-throughs of whatever `bff.confirm.*` returns. Do **not** camelize twice (route + client). Since the existing `bff.confirm.*` returns raw and routes already `NextResponse.json(...)` it, the camelization belongs in the client layer that the UI calls — consistent with D1 "one boundary".

Wire→domain field map (snake→camel) is mechanical via `camelCaseKeys`; the table below records the **domain (camel) fields the UI must read** and any reshape.

### 3.1 createApprovalRequest (#1) → `ApprovalRequestSummaryDto`
Wire (snake) → domain (camel): `id`, `targetSourceId`, `status`, `requestedBy{userId}`, `requestedAt`, `resourceTotalCount`, `resourceSelectedCount`.
Adapter `createApprovalRequest` → public `ApprovalRequestResult` (already camel): `id:String(s.id)`, `targetSourceId:s.targetSourceId ?? id`, `status:s.status ?? 'PENDING'`, `requestedAt:s.requestedAt ?? ''`, `requestedBy:s.requestedBy?.userId ?? ''`, `resourceTotalCount`, `resourceSelectedCount`. (Request body: §2.1.)

### 3.2 reject/approve (#2/#4) → `ApprovalActionResponseDto`
Domain camel: `requestId`, `status`, `processedBy{userId}`, `processedAt`, `reason`. Public adapters unchanged shape: reject → `{success:true, result:status??'REJECTED', processedAt, reason}`; approve → `{success:true, result:status??'APPROVED', processedAt}`. (Adapters synthesize `success` — there is no `success` field in the swagger DTO; that's a client convenience, keep it.)

### 3.3 cancel (#3) → `ApprovalActionResponseDto`
⚠ Today the client ignores the body (`{success:true}`) and the **route** does the history-re-fetch. Swagger gives a real `ApprovalActionResponseDto`. Target: client returns `{success:true, status:resp.status??'CANCELLED', processedAt}`; route drops the history re-fetch (§2.5). `WaitingApprovalCancelButton` only needs `success` — keep deriving it.

### 3.4 (reserved — approve covered in 3.2)

### 3.5 getLatestApprovalRequest (#5) → `ApprovalRequestLatestDto`
Domain camel:
```ts
{ request?: ApprovalRequestSummary(camel),
  resources?: TargetSourceResourceItem(camel)[],   // NEW — add to ApprovalRequestLatestResponse
  result?: ApprovalActionResponse(camel) }
```
UI re-point: `WaitingApprovalCard` `toRequestSummary` → `response.request?.requestedAt` / `response.request?.requestedBy?.userId`; `ApprovalApplyingBanner` → `latestResponse?.request?.resourceSelectedCount`. **Reviewer**: `response.result?.processedBy?.userId` now available — wire into 반려 UI if required (§2.6 gap). `resources[]` is newly present; it can back the waiting table directly (today the table is sourced from `getApprovedIntegration`) — **do not silently switch the table source**; just expose the field and note it for the Step2 owner.
**D4:** this is a PLAN-listed high-risk response → `schema.parse(camelCaseKeys(data))` with a zod schema for `ApprovalRequestLatestDto` (request/resources/result), retiring `as T` at `index.ts:592`.

### 3.6 getApprovalHistory (#6) → `Page`
The wire `Page` is flat + camel meta (`totalPages/totalElements/pageable/first/last/size/content/number/sort/numberOfElements/empty`). `content[]` is **untyped in swagger** → we own the item type. Current code treats each item as `{request: ApprovalRequestSummary, result?: ApprovalActionResponse}` and the **public** `ApprovalHistoryResponse` (`index.ts:458`) re-nests it as `{content:[{request{snake...,input_data},result?{...,process_info}}], page:{totalElements,totalPages,number,size}}`.
Target:
- Define `ApprovalHistoryItem = { request: ApprovalRequestSummary(camel); result?: ApprovalActionResponse(camel) }` as the **agreed** `content[]` shape (documented as an out-of-swagger contract, since swagger leaves it `object`). Mark greppably (e.g. type name `ApprovalHistoryContentItem` + comment "swagger Page.content is untyped; shape agreed with BFF").
- Map flat `Page` → public `ApprovalHistoryResponse`: `content[].request` from camel summary; `content[].result` from camel action; `page:{ totalElements, totalPages, number, size }` from flat fields. **Drop** the legacy `input_data` synthesis (already always `[]` at `index.ts:502-504`) and the `process_info`/`result`-named result fields — they were normalizer artifacts.
- `requested_by`/`processed_by` map to `requestedBy.userId`/`processedBy.userId`.

### 3.7 markApprovalRequestUnavailable (#7, NEW) → `ApprovalUnavailableResponseDto`
Domain camel: `requestId`, `status` (incl. `UNAVAILABLE`), `processedBy{userId}`, `processedAt`, `reason`. New client `markApprovalRequestUnavailable(id, {reason})`; request body `ApprovalRejectRequestDto {reason}` (reason **required**). Consumer: admin "연동 불가 판정" action (ref §11 admin / or Step2 flow where an operator marks unavailable). Wire via http.ts + mock + route + `bff.confirm.*` type. **D4 optional** (low-risk action response) — at minimum camel boundary, no `as T`.

### 3.8 confirmApprovalUnavailable (#8, NEW) → `ApprovalUnavailableConfirmResponseDto`
Domain camel: `targetSourceId`, `confirmStatus` (7-value confirm enum), `processedAt`, `confirmedBy` (**string**). No request body. Consumer: Step2 "반려/불가 확인" → returns target to initial state then routes to Step1 (ref §4: `approval-unavailable/confirm` → Step1). New client `confirmApprovalUnavailable(id)`; http.ts + mock + route + type. After success the Step2 component calls `onProjectUpdate(await getProject(id))` (same pattern as `WaitingApprovalCancelButton`).

---

## 4. Mock wire responses (swagger snake — authored to pass through `camelCaseKeys`)

All examples are **snake_case** (the wire); after the P1 boundary they auto-camelize. Each is a literal `…Dto` instance.

### 4.1 createApprovalRequest → `ApprovalRequestSummaryDto`
```json
{ "id": 1024, "target_source_id": 42, "status": "PENDING",
  "requested_by": { "user_id": "alice@corp" }, "requested_at": "2026-06-23T04:10:00Z",
  "resource_total_count": 5, "resource_selected_count": 3 }
```

### 4.2 approve / reject / cancel → `ApprovalActionResponseDto`
approve:
```json
{ "request_id": 1024, "status": "APPROVED",
  "processed_by": { "user_id": "admin@corp" }, "processed_at": "2026-06-23T05:00:00Z" }
```
**rejected example (reviewer + reason + timestamp):**
```json
{ "request_id": 1024, "status": "REJECTED",
  "processed_by": { "user_id": "admin@corp" }, "processed_at": "2026-06-23T05:01:00Z",
  "reason": "RDS_CLUSTER 리소스는 현재 지원되지 않습니다. RDS 단일 인스턴스만 선택해주세요." }
```
cancel:
```json
{ "request_id": 1024, "status": "CANCELLED",
  "processed_by": { "user_id": "alice@corp" }, "processed_at": "2026-06-23T05:02:00Z" }
```
> Mock must read the rejection reason/timestamp/actor from project state (`confirm.ts:1224`,`1233-1234`) + `mockHistory` actor, and emit them under `processed_by.user_id` / `reason` / `processed_at` (NOT the legacy `process_info`/`result`).

### 4.5 getLatestApprovalRequest → `ApprovalRequestLatestDto` (rejected, with resources)
```json
{
  "request": { "id": 1024, "target_source_id": 42, "status": "REJECTED",
    "requested_by": { "user_id": "alice@corp" }, "requested_at": "2026-06-23T04:10:00Z",
    "resource_total_count": 5, "resource_selected_count": 3 },
  "resources": [
    { "selected": true, "resource_id": "arn:…:db-1", "resource_name": "orders-db",
      "resource_type": "AWS_DB_INSTANCE", "integration_category": "TARGET",
      "metadata": { "provider": "AWS", "region": "ap-northeast-2", "resource_type": "AWS_DB_INSTANCE",
        "database_type": "MYSQL", "port": 3306, "host": "orders.xxx.rds.amazonaws.com" } }
  ],
  "result": { "request_id": 1024, "status": "REJECTED",
    "processed_by": { "user_id": "admin@corp" }, "processed_at": "2026-06-23T05:01:00Z",
    "reason": "RDS_CLUSTER 리소스는 현재 지원되지 않습니다. RDS 단일 인스턴스만 선택해주세요." }
}
```
(Pending variant: `request.status:"PENDING"`, omit `result` or `result.status:"PENDING"`, `result.reason:null`.)

### 4.6 getApprovalHistory → flat `Page`
```json
{
  "totalPages": 1, "totalElements": 2,
  "pageable": { "paged": true, "pageNumber": 0, "pageSize": 10, "unpaged": false, "offset": 0, "sort": [] },
  "first": true, "last": true, "size": 10, "number": 0, "numberOfElements": 2, "empty": false,
  "sort": [],
  "content": [
    { "request": { "id": 1024, "target_source_id": 42, "status": "REJECTED",
        "requested_by": { "user_id": "alice@corp" }, "requested_at": "2026-06-23T04:10:00Z",
        "resource_total_count": 5, "resource_selected_count": 3 },
      "result": { "request_id": 1024, "status": "REJECTED",
        "processed_by": { "user_id": "admin@corp" }, "processed_at": "2026-06-23T05:01:00Z",
        "reason": "RDS_CLUSTER 미지원" } },
    { "request": { "id": 1025, "target_source_id": 42, "status": "APPROVED",
        "requested_by": { "user_id": "alice@corp" }, "requested_at": "2026-06-23T06:00:00Z",
        "resource_total_count": 4, "resource_selected_count": 4 },
      "result": { "request_id": 1025, "status": "APPROVED",
        "processed_by": { "user_id": "admin@corp" }, "processed_at": "2026-06-23T06:05:00Z" } }
  ]
}
```
> `pageable`/`sort` keys stay camel (Spring). `content[]` item shape is the agreed `{request, result?}` (§3.6) — documented as out-of-swagger.

### 4.7 markApprovalRequestUnavailable → `ApprovalUnavailableResponseDto` (NEW)
```json
{ "request_id": 1024, "status": "UNAVAILABLE",
  "processed_by": { "user_id": "admin@corp" }, "processed_at": "2026-06-23T07:00:00Z",
  "reason": "온프레미스 방화벽 정책상 연동 불가" }
```

### 4.8 confirmApprovalUnavailable → `ApprovalUnavailableConfirmResponseDto` (NEW)
```json
{ "target_source_id": 42, "confirm_status": "IDLE",
  "processed_at": "2026-06-23T07:10:00Z", "confirmed_by": "alice@corp" }
```
> Mock must add a `status:'UNAVAILABLE'` path (project state) before #8 is reachable; #8 then resets the project to initial (mirror `systemResetApprovalRequest` reset at `confirm.ts:1384-1403`) and returns `confirm_status:'IDLE'`.

---

## 5. Discrepancies (must resolve in `contract-verification.md`)

1. **`approval-requests/system-reset` — ABSENT in swagger.** Present in client (`index.ts:608`), http.ts (`268`), mock (`confirm.ts:1345`), route (`…/system-reset/route.ts`), type (`types.ts:234`). It is a dev/recovery helper that resets a REJECTED/UNAVAILABLE request to CANCELLED.
   - **Recommendation: KEEP as an explicitly out-of-contract dev helper**, NOT migrated to the swagger boundary (it has no contract to match). Mark it greppably as out-of-contract (D6 spirit: a comment + isolated naming) and **do not** route it through the new zod/camel pipeline. **Functional overlap:** the NEW `approval-unavailable/confirm` (#8) covers the UNAVAILABLE→initial reset path that swagger sanctions; if product confirms #8 (+ cancel for REJECTED) fully replaces system-reset, **drop** system-reset in P7 cleanup. Until confirmed, keep. Record the decision + the #8 overlap in the verification log.

2. **NEW `approval-unavailable` (#7) & `approval-unavailable/confirm` (#8).** No client / http.ts / mock / route / Step2 wiring today (verified: only swagger schema references exist). Full-stack add required (§2.3–2.5, §3.7–3.8, §4.7–4.8).

3. **`createApprovalRequest` request body mismatch.** Swagger `{ resources: TargetSourceResourceItemDto[] }` vs current `{ resource_inputs: ApprovalRequestResourceInput[] }`. → §2.1 decision (B recommended for P5; flag + verify BFF).

4. **`ApprovalStatus` enum drift.** Code has `CONFIRMED` (synthetic), swagger has `UNAVAILABLE_ACKNOWLEDGED`. Adopt swagger 7-value set; drop `CONFIRMED` from approval-status; verify BFF emits `UNAVAILABLE_ACKNOWLEDGED` somewhere (the unavailable-confirm path).

5. **`Page.content[]` untyped.** Swagger leaves approval-history items as `type: object`. We define `ApprovalHistoryItem={request,result?}` as an agreed out-of-swagger shape — record it; ask BFF to confirm the real item fields.

6. **`getApprovalRequestLatest` `resources[]` newly present** (swagger 5707) but absent in current `ApprovalRequestLatestResponse`. Add the field; decide whether the waiting table should source from it vs the current `getApprovedIntegration` (do not switch silently).

7. **`cancel` route history-re-fetch workaround.** Removable once BFF populates `ApprovalActionResponseDto` on cancel — verify before deleting; else keep `fallbackStatus:'CANCELLED'` (without the re-fetch).

8. **반려 UI reviewer gap.** Reviewer ID is only on `result.processed_by.user_id` (#5/#6); `TargetSource` has no reviewer field. If the 반려 UI must show 검토자, wire from #5 or add `TargetSource.reviewer`. `ActorDto` has **no name/email** — only `user_id`.

9. **Mock returns legacy custom shape** (`{success,result,process_info}`) not swagger DTOs — must rewrite all approval mocks to swagger snake (§4) per PLAN §2 mock-parity. The legacy keys disappear with the normalizers.

10. **`createApprovalRequest` returns 200, not 201** (swagger 1092) — ensure no caller/route asserts 201.

---

## 6. Self-review (3 passes)

**Review 1: clean** — checked all 8 paths char-for-char against swagger (876, 952, 1022, 1098, 1174, 1244, 3384, 3454) incl. `targetSourceId` int64 param; confirmed `createApprovalRequest`→200 (not 201); confirmed request bodies: #1 `ApprovalRequestInputDto`, #2/#7 `ApprovalRejectRequestDto`(reason required), #4 `ApprovalApproveRequestDto`(optional), #3/#8 none.

**Review 2: clean** — checked every response DTO field+casing+enum verbatim: `ActorDto.user_id` only (no name); `ApprovalStatus` 7 values incl. `UNAVAILABLE_ACKNOWLEDGED`, no `CONFIRMED`; `ApprovalRequestLatestDto` has `resources[]`; `Page` flat with camel `pageable`/`sort` and **untyped** `content[]`; `ApprovalUnavailableConfirmResponseDto.confirm_status` distinct 7-value enum + `confirmed_by:string`. Verified current code reads snake (`requested_at`,`requested_by.user_id`,`resource_selected_count`) at `WaitingApprovalCard.tsx:68-69`, `ApprovalApplyingBanner.tsx:19` and `getApprovalRequestLatest` uses `as T` (`index.ts:592`).

**Review 3: clean** — checked the I-3 flip lockstep: `fetchInfraJson`(raw) vs `fetchInfraCamelJson`(camel) at `infra.ts:12-22`; the 4 retiring normalizers + their snake DTO types in `lib/approval-bff.ts`; mock legacy shape `{success,result,process_info}` at `confirm.ts:1180-1184/1242-1247/1338-1342` vs target swagger snake; `system-reset` absent in swagger (verified grep) but present in 5 code sites; `approval-unavailable`(#7/#8) absent everywhere but swagger schemas; cancel route re-fetch at `cancel/route.ts:18-34`. All mock examples are valid instances of their `…Dto`. No contract findings remain.

---

## 7. Build checklist (P5)
1. Foundation (P1, prereq): `camelCaseKeys` boundary + (if used) zod/D6 helpers present.
2. Retire snake normalizers (§2.2) **with** boundary flip to `fetchInfraCamelJson`/zod in `app/lib/api/index.ts` (§2.1) — same commit.
3. Re-point UI snake→camel: `WaitingApprovalCard`, `ApprovalApplyingBanner` (§2.6).
4. `ApprovalStatus` → swagger 7-value; `ApprovalRequestLatestResponse` → camel + `resources[]`.
5. Add #7/#8: http.ts (§2.3), `bff.confirm` type (`types.ts`), mock (§4.7/4.8 + UNAVAILABLE state path), routes (§2.5), client fns (§3.7/3.8), Step2 wiring (confirm → `getProject` refresh).
6. Rewrite all approval mocks → swagger snake (§4); make mock==wire.
7. `cancel` route: drop history re-fetch (verify BFF first) (§2.5/§5.7).
8. Decide system-reset keep/drop (§5.1) — record.
9. zod on #5 (D4); no `as T` on migrated approval responses (D6).
10. `tsc`/`lint`/`test`/`build` green; per-endpoint codex+opus ≥3 clean; log every §5 item in `contract-verification.md`.
