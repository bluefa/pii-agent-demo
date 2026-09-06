# 에러 코드 카탈로그

> Confluence: 5.2.3.5.5.10.2.1
> 상태: Draft
> 마지막 수정일: 2026-09-06
> 대상: BFF API error code의 운영 의미, 사용자 액션, 운영자 확인 포인트

## 1. 목적

이 문서는 BFF API error code의 운영 의미를 설명하는 카탈로그다.

Swagger/OpenAPI와 코드는 error code 값과 response schema의 원본이다. 이 문서는 값을 대체하지 않고, 각 code가 어떤 상황에서 발생하는지, 사용자가 무엇을 해야 하는지, 운영자가 무엇을 확인해야 하는지를 정리한다.

## 2. 공통 원칙

- Error code 값의 원본은 BFF Swagger와 구현 코드다.
- 이 문서는 code의 의미, 발생 조건, 재시도 가능 여부, 사용자/운영자 액션을 설명한다.
- 동일 code라도 작업별 발생 조건이 다를 수 있으므로 관련 API 그룹과 자체 code의 발생 지점을 기록한다. 전체 엔드포인트 목록은 Swagger를 참조한다.
- 사용자 입력이나 요청 구조 문제는 일반적으로 재시도 전에 입력값 또는 클라이언트 payload를 수정해야 한다.
- 서버가 허용하지 않는 business rule 위반은 자동 sanitize 또는 묵시적 보정 없이 명시적인 error code로 반환한다.

## 3. 기존 Error Response Format (2026-04-29 기록)

아래는 기존 Admin Guides의 `application/json` / `ErrorMessage` 기록이다. 2026-09-06 전달본의 신규 BFF code로 자동 치환하지 않는다. 최신 실제 응답 예시·배포 버전은 확인 대기이며, Phase 1은 응답 schema나 런타임 변환을 변경하지 않는다.

```json
{
  "timestamp": "2026-04-29T02:27:09.123Z",
  "status": "BAD_REQUEST",
  "code": "VALIDATION_FAILED",
  "message": "contents.ko must be a string",
  "path": "uri=/install/v1/admin/guides/FRONTEND_ONLY_GUIDE"
}
```

| Field | 의미 |
| --- | --- |
| `timestamp` | BFF가 error response를 생성한 시각. UTC 기준 ISO-8601 문자열이며, 화면 표시가 필요하면 클라이언트 로컬 timezone 기준으로 변환한다. |
| `status` | HTTP status 이름 |
| `code` | BFF error code. 일부 공통 에러에서는 null일 수 있다. |
| `message` | 개발자/운영자가 원인 파악에 참고할 수 있는 메시지 |
| `path` | 요청 URI 정보 |

## 4. 기존 Error Code 목록 (호환 기록)

현재 코드·Tag 가이드가 참조하는 레거시 항목이다. 신규 `BFF_` code와 의미가 유사해도 원본·배포 버전의 대조 없이 alias로 만들거나 삭제하지 않는다. 아래 운영 안내는 기존 계약의 기록이며 신규 계약에 적용할 UX는 Phase 2 이후에 별도로 확인한다.

| 코드 | HTTP status | 의미 | 발생 조건 | 재시도 가능 여부 | 사용자 액션 | 운영자 확인 포인트 | 관련 API Tag | 관련 API | 폐기 예정 여부 | 추가일 / 변경일 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `VALIDATION_FAILED` | 400 Bad Request | 요청 JSON 구조 또는 필드 타입이 BFF 계약과 맞지 않음 | `contents`가 없거나 null인 경우, `contents.ko` 또는 `contents.en`이 없거나 문자열이 아닌 경우, JSON body 파싱 실패 | 아니오. 같은 payload로 재시도해도 실패한다. | 화면에서 저장 요청 payload 생성 로직을 수정한다. 사용자가 직접 해결할 수 있는 입력 문제가 아니라면 저장 실패 안내 후 재시도 버튼보다 문의/새로고침을 우선한다. | 클라이언트가 `contents.ko`, `contents.en`을 항상 string으로 전송하는지 확인한다. API client, editor state serialization, Content-Type을 확인한다. | Admin Guides | `PUT /install/v1/admin/guides/{name}` | 아니오 | 2026-04-28 |
| `GUIDE_CONTENT_INVALID` | 400 Bad Request | Guide HTML content가 BFF allow-list 또는 non-empty 규칙을 만족하지 않음 | `ko` 또는 `en`의 HTML 제거 후 텍스트가 비어 있는 경우, 허용되지 않은 HTML tag/attribute/link scheme이 포함된 경우 | 아니오. content를 수정해야 한다. | 사용자가 guide 본문을 입력하거나 허용된 서식만 사용하도록 안내한다. 에디터는 저장 전에 동일한 allow-list 검증을 수행하고, 실패 위치를 가능한 한 입력 화면에서 표시한다. | 서버 validator와 프론트 validator의 allow-list가 같은지 확인한다. 저장 요청이 sanitize된 값이 아니라 원본 HTML을 보내고 있는지, 금지 tag/attribute가 editor에서 생성되는지 확인한다. | Admin Guides | `PUT /install/v1/admin/guides/{name}` | 아니오 | 2026-04-28 |

