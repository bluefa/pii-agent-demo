# GCP — Step Detail

Source-verified detail for the **GCP** (`serviceCode=gcp`) target-source detail page
(`/integration/target-sources/[targetSourceId]`), covering all 7 process steps.

This goes deeper than `docs/api/step-actions-and-apis.md`: every adapter hop is named
(file + function) and GCP-specific divergences from AWS/Azure are called out.

## How to read this doc

- **Layout dispatch.** The page resolves the cloud step component through
  `_components/layout/CloudTargetSourceLayout.tsx` → `renderStep()` switches on
  `project.processStatus` (`ProcessStatus` enum 1–7) → `<Step>.tsx`. GCP shares the
  **same** step components as AWS/Azure; only the install slot (step 4) branches to a
  GCP-specific component. There is **no** GCP-specific layout file.
- **Internal paths.** Client functions in `@/app/lib/api/*` build a path like
  `/gcp/target-sources/{id}/installation-status`; the transport prepends
  `INTERNAL_INFRA_API_PREFIX = '/integration/api/v1'`, so the browser request is
  `GET /integration/api/v1/gcp/target-sources/{id}/installation-status`, served by
  `app/integration/api/v1/gcp/target-sources/[targetSourceId]/installation-status/route.ts`.
  All paths below are the **internal** (browser-visible) paths.
- **Two-hop chain.** Every route handler calls `bff.<ns>.<fn>(...)` from
  `@/lib/bff/client`. `bff` is `mockBff` (`lib/bff/mock-adapter.ts`) when
  `USE_MOCK_DATA === 'true'`, otherwise `httpBff` (`lib/bff/http.ts`, real upstream).
  In mock mode the adapter `unwrap`s a `lib/bff/mock/<ns>.ts` dispatcher, which calls
  the deepest implementation in `lib/mock-*.ts`. This doc traces the **mock** chain
  (the running dev server) and names the real upstream path for each hop.
- **Transition semantics.** `ProcessStatusCard` (mounted at the top of every step) polls
  `getProcessStatus` only while status is **WAITING_APPROVAL (2)** or **APPLYING_APPROVED
  (3)** — `TIMINGS.PROCESS_STATUS_POLL_MS = 10_000` (10s). On a status change it calls
  `getProject` and `onProjectUpdate`, re-rendering the layout into the next step. All
  other steps advance via an explicit user action → `refreshProject()` (`getProject`
  refetch), not via polling. GCP **step 1 submit** (`createApprovalRequest`) →
  `refreshProject` → status flips to WAITING_APPROVAL.

## ID map (GCP column, used for the curl samples)

| step | status (enum) | id | seed project | resources |
|------|---------------|----|--------------|-----------|
| 1 | WAITING_TARGET_CONFIRMATION (1) | **1002** | `gcp-proj-1` | **`resources: []`** (empty base seed) |
| 2 | WAITING_APPROVAL (2) | 2007 | `gcp-proj-approval` | `gcpDemoResources` (3 target + 1 excluded) |
| 3 | APPLYING_APPROVED (3) | 2008 | `gcp-proj-applying` | `gcpDemoResources` |
| 4 | INSTALLING (4) | 2009 | `gcp-proj-installing` | `gcpDemoResources` |
| 5 | WAITING_CONNECTION_TEST (5) | 2010 | `gcp-proj-test` | `gcpDemoResources` |
| 6 | CONNECTION_VERIFIED (6) | 2011 | `gcp-proj-verified` | `gcpDemoResources` (selected → `CONNECTED`) |
| 7 | INSTALLATION_COMPLETE (7) | 2012 | `gcp-proj-complete` | `gcpDemoResources` (selected → `CONNECTED`) |

GCP seed: `lib/mock-data.ts` — base `gcp-proj-1` (`gcpProjectId: 'pii-agent-prod-12345'`,
**empty** `resources`); steps 2–7 are `cloneForStep('gcp-proj-1', …)` clones injected with
`gcpDemoResources` (4 rows, all `type: 'GCP_SQL'`, ids
`projects/sea-bdp-prd/locations/asia-northeast3/{services/bigquery/datasets/sea_bdp_prd | instances/sql-analytics-01 | instances/cloudsql-main | instances/cloudsql-stg-02}`).
For steps 6/7, `cloneForStep` flips selected `TARGET` rows `connectionStatus → 'CONNECTED'`.

> **GCP-specific seed note:** GCP step 1 (`1002`) renders **0 candidate rows** — its base
> seed has no resources (`curl …/1002/resources → {"resources":[],"total_count":0}`).
> Steps 2–7 use a separate demo set. All demo rows are `type: 'GCP_SQL'` (not the legacy
> `CLOUD_SQL`/`BIGQUERY`), which drives the deterministic install-step matrix below.

---

## Step 1 — WAITING_TARGET_CONFIRMATION (연동 대상 확정)

### 작업 내용

Scan-derived **candidate** Cloud SQL / BigQuery resources are listed; the admin selects
which to integrate and submits an approval request. Renders `ProcessStatusCard` (progress
bar) + an optional `GuideCard` slot + the candidate table. For GCP id `1002` the candidate
list is empty (seed has no resources), so the table shows the empty/scan state.

### Action(버튼) + API Call

