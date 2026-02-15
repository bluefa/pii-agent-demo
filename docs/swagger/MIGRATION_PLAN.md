# Swagger Migration Plan (Phase Draft)

## 1. 목표

Issue #122의 Swagger를 기준으로 API Contract를 `target source` 용어 체계로 통합하고, 이후 세션에서 실제 API migration을 수행할 수 있도록 단계/리스크/논의 항목을 고정합니다.

## 2. 이번 세션에서 확정된 기준

- Base Path: `/api/v1`
- 용어: `project -> target-source`, `projectId -> targetSourceId`
- 식별자 타입: `targetSourceId`는 `integer`
- 서비스 식별자 명칭: `serviceCode` (단, GCP settings는 target source 기준으로 관리)
- 1차 범위: `AWS / Azure / GCP / Scan / User / Confirm / Credential`
- 단, Confirm 계열 API migration은 UI/UX Flow 확정 이후 최종 단계(가장 마지막)에 수행
- GCP settings의 `scanServiceAccount`, `terraformExecutionServiceAccount`는 nullable 허용 없이 필수값으로 관리
- 후속 범위: `IDC / SDU` 스펙은 다음 단계에서 별도 정의

## 3. 반영 완료 항목

Issue #122 Swagger를 아래 파일로 분리 반영 완료:

- `docs/swagger/scan.yaml`
- `docs/swagger/user.yaml`
- `docs/swagger/credential.yaml`
- `docs/swagger/confirm.yaml`
- `docs/swagger/aws.yaml`
- `docs/swagger/azure.yaml`
- `docs/swagger/gcp.yaml`

## 4. Migration 단계 제안

### Phase 0: Contract Freeze

목표: YAML 계약 확정

- `gcp.yaml` settings 경로를 `/gcp/target-sources/{targetSourceId}/settings`로 정정
- 에러 응답 공통 포맷 통일 (`{ code, message }` vs `{ error: { code, message } }`)
- Azure/GCP 보조 API 폐기/통합 여부 확정
- completion 계열 API의 용어/경로 확정 (`completion/installation`)
- `serviceId` 필드명 사용 구간은 `oracleServiceId`로 정리 (AWS EC2 / Azure VM / IDC 공통 범위)

산출물:

- 확정된 Swagger YAML
- 변경 이력(왜 변경했는지)

### Phase 1: Backward-Compatible API Bridge (Non-Confirm) ✅ 완료

목표: 기존 프론트 동작 유지 + 신규 경로 병행

- `/api/v1/target-sources/**` 신규 라우트 추가 (Confirm 제외)
- 기존 `/api/**` 또는 `/api/v2/**` 경로는 deprecated로 유지
- 내부적으로 동일 handler/service를 공유해 응답 정합성 확보