## 5. 기존 Admin Guides 운영 기준 (2026-04-29 기록)

Admin Guides는 guide name catalog를 BFF에서 검증하지 않는다.

- 알 수 없는 `{name}`을 조회해도 `GUIDE_NOT_FOUND`를 반환하지 않는다.
- 저장된 row가 없으면 `GET /install/v1/admin/guides/{name}`은 `200 OK`와 빈 `contents`를 반환한다.
- `PUT /install/v1/admin/guides/{name}`에서 검증 대상은 path의 `name`이 아니라 request body 구조와 HTML content다.

따라서 Admin Guides에서 운영자가 우선 확인해야 할 error code는 `VALIDATION_FAILED`와 `GUIDE_CONTENT_INVALID`다.

## 6. 관련 API Tag

| API Tag | 문서 | 관련 error code |
| --- | --- | --- |
| Admin Guides | [admin-guides.md](../tag-guides/admin-guides.md) | `VALIDATION_FAILED`, `GUIDE_CONTENT_INVALID` |

## 7. 2026-09-06 전달 계약 — Phase 1 등록

### 7.1 출처·확인 상태·적용 범위

- 출처: 사용자가 이 작업 대화에 전달한 PASS BFF 오류 처리 문서 6~10장 및 부록 B 발췌. 아래 소스 경로는 전달 문서가 지목한 Backend 경로이며 이 저장소에서 직접 확인한 파일이 아니다.
- 모든 신규 행의 확인 상태: **전달본에 명시됨 / upstream 구현·배포 버전 미대조**. 추가일은 2026-09-06이며 폐기·대체 여부는 미확인이다.
- 전달 범위: BFF 13 + Infra 67(17+10+22+18) + Jira 2 = **82개**. BFF 제목은 12개이나 실제 표는 13개다. Jira는 enum 8개 중 2개만 전달되었다. Orchestration 구체 목록은 미제공이다.
- 계약 상수·타입: [backend-error-codes.ts](../../../lib/constants/backend-error-codes.ts). 문서와 상수의 code·HTTP 집합 일치는 계약 테스트로 검증한다. 이는 repo 내부 일치 검증이며 upstream 최신성 검증은 아니다.
- 신규 목록은 기존 AppErrorCode, KNOWN_ERROR_CODES, fetchJson, BFF 오류 변환, 화면 처리에 연결하지 않았다. 전용 UX·문구·CTA·재시도는 [단계별 계획](../../feature/error-code-expansion-phase-plan.md)의 Phase 2~5에서 검토한다.
- 오류 timestamp는 UTC ISO-8601 문자열로 보존하고 화면 표시 경계에서만 시간대를 변환하는 기존 정책을 유지한다.

### 7.2 code와 HTTP의 관계

HTTP status는 오류의 큰 분류이고 code는 구체적인 원인이다. **둘의 관계가 1:1이어야 하는 것은 아니다.** 같은 HTTP에 여러 code가 대응하며, 하나의 code에 여러 HTTP가 대응하는 계약도 가능하다. 후자의 경우 허용 조합·발생 조건을 원본 계약에서 명시해야 한다.

현재 전달본은 code마다 HTTP 하나를 명시하므로 아래와 상수에는 그 **예상 HTTP**를 기록한다. 이 값으로 실제 응답 HTTP를 생성하거나 덮어쓰지 않는다. 향후 code와 HTTP 조합이 달라지면 계약을 확인하고 기록 구조를 조정한다. 현재의 단일 값 구조가 API에 1:1 관계를 강제하는 것은 아니다.

