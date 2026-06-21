# IDC — Step Detail

Source-verified, IDC-specific (`serviceCode = idc`) detail for the target-source detail page
(`/integration/target-sources/[targetSourceId]`), covering all 7 process steps. Companion to
`docs/api/step-actions-and-apis.md` (cross-cloud overview) — this file goes deeper and is IDC-only.

## How to read this doc

- **Routing.** `ProcessStatus` (the SSR-resolved `project.processStatus`) selects the renderer.
  For IDC: `IdcProjectPage.tsx` → `IdcTargetSourceLayout.tsx` → `renderStep()` switch →
  `steps/IdcStep<N>*.tsx`. Each step component receives the shared `IdcStepProps`
  (`{ project, identity, providerLabel, action, onProjectUpdate }` — `idc/types.ts`).
- **Identity (IDC divergence).** `IdcProjectPage` hard-codes a *minimal* identity (결정 #49):
  `{ cloudProvider: 'IDC', monitoringMethod: 'IDC Agent', jiraLink: null, identifiers: [] }`.
  IDC has **no** tenant/subscription/datacenter identifiers — unlike Azure (`tenantId`/`subscriptionId`),
  GCP, AWS. `providerLabel = "IDC Infrastructure"`, `action = <DeleteInfrastructureButton />`.
- **Adapter chain (every IDC `/idc/...` call).** Five hops:
  1. CSR client fn — `app/lib/api/idc.ts` (`fetchInfraJson`, prefix `/integration/api/v1`).
  2. Next route handler — `app/integration/api/v1/idc/target-sources/[targetSourceId]/.../route.ts`
     (`withV1` + `parseTargetSourceId` → `bff.idc.*`).
  3. BFF client — `lib/bff/client.ts` picks `httpBff` (`lib/bff/http.ts`, real upstream) **or**
     `mockBff` (`lib/bff/mock-adapter.ts`) by `USE_MOCK_DATA === 'true'`.
  4. Mock dispatch — `lib/bff/mock/idc.ts` (`mockIdc.*`: auth + `NextResponse` wrapping).
  5. Mock impl — `lib/mock-idc.ts` (`idcFns.*`: in-memory `idcStore`, returns wire snake_case).
- **Wire↔domain boundary (IDC divergence).** IDC responses are **raw snake passthrough** — `httpBff`
  fetches them with `{ raw: true }` (bypasses `camelCaseKeys`). The single conversion site is
  `app/lib/api/idc.ts` (`toIdcResourceView` / `toIdcResourceInput` / `toIdcInstallationView`); the wire
  shape (`lib/bff/types/idc.ts`) never leaks past it. Cloud, by contrast, camelCases at the BFF layer.
- **Transitions.** "Advance to next step" = the `project.processStatus` changes and the subtree re-renders.
  Two mechanisms:
  - **Steps 2 & 3 advance via `ProcessStatusCard` polling.** `ProcessStatusCard` polls
    `getProcessStatus(id)` (`GET /target-sources/{id}/process-status`) every `TIMINGS.PROCESS_STATUS_POLL_MS`
    **only** when `currentStep ∈ {WAITING_APPROVAL, APPLYING_APPROVED}`. Expected BFF status is `PENDING`
    (step 2) / `CONFIRMING` (step 3); when the polled status differs it calls `getProject(id)` →
    `onProjectUpdate`, advancing the step. No other step polls.
  - **Other steps advance via action→refetch.** Step 1 submit calls `createApprovalRequest` then
    `getProject` → `onProjectUpdate` (jumps 1→2). Step-2 cancel calls `cancelApprovalRequest` then
    `getProject` (drops 2→1). Steps 4–7 IDC actions are refresh/local-sim/toast stubs and do **not**
    transition.
- **ID map** (mock target-source ids, same as the overview doc): step1=1020, 2=1021, 3=1022, 4=1023,
  5=1024, 6=1025, 7=1026. Curl base: `http://localhost:3000/integration/api/v1`.

---

## Step 1 — WAITING_TARGET_CONFIRMATION (연동 대상 DB 입력)

### 1. 작업 내용

IDC infra has **no auto-scan**, so the user authors the DB list by hand. The step shows an editable list
(`연동 대상 DB 입력`) seeded from the server, lets the user add/edit/delete rows, exclude rows with a reason,
paginate, and finally request approval. The working list lives in **component state** (`useState<IdcStep1Row[]>`),
not a hook — edits are local until 제출. Footer shows `총 N건 · 연동 M건 · 제외 K건`.

### 2. Action(버튼) + API Call

| Action | API call (method + internal path) | Transition |
|--------|-----------------------------------|------------|
| mount (seed list) | `GET /idc/target-sources/{id}/resources` | none |
| `기존 연동 요청 정보 불러오기` → opens `IdcLoadRequestModal`; modal mount fetches | `GET /idc/target-sources/{id}/previous-request` | none; `불러오기` replaces local rows (no API) |
| `연동 대상 추가` / row `수정` → `IdcTargetFormModal`; `저장` | **no API** — mutates local `rows` only | none |
| row checkbox uncheck → `IdcExclusionPopover` → preset / `직접 입력` → `IdcExclusionReasonModal` `저장` | **no API** — sets `excluded`/`exclusionReason` locally | none |
| row `삭제`, pagination, page-size | **no API** — local state | none |
| `연동 대상 승인 요청` → `IdcSubmitModal` `제출하기` | (a) `PUT /idc/target-sources/{id}/resources` then (b) `POST /target-sources/{id}/approval-requests` then (c) `GET /target-sources/{id}` | **1→2** via `createApprovalRequest` + `getProject`→`onProjectUpdate` |

`제출하기` (`handleSubmit`) sequence: `updateIdcResources(id, rows)` persists the working list →
maps persisted rows to `resource_inputs` (`{resource_id, selected}` + `exclusion_reason` when excluded) →
`createApprovalRequest(id, { resource_inputs })` → `refreshProject()` (`getProject` → `onProjectUpdate`).
`createApprovalRequest` routes every submission to `WAITING_APPROVAL` (manual admin approval; auto-approval
is off in the demo). `연동 대상 승인 요청` is disabled when `liveCount === 0`.

### 3. UI 컴포넌트

`IdcStep1TargetInput` (orchestrator; rows + 4 modals in local state). Tree:
`ProjectPageMeta` · `ProcessStatusCard` · `GuideCardContainer` (slot via `resolveStepSlot('IDC', WAITING_TARGET_CONFIRMATION)`) ·
card(`연동 대상 DB 입력`) → `LoadingState`/`ErrorState`/`EmptyState` | `IdcTargetListTable` (editable; `onToggle`/`onEdit`/`onDelete`) + `Pagination` ·
`RejectionAlert`. Modals: `IdcTargetFormModal` (add/edit; emits `IdcTargetFormResult`), `IdcLoadRequestModal`
(prev-request preview), `IdcSubmitModal` (전체/연동/미연동 stats), `IdcExclusionReasonModal` (custom reason),
`IdcExclusionPopover` (preset reasons from `IDC_EXCL_PRESETS`).
**Data:** `IdcStep1TargetInput` useEffect (direct `getIdcResources`, AbortController + stale-id guard);
`IdcLoadRequestModal` → `useIdcPreviousRequest` (`getIdcPreviousRequest`).

### 4. API Client (`@/app/lib/api/idc` + `@/app/lib/api`)

- `getIdcResources(id, {signal})` → `GET /idc/target-sources/{id}/resources` (maps via `toIdcResourceView`).
- `getIdcPreviousRequest(id, {signal})` → `GET /idc/target-sources/{id}/previous-request`.
- `updateIdcResources(id, views)` → `PUT /idc/target-sources/{id}/resources` (body `{resources: views.map(toIdcResourceInput)}`).
- `createApprovalRequest(id, input)` — **`@/app/lib/api` (shared)** → `POST /target-sources/{id}/approval-requests`.
- `getProject(id)` — **`@/app/lib/api`** → `GET /target-sources/{id}`.

> IDC divergence: the `/idc/.../resources` GET+PUT pair is IDC-only (cloud has scan-derived candidates).
> `createApprovalRequest` + `getProject` are **shared** with cloud (path is `/target-sources/...`, **not**
> `/idc/...`). `getIdcSourceIpRecommendation` exists in `idc.ts` but is **unused** by Step 1 (the add-form
> uses a hardcoded `defaultSourceIps()` — `['172.16.0.11']` single / `['172.16.0.11','172.16.0.12']` multi).

### 5. Adapter 계층 (full chain)

- **`getIdcResources` (GET resources):**
  `app/lib/api/idc.ts:getIdcResources` → `app/integration/api/v1/idc/target-sources/[targetSourceId]/resources/route.ts:GET`
  → `bff.idc.getResources` (`lib/bff/http.ts` `get('/idc/.../resources', {raw:true})` OR `lib/bff/mock-adapter.ts` `mockIdc.getResources`)
  → `lib/bff/mock/idc.ts:mockIdc.getResources` (auth) → `lib/mock-idc.ts:getIdcResources` (`ensureSeeded` → `IDC_SEED`, 3 rows).
- **`getIdcPreviousRequest` (GET previous-request):**
  `app/lib/api/idc.ts:getIdcPreviousRequest` → `.../previous-request/route.ts:GET` → `bff.idc.getPreviousRequest`
  → `lib/bff/mock/idc.ts:mockIdc.getPreviousRequest` → `lib/mock-idc.ts:getIdcPreviousRequest` (`IDC_PREV_REQUEST_SEED`, 7 rows; `_targetSourceId` ignored).
- **`updateIdcResources` (PUT resources):**
  `app/lib/api/idc.ts:updateIdcResources` → `.../resources/route.ts:PUT` (reads `request.json()`) → `bff.idc.updateResources`
  → `lib/bff/mock/idc.ts:mockIdc.updateResources` → `lib/mock-idc.ts:updateIdcResources` (validates `resources[]`, assigns
  `resource_id ?? idc-r-{id}-{i}-{name}`, writes `idcStore.set(id, incoming)`).
- **`createApprovalRequest` (POST, shared):**
  `app/lib/api/index.ts:createApprovalRequest` → `app/integration/api/v1/target-sources/[targetSourceId]/approval-requests/route.ts:POST`
  (normalizes body + best-effort `getProcessStatus` for fallback) → `bff.confirm.createApprovalRequest`
  → `lib/bff/mock/confirm.ts:mockConfirm.createApprovalRequest` (mock advances the project to WAITING_APPROVAL).
- **`getProject` (GET, shared):** `app/lib/api/index.ts:getProject` → `target-sources/[targetSourceId]/route.ts:GET`
  → `bff.targetSources.get` → `mockBff.targetSources.get` → `lib/bff/mock/target-sources.ts:mockTargetSources.get`
  (real `httpBff.targetSources.get`). No `bff.confirm` hop.

---

## Step 2 — WAITING_APPROVAL (연동 대상 승인 대기)

### 1. 작업 내용

Read-only "waiting for admin approval" screen. Info banner (`관리자 승인을 기다리고 있어요…`) + the submitted DB
list (including excluded rows) + a cancel button. Status pill `승인 대기`.

### 2. Action(버튼) + API Call

| Action | API call | Transition |
|--------|----------|------------|
| mount (snapshot) | `GET /idc/target-sources/{id}/resources` | none |
| `ProcessStatusCard` poll | `GET /target-sources/{id}/process-status` (every `PROCESS_STATUS_POLL_MS`; expects `PENDING`) | **2→3** when polled status ≠ `PENDING` → `getProject`→`onProjectUpdate` |
| `연동 대상 승인 요청 취소` → `ConfirmStepModal` `요청 취소` | `POST /target-sources/{id}/approval-requests/cancel` then `GET /target-sources/{id}` | **2→1** via `getProject`→`onProjectUpdate` |

### 3. UI 컴포넌트

`IdcStep2WaitingApproval`. Tree: `ProjectPageMeta` · `ProcessStatusCard` (owns the poll) · `GuideCardContainer` ·
`section`(`연동 대상 승인 대기`) → `StepBanner variant="info"` + `IdcResourceTable cols={['src','excl']}`
(`excl` ⇒ excluded rows shown) + `WaitingApprovalCancelButton` · `RejectionAlert`.
**Data:** `useIdcResources(targetSourceId)` (shared read hook → `getIdcResources`). `WaitingApprovalCancelButton`
is shared with cloud and runs the cancel mutation via `useApiMutation`.

### 4. API Client

- `getIdcResources(id)` (`@/app/lib/api/idc`) → `GET /idc/target-sources/{id}/resources`.
- `cancelApprovalRequest(id)` (`@/app/lib/api`) → `POST /target-sources/{id}/approval-requests/cancel` (returns `{success:true}`).
- `getProject(id)` (`@/app/lib/api`) → `GET /target-sources/{id}` (on cancel success, via `onSuccess`).
- `getProcessStatus(id)` (`@/app/lib/api`, owned by `ProcessStatusCard`) → `GET /target-sources/{id}/process-status`.

> IDC divergence: IDC shows the snapshot via its own `getIdcResources` rather than the cloud
> `approved-integration` + `approval-requests/latest` pair. Cancel/poll/project-refresh are shared.

### 5. Adapter 계층 (full chain)

- **`getIdcResources`:** same chain as Step 1 (`idc.ts` → `resources/route.ts:GET` → `bff.idc.getResources`
  → `lib/bff/mock/idc.ts:mockIdc.getResources` → `lib/mock-idc.ts:getIdcResources`).
- **`cancelApprovalRequest` (shared):** `app/lib/api/index.ts:cancelApprovalRequest` →
  `target-sources/[targetSourceId]/approval-requests/cancel/route.ts:POST` → `bff.confirm.cancelApprovalRequest`
  → `lib/bff/mock/confirm.ts` (resets project to WAITING_TARGET_CONFIRMATION).
- **`getProcessStatus` (shared):** `app/lib/api/index.ts:getProcessStatus` →
  `target-sources/[targetSourceId]/process-status/route.ts:GET` → `bff.confirm.getProcessStatus` →
  `lib/bff/mock/confirm.ts`.

---

## Step 3 — APPLYING_APPROVED (연동 대상 반영중)

### 1. 작업 내용

Read-only "approved, applying now" screen. Success banner (`승인이 완료되어 시스템에 반영 중입니다. 평균 5분 내외…`)
+ the DB list (excluded rows shown). Status pill `반영중`. **No buttons** that hit the API.

### 2. Action(버튼) + API Call

| Action | API call | Transition |
|--------|----------|------------|
| mount (snapshot) | `GET /idc/target-sources/{id}/resources` | none |
| `ProcessStatusCard` poll | `GET /target-sources/{id}/process-status` (expects `CONFIRMING`) | **3→4** when polled status ≠ `CONFIRMING` → `getProject`→`onProjectUpdate` |

### 3. UI 컴포넌트

`IdcStep3Applying`. Tree: `ProjectPageMeta` · `ProcessStatusCard` (owns poll) · `GuideCardContainer` ·
`section`(`연동 대상 반영중`) → `StepBanner variant="success"` + `IdcResourceTable cols={['src','excl']}` · `RejectionAlert`.
**Data:** `useIdcResources(targetSourceId)`.

### 4. API Client

- `getIdcResources(id)` (`@/app/lib/api/idc`) → `GET /idc/target-sources/{id}/resources`.
- `getProcessStatus(id)` + `getProject(id)` (`@/app/lib/api`, owned by `ProcessStatusCard`).

> IDC divergence: IDC reuses `getIdcResources`; cloud reuses the Step-2 `approved-integration` payload.

### 5. Adapter 계층 (full chain)

- **`getIdcResources`:** identical to Step 1 (`idc.ts` → `resources/route.ts:GET` → `bff.idc.getResources`
  → `mockIdc.getResources` → `lib/mock-idc.ts:getIdcResources`).
- **`getProcessStatus` (shared):** as Step 2.

---

## Step 4 — INSTALLING (Agent 설치)

### 1. 작업 내용

Agent installation progress. Shows a **2-task install pipeline** (`InstallTaskPipeline`, 2 columns):
`BDC 측 리소스 설치 진행` (state from `installation-status.bdc_tf`) and `방화벽 확인` (clickable;
state = `firewall_opened ? done : running`). Below it, the read-only DB list with Source-IP + 방화벽 columns.
A `설치 상태 새로고침` control re-checks installation.

### 2. Action(버튼) + API Call

| Action | API call (method + internal path) | Transition |
|--------|-----------------------------------|------------|
| mount (resource list) | `GET /idc/target-sources/{id}/resources` | none |
| mount (install status) | `GET /idc/target-sources/{id}/installation-status` | none |
| `설치 상태 새로고침` (`refresh`) | `POST /idc/target-sources/{id}/check-installation` | none (updates status only) |
| `방화벽 확인` pipeline task `onClick` → `IdcFirewallModal`; `확인` closes | **no API** — informational modal | none |

### 3. UI 컴포넌트

`IdcStep4Installing`. Tree: `ProjectPageMeta` · `ProcessStatusCard` · `GuideCardContainer` ·
card(`설치 진행 상태` + `설치 상태 새로고침` button) → `InstallTaskPipeline items={[bdc, firewall]} columns={2}` ·
border → `LoadingState` | `IdcResourceTable cols={['src','fw']}` · `RejectionAlert` · `IdcFirewallModal`.
**Data:** `useIdcInstallationStatus(targetSourceId)` (returns `{status, loading, refreshing, error, refresh}`;
DR3 abort + DR4 clear-on-switch + DR5 stale-id guard) **plus** an own `useEffect` calling `getIdcResources`
(AbortController + `active` guard).
**Merge logic (IDC divergence):** Step 4 merges per-resource `sourceIps`/`firewallOpen` from
`installation-status.resources` into the `/resources` rows by `resourceId` (`statusById` map) — installation-status
is the canonical source for those fields at cutover (`/resources` may omit them); in mock both carry the same values.

### 4. API Client

- `getIdcResources(id, {signal})` (`@/app/lib/api/idc`) → `GET /idc/target-sources/{id}/resources`.
- `getIdcInstallationStatus(id, {signal})` (`@/app/lib/api/idc`) → `GET /idc/target-sources/{id}/installation-status` (maps via `toIdcInstallationView`).
- `checkIdcInstallation(id)` (`@/app/lib/api/idc`) → `POST /idc/target-sources/{id}/check-installation` (same `toIdcInstallationView`).

> IDC divergence: cloud install status is **provider-specific** (`{aws,azure,gcp}/.../installation-status` +
> `check-installation`, owned by `{Provider}InstallationInline`, and reads confirmed resources via
> `getConfirmedIntegration`). IDC has its own `getIdcInstallationStatus`/`checkIdcInstallation` and reads
> resources from `/idc/.../resources`. No flow auto-polls; refresh = the POST `check-installation`.
> `confirmIdcFirewall` (`POST /idc/target-sources/{id}/confirm-firewall`) exists in `idc.ts` and has a route,
> but is **not wired** — `방화벽 확인` only opens the informational `IdcFirewallModal` (the route exists for future wiring).

### 5. Adapter 계층 (full chain)

- **`getIdcResources`:** as Step 1.
- **`getIdcInstallationStatus` (GET installation-status):**
  `app/lib/api/idc.ts:getIdcInstallationStatus` → `app/integration/api/v1/idc/target-sources/[targetSourceId]/installation-status/route.ts:GET`
  → `bff.idc.getInstallationStatus` (`lib/bff/http.ts` `get('/idc/.../installation-status', {raw:true})` OR `lib/bff/mock-adapter.ts` `mockIdc.getInstallationStatus`)
  → `lib/bff/mock/idc.ts:mockIdc.getInstallationStatus` → `lib/mock-idc.ts:getIdcInstallationStatus`
  (filters out excluded rows; `bdc_tf:'COMPLETED'`; `firewall_opened` = every live row `firewall_open`; `last_checked_at = now`).
- **`checkIdcInstallation` (POST check-installation):**
  `app/lib/api/idc.ts:checkIdcInstallation` → `.../check-installation/route.ts:POST` → `bff.idc.checkInstallation`
  → `lib/bff/mock/idc.ts:mockIdc.checkInstallation` (**re-uses** `idcFns.getIdcInstallationStatus`) → `lib/mock-idc.ts:getIdcInstallationStatus`.
  (Mock `check-installation` returns the same computed status as GET — it does not mutate firewall state;
  only `confirmFirewall`/`confirm-firewall` flips `firewall_open=true` on all rows, and that path is unused.)

---

## Step 5 — WAITING_CONNECTION_TEST (연결 테스트)

### 1. 작업 내용

Connection-test screen. Read-only DB list with a `Connection Status` column + a `Run Test` action and a
`완료 승인 요청` CTA. Header subtitle explains DB-access/보안 통신/ACL/Agent connectivity checks.

### 2. Action(버튼) + API Call

| Action | API call | Transition |
|--------|----------|------------|
| mount (resource list) | `GET /idc/target-sources/{id}/resources` | none |
| `Run Test` (`runTest`) | **NO API — local demo simulation** | none |
| `완료 승인 요청` (`ApproveRequestButton`) | **NO API — toast stub** (`완료 승인 요청 기능 준비중입니다.`) | none |

`Run Test` (IDC divergence): sets a local `testing` flag for `TEST_DURATION_MS` (1800 ms), shows a
`연결 테스트 진행 중...` banner + button label, then **optimistically** flips every non-excluded row's
`connection` to `'SUCCESS'` in component state. No request is sent. (Cloud's Step 5 is the only flow that
auto-polls — `getTestConnectionLatest` ~4s + `triggerTestConnection`; IDC has none of that.)

### 3. UI 컴포넌트

`IdcStep5ConnectionTest`. Tree: `ProjectPageMeta` · `ProcessStatusCard` · `GuideCardContainer` ·
`section`(`연결 테스트` + Run Test button) → `StepBanner` (while testing) + `LoadingState`/`ErrorState` |
`IdcResourceTable cols={['src','conn']}` + `ApproveRequestButton` · `RejectionAlert`.
**Data:** local `useState<ResourcesState>` + own `useEffect` (`getIdcResources`, AbortController + `signal.aborted`
guard; timer cleared on unmount) — **not** `useIdcResources` (it needs to mutate rows locally for the sim).

### 4. API Client

- `getIdcResources(id, {signal})` (`@/app/lib/api/idc`) → `GET /idc/target-sources/{id}/resources`. (Only API on this step.)

### 5. Adapter 계층 (full chain)

- **`getIdcResources`:** as Step 1 (`idc.ts:getIdcResources` → `resources/route.ts:GET` → `bff.idc.getResources`
  → `lib/bff/mock/idc.ts:mockIdc.getResources` → `lib/mock-idc.ts:getIdcResources`).
- `Run Test` / `완료 승인 요청`: **no adapter chain** (local state / toast).

---

## Step 6 — CONNECTION_VERIFIED (완료 여부 관리자 승인 대기)

### 1. 작업 내용

Read-only "verified, waiting for final admin approval before monitoring starts". Info banner
(`최종 관리자 승인을 기다리고 있어요…`) + the DB list with `Connection Status` (integration targets only;
excluded rows dropped by the table). Status pill `승인 대기`. A `연결 테스트 재실행` button (stub).

### 2. Action(버튼) + API Call

| Action | API call | Transition |
|--------|----------|------------|
| mount (snapshot) | `GET /idc/target-sources/{id}/resources` | none |
| `연결 테스트 재실행` (`ConnectionVerifiedRetestButton`) | **NO API — toast stub** (`연결 테스트 재실행 기능 준비중입니다.`) | none |

### 3. UI 컴포넌트

`IdcStep6ConnectionVerified`. Tree: `ProjectPageMeta` · `ProcessStatusCard` · `GuideCardContainer` ·
`section`(`완료 여부 관리자 승인 대기`) → `StepBanner variant="info"` + `IdcResourceTable cols={['src','conn']}` +
`ConnectionVerifiedRetestButton` · `RejectionAlert`.
**Data:** `useIdcResources(targetSourceId)`.

### 4. API Client

- `getIdcResources(id)` (`@/app/lib/api/idc`) → `GET /idc/target-sources/{id}/resources`.

> IDC divergence: confirmed list via `getIdcResources` vs cloud `getConfirmedIntegration`. The retest button
> is an unimplemented stub on both flows. There is **no** IDC-specific Step-6 mutation.

### 5. Adapter 계층 (full chain)

- **`getIdcResources`:** as Step 1.

---

## Step 7 — INSTALLATION_COMPLETE (PII 모니터링 모듈 연동 완료)

### 1. 작업 내용

Completion screen. `Healthy` pill, `인프라 변경` / `연결 테스트 재실행` actions (both stubs), and the DB list with a
`Status` (health) column (integration targets only). The page is first loaded SSR via `getProject` (carries
`processStatus: 7` + project health).

### 2. Action(버튼) + API Call

| Action | API call | Transition |
|--------|----------|------------|
| mount (snapshot) | `GET /idc/target-sources/{id}/resources` | none |
| `인프라 변경` (`CompleteActions`) | **NO API — toast stub** (`인프라 변경 기능 준비중입니다.`) | none |
| `연결 테스트 재실행` (`CompleteActions`) | **NO API — toast stub** (`연결 테스트 재실행 기능 준비중입니다.`) | none |

### 3. UI 컴포넌트

`IdcStep7Complete`. Tree: `ProjectPageMeta` · `ProcessStatusCard` · `GuideCardContainer` ·
`section`(`PII 모니터링 모듈 연동 완료` + Healthy pill) → `CompleteActions` (인프라 변경 / 연결 테스트 재실행) +
`IdcResourceTable cols={['src','health']}` · `RejectionAlert`.
**Data:** `useIdcResources(targetSourceId)`.

### 4. API Client

- `getIdcResources(id)` (`@/app/lib/api/idc`) → `GET /idc/target-sources/{id}/resources`.
- (SSR) `getProject(id)` / `bff.targetSources.get(id)` → `GET /target-sources/{id}`.

> `confirmInstallation` (`POST /target-sources/{id}/pii-agent-installation/confirm`) exists in the shared DAL
> for the admin "confirm installation" action but is **not** wired into either visible Step-7 button (stubs only).

### 5. Adapter 계층 (full chain)

- **`getIdcResources`:** as Step 1.

---

## IDC-specific cross-cutting notes

- **Snake passthrough.** `lib/bff/http.ts` `idc.*` uses `{ raw: true }` on the GETs (resources,
  previous-request, installation-status, source-ip-recommendation) so `camelCaseKeys` is skipped; the
  PUT/POSTs (`updateResources`, `checkInstallation`, `confirmFirewall`) post a raw body. `app/lib/api/idc.ts`
  is the sole wire↔domain mapper. Cloud responses are camelCased at the BFF layer instead.
- **Mock store.** `lib/mock-idc.ts:idcStore` is a module-level `Map<targetSourceId, IdcResourceInput[]>`
  (the mock "database"). `ensureSeeded` deep-clones `IDC_SEED` (3 rows) per target on first read;
  `updateIdcResources` overwrites it; `previous-request` always returns the 7-row `IDC_PREV_REQUEST_SEED`
  (ignores the id). `installation-status`/`check-installation` are computed live (excluded rows filtered).
- **Auth.** Every `mockIdc.*` call runs `authorize(targetSourceId)` (`lib/bff/mock/idc.ts`):
  `getCurrentUser` (401 if absent) → `getProjectByTargetSourceId` (404 if absent) → service-code permission
  (403). `getSourceIpRecommendation` only checks the user (no project).
- **Endpoint verbs (verified against route handlers + `docs/swagger/idc.yaml`):**
  - `GET`/`PUT` `/idc/target-sources/{id}/resources`
  - `GET` `/idc/target-sources/{id}/previous-request`
  - `GET` `/idc/target-sources/{id}/installation-status`
  - `POST` `/idc/target-sources/{id}/check-installation`
  - `POST` `/idc/target-sources/{id}/confirm-firewall` (route exists; **UI-unwired**)
  - `GET` `/idc/source-ip-recommendation?ipType=` (client exists; **UI-unwired**)
  - Shared (non-`/idc`): `POST /target-sources/{id}/approval-requests`, `POST /target-sources/{id}/approval-requests/cancel`,
    `GET /target-sources/{id}/process-status`, `GET /target-sources/{id}`.

## Cross-references

- `docs/api/step-actions-and-apis.md` — cross-cloud per-step overview (this doc's parent).
- `docs/api/boundaries.md` — CSR → Next route → BFF two-hop, prefix `/integration/api/v1`.
- `docs/swagger/idc.yaml` — IDC `/idc/target-sources/{id}/*` + `/idc/source-ip-recommendation` contracts.
- Code: `app/lib/api/idc.ts` (client + mapper) · `app/hooks/{useIdcResources,useIdcInstallationStatus,useIdcPreviousRequest}.ts` ·
  `app/integration/target-sources/[targetSourceId]/_components/idc/**` (layout/steps/tables/modals) ·
  `app/integration/api/v1/idc/**` (routes) · `lib/bff/{http,mock-adapter}.ts` · `lib/bff/mock/idc.ts` · `lib/mock-idc.ts`.
