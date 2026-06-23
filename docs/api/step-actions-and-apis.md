# Step Actions & APIs — Target-Source Detail Page

Per-step reference for the target-source detail page (`/integration/target-sources/[targetSourceId]`).
For **each** of the 7 process steps it documents: the component that renders it, the user actions,
the exact `@/app/lib/api` functions invoked, the API endpoints (method + internal path), and the API
response shape with a real curl sample.

## Conventions

- **Layout dispatch.** `ProcessStatus` selects the step component:
  - Cloud (azure/gcp/aws) → `_components/layout/CloudTargetSourceLayout.tsx` → `<step>Step.tsx`
  - IDC → `_components/idc/IdcTargetSourceLayout.tsx` → `steps/IdcStep<N>*.tsx`
- **Paths.** Client functions in `@/app/lib/api/*` call `fetchInfraJson('/...')`. The transport prepends
  `INTERNAL_INFRA_API_PREFIX = '/integration/api/v1'` (see `boundaries.md`). So a client call to
  `/target-sources/{id}/resources` is the browser request
  `GET /integration/api/v1/target-sources/{id}/resources`, served by
  `app/integration/api/v1/target-sources/[targetSourceId]/resources/route.ts`. All paths below are the
  **internal** (browser-visible, hop-1) paths. IDC responses are raw snake_case passthrough; cloud
  responses are camelCased by `fetchInfraCamelJson` except the confirm/approval family which stays snake.
- **Hook ownership.** Most step components do not call the `@/app/lib/api` functions directly — a data hook
  owns the fetch/abort and the component consumes its `state`. The "Function" column below lists the
  underlying `@/app/lib/api` function; the "owned by" note names the hook/inline component that actually
  invokes it. Key hooks: `useIdcResources` (`getIdcResources`), `useIdcInstallationStatus`
  (`getIdcInstallationStatus` + `checkIdcInstallation`), `useIdcPreviousRequest` (`getIdcPreviousRequest`),
  `useTestConnectionPolling` (`getTestConnectionLatest` 4s poll + `triggerTestConnection`),
  `useConfirmedIntegration` / `ConfirmedIntegrationDataProvider` (`getConfirmedIntegration`); the cloud
  provider install status lives in `process-status/{aws,azure,gcp}/{Provider}InstallationInline.tsx`.
- **ID map** used for the curl samples:
  | step | azure | gcp | aws | idc |
  |------|-------|-----|-----|-----|
  | 1 WAITING_TARGET_CONFIRMATION | 1005 | 1002 | 1006 | 1020 |
  | 2 WAITING_APPROVAL            | 2002 | 2007 | 1007 | 1021 |
  | 3 APPLYING_APPROVED           | 2003 | 2008 | 2001 | 1022 |
  | 4 INSTALLING                  | 1004 | 2009 | 1008 | 1023 |
  | 5 WAITING_CONNECTION_TEST     | 2004 | 2010 | 1010 | 1024 |
  | 6 CONNECTION_VERIFIED         | 2005 | 2011 | 1011 | 1025 |
  | 7 INSTALLATION_COMPLETE       | 2006 | 2012 | 1012 | 1026 |

---

## Step 1 — WAITING_TARGET_CONFIRMATION (연동 대상 확정)

### Component(s)

| Flow | Renders | Owns data |
|------|---------|-----------|
| Cloud | `layout/WaitingTargetConfirmationStep.tsx` → `candidate/CandidateResourceSection.tsx` | `CandidateResourceSection` (useEffect fetch) |
| IDC | `idc/steps/IdcStep1TargetInput.tsx` (+ modals `IdcTargetFormModal`, `IdcLoadRequestModal`, `IdcSubmitModal`, `IdcExclusionReasonModal`) | `IdcStep1TargetInput` (useEffect fetch; working list in component state) |

### User actions

- **Cloud:** scan trigger ("Run Infra Scan"), open approval modal and submit `"승인 요청"`, error `"다시 시도"`.
- **IDC:** `"기존 연동 요청 정보 불러오기"`, `"연동 대상 추가"` (add/edit modal), row exclude toggle + reason
  (`"직접 입력"`/`"저장"`), pagination, `"연동 대상 승인 요청"` → submit modal `"제출하기"`.

### Functions called (function → endpoint)

