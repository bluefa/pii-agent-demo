# Azure BFF 연동 변경사항 & Mock API 동기화 체크리스트

> 작성일: 2026-04-12
> 기준 브랜치: `main` (`f96ae48` 시점)
> 범위: 2026-03-23 ~ 2026-03-30 사이 merge된 Issue #222 Azure BFF 연동 작업
> 목적: 실제 BFF API 연동 코드와 mock API 응답의 gap을 드러내고,
>       `USE_MOCK_DATA=true` 환경에서 Azure 화면이 동작하도록 mock을 고칠 때 참고할 체크리스트 제공

---

## 0. 한눈에 보는 요약

- Azure BFF 연동은 Issue #222 OpenAPI (`docs/swagger/issue-222-client.yaml`) 계약에 맞춰 최근 2주간 `/install/v1/**` upstream과 `/integration/api/v1/**` Next.js 공개 경로로 대대적으로 재배치되었다.
- Frontend 레이어(`app/integration/api/v1/**/route.ts`, `lib/target-source-response.ts`, `lib/resource-catalog-response.ts`, `lib/issue-222-approval.ts`, `lib/confirmed-integration-response.ts`)는 BFF 응답(snake_case/flat/새 필드명)에 맞춰 수정되었다.
- 그런데 **mock 구현(`lib/api-client/mock/**`, `lib/mock-*.ts`)은 Azure 리소스 catalog 쪽은 이미 snake_case를 따라갔지만, Scan · Azure VM/DB installation-status · Azure scan-app · Azure subnet-guide · vm-terraform-script · approval history summary 등 상당수는 여전히 legacy camelCase/legacy envelope shape를 내고 있다.**
- 특히 **#249에서 BFF 클라이언트의 `proxyGet`만 자동 `camelCaseKeys` 변환을 적용했기 때문에**, route handler는 GET 응답은 camelCase를 기대하고 POST/PUT 응답은 snake_case를 기대하는 **비대칭 상태**가 되었다. mock은 이 비대칭을 모른 채 만들어져 있으므로 GET/POST 혼합 케이스에서 shape mismatch가 발생할 여지가 크다.
- 가장 치명적인 누락: **`mockAzure.getScanApp` 메서드가 존재하지 않음** (`ApiClient['azure']` 타입에는 선언되어 있음 → 빌드/런타임에서 깨질 수 있음).
- 두 번째로 치명적인 건 **scan API** 관련 legacy shape (`scanId`, `status`, `history`, `total` 등)을 mock이 여전히 반환하고 있다는 점. Azure Scan 탭, Scan History, 최신 ScanJob 조회가 모두 깨질 가능성이 높다.

---

## 1. 변경사항 타임라인 (Azure BFF 중심)

> `git log main --oneline` 기준. 각 PR의 핵심 변경점 한 줄 요약과 mock에 주는 영향 포커스.

