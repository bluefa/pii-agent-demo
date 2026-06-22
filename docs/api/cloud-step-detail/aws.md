# AWS — Step Detail

Source-verified, AWS-specific (`serviceCode=aws`) detail for the target-source detail page
(`/integration/target-sources/[targetSourceId]`), covering all 7 process steps. Read
`docs/api/step-actions-and-apis.md` first for the per-step baseline; this goes deeper on the AWS
divergences and traces the full adapter chain (CSR client → Next route → bff client → mock → mock-*).

## Routing & conventions (AWS-specific)

- **Page → provider page.** The detail page resolves `serviceCode=aws` to
  `_components/aws/AwsProjectPage.tsx`.
- **AWS install-mode gate (unique to AWS).** `AwsProjectPage` checks `project.awsInstallationMode`.
  If it is **null**, the layout is **not** rendered yet — instead it shows
  `process-status/aws/AwsInstallationModeSelector.tsx` (a one-time `AUTO`/`MANUAL` choice). Selecting
  a mode calls `setAwsInstallationMode` (`POST /aws/target-sources/{id}/installation-mode`) and the
  returned `project` re-enters the page with `awsInstallationMode` set. Seeded AWS projects (e.g.
  `1006`) already carry `awsInstallationMode: "AUTO"`, so this gate is normally skipped. Azure/GCP
  have **no** such gate.
- **Layout dispatch.** Once a mode exists, `AwsProjectPage` → `CloudTargetSourceLayout.tsx`, which
  `switch`es on `project.processStatus` (`renderStep`) to one of the 7 layout step components.
- **Identity fields (AWS-specific).** `AwsProjectPage` builds `ProjectIdentity` with
  `cloudProvider: 'AWS'`, `monitoringMethod: 'AWS Agent'`, and identifiers
  **`AWS Account ID`** (`project.awsAccountId`, mono) and **`Region Type`**
  (`project.awsRegionType` → `China`/`Global`). There is no `tenantId`/`subscriptionId` (Azure) or
  `GCP Project ID` (GCP, `project.gcpProjectId`). `jiraLink` is null.
- **Transport.** All client functions call `fetchInfra*Json('/...')` with an **unprefixed** path
  *argument*; the transport (`app/lib/api/infra.ts:fetchInfraJson`) prepends
  `INTERNAL_INFRA_API_PREFIX = '/integration/api/v1'` (`lib/infra-api.ts`). The unprefixed paths in the
  tables below are those CSR helper **arguments** — the real browser request prefixes each with
  `/integration/api/v1` (e.g. `GET /target-sources/{id}/resources` is really
  `GET /integration/api/v1/target-sources/{id}/resources`).
  Cloud responses are camelCased by `fetchInfraCamelJson` (e.g. `getConfirmResources` uses
  `fetchInfraCamelJson`, `app/lib/api/index.ts:301`); the approval/confirm family
  (`createApprovalRequest`, `getApprovedIntegration`, `getApprovalRequestLatest`,
  `getConfirmedIntegration`) stays snake_case via `fetchInfraJson` + client-side normalizers.
- **BFF selector.** `lib/bff/client.ts`: `bff = USE_MOCK_DATA==='true' ? mockBff : httpBff`. The doc
  traces both hops; the dev server runs the **mock** path (`mockBff` → `lib/bff/mock/*` →
  `lib/mock-*.ts`). `mock-adapter.ts#unwrap<T>()` converts each mock `NextResponse` → typed data
  (throws on non-2xx).
- **Advance / transition semantics.**
  - `ProcessStatusCard` (mounted on every step) **polls `getProcessStatus`** every
    `TIMINGS.PROCESS_STATUS_POLL_MS = 10_000` ms, **only while** `processStatus` is
    `WAITING_APPROVAL` (2) or `APPLYING_APPROVED` (3); on a server-side status change it calls
    `getProject` and `onProjectUpdate`. So **step 2 and step 3 advance via this polling**, not a
    button.
  - Steps 1, 4, 5 advance via an **action → `refreshProject()`** (which is
    `getProject(id)` → `onProjectUpdate`, i.e. a process-status refetch). AWS **step 1** submit →
    `createApprovalRequest` → server flips to `WAITING_APPROVAL`; AWS **step 4** advance is implicit —
    `useInstallationStatus.onComplete` fires `refreshProject` once the install status reports
    fully-completed.
  - Steps 6, 7 have no real advancing action (retest / infra-change buttons are `준비중` toast stubs).
- **AWS ID map** (from `step-actions-and-apis.md`): step1 `1006`, step2 `1007`, step3 `2001`,
  step4 `1008`, step5 `1010`, step6 `1011`, step7 `1012`.

---

## Step 1 — WAITING_TARGET_CONFIRMATION (연동 대상 확정)