| Flow | Trigger | Function | Endpoint | Owned by |
|------|---------|----------|----------|----------|
| Cloud | mount | `getConfirmResources(id)` | `GET /target-sources/{id}/resources` | `CandidateResourceSection` useEffect |
| Cloud | submit `"승인 요청"` | `createApprovalRequest(id, input)` | `POST /target-sources/{id}/approval-requests` | `CandidateResourceSection` (via `ApprovalRequestModal`) |
| Cloud | after submit | `getProject(id)` (via `refreshProject`) | `GET /target-sources/{id}` | `ProjectDetail.refreshProject` |
| IDC | mount | `getIdcResources(id)` | `GET /idc/target-sources/{id}/resources` | `IdcStep1TargetInput` useEffect (direct) |
| IDC | `"기존 연동 요청 정보 불러오기"` | `getIdcPreviousRequest(id)` | `GET /idc/target-sources/{id}/previous-request` | `IdcLoadRequestModal` → `useIdcPreviousRequest` |
| IDC | `"제출하기"` (persist) | `updateIdcResources(id, rows)` | `PUT /idc/target-sources/{id}/resources` | `IdcStep1TargetInput.handleSubmit` |
| IDC | `"제출하기"` (request) | `createApprovalRequest(id, input)` | `POST /target-sources/{id}/approval-requests` | `IdcStep1TargetInput.handleSubmit` |
| IDC | after submit | `getProject(id)` | `GET /target-sources/{id}` | `IdcStep1TargetInput` |

> **IDC divergence:** cloud's candidate list is scan-derived & read-then-request; IDC's list is **user-authored**
> and `PUT`-persisted via `updateIdcResources` before the (shared) `createApprovalRequest`. The previous-request
> load is opened from `IdcLoadRequestModal` (hook `useIdcPreviousRequest`), not from the step body.
>
> **Defined-but-unused:** `getIdcSourceIpRecommendation` (`GET /idc/source-ip-recommendation?ipType=`) exists in
> `app/lib/api/idc.ts` but is **not** wired into any step component or the add-form (verified by grep — only its
> definition and unit test reference it). The add-form uses a hardcoded `defaultSourceIps()` instead.

### API responses

`GET /integration/api/v1/target-sources/1005/resources` (cloud — `getConfirmResources`):

```json
{
  "resources": [
    {
      "id": "vm-scan-001",
      "resource_id": "vm-scan-001",
      "name": "sea-live-space-prod",
      "resource_type": "AZURE_VM",
      "database_type": "MYSQL",
      "integration_category": "NO_INSTALL_NEEDED",
      "host": null,
      "port": null,
      "oracle_service_id": null,
      "network_interface_id": null,
      "ip_configuration_name": null,
      "scan_status": "NEW_SCAN",
      "metadata": { "provider": "Azure", "resourceType": "AZURE_VM", "region": "ap-northeast-1" }
    },
    {
      "id": "mysql-scan-001",
      "resource_id": "mysql-scan-001",
      "name": "sea-live-space-stg",
      "resource_type": "AZURE_MYSQL",
      "database_type": "MYSQL",
      "integration_category": "TARGET",
      "host": null, "port": null, "oracle_service_id": null,
      "network_interface_id": null, "ip_configuration_name": null,
      "scan_status": "UNCHANGED",
      "metadata": { "provider": "Azure", "resourceType": "AZURE_MYSQL", "region": "ap-northeast-1" }
    }
  ],
  "total_count": 4
}
```

`GET /integration/api/v1/idc/target-sources/1020/resources` (IDC — `getIdcResources`, raw snake):

