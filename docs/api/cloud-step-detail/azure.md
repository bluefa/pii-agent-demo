# Azure — Step Detail

Source-verified detail for the **Azure** (`serviceCode=azure`) target-source detail page
(`/integration/target-sources/[targetSourceId]`), covering all 7 process steps. Read
`docs/api/step-actions-and-apis.md` first for the cross-provider table; this file goes deeper
on Azure and traces the **full adapter chain** at every hop.

## How to read this

- **Page routing.** `app/integration/target-sources/[targetSourceId]/page.tsx` → `ProjectDetail.tsx`
  switches on `project.cloudProvider`. `'Azure'` → `_components/azure/AzureProjectPage.tsx`, which
  renders `_components/layout/CloudTargetSourceLayout.tsx`. That layout switches on
  `project.processStatus` (`ProcessStatus` enum) and mounts exactly one `_components/layout/<Step>.tsx`.
  `AzureProjectPage` injects identity = `Subscription ID` + `Tenant ID` (mono), `providerLabel="Azure Infrastructure"`,
  `monitoringMethod="Azure Agent"`, `action=<DeleteInfrastructureButton/>`.
- **Transport / prefix.** CSR fns in `@/app/lib/api/*` call `fetchInfraJson` / `fetchInfraCamelJson`
  (`app/lib/api/infra.ts`). The transport prepends `INTERNAL_INFRA_API_PREFIX = '/integration/api/v1'`
  (`lib/infra-api.ts:toInternalInfraApiPath`). So a client path `/azure/target-sources/{id}/installation-status`
  is the browser request `GET /integration/api/v1/azure/target-sources/{id}/installation-status`, served by
  `app/integration/api/v1/azure/target-sources/[targetSourceId]/installation-status/route.ts`.
- **camelCase split.** `fetchInfraCamelJson` camelCases the response; `fetchInfraJson` is raw passthrough.
  Azure install status (`getAzureInstallationStatus`/`checkAzureInstallation`) uses **camel**; the confirm/approval
  family (`getApprovedIntegration`, `getApprovalRequestLatest`, `getConfirmedIntegration`,
  `createApprovalRequest`, `getProcessStatus`, test-connection) uses **raw** (the client normalizes by hand).
