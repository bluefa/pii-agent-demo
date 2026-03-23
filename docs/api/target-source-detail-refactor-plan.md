# Target Source Detail Refactor Plan

## 1. 목적

`GET /target-sources/{targetSourceId}`를 Azure 상세 페이지의 god API 역할에서 분리하고, 최종적으로는 `GET /services/{serviceCode}/target-sources`와 유사한 최소 컨텍스트 API로 축소한다.

이 문서는 PR #212 머지 이후의 `main`을 기준으로 작성한다. 즉 아래 사항은 이미 반영된 상태를 전제로 한다.

- `GET /target-sources/{targetSourceId}`는 wrapper 없는 flat 응답으로 문서화되어 있다.
- `docs/swagger/azure-page-apis.yaml`가 존재해 Admin -> Azure 상세 호출 카탈로그가 정리되어 있다.

따라서 이번 문서의 범위는 "flat 응답으로 바꾸기"가 아니라, 그 다음 단계인 "필드 슬림화와 책임 분리"다.

이번 계획의 고정 조건:

- 새 API Path는 추가하지 않는다.
- 기존 API만 재사용하거나, 기존 API의 response schema만 확장/정리한다.
- 1차 기준 시나리오는 `Admin -> Azure 상세 -> 모든 ProcessStatus 경유` 흐름이다.
- 다만 `GET /target-sources/{targetSourceId}`는 공통 상세 API이므로 AWS/GCP/IDC 영향도 함께 본다.

## 2. 현재 문제

현재 `GET /target-sources/{targetSourceId}`는 flat 응답까지는 정리됐지만, 여전히 Swagger `TargetSourceDetail`보다 훨씬 큰 실제 payload를 반환하고 있고, 프론트도 아래 책임을 한 번에 기대하고 있다.

- 상세 페이지 공통 헤더/기본 정보
- Provider별 식별자 표시
- 리소스 선택 테이블 원본
- 승인 요청 직후 상태 복원
- 설치/연결 테스트 이후 상태 계산용 `status`
- 일부 과거 호환 필드(`terraformState`, `processStatus`, `completionConfirmedAt` 등)

특히 `resources`는 의미가 너무 넓다.

- 스캔으로 발견된 리소스 목록
- 현재 선택된 연동 대상
- 승인 요청에 포함된 스냅샷
- 반영 중(approved) 스냅샷
- 실제 반영 완료(confirmed) 스냅샷

이렇게 서로 다른 시점의 리소스를 하나의 `resources` 필드로 처리하고 있어서, 응답 의미도 모호하고 컴포넌트 의존도도 높다.

## 3. 현재 기존 API로 이미 분리 가능한 책임

신규 Path 없이도, 리소스와 단계 정보의 대부분은 아래 기존 API들로 분리할 수 있다.

| 책임 | 기존 API |
|---|---|
| 상세 페이지 최소 컨텍스트 | `GET /target-sources/{targetSourceId}` |
| 서비스/과제 목록 컨텍스트 | `GET /services/{serviceCode}/target-sources` |
| 연동 가능 리소스 카탈로그 | `GET /target-sources/{targetSourceId}/resources` |
| 승인 요청 입력 스냅샷 | `GET /target-sources/{targetSourceId}/approval-history?page=0&size=1` |
| 반영 중 대상 스냅샷 | `GET /target-sources/{targetSourceId}/approved-integration` |
| 실제 확정 대상 스냅샷 | `GET /target-sources/{targetSourceId}/confirmed-integration` |
| 상위 프로세스 상태 | `GET /target-sources/{targetSourceId}/process-status` |
| Azure 설치 진행 | `GET /azure/target-sources/{targetSourceId}/installation-status` |
| Azure 대상 설정 | `GET /azure/target-sources/{targetSourceId}/settings` |
| 연결 테스트 최신 상태 | `GET /target-sources/{targetSourceId}/test-connection/latest` |
| 연결 테스트 이력 | `GET /target-sources/{targetSourceId}/test-connection/results` |
| 진행 이력 | `GET /target-sources/{targetSourceId}/history` |

핵심 결론:

- `resources`는 기존 API 조합으로 `GET /target-sources/{targetSourceId}`에서 제거 가능하다.
- 다만 현재 `/resources` 응답은 Azure 선택 UI가 쓰는 필드를 충분히 담고 있지 않아서, 기존 `/resources` schema 확장이 선행되어야 한다.