```json
{
  "resources": [
    {
      "resource_id": "idc-r1",
      "name": "10.20.30.40",
      "input_format": "IP",
      "ips": ["10.20.30.40"],
      "port": 3306,
      "database_type": "MYSQL",
      "source_ips": ["172.16.0.11"],
      "firewall_open": true,
      "connection_status": "SUCCESS",
      "health": "HEALTHY",
      "done": "연동 완료"
    },
    {
      "resource_id": "idc-r2",
      "name": "10.20.31.10",
      "input_format": "IP",
      "ips": ["10.20.31.10", "10.20.31.11", "10.20.31.12"],
      "port": 1521,
      "database_type": "ORACLE",
      "service_id": "PRODORCL_ASIA_NORTHEAST_CLUSTER_NODE_PRIMARY_2026A",
      "source_ips": ["172.16.0.11", "172.16.0.12"],
      "firewall_open": false,
      "connection_status": "PENDING",
      "health": "UNHEALTHY",
      "done": "연동 진행중"
    },
    {
      "resource_id": "idc-r3",
      "name": "analytics-readreplica",
      "input_format": "HOST",
      "host": "analytics-readreplica-cluster-01.internal.bigdata-platform.prod.svc-a.example.io",
      "port": 5432,
      "database_type": "POSTGRESQL",
      "source_ips": ["172.16.0.12"],
      "firewall_open": true,
      "connection_status": "SUCCESS",
      "health": "HEALTHY",
      "exclusion_reason": "StageDB",
      "done": "—"
    }
  ]
}
```

`GET /integration/api/v1/idc/target-sources/1021/previous-request` (IDC — `getIdcPreviousRequest`):

```json
{
  "resources": [
    { "resource_id": "idc-p1", "name": "10.20.30.40", "input_format": "IP", "ips": ["10.20.30.40"], "port": 3306, "database_type": "MYSQL" },
    { "resource_id": "idc-p2", "name": "10.20.31.10", "input_format": "IP", "ips": ["10.20.31.10", "10.20.31.11"], "port": 1521, "database_type": "ORACLE", "service_id": "ORCL" },
    { "resource_id": "idc-p3", "name": "db.svc-a.io", "input_format": "HOST", "host": "db.svc-a.io", "port": 5432, "database_type": "POSTGRESQL", "exclusion_reason": "StageDB" }
  ]
}
```

`GET /integration/api/v1/idc/source-ip-recommendation?ipType=public` (IDC — `getIdcSourceIpRecommendation`):

```json
{
  "source_ips": ["172.16.0.11", "172.16.0.12"],
  "port": 443,
  "description": "BDC Agent가 DB에 접근할 때 사용하는 출발지 IP입니다. 서비스 측 방화벽에 허용 규칙을 등록해주세요."
}
```

`POST /target-sources/{id}/approval-requests` (`createApprovalRequest`) is a **mutation — not sampled** (the
constraint allows GET-only curl). Normalized response shape:

```json
{
  "id": "string",
  "target_source_id": 1005,
  "status": "PENDING",
  "requested_at": "2026-01-25T14:00:00Z",
  "requested_by": { "user_id": "string" },
  "resource_total_count": 6,
  "resource_selected_count": 4
}
```

---

## Step 2 — WAITING_APPROVAL (승인 대기)

### Component(s)

| Flow | Renders | Owns data |
|------|---------|-----------|
| Cloud | `layout/WaitingApprovalStep.tsx` → `WaitingApprovalCard.tsx` (+ `WaitingApprovalStats`, `WaitingApprovalToolbar`, `WaitingApprovalTable`) + `WaitingApprovalCancelButton.tsx` | `WaitingApprovalCard` (parallel fetch) |
| IDC | `idc/steps/IdcStep2WaitingApproval.tsx` → `IdcResourceTable` + `WaitingApprovalCancelButton.tsx` | `useIdcResources` (`getIdcResources`) |

### User actions

- **Cloud:** `"연동 대상 승인 요청 취소"`; in-memory search / filter tabs (`"전체"/"대상"/"비대상"`), DB-type &
  region dropdowns, pagination (**no API call** — client-side over fetched data).
- **IDC:** `"연동 대상 승인 요청 취소"` → confirm `"요청 취소"`.

### Functions called (function → endpoint)

| Flow | Trigger | Function | Endpoint |
|------|---------|----------|----------|
| Cloud | mount | `getApprovedIntegration(id)` | `GET /target-sources/{id}/approved-integration` |
| Cloud | mount | `getApprovalRequestLatest(id)` | `GET /target-sources/{id}/approval-requests/latest` |
| Cloud/IDC | cancel | `cancelApprovalRequest(id)` | `POST /target-sources/{id}/approval-requests/cancel` |
| Cloud/IDC | after cancel | `getProject(id)` | `GET /target-sources/{id}` |
| IDC | mount | `getIdcResources(id)` | `GET /idc/target-sources/{id}/resources` |

