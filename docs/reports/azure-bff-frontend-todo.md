# Azure BFF Frontend TODO

> 작성일: 2026-03-29
> 기준 문서: Issue #222 BFF OpenAPI

## 범위

- Azure 화면만 우선 전환한다.
- `logical db scanner` 관련 UI와 API 의존은 제거 대상으로 본다.
- `test connection` 관련 API와 UI는 유지 대상으로 두고, 이번 범위에서는 Swagger 미기재를 이유로 제거하지 않는다.
- 일부 delete API는 이 문서 범위에서 제외한다.

## 전제

- 현재 프론트는 `Project`, `ProjectSummary`, `CurrentUser` 중심의 레거시 read model에 강하게 묶여 있다.
- Issue #222의 Azure 관련 BFF 명세는 기존 프론트가 기대하는 필드를 모두 주지 않는다.
- 따라서 이번 TODO는 "바로 바꿀 수 있는 것"과 "추가 합의가 필요한 것"을 같이 적는다.

## 현재 남은 큰 작업 요약

- 실행형 Swagger와 실제 Next.js API 응답을 전수 대조해 schema/runtime 불일치를 없앤다.
- `GET /install/v1/target-sources/services/{serviceCode}` 설명의 `Azure type only`가 실제 제약인지 확인한다.

## 병렬 진행 메모

- 실행형 Swagger와 실제 Next.js API 응답 전수 검증은 공개 API 경로가 `/integration/api/v1/**`로 정리된 지금 바로 시작할 수 있다.
- `Azure type only` 문구 확인은 Swagger-실응답 전수 검증과 별도로 병행 가능하다.

## Todo

### 0. Next.js 경로 마이그레이션

- [x] `app/api/infra` 프록시 레이어를 제거한다.
  대상: [app/api/infra/v1/[...path]/route.ts](/Users/study/pii-agent-demo-azure-bff-todo/app/api/infra/v1/[...path]/route.ts), [app/lib/api/infra.ts](/Users/study/pii-agent-demo-azure-bff-todo/app/lib/api/infra.ts), [lib/infra-api.ts](/Users/study/pii-agent-demo-azure-bff-todo/lib/infra-api.ts)
- [x] Next.js route handler 경로를 최종적으로 `/integration/api/v1/**` 기준으로 재배치한다.
  대상: [app/integration/api/v1](/Users/study/pii-agent-demo/app/integration/api/v1)
- [x] Azure 화면 진입 page 경로를 `/admin`, `/projects/[projectId]`에서 `/integration/**` 기준으로 변경한다.
  대상: [app/admin/page.tsx](/Users/study/pii-agent-demo-azure-bff-todo/app/admin/page.tsx), [app/admin/dashboard/page.tsx](/Users/study/pii-agent-demo-azure-bff-todo/app/admin/dashboard/page.tsx), [app/projects/[projectId]/page.tsx](/Users/study/pii-agent-demo-azure-bff-todo/app/projects/[projectId]/page.tsx)
- [x] router push, 링크, 새 창 열기 경로를 모두 새 `/integration/**` prefix 기준으로 바꾼다.
  대상: [app/components/features/admin/ProjectsTable.tsx](/Users/study/pii-agent-demo-azure-bff-todo/app/components/features/admin/ProjectsTable.tsx), [app/components/features/admin/AdminHeader.tsx](/Users/study/pii-agent-demo-azure-bff-todo/app/components/features/admin/AdminHeader.tsx), [app/projects/[projectId]/common/ProjectHeader.tsx](/Users/study/pii-agent-demo-azure-bff-todo/app/projects/[projectId]/common/ProjectHeader.tsx), [app/components/features/process-status/azure/AzureInstallationInline.tsx](/Users/study/pii-agent-demo-azure-bff-todo/app/components/features/process-status/azure/AzureInstallationInline.tsx)