Phase 2 이후에는 알려진 code의 의미를 우선 판단하고 unknown/null은 실제 응답 HTTP로 fallback한다. 기대값과 실제 HTTP가 다르면 차이를 관측하되 FE에서 기대값으로 수정하지 않는다. code의 이름이나 prefix로 status·의미를 추측하지 않는다.

### 7.3 BFF 자체 code (13)

원본 표기: `sit/exception/BffErrorCode.java`. 아래 경로는 `/install/v1` 기준이다. 인증은 모든 엔드포인트, upstream 오류는 Backend 호출 엔드포인트에 공통 적용된다.

| 코드 | HTTP | 의미·발생 조건 | 관련 API 그룹·발생 지점 |
| --- | --- | --- | --- |
| `BFF_REQUEST_INVALID` | 400 | PASS 요청 검증 실패 | 생성 후보·Guide 입력·ID/page/size 검증·권한 관리. 세부 조건은 §7.8 |
| `BFF_GUIDE_CONTENT_INVALID` | 400 | Guide 내용 검증 실패 | `PUT /admin/guides/:name`; GuideContentValidator |
| `BFF_AUTHENTICATION_FAILED` | 401 | IAP assertion 없음·검증 실패·인증 주체 부재 | 전체 엔드포인트 / PASS 인증 |
| `BFF_ACCESS_DENIED` | 403 | 담당 서비스가 아니거나 관리자 전용 API 접근 거부 | 서비스 접근·관리자 API의 인가 검사 / PreAuthorize |
| `BFF_APPROVAL_REQUEST_NOT_FOUND` | 404 | 필요한 최신 승인 요청 없음 | approval-requests의 approve/reject/cancel, nlb-indices; ApprovalService |
| `BFF_SERVICE_NOT_FOUND` | 404 | 서비스코드가 인프라 카탈로그에 없음 | 권한 관리의 서비스 담당자 조회·추가·제거, 서비스 권한 신청 |
| `BFF_USER_NOT_FOUND` | 404 | 대상 사용자가 미등록 | `POST /admin/access/admins/remove`; AdminAuthorizationService |
| `BFF_PERMISSION_REQUEST_NOT_FOUND` | 404 | 승인·반려할 권한 신청 없음 | `POST /admin/access/requests/:requestId/{approve,reject}`; PermissionRequestService |
| `BFF_TARGET_SOURCE_ALREADY_EXISTS` | 409 | 생성 대상이 기존 Target Source와 충돌 | `POST /target-sources/services/:serviceCode/target-sources`; TargetSourceManagementService |
| `BFF_TARGET_SOURCE_CLOUD_PROVIDER_MISMATCH` | 400 | 실제 provider와 호출한 provider 전용 엔드포인트 불일치 | `POST, DELETE /target-sources/:targetSourceId/{aws,azure,gcp,idc}-resources`; ConfirmedResourceService |
| `BFF_UPSTREAM_AUTH_FAILED` | 502 | Backend 401·403에 식별 code 없음. code가 있으면 원본 전달 | Backend 호출 공통 / PASS 로그인 실패와 구분 |
| `BFF_UPSTREAM_UNAVAILABLE` | 502 | Backend 연결 불가·비표준 status | Backend 호출 공통 |
| `BFF_UPSTREAM_TIMEOUT` | 504 | Backend 호출 timeout | Backend 호출 공통 |

### 7.4 Infra A.1 — Approval / Target Source / 공통 입력 (17)

원본 표기: `infra/constants/InfraErrorCode.java`. A.1~A.4는 전달 문서의 편집상 분류이며 Java enum 선언 순서가 아니다. A.1의 관련 API 그룹은 §7.9를 참조한다.