> **IDC divergence:** IDC shows the snapshot via `getIdcResources` (its own `/idc/.../resources`) rather than
> the cloud `approved-integration` + `approval-requests/latest` pair. Cancel and project-refresh are shared.

### API responses

`GET /integration/api/v1/target-sources/2002/approval-requests/latest` (`getApprovalRequestLatest`):

```json
{
  "request": {
    "id": 0,
    "target_source_id": 2002,
    "status": "PENDING",
    "requested_by": { "user_id": "관리자" },
    "requested_at": "2026-01-25T14:00:00Z",
    "resource_total_count": 6,
    "resource_selected_count": 4
  },
  "result": {
    "request_id": null,
    "status": "PENDING",
    "processed_by": { "user_id": "관리자" },
    "processed_at": "2026-06-21T13:25:26.223Z",
    "reason": null
  }
}
```

`GET /integration/api/v1/target-sources/2003/approved-integration` (`getApprovedIntegration` — sampled at
the Step-3 id, which has an approved record; the Step-2 id holds a still-pending request):

```json
{
  "approved_at": "2026-01-25T14:00:00Z",
  "approved_by": { "user_id": "김보안 (kim.security)" },
  "resource_infos": [
    {
      "resource_id": ".../flexibleServers/mysql-prod-01",
      "resource_type": "AZURE_MYSQL",
      "credential_id": "Key1",
      "database_region": "ap-northeast-1",
      "resource_name": "sea-payments-prod",
      "scan_status": "NEW_SCAN",
      "integration_status": "NOT_INTEGRATED"
    }
  ],
  "excluded_resource_infos": [
    {
      "resource_id": ".../flexibleServers/pg-stg-05",
      "exclusion_reason": "Stg 환경 DB · PII 데이터 미보유",
      "resource_name": "sea-live-space-prod",
      "database_type": "POSTGRESQL",
      "database_region": "ap-northeast-1",
      "scan_status": "NEW_SCAN",
      "integration_status": "NOT_INTEGRATED"
    }
  ]
}
```

`GET /integration/api/v1/idc/target-sources/1021/resources` (IDC Step 2) — same shape as the Step-1 IDC
`/resources` sample above.

`POST /target-sources/{id}/approval-requests/cancel` (`cancelApprovalRequest`) — **mutation, not sampled**;
client maps it to `{ "success": true }`.

---

## Step 3 — APPLYING_APPROVED (승인 반영중)

### Component(s)

| Flow | Renders | Owns data |
|------|---------|-----------|
| Cloud | `layout/ApplyingApprovedStep.tsx` → `approved/ApprovedIntegrationSection.tsx` | `ApprovedIntegrationSection` (useEffect fetch) |
| IDC | `idc/steps/IdcStep3Applying.tsx` → `IdcResourceTable` | `useIdcResources` (`getIdcResources`) |

### User actions

Read-only step (status banner only). No buttons that hit the API; cloud shows approver/approval-time,
IDC shows the snapshot table. (Cloud error state offers a retry that re-fetches.)

### Functions called (function → endpoint)

| Flow | Trigger | Function | Endpoint |
|------|---------|----------|----------|
| Cloud | mount | `getApprovedIntegration(id)` | `GET /target-sources/{id}/approved-integration` |
| IDC | mount | `getIdcResources(id)` | `GET /idc/target-sources/{id}/resources` |

> **IDC divergence:** IDC reuses `getIdcResources`; cloud reuses the Step-2 `approved-integration` payload.

### API responses

`GET /integration/api/v1/target-sources/2003/approved-integration` (`getApprovedIntegration`) — see the
sample under Step 2 (same endpoint and shape; `resource_infos` + `excluded_resource_infos`).

`GET /integration/api/v1/idc/target-sources/1022/resources` (IDC Step 3) — same `/resources` shape as Step 1.

---

## Step 4 — INSTALLING (Agent 설치)

### Component(s)