| Action (button) | API call (method + internal path) | Transition |
|-----------------|-----------------------------------|------------|
| mount | `GET /integration/api/v1/target-sources/1002/resources` | load candidates |
| `"승인 요청"` (submit `IdcSubmitModal`) | `POST /integration/api/v1/target-sources/1002/approval-requests` | mutation |
| after submit | `GET /integration/api/v1/target-sources/1002` (`refreshProject`) | **→ WAITING_APPROVAL** |
| scan trigger (`Run Infra Scan`) | `POST /integration/api/v1/target-sources/1002/scan` | `startScan` (v1 API); polling `GET …/1002/scanJob/latest`. 완료 시 `handleScanComplete` → `getConfirmResources` 재조회 **+ `refreshProject` (`getProject`)** |
| fetch error `"다시 시도"` | `GET /integration/api/v1/target-sources/1002/resources` | `getConfirmResources` refetch |

Advance is **action→refetch**: on a successful `createApprovalRequest`, `refreshProject()`
runs `getProject`, `onProjectUpdate` re-renders the layout into step 2. No polling here.

### UI 컴포넌트

```
CloudTargetSourceLayout (renderStep → WAITING_TARGET_CONFIRMATION)
└─ WaitingTargetConfirmationStep.tsx
   ├─ ProjectPageMeta (_components/common)
   ├─ ProcessStatusCard            ← polling INACTIVE on step 1
   ├─ GuideCardContainer (slotKey via resolveStepSlot)
   ├─ CandidateResourceSection (_components/candidate)   ← owns fetch (useEffect + AbortController)
   │  ├─ CandidateResourceTable
   │  ├─ ScanController / ScanEmptyState / ScanRunningState / ScanErrorState
   │  └─ IdcSubmitModal (submit; reused cloud-wide) — useApiMutation(createApprovalRequest)
   └─ RejectionAlert
```
Data: `CandidateResourceSection` itself (no hook) — `getConfirmResources` in a
`useEffect`, mapped via `catalogToCandidates`. Submit via `useApiMutation` →
`createApprovalRequest` → `refreshProject`.

### API Client (`@/app/lib/api`, `app/lib/api/index.ts`)

- `getConfirmResources(id, { signal })` → `GET /target-sources/{id}/resources`
  (`fetchInfraCamelJson`, `CONFIRM_BASE = '/target-sources'`).
- `createApprovalRequest(id, input)` → `POST /target-sources/{id}/approval-requests`
  (`fetchInfraJson`, body normalized by `normalizeApprovalRequestBody`).
- `getProject(id)` → `GET /target-sources/{id}` (`fetchInfraCamelJson`).

### Adapter 계층 (full chain)

`getConfirmResources` (read candidates):
1. `app/lib/api/index.ts :: getConfirmResources` → `fetchInfraCamelJson('/target-sources/{id}/resources')`
2. route `app/integration/api/v1/target-sources/[targetSourceId]/resources/route.ts :: GET` → `bff.confirm.getResources(id)`
3. mock: `lib/bff/mock-adapter.ts :: confirm.getResources` → `unwrap(mockConfirm.getResources(String(id)))`
   (real: `lib/bff/http.ts :: confirm.getResources` → `get('/target-sources/{id}/resources')`)
4. `lib/bff/mock/confirm.ts :: getResources` → reads `lib/mock-data.ts`
   (`getProjectByTargetSourceId(id).resources`; GCP `1002` → empty → `{resources:[], total_count:0}`).

`createApprovalRequest` (submit):
1. `app/lib/api/index.ts :: createApprovalRequest` → `fetchInfraJson('/target-sources/{id}/approval-requests', POST)`
2. route `…/approval-requests/route.ts :: POST` → `bff.confirm.createApprovalRequest(id, body)`, then
   `bff.confirm.getProcessStatus(id)` to decide `PENDING` vs `AUTO_APPROVED` fallback
3. mock: `lib/bff/mock-adapter.ts :: confirm.createApprovalRequest` → `mockConfirm.createApprovalRequest`
   (real: `lib/bff/http.ts :: confirm.createApprovalRequest` → `post('/target-sources/{id}/approval-requests', body)`)
4. `lib/bff/mock/confirm.ts :: createApprovalRequest` (mutates the mock store; per the demo
   policy comment in `confirm.ts`, cloud submit moves status to WAITING_APPROVAL).

`getProject` (refresh): `app/lib/api/index.ts :: getProject` → route `…/[targetSourceId]/route.ts :: GET`
→ `bff.targetSources.get(id)` → mock `lib/bff/mock-adapter.ts :: targetSources.get` →
`lib/bff/mock/target-sources.ts :: get` → `lib/mock-data.ts`.

`startScan` (Run Infra Scan, v1 API): `app/lib/api/scan.ts :: startScan` → route
`…/target-sources/[targetSourceId]/scan/route.ts :: POST` → `bff.scan.create`. Polling:
`app/lib/api/scan.ts :: getLatestScanJob` → `…/scanJob/latest/route.ts :: GET` → `bff.scan.getStatus`.
`ScanController` (`features/scan/ScanPanel`) owns the trigger/poll; on completion
`CandidateResourceSection#handleScanComplete` re-runs `getConfirmResources` **and** `refreshProject` (`getProject`).

> **GCP divergence:** none in the client/adapter chain — step 1 is shared cloud plumbing
> (`/target-sources/{id}/resources` + `/scan` + `/approval-requests`). The only GCP-specific fact is
> the empty seed for id `1002`.