| 코드 | HTTP | 의미·발생 조건 |
| --- | --- | --- |
| `INFRA_APPROVAL_REQUEST_NOT_FOUND` | 404 | Approval 요청 없음 |
| `INFRA_APPROVAL_STATUS_INVALID` | 400 | 현재 상태에서 동작 불가 |
| `INFRA_APPROVAL_REQUEST_CONFLICT` | 409 | Approval 상태·Pending 충돌 |
| `INFRA_TARGET_SOURCE_NOT_FOUND` | 404 | Target Source 없음 |
| `INFRA_TARGET_SOURCE_ALREADY_EXISTS` | 409 | Target Source 중복 |
| `INFRA_TARGET_SOURCE_CLOUD_PROVIDER_INVALID` | 400 | Cloud provider 입력 오류 |
| `INFRA_SERVICE_NOT_FOUND` | 404 | Service code 대상 없음 |
| `INFRA_REQUEST_INVALID` | 400 | 공통 요청 검증 실패 |
| `INFRA_AGENT_ID_INVALID` | 400 | Agent ID 입력 오류 |
| `INFRA_SERVICE_CODE_INVALID` | 400 | Service code 입력 오류 |
| `INFRA_DATABASE_TYPE_INVALID` | 400 | Database type 입력 오류 |
| `INFRA_DATA_INVALID` | 400 | 데이터 유효성 오류 |
| `INFRA_RESOURCE_NOT_FOUND` | 404 | 일반 리소스 없음 |
| `INFRA_RESOURCE_ALREADY_EXISTS` | 409 | 일반 리소스 중복 |
| `INFRA_RESOURCE_ID_MISMATCH` | 400 | Resource ID 불일치 |
| `INFRA_CREDENTIAL_NOT_FOUND` | 400 | credential·secret 없음. NOT_FOUND 이름이지만 404가 아님 |
| `INFRA_OPERATION_NOT_SUPPORTED` | 501 | 지원하지 않는 동작 |

### 7.5 Infra A.2 — Scan / Test Connection (10)

원본·확인 상태는 §7.1·7.4와 같다. 관련 API 그룹은 §7.9를 참조한다.

| 코드 | HTTP | 의미·발생 조건 |
| --- | --- | --- |
| `INFRA_SCAN_DATA_OLD_VERSION` | 400 | 미지원 이전 Scan 데이터 |
| `INFRA_SCAN_IN_PROGRESS` | 409 | Scan 실행 중 |
| `INFRA_SCAN_FAILED` | 403 | Scan 실패·수행 불가. PASS 인증 실패가 아님 |
| `INFRA_SCAN_NOT_EXECUTED` | 404 | 실행된 Scan 없음 |
| `INFRA_TEST_CONNECTION_IN_PROGRESS` | 409 | Test Connection 실행 중 |
| `INFRA_TEST_CONNECTION_NO_SUCCESS` | 404 | 성공한 Test Connection 없음 |
| `INFRA_CLUSTER_CREATION_IN_PROGRESS` | 409 | Cluster 생성 진행 중 |
| `INFRA_CONFIRMED_INFRA_NOT_FOUND` | 404 | 확정 Infra 정보 없음 |
| `INFRA_INTEGRATED_RESULT_NOT_FOUND` | 404 | 통합 결과 없음 |
| `INFRA_DATA_INCONSISTENCY` | 500 | 저장 데이터 불일치 |

### 7.6 Infra A.3 — AWS / Azure / GCP / Kubernetes (22)

원본·확인 상태는 §7.1·7.4와 같다. 관련 API 그룹은 §7.9를 참조한다.

| 코드 | HTTP | 의미·발생 조건 |
| --- | --- | --- |
| `INFRA_AWS_TARGET_NOT_INITIALIZED` | 425 | AWS Target 초기화 전 |
| `INFRA_AWS_TARGET_UNAVAILABLE` | 503 | AWS Target 이용 불가 |
| `INFRA_AWS_TARGET_UNHEALTHY` | 502 | AWS Target 비정상 |
| `INFRA_AWS_ROLE_NOT_FOUND` | 404 | AWS Role 없음 |
| `INFRA_AWS_AUTH_FAILED` | 403 | AWS 인증 실패. PASS 인증 실패가 아님 |
| `INFRA_AWS_ASSUME_ROLE_FAILED` | 500 | AWS AssumeRole 실패 |
| `INFRA_AWS_API_FAILED` | 500 | AWS API 실패 |
| `INFRA_AWS_SDK_CLIENT_UNAVAILABLE` | 503 | AWS SDK Client 연결 불가 |
| `INFRA_ATHENA_QUERY_FAILED` | 500 | Athena Query 실패 |
| `INFRA_BDC_ROLE_AUTH_FAILED` | 500 | BDC Role 인증 실패 |
| `INFRA_AZURE_HEALTH_CHECK_FAILED` | 502 | Azure Health Check 실패 |
| `INFRA_AZURE_VM_SUBNET_NOT_FOUND` | 400 | Azure VM 유효 Subnet 없음 |
| `INFRA_GCP_IO_API_FAILED` | 500 | GCP I/O API 실패 |
| `INFRA_GCP_OAUTH_FAILED` | 409 | GCP OAuth 실패 |
| `INFRA_GCP_PROJECT_ID_NOT_FOUND` | 404 | GCP Project ID 없음 |
| `INFRA_GCP_REGIONAL_SUBNET_NOT_FOUND` | 400 | GCP Region Subnet 없음 |
| `INFRA_GCP_VPC_SERVICE_CONTROLS_VIOLATION` | 403 | VPC Service Controls 차단. PASS 인가 거부와 구분 |
| `INFRA_GCP_PSC_NOT_APPROVED` | 400 | PSC 연결 미승인 |
| `INFRA_GCP_RECOMMENDATION_HAS_ERROR` | 400 | GCP 추천 결과 오류 |
| `INFRA_GCP_TERRAFORM_RECHECK_REQUIRED` | 404 | GCP Terraform 재확인 필요 |
| `INFRA_KUBERNETES_SPECIFICATION_INVALID` | 500 | Kubernetes Spec 오류 |
| `INFRA_KUBERNETES_API_FAILED` | 500 | Kubernetes API 실패 |