| Flow | Renders | Owns data |
|------|---------|-----------|
| Cloud | `layout/InstallingStep.tsx` → `layout/CloudInstallingStep.tsx` → `data/ConfirmedIntegrationDataProvider.tsx` wrapping `layout/InstallationStatusSlot.tsx` (→ thin `aws/AwsInstallationStatus` \| `azure/AzureInstallationStatus` \| `gcp/GcpInstallationStatus`, each delegating to `process-status/{provider}/{Provider}InstallationInline.tsx`) + `layout/ConfirmedResourcesSlot.tsx` | `{Provider}InstallationInline` (provider status) + `ConfirmedIntegrationDataProvider` |
| IDC | `idc/steps/IdcStep4Installing.tsx` (+ `IdcFirewallModal`, `InstallTaskPipeline`) | `useIdcInstallationStatus` (status) + `IdcStep4Installing` useEffect (`getIdcResources`) |

### User actions

- **Cloud (AWS):** `"Terraform 스크립트 다운로드"`, `"가이드 보기"` (manual mode).
- **Cloud (Azure/GCP):** `"새로고침"` (re-check installation); GCP pipeline item → detail modal.
- **IDC:** `"설치 상태 새로고침"`; `"방화벽 확인"` pipeline task → `IdcFirewallModal` (info modal, `"확인"` closes).

### Functions called (function → endpoint)

| Flow | Trigger | Function | Endpoint | Owned by |
|------|---------|----------|----------|----------|
| Cloud (all) | mount | `getConfirmedIntegration(id)` | `GET /target-sources/{id}/confirmed-integration` | `ConfirmedIntegrationDataProvider` |
| AWS | mount | `getAwsInstallationStatus(id)` | `GET /aws/target-sources/{id}/installation-status` | `AwsInstallationInline` |
| AWS | `"새로고침"` | `checkAwsInstallation(id)` | `POST /aws/target-sources/{id}/check-installation` | `AwsInstallationInline` |
| AWS | download | `getAwsTerraformScript(id)` | `GET /aws/target-sources/{id}/terraform-script` | `AwsInstallationInline` |
| Azure | mount | `getAzureInstallationStatus(id)` | `GET /azure/target-sources/{id}/installation-status` | `AzureInstallationInline` |
| Azure | `"새로고침"` | `checkAzureInstallation(id)` | `POST /azure/target-sources/{id}/check-installation` | `AzureInstallationInline` |
| GCP | mount | `getGcpInstallationStatus(id)` | `GET /gcp/target-sources/{id}/installation-status` | `GcpInstallationInline` |
| GCP | `"새로고침"` | `checkGcpInstallation(id)` | `POST /gcp/target-sources/{id}/check-installation` | `GcpInstallationInline` |
| IDC | mount | `getIdcResources(id)` | `GET /idc/target-sources/{id}/resources` | `IdcStep4Installing` useEffect (direct) |
| IDC | mount | `getIdcInstallationStatus(id)` | `GET /idc/target-sources/{id}/installation-status` | `useIdcInstallationStatus` |
| IDC | `"설치 상태 새로고침"` | `checkIdcInstallation(id)` | `POST /idc/target-sources/{id}/check-installation` | `useIdcInstallationStatus.refresh` |

> **IDC divergence:** cloud installation status is provider-specific (`{aws,azure,gcp}/.../installation-status`
> + `check-installation`). IDC has its own `getIdcInstallationStatus`/`checkIdcInstallation` (via
> `useIdcInstallationStatus`). No flow auto-polls; refresh is the `check-installation` POST. IDC reads
> confirmed resources from `/idc/.../resources`, not `getConfirmedIntegration`.
>
> **Correction / unused:** `confirmIdcFirewall` (`POST /idc/target-sources/{id}/confirm-firewall`) exists in
> `app/lib/api/idc.ts` but is **not** called by the UI — the `"방화벽 확인"` task opens `IdcFirewallModal`, an
> informational modal whose `"확인"` button only closes it (verified by grep: no non-test call site). The
> `confirm-firewall` route exists for a future wiring.

### API responses

`GET /integration/api/v1/azure/target-sources/1004/installation-status` (`getAzureInstallationStatus`):

```json
{
  "lastCheck": { "status": "IN_PROGRESS", "checkedAt": "2026-06-21T13:25:34.255Z", "failReason": null },
  "resources": [
    {
      "resourceId": "synapse-dw-001",
      "resourceName": "synapse-dw-001",
      "resourceType": "AZURE_SYNAPSE",
      "privateEndpoint": { "id": "pe-synapse-dw-001", "name": "pe-synapse-dw-001", "status": "PENDING_APPROVAL" },
      "vmInstallation": null
    }
  ]
}
```