## 4. 현재 `GET /target-sources/{targetSourceId}` 의존 필드 분류

### 4-1. 공통 상세 컨텍스트로 남겨도 되는 최소 필드

아래 필드는 최종적으로도 detail context로 남겨도 무방하다.

- `target_source_id`
- `project_code`
- `service_code`
- `description`
- `cloud_provider`
- `created_at`

이 집합은 사실상 `serviceCode` 하위 목록의 summary에 `service_code`와 `description`을 보강한 수준이다.

### 4-2. `GET /target-sources/{targetSourceId}`에서 제거 대상

아래 필드는 detail API 본문에서 제거하고, 기존 다른 API로 역할을 이동시키는 것이 맞다.

- `resources`
- `status`
- `process_status`
- `terraform_state`
- `is_rejected`
- `rejection_reason`
- `rejected_at`
- `approval_comment`
- `approved_at`
- `pii_agent_installed`
- `pii_agent_connected_at`
- `completion_confirmed_at`
- `updated_at`
- `name`

### 4-3. Provider 식별자 필드

아래 필드는 UI에서 실제 사용 중이지만, 상세 API에 둘 필요는 없다.

- AWS: `aws_account_id`, `aws_region_type`, `aws_installation_mode`
- Azure: `tenant_id`, `subscription_id`
- GCP: `gcp_project_id`

이 값들은 새 API를 만들지 않고도 각 Provider의 기존 `settings` API로 이동하는 것이 가장 자연스럽다.

## 5. `resources` 제거 가능성 검토

### 결론

가능하다. 다만 `GET /target-sources/{targetSourceId}/resources`를 기존 selection UI의 기준 API로 승격해야 한다.

### 이유

현재 Azure 페이지에서 `project.resources`가 담당하는 일은 아래 네 가지다.

1. 편집 가능한 리소스 목록 표시
2. 현재 선택/비선택 상태 표시
3. VM 설정/NIC/네트워킹 모드 렌더링
4. 승인 요청 payload 생성의 기본 재료

이 중 1, 2, 3, 4 모두 기존 API만으로 재구성 가능하다.

- 기본 카탈로그: `/target-sources/{id}/resources`
- 최신 요청 스냅샷: `/approval-history`
- 반영 중 스냅샷: `/approved-integration`
- 실제 반영 완료 스냅샷: `/confirmed-integration`

즉, 문제는 “불가능”이 아니라 “현재 `/resources` schema가 selection UI의 소스 역할을 하도록 설계되지 않았다”는 점이다.

### `/resources`에 추가로 실어야 하는 필드

신규 Path 추가 없이, 기존 `/target-sources/{targetSourceId}/resources` response에 아래 필드를 포함시키는 migration이 필요하다.

- `database_type`
- `network_interface_id`
- `ip_configuration_name`
- `host`
- `port`
- `oracle_service_id`

중요한 점:

- 이는 새 API가 아니라 기존 `/resources` schema 확장이다.
- 이 작업이 끝나면 Azure/AWS/GCP 선택 테이블은 `project.resources` 대신 `/resources`만으로 렌더링할 수 있다.
- Azure에서 연동 가능 여부 판단은 `azure_networking_mode`가 아니라 `integration_category`를 기준으로 본다.
- `is_selected`는 `/resources`에 두지 않는다. 선택 상태는 리소스 카탈로그의 속성이 아니라, 승인/확정 스냅샷의 상태이기 때문이다.
- `selected_credential_id`도 `/resources`에 두지 않는다. Credential 반영값은 `approval-history`, `approved-integration`, `confirmed-integration` 같은 기존 snapshot 계열 API에서 복원하는 방향을 기준으로 한다.

## 6. 상태(`status`) 제거 가능성 검토

### 결론

`status` 전체를 detail API에서 제거하는 것도 가능하다. 대신 상태 책임을 기존 read API로 재배치해야 한다.

### 권장 재배치

| UI 판단 책임 | 기존 API |
|---|---|
| 요청 필요 / 승인 대기 / 반영 중 / 확정 완료 | `/target-sources/{id}/process-status` |
| 설치 진행 상세 | Provider별 `/installation-status` |
| 연결 테스트 필요 / 최근 성공 여부 | `/test-connection/latest` |
| 최종 관리자 확정 여부 | `/target-sources/{id}/history` 또는 `/process-status` 확장 |
| 최근 반려 사유 | `/process-status.status_inputs.last_rejection_reason` 또는 `/approval-history` |