### 1. 작업 내용
연동 대상 DB 선택 화면. Infra Scan으로 후보 리소스를 조회한 뒤 사용자가 연동 대상 DB를 체크하고
(엔드포인트 설정이 필요한 리소스는 인라인으로 입력) `"승인 요청"`을 제출한다. 헤더에 `Last Scan`
타임스탬프, 본문에 후보 리소스 테이블(체크박스 + 설정 패널)을 표시한다.

### 2. Action(버튼) + API Call
| 버튼 / 상호작용 | API Call (method + internal path) | 비고 |
|---|---|---|
| mount (후보 로드) | `GET /target-sources/{id}/resources` | `getConfirmResources` |
| `Run Infra Scan` | `POST /target-sources/{id}/scan` | `startScan` (v1 API; `ScanController`). 완료 시 `handleScanComplete` → `getConfirmResources` 재조회 **+ `refreshProject` (`getProject`)** |
| scan 폴링 | `GET /target-sources/{id}/scanJob/latest` | `getLatestScanJob` |
| `다시 시도` (fetch error) | `GET /target-sources/{id}/resources` | refetch |
| `승인 요청` (submit modal `제출하기`) | `POST /target-sources/{id}/approval-requests` | `createApprovalRequest` → 서버가 `WAITING_APPROVAL`로 전이 |
| submit 직후 | `GET /target-sources/{id}` | `refreshProject` → `onProjectUpdate` (process-status refetch로 step2 진입) |

**Transition:** submit → `createApprovalRequest` → `refreshProject` (`getProject`) → 화면이 step 2로 전환.

### 3. UI 컴포넌트
`WaitingTargetConfirmationStep.tsx`
→ `ProjectPageMeta` (AWS identity) · `ProcessStatusCard` · `GuideCardContainer`(slotKey)
→ **`candidate/CandidateResourceSection.tsx`** (데이터 소유, `useEffect` fetch + `AbortController`)
  → `ScanController`(`ScanPanel`) / `ScanRunningState` / `ScanErrorState` / `ScanEmptyState`
  → `candidate/CandidateResourceTable.tsx` (행 체크 + 인라인 endpoint draft, `VmDatabaseConfigPanel`)
  → 제출 모달 `idc/modals/IdcSubmitModal` (총/선택/제외 카운트; 이름만 IDC, cloud 공용)
→ `RejectionAlert`.
**Data hooks:** `useApiMutation`(approval) · `useModal` · `useToast`. (전용 fetch hook 없음 — 컴포넌트
`useEffect`가 직접 `getConfirmResources` 호출.)

### 4. API Client (`@/app/lib/api`)
- `getConfirmResources(id, {signal})` → `GET /target-sources/{id}/resources` (`fetchInfraCamelJson`)
- `createApprovalRequest(id, input)` → `POST /target-sources/{id}/approval-requests` (`fetchInfraJson`)
- `getProject(id)` → `GET /target-sources/{id}` (`fetchInfraCamelJson` → `extractTargetSource`)

### 5. Adapter 계층 (full chain)
- **`getConfirmResources`**: `app/lib/api/index.ts#getConfirmResources` → route
  `app/integration/api/v1/target-sources/[targetSourceId]/resources/route.ts (GET)` →
  `bff.confirm.getResources` → mock `lib/bff/mock/confirm.ts#getResources` →
  `lib/mock-data.ts#getProjectByTargetSourceId` (catalog → `{resources, total_count}`).
- **`createApprovalRequest`**: `app/lib/api/index.ts#createApprovalRequest` (+
  `lib/approval-bff.ts#normalizeApprovalRequestBody/Summary`) → route
  `.../approval-requests/route.ts (POST)` (calls `bff.confirm.createApprovalRequest` **and**
  `bff.confirm.getProcessStatus` for `AUTO_APPROVED` fallback) →
  `lib/bff/mock/confirm.ts#createApprovalRequest` (+ `#getProcessStatus`) →
  `lib/mock-data.ts` (project mutation: process-status advance / auto-approve).
- **`getProject`**: `app/lib/api/index.ts#getProject` → route
  `.../[targetSourceId]/route.ts (GET)` → `bff.targetSources.get` →
  `lib/bff/mock/target-sources.ts#get` → `lib/mock-data.ts`.
- **`startScan`** (Run Infra Scan): `app/lib/api/scan.ts#startScan` → route
  `.../target-sources/[targetSourceId]/scan/route.ts (POST)` → `bff.scan.create`. **`getLatestScanJob`**
  (폴링): `app/lib/api/scan.ts#getLatestScanJob` → `.../scanJob/latest/route.ts (GET)` → `bff.scan.getStatus`.
  `ScanController` (`features/scan/ScanPanel`) owns the trigger/poll; on completion `CandidateResourceSection#handleScanComplete` re-runs `getConfirmResources` **and** `refreshProject` (`getProject`).

---

## Step 2 — WAITING_APPROVAL (승인 대기)

### 1. 작업 내용
관리자 승인 대기 화면. 제출된 승인 요청 스냅샷(선택/제외 리소스)을 통계·테이블로 보여주고, 요청자/요청
시각을 표시한다. 사용자는 요청을 취소할 수 있다. 관리자가 서버에서 승인하면 **폴링으로** 자동 step 3 전이.