- **Adapter chain (every step's §5 traces this).**
  `CSR fn (app/lib/api)` → `Next route handler (app/integration/api/v1/.../route.ts, wrapped in withV1)`
  → `bff.<area>.<fn>` from `lib/bff/client.ts` (`bff = IS_MOCK ? mockBff : httpBff`, gated on `USE_MOCK_DATA`)
  → **mock path**: `lib/bff/mock-adapter.ts` (`mockBff`) → `lib/bff/mock/<area>.ts` (auth + dispatch) →
  `lib/mock-*.ts` (business logic + in-memory store)
  / **real path**: `lib/bff/http.ts` (`httpBff`) → upstream `BFF_URL + /install/v1/...`.
  The route handler is **identical** for mock vs real; only `bff` differs. All `route.ts` use
  `withV1` (`app/api/_lib/handler.ts`) + `parseTargetSourceId` + `problemResponse`.
- **Advance / transition semantics.**
  - **Step 1** advances by an *action*: submit `"승인 요청"` → `createApprovalRequest` → `refreshProject` (`getProject` refetch) flips `processStatus` 1→2.
  - **Steps 2 & 3** advance by *polling*: `ProcessStatusCard` polls `getProcessStatus` every `TIMINGS.PROCESS_STATUS_POLL_MS`; when `process_status` diverges from the expected BFF status (`'PENDING'` for step 2, `'CONFIRMING'` for step 3) it calls `getProject` and pushes the new project up via `onProjectUpdate`. No buttons advance these.
  - **Step 4** advances when the Azure install reports all resources complete: `AzureInstallationInline` fires `onInstallComplete` → `refreshProject`.
  - **Step 5** advances on a successful connection test (the poll/refresh re-reads the project on the next render). Steps **6/7** are terminal/read-only; their buttons are `준비중` toast stubs.
- **Sampled IDs** (from `step-actions-and-apis.md`, live-verified): step1=1005, step2=2002, step3=2003,
  step4=1004, step5=2004, step6=2005, step7=2006.

---

## Step 1 — WAITING_TARGET_CONFIRMATION (연동 대상 확정)

### 1. 작업 내용
연동 대상 후보 DB를 확인·선택해 관리자 승인을 요청하는 단계. Infra Scan으로 후보 리소스를 조회하고,
연동할 DB를 체크박스로 선택한 뒤 (VM/엔드포인트 설정이 필요한 리소스는 인라인 설정), `"승인 요청"`을 제출하면
프로세스가 2단계(승인 대기)로 넘어간다. 카드 제목은 `연동 대상 DB 선택`.

### 2. Action(버튼) + API Call
| 버튼/인터랙션 | API Call (method + internal path) | 비고 |
|---|---|---|
| mount (리소스 로드) | `GET /integration/api/v1/target-sources/{id}/resources` | `getConfirmResources` (camel) |
| `Run Infra Scan` | `POST /integration/api/v1/target-sources/{id}/scan` | `startScan` (v1 API), 완료 후 `getConfirmResources` 재조회 |
| scan 폴링 | `GET /integration/api/v1/target-sources/{id}/scanJob/latest` | `getLatestScanJob` (진행/완료 폴링) |
| `승인 요청` (IdcSubmitModal `제출하기`) | `POST /integration/api/v1/target-sources/{id}/approval-requests` | `createApprovalRequest`, **mutation** |
| 제출 후 (transition) | `GET /integration/api/v1/target-sources/{id}` | `getProject` via `refreshProject` → `onProjectUpdate` → 2단계 전이 |
| fetch 에러 시 `다시 시도` | `getConfirmResources` 재호출 (retryNonce) | — |

**Azure 전이:** step1 submit → `createApprovalRequest` → `refreshProject`(`getProject`) → `WAITING_APPROVAL`. 폴링 아님 (action-driven).

### 3. UI 컴포넌트
`WaitingTargetConfirmationStep.tsx` → `ProjectPageMeta` + `ProcessStatusCard` + (`GuideCardContainer` via `resolveStepSlot`) +
`candidate/CandidateResourceSection.tsx` + `RejectionAlert`.
- `CandidateResourceSection` owns the fetch (`useEffect` + `AbortController` → `getConfirmResources`), maps via
  `catalogToCandidates`, renders `ScanController` (`features/scan/ScanPanel`) wrapping
  `candidate/CandidateResourceTable.tsx` (+ `VmDatabaseConfigPanel`, `VnetIntegrationGuideModal` for Azure VM/endpoint config).
- Submit modal is the reused `idc/modals/IdcSubmitModal`. Selection/draft/expanded state lives in component state;
  payload built by `candidate/approval-payload.ts:buildResourceInputs`. Mutation via `useApiMutation` (`suppressAlert`).
- Data hook: none dedicated — `CandidateResourceSection`'s own `useEffect`.

### 4. API Client (`@/app/lib/api`)
- `getConfirmResources(id, {signal})` → `GET /target-sources/{id}/resources` (`fetchInfraCamelJson`).
- `createApprovalRequest(id, input)` → `POST /target-sources/{id}/approval-requests` (`fetchInfraJson`, body normalized by `normalizeApprovalRequestBody`, response normalized by `normalizeApprovalRequestSummary`).
- `getProject(id)` → `GET /target-sources/{id}` (`fetchInfraCamelJson` → `extractTargetSource`).

### 5. Adapter 계층 (full chain)
- **getConfirmResources** → `app/lib/api/index.ts:getConfirmResources` → `app/integration/api/v1/target-sources/[targetSourceId]/resources/route.ts (GET)` → `bff.confirm.getResources` → mock `lib/bff/mock-adapter.ts:mockBff.confirm.getResources` → `lib/bff/mock/confirm.ts:mockConfirm.getResources` → `lib/mock-data.ts:getProjectByTargetSourceId` (+ `toResourceCatalogItem`). Real: `lib/bff/http.ts:httpBff.confirm.getResources` → `GET {BFF_URL}/install/v1/target-sources/{id}/resources` → `extractResourceCatalog`.
- **createApprovalRequest** → `app/lib/api/index.ts:createApprovalRequest` → `.../approval-requests/route.ts (POST)` → `bff.confirm.createApprovalRequest` → mock `mockBff.confirm.createApprovalRequest` → `lib/bff/mock/confirm.ts:mockConfirm.createApprovalRequest` (state mutation in `lib/mock-store.ts:getStore` + `approvedIntegrationStore`; uses `normalizeApprovalRequestBody`). Real: `httpBff.confirm.createApprovalRequest` → `POST /install/v1/target-sources/{id}/approval-requests`. (Route also calls `bff.confirm.getProcessStatus` after, for the response envelope.)
- **getProject** → `app/lib/api/index.ts:getProject` → `.../[targetSourceId]/route.ts (GET)` → `bff.targetSources.get` → mock `mockBff.targetSources.get` → `lib/bff/mock/target-sources.ts:mockTargetSources.get`. Real: `httpBff.targetSources.get` → `GET /install/v1/target-sources/{id}`.
- **startScan** (Run Infra Scan) → `app/lib/api/scan.ts:startScan` → `.../target-sources/[targetSourceId]/scan/route.ts (POST)` → `bff.scan.create`. **getLatestScanJob** (폴링) → `app/lib/api/scan.ts:getLatestScanJob` → `.../scanJob/latest/route.ts (GET)` → `bff.scan.getStatus`. `ScanController` (`features/scan/ScanPanel`) owns the trigger/poll; on complete it re-runs `getConfirmResources`.

---

## Step 2 — WAITING_APPROVAL (승인 대기)

### 1. 작업 내용
승인 요청 후 관리자 검토를 기다리는 읽기 단계. 요청에 포함된 대상/비대상 리소스 스냅샷을 통계·필터·페이지네이션과
함께 보여주고, 요청일시/요청자를 표시한다. 사용자는 요청을 취소(1단계로 롤백)할 수 있다. 카드 제목은 `연동 대상 승인 대기`.

### 2. Action(버튼) + API Call
| 버튼/인터랙션 | API Call | 비고 |
|---|---|---|
| mount | `GET /integration/api/v1/target-sources/{id}/approved-integration` | `getApprovedIntegration` (raw) — 대상/비대상 스냅샷 |
| mount | `GET /integration/api/v1/target-sources/{id}/approval-requests/latest` | `getApprovalRequestLatest` (raw) — 요청자/요청일시 |
| 검색·필터탭(`전체/대상/비대상`)·DB타입/리전 드롭다운·페이지네이션 | **API 없음** | fetched data에 대한 클라이언트 처리 |
| `연동 대상 승인 요청 취소` → `요청 취소` | `POST /integration/api/v1/target-sources/{id}/approval-requests/cancel` | `cancelApprovalRequest`, **mutation** |
| 취소 후 (transition) | `GET /integration/api/v1/target-sources/{id}` | `getProject` → 1단계 롤백 |
| **자동 전이 (polling)** | `GET /integration/api/v1/target-sources/{id}/process-status` | `ProcessStatusCard` 폴링; `process_status !== 'PENDING'` 이면 `getProject` |

### 3. UI 컴포넌트
`WaitingApprovalStep.tsx` → `ProjectPageMeta` + `ProcessStatusCard` + (`GuideCardContainer`) +
`layout/WaitingApprovalCard.tsx` + `RejectionAlert`.
- `WaitingApprovalCard` owns the fetch (one `useEffect`, two parallel calls: `getApprovedIntegration` + `getApprovalRequestLatest`),
  maps via `toSelectedRow`/`toExcludedRow`/`toRequestSummary`, and renders
  `WaitingApprovalStats` + `WaitingApprovalToolbar` (search/filter/dbType/region) + `WaitingApprovalTable` + `ui/Pagination`. Filtering/paging are pure client-side (`useMemo`).
- `cancelSlot` = `layout/WaitingApprovalCancelButton.tsx` (hidden when `project.isRejected`): `useApiMutation(cancelApprovalRequest)` behind `ConfirmStepModal`; on success calls `refreshProject` (`getProject`).
- **Advance:** `ProcessStatusCard.tsx` `useEffect` polls `getProcessStatus` (expected `'PENDING'`).

### 4. API Client
- `getApprovedIntegration(id, {signal})` → `GET /target-sources/{id}/approved-integration` (`fetchInfraJson` → `normalizeApprovedIntegration`; wraps as `{ approved_integration }`).
- `getApprovalRequestLatest(id, {signal})` → `GET /target-sources/{id}/approval-requests/latest` (`fetchInfraJson`).
- `cancelApprovalRequest(id)` → `POST /target-sources/{id}/approval-requests/cancel` (`fetchInfraJson`; returns `{ success: true }`).
- `getProcessStatus(id)` → `GET /target-sources/{id}/process-status` (`fetchInfraJson` → `normalizeProcessStatusResponse`).
- `getProject(id)` → `GET /target-sources/{id}`.

### 5. Adapter 계층 (full chain)
- **getApprovedIntegration** → `app/lib/api/index.ts:getApprovedIntegration` → `.../approved-integration/route.ts (GET)` → `bff.confirm.getApprovedIntegration` → mock `mockBff.confirm.getApprovedIntegration` → `lib/bff/mock/confirm.ts:mockConfirm.getApprovedIntegration` (`approvedIntegrationStore` + seeded-fixture fallback synthesizing selected/excluded rows) → `lib/mock-data.ts:getProjectByTargetSourceId`. Real: `httpBff.confirm.getApprovedIntegration` → `GET /install/v1/target-sources/{id}/approved-integration`.
- **getApprovalRequestLatest** → `index.ts:getApprovalRequestLatest` → `.../approval-requests/latest/route.ts (GET)` → `bff.confirm.getApprovalRequestLatest` → mock `mockBff.confirm.getApprovalRequestLatest` → `lib/bff/mock/confirm.ts:mockConfirm.getApprovalRequestLatest`. Real: `httpBff.confirm.getApprovalRequestLatest` → `GET /install/v1/target-sources/{id}/approval-requests/latest`.
- **cancelApprovalRequest** → `index.ts:cancelApprovalRequest` → `.../approval-requests/cancel/route.ts (POST)` → `bff.confirm.cancelApprovalRequest` → mock `mockBff.confirm.cancelApprovalRequest` → `lib/bff/mock/confirm.ts:mockConfirm.cancelApprovalRequest` (state rollback). Real: `httpBff.confirm.cancelApprovalRequest` → `POST /install/v1/target-sources/{id}/approval-requests/cancel`. (Route also calls `bff.confirm.getApprovalHistory(id,0,1)`.)
- **getProcessStatus** → `index.ts:getProcessStatus` → `.../process-status/route.ts (GET)` → `bff.confirm.getProcessStatus` (route also `bff.targetSources.get`) → mock `mockBff.confirm.getProcessStatus` → `lib/bff/mock/confirm.ts:mockConfirm.getProcessStatus` (computes BFF status from project; optional APPLYING→INSTALLING auto-transition). Real: `httpBff.confirm.getProcessStatus` → `GET /install/v1/target-sources/{id}/process-status`.

---

## Step 3 — APPLYING_APPROVED (승인 반영중)

### 1. 작업 내용
승인이 완료되어 확정 내용이 인프라에 반영되는 중인 읽기 단계. 승인 배너 + 승인된 Cloud 리소스 목록(승인일시/승인자)을
보여주며, 사용자 액션 없이 폴링으로 다음 단계(설치)로 자동 전이된다. 섹션 제목은 `Cloud 리소스`.

### 2. Action(버튼) + API Call
| 버튼/인터랙션 | API Call | 비고 |
|---|---|---|
| mount | `GET /integration/api/v1/target-sources/{id}/approved-integration` | `getApprovedIntegration` (raw) |
| fetch 에러 시 retry | `getApprovedIntegration` 재호출 | `ErrorRow` |
| **자동 전이 (polling)** | `GET /integration/api/v1/target-sources/{id}/process-status` | 기대 BFF 상태 `'CONFIRMING'`; 변하면 `getProject` |

읽기 전용 — 전이를 일으키는 버튼 없음.

### 3. UI 컴포넌트
`ApplyingApprovedStep.tsx` → `ProjectPageMeta` + `ProcessStatusCard` + (`GuideCardContainer`) +
`process-status/ApprovalApplyingBanner.tsx` (data-testid `approval-applying`) +
`approved/ApprovedIntegrationSection.tsx` + `RejectionAlert`.
- `ApprovedIntegrationSection` owns the fetch (`useEffect` → `getApprovedIntegration`), maps via
  `approvedIntegrationToApproved`, renders `approved/ApprovedIntegrationTable.tsx` (+ `scan-pill-derive`).
- **Advance:** same `ProcessStatusCard` poll, expected `'CONFIRMING'`.

### 4. API Client
- `getApprovedIntegration(id, {signal})` → `GET /target-sources/{id}/approved-integration` (same as Step 2).
- `getProcessStatus(id)`, `getProject(id)` (poll/transition).

### 5. Adapter 계층 (full chain)
- **getApprovedIntegration** — identical chain to Step 2 §5.
- **getProcessStatus** — identical chain to Step 2 §5 (`ProcessStatusCard` poll, expected `'CONFIRMING'`).

---

## Step 4 — INSTALLING (Agent 설치) — **Azure-specific**

### 1. 작업 내용
확정된 Azure 리소스에 PII Agent를 설치하는 단계. Azure 설치는 **3-phase 파이프라인**(서비스 측 리소스 →
BDC 측 리소스 → Private Link)으로 진행 상태를 보여주고, 리소스별 Private Endpoint/VM(subnet·LoadBalancer)
상태를 테이블로 표시한다. 모든 리소스가 완료되면 `onInstallComplete` → `refreshProject`로 5단계로 전이된다.

### 2. Action(버튼) + API Call
| 버튼/인터랙션 | API Call | 비고 |
|---|---|---|
| mount (확정 리소스) | `GET /integration/api/v1/target-sources/{id}/confirmed-integration` | `getConfirmedIntegration` (raw), `ConfirmedIntegrationDataProvider` |
| mount (설치 상태) | `GET /integration/api/v1/azure/target-sources/{id}/installation-status` | `getAzureInstallationStatus` (camel), `useInstallationStatus` |
| `새로고침` (아이콘 버튼) | `POST /integration/api/v1/azure/target-sources/{id}/check-installation` | `checkAzureInstallation` (camel) |
| allCompleted (transition) | `GET /integration/api/v1/target-sources/{id}` | `onInstallComplete` → `refreshProject` |

**Azure divergence:** 설치 상태가 provider 전용 엔드포인트(`/azure/...`)이며 **자동 폴링 없음** —
새로고침은 `check-installation` POST. AWS의 `terraform-script` 다운로드/manual mode 버튼은 Azure에 없음.

### 3. UI 컴포넌트
`InstallingStep.tsx` → `CloudInstallingStep.tsx`. `CloudInstallingStep` wraps everything in
`data/ConfirmedIntegrationDataProvider.tsx` (mounts → `getConfirmedIntegration`) and renders
`ProjectPageMeta` (+ `ProviderBadge` Azure) + `ProcessStatusCard` + (`GuideCardContainer`) +
`layout/InstallationStatusSlot.tsx` + `layout/ConfirmedResourcesSlot.tsx` + `RejectionAlert`.
- `InstallationStatusSlot` switches on `cloudProvider` → **`azure/AzureInstallationStatus.tsx`** (thin: reads
  `useConfirmedIntegration` state, renders only when `ready`) → **`process-status/azure/AzureInstallationInline.tsx`**.
- `AzureInstallationInline` (the Azure-specific install component) uses the **shared** hook
  `app/hooks/useInstallationStatus.ts` with `getFn=getAzureInstallationStatus`, `checkFn=checkAzureInstallation`.
  It joins confirmed resources with the v1 status, derives per-resource `InstallStep`
  (`SUBNET_REQUIRED`/`VM_TF_REQUIRED`/`PE_NOT_REQUESTED`/`PE_PENDING`/`PE_REJECTED`/`COMPLETED`) via
  `getVmInstallStep`/`getDbInstallStep`, and renders
  `install-task-pipeline/InstallTaskPipeline` with `lib/constants/azure-install.ts:buildAzurePipelineItems`
  (3 cards: `서비스 측 리소스 설치` / `BDC 측 리소스 설치` / `Private Link 모듈 설치`) + 
  `install-task-pipeline/InstallResourceTable` rows from `join-installation-resources.ts:joinAzureResources`.
  Fires `onInstallComplete` when `completedCount === totalCount`. `lastCheck.status==='FAILED'` shows a sync-failure banner.
- `ConfirmedResourcesSlot` reads the same provider context → `confirmed/ConfirmedIntegrationTable.tsx`.
- Data hooks: `useConfirmedIntegration` (provider), `useInstallationStatus` (Azure status).

### 4. API Client
- `getAzureInstallationStatus(id)` → `GET /azure/target-sources/{id}/installation-status` (`app/lib/api/azure.ts`, `fetchInfraCamelJson`).
- `checkAzureInstallation(id)` → `POST /azure/target-sources/{id}/check-installation` (`app/lib/api/azure.ts`, `fetchInfraCamelJson`).
- `getConfirmedIntegration(id, {signal})` → `GET /target-sources/{id}/confirmed-integration` (`app/lib/api/index.ts`, `fetchInfraJson` → `extractConfirmedIntegration`).

### 5. Adapter 계층 (full chain)
- **getAzureInstallationStatus** → `app/lib/api/azure.ts:getAzureInstallationStatus` → `app/integration/api/v1/azure/target-sources/[targetSourceId]/installation-status/route.ts (GET)`. The route does **two** BFF calls and merges via `_lib/transform.ts:buildV1Response`: `bff.azure.getInstallationStatus` (DB, required) + `bff.azure.vmGetInstallationStatus` (VM, **best-effort**: swallows `BffError`, rethrows others). → mock `lib/bff/mock-adapter.ts:mockBff.azure.getInstallationStatus` / `.vmGetInstallationStatus` → `lib/bff/mock/azure.ts:mockAzure.getInstallationStatus` / `.vmGetInstallationStatus` (each runs `authorize()` then) → `lib/mock-azure.ts:getAzureInstallationStatus` / `getAzureVmInstallationStatus` (in-memory `azureStore`, PE status simulated by `generatePrivateEndpointStatus`). Real: `lib/bff/http.ts:httpBff.azure.getInstallationStatus` → `GET /install/v1/target-sources/{id}/azure/installation-status` (+ `.../azure/vm/installation-status`). **Note the real upstream path is `/target-sources/{id}/azure/...`, while the internal/route path is `/azure/target-sources/{id}/...`.**
- **checkAzureInstallation** → `app/lib/api/azure.ts:checkAzureInstallation` → `.../azure/target-sources/[targetSourceId]/check-installation/route.ts (POST)` → `bff.azure.checkInstallation` (DB) + `bff.azure.vmCheckInstallation` (VM best-effort) → `buildV1Response` → mock `mockBff.azure.checkInstallation` / `.vmCheckInstallation` → `lib/bff/mock/azure.ts:mockAzure.checkInstallation` / `.vmCheckInstallation` → `lib/mock-azure.ts:checkAzureInstallation` / `checkAzureVmInstallation` (clears cache, re-derives, simulates some `PENDING_APPROVAL → APPROVED`). Real: `httpBff.azure.checkInstallation` → `POST /install/v1/target-sources/{id}/azure/check-installation` (+ `.../azure/vm/check-installation`).
- **getConfirmedIntegration** → `app/lib/api/index.ts:getConfirmedIntegration` → `.../target-sources/[targetSourceId]/confirmed-integration/route.ts (GET)` → `bff.confirm.getConfirmedIntegration` → mock `mockBff.confirm.getConfirmedIntegration` → `lib/bff/mock/confirm.ts:mockConfirm.getConfirmedIntegration` (`confirmedIntegrationSnapshotStore` → `approvedIntegrationStore` derive → project.resources fallback; empty via `createEmptyConfirmedIntegration`) → `lib/mock-data.ts:getProjectByTargetSourceId`. Real: `httpBff.confirm.getConfirmedIntegration` → `GET /install/v1/target-sources/{id}/confirmed-integration` → `extractConfirmedIntegration`.

> **Azure install internals vs other clouds.** The `/azure/.../installation-status` and `.../check-installation`
> routes are **composite**: each fans out to a DB BFF call + a VM BFF call and merges them with
> `buildV1Response` into the unified `{ lastCheck, resources[] }` shape (VM resources gain a `vmInstallation`
> sub-object with `subnetExists` + `loadBalancer`). AWS's status route is single-call (`terraform`/script-centric,
> with `hasExecutionPermission` + `serviceScripts[]`); GCP's is single-call with `summary` + per-phase
> (`serviceSideSubnetCreation` / `serviceSideTerraformApply` / `bdcSideTerraformApply`). Azure identity surfaced on
> the page = `subscriptionId` + `tenantId` (`AzureProjectPage`), unlike AWS (account/region) or GCP (project).