---

## Step 2 — WAITING_APPROVAL (승인 대기)

### 작업 내용

Read-only snapshot of the submitted approval request (who requested, counts) and the
target/excluded resource breakdown, with a cancel button. `ProcessStatusCard` **polls** here
so an external approval flips the page forward automatically.

### Action(버튼) + API Call

| Action | API call | Transition |
|--------|----------|------------|
| mount | `GET /integration/api/v1/target-sources/2007/approved-integration` | load snapshot |
| mount | `GET /integration/api/v1/target-sources/2007/approval-requests/latest` | load request meta |
| `"연동 대상 승인 요청 취소"` | `POST /integration/api/v1/target-sources/2007/approval-requests/cancel` | mutation |
| after cancel | `GET /integration/api/v1/target-sources/2007` (`refreshProject`) | → step 1 |
| (background) | `GET …/2007/process-status` every 10s | **poll → step 3 on approval** |
| search / filter tabs / DB-type & region dropdowns / pagination | client-side only (no API) | — |

Advance: **ProcessStatusCard polling** (`getProcessStatus` 10s; on change → `getProject` →
`onProjectUpdate`). The toolbar filters are pure in-memory over the fetched data.

### UI 컴포넌트

```
WaitingApprovalStep.tsx
├─ ProcessStatusCard            ← polling ACTIVE (WAITING_APPROVAL)
├─ GuideCardContainer
├─ WaitingApprovalCard          ← owns parallel fetch (approved-integration + latest)
│  ├─ WaitingApprovalStats
│  ├─ WaitingApprovalToolbar
│  ├─ WaitingApprovalTable
│  └─ cancelSlot → WaitingApprovalCancelButton (hidden if project.isRejected)
└─ RejectionAlert
```

### API Client

- `getApprovedIntegration(id, {signal})` → `GET /target-sources/{id}/approved-integration`.
- `getApprovalRequestLatest(id, {signal})` → `GET /target-sources/{id}/approval-requests/latest`.
- `cancelApprovalRequest(id)` → `POST /target-sources/{id}/approval-requests/cancel`.
- `getProcessStatus(id)` (polled by `ProcessStatusCard`) → `GET /target-sources/{id}/process-status`.
- `getProject(id)` → `GET /target-sources/{id}`.

### Adapter 계층

`getApprovedIntegration`:
1. `app/lib/api/index.ts :: getApprovedIntegration` → `fetchInfraJson('/target-sources/{id}/approved-integration')`
2. route `…/approved-integration/route.ts :: GET` → `bff.confirm.getApprovedIntegration(id)`
3. mock `lib/bff/mock-adapter.ts :: confirm.getApprovedIntegration` → `mockConfirm.getApprovedIntegration`
   (real `lib/bff/http.ts :: confirm.getApprovedIntegration` → `get('/target-sources/{id}/approved-integration')`)
4. `lib/bff/mock/confirm.ts :: getApprovedIntegration` → `lib/mock-data.ts` (selected vs excluded resources).

`getApprovalRequestLatest`:
1. `app/lib/api/index.ts :: getApprovalRequestLatest` → `fetchInfraJson('/target-sources/{id}/approval-requests/latest')`
2. route `…/approval-requests/latest/route.ts :: GET` → `bff.confirm.getApprovalRequestLatest(id)`
3. mock `confirm.getApprovalRequestLatest` → `lib/bff/mock/confirm.ts :: getApprovalRequestLatest`
   (real `httpBff` → `get('/target-sources/{id}/approval-requests/latest')`).

`cancelApprovalRequest`:
1. `app/lib/api/index.ts :: cancelApprovalRequest` → `fetchInfraJson('/target-sources/{id}/approval-requests/cancel', POST)`
2. route `…/approval-requests/cancel/route.ts :: POST` → `bff.confirm.cancelApprovalRequest(id)`
3. mock `confirm.cancelApprovalRequest` → `lib/bff/mock/confirm.ts :: cancelApprovalRequest`
   (real `httpBff` → `post('/target-sources/{id}/approval-requests/cancel', {})`); client maps to `{success:true}`.

`getProcessStatus` (poll):
1. `app/lib/api/index.ts :: getProcessStatus` → `fetchInfraJson('/target-sources/{id}/process-status')`
2. route `…/process-status/route.ts :: GET` → `bff.confirm.getProcessStatus(id)` + `bff.targetSources.get(id)`
   (route maps the live `processStatus` enum → BFF token via `toBffApprovalProcessStatus`)
3. mock `confirm.getProcessStatus` → `lib/bff/mock/confirm.ts :: getProcessStatus` → `lib/mock-data.ts`.

> **GCP divergence:** none — identical confirm-family chain to AWS/Azure. The Step-2 payload
> just carries GCP resource ids / `credential_id` (`Key1`/`Key2`) and `database_region:
> asia-northeast3`.

---

## Step 3 — APPLYING_APPROVED (승인 반영중)

### 작업 내용

Read-only "approval is being applied" banner plus the approved Cloud-resource list
(approver + approval time). No action buttons; `ProcessStatusCard` polls so the page
auto-advances to INSTALLING when the backend finishes applying.

### Action(버튼) + API Call

| Action | API call | Transition |
|--------|----------|------------|
| mount | `GET /integration/api/v1/target-sources/2008/approved-integration` | load approved list |
| (background) | `GET …/2008/process-status` every 10s | **poll → step 4** |
| error retry | re-fetch `getApprovedIntegration` | — |