`GET /integration/api/v1/gcp/target-sources/2009/installation-status` (`getGcpInstallationStatus`):

```json
{
  "lastCheck": { "status": "COMPLETED", "checkedAt": "2026-06-21T13:25:53.011Z" },
  "summary": { "totalCount": 3, "completedCount": 1, "allCompleted": false },
  "resources": [
    {
      "resourceId": "projects/sea-bdp-prd/.../datasets/sea_bdp_prd",
      "resourceName": "projects/sea-bdp-prd/.../datasets/sea_bdp_prd",
      "resourceType": "GCP_SQL",
      "resourceSubType": "PSC_MODE",
      "installationStatus": "COMPLETED",
      "serviceSideSubnetCreation": { "status": "COMPLETED", "guide": null },
      "serviceSideTerraformApply": { "status": "COMPLETED", "guide": null },
      "bdcSideTerraformApply": { "status": "COMPLETED", "guide": null }
    }
  ]
}
```

`GET /integration/api/v1/aws/target-sources/1008/installation-status` (`getAwsInstallationStatus`):

```json
{
  "hasExecutionPermission": true,
  "serviceScripts": [
    {
      "scriptId": "vpc_vpc-seoul-001_ap-northeast-2",
      "scriptName": "vpc_vpc-seoul-001_ap-northeast-2",
      "terraformScriptName": "vpc_vpc-seoul-001_ap-northeast-2",
      "status": "COMPLETED",
      "resourceCount": 1,
      "region": "ap-northeast-2",
      "resources": [
        { "resourceId": "rds-003", "resource_id": "rds-003", "type": "RDS", "resource_type": "RDS", "name": "rds-003", "installationDisplayStatus": "NOT_INSTALLED" }
      ]
    }
  ],
  "bdcStatus": { "status": "INSTALLING" },
  "lastCheck": { "status": "SUCCESS", "checkedAt": "2024-01-19T09:00:00Z" },
  "actionSummary": { "serviceActionRequired": false, "bdcInstallationRequired": true }
}
```

`GET /integration/api/v1/idc/target-sources/1023/installation-status` (`getIdcInstallationStatus`, raw snake):

```json
{
  "provider": "IDC",
  "bdc_tf": "COMPLETED",
  "firewall_opened": false,
  "resources": [
    { "resource_id": "idc-r1", "source_ips": ["172.16.0.11"], "firewall_open": true },
    { "resource_id": "idc-r2", "source_ips": ["172.16.0.11", "172.16.0.12"], "firewall_open": false }
  ],
  "last_checked_at": "2026-06-21T13:25:34.782Z"
}
```

---

## Step 5 — WAITING_CONNECTION_TEST (연결 테스트)

### Component(s)

| Flow | Renders | Owns data |
|------|---------|-----------|
| Cloud | `layout/WaitingConnectionTestStep.tsx` → `ConfirmedIntegrationDataProvider` wrapping `layout/ConfirmedResourcesSlot.tsx`, `layout/ConnectionTestSlot.tsx` (→ `ConnectionTestPanel`), `logical-db/LogicalDbSlot.tsx` | `ConnectionTestPanel` (polling) + `ConfirmedIntegrationDataProvider` |
| IDC | `idc/steps/IdcStep5ConnectionTest.tsx` → `IdcResourceTable` | `IdcStep5ConnectionTest` useEffect (`getIdcResources`, direct) |

### User actions

- **Cloud:** `"연결 테스트 실행"` (may open Credential setup first if creds missing / last test failed),
  `"전체 내역 →"` (history modal).
- **IDC:** `"Run Test"` (local demo simulation), `"완료 승인 요청"` (toast stub).

### Functions called (function → endpoint)

| Flow | Trigger | Function | Endpoint | Owned by |
|------|---------|----------|----------|----------|
| Cloud | mount + poll (default 4s) | `getTestConnectionLatest(id)` | `GET /target-sources/{id}/test-connection/latest` | `useTestConnectionPolling` (`app/hooks/useTestConnectionPolling.ts`, `interval = 4_000`) |
| Cloud | `"연결 테스트 실행"` | `triggerTestConnection(id)` | `POST /target-sources/{id}/test-connection` | `useTestConnectionPolling.start` |
| Cloud | cred check | `getSecrets(id)` | `GET /target-sources/{id}/secrets` | `ConnectionTestPanel` |
| Cloud | history modal | `getTestConnectionResults(id, page, size)` | `GET /target-sources/{id}/test-connection/results?page=&size=` | history modal |
| Cloud | mount | `getConfirmedIntegration(id)` | `GET /target-sources/{id}/confirmed-integration` | `ConfirmedIntegrationDataProvider` |
| IDC | mount | `getIdcResources(id)` | `GET /idc/target-sources/{id}/resources` | `IdcStep5ConnectionTest` useEffect (direct) |