---

## Step 5 — WAITING_CONNECTION_TEST (연결 테스트)

### 1. 작업 내용
설치 완료 후 DB 연결을 테스트하는 단계. 확정 리소스 목록 + 연결 테스트 패널 + 논리 DB 슬롯을 보여준다.
`연결 테스트 수행`을 누르면 (필요 시 Credential 설정 모달을 먼저 띄우고) 비동기 테스트를 트리거하고, 4초 주기로
최신 결과를 폴링한다. 성공하면 6단계로 전이.

### 2. Action(버튼) + API Call
| 버튼/인터랙션 | API Call | 비고 |
|---|---|---|
| mount (확정 리소스) | `GET /integration/api/v1/target-sources/{id}/confirmed-integration` | `getConfirmedIntegration` (raw), provider |
| mount + 4s poll | `GET /integration/api/v1/target-sources/{id}/test-connection/latest` | `getTestConnectionLatest` — **테스트 전엔 404 `TEST_CONNECTION_NOT_FOUND`** (`연결 테스트 이력이 없습니다.`; 프로젝트는 존재) |
| `연결 테스트 수행` | `POST /integration/api/v1/target-sources/{id}/test-connection` | `triggerTestConnection` (202), 그 후 폴링 |
| Credential 누락/직전 실패 시 | `GET /integration/api/v1/target-sources/{id}/secrets` | `getSecrets` (camel) → `CredentialSetupModal` |
| Credential 저장(모달 내부) | `PUT /integration/api/v1/target-sources/{id}/resources/credential` | `updateResourceCredential` |
| `전체 내역 →` | `GET /integration/api/v1/target-sources/{id}/test-connection/results?page=&size=` | `getTestConnectionResults` (history modal) |