Advance: **ProcessStatusCard polling** (WAITING_APPROVAL **and** APPLYING_APPROVED are the two
polled statuses). No user button transitions this step.

### UI 컴포넌트

```
ApplyingApprovedStep.tsx
├─ ProcessStatusCard            ← polling ACTIVE (APPLYING_APPROVED)
├─ GuideCardContainer
├─ ApprovalApplyingBanner (data-testid="approval-applying")
├─ ApprovedIntegrationSection (_components/approved)   ← owns fetch (useEffect + AbortController)
│  └─ ApprovedIntegrationTable
└─ RejectionAlert
```

### API Client

- `getApprovedIntegration(id, {signal})` → `GET /target-sources/{id}/approved-integration`
  (same function/endpoint as step 2; mapped via `approvedIntegrationToApproved`).
- `getProcessStatus(id)` (polled by `ProcessStatusCard`).

### Adapter 계층

`getApprovedIntegration` — **identical chain to Step 2**:
`app/lib/api/index.ts :: getApprovedIntegration` → `…/approved-integration/route.ts :: GET`
→ `bff.confirm.getApprovedIntegration` → mock `lib/bff/mock/confirm.ts :: getApprovedIntegration`
→ `lib/mock-data.ts` (real: `lib/bff/http.ts :: confirm.getApprovedIntegration`).

`getProcessStatus` — same chain as Step 2 (`…/process-status/route.ts` → `bff.confirm.getProcessStatus`).

> **GCP divergence:** none — reuses the Step-2 `approved-integration` payload.

---

## Step 4 — INSTALLING (Agent 설치) — **GCP-specific**

### 작업 내용

Shows GCP agent installation progress. Unlike AWS (Terraform-script download + manual/auto)
and Azure (private-endpoint approval), **GCP** renders a **3-stage Terraform pipeline** per
resource — Subnet 생성 → Service TF 설치 → BDC TF 설치 — plus a per-resource status table and a
detail modal. A `"새로고침"` button re-runs the installation check (`POST check-installation`,
not auto-polled). Completion is gated on `summary.allCompleted`.

### Action(버튼) + API Call

| Action | API call | Transition |
|--------|----------|------------|
| mount | `GET /integration/api/v1/gcp/target-sources/2009/installation-status` | load pipeline |
| mount | `GET /integration/api/v1/target-sources/2009/confirmed-integration` | join DB names/region |
| `"새로고침"` | `POST /integration/api/v1/gcp/target-sources/2009/check-installation` | re-check |
| pipeline item click | opens `InstallTaskDetailModal` (no API) | — |
| on `summary.allCompleted` | `onInstallComplete` = `refreshProject` → `getProject` | **→ step 5** |

Advance: **action→refetch**. `useInstallationStatus` calls `isComplete = (d) => d.summary.allCompleted`;
when true it fires `onComplete` (`refreshProject` → `getProject` → `onProjectUpdate`). The
`"새로고침"` POST advances `IN_PROGRESS` steps to `COMPLETED` (mock: 40% chance per step). **No
auto-poll** on GCP.

### UI 컴포넌트

```
InstallingStep.tsx → CloudInstallingStep.tsx
└─ ConfirmedIntegrationDataProvider (targetSourceId)   ← getConfirmedIntegration
   ├─ ProjectPageMeta (+ ProviderBadge)
   ├─ ProcessStatusCard            ← polling INACTIVE (INSTALLING not polled)
   ├─ GuideCardContainer (slotKey via resolveStepSlot, INSTALLING + cloudProvider GCP)
   ├─ InstallationStatusSlot       ← switch(cloudProvider) === 'GCP'
   │  └─ GcpInstallationStatus (_components/gcp/GcpInstallationStatus.tsx)  ← thin wrapper
   │     └─ GcpInstallationInline (app/components/features/process-status/gcp/GcpInstallationInline.tsx)
   │        ├─ useInstallationStatus<GcpInstallationStatusResponse>({ getFn: getGcpInstallationStatus,
   │        │     checkFn: checkGcpInstallation, isComplete: d=>d.summary.allCompleted, onComplete })
   │        ├─ useConfirmedIntegration() (from provider) — joinGcpResources(resources, confirmed)
   │        ├─ buildGcpPipelineItems(resources) → InstallTaskPipeline
   │        ├─ InstallResourceTable (rows=joinedRows, provider="GCP")
   │        ├─ InstallTaskDetailModal (stepKey = GcpStepKey)
   │        ├─ InstallationLoadingView (provider="GCP") / InstallationErrorView
   │        └─ "새로고침" button → useInstallationStatus.refresh (checkGcpInstallation)
   └─ ConfirmedResourcesSlot + RejectionAlert
```
Helpers: `buildGcpPipelineItems` / `getGcpStepSummary` / `GCP_STEP_KEYS`
(`serviceSideSubnetCreation`, `serviceSideTerraformApply`, `bdcSideTerraformApply`) in
`lib/constants/gcp.ts`; row join in
`app/components/features/process-status/install-task-pipeline/join-installation-resources.ts ::
joinGcpResources` (default region `asia-northeast3`).

### API Client (`@/app/lib/api/gcp.ts` — GCP-specific)

- `getGcpInstallationStatus(id)` → `GET /gcp/target-sources/{id}/installation-status`
  (`fetchInfraCamelJson`).