### 구현 관점 해석

현재 프론트는 `project.status`를 받아서 `getProjectCurrentStep()`으로 7단계를 계산한다. 이 계산 책임을 detail API가 계속 들고 있으면, detail API는 계속 비대해질 수밖에 없다.

따라서 다음 중 하나로 정리해야 한다.

1. `process-status`를 기존 coarse 상태(4개)에서 UI 친화적 상태로 확장한다.
2. 또는 프론트가 `process-status + installation-status + test-connection/latest + history`를 합성해서 현재 단계를 계산한다.

새 Path 추가 금지 조건을 감안하면 1번이 더 단순하다. 즉, 새 API를 만들지 말고 기존 `/process-status`에 read 책임을 더 싣는 편이 낫다.

## 7. 최종 목표 응답

최종적으로 `GET /target-sources/{targetSourceId}`는 아래 수준까지 축소하는 것을 목표로 한다.

```json
{
  "target_source_id": 1001,
  "project_code": "N-IRP-001",
  "description": "PII Agent 설치 대상",
  "cloud_provider": "Azure",
  "created_at": "2026-02-16T10:00:00Z",
  "service_code": "SERVICE-A"
}
```

원칙:

- `GET /services/{serviceCode}/target-sources` summary와 거의 동일한 수준
- 상세 페이지 진입에 필요한 최소 context만 유지
- 리소스, 상태, Provider 보조 정보는 각 전용 기존 API에서 조회

## 8. 제안 Migration 단계

### Phase 0. Contract Freeze

- 새 API Path 추가 금지 원칙 확정
- `GET /target-sources/{targetSourceId}` 최종 목표 응답 고정
- `resources`, `status`, Provider 식별자 필드를 상세 API 제거 대상으로 명시

### Phase 1. Resource Ownership 이전

목표:

- Azure/AWS/GCP 선택 UI가 `project.resources`가 아니라 `/resources`를 기준으로 동작하도록 전환

작업:

- `docs/swagger/confirm.yaml`
  - `/target-sources/{targetSourceId}/resources` schema 확장
- 프론트
  - `AzureProjectPage`, `AwsProjectPage`, `GcpProjectPage`
  - `ResourceTable`, `ProcessStatusCard`, `ResourceTransitionPanel`
  - `project.resources` 직접 의존 제거

리소스 해석 규칙:

- 기본 목록: `/resources`
- 승인 대기 표시: latest `/approval-history`
- 반영 중 신규 스냅샷: `/approved-integration`
- 반영 완료 기존 스냅샷: `/confirmed-integration`

### Phase 2. Provider 식별자 이전

목표:

- Provider별 보조 식별자를 detail API에서 제거

작업:

- Azure: `tenant_id`, `subscription_id` -> 기존 `/azure/target-sources/{id}/settings`
- AWS: `aws_account_id`, `aws_region_type`, `aws_installation_mode` -> 기존 `/aws/target-sources/{id}/settings` 및 `/installation-mode` read model 정리
- GCP: `gcp_project_id` -> 기존 `/gcp/target-sources/{id}/settings`

주의:

- path 추가는 금지
- settings 응답 확장만 허용

### Phase 3. 상태 책임 이전

목표:

- `project.status` 제거

작업:

- `/target-sources/{id}/process-status`를 UI read model로 확장하거나
- 프론트 합성 로직을 도입해 `process-status + installation-status + test-connection/latest + history`로 현재 단계를 계산

권장:

- 새 path 없이 구현 단순성을 유지하려면 `/process-status` 확장이 가장 낫다.

### Phase 4. Detail API 축소

목표:

- 이미 flat인 `GET /target-sources/{targetSourceId}`를 최종 목표 응답으로 추가 축소

작업:

- Swagger `user.yaml` 정리
- `app/api/v1/target-sources/[targetSourceId]/route.ts` 응답 최소화
- `bff.targetSources.get()`와 `getProject()` 호출부를 새 read model에 맞춰 분해

## 9. 프론트 Migration 방식

### 9-1. 추천 방식

현재 `Project` 하나에 모든 read state를 넣지 말고, 상세 페이지 read model을 아래처럼 나눈다.

- `TargetSourceContext`
  - detail 최소 정보
- `ResourceCatalog`
  - `/resources`
- `ProcessState`
  - `/process-status`
- `ProviderSettings`
  - `/azure|aws|gcp/.../settings`