| PR | SHA | 제목 | 핵심 변경 | Mock 영향 |
|----|-----|------|----------|----------|
| #211 | `005116e` | feat: migrate bff infra path and snake case | Upstream BFF base path `/infra/v1` → `/install/v1`, 주요 payload/response snake_case 전환 | lib/bff/http.ts의 `toUpstreamInfraApiPath` 전환 — mock은 upstream 경로를 안 쓰므로 직접 영향 없음, 단 FE가 snake_case를 내보낼 수 있다는 전제 성립 |
| #212 | `0558fa0` | docs: expand azure page api catalog and flatten target source detail | Azure 페이지에서 사용하는 API 목록 정리, TargetSourceDetail flatten 제안 | Mock이 target-source 상세를 flat snake_case로 내야 한다는 근거 문서 |
| #213 | `7cdffaa` | docs: add target source detail refactor migration plan | Project → TargetSourceDetail 마이그레이션 플랜 | 스키마 전환의 기반 문서 |
| #215 | `4aa9404` | refactor: expand /resources catalog contract | `/install/v1/target-sources/{id}/resources` 응답에 snake_case 필드 + credential/ip_configuration 확장 | Mock `getResources` 응답 shape 영향 |
| #216 | `a01f2db` | refactor: migrate azure resource ownership | `lib/azure-resource-ownership.ts` 신규, `approved-integration` 기반 ownership 판단 | Mock `getApprovedIntegration` 응답의 `excluded_resource_infos` 형태 필요 |
| #217 | `5670ca2` | refactor: move azure provider identifiers to settings | Azure tenant/subscription을 service settings에서 읽는 흐름 일부 제거, target-source metadata 기반 이동 | Mock에서도 identifier는 target-source metadata로 내야 함 |
| #224 | `1f912ac` | docs: add azure bff frontend todo | `docs/reports/azure-bff-frontend-todo.md` 생성 — 본 체크리스트의 근거 | — |
| #225 | `5bf50c4` | refactor: migrate integration routes | Next.js 공개 경로 `/api/v1/**` → `/integration/api/v1/**` 재배치 (일부) | mock handler는 경로와 무관하지만, client dispatch 경유만 바뀜 |
| #226 | `4a8122b` | feat: add executable swagger mirror for issue 222 | `docs/swagger/issue-222-client.yaml` 실행형 Swagger 도입 | 검증 문서 |
| #227 | `e28c868` | refactor: align app route naming with targetSourceId | URL segment `projectId` → `targetSourceId` 정렬 | mock 파라미터 이름과 무관하나, 의미 통일 |
| #229 | `17a86f0` | refactor: align azure bootstrap status with issue 222 | `target-source` 상세 응답 parsing에 snake_case process_status/cloud_provider/metadata 수용 | `lib/target-source-response.ts`가 이미 양쪽 key 모두 읽음 |
| #230 | `9efbeae` | refactor: redesign approval summary UI for issue 222 | 승인 요청/이력 모달을 summary 스키마(`resource_total_count`, `resource_selected_count`)로 재설계 | mock approval request/history 응답에 필드 필요 |
| #231 | `469e1a2` | feat: align admin target source list/create with issue 222 | 관리자 목록/생성 snake_case, metadata 반영 | `mockTargetSources.list/create`는 이미 적용된 상태 |
| #232 | `d0d3583` | fix: align install upstream and integration swagger routes | swagger 상 upstream/integration 경로 정합화 | — |
| #234 | `75a8157` | fix: align user bootstrap contract with issue 222 | `/user/me`를 flat 객체로 변경 (envelope 제거) | `mockUsers.getMe` 응답이 flat인지 확인 필요 |
| #235 | `588c52c` | Align Azure approval/install flow to Issue #222 contract | 승인 payload `{ input_data: { resource_inputs } }` → `{ resource_inputs }` flatten, credential PATCH → PUT, `excluded_resource_ids` → `excluded_resource_infos` | mock 승인 흐름 입력 schema 핵심 변경 |
| #237 | `befa4ed` | refactor: normalize issue #222 azure read model | `metadata.tenant_id/subscription_id` 필드 파싱, `cloud_provider: AZURE` → `'Azure'` normalize | `lib/target-source-response.ts` 확장 |
| #238 | `05382f7` | docs: refresh azure bff todo after 234-237 | todo 문서 업데이트 | — |
| #240 | `b634c05` | fix: align issue 222 credential proxy contract | credential update/read 경로·메서드 정렬 | credential route가 PUT 기대 |
| #242 | `718eef2` | refactor: move public integration api routes | Next.js 공개 API를 `/integration/api/v1/**`로 최종 이동 | 공식 mount point 변경 |
| #245 | `ff2f044` | docs: align executable swagger with runtime responses | swagger와 실제 route 응답 shape 정합성 검증 | mock도 동일 shape 필요 |
| #247 | `d118f35` | fix: get credential from bff | GET credential 프록시 추가 | credential GET 경로 추가 |
| #248 | `b4e1f04` | feat: update scan api path | scan 경로 `/scan/projects/{id}/**` → `/target-sources/{id}/scan`, `/scan/history`, `/scanJob/latest` 및 응답 snake_case (`scan_status`, `created_at`, `duration_seconds`, `resource_count_by_resource_type`, `scan_error`) | **mock scan 응답이 legacy shape → 반드시 수정** |
| #249 | `f96ae48` | feat: Update bff api path | Azure 경로 `/azure/projects/{id}/**` → `/target-sources/{id}/azure/**` 이동, `getScanApp` 타입 추가, `proxyGet`에서 `camelCaseKeys` 자동 변환 | **mock azure.ts에 getScanApp 누락 — 최우선 수정** |

> 전체 목록과 배경 설명은 `docs/reports/azure-bff-frontend-todo.md`를 참고하세요.