### 7.7 Infra A.4 — Terraform / Recommendation / 기타 (18)

원본·확인 상태는 §7.1·7.4와 같다. 관련 API 그룹은 §7.9를 참조한다.

| 코드 | HTTP | 의미·발생 조건 |
| --- | --- | --- |
| `INFRA_TERRAFORM_SCRIPT_NOT_FOUND` | 404 | Terraform Script 없음 |
| `INFRA_TERRAFORM_TYPE_MISMATCH` | 422 | Terraform type 불일치 |
| `INFRA_TERRAFORM_WORKER_IN_PROGRESS` | 503 | Terraform Worker 작업 중 |
| `INFRA_TERRAFORM_DEPENDENCY_IN_PROGRESS` | 409 | 선행 Terraform 진행 중 |
| `INFRA_CIDR_SPACE_UNAVAILABLE` | 409 | CIDR 공간 없음 |
| `INFRA_CIDR_RECOMMENDATION_FAILED` | 409 | CIDR 추천 실패 |
| `INFRA_NLB_INDEX_NOT_ASSIGNED` | 400 | NLB index 미할당 |
| `INFRA_NLB_INDEX_NOT_FOUND` | 400 | NLB table에 index 없음 |
| `INFRA_GCS_URI_INVALID` | 400 | GCS URI 오류 |
| `INFRA_PHASE_INVALID` | 400 | Phase 입력 오류 |
| `INFRA_JSON_PARSING_FAILED` | 400 | JSON 파싱 실패 |
| `INFRA_DATABASE_HOST_INVALID` | 400 | Database host 오류 |
| `INFRA_UTILITY_CLASS_INSTANTIATION_INVALID` | 400 | Utility class 잘못된 생성 |
| `INFRA_BUCKET_NOT_FOUND` | 404 | Bucket 없음 |
| `INFRA_CLOUD_FUNCTION_FAILED` | 409 | Cloud Function 실패 |
| `INFRA_CSS_LOADING_FAILED` | 500 | CSS 로딩 실패 |
| `INFRA_UPDATE_FAILED` | 500 | 리소스 갱신 실패 |
| `INFRA_AGENT_ID_ALREADY_EXISTS` | 409 | Agent ID 중복 |

### 7.8 BFF 공통 입력 검증의 자체 발생 지점

모두 `BFF_REQUEST_INVALID(400)`의 전달본 조건이며, 아래는 전체 엔드포인트 목록이 아니다. 경로는 `/install/v1` 기준이다. §7.3의 특수 code와 인증·인가·upstream 공통 규칙이 함께 적용될 수 있다.