**구현 완료 (PR #140):**

공통 인프라 (`app/api/_lib/`):

| 파일 | 역할 |
|------|------|
| `problem.ts` | `application/problem+json` (RFC 9457) 에러 응답 — 10개 에러 코드 카탈로그 |
| `request-id.ts` | `x-request-id` 헤더 추출/생성 |
| `target-source.ts` | `targetSourceId`(number) 파싱, projectId/project 조회 |
| `handler.ts` | `withV1` 래퍼 — 에러 변환, 헤더 주입, uncaught catch |
| `v1-types.ts` | Swagger 기반 request/response TypeScript 타입 |

v1 라우트 (19개):

| 카테고리 | 엔드포인트 | Method |
|----------|-----------|--------|
| User | `/api/v1/user/me` | GET |
| User | `/api/v1/user/services` | GET |
| User | `/api/v1/users/search` | GET |
| Scan | `/api/v1/target-sources/{targetSourceId}/scan` | POST |
| Scan | `/api/v1/target-sources/{targetSourceId}/scanJob/latest` | GET |
| Scan | `/api/v1/target-sources/{targetSourceId}/scan/history` | GET |
| AWS | `/api/v1/aws/target-sources/{targetSourceId}/installation-status` | GET |
| AWS | `/api/v1/aws/target-sources/{targetSourceId}/check-installation` | POST |
| AWS | `/api/v1/aws/target-sources/{targetSourceId}/verify-execution-role` | POST |
| AWS | `/api/v1/aws/target-sources/{targetSourceId}/verify-scan-role` | POST |
| AWS | `/api/v1/aws/target-sources/{targetSourceId}/settings` | GET |
| Azure | `/api/v1/azure/target-sources/{targetSourceId}/installation-status` | GET |
| Azure | `/api/v1/azure/target-sources/{targetSourceId}/check-installation` | POST |
| Azure | `/api/v1/azure/target-sources/{targetSourceId}/vm-terraform-script` | GET |
| Azure | `/api/v1/azure/target-sources/{targetSourceId}/settings` | GET |
| GCP | `/api/v1/gcp/target-sources/{targetSourceId}/installation-status` | GET |
| GCP | `/api/v1/gcp/target-sources/{targetSourceId}/check-installation` | POST |
| GCP | `/api/v1/gcp/target-sources/{targetSourceId}/settings` | GET |
| Credential | `/api/v1/target-sources/{targetSourceId}/secrets` | GET |

Exception 처리 정책:

| 분류 | 처리 |
|------|------|
| Expected (파라미터/리소스/권한) | throw 없이 `problemResponse()` 직접 반환 |
| Uncaught | `withV1` try/catch → `INTERNAL_ERROR` + `console.error` |

에러 코드 카탈로그:

`UNAUTHORIZED`(401), `FORBIDDEN`(403), `TARGET_SOURCE_NOT_FOUND`(404), `SERVICE_NOT_FOUND`(404), `VALIDATION_FAILED`(400), `INVALID_PARAMETER`(400), `INVALID_PROVIDER`(400), `CONFLICT_IN_PROGRESS`(409), `RATE_LIMITED`(429), `INTERNAL_ERROR`(500)

산출물:

- ✅ 신규/구 API 매핑표 (위 테이블)
- ✅ 호환성 테스트 케이스 (14 tests — problem, target-source, handler)

### Phase 2: Frontend Callsite 전환 (Non-Confirm)

목표: 프론트 호출 경로 및 응답 모델을 신규 Contract로 전환

- `app/lib/api/*` 호출 경로를 `/api/v1/target-sources/**` 중심으로 변경
- snake_case/camelCase 차이 정리
- 제거 대상 API 사용 코드 정리

산출물:

- 호출 경로 전환 PR
- 회귀 테스트 결과

### Phase 3: Legacy 제거 (Non-Confirm)

목표: 구 경로/구 응답 제거

- 사용되지 않는 `/api/projects/**`, `/api/v2/projects/**` 정리
- 보조 API 제거 확정 시 라우트/타입/문서 정리
- 최종 운영 문서 업데이트

산출물:

- 삭제 목록
- 최종 API 인벤토리

### Phase 4: Confirm API Migration (Final)

목표: UI/UX Flow 확정 이후 Confirm/Approval 계약을 최종 반영

- `confirm.yaml` 기준 endpoint를 실제 라우트로 이관
- `approval-requests`, `confirmed-integration`, `approved-integration`, `approval-history` 순으로 전환
- VM 설정에서 `db_type=ORACLE`인 경우 `oracleServiceId` 필수 규칙을 요청/확정 응답 모두에 적용
- 완료/확정 관련 endpoint 용어를 `completion/installation` 기준으로 정리

산출물:

- Confirm 전용 API 매핑표 (구 API -> 신규 API)
- UI/UX Flow 확정본과 API 계약 일치 검증 결과

## 5. 논의가 필요한 API (Decision Needed)

### Azure

- `vm-installation-status`, `vm-check-installation`를 유지할지, `installation-status`로 통합할지 결정 필요.
- 통합 시 `installation-status`에 아래 필드가 반드시 포함되어야 현재 UI 대체 가능:
  - `isVm`
  - `vmInstallation.subnetExists`
  - `vmInstallation.loadBalancer`
  - `privateEndpoint`
- `subnet-guide`는 UI 하드코딩 가이드로 대체 가능(삭제 후보).

### Completion / Installation

- 현재 분산된 완료 계열 API
  - `/complete-installation`
  - `/confirm-completion`
  - `/confirm-pii-agent`
- 용어를 `completion/installation`으로 통합할지, 상태 전이별 endpoint를 유지할지 결정 필요.
- 본 영역은 Confirm API migration과 결합되어 있으므로 `Phase 4`에서 최종 반영.

### Confirm / Oracle VM 입력 규칙

- Oracle 입력 필수 규칙은 IDC 전용이 아니라 AWS EC2 / Azure VM / IDC 공통입니다.
- `db_type=ORACLE`일 때 `oracleServiceId` 필수 규칙을 아래 두 영역에 동일 적용해야 합니다.
  - 승인 요청 생성(`approval-requests`)의 `vm_configs`
  - 확정/승인 조회(`confirmed-integration`, `approved-integration`)의 `resource_infos.vm_config`
- Confirm API가 최종 단계로 밀린 만큼, 해당 규칙은 `Phase 0`에서 Swagger 계약 먼저 고정하고 `Phase 4`에서 구현 반영합니다.

### GCP Settings

- 유지 권장: GCP는 Scan/Terraform 권한 검증 전용 API 없이, 설정값 노출형 settings API를 사용.
- 현재 코드 기준 FE callsite는 아직 없음(향후 운영 정보 카드/점검 화면에서 사용 가능).
- settings 응답 필수값(모두 non-nullable):
  - `gcpProjectId`
  - `scanServiceAccount`
  - `terraformExecutionServiceAccount`
- 경로는 `target source` 문맥으로 통일:
  - `/gcp/target-sources/{targetSourceId}/settings`

### 식별자 마이그레이션

- 계약은 `targetSourceId: integer`이나, 현 구현/Mock는 문자열 ID 중심.
- ID 매핑 전략(숫자화 또는 외부-내부 ID 분리) 결정 필요.

## 6. 추가가 필요한 API (Spec Add Required)

- `GET /api/v1/users/search` (현재 구현 존재, Swagger 누락)
- completion/installation 관련 신규 명세 (용어 통합 후 endpoint 확정 필요)
- GCP settings endpoint를 target source 기준으로 운영할 경우, route 신규 추가 필요
- ADR-006 기준으로는 아래도 추가 검토 필요:
  - 승인 요청 취소 endpoint (`cancel-approval-request` 계열)
  - 승인/반려 처리 endpoint를 최종 공개 API에 둘지 여부

## 7. 삭제 확정 / 통합 대상 API

- GCP `service-tf-resources`: 삭제 확정
- GCP `regional-managed-proxy` 자동 생성 경로: 삭제 확정 ("자동 서브넷 생성" 버튼 정책 제거)
- `terraform-status`: Provider별 `installation-status`로 대체하는 방향으로 통합 검토

## 8. ADR-006 반영 점검

### 충분히 반영된 부분

- Confirm/Approved/Request 분리 모델 방향
- `integrationCategory` 기반 리소스 분류
- 승인 결과 enum에 `REJECTED`, `CANCELLED`, `SYSTEM_ERROR`, `COMPLETED` 포함

### 부분 반영 또는 누락된 부분

- 승인 요청 취소 API가 Swagger에 없음
- 승인/반려 admin 처리 API의 최종 노출 전략이 불명확
- Black Box 반영 지표(`input_reflected`, `service_tf_installed`, `bdc_tf_installed`)가 명시적으로 드러나지 않음
- "반영 중 신규 요청 차단" 정책이 API 계약/에러 코드로 명확히 표현되지 않음

## 9. Issue #122 Swagger 보완 필요사항

- `serviceId` 표기 제거:
  - GCP settings path는 `targetSourceId` 기준으로 변경
  - VM Oracle 필드는 `oracleServiceId` 명칭으로 통일 (AWS EC2 / Azure VM / IDC)
- 에러 응답 스키마 통일
- Azure/GCP 보조 API 폐기 시 대체 필드 명세를 installation-status에 명시
- Confirm 계열 API migration은 UI/UX 확정 후 마지막 Phase에서 반영
- 1차 범위 제외된 `IDC/SDU`는 후속 스펙 문서에서 별도 작성

## 10. 다단계 Migration Plan 문서 작성 방식

다단계로 진행될 경우 아래 구조를 권장합니다.

1. 상위 문서: `MIGRATION_PLAN.md`
2. 단계별 상세 문서: `phases/phase-N-*.md`
3. 각 phase 문서 고정 섹션:
   - 범위(In Scope / Out of Scope)
   - 계약 변경 목록(Endpoint / Request / Response / Error)
   - 호환성 전략(병행 경로/토글/롤백)
   - 테스트 체크리스트
   - 완료 기준(Exit Criteria)
   - 오픈 이슈

이 구조를 사용하면 세션 분리 작업에서도 의사결정 추적과 범위 통제가 쉬워집니다.

## 11. 논의 라운드 운영 방식 (권장)

migration 중 다회 논의가 예상되므로, 아래 운영 규칙을 적용합니다.

1. Round 단위로 논의한다.
   - `Round N`마다 "결정됨 / 보류 / 추가 검토"를 구분한다.
2. 결정 사항은 즉시 문서화한다.
   - `MIGRATION_PLAN.md` 본문에 반영하고, 변경 이유를 1~2줄로 남긴다.
3. 보류 이슈는 별도 backlog로 유지한다.
   - phase 문서의 `오픈 이슈` 섹션에 owner와 목표 결정 시점을 기록한다.
4. API 계약 변경은 Freeze 조건을 둔다.
   - 동일 endpoint의 Request/Response 변경은 `Phase 0` 종료 전까지만 허용한다.
5. 재검토 트리거를 명시한다.
   - FE 구현 영향, BE 데이터 모델 영향, ADR 충돌 중 하나라도 발생하면 재논의한다.

### Decision Log 템플릿

각 논의 라운드에서 아래 형식으로 누적 기록하는 것을 권장합니다.

| Round | 항목 | 결정 | 근거 | 영향 범위 | 후속 작업 |
|------|------|------|------|----------|----------|
| R1 | 예: GCP settings path key | `targetSourceId` 기준 경로 사용 | target source 용어 체계 통일 | Swagger, API route | gcp.yaml 수정 |