### 2. Action(버튼) + API Call
| 버튼 / 상호작용 | API Call | 비고 |
|---|---|---|
| mount | `GET /target-sources/{id}/approved-integration` | `getApprovedIntegration` (스냅샷 행) |
| mount | `GET /target-sources/{id}/approval-requests/latest` | `getApprovalRequestLatest` (요청자/시각) |
| 검색 / 필터(`전체`·`대상`·`비대상`) / DB-type·region 드롭다운 / pagination | **API 호출 없음** | fetched 데이터 위 client-side |
| `연동 대상 승인 요청 취소` → `요청 취소` | `POST /target-sources/{id}/approval-requests/cancel` | `cancelApprovalRequest` |
| 취소 직후 | `GET /target-sources/{id}` | `refreshProject` → step 1로 복귀 |
| (백그라운드) ProcessStatusCard | `GET /target-sources/{id}/process-status` (10s poll) → 변경 시 `GET /target-sources/{id}` | 승인되면 step 3 자동 전이 |

**Transition (advance):** ProcessStatusCard 폴링(`getProcessStatus`)이 상태 변화를 감지 → `getProject` →
`onProjectUpdate`. (버튼이 아니라 폴링으로 advance.)

### 3. UI 컴포넌트
`WaitingApprovalStep.tsx`
→ `ProjectPageMeta` · `ProcessStatusCard`(폴링 주체) · `GuideCardContainer`
→ **`layout/WaitingApprovalCard.tsx`** (데이터 소유, 두 fetch 병렬 `useEffect`)
  → `WaitingApprovalStats` · `WaitingApprovalToolbar`(검색/필터/드롭다운) · `WaitingApprovalTable` ·
    `Pagination` · `StepBanner` · `shared/async-state-views`(Loading/ErrorRow)
  → `cancelSlot` = `layout/WaitingApprovalCancelButton.tsx` (`isRejected`면 null) → `ConfirmStepModal`
→ `RejectionAlert`.
**Data hooks:** `useApiMutation`(cancel) · `useModal`. (전용 fetch hook 없음.)

### 4. API Client
- `getApprovedIntegration(id, {signal})` → `GET /target-sources/{id}/approved-integration`
- `getApprovalRequestLatest(id, {signal})` → `GET /target-sources/{id}/approval-requests/latest`
- `cancelApprovalRequest(id)` → `POST /target-sources/{id}/approval-requests/cancel`
- (poll) `getProcessStatus(id)` → `GET /target-sources/{id}/process-status`; `getProject(id)`.

### 5. Adapter 계층 (full chain)
- **`getApprovedIntegration`**: `app/lib/api/index.ts#getApprovedIntegration` → route
  `.../approved-integration/route.ts (GET)` (`lib/approval-bff.ts#normalizeApprovedIntegration`;
  404→`APPROVED_INTEGRATION_NOT_FOUND` problem) → `bff.confirm.getApprovedIntegration` →
  `lib/bff/mock/confirm.ts#getApprovedIntegration` → `lib/mock-data.ts`.
- **`getApprovalRequestLatest`**: `app/lib/api/index.ts#getApprovalRequestLatest` → route
  `.../approval-requests/latest/route.ts (GET)` → `bff.confirm.getApprovalRequestLatest` →
  `lib/bff/mock/confirm.ts#getApprovalRequestLatest` → `lib/mock-data.ts`.
- **`cancelApprovalRequest`**: `app/lib/api/index.ts#cancelApprovalRequest` (maps to
  `{success:true}`) → route `.../approval-requests/cancel/route.ts (POST)` →
  `bff.confirm.cancelApprovalRequest` → `lib/bff/mock/confirm.ts#cancelApprovalRequest` →
  `lib/mock-data.ts` (revert to step 1).
- **`getProcessStatus`**: `app/lib/api/index.ts#getProcessStatus` → route
  `.../process-status/route.ts (GET)` → `bff.confirm.getProcessStatus` →
  `lib/bff/mock/confirm.ts#getProcessStatus` → `lib/mock-data.ts`.

---

## Step 3 — APPLYING_APPROVED (승인 반영중)

### 1. 작업 내용
승인 반영중(read-only) 화면. 승인 적용 진행 배너(`ApprovalApplyingBanner`)와 승인된 연동 정보
(승인자/승인 시각 + 선택/제외 리소스)를 보여준다. 사용자 동작 없음 — 서버 반영이 끝나면 **폴링으로**
자동 step 4 전이.

### 2. Action(버튼) + API Call
| 버튼 / 상호작용 | API Call | 비고 |
|---|---|---|
| mount | `GET /target-sources/{id}/approved-integration` | `getApprovedIntegration` (`ApprovedIntegrationSection`) |
| `다시 시도` (error 시) | `GET /target-sources/{id}/approved-integration` | refetch |
| (백그라운드) ProcessStatusCard | `GET /target-sources/{id}/process-status` (10s poll) → `GET /target-sources/{id}` | 반영 완료 시 step 4 자동 전이 |