- [x] 경로가 `/integration/**`로 바뀌어도 provider/app icon은 바뀌지 않도록 보장한다.
  대상: [app/components/ui/CloudProviderIcon.tsx](/Users/study/pii-agent-demo-azure-bff-todo/app/components/ui/CloudProviderIcon.tsx), [app/components/ui/ServiceIcon.tsx](/Users/study/pii-agent-demo-azure-bff-todo/app/components/ui/ServiceIcon.tsx), [app/icon.svg](/Users/study/pii-agent-demo-azure-bff-todo/app/icon.svg)
- [x] icon 선택 로직이 URL path segment에 의존하지 않도록 확인하고, provider/resource type 데이터만으로 렌더링되게 유지한다.
  대상: [app/components/ui/CloudProviderIcon.tsx](/Users/study/pii-agent-demo-azure-bff-todo/app/components/ui/CloudProviderIcon.tsx), [app/components/ui/ServiceIcon.tsx](/Users/study/pii-agent-demo-azure-bff-todo/app/components/ui/ServiceIcon.tsx)
- [x] Swagger UI 공개 경로도 `/integration/**`를 canonical로 유지한다.
  대상: [app/integration/api-docs/page.tsx](/Users/study/pii-agent-demo-azure-bff-todo/app/integration/api-docs/page.tsx), [app/integration/swagger/[swaggerFileName]/page.tsx](/Users/study/pii-agent-demo-azure-bff-todo/app/integration/swagger/[swaggerFileName]/page.tsx), [app/api-docs/page.tsx](/Users/study/pii-agent-demo-azure-bff-todo/app/api-docs/page.tsx)

### 1. 공통 네트워크 경로 정렬

- [x] upstream base path를 `/infra/v1`에서 `/install/v1` 기준으로 맞춘다.
  대상: [lib/infra-api.ts](/Users/study/pii-agent-demo/lib/infra-api.ts)
- [x] 현재 `app/integration/api/v1/**` route tree에서 실제로 사용하는 BFF 프록시 경로를 새 swagger 경로 체계에 맞게 정리한다.
  대상: [lib/api-client/bff-client.ts](/Users/study/pii-agent-demo/lib/api-client/bff-client.ts)
- [x] 서버 사이드 BFF HTTP 클라이언트가 새 응답 shape를 읽도록 바꾼다.
  대상: [lib/bff/http.ts](/Users/study/pii-agent-demo/lib/bff/http.ts)

### 2. Azure 진입에 필요한 공통 사용자/목록 API 정리

- [x] `GET /install/v1/user/me`의 flat 응답에 맞게 `user/me` route unwrap 로직을 수정한다.
  대상: [app/integration/api/v1/user/me/route.ts](/Users/study/pii-agent-demo/app/integration/api/v1/user/me/route.ts)
- [x] `GET /install/v1/user/services` 응답을 그대로 쓰거나 최소 변환만 하도록 정리한다.
  대상: [app/integration/api/v1/user/services/route.ts](/Users/study/pii-agent-demo/app/integration/api/v1/user/services/route.ts)
- [x] 관리자 목록 진입용 `getProjects()`를 새 `TargetSourceDetail[]` 응답 기준으로 다시 매핑한다.
  대상: [app/lib/api/index.ts](/Users/study/pii-agent-demo-azure-bff-todo/app/lib/api/index.ts)
- [x] 새 목록 응답의 `process_status` string을 현재 FE `ProcessStatus`로 임시 매핑한다.
  대상: [app/lib/api/index.ts](/Users/study/pii-agent-demo-azure-bff-todo/app/lib/api/index.ts), [lib/types.ts](/Users/study/pii-agent-demo-azure-bff-todo/lib/types.ts)
- [x] 관리자 목록 테이블에서 더 이상 보장되지 않는 `projectCode`, `resourceCount`, `connectionTestComplete` 의존을 제거하거나 대체 표시로 바꾼다.
  대상: [app/components/features/admin/ProjectsTable.tsx](/Users/study/pii-agent-demo-azure-bff-todo/app/components/features/admin/ProjectsTable.tsx)

### 3. Azure 프로젝트 생성 흐름 정리

- [x] `POST /install/v1/target-sources/services/{serviceCode}/target-sources` 기준으로 생성 요청 body를 맞춘다.
  대상: [app/lib/api/index.ts](/Users/study/pii-agent-demo-azure-bff-todo/app/lib/api/index.ts)