| 작업 | 검증 조건·발생 지점 |
| --- | --- |
| `POST /target-sources/services/:serviceCode/creation-candidates` | 생성 후보 요청 / TargetSourceCreationCandidateUtils |
| `PUT /admin/guides/:name` | Guide 입력 구조 / GuideContentRequest |
| `GET /target-sources/:targetSourceId/process-status` | ID / ProcessStatusController, ProcessStatusService |
| `GET /target-sources/:targetSourceId/resources` | ID / ResourceRecommendService |
| `GET /target-sources/:targetSourceId/aws/terraform-script/download` | ID / AwsTerraformScriptService |
| `GET /infra/target-sources/:targetSourceId/azure-private-link-health-check` | ID / AzureHealthCheckService |
| `GET /target-sources/:targetSourceId/{aws,idc,azure,gcp}-resources/approved-recommendations` | ID / provider별 ApprovedRecommendationService |
| `POST, DELETE /target-sources/:targetSourceId/{aws,azure,gcp,idc}-resources` | ID / provider별 ConfirmedResourceService |
| `GET /process-statuses` | page·size / ProcessStatusQueryService |
| `GET /process-status-history` | targetSourceId 필수, page·size / ProcessStatusQueryController, ProcessStatusQueryService |
| `POST /admin/access/services/:serviceCode/owners{,/remove}`, `POST /admin/access/admins` | 미지원 이메일 도메인 / AdminAuthorizationService |
| `POST /services/:serviceCode/access-requests` | 이미 담당자인 사용자 / PermissionRequestService |
| `POST /admin/access/requests/:requestId/{approve,reject}` | 이미 처리된 요청 / PermissionRequestService |
| `POST /admin/access/admins/remove` | 마지막 관리자 해제 불가 / AdminAuthorizationService |

### 7.9 Backend와 API 그룹의 관계

아래 그룹은 전달 문서의 분류다. 개별 code가 그룹 안의 모든 엔드포인트에서 반드시 발생한다는 뜻은 아니다. BFF 자체 code에 해당 Backend code가 더해지고, 복합 조회는 여러 그룹의 code가 올 수 있다.

| API 그룹 | Backend | 계약 범위 |
| --- | --- | --- |
| Approval, Target Source, Resource, Excluded Database, IDC previous-request | Infra Manager | A.1 |
| Secret (`GET …/secrets`) | Infra Manager | A.1, 주로 credential 부재(400) |
| Scan, Test Connection, Confirmed Integration, Tested Logical Database | Infra Manager | A.2 |
| AWS·Azure·GCP 검증, installation-status, Terraform Script | Infra Manager | A.3 |
| NLB table·resources, Terraform·CIDR·추천 | Infra Manager | A.4 |
| `GET /install/v1/user/services/page` | Infra Manager | A.1 |
| process-status 등 도메인 조합 조회 | Infra Manager | A.1 + A.2 가능 |
| Pipeline, Task Definition | Infra Install Worker | Orchestration 목록 미제공; prefix로 known 판정 금지 |
| Jira Ticket | Jira Manager | §7.10, 미제공 code는 unknown |
| Guide | BFF 자체 GuideContentRepository | BFF 자체 code만 |
| 권한 관리, user/me, authorized-users, users/search | BFF 자체 인증 컨텍스트·privacy_auth | Backend code 없음. BFF 자체 인증·인가·검증 및 해당 특수 code 적용 |

### 7.10 Jira 전달분 (2 / 원본 표기 8)

원본 표기: `jira/constant/JiraErrorCode.java`. Jira Manager의 HTTP status와 code는 PASS가 변경 없이 전달한다. 미제공 6개 code는 추정하지 않는다.

| 코드 | HTTP | 의미·발생 조건 |
| --- | --- | --- |
| `JIRA_TICKET_NOT_FOUND` | 404 | Target Source에 연결된 Jira ticket 또는 Jira issue 없음 |
| `JIRA_USER_NOT_FOUND` | 404 | Jira user 없음 |

### 7.11 확인 대기·후속 변경

| 항목 | 현재 상태 | 처리 시점 |
| --- | --- | --- |
| BFF enum 개수 12 vs 표 13 | 표의 13개 등록, 원본 미확인 | BFF 원본·릴리스 대조 |
| 원본 문서 URL·커밋·배포 환경 | 미제공 | 실제 배포 계약 확인 전 |
| Jira 나머지 6개·Orchestration 목록 | 미제공 | 수신 후 독립 계약 추가 |
| 오류 envelope, code 없음/null/빈 값의 실제 예시 | 기존 형식 기록만 존재 | Phase 2 구현 전 대조 |
| unknown 401/403 fallback 해석 | code 우선, unknown은 실제 HTTP fallback 제안 | Phase 2 사용자 검토 |
| 중복 생성의 기존 targetSourceId·필드 오류 정보 | 제공 여부 미확인 | Phase 3 CTA 적용 전 |
| 기존 code와 신규 BFF code의 alias·폐기 여부 | 미확인, 레거시 유지 | 근거 확보 후 별도 변경 |

관련 논의: [Phase 1 계약 등록 및 Phase 2 ADR 변경안](../discussions/2026-09-06-error-codes-phase1-registration.md).