**Transition (advance):** ProcessStatusCard 폴링 → `getProject` → step 4. (버튼 advance 아님.)

### 3. UI 컴포넌트
`ApplyingApprovedStep.tsx`
→ `ProjectPageMeta` · `ProcessStatusCard`(폴링 주체) · `GuideCardContainer`
→ `process-status/ApprovalApplyingBanner.tsx` (`data-testid="approval-applying"`)
→ **`approved/ApprovedIntegrationSection.tsx`** (데이터 소유, `useEffect` fetch)
  → `approved/ApprovedIntegrationTable.tsx`
→ `RejectionAlert`.

### 4. API Client
- `getApprovedIntegration(id, {signal})` → `GET /target-sources/{id}/approved-integration` (step 2와 동일)

### 5. Adapter 계층 (full chain)
- **`getApprovedIntegration`**: 동일 체인 — `app/lib/api/index.ts#getApprovedIntegration` → route
  `.../approved-integration/route.ts (GET)` → `bff.confirm.getApprovedIntegration` →
  `lib/bff/mock/confirm.ts#getApprovedIntegration` → `lib/mock-data.ts`.
- (advance poll) `getProcessStatus` 체인은 step 2 참조.

---

## Step 4 — INSTALLING (Agent 설치) — **AWS divergence is largest here**

### 1. 작업 내용
AWS Agent 설치 진행 화면. 확정된 연동 리소스 목록과 설치 파이프라인을 표시한다. AWS는 `AUTO`/`MANUAL`
**install-mode에 따라 화면이 달라진다**:
- **AUTO:** 3-컬럼 파이프라인 — `Terraform 권한 부여 확인` → `서비스 측 계정에 리소스 생성` →
  `BDC 측 리소스 생성` (비클릭 카드, 시스템이 TF 자동 실행).
- **MANUAL:** TF 스크립트 다운로드 카드(`TfDownloadCard`, `12.4 KB`) + 2-컬럼 파이프라인
  (`서비스 측 Terraform 생성` → `BDC 측 리소스 생성`). 권한 카드 없음.
설치가 모두 완료되면(`actionSummary.serviceActionRequired==false && bdcInstallationRequired==false`)
완료 콜백이 한 번 발화되어 step 5로 전이한다.

### 2. Action(버튼) + API Call
| 버튼 / 상호작용 | API Call | 비고 |
|---|---|---|
| mount (확정 리소스) | `GET /target-sources/{id}/confirmed-integration` | `getConfirmedIntegration` (`ConfirmedIntegrationDataProvider`) |
| mount (설치 상태) | `GET /aws/target-sources/{id}/installation-status` | `getAwsInstallationStatus` (`useInstallationStatus`) |
| `Terraform 스크립트 다운로드` (MANUAL만) | `GET /aws/target-sources/{id}/terraform-script` | `getAwsTerraformScript`; `window.open` 새 탭으로 `downloadUrl` 이동 |
| `가이드 보기` (MANUAL) | **API 없음** | `TfScriptGuideModal` 열기 |
| 설치 완료 감지 | (콜백) `onInstallComplete` → `refreshProject` → `GET /target-sources/{id}` | step 5 advance |

> **AWS divergence — refresh 버튼 없음.** Azure/GCP inline은 `새로고침`(POST `check-installation`)
> 버튼을 노출하지만, **`AwsInstallationInline`은 새로고침 버튼을 렌더하지 않는다.** `checkAwsInstallation`
> (`POST /aws/target-sources/{id}/check-installation`)는 `useInstallationStatus`에 `checkFn`으로 넘겨지나
> AWS inline은 그 `refresh`를 호출하는 UI가 없다 (grep으로 호출부 없음 확인). AWS는 mount 시 1회 GET +
> 완료 시 콜백 모델. (`checkAwsInstallation`·`setAwsInstallationMode`는 정의되어 있고 install-mode 게이트가
> `setAwsInstallationMode`를 호출한다.)
>
> **AWS divergence — manual-only 다운로드 / AUTO 시 403-유사.** `getAwsTerraformScript`는 MANUAL
> (`hasExecutionPermission==false`) 전용. AUTO(권한 보유) 상태에서 호출하면 mock이 400
> `"TF 권한이 있어 스크립트가 필요하지 않습니다."`를 반환하고 route가 500 problem으로 surface한다
> (curl `aws/target-sources/1008/terraform-script` → 500 확인). 그래서 AUTO 화면엔 다운로드 카드가 없다.
>
> **AWS-specific status shape:** `installation-status`는 `{ hasExecutionPermission, serviceScripts[]
> (scriptId/terraformScriptName/status/resourceCount/region/resources[]), bdcStatus.status, lastCheck,
> actionSummary }` — Azure(`privateEndpoint`/`vmInstallation`)·GCP(`serviceSideSubnetCreation` 등)와
> 전혀 다른 스키마. 리소스 타입도 RDS / DYNAMODB / ATHENA 등 AWS 고유.