- `checkGcpInstallation(id)` → `POST /gcp/target-sources/{id}/check-installation`
  (`fetchInfraCamelJson`, `BASE_URL = '/gcp/target-sources'`).
- (shared) `getConfirmedIntegration(id, {signal})` → `GET /target-sources/{id}/confirmed-integration`
  (via `ConfirmedIntegrationDataProvider`).
- Defined but **not** wired into the step UI: `getGcpScanServiceAccount` /
  `getGcpTerraformServiceAccount` (`GET …/scan-service-account`, `…/terraform-service-account`)
  — see "GCP-only identity routes" below.

### Adapter 계층 (full chain)

`getGcpInstallationStatus` (the GCP-defining chain):
1. `app/lib/api/gcp.ts :: getGcpInstallationStatus` → `fetchInfraCamelJson('/gcp/target-sources/{id}/installation-status')`
2. route `app/integration/api/v1/gcp/target-sources/[targetSourceId]/installation-status/route.ts :: GET`
   → `bff.gcp.getInstallationStatus(id)` → **`transformInstallationStatus(legacy)`**
   (`app/integration/api/v1/gcp/target-sources/[targetSourceId]/_lib/transform.ts`) which reshapes the
   legacy `{provider, resources[], lastCheckedAt, error}` into `{lastCheck, summary, resources}`.
   **GCP's route-level transform is not unique** — AWS routes also transform via
   `transformAwsInstallationStatus` (`app/integration/api/v1/aws/target-sources/_lib/installation-transform.ts`)
   and Azure merges/transforms the DB + VM BFF responses via `buildV1Response`
   (`app/integration/api/v1/azure/target-sources/[targetSourceId]/_lib/transform.ts`). What is
   GCP-specific is the resulting `{lastCheck, summary, resources}` shape with `summary.allCompleted`.
3. mock: `lib/bff/mock-adapter.ts :: gcp.getInstallationStatus` →
   `unwrap(mockGcp.getInstallationStatus(String(id)))`
   (real: `lib/bff/http.ts :: gcp.getInstallationStatus` → `get('/target-sources/{id}/gcp/installation-status')`
   — note the **real upstream nests `/gcp` after the id**, whereas the internal route is `/gcp/target-sources/{id}`)
4. dispatcher `lib/bff/mock/gcp.ts :: mockGcp.getInstallationStatus` → `authorize(projectId)` (current user +
   `getProjectByTargetSourceId` + serviceCode/role check, GCP error codes from `lib/constants/gcp.ts ::
   GCP_ERROR_CODES`) → `handleResult(gcpFns.getGcpInstallationStatus(Number(id)))`
5. deepest impl `lib/mock-gcp.ts :: getGcpInstallationStatus` — guards `isGcpProject`, returns
   `NOT_GCP_PROJECT` (400) if not GCP; builds per-resource status from `project.resources.filter(isSelected)`
   via `buildInstallResource`. Memoized in module-level `gcpStore.installationStatus[id]`.

`checkGcpInstallation`:
1. `app/lib/api/gcp.ts :: checkGcpInstallation` → `fetchInfraCamelJson('/gcp/target-sources/{id}/check-installation', POST)`
2. route `…/gcp/target-sources/[targetSourceId]/check-installation/route.ts :: POST`
   → `bff.gcp.checkInstallation(id)` → **same `transformInstallationStatus`** (`expectedDuration: '5000ms'`)
3. mock `lib/bff/mock-adapter.ts :: gcp.checkInstallation` → `mockGcp.checkInstallation`
   (real `lib/bff/http.ts :: gcp.checkInstallation` → `post('/target-sources/{id}/gcp/check-installation', {})`)
4. `lib/bff/mock/gcp.ts :: mockGcp.checkInstallation` → `authorize` → `gcpFns.checkGcpInstallation(id)`
5. `lib/mock-gcp.ts :: checkGcpInstallation` — `delete gcpStore[id]`, rebuild, then advance any `IN_PROGRESS`
   step to `COMPLETED` with `Math.random() < 0.4`, recompute `installationStatus` via `deriveInstallationStatus`,
   refresh `lastCheckedAt`.

`getConfirmedIntegration` (the join source) — shared confirm chain:
`ConfirmedIntegrationDataProvider` → `app/lib/api/index.ts :: getConfirmedIntegration`
→ `…/confirmed-integration/route.ts :: GET` (`normalizeConfirmedIntegration`; 404
`CONFIRMED_INTEGRATION_NOT_FOUND` if empty) → `bff.confirm.getConfirmedIntegration` →
mock `lib/bff/mock/confirm.ts :: getConfirmedIntegration` → `lib/mock-data.ts`.

### GCP install internals (the part that diverges most)

`lib/mock-gcp.ts` builds each resource's 3 steps from a **STEP_MATRIX** keyed by
`` `${type}:${resourceSubType ?? ''}` `` — `[subnet, serviceTf, bdcTf]` active flags
(`false` ⇒ `SKIP`):

| key | subnet | serviceTf | bdcTf |
|-----|--------|-----------|-------|
| `BIGQUERY:` | – | ✓ | ✓ |
| `CLOUD_SQL:PRIVATE_IP_MODE` | ✓ | ✓ | ✓ |
| `CLOUD_SQL:PSC_MODE` | – | – | ✓ |
| `CLOUD_SQL:BDC_PRIVATE_HOST_MODE` | – | – | – |
| `GCP_SQL:*` (all 3 sub-types) | ✓ | ✓ | ✓ |