### 3. UI 컴포넌트
`WaitingConnectionTestStep.tsx` wraps in `ConfirmedIntegrationDataProvider` → renders `ProjectPageMeta` +
`ProcessStatusCard` + (`GuideCardContainer`) + `layout/ConfirmedResourcesSlot.tsx` +
`layout/ConnectionTestSlot.tsx` + `logical-db/LogicalDbSlot.tsx` + `RejectionAlert`.
- `ConnectionTestSlot` (renders only when provider state `ready`) → `process-status/ConnectionTestPanel.tsx`.
- `ConnectionTestPanel` owns polling via `app/hooks/useTestConnectionPolling.ts` (`interval = 4_000`;
  `triggerTestConnection` + `getTestConnectionLatest`, stops when `status !== 'PENDING'`). Lazy-loads
  `connection-test/CredentialSetupModal`, `ResultDetailModal`, `TestConnectionHistoryModal`; renders
  `ProgressBar` + `ResultSummary`. `getSecrets` is called inline before showing the credential modal.
- `LogicalDbSlot` → `logical-db/LogicalDbModalLoader` + `useLogicalDatabases` (logical-DB deny panel).
- Data hooks: `useConfirmedIntegration`, `useTestConnectionPolling`, `useLogicalDatabases`.

### 4. API Client
- `getTestConnectionLatest(id)` → `GET /target-sources/{id}/test-connection/latest` (`fetchInfraJson`, raw; 404 → caught → `null`).
- `triggerTestConnection(id)` → `POST /target-sources/{id}/test-connection` (`fetchInfraJson`).
- `getSecrets(id)` → `GET /target-sources/{id}/secrets` (`fetchInfraCamelJson`).
- `getTestConnectionResults(id, page, size, {signal})` → `GET /target-sources/{id}/test-connection/results` (`fetchInfraJson`).
- `updateResourceCredential(id, resourceId, credentialId)` → `PUT /target-sources/{id}/resources/credential`.
- `getConfirmedIntegration(id, {signal})` → `GET /target-sources/{id}/confirmed-integration`.