- `InstallationState`
  - provider `/installation-status`
- `ConnectionState`
  - `/test-connection/latest`

즉, “한 번에 큰 Project 객체를 받는 구조”에서 “페이지가 필요한 read model을 병렬 조회하는 구조”로 바꾼다.

### 9-2. Azure 상세 페이지 기준 bootstrap

초기 진입 시:

- `GET /target-sources/{targetSourceId}`
- `GET /target-sources/{targetSourceId}/process-status`
- `GET /target-sources/{targetSourceId}/resources`
- `GET /target-sources/{targetSourceId}/secrets`
- `GET /azure/target-sources/{targetSourceId}/settings`
- 현재 단계에 따라
  - `/approved-integration`
  - `/confirmed-integration`
  - `/azure/target-sources/{targetSourceId}/installation-status`
  - `/target-sources/{targetSourceId}/test-connection/latest`

포인트:

- 초기부터 모든 API를 무조건 다 부르지 않고, 단계 기반 조건부 로딩을 둔다.
- 하지만 더 이상 `getProject()` 한 번으로 모든 UI를 복원하려고 하지 않는다.

## 10. 검증 계획

### 10-1. 계약 검증

- `docs/swagger/user.yaml`
  - `GET /target-sources/{targetSourceId}` 최소 응답 확인
- `docs/swagger/confirm.yaml`
  - `/resources`, `/process-status`, `/approved-integration`, `/confirmed-integration` 역할 재정의 확인
- `docs/swagger/azure.yaml`
  - Azure settings에 이동된 식별자 필드 반영 여부 확인

### 10-2. 코드 검증

- `rg` 기준으로 `project.resources`, `project.status`, `project.tenantId`, `project.subscriptionId` 등 직접 접근 지점을 단계별로 줄여간다.
- Azure 상세 페이지에서 `getProject()` 이후 UI refresh가 필요한 지점을 개별 refetch로 치환한다.
- SSR 진입부 `app/projects/[projectId]/page.tsx`가 필요한 read model을 병렬 조회하는지 확인한다.

### 10-3. 시나리오 검증

Azure 기준으로 아래 상태를 모두 통과 확인한다.

1. 최초 진입
2. 스캔 완료 후 리소스 선택
3. 승인 요청 생성
4. 승인 대기
5. 승인 완료 후 반영 중
6. 설치 진행 중
7. 설치 완료, 연결 테스트 대기
8. 연결 테스트 성공
9. 관리자 설치 완료 확정

확인 포인트:

- `GET /target-sources/{targetSourceId}` 응답이 최소화되어도 화면 진입이 깨지지 않는가
- 리소스 테이블이 `/resources` 기반으로 동일하게 동작하는가
- 반영 중 비교 UI가 `/approved-integration` + `/confirmed-integration` 조합으로 유지되는가
- 최종 완료 상태가 detail API 없이도 복원되는가

### 10-4. 회귀 검증 명령

구현 단계에서는 아래를 기본 검증 세트로 사용한다.

```bash
npm run test:run
npm run lint
npm run build
```

## 11. 권장 구현 순서

리스크를 가장 낮추는 순서는 아래다.

1. `/resources` schema 확장
2. Azure 페이지에서 `project.resources` 제거
3. Provider settings로 식별자 이동
4. `/process-status`를 UI read model로 승격
5. `GET /target-sources/{targetSourceId}` 최소화

이 순서를 추천하는 이유:

- `resources` 제거가 가장 큰 payload 감소 효과를 만든다.
- 동시에 화면 영향 범위가 명확해서 검증하기 쉽다.
- 그 다음에 상태/Provider 정보로 넘어가야 리그레션을 좁게 관리할 수 있다.

## 12. 최종 판단

### 가능한 것

- 새 API 없이 `resources`를 `GET /target-sources/{targetSourceId}`에서 제거
- 새 API 없이 Provider 식별자를 기존 settings API로 이동
- 새 API 없이 상태 계산 책임을 기존 `/process-status`와 read API들로 재배치
- 최종적으로 detail API를 summary 수준으로 축소

### 전제 조건

- 기존 API의 response schema는 역할에 맞게 확장되어야 한다.
- 특히 `/resources`, `/process-status`, 각 provider `/settings`는 현재보다 더 분명한 read 책임을 가져야 한다.

즉, 이번 리팩토링의 핵심은 “새 API 추가”가 아니라 “기존 API의 책임 재배치”다.