- `resourceSubType` (`PRIVATE_IP_MODE` / `BDC_PRIVATE_HOST_MODE` / `PSC_MODE`) is derived
  deterministically from a char-sum hash of `resourceId` (`BIGQUERY` ⇒ `null`). This field is
  **GCP-only** (no AWS/Azure equivalent).
- Demo seed rows are `type: 'GCP_SQL'` → in `DEMO_STEP_TYPES`, so they use deterministic
  `buildDemoStep`: subnet always `COMPLETED`, service/BDC TF split `COMPLETED`/`IN_PROGRESS`
  by `hashString % 2` (so the step-4 screen always shows a mix). Non-demo types use the
  hash-driven `buildStep` (which can produce `FAIL` with a `FAIL_GUIDES` message).
- `installationStatus` per resource = `deriveInstallationStatus(steps)` (all active COMPLETED
  ⇒ `COMPLETED`, any `FAIL` ⇒ `FAIL`, else `IN_PROGRESS`; SKIP ignored).
- Route `transform.ts :: buildSummary` ⇒ `{ totalCount, completedCount, allCompleted }`;
  `buildLastCheck` maps `lastCheckedAt`/`error` ⇒ `{status: NEVER_CHECKED|FAILED|COMPLETED, …}`.

> **AWS/Azure contrast:** AWS step 4 = `getAwsInstallationStatus`/`checkAwsInstallation` +
> `getAwsTerraformScript` (script download, `serviceScripts[]`/`bdcStatus`/`actionSummary`).
> Azure = `getAzure…` with `privateEndpoint`/`vmInstallation`. All three clouds transform at the
> route layer (AWS `transformAwsInstallationStatus`, Azure `buildV1Response`, GCP
> `transformInstallationStatus`); **what is GCP-specific is the `summary.allCompleted` completion
> gate, the 3 named Terraform sub-steps per resource, and the `resourceSubType`
> (PSC/PRIVATE_IP/BDC_HOST).**

---

## Step 5 — WAITING_CONNECTION_TEST (연결 테스트)

### 작업 내용

Confirmed-resource list + a connection-test panel that runs a test and **polls** for the
result, plus a logical-DB slot. `"연결 테스트 수행"` triggers an async test; the panel polls
`test-connection/latest` (~4s) until the job leaves `PENDING`.

### Action(버튼) + API Call

| Action | API call | Transition |
|--------|----------|------------|
| mount | `GET /integration/api/v1/target-sources/2010/confirmed-integration` | load confirmed list |
| mount + poll (4s) | `GET /integration/api/v1/target-sources/2010/test-connection/latest` | **404 `TEST_CONNECTION_NOT_FOUND` until first run** (project exists) |
| `"연결 테스트 수행"` | `POST /integration/api/v1/target-sources/2010/test-connection` | start async job |
| cred check | `GET /integration/api/v1/target-sources/2010/secrets` | credential gate |
| cred 저장 (모달 내부) | `PUT /integration/api/v1/target-sources/2010/resources/credential` | `updateResourceCredential` (`CredentialSetupModal.handleSave`) |
| `"전체 내역 →"` (history modal) | `GET /integration/api/v1/target-sources/2010/test-connection/results?page=&size=` | `getTestConnectionResults` |

Advance: this step does **not** auto-transition via `ProcessStatusCard` (INSTALLED is not a
polled status). The test panel polls `getTestConnectionLatest` (`useTestConnectionPolling`,
`interval = 4_000`, stops when `!job || job.status !== 'PENDING'`). On the `PENDING → SUCCESS`
transition `ConnectionTestPanel` calls `onResourceUpdate` (= `refreshProject` → `getProject`);
the mock (`lib/mock-test-connection.ts`) has already flipped `processStatus` to
`CONNECTION_VERIFIED`, so the refetch advances to step 6. A `FAIL` does **not** refetch.

### UI 컴포넌트

```
WaitingConnectionTestStep.tsx
└─ ConfirmedIntegrationDataProvider
   ├─ ProcessStatusCard            ← polling INACTIVE
   ├─ GuideCardContainer
   ├─ ConfirmedResourcesSlot
   ├─ ConnectionTestSlot (renders only when confirmed state === 'ready')
   │  └─ ConnectionTestPanel (confirmed, onResourceUpdate=refreshProject)
   │     └─ useTestConnectionPolling (getTestConnectionLatest 4s poll + triggerTestConnection)
   ├─ LogicalDbSlot (logical-db/)
   └─ RejectionAlert
```

### API Client

- (shared) `getConfirmedIntegration(id, {signal})` (via provider).
- `getTestConnectionLatest(id)` → `GET /target-sources/{id}/test-connection/latest`.
- `triggerTestConnection(id)` → `POST /target-sources/{id}/test-connection`.
- `getSecrets(id)` → `GET /target-sources/{id}/secrets` (`fetchInfraCamelJson`).
- `getTestConnectionResults(id, page, size, {signal})` → `GET /target-sources/{id}/test-connection/results?page=&size=`.
- `updateResourceCredential(id, resourceId, credentialId)` → `PUT /target-sources/{id}/resources/credential` (`CredentialSetupModal`).

### Adapter 계층