### 5. Adapter 계층 (full chain)
- **getTestConnectionLatest** → `app/lib/api/index.ts:getTestConnectionLatest` → `.../test-connection/latest/route.ts (GET)` → `bff.confirm.getTestConnectionLatest` → mock `mockBff.confirm.getTestConnectionLatest` → `lib/bff/mock/confirm.ts:mockConfirm.getTestConnectionLatest` → `lib/mock-test-connection.ts:getLatestJob` + `toJobResponse`. Returns 404 `TARGET_SOURCE_NOT_FOUND` only when the project is missing; an existing target with no job returns 404 `TEST_CONNECTION_NOT_FOUND` (`연결 테스트 이력이 없습니다.`). Real: `httpBff.confirm.getTestConnectionLatest` → `GET /install/v1/target-sources/{id}/test-connection/latest`.
- **triggerTestConnection** → `index.ts:triggerTestConnection` → `.../test-connection/route.ts (POST)` → `bff.confirm.testConnection(id, {})` → mock `mockBff.confirm.testConnection` → `lib/bff/mock/confirm.ts:mockConfirm.testConnection` → `lib/mock-test-connection.ts:hasPendingJob` + `createTestConnectionJob`. Real: `httpBff.confirm.testConnection` → `POST /install/v1/target-sources/{id}/test-connection`.
- **updateResourceCredential** (Credential 저장) → `app/lib/api/index.ts:updateResourceCredential` → `.../resources/credential/route.ts (PUT)` → `bff.confirm.updateResourceCredential`. Called by `connection-test/CredentialSetupModal.tsx:handleSave` (per missing resource). Real: `httpBff.confirm.updateResourceCredential` → `PUT /install/v1/target-sources/{id}/resources/credential`.
- **getTestConnectionResults** (전체 내역 modal) → `app/lib/api/index.ts:getTestConnectionResults` → `.../test-connection/results/route.ts (GET, page/size)` → `bff.confirm.getTestConnectionResults` → mock `mockBff.confirm.getTestConnectionResults` → `lib/bff/mock/confirm.ts:mockConfirm.getTestConnectionResults`. Real: `httpBff.confirm.getTestConnectionResults` → `GET /install/v1/target-sources/{id}/test-connection/results`.
- **getSecrets** → `index.ts:getSecrets` → `.../secrets/route.ts (GET)` → `bff.projects.credentials` → mock `mockBff.projects.credentials` → `lib/bff/mock/projects.ts:mockProjects.credentials` → `lib/mock-data.ts` (project credentials). Real: `httpBff.projects.credentials` → `GET /install/v1/target-sources/{id}/secrets`. (Route maps raw credentials → `SecretKey[]`.)
- **getConfirmedIntegration** — identical chain to Step 4 §5.