**Transition (advance):** 명시적 버튼이 아니라 `useInstallationStatus({isComplete, onComplete})` —
설치 status가 완전 완료로 판정되면 `onInstallComplete`(=`refreshProject`=`getProject`) 1회 발화 → step 5.

### 3. UI 컴포넌트
`InstallingStep.tsx` → `layout/CloudInstallingStep.tsx`
→ `ConfirmedIntegrationDataProvider`(확정 리소스 fetch) wrapping:
  · `ProjectPageMeta`(+`ProviderBadge` AWS) · `ProcessStatusCard` · `GuideCardContainer`
  · **`layout/InstallationStatusSlot.tsx`** → (provider switch `AWS`) →
    `aws/AwsInstallationStatus.tsx` (thin) → **`process-status/aws/AwsInstallationInline.tsx`**
    - AUTO: `install-task-pipeline/InstallTaskPipeline` `columns={3}` items=`buildAwsAutoItems(status)`
    - MANUAL: `install-task-pipeline/TfDownloadCard` + `InstallTaskPipeline` `columns={2}`
      items=`buildAwsManualItems(status)`
    - `aws/TfScriptGuideModal` (가이드)
    - 로딩/에러: `shared/InstallationLoadingView` / `InstallationErrorView`
  · `layout/ConfirmedResourcesSlot.tsx`
  · `RejectionAlert`.
**Data hooks:** **`useInstallationStatus<AwsInstallationStatus>`** (`app/hooks/useInstallationStatus.ts`;
`getFn=getAwsInstallationStatus`, `checkFn=checkAwsInstallation`(미사용 UI), `isComplete`, `onComplete`)
· `ConfirmedIntegrationDataProvider`(context: `useConfirmedIntegration`) · `useToast`.
**Pipeline item 빌더:** `lib/constants/aws-install.ts#buildAwsAutoItems` / `buildAwsManualItems`
(+`aggregateServiceScripts`, `mapScriptStatus`, `permissionCardStatus`).

### 4. API Client (`@/app/lib/api/aws`)
- `getAwsInstallationStatus(id)` → `GET /aws/target-sources/{id}/installation-status` (`fetchInfraCamelJson`)
- `checkAwsInstallation(id)` → `POST /aws/target-sources/{id}/check-installation` (`fetchInfraCamelJson`) — UI 미호출
- `getAwsTerraformScript(id)` → `GET /aws/target-sources/{id}/terraform-script` (`fetchInfraCamelJson`) — MANUAL
- `setAwsInstallationMode(id, mode)` → `POST /aws/target-sources/{id}/installation-mode` (`fetchInfraJson`) — install-mode 게이트
- `getConfirmedIntegration(id)` → `GET /target-sources/{id}/confirmed-integration`

### 5. Adapter 계층 (full chain)
- **`getAwsInstallationStatus`**: `app/lib/api/aws.ts#getAwsInstallationStatus` → route
  `app/integration/api/v1/aws/target-sources/[targetSourceId]/installation-status/route.ts (GET)`
  (applies `app/integration/api/v1/aws/target-sources/_lib/installation-transform.ts
  #transformAwsInstallationStatus`: legacy→v1 shape) → `bff.aws.getInstallationStatus` → mock
  `lib/bff/mock/aws.ts#getInstallationStatus` → `lib/mock-installation.ts#getInstallationStatus`
  (lazy `initializeInstallation` if absent; reads `mock-store#getStore().awsInstallations`).
  Real path: `lib/bff/http.ts#aws.getInstallationStatus` → `GET /aws/projects/{id}/installation-status`.
- **`checkAwsInstallation`** (defined, UI-unused): `app/lib/api/aws.ts#checkAwsInstallation` → route
  `.../aws/.../check-installation/route.ts (POST)` (same `transformAwsInstallationStatus`) →
  `bff.aws.checkInstallation` → `lib/bff/mock/aws.ts#checkInstallation` →
  `lib/mock-installation.ts#checkInstallation` (MANUAL: validates pending scripts, advances BDC TF;
  `id.includes('fail')` → FAILED). Real: `POST /aws/projects/{id}/check-installation`.
- **`getAwsTerraformScript`**: `app/lib/api/aws.ts#getAwsTerraformScript` → route
  `.../aws/.../terraform-script/route.ts (GET)` → `bff.aws.getTerraformScript` →
  `lib/bff/mock/aws.ts#getTerraformScript` (returns 400 if `hasTfPermission`) →
  `lib/mock-installation.ts#getTerraformScript` (`{ downloadUrl, fileName, expiresAt }`).
  Real: `GET /aws/projects/{id}/terraform-script`.
- **`setAwsInstallationMode`**: `app/lib/api/aws.ts#setAwsInstallationMode` → route
  `.../aws/.../installation-mode/route.ts (POST)` → `bff.aws.setInstallationMode` →
  `lib/bff/mock/aws.ts#setInstallationMode` (`mockData.updateProject` + `initializeInstallation`) →
  `lib/mock-installation.ts#initializeInstallation`. Real: `POST /aws/projects/{id}/installation-mode`.