`getTestConnectionLatest`:
1. `app/lib/api/index.ts :: getTestConnectionLatest` → `fetchInfraJson('/target-sources/{id}/test-connection/latest')`
2. route `…/test-connection/latest/route.ts :: GET` → `bff.confirm.getTestConnectionLatest(id)`
3. mock `lib/bff/mock-adapter.ts :: confirm.getTestConnectionLatest` → `mockConfirm.getTestConnectionLatest`
   (real `lib/bff/http.ts :: confirm.getTestConnectionLatest` → `get('/target-sources/{id}/test-connection/latest')`)
4. `lib/bff/mock/confirm.ts :: getTestConnectionLatest` → `lib/mock-test-connection.ts`.
   Returns 404 `TARGET_SOURCE_NOT_FOUND` only when the project is missing; an existing target
   with no job returns 404 `TEST_CONNECTION_NOT_FOUND` (`연결 테스트 이력이 없습니다.`).

`triggerTestConnection`: `app/lib/api/index.ts :: triggerTestConnection` →
`…/test-connection/route.ts :: POST` → `bff.confirm.testConnection(id, {})` (the route calls
`bff.confirm.testConnection`; `triggerTestConnection` is only the client DAL fn name) — mock
`lib/bff/mock/confirm.ts :: testConnection` → `lib/mock-test-connection.ts`; real `httpBff` →
`post('/target-sources/{id}/test-connection', body)`.

`updateResourceCredential` (Credential 저장): `app/lib/api/index.ts :: updateResourceCredential` →
`…/resources/credential/route.ts :: PUT` → `bff.confirm.updateResourceCredential` (mock
`lib/bff/mock/confirm.ts` → `lib/mock-*`; real `httpBff` →
`put('/target-sources/{id}/resources/credential', body)`).

`getSecrets`: `app/lib/api/index.ts :: getSecrets` → `…/secrets/route.ts :: GET` →
`bff.projects.credentials` → mock `mockBff.projects.credentials` →
`lib/bff/mock/projects.ts :: mockProjects.credentials` (real `httpBff.projects.credentials`).
**Not** `bff.confirm` / `lib/bff/mock/confirm.ts`.

`getConfirmedIntegration` / `getTestConnectionResults` follow the same
`app/lib/api/index.ts` → `…/<segment>/route.ts` → `bff.confirm.<fn>` → `lib/bff/mock/confirm.ts`
→ `lib/mock-*.ts` shape.

> **GCP divergence:** none — connection-test is the shared confirm family. GCP's confirmed
> list just carries `GCP_SQL` resource ids and `asia-northeast3` region. (Pre-test latest is
> 404 for GCP id `2010`, same as Azure.)

---

## Step 6 — CONNECTION_VERIFIED (연결 확인됨)

### 작업 내용

Read-only "최종 관리자 승인 대기" banner + confirmed-resource list (`bare` variant). A
`"연결 테스트 재실행"` button is a **준비중 toast stub** (no API call).

### Action(버튼) + API Call

| Action | API call | Transition |
|--------|----------|------------|
| mount | `GET /integration/api/v1/target-sources/2011/confirmed-integration` | load confirmed list |
| `"연결 테스트 재실행"` | none — `toast.info('연결 테스트 재실행 기능 준비중입니다.')` | — |

No automatic transition (CONNECTED is not a polled status; advance to step 7 is a backend
state change observed on next page load / explicit refresh).

### UI 컴포넌트

```
ConnectionVerifiedStep.tsx
└─ ConfirmedIntegrationDataProvider
   ├─ ProcessStatusCard            ← polling INACTIVE
   ├─ GuideCardContainer
   ├─ <section> "완료 여부 관리자 승인 대기" + StepBanner(info)
   │  ├─ ConfirmedResourcesSlot (bare)
   │  └─ ConnectionVerifiedRetestButton (toast stub)
   └─ RejectionAlert
```

### API Client

- (shared) `getConfirmedIntegration(id, {signal})` (via provider).

### Adapter 계층

`getConfirmedIntegration` — same chain as Step 4/5:
`ConfirmedIntegrationDataProvider` → `app/lib/api/index.ts :: getConfirmedIntegration`
→ `…/confirmed-integration/route.ts :: GET` (`normalizeConfirmedIntegration`)
→ `bff.confirm.getConfirmedIntegration` → mock `lib/bff/mock/confirm.ts :: getConfirmedIntegration`
→ `lib/mock-data.ts` (real `lib/bff/http.ts :: confirm.getConfirmedIntegration`).

> **GCP divergence:** none — `confirmed-integration` is shared. The retest button is an
> unimplemented stub on every cloud.

---

## Step 7 — INSTALLATION_COMPLETE (연동 완료)

### 작업 내용

"PII 모니터링 모듈 연동 완료" — confirmed-resource list (`complete` variant, health badges) +
aggregate health badge in the header. `"인프라 변경"` and `"연결 테스트 재실행"` are both **준비중
toast stubs**.

### Action(버튼) + API Call

| Action | API call | Transition |
|--------|----------|------------|
| page load (SSR) | (no HTTP hop) `page.tsx` Server Component calls `bff.targetSources.get(2012)` **directly** + `extractTargetSource` | route.ts/`getProject` 미경유; `processStatus: 7` |
| mount | `GET /integration/api/v1/target-sources/2012/confirmed-integration` | load complete list + health |
| `"인프라 변경"` | none — `toast.info('인프라 변경 기능 준비중입니다.')` | — |
| `"연결 테스트 재실행"` | none — toast stub | — |