- [x] 현재 입력 필드 중 swagger에 없는 `projectCode`를 UI에서 제거한다.
  대상: [app/components/features/ProjectCreateModal.tsx](/Users/study/pii-agent-demo-azure-bff-todo/app/components/features/ProjectCreateModal.tsx)
- [x] Azure 생성 시 실제로 쓰는 값은 `description`, `cloudProvider`, `tenantId`, `subscriptionId` 중심으로 재정렬한다.
  대상: [app/components/features/ProjectCreateModal.tsx](/Users/study/pii-agent-demo-azure-bff-todo/app/components/features/ProjectCreateModal.tsx)

### 4. Azure 상세 진입용 read model 재설계

- [x] `GET /install/v1/target-sources/{targetSourceId}` 응답을 공통 `Project` normalize 경로로 흡수하고, 부족한 식별자는 fallback 표시로 보완한다.
  대상: [app/lib/api/index.ts](/Users/study/pii-agent-demo/app/lib/api/index.ts), [lib/target-source-response.ts](/Users/study/pii-agent-demo/lib/target-source-response.ts)
- [x] `cloud_provider: AZURE`를 프론트 내부의 `Azure` 값으로 normalize 한다.
  대상: [app/lib/api/index.ts](/Users/study/pii-agent-demo/app/lib/api/index.ts), [lib/types.ts](/Users/study/pii-agent-demo/lib/types.ts)
- [x] `metadata.tenant_id`, `metadata.subscription_id`를 Azure 프로젝트 정보 카드에서 읽을 수 있도록 상세 응답 매핑을 보강한다.
  대상: [lib/target-source-response.ts](/Users/study/pii-agent-demo/lib/target-source-response.ts), [app/components/features/AzureInfoCard.tsx](/Users/study/pii-agent-demo/app/components/features/AzureInfoCard.tsx)
- [x] 현재 header/sidebar가 기대하는 `serviceCode`, `projectCode`가 swagger detail에 없을 때 fallback 식별자 문구를 사용한다.
  대상: [app/projects/[projectId]/common/ProjectHeader.tsx](/Users/study/pii-agent-demo/app/projects/[projectId]/common/ProjectHeader.tsx), [app/components/features/ProjectInfoCard.tsx](/Users/study/pii-agent-demo/app/components/features/ProjectInfoCard.tsx)

### 5. Azure 리소스 카탈로그 정렬

- [x] `GET /install/v1/target-sources/{targetSourceId}/resources` 응답을 현재 Azure 리소스 테이블이 쓰는 shape로 맞춘다.
  대상: [app/lib/api/index.ts](/Users/study/pii-agent-demo/app/lib/api/index.ts), [lib/resource-catalog-response.ts](/Users/study/pii-agent-demo/lib/resource-catalog-response.ts)
- [x] swagger resource type enum과 현재 프론트 enum의 naming gap을 Azure 기준으로 normalize 한다.
  대상: [lib/resource-catalog-response.ts](/Users/study/pii-agent-demo/lib/resource-catalog-response.ts), [lib/constants/labels.ts](/Users/study/pii-agent-demo/lib/constants/labels.ts), [app/components/ui/ServiceIcon.tsx](/Users/study/pii-agent-demo/app/components/ui/ServiceIcon.tsx)
- [x] 현재 selection 기준은 `resource_id`를 `resource.id`로 정규화한 row key를 사용하도록 정리한다.
  대상: [lib/resource-catalog-response.ts](/Users/study/pii-agent-demo/lib/resource-catalog-response.ts), [lib/azure-resource-ownership.ts](/Users/study/pii-agent-demo/lib/azure-resource-ownership.ts), [app/projects/[projectId]/azure/AzureProjectPage.tsx](/Users/study/pii-agent-demo/app/projects/[projectId]/azure/AzureProjectPage.tsx)

### 6. Azure 승인 요청 생성 정렬