- **`getConfirmedIntegration`**: `app/lib/api/index.ts#getConfirmedIntegration` → route
  `.../target-sources/[targetSourceId]/confirmed-integration/route.ts (GET)`
  (`lib/approval-bff.ts#normalizeConfirmedIntegration`; empty→`CONFIRMED_INTEGRATION_NOT_FOUND` 404) →
  `bff.confirm.getConfirmedIntegration` → `lib/bff/mock/confirm.ts#getConfirmedIntegration` →
  `lib/mock-data.ts`.

---

## Step 5 — WAITING_CONNECTION_TEST (연결 테스트)

### 1. 작업 내용
연결 테스트 화면. 확정 리소스 목록 + 연결 테스트 패널 + 논리 DB 슬롯을 보여준다. 사용자가
`연결 테스트 수행`을 누르면 테스트 작업이 생성되고, 패널이 최신 결과를 4초 간격으로 폴링한다.
크리덴셜이 없거나 직전 테스트가 실패면 먼저 크리덴셜 설정을 유도한다. 성공 시 step 6 전이.

### 2. Action(버튼) + API Call
| 버튼 / 상호작용 | API Call | 비고 |
|---|---|---|
| mount + poll (≈4s) | `GET /target-sources/{id}/test-connection/latest` | `getTestConnectionLatest` (`useTestConnectionPolling`, `interval=4_000`) |
| mount (확정 리소스) | `GET /target-sources/{id}/confirmed-integration` | `getConfirmedIntegration` (`ConfirmedIntegrationDataProvider`) |
| `연결 테스트 수행` | `POST /target-sources/{id}/test-connection` | `triggerTestConnection` → 폴링 시작 |
| cred 확인 | `GET /target-sources/{id}/secrets` | `getSecrets` (크리덴셜 누락 판단) |
| cred 저장 (모달 내부) | `PUT /target-sources/{id}/resources/credential` | `updateResourceCredential` (`CredentialSetupModal.handleSave`) |
| `전체 내역 →` (history modal) | `GET /target-sources/{id}/test-connection/results?page=&size=` | `getTestConnectionResults` |

> `test-connection/latest`는 프로젝트가 존재하지만 테스트 job이 없으면 **404 `TEST_CONNECTION_NOT_FOUND`**
> (`연결 테스트 이력이 없습니다.`)를 반환한다 (`TARGET_SOURCE_NOT_FOUND`는 프로젝트 자체가 없을 때만).
> 폴링 훅은 이를 잡아 `null`(IDLE 상태)로 처리하며, 폴링은 `status !== 'PENDING'`이면 중단.

**Transition (advance):** 폴링이 job `SUCCESS`를 관측하면 `ConnectionTestPanel`의 `PENDING → SUCCESS`
effect가 `onResourceUpdate`(=`ConnectionTestSlot`을 통해 `WaitingConnectionTestStep#refreshProject` → `getProject`)를 호출한다.
mock(`lib/mock-test-connection.ts`)은 이미 `processStatus`를 `CONNECTION_VERIFIED`로 전환해 두므로 재조회로 step 6 화면 전이.
(AWS도 cloud 공용 ConnectionTestPanel 경로 그대로.)

### 3. UI 컴포넌트
`WaitingConnectionTestStep.tsx`
→ `ConfirmedIntegrationDataProvider` wrapping:
  · `ProjectPageMeta` · `ProcessStatusCard` · `GuideCardContainer`
  · `layout/ConfirmedResourcesSlot.tsx`
  · **`layout/ConnectionTestSlot.tsx`** (`useConfirmedIntegration`; ready일 때만) →
    `process-status/ConnectionTestPanel` (`confirmed`, `onResourceUpdate=refreshProject`)
  · `logical-db/LogicalDbSlot.tsx`
  · `RejectionAlert`.
**Data hooks:** **`useTestConnectionPolling`** (`app/hooks/useTestConnectionPolling.ts`; `usePollingBase`,
`getTestConnectionLatest` 4s poll + `triggerTestConnection`) · `ConfirmedIntegrationDataProvider`
(`useConfirmedIntegration`) · (panel 내) `getSecrets` 호출.

### 4. API Client
- `getTestConnectionLatest(id, {signal})` → `GET /target-sources/{id}/test-connection/latest`
- `triggerTestConnection(id)` → `POST /target-sources/{id}/test-connection`
- `getTestConnectionResults(id, page, size)` → `GET /target-sources/{id}/test-connection/results?page=&size=`
- `getSecrets(id)` → `GET /target-sources/{id}/secrets`
- `updateResourceCredential(id, resourceId, credentialId)` → `PUT /target-sources/{id}/resources/credential` (`CredentialSetupModal`)
- `getConfirmedIntegration(id, {signal})` → `GET /target-sources/{id}/confirmed-integration`