> **IDC divergence:** IDC `"Run Test"` is a **local demo** — no API call; it optimistically flips non-excluded
> rows to `connection: 'SUCCESS'` in component state. `"완료 승인 요청"` is a `준비중` toast stub. The cloud flow
> is the only one that auto-polls (`getTestConnectionLatest` every ~4s until `status !== 'PENDING'`).

### API responses

`GET /integration/api/v1/target-sources/2004/test-connection/latest` (`getTestConnectionLatest`) — **404 until a
test is run** (this is the real pre-test GET response; the function surfaces it to start the empty state):

```json
{
  "timestamp": "2026-06-21T13:25:35.063Z",
  "type": "https://pii-agent.dev/problems/TARGET_SOURCE_NOT_FOUND",
  "title": "Target Source Not Found",
  "status": 404,
  "detail": "연결 테스트 이력이 없습니다.",
  "code": "TARGET_SOURCE_NOT_FOUND",
  "retriable": false,
  "requestId": "ba07f884-8dc3-4e89-b5b1-2865f97a1004"
}
```

On success (after `triggerTestConnection`), `getTestConnectionLatest` returns a `TestConnectionJob`:

```json
{
  "id": "job-...",
  "target_source_id": 2004,
  "status": "PENDING",
  "requested_at": "2026-06-21T13:25:00Z",
  "completed_at": null,
  "requested_by": "관리자",
  "resource_results": [
    { "resource_id": "...", "resource_type": "AZURE_MYSQL", "status": "PENDING", "error_status": null, "guide": null, "agent_id": null }
  ]
}
```

`GET /integration/api/v1/target-sources/2004/confirmed-integration` (`getConfirmedIntegration`, HTTP 200 at this id):

```json
{
  "resource_infos": [
    {
      "resource_id": ".../flexibleServers/mysql-prod-01",
      "resource_type": "AZURE_MYSQL",
      "database_type": "MYSQL",
      "database_region": "ap-northeast-1",
      "resource_name": "sea-payments-prod",
      "credential_id": "Key1"
    }
  ]
}
```

`GET /integration/api/v1/idc/target-sources/1024/resources` (IDC Step 5) — same `/resources` shape as Step 1.

---

## Step 6 — CONNECTION_VERIFIED (연결 확인됨)

### Component(s)

| Flow | Renders | Owns data |
|------|---------|-----------|
| Cloud | `layout/ConnectionVerifiedStep.tsx` → `ConfirmedIntegrationDataProvider` wrapping `ConfirmedResourcesSlot` (+ `ConnectionVerifiedRetestButton`) | `ConfirmedIntegrationDataProvider` |
| IDC | `idc/steps/IdcStep6ConnectionVerified.tsx` → `IdcResourceTable` | `useIdcResources` (`getIdcResources`) |

### User actions

- **Cloud:** `"연결 테스트 재실행"` — currently a `준비중` toast stub (no API call).
- **IDC:** `"연결 테스트 재실행"` — `준비중` toast stub.

### Functions called (function → endpoint)

| Flow | Trigger | Function | Endpoint |
|------|---------|----------|----------|
| Cloud | mount | `getConfirmedIntegration(id)` | `GET /target-sources/{id}/confirmed-integration` |
| IDC | mount | `getIdcResources(id)` | `GET /idc/target-sources/{id}/resources` |

> **IDC divergence:** confirmed list via `getIdcResources` vs cloud `getConfirmedIntegration`. The retest button
> is an unimplemented stub on both flows.

### API responses

`GET /integration/api/v1/target-sources/2005/confirmed-integration` (`getConfirmedIntegration`):