---

## Step 6 — CONNECTION_VERIFIED (연결 확인됨)

### 1. 작업 내용
연결이 검증되어 최종(완료 여부) 관리자 승인을 기다리는 읽기 단계. 확정 리소스 목록(bare 테이블)과 안내 배너만
표시한다. 카드 제목은 `완료 여부 관리자 승인 대기`. 재실행 버튼은 미구현 스텁.

### 2. Action(버튼) + API Call
| 버튼/인터랙션 | API Call | 비고 |
|---|---|---|
| mount | `GET /integration/api/v1/target-sources/{id}/confirmed-integration` | `getConfirmedIntegration` (raw) |
| `연결 테스트 재실행` | **API 없음** | `toast.info('… 준비중')` 스텁 |

### 3. UI 컴포넌트
`ConnectionVerifiedStep.tsx` wraps in `ConfirmedIntegrationDataProvider` → `ProjectPageMeta` + `ProcessStatusCard` +
(`GuideCardContainer`) + a `section` containing `StepBanner` + `ConfirmedResourcesSlot bare` + inline
`ConnectionVerifiedRetestButton` (toast stub) + `RejectionAlert`.
- `ConfirmedResourcesSlot(bare)` → `confirmed/ConfirmedIntegrationTable.tsx`.
- Data hook: `useConfirmedIntegration`.