Terminal step — no transition.

### UI 컴포넌트

```
InstallationCompleteStep.tsx
└─ ConfirmedIntegrationDataProvider
   ├─ ProcessStatusCard            ← polling INACTIVE
   ├─ GuideCardContainer
   ├─ <section> "PII 모니터링 모듈 연동 완료"
   │  ├─ InstallationCompleteHeaderRight → HealthBadge(aggregateHealth(state.data))
   │  ├─ InstallationCompleteActions ("인프라 변경" / "연결 테스트 재실행" — toast stubs)
   │  └─ ConfirmedResourcesSlot (variant="complete", bare) → ConfirmedIntegrationTable
   └─ RejectionAlert
```
Health: `confirmed/HealthBadge.tsx` + `confirmed/health-status.ts :: aggregateHealth`.

### API Client

- Initial page load is **not** a client DAL call: `page.tsx` (Server Component) imports `bff` from `@/lib/bff/client`, calls `bff.targetSources.get(id)` then `extractTargetSource` directly (no `getProject`/route.ts HTTP hop). `processStatus: 7`.
- (shared) `getConfirmedIntegration(id, {signal})` (via provider; `variant="complete"` adds health/integration columns).
- Defined but **not** wired to a visible button: `confirmInstallation`
  (`POST /target-sources/{id}/pii-agent-installation/confirm`) exists in the DAL for the admin
  "confirm installation" action.

### Adapter 계층

initial SSR load: `app/integration/target-sources/[targetSourceId]/page.tsx` →
`bff.targetSources.get(id)` (`@/lib/bff/client`) → mock `lib/bff/mock-adapter.ts ::
targetSources.get` → `lib/bff/mock/target-sources.ts :: get` → `lib/mock-data.ts`
(real `lib/bff/http.ts :: targetSources.get`) → `lib/target-source-response.ts :: extractTargetSource`.
No `/integration/api/v1` request. The CSR `getProject` → route `…/[targetSourceId]/route.ts :: GET`
→ `bff.targetSources.get` chain is the `refreshProject` refetch path only.

`getConfirmedIntegration` — same chain as Steps 4/5/6.

> **GCP divergence:** none in the chain — terminal step is shared confirm plumbing. The
> `complete` variant surfaces `health` per row; GCP rows are `GCP_SQL` / `asia-northeast3`.

---

## GCP-only routes & functions (not on AWS/Azure)

These exist in the GCP route tree and client, beyond the 7-step flow:

| internal path | route handler | bff method | mock dispatcher | impl / data |
|---------------|---------------|------------|-----------------|-------------|
| `GET /gcp/target-sources/{id}/scan-service-account` | `…/scan-service-account/route.ts :: GET` | `bff.gcp.getScanServiceAccount` | `lib/bff/mock/gcp.ts :: getScanServiceAccount` (inline mock) | returns `{email: scan-sa-{id}@example.iam.gserviceaccount.com, projectId: project-{id}, status: ACTIVE}` |
| `GET /gcp/target-sources/{id}/terraform-service-account` | `…/terraform-service-account/route.ts :: GET` | `bff.gcp.getTerraformServiceAccount` | `lib/bff/mock/gcp.ts :: getTerraformServiceAccount` (inline mock) | `{email: terraform-sa-{id}@…, projectId: project-{id}, status: ACTIVE}` |
| `GET /gcp/target-sources/{id}/settings` | `…/settings/route.ts :: GET` | — (no bff hop; resolves project directly) | — | `{gcpProjectId, scanServiceAccount: pii-scan-sa@{gcpProjectId}.iam.gserviceaccount.com, terraformExecutionServiceAccount: pii-tf-sa@{gcpProjectId}.iam.gserviceaccount.com}` |

Client fns `getGcpScanServiceAccount` / `getGcpTerraformServiceAccount` (`app/lib/api/gcp.ts`)
hit the first two. The `settings` route resolves the project locally (`resolveProject` +
`getCurrentUser` role/serviceCode check) and derives the SA emails from
`project.gcpProjectId ?? gcp-project-{id}` — it has **no** bff/mock-dispatcher hop. None of
these three are wired into the step-1–7 components (verified by component reads); they back
the GCP registration / admin settings surfaces. The `settings` route is the only GCP
identity field source that uses the real `gcpProjectId` (`pii-agent-prod-12345`); the two
service-account routes return synthetic `{id}`-based emails in mock.

## Cross-references

- `docs/api/step-actions-and-apis.md` — cross-cloud per-step base reference.
- `docs/api/boundaries.md` — CSR → Next route → BFF two-hop, prefix `/integration/api/v1`.
- `docs/swagger/gcp.yaml` — GCP installation-status / check-installation contracts.
- Client DAL: `app/lib/api/gcp.ts` (GCP installation + service accounts),
  `app/lib/api/index.ts` (shared confirm family).
- Route transform (GCP-only): `app/integration/api/v1/gcp/target-sources/[targetSourceId]/_lib/transform.ts`.
- Mock: `lib/bff/mock/gcp.ts` (dispatch + auth), `lib/mock-gcp.ts` (status engine),
  `lib/constants/gcp.ts` (step keys, pipeline builder, error codes, step matrix labels).