### 5. Adapter 계층 (full chain)
- **`getTestConnectionLatest`**: `app/lib/api/index.ts#getTestConnectionLatest` → route
  `.../test-connection/latest/route.ts (GET)` → `bff.confirm.getTestConnectionLatest` →
  `lib/bff/mock/confirm.ts#getTestConnectionLatest` → `lib/mock-test-connection.ts`. 프로젝트가 없으면
  404 `TARGET_SOURCE_NOT_FOUND`; 프로젝트는 있으나 job이 없으면 404 `TEST_CONNECTION_NOT_FOUND`.
- **`triggerTestConnection`**: `app/lib/api/index.ts#triggerTestConnection` → route
  `.../test-connection/route.ts (POST)` → `bff.confirm.testConnection` →
  `lib/bff/mock/confirm.ts#testConnection` → `lib/mock-test-connection.ts`.
- **`getTestConnectionResults`**: `app/lib/api/index.ts#getTestConnectionResults` → route
  `.../test-connection/results/route.ts (GET)` → `bff.confirm.getTestConnectionResults` →
  `lib/bff/mock/confirm.ts` → `lib/mock-test-connection.ts`.
- **`getSecrets`**: `app/lib/api/index.ts#getSecrets` → route `.../secrets/route.ts (GET)` →
  `bff.projects.credentials` → `lib/bff/mock/projects.ts#mockProjects.credentials` →
  `lib/mock-data.ts`. (**Not** `bff.confirm` / `lib/bff/mock/confirm.ts`.)
- **`updateResourceCredential`** (Credential 저장): `app/lib/api/index.ts#updateResourceCredential` →
  route `.../resources/credential/route.ts (PUT)` → `bff.confirm.updateResourceCredential`. Called by
  `connection-test/CredentialSetupModal.tsx#handleSave` (per missing resource).
- **`getConfirmedIntegration`**: step 4 체인과 동일.

---

## Step 6 — CONNECTION_VERIFIED (연결 확인됨)

### 1. 작업 내용
연결 확인됨 화면. `완료 여부 관리자 승인 대기` 카드 — 최종 관리자 승인이 완료되면 모니터링이 시작된다는
안내 배너 + 확정 리소스 목록(bare)을 표시한다. 실제 advancing 동작은 없다(재실행 버튼은 stub).

### 2. Action(버튼) + API Call
| 버튼 / 상호작용 | API Call | 비고 |
|---|---|---|
| mount | `GET /target-sources/{id}/confirmed-integration` | `getConfirmedIntegration` |
| `연결 테스트 재실행` | **API 없음** | `toast.info('연결 테스트 재실행 기능 준비중입니다.')` (stub) |

**Transition:** 화면 내 advance 없음 (서버 측 최종 승인은 페이지 재진입/외부 경로로 step 7 반영).

### 3. UI 컴포넌트
`ConnectionVerifiedStep.tsx`
→ `ConfirmedIntegrationDataProvider` wrapping:
  · `ProjectPageMeta` · `ProcessStatusCard` · `GuideCardContainer`
  · 카드(`완료 여부 관리자 승인 대기`) + `StepBanner`(info) + `layout/ConfirmedResourcesSlot.tsx`(`bare`)
  · `ConnectionVerifiedRetestButton` (로컬 컴포넌트, `useToast` stub, `WARNING_OUTLINE_BUTTON_CLASS`)
  · `RejectionAlert`.
**Data hooks:** `ConfirmedIntegrationDataProvider`(`useConfirmedIntegration`) · `useToast`.

### 4. API Client
- `getConfirmedIntegration(id, {signal})` → `GET /target-sources/{id}/confirmed-integration`

### 5. Adapter 계층 (full chain)
- **`getConfirmedIntegration`**: step 4 체인과 동일 —
  `app/lib/api/index.ts#getConfirmedIntegration` → route `.../confirmed-integration/route.ts (GET)`
  (`normalizeConfirmedIntegration`) → `bff.confirm.getConfirmedIntegration` →
  `lib/bff/mock/confirm.ts#getConfirmedIntegration` → `lib/mock-data.ts`.

---

## Step 7 — INSTALLATION_COMPLETE (연동 완료)

### 1. 작업 내용
연동 완료 화면. `PII 모니터링 모듈 연동 완료` 카드 — 헤더 우측에 집계 헬스 배지, 본문에 확정 리소스
목록(`variant="complete"`, 헬스 컬럼)과 `인프라 변경`/`연결 테스트 재실행` 액션을 표시한다. 두 액션
모두 `준비중` toast stub.

### 2. Action(버튼) + API Call
| 버튼 / 상호작용 | API Call | 비고 |
|---|---|---|
| mount | `GET /target-sources/{id}/confirmed-integration` | `getConfirmedIntegration` (헬스 집계 `aggregateHealth`) |
| `인프라 변경` | **API 없음** | `toast.info('인프라 변경 기능 준비중입니다.')` (stub) |
| `연결 테스트 재실행` | **API 없음** | `toast.info('연결 테스트 재실행 기능 준비중입니다.')` (stub) |