### 4. API Client
- `getConfirmedIntegration(id, {signal})` → `GET /target-sources/{id}/confirmed-integration`.

### 5. Adapter 계층 (full chain)
- **getConfirmedIntegration** — identical chain to Step 4 §5
  (`index.ts:getConfirmedIntegration` → `.../confirmed-integration/route.ts (GET)` → `bff.confirm.getConfirmedIntegration` → `mockConfirm.getConfirmedIntegration` → `lib/mock-data.ts`; real → `GET /install/v1/target-sources/{id}/confirmed-integration`).

---

## Step 7 — INSTALLATION_COMPLETE (연동 완료)

### 1. 작업 내용
연동이 완료되어 PII 모니터링이 시작된 최종 단계. 확정 리소스 목록을 `complete` variant(health 배지 포함)로
보여주고, 헤더에 집계 health 배지를 표시한다. 카드 제목은 `PII 모니터링 모듈 연동 완료`. 액션 버튼은 모두 스텁.

### 2. Action(버튼) + API Call
| 버튼/인터랙션 | API Call | 비고 |
|---|---|---|
| mount | `GET /integration/api/v1/target-sources/{id}/confirmed-integration` | `getConfirmedIntegration` (raw) |
| 페이지 초기 로드(SSR) | `GET /integration/api/v1/target-sources/{id}` | `bff.targetSources.get` / `getProject`, `processStatus:7` |
| `인프라 변경` | **API 없음** | toast 스텁 |
| `연결 테스트 재실행` | **API 없음** | toast 스텁 |