---

## 2. 아키텍처 핵심 포인트 (읽기 전에 꼭 이해할 것)

### 2.1 Client dispatch

```
route.ts  ->  client.azure.getScanApp(projectId)
                      |
         ------------------------------
         |                            |
  bffClient.azure.getScanApp   mockAzure.getScanApp     // USE_MOCK_DATA 분기
         |                            |
     proxyGet (BFF HTTP)        NextResponse.json(...)
         |
   camelCaseKeys 변환 O
```

`lib/api-client/index.ts` 기준으로 `USE_MOCK_DATA !== 'false'`일 때 mock이 사용된다.
route handler는 **client가 mock이든 bff든 동일한 shape를 받는다고 가정**하며 파싱한다.

### 2.2 camelCase / snake_case 비대칭 (#249)

- `bffClient.proxyGet`: BFF의 snake_case 응답을 `camelCaseKeys`로 자동 변환 → route handler에서 **camelCase** 필드로 파싱.
- `bffClient.proxyPost / proxyPut / proxyDelete`: 변환 없이 upstream 원본(snake_case)을 그대로 passthrough → route handler에서 **snake_case**로 파싱.
- 이 규칙이 route.ts마다 다르게 작성되어 있어 **엔드포인트별로 mock이 내야 할 case가 다르다.** 반드시 해당 route.ts를 열어서 `await response.json() as {...}` 선언부를 확인해야 한다.

### 2.3 이미 snake_case로 전환된 mock 영역

다음은 이미 snake_case/신 스키마를 내고 있으므로 추가 수정이 적다.