- [x] 승인 요청 payload를 `{ input_data: { resource_inputs } }`에서 swagger 기준 top-level `{ resource_inputs }`로 바꾼다.
  대상: [app/lib/api/index.ts](/Users/study/pii-agent-demo/app/lib/api/index.ts), [app/projects/[projectId]/azure/AzureProjectPage.tsx](/Users/study/pii-agent-demo/app/projects/[projectId]/azure/AzureProjectPage.tsx)
- [x] VM resource input의 endpoint payload 키가 swagger `ResourceConfigDto`와 일치하는지 재확인하고 맞춘다.
  대상: [app/projects/[projectId]/azure/AzureProjectPage.tsx](/Users/study/pii-agent-demo/app/projects/[projectId]/azure/AzureProjectPage.tsx)
- [x] credential update 호출을 `PATCH`에서 `PUT` 계약으로 바꾼다.
  대상: [app/lib/api/index.ts](/Users/study/pii-agent-demo/app/lib/api/index.ts), [app/integration/api/v1/target-sources/[targetSourceId]/resources/credential/route.ts](/Users/study/pii-agent-demo/app/integration/api/v1/target-sources/[targetSourceId]/resources/credential/route.ts)

### 7. Azure 승인 이력/상세 UI 재설계

- [x] `approval-history`와 `approval-requests/latest`가 `input_data.resource_inputs`를 주지 않아도 안전한 summary UI로 상세 모달을 재설계한다.
  대상: [app/components/features/process-status/ApprovalRequestDetailModal.tsx](/Users/study/pii-agent-demo-azure-bff-todo/app/components/features/process-status/ApprovalRequestDetailModal.tsx), [app/components/features/admin/ApprovalDetailModal.tsx](/Users/study/pii-agent-demo-azure-bff-todo/app/components/features/admin/ApprovalDetailModal.tsx)
- [x] `ApprovalWaitingCard`와 `ApprovalApplyingBanner`의 "요청 내용 확인" 액션을 새 summary schema 기준으로 다시 설계한다.
  대상: [app/components/features/process-status/ApprovalWaitingCard.tsx](/Users/study/pii-agent-demo-azure-bff-todo/app/components/features/process-status/ApprovalWaitingCard.tsx), [app/components/features/process-status/ApprovalApplyingBanner.tsx](/Users/study/pii-agent-demo-azure-bff-todo/app/components/features/process-status/ApprovalApplyingBanner.tsx)
- [x] Azure selection 복원 로직이 approval history 상세 입력에 과하게 의존하지 않도록 보정한다.
  대상: [lib/azure-resource-ownership.ts](/Users/study/pii-agent-demo-azure-bff-todo/lib/azure-resource-ownership.ts)

### 8. Azure approved/confirmed integration 정렬

- [x] `approved-integration` 응답을 top-level Issue #222 schema로 읽고, 앱 레이어에서 필요한 shape로 다시 적응한다.
  대상: [app/lib/api/index.ts](/Users/study/pii-agent-demo/app/lib/api/index.ts), [app/projects/[projectId]/azure/AzureProjectPage.tsx](/Users/study/pii-agent-demo/app/projects/[projectId]/azure/AzureProjectPage.tsx)
- [x] `excluded_resource_ids` 기반 로직을 `excluded_resource_infos` 기반으로 바꾼다.
  대상: [app/lib/api/index.ts](/Users/study/pii-agent-demo/app/lib/api/index.ts), [lib/azure-resource-ownership.ts](/Users/study/pii-agent-demo/lib/azure-resource-ownership.ts)
- [x] `confirmed-integration`의 `ip_configuration` 필드를 현재 프론트 필드명과 매핑한다.
  대상: [lib/confirmed-integration-response.ts](/Users/study/pii-agent-demo/lib/confirmed-integration-response.ts)

### 9. Azure process status polling 재설계

- [x] 현재 `status_inputs` 기반 polling 로직을 제거하고, swagger `process_status`와 프로젝트 재조회만으로 상태 전이를 판단하도록 바꾼다.
  대상: [app/lib/api/index.ts](/Users/study/pii-agent-demo/app/lib/api/index.ts), [app/components/features/ProcessStatusCard.tsx](/Users/study/pii-agent-demo/app/components/features/ProcessStatusCard.tsx)