`confirmInstallation` (`POST /target-sources/{id}/pii-agent-installation/confirm`) DAL에 존재하나 이 스텝의 가시 버튼에 미연결.

### 3. UI 컴포넌트
`InstallationCompleteStep.tsx` wraps in `ConfirmedIntegrationDataProvider` → `ProjectPageMeta` + `ProcessStatusCard` +
(`GuideCardContainer`) + a `section`: header `InstallationCompleteHeaderRight` (`HealthBadge` from
`aggregateHealth(state.data)`) + body `InstallationCompleteActions` (두 toast 스텁) + `ConfirmedResourcesSlot variant="complete" bare` + `RejectionAlert`.
- `ConfirmedResourcesSlot(complete)` → `confirmed/ConfirmedIntegrationTable.tsx` with `HealthBadge` per row (`health-status.ts`).
- Data hook: `useConfirmedIntegration`.

### 4. API Client
- `getConfirmedIntegration(id, {signal})` → `GET /target-sources/{id}/confirmed-integration`.
- `getProject(id)` (initial SSR load) → `GET /target-sources/{id}`.

### 5. Adapter 계층 (full chain)
- **getConfirmedIntegration** — identical chain to Step 4 §5.
- **getProject** → `index.ts:getProject` → `.../[targetSourceId]/route.ts (GET)` → `bff.targetSources.get` → mock `mockBff.targetSources.get` → `lib/bff/mock/target-sources.ts:mockTargetSources.get`; real → `GET /install/v1/target-sources/{id}`.

---

## Cross-references
- `docs/api/step-actions-and-apis.md` — cross-provider per-step table + response samples.
- `docs/api/boundaries.md` — CSR → Next route → BFF two-hop, prefix `/integration/api/v1`.
- `docs/swagger/azure.yaml` — Azure installation-status / check-installation / vm contracts.
- `docs/swagger/confirm.yaml`, `docs/swagger/test-connection.yaml` — shared confirm/approval/test-connection.
- Client DAL: `app/lib/api/index.ts` (shared confirm/approval/test-connection), `app/lib/api/azure.ts` (Azure install).
- BFF: `lib/bff/client.ts` (`mockBff`/`httpBff` switch), `lib/bff/mock-adapter.ts`, `lib/bff/http.ts`,
  `lib/bff/mock/{azure,confirm,target-sources,projects}.ts`, `lib/mock-azure.ts`, `lib/mock-test-connection.ts`, `lib/mock-data.ts`.