> 페이지 자체는 SSR로 진입한다: `page.tsx` 서버 컴포넌트가 `@/lib/bff/client`의 `bff.targetSources.get(id)`를
> **직접 호출**하고 `extractTargetSource`로 변환한다 (HTTP 요청·route.ts·client `getProject` 미경유; 그 chain은 CSR `refreshProject` 전용).
> `processStatus: 7` + 프로젝트 health를 싣는다. `confirmInstallation`
> (`POST /target-sources/{id}/pii-agent-installation/confirm`)는 DAL/route에 존재하나 이 step의 가시 버튼에
> 연결돼 있지 않다(stub만).

**Transition:** 종단 step — advance 없음.

### 3. UI 컴포넌트
`InstallationCompleteStep.tsx`
→ `ConfirmedIntegrationDataProvider` wrapping:
  · `ProjectPageMeta` · `ProcessStatusCard` · `GuideCardContainer`
  · 카드(`PII 모니터링 모듈 연동 완료`) 헤더 우측 `InstallationCompleteHeaderRight`
    (`useConfirmedIntegration` + `confirmed/HealthBadge` + `confirmed/health-status#aggregateHealth`)
  · 본문 `InstallationCompleteActions`(2 stub 버튼) + `layout/ConfirmedResourcesSlot.tsx`
    (`variant="complete"`, `bare`)
  · `RejectionAlert`.
**Data hooks:** `ConfirmedIntegrationDataProvider`(`useConfirmedIntegration`) · `useToast`.

### 4. API Client
- `getConfirmedIntegration(id, {signal})` → `GET /target-sources/{id}/confirmed-integration`
- (SSR 진입) client DAL 미사용 — `page.tsx`가 `bff.targetSources.get(id)` + `extractTargetSource` 직접 호출 (CSR `getProject`/route.ts 아님).

### 5. Adapter 계층 (full chain)
- **`getConfirmedIntegration`**: step 4/6 체인과 동일 — `app/lib/api/index.ts#getConfirmedIntegration`
  → route `.../confirmed-integration/route.ts (GET)` → `bff.confirm.getConfirmedIntegration` →
  `lib/bff/mock/confirm.ts#getConfirmedIntegration` → `lib/mock-data.ts`.
- **initial SSR load** (진입): `app/integration/target-sources/[targetSourceId]/page.tsx` →
  `bff.targetSources.get(id)` (`@/lib/bff/client`) → `lib/bff/mock/target-sources.ts#get` (real → `GET /install/v1/target-sources/{id}`)
  → `lib/target-source-response.ts#extractTargetSource`. `/integration/api/v1` HTTP hop 없음; CSR `getProject` → route.ts chain은 `refreshProject` refetch 전용.

---

## AWS divergence summary (vs Azure/GCP)

1. **Install-mode gate (step 1 entry).** Only AWS has `AwsInstallationModeSelector`
   (`setAwsInstallationMode` → `POST /aws/target-sources/{id}/installation-mode`) before the layout.
2. **Identity fields.** AWS → `AWS Account ID` + `Region Type` (`awsAccountId`/`awsRegionType`); no
   tenant/subscription (Azure) or `GCP Project ID` (GCP, `gcpProjectId`). `monitoringMethod: 'AWS Agent'`.
3. **Step 4 install internals.** AWS status shape is
   `serviceScripts[] + bdcStatus + hasExecutionPermission + actionSummary` (TF script pipeline),
   transformed by `installation-transform.ts#transformAwsInstallationStatus`. Azure uses
   `privateEndpoint`/`vmInstallation`; GCP uses subnet/terraform-apply stages.
4. **No refresh button on AWS install.** Azure/GCP inline render `새로고침` → `check-installation`
   POST; AWS inline renders only the (MANUAL) download card + pipeline. `checkAwsInstallation` exists
   but is unreached by UI; advance is via `onComplete → refreshProject`.
5. **MANUAL-only terraform download.** `getAwsTerraformScript` is AWS-only; in AUTO mode it 400/500s
   (`TF 권한이 있어 스크립트가 필요하지 않습니다.`).
6. **bff route base differs.** Real `httpBff.aws.*` hits `/aws/projects/{id}/...` (not
   `/target-sources/...`); the Next route base is `/aws/target-sources/{id}/...`.

## Cross-references
- `docs/api/step-actions-and-apis.md` — per-step baseline + curl samples.
- `docs/api/boundaries.md` — CSR → Next route → BFF two-hop, prefix `/integration/api/v1`.
- `docs/swagger/aws.yaml` — AWS installation-status / check-installation / terraform-script / installation-mode.
- `lib/bff/{client,http,mock-adapter}.ts`, `lib/bff/mock/aws.ts`, `lib/mock-installation.ts`,
  `app/integration/api/v1/aws/target-sources/_lib/installation-transform.ts`.