- [x] 기존 FE `ProcessStatus` enum은 유지하고, Azure는 adapter로 BFF string status를 연결하는 방향으로 정리한다.
  대상: [lib/types.ts](/Users/study/pii-agent-demo/lib/types.ts), [lib/process/index.ts](/Users/study/pii-agent-demo/lib/process/index.ts)

### 10. Azure 설치 상태/Scan App 조회 정리

- [x] 기존 `getAzureSettings()` 전면 의존을 제거하고, `/azure/scan-app`과 detail metadata를 주 경로로 사용한다. 현재는 Azure identifier 보정용 fallback만 남겨둔다.
  대상: [app/lib/api/azure.ts](/Users/study/pii-agent-demo-azure-bff-todo/app/lib/api/azure.ts), [app/projects/[projectId]/azure/AzureProjectPage.tsx](/Users/study/pii-agent-demo-azure-bff-todo/app/projects/[projectId]/azure/AzureProjectPage.tsx)
- [x] `AzureInfoCard`가 새 scan app schema `app_id/status/fail_reason/fail_message/last_verified_at`를 표시하도록 바꾼다.
  대상: [app/components/features/AzureInfoCard.tsx](/Users/study/pii-agent-demo-azure-bff-todo/app/components/features/AzureInfoCard.tsx)
- [x] `AzureInstallationInline`가 새 installation status schema에 맞게 동작하도록 조정한다.
  대상: [app/components/features/process-status/azure/AzureInstallationInline.tsx](/Users/study/pii-agent-demo-azure-bff-todo/app/components/features/process-status/azure/AzureInstallationInline.tsx)

### 11. Logical DB scanner 제거

- [x] Azure 경로에서 `LogicalDbStatusPanel` 렌더링을 제거한다.
  대상: [app/components/features/ProcessStatusCard.tsx](/Users/study/pii-agent-demo-azure-bff-todo/app/components/features/ProcessStatusCard.tsx)
- [x] 더 이상 쓰지 않는 `getConnectionStatus()`와 `LogicalDbStatusPanel` export 의존을 정리한다.
  대상: [app/lib/api/index.ts](/Users/study/pii-agent-demo-azure-bff-todo/app/lib/api/index.ts), [app/components/features/process-status/index.ts](/Users/study/pii-agent-demo-azure-bff-todo/app/components/features/process-status/index.ts), [app/components/features/process-status/LogicalDbStatusPanel.tsx](/Users/study/pii-agent-demo-azure-bff-todo/app/components/features/process-status/LogicalDbStatusPanel.tsx)

### 12. Test connection 유지 원칙

- [x] `Issue #222`에 test connection이 명시되지 않았더라도, Azure test connection UI/API는 제거 대상으로 보지 않는다.
  대상: [app/components/features/ProcessStatusCard.tsx](/Users/study/pii-agent-demo-azure-bff-todo/app/components/features/ProcessStatusCard.tsx), [app/components/features/process-status/ConnectionTestPanel.tsx](/Users/study/pii-agent-demo-azure-bff-todo/app/components/features/process-status/ConnectionTestPanel.tsx)
- [x] Swagger 미기재는 기능 삭제 근거가 아니라 문서 범위 제외로 해석한다는 점을 작업 기준에 반영한다.
  대상: [docs/reports/azure-bff-frontend-todo.md](/Users/study/pii-agent-demo-azure-bff-todo/docs/reports/azure-bff-frontend-todo.md), [docs/swagger/issue-222-client.yaml](/Users/study/pii-agent-demo-azure-bff-todo/docs/swagger/issue-222-client.yaml)

### 13. 최종 계약 검증

- [ ] 모든 작업이 끝난 뒤, 실행형 Swagger와 실제 Next.js API 응답이 일치하는지 전수 확인한다.
  대상: [docs/swagger/issue-222-client.yaml](/Users/study/pii-agent-demo/docs/swagger/issue-222-client.yaml), [app/integration/api/v1](/Users/study/pii-agent-demo/app/integration/api/v1)