```json
{
  "resource_infos": [
    { "resource_id": ".../flexibleServers/mysql-prod-01", "resource_type": "AZURE_MYSQL", "database_type": "MYSQL", "database_region": "ap-northeast-1", "resource_name": "sea-payments-prod", "credential_id": "Key1" },
    { "resource_id": ".../servers/mssql-payments-04", "resource_type": "AZURE_MSSQL", "database_type": "MSSQL", "database_region": "ap-northeast-1", "resource_name": "sea-live-space-dev", "credential_id": "Key1" }
  ]
}
```

`GET /integration/api/v1/idc/target-sources/1025/resources` (IDC Step 6) — same `/resources` shape as Step 1
(rows carry `connection_status` / `health`).

---

## Step 7 — INSTALLATION_COMPLETE (연동 완료)

### Component(s)

| Flow | Renders | Owns data |
|------|---------|-----------|
| Cloud | `layout/InstallationCompleteStep.tsx` → `ConfirmedIntegrationDataProvider` wrapping `ConfirmedResourcesSlot` (variant `complete`, health badges) + complete-actions/header-right | `ConfirmedIntegrationDataProvider` |
| IDC | `idc/steps/IdcStep7Complete.tsx` → `IdcResourceTable` (health column) | `useIdcResources` (`getIdcResources`) |

### User actions

- **Cloud & IDC:** `"인프라 변경"`, `"연결 테스트 재실행"` — both are `준비중` toast stubs (no API call).

### Functions called (function → endpoint)

| Flow | Trigger | Function | Endpoint |
|------|---------|----------|----------|
| Cloud | mount | `getConfirmedIntegration(id)` | `GET /target-sources/{id}/confirmed-integration` |
| IDC | mount | `getIdcResources(id)` | `GET /idc/target-sources/{id}/resources` |

> The page itself is initially loaded server-side via `bff.targetSources.get(id)` (`GET /target-sources/{id}`,
> `getProject` on the client), which carries `processStatus: 7` and the project `health`. `confirmInstallation`
> (`POST /target-sources/{id}/pii-agent-installation/confirm`) exists in the DAL for the admin "confirm
> installation" action but is not wired into either step component's visible buttons (stubs only).

### API responses

`GET /integration/api/v1/target-sources/2006` (`getProject` / SSR `bff.targetSources.get`):

```json
{
  "id": "azure-proj-complete",
  "targetSourceId": 2006,
  "projectCode": "AZURE-COMPLETE",
  "serviceCode": "azure",
  "processStatus": 7,
  "createdAt": "2026-01-20T09:00:00Z",
  "updatedAt": "2026-01-25T14:00:00Z",
  "name": "Azure PII Agent - 연동 완료",
  "description": "Azure SQL, PostgreSQL, MySQL 리소스에 PII Agent 설치",
  "isRejected": false,
  "cloudProvider": "Azure",
  "tenantId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "subscriptionId": "12345678-abcd-ef01-2345-6789abcdef01"
}
```

`GET /integration/api/v1/target-sources/2006/confirmed-integration` (`getConfirmedIntegration`) — same
`{ resource_infos: [...] }` shape as Step 6 (Step-7 rows additionally surface health/integration status).

`GET /integration/api/v1/target-sources/1026` (IDC project) — same `getProject` shape as above with
`"cloudProvider": "IDC"` and no tenant/subscription identifiers; `GET /integration/api/v1/idc/target-sources/1026/resources`
returns the `/resources` shape with the `health` column populated.

---

## Cross-references

- `docs/api/boundaries.md` — CSR → Next route → BFF two-hop, prefix `/integration/api/v1`.
- `docs/api-routes/README.md` — route-handler index.
- `docs/swagger/confirm.yaml` — `/target-sources/{id}` confirm/approval/process-status/test-connection contracts.
- `docs/swagger/{aws,azure,gcp}.yaml` — provider installation-status / check-installation / terraform contracts.
- `docs/swagger/idc.yaml` — IDC `/idc/target-sources/{id}/*` (resources, previous-request, installation-status, check-installation, confirm-firewall) + `/idc/source-ip-recommendation`.
- `docs/swagger/test-connection.yaml` — test-connection trigger / latest / results.
- Client DAL: `app/lib/api/index.ts` (cloud + shared), `app/lib/api/idc.ts` (IDC wire↔domain boundary),
  `app/lib/api/{aws,azure,gcp}.ts` (provider installation status).