- `mockTargetSources.list` — Issue222 flat shape, `target_source_id`, `process_status`, `cloud_provider`, `metadata.tenant_id/subscription_id`
- `mockTargetSources.create` — 생성 응답 `Issue222CreatedTargetSourceInfo` (단, `updatedAt/serviceCode`는 Issue #222 spec 범위 외이므로 Swagger와 재확인 필요)
- `mockConfirm.getResources` — `{ resources: [{ id, resource_id, resource_type, database_type, integration_category, host, port, oracle_service_id, network_interface_id, ip_configuration_name, metadata }], total_count }` snake_case
- `mockConfirm.toResourceSnapshot / toConfirmedIntegrationResourceInfo` — snake_case

### 2.4 아직 legacy shape인 mock 영역 (치명)

- `mockScan.*` — 전반적으로 legacy `{ scanId, status, startedAt, duration, result, history, total }` 형식 반환
- `mockAzure.*` — Azure VM/DB installation-status가 camelCase (`resourceId`, `resourceType`, `privateEndpoint.status`, `requestedAt` 등)이며, `getScanApp` 메서드가 아예 없음
- `mockConfirm.createApprovalRequest` 이후 경로의 summary 응답에 `resource_total_count / resource_selected_count` 필드가 존재하는지 전수 확인 필요
- `mockConfirm.getApprovedIntegration` — `excluded_resource_ids` (legacy) vs `excluded_resource_infos` (신) 혼용 (store에 `excluded_resource_ids` 초기화 흔적 있음, `_setApprovedIntegration`)
- `mockUsers.getMe` — flat vs envelope 확인 필요

---

## 3. 경로/메서드 변경 매트릭스

mock 쪽은 route handler를 통해 진입하므로 "공개 경로"를 노출하면 되며, 실제 upstream 경로는 중요하지 않다. 다만 client 메서드 이름이 바뀌었으므로 mock handler 구현부의 메서드 시그니처(파라미터 이름)도 같이 맞춰야 한다.

| 기능 | 공개 경로 (신, Next.js) | Client 메서드 | 주 변경 PR |
|------|------------------------|---------------|-----------|
| 현재 사용자 | `/integration/api/v1/user/me` | `client.users.getMe()` | #225, #234 |
| 서비스 목록 | `/integration/api/v1/user/services` | `client.users.getServices()` | #225 |
| 관리자 target-source 목록 | `/integration/api/v1/services/{serviceCode}/target-sources` | `client.targetSources.list(serviceCode)` | #231 |
| target-source 생성 | `POST /integration/api/v1/services/{serviceCode}/target-sources` | `client.targetSources.create(body)` | #231 |
| target-source 상세 | `/integration/api/v1/target-sources/{targetSourceId}` | `client.targetSources.get(id)` | #229 |
| resource catalog | `/integration/api/v1/target-sources/{targetSourceId}/resources` | `client.confirm.getResources(id)` | #215 |
| 승인 요청 생성 | `POST /integration/api/v1/target-sources/{targetSourceId}/approval-requests` | `client.confirm.createApprovalRequest(id, body)` | #235 |
| 승인 최신 요청 | `/integration/api/v1/target-sources/{targetSourceId}/approval-requests/latest` | `client.confirm.*` | #230 |
| 승인 이력 | `/integration/api/v1/target-sources/{targetSourceId}/approval-history` | `client.confirm.getApprovalHistory` | #230 |
| approved-integration | `/integration/api/v1/target-sources/{targetSourceId}/approved-integration` | `client.confirm.getApprovedIntegration` | #216, #235 |
| confirmed-integration | `/integration/api/v1/target-sources/{targetSourceId}/confirmed-integration` | `client.confirm.getConfirmedIntegration` | #235 |
| process-status | `/integration/api/v1/target-sources/{targetSourceId}/process-status` | `client.confirm.getProcessStatus` | #229, #235 |
| credential update | `PUT /integration/api/v1/target-sources/{targetSourceId}/resources/credential` | `client.confirm.updateResourceCredential` | #235, #240 |
| Azure 설치 상태 | `/integration/api/v1/target-sources/{targetSourceId}/installation-status` | `client.azure.getInstallationStatus(targetSourceId)` | #249 |
| Azure Scan App | `/integration/api/v1/target-sources/{targetSourceId}/azure/scan-app` | `client.azure.getScanApp(targetSourceId)` ⚠ 신규 | #249 |
| Azure settings | `/integration/api/v1/target-sources/{targetSourceId}/azure/settings` | `client.azure.getSettings` | #249 |
| Azure subnet guide | `/integration/api/v1/target-sources/{targetSourceId}/azure/subnet-guide` | `client.azure.getSubnetGuide` | #249 |
| Azure VM install status | `/integration/api/v1/target-sources/{targetSourceId}/azure/vm/installation-status` | `client.azure.vmGetInstallationStatus` | #249 |
| Azure VM terraform | `/integration/api/v1/target-sources/{targetSourceId}/azure/vm/terraform-script` | `client.azure.vmGetTerraformScript` | #249 |
| Scan 생성 | `POST /integration/api/v1/target-sources/{targetSourceId}/scan` | `client.scan.create(targetSourceId, body)` | #248 |
| Scan 이력 | `/integration/api/v1/target-sources/{targetSourceId}/scan/history` | `client.scan.getHistory(id, query)` | #248 |
| ScanJob 최신 | `/integration/api/v1/target-sources/{targetSourceId}/scanJob/latest` | `client.scan.getStatus(targetSourceId)` | #248 |

---

## 4. 파일·필드 단위 Mock 수정 체크리스트

> 파일 경로는 `/Users/study/pii-agent-demo/...` 기준(또는 본 worktree)입니다.

### 4.1 ⛔ 최우선 — 빌드/런타임 즉시 깨짐

#### (A) `lib/api-client/mock/azure.ts` — `getScanApp` 메서드 누락

- **현상**: `lib/api-client/types.ts`에 `azure.getScanApp(targetSourceId)`가 선언됨(2026-03-30 #249 추가). mock 구현 파일에는 메서드가 없음.
- **영향**: `route.ts`에서 `client.azure.getScanApp(resolved.projectId)` 호출 시 `TypeError: client.azure.getScanApp is not a function`.
- **수정**: `mockAzure`에 아래 메서드를 추가한다.

```ts
getScanApp: async (targetSourceId: string) => {
  const auth = await authorize(targetSourceId);
  if (auth.error) return auth.error;

  const serviceCode = auth.project!.serviceCode;
  const settingsResult = await azureFns.getAzureServiceSettings(serviceCode);
  if (settingsResult.error) return handleResult(settingsResult);

  const scanApp = settingsResult.data?.scanApp;
  if (!scanApp?.registered) {
    return NextResponse.json({
      app_id: null,
      status: 'UNREGISTERED',
      fail_reason: null,
      fail_message: 'Scan App이 등록되지 않았습니다.',
      last_verified_at: null,
    });
  }
  return NextResponse.json({
    app_id: scanApp.appId,
    status: scanApp.status ?? 'HEALTHY',
    fail_reason: null,
    fail_message: null,
    last_verified_at: scanApp.lastVerifiedAt ?? new Date().toISOString(),
  });
},
```

- **검증**: 대응되는 route `app/integration/api/v1/target-sources/[targetSourceId]/azure/scan-app/route.ts`는 client 응답을 그대로 `NextResponse.json(data)`로 반환하므로 **mock은 Swagger `AzureScanAppDto` snake_case 스키마(`app_id`, `status`, `fail_reason`, `fail_message`, `last_verified_at`)를 그대로 만족해야 한다**.

#### (B) `lib/api-client/mock/scan.ts` — legacy shape

- **현상**: 세 메서드 모두 legacy key 반환.
  - `getHistory` → `{ history: [{ scanId, status, startedAt, completedAt, duration, result, error }], total }`
  - `create` → `{ scanId, status, startedAt, estimatedDuration }`
  - `getStatus` → `{ isScanning, canScan, currentScan, lastCompletedScan, ... }`
- **route 기대** (아래 파일 실제 선언 확인):
  - `app/integration/api/v1/target-sources/[targetSourceId]/scan/history/route.ts` → `{ content: BffHistoryItem[], totalElements }`, `BffHistoryItem`은 snake_case (`id`, `scan_status`, `target_source_id`, `created_at`, `updated_at`, `scan_version`, `scan_progress`, `duration_seconds`, `resource_count_by_resource_type`, `scan_error`)
  - `.../scan/route.ts` (`POST`) → 동일 단일 snake_case 객체
  - `.../scanJob/latest/route.ts` → **camelCase**(`id`, `scanStatus`, `targetSourceId`, `createdAt`, `updatedAt`, `scanVersion`, `scanProgress`, `durationSeconds`, `resourceCountByResourceType`, `scanError`) — `proxyGet`이 자동 변환하기 때문
- **수정**:
  1. `mockScan.getHistory`가 반환하는 shape를 아래와 같이 변경.
     ```ts
     return NextResponse.json({
       content: history.map((h, idx) => ({
         id: Number(h.scanId.replace(/\D/g, '')) || (query.offset + idx + 1),
         scan_status: h.status,
         target_source_id: Number(projectId.replace(/\D/g, '')) || 0,
         created_at: h.startedAt,
         updated_at: h.completedAt,
         scan_version: 1,
         scan_progress: null,
         duration_seconds: h.duration,
         resource_count_by_resource_type: reduceResourceCounts(h.result),
         scan_error: h.error ?? null,
       })),
       totalElements: total,
     });
     ```
  2. `mockScan.create`는 POST이므로 **snake_case** 객체로 반환해야 한다.
     ```ts
     return NextResponse.json({
       id: Number(scanJob.id.replace(/\D/g, '')) || 1,
       scan_status: 'SCANNING',
       target_source_id: Number(projectId.replace(/\D/g, '')) || 0,
       created_at: scanJob.startedAt,
       updated_at: scanJob.startedAt,
       scan_version: 1,
       scan_progress: null,
       duration_seconds: estimatedDuration,
       resource_count_by_resource_type: {},
       scan_error: null,
     }, { status: 202 });
     ```
  3. `mockScan.getStatus`는 `scanJob/latest` route가 GET이며 `proxyGet`을 쓴다고 가정하고 **camelCase**로 반환해야 한다(mock은 `proxyGet`을 거치지 않지만 route가 camelCase를 파싱하므로).
     ```ts
     return NextResponse.json({
       id: Number(latest.id.replace(/\D/g, '')) || 1,
       scanStatus: latest.status,
       targetSourceId: Number(projectId.replace(/\D/g, '')) || 0,
       createdAt: latest.startedAt,
       updatedAt: latest.completedAt ?? latest.startedAt,
       scanVersion: 1,
       scanProgress: latest.progress ?? null,
       durationSeconds: latest.duration ?? 0,
       resourceCountByResourceType: reduceResourceCounts(latest.result),
       scanError: latest.error ?? null,
     });
     ```

### 4.2 🔥 상 — Azure 화면 주요 카드 동작에 필수

#### (C) `lib/mock-azure.ts` + `lib/api-client/mock/azure.ts` — installation-status 필드 snake_case 통일

- **현상**: `getAzureInstallationStatus`, `getAzureVmInstallationStatus`는 camelCase (`resourceId`, `resourceType`, `privateEndpoint`, `requestedAt`, `approvedAt`, `lastCheckedAt`).
- **route 기대**: `app/integration/api/v1/target-sources/[targetSourceId]/installation-status/route.ts`와 Azure VM 대응 route를 열어 **해당 route가 응답에서 어떤 키를 읽는지** 확인할 것. `proxyGet`을 거치면 camelCase, 거치지 않거나 POST면 snake_case가 원칙.
- **판정 기준**:
  - bff-client.ts를 보면 `getInstallationStatus`는 `proxyGet`으로 호출됨 → **실제 BFF 응답은 snake_case지만 route handler에는 camelCase로 전달됨**.
  - mock은 `proxyGet`을 거치지 않으므로 **route handler 파싱과 동일한 camelCase**로 내려도 된다.
  - 단, `checkInstallation`은 `proxyPost`이므로 snake_case 원본이 전달됨 → route handler 파싱이 snake_case라면 mock도 snake_case.
- **수정 원칙**: 각 route의 `response.json() as {...}` 파싱 선언을 확인해 case를 맞출 것. 혼동을 줄이려면 mock은 snake_case로 내고, 필요한 GET route에서는 `camelCaseKeys`를 한 번 더 감싸는 helper를 두는 방향도 검토.

- **검증 포인트**:
  - `app/integration/api/v1/target-sources/[targetSourceId]/installation-status/route.ts`
  - `app/integration/api/v1/target-sources/[targetSourceId]/azure/vm/installation-status/route.ts`
  - `app/integration/api/v1/azure/target-sources/[targetSourceId]/installation-status/route.ts` (있다면)

#### (D) `lib/api-client/mock/users.ts` — `getMe` flat 응답 확인

- **현상**: #234에서 `/user/me` envelope 제거, flat 객체로 전환. 기존 mock이 `{ user: {...} }`로 감쌌다면 route에서 `data.id` 파싱이 터진다.
- **route**: `app/integration/api/v1/user/me/route.ts`에서 `data.id`, `data.name`, `data.email`, `data.role`, `data.serviceCodePermissions`를 직접 읽는지 확인.
- **수정**: mock이 아직 envelope을 반환하면 flat으로 수정.
  ```ts
  return NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    serviceCodePermissions: user.serviceCodePermissions,
  });
  ```
- **비고**: `proxyGet`은 camelCase로 변환하므로 `service_code_permissions` → `serviceCodePermissions`가 된다. mock은 이미 camelCase로 내면 일관됨.

#### (E) `lib/api-client/mock/confirm.ts` — approval request summary

- **현상**: `mockConfirm.createApprovalRequest`/`getApprovalHistory`/`approval-requests/latest` 경로가 Issue #222 summary 필드(`resource_total_count`, `resource_selected_count`, `requested_at`, `target_source_id`, `status`)를 반환하는지 재검증 필요. 본 보고에서 확인한 상위 200줄까지는 준비돼 있으나, 실제 생성 지점에서 snake_case key가 누락될 수 있다.
- **수정 가이드**:
  - 응답 shape는 아래에 가깝게 유지.
    ```ts
    return NextResponse.json({
      id: newRequestId,
      target_source_id: Number(projectId.replace(/\D/g, '')) || 0,
      status: 'PENDING',
      requested_at: new Date().toISOString(),
      resource_total_count: project.resources.length,
      resource_selected_count: selectedCount,
      // Issue #222 optional fields: requester_id, requester_name, comment...
    }, { status: 201 });
    ```
  - `getApprovalHistory`는 페이징 메타를 snake_case로 준다면 `page.total_elements/total_pages`, camelCase 경로라면 `totalElements/totalPages` — 대응 route 파일의 파싱 선언을 봐야 함.
  - `lib/issue-222-approval.ts`의 `normalizeIssue222ApprovalRequestSummary`가 **fallback 채널**이지만, mock이 기본적으로 올바른 shape를 주는 것이 바람직하다.

#### (F) `lib/api-client/mock/confirm.ts` — approved/confirmed integration

- **현상**: `_setApprovedIntegration` 및 관련 store 초기값이 `excluded_resource_ids`를 쓴다. #235에서 `excluded_resource_infos`로 변경됨.
- **수정**:
  1. 저장 shape를 `excluded_resource_infos: Array<{ resource_id; resource_type; exclusion_reason? }>`로 통일.
  2. `createApprovalRequest` 경로에서 선택되지 않은 리소스를 `excluded_resource_infos`로 누적.
  3. `getApprovedIntegration` 응답에서 이 필드를 그대로 내려준다.
  4. `lib/azure-resource-ownership.ts`가 `excluded_resource_infos`를 읽는지 확인하고, mock이 이를 채워야 선택 복원(ownership)이 깨지지 않는다.
- **confirmed-integration**은 `resource_infos[].ip_configuration` 키를 내야 한다 (기존 `ip_configuration_name`은 `lib/confirmed-integration-response.ts`에서 legacy alias로 읽음). mock의 `toConfirmedIntegrationResourceInfo`는 현재 `ip_configuration_name: null`로 반환 중 — 필요 시 `ip_configuration`로 rename 또는 둘 다 포함.

### 4.3 ⚖ 중 — 데이터 보정, fallback 의존

#### (G) `lib/mock-data.ts` — Azure project에 `tenantId`, `subscriptionId`, `createdAt` 필수 보장

- **배경**: 관리자 목록과 상세에서 Azure identifier가 `metadata.tenant_id / subscription_id`로 내려가며, `toIssue222TargetSourceDetail`은 Project에 해당 필드가 있을 때만 metadata를 채운다. Sample 생성 시 둘 중 하나라도 빠지면 Azure 화면이 fallback(`TS-<id>`)으로만 동작한다.
- **수정**: Azure mock project 초기 데이터에 아래 필드를 모두 넣는다.
  ```ts
  {
    cloudProvider: 'Azure',
    tenantId: '00000000-0000-0000-0000-000000000000',
    subscriptionId: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
    createdAt: '2026-03-01T00:00:00Z',
    updatedAt: '2026-03-05T00:00:00Z',
    // ...
  }
  ```
- **검증**: 관리자 목록, Azure 상세의 `AzureInfoCard`에서 Tenant/Subscription이 표시되는지, `ProjectHeader`가 `targetSourceId` fallback 식별자(`TS-<id>`)만 보이지 않는지.

#### (H) `lib/api-client/mock/target-sources.ts` — `create` 응답 필드 점검

- **현상**: 현재 `toIssue222TargetSourceInfo`는 `targetSourceId`, `description`, `cloudProvider`, `createdAt`, `serviceCode`, `updatedAt`, `metadata` (camelCase)를 반환. Issue #222 생성 응답 Swagger(`Issue222CreatedTargetSourceInfo`)와 교차 검증 필요.
- **점검 항목**: Swagger가 snake_case를 요구하면 mock 응답도 snake_case로 바꾸거나, route handler에서 변환 레이어를 두어야 한다. 현재 `app/integration/api/v1/services/[serviceCode]/target-sources/route.ts`의 POST 핸들러가 mock 응답을 그대로 passthrough하는지 확인.

#### (I) `lib/api-client/mock/confirm.ts` — `updateResourceCredential`

- **현상**: Swagger `PUT /install/v1/target-sources/{id}/resources/credential` 계약으로 변경됨(#235, #240, #247).
- **수정**: mock handler가 PUT body `{ resource_id, credential_id, password? }`를 받고, 성공 시 200/204 또는 업데이트된 resource 스냅샷을 반환하는지 확인. PATCH만 지원하면 route가 405/미지원으로 깨진다.
- **검증**: `app/integration/api/v1/target-sources/[targetSourceId]/resources/credential/route.ts`의 `PUT` export 구현과 대조.

#### (J) `lib/target-source-response.ts` — mock 호환 동작

- 이 파일은 이미 camel/snake 모두 읽도록 작성되어 mock shape를 수정하지 않아도 동작하지만, `isRejected`, `rejectionReason` 필드 전달 규약을 이해해 둘 것.
- mock이 `is_rejected: true` 또는 `isRejected: true`, 둘 중 어느 쪽을 써도 동일하게 소화된다.

### 4.4 🌙 하 — 유지/정보성

#### (K) Logical DB scanner 제거

- `#azure-bff-frontend-todo.md` #11 완료. mock에도 `mockConfirm`/`mockSdu` 호출 경로가 남아있을 수 있으나 Azure 화면에서 렌더링되지 않으므로 실행 영향은 없다. 정리 목적이라면 `LogicalDbStatusPanel` 경로를 grep하여 dead export 정리.

#### (L) Test connection 유지

- `Issue #222`에 test connection이 명시되지 않았지만 UI/API 모두 유지 대상. mock 역시 현재 `mockConfirm.testConnection / getTestConnectionLatest / getTestConnectionResults`를 유지해야 한다. 제거 금지.

#### (M) Azure `getSettings` 경로 재검토

- #217/#249 이후 Azure settings는 `/target-sources/{id}/azure/settings`로 이동. `mockAzure.getSettings`는 `serviceCode` 기반(`getAzureServiceSettings(serviceCode)`)으로 구현되어 있어 경로-파라미터 의미가 다르다. route handler가 mock에 넘길 때 `targetSourceId` → `serviceCode` 해석이 일관되는지 확인할 것 (`app/integration/api/v1/target-sources/[targetSourceId]/azure/settings/route.ts`).

---

## 5. 우선순위 정리

| 순위 | 항목 | 이유 |
|------|------|------|
| 1 | (A) `mockAzure.getScanApp` 메서드 추가 | 런타임 `is not a function` 가능, Azure 화면 진입 불가 |
| 1 | (B) `mockScan.getHistory/create/getStatus` shape 교체 | Azure Scan 탭·히스토리가 legacy shape와 완전히 어긋남 |
| 2 | (C) installation-status 케이스 정합 | Azure 메인 카드 상태 표시가 mismatch 시 비어 보임 |
| 2 | (E) approval request summary snake_case | 관리자 모달·사용자 대기 카드가 summary 필드 의존 |
| 2 | (F) `excluded_resource_infos` 전환 | 승인 후 Azure ownership·선택 복원 |
| 3 | (G) Azure Project에 tenantId/subscriptionId 기본값 | AzureInfoCard가 빈 값으로 보이는 문제 |
| 3 | (D) `/user/me` flat 응답 | 진입 시 사용자 정보 누락 가능 |
| 3 | (H) target-source create 응답 스펙 재검증 | 생성 직후 navigation flow |
| 3 | (I) credential PUT 구현 | 편집 저장 실패 가능 |
| 4 | (M) Azure settings 파라미터 해석 | 경로 ↔ serviceCode 매핑 확인 |
| 4 | (K)(L) logical-db 제거, test connection 유지 확인 | 정리성 |

---

## 6. 검증 시나리오 (mock 수정 후 돌려볼 것)

1. `USE_MOCK_DATA=true`로 dev 서버 기동 후 `/integration/admin` 진입 → Azure target-source 목록에 tenant/subscription 메타가 보이는가.
2. 상세 진입 → `AzureInfoCard`에 Scan App 정보와 installation-status가 표시되는가.
3. 리소스 선택 → 승인 요청 생성 → 대기/반영/완료 카드 흐름이 모두 진행되는가 (`resource_total_count/selected_count`가 summary에 뜨는가).
4. Azure Scan 탭: 이력 조회, 새 스캔 생성, 최신 ScanJob 조회가 에러 없이 로딩되는가.
5. 승인 완료 후 `AzureResourceOwnership`이 `excluded_resource_infos`를 읽어 UI 선택 상태를 복원하는가.
6. Credential 편집 (PUT) 저장 후 상세 재조회 시 값이 유지되는가.
7. `/integration/api-docs`의 Issue #222 swagger "Try it out"으로 주요 엔드포인트를 실행해 Swagger 기대값과 mock 응답이 동일한지 교차 검증.

---

## 7. 참고

- 종합 배경: `docs/reports/azure-bff-frontend-todo.md`
- 실행형 Swagger: `docs/swagger/issue-222-client.yaml`
- Upstream BFF User/Target-Source Swagger: `docs/swagger/user.yaml`
- Azure 페이지 API 카탈로그: `docs/swagger/azure-page-apis.yaml`
- Frontend normalizer 파일 (shape 보정 참조):
  - `lib/target-source-response.ts`
  - `lib/resource-catalog-response.ts`
  - `lib/confirmed-integration-response.ts`
  - `lib/issue-222-approval.ts`
  - `lib/azure-resource-ownership.ts`
- BFF client 비대칭 처리:
  - `lib/api-client/bff-client.ts` (`proxyGet`에만 `camelCaseKeys` 적용, `lib/object-case.ts`)