- [ ] 특히 Swagger schema와 실제 응답 body shape가 달라질 수 있는 엔드포인트를 우선 점검한다.
  예: `GET /integration/api/v1/user/me`, `GET /integration/api/v1/user/services`, `GET /integration/api/v1/target-sources/{targetSourceId}`, `GET /integration/api/v1/target-sources/{targetSourceId}/process-status`
- [ ] 불일치가 있으면 구현 또는 Swagger 중 하나를 반드시 맞추고, 변경된 실제 응답 예시는 PR description에 남긴다.
  대상: [docs/swagger/issue-222-client.yaml](/Users/study/pii-agent-demo/docs/swagger/issue-222-client.yaml)

### 14. Next.js API 공개 경로 재정렬

- [x] Next.js API 공개 경로를 `/integration/api/v1/**` 기준으로 재정렬했다.
  대상: [app/integration/api/v1](/Users/study/pii-agent-demo/app/integration/api/v1), [lib/infra-api.ts](/Users/study/pii-agent-demo/lib/infra-api.ts)
- [x] 실행형 Swagger의 호출 주소도 실제 Next.js API 경로와 함께 동일하게 변경했다.
  대상: [docs/swagger/issue-222-client.yaml](/Users/study/pii-agent-demo/docs/swagger/issue-222-client.yaml), [app/integration/api-docs/page.tsx](/Users/study/pii-agent-demo/app/integration/api-docs/page.tsx), [app/integration/swagger/[swaggerFileName]/page.tsx](/Users/study/pii-agent-demo/app/integration/swagger/[swaggerFileName]/page.tsx)
- [x] upstream BFF 계약 경로는 계속 `/install/v1/**`로 유지하고, 이 변경은 Next.js 공개 API 경로와 실행형 Swagger에만 적용한다.
  대상: [docs/swagger/user.yaml](/Users/study/pii-agent-demo/docs/swagger/user.yaml), [docs/swagger/issue-222-client.yaml](/Users/study/pii-agent-demo/docs/swagger/issue-222-client.yaml), [lib/api-client/bff-client.ts](/Users/study/pii-agent-demo/lib/api-client/bff-client.ts)

## 우선순위

### 바로 시작 가능한 순서

- [x] 0단계: Next.js 경로 마이그레이션
- [x] 1단계: 공통 네트워크 경로 정렬
- [x] 2단계: Azure 목록/생성 진입 정리
- [x] 3단계: Azure 상세 read model 정리
- [ ] 4단계: 최종 Swagger-실제 API 계약 cleanup
- [x] 5단계: Azure 설치 상태/Scan App 정리
- [x] 6단계: logical db scanner 제거
- [x] 7단계: Azure test connection 유지 원칙 반영
- [ ] 8단계: 최종 Swagger-실제 API 계약 검증
- [x] 9단계: Next.js API 공개 경로 `/integration/api/v1/**` 재정렬

## 명세 보완 또는 별도 합의가 필요한 항목

- [x] route handler 최종 URL 규칙은 `/integration/api/v1/**`로 정리했다.
- [x] page 최종 URL 규칙은 `/integration/admin`, `/integration/projects/[id]` 기준으로 정리했다.
- [x] Next.js API 공개 경로는 `/integration/api/v1/**`로 정리했다.
- [x] 현재 integration route tree가 실제로 쓰는 BFF upstream path는 `/install/v1/**` 기준으로 정리했다.
- [x] `GET /install/v1/target-sources/{targetSourceId}` 기준 상세 화면은 공통 normalize + fallback identifier 표시로 유지한다.
- [ ] `GET /install/v1/target-sources/services/{serviceCode}` 설명의 `Azure type only`가 실제 제약인지 확인 필요
- [x] approval history 상세 모달은 summary UI로 축소하고, legacy `resource_inputs`는 선택적 호환 데이터로만 취급한다.
- [x] Azure resource type enum naming은 FE normalize(`normalizeResourceType`, `normalizeAzureResourceType`)로 유지한다.
