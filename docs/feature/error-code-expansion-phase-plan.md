# ErrorCode 계약 확장 및 화면 매핑 단계별 계획

> 상태: Draft — 사용자 검토 전
> 작성일: 2026-09-06
> 대상: 서비스 담당자의 서비스 목록·타겟소스 상세 화면
> 근거: 이 작업 대화에서 전달받은 BFF 오류 처리 문서 6~10장 및 부록 B 발췌
> 코드 확인 기준: `main@1b741099031ce03f44e2143a3e97cb7b860b08cd`
> 진행 상태: Phase 1 계약·타입·테스트 구현 및 검증 완료, 사용자 결과 확인 대기. Phase 2 이후 런타임 연결·화면 매핑 미착수.

## 1. 목표와 진행 원칙

ErrorCode 계약을 먼저 확장하고, 실제 화면의 문구·이동·상태 갱신·재시도 매핑은 단계별로 적용한다. 사용자가 각 단계의 화면을 직접 확인한 뒤 다음 화면 매핑 단계로 진행한다.

- **계약 등록과 UX 적용을 구분한다.** 알려진 code로 등록되었다고 전용 문구나 CTA가 자동 적용되는 것은 아니다.
- Phase 1은 code 목록·타입·계약 검증 준비에 한정한다. 기존 화면 분기와 전송 계층 동작 변경은 Phase 2부터 수행한다.
- 각 Phase는 독립적으로 검증·리뷰 가능한 변경 단위로 만든다. 여러 화면의 매핑을 한 번에 적용하지 않는다.
- Phase 2~5는 구현 전에 매핑 표를 제시하고, 구현 후 재현 가능한 화면과 검증 결과를 제공한다. 해당 단계의 사용자 확인을 기록한 후 다음 단계의 화면 매핑을 시작한다. 이 확인 절차는 사용자의 직접 확인 요청에 따른다.
- 백엔드 상태를 오류 code만으로 확정하지 않는다. 진행 중·충돌 code는 최신 상태를 조회하는 근거로 사용한다.
- 관리자 전용 권한 관리·Guide 편집·Pipeline UI는 이번 화면 매핑 범위에서 제외한다. 해당 code의 계약 등록은 포함한다.
- 새 오류 전용 관리 화면이나 범용 규칙 엔진은 만들지 않는다. 기존 오류 계층·UI·문서 경로를 확장한다.

## 2. 현재 구현과 선행 과제

| 현재 위치 | 확인한 동작 | 계획에 반영할 사항 |
|---|---|---|
| `app/api/_lib/problem.ts` | 미등록 code를 HTTP 기반 레거시 code로 변환하고 카탈로그 status로 응답 생성 | 원본 code와 실제 HTTP status 보존. 422·425·501~504가 500으로 축약되는 경로 제거 |
| `lib/bff/errors.ts`, `app/api/_lib/problem.ts` | BffError 추출 시 code 부재를 내부 code로 대체 | upstream code 부재와 FE가 만든 fallback을 구분 |
| `lib/errors.ts` | 제한된 AppErrorCode와 rawCode 보유 | 기존 일반 오류 분류와 서버 code의 역할 분리, 검증된 서버 code 판별 함수 추가 |
| `lib/fetch-json.ts` | code 해석 전 401 로그인 이동, 미지정 retriable은 429/5xx에 true | code 우선 판단, 자동 재시도와 수동 실행 정책 분리 |
| `app/target-sources/[targetSourceId]/load-error.ts` | 403을 접근 거부, 404를 타겟소스 없음으로 분류 | SSR에서도 호출 작업과 code를 함께 판단 |
| `app/target-sources/[targetSourceId]/page.tsx` | 대상·process-status를 함께 조회, Jira의 모든 404를 티켓 없음으로 처리 | 대상 부재와 부가 데이터 부재를 분리. Jira user 부재를 티켓 미연결로 단정하지 않음 |
| `app/services/_components/ServiceManagementView.tsx` | 목록 실패는 주로 일반 문구·토스트, 선택 서비스 패널 오류는 문자열 저장 | 실패·빈 목록 구분, 화면별 매핑 시 구조화 오류 유지 |
| `app/hooks/useApiMutation.ts`, `app/components/ui/confirm-failures.ts` | 일반 오류 메시지·code 기준 처리 | 전용 정책은 점진 적용하고 서버 메시지를 사용자 문구로 직접 사용하지 않음 |

[ADR-008](../adr/008-error-handling-strategy.md)의 “401/403은 항상 PASS 인증·인가 오류”, 기본 retriable 규칙은 새 계약과 다르다. [ADR-013](../adr/013-i18n-architecture.md)의 AppErrorCode 확장 제한과도 정합성을 맞춰야 한다. Phase 1에서 변경안을 기록하고 Phase 2 동작 변경과 함께 해당 ADR을 개정한다.

## 3. ErrorCode 확장 범위

### 3.1 전달받은 계약의 범위

| 원본 | 전달된 code 수 | 확장 방침 |
|---|---:|---|
| BFF 자체 code | 표 기준 13개 | 13개 행을 입력 기준으로 등록하되 “enum 12개”와 불일치 확인 필요 |
| Infra A.1 | 17개 | 전체 계약 등록 |
| Infra A.2 | 10개 | 전체 계약 등록 |
| Infra A.3 | 22개 | 전체 계약 등록 |
| Infra A.4 | 18개 | 전체 계약 등록 |
| Jira | 발췌 2개 | `JIRA_TICKET_NOT_FOUND`, `JIRA_USER_NOT_FOUND`만 등록. 원본 8개 중 미제공 6개는 추정하지 않음 |
| Orchestration | 구체 목록 미제공 | `ORCHESTRATION_` prefix만으로 known code로 취급하지 않음. unknown fallback 유지 |
| 합계 | **82개** | 전달된 명시적 항목의 수이며 전체 Backend enum 총수가 아님 |

전체 code·HTTP·의미의 단일 문서는 [기존 카탈로그](../bff-api/catalogs/error-codes.md)로 유지한다. 본 계획은 구현 순서와 주요 매핑 대상만 기록한다. 전체 표는 Phase 1에서 등록했다. code와 HTTP는 필수 1:1 관계가 아니며 현재 전달본의 code별 단일 HTTP를 예상값으로 기록한다. 이 값으로 실제 응답을 덮어쓰지 않는다.

### 3.2 Phase 1에서 기록할 계약 확인 사항

- BFF enum의 실제 개수, 전달 문서의 기준 커밋·배포 버전·적용 환경.
- 누락된 Jira 6개와 Orchestration 목록은 별도 미확인 항목으로 관리. 이 누락만으로 확인된 82개 등록을 막지 않는다.
- code 없음·null·빈 문자열·미등록 문자열 처리와 실제 오류 응답 예시. 실제 HTTP 응답 status를 기준으로 삼고 body의 status 이름으로 덮어쓰지 않는다.
- 문서 6장의 “code가 없을 때 인증 처리”와 “unknown code는 HTTP fallback” 관계. 제안 정책은 §4와 같고, 다른 해석이 확인되면 인증 분기 적용 전에 수정한다.
- 중복 생성 응답에서 기존 targetSourceId를 제공하는지. 필드 오류 정보를 제공하는지. 제공하지 않는 필드를 전제로 UX를 구현하지 않는다.

## 4. 런타임 처리 우선순위 제안

아래는 Phase 2부터 적용할 정책이다. 알려진 code의 의미 확인과 전용 화면 매핑 등록 여부는 별개로 판단한다.

1. **알려진 code 우선:** `BFF_AUTHENTICATION_FAILED`는 PASS 로그인, `BFF_ACCESS_DENIED`는 PASS 권한 안내. 알려진 비즈니스 code는 해당 의미와 작업 맥락으로 처리한다.
2. **code 부재 시 401/403:** 전역 PASS 인증·인가 기본 처리.
3. **전용 처리가 없는 5xx:** 공통 서버·연동 오류 처리. 알려진 “작업 진행 중” code는 1번에서 먼저 처리한다.
4. **unknown/null 및 나머지:** 실제 HTTP status fallback. unknown 401/403도 이 규칙으로 인증·인가 처리하고 미등록 code를 관측한다. prefix 추측으로 예외 처리하지 않는다.

알려진 도메인 403에 아직 전용 UI가 없어도 PASS 권한 없음으로 보내면 안 된다. Phase 2에서 `INFRA_SCAN_FAILED`, `INFRA_AWS_AUTH_FAILED`, `INFRA_GCP_VPC_SERVICE_CONTROLS_VIOLATION`을 최소 도메인 안내로 보호하고 Phase 4에서 구체 CTA를 연결한다. “SCAN_FAILED이므로 권한 문제”처럼 원인을 좁혀 단정하지 않는다.

| HTTP | 기본 안내·동작 | 제약 |
|---|---|---|
| 400 | 입력값·요청 확인 | code만으로 필드 오류 위치를 추정하지 않음 |
| 401 | 로그인 이동 | 알려진 비즈니스 code 판단 이후 적용 |
| 403 | 접근 권한 없음 | 알려진 도메인 403은 이 fallback에서 제외 |
| 404 | 대상 없음 안내, 관련 목록·상태 갱신 | 상세 대상·승인·스캔·티켓 중 무엇이 없는지 호출 맥락으로 구분 |
| 409 | 최신 상태 조회 후 충돌 안내 또는 기존 리소스 이동 | 모든 409를 실행 중으로 해석하지 않음 |
| 422 | 요청 상태·타입 불일치 안내 | 동일 요청 반복 금지 |
| 425 | 초기화 진행 중 안내 | 완료를 단정하지 않음 |
| 500 | 서버 오류 안내 | 자동 재실행을 기본 허용하지 않음 |
| 501 | 지원하지 않는 기능 안내 | 재시도보다 기능 안내 |
| 502 | 연동 서비스 오류 안내 | 자동 재시도 금지 |
| 503 | 일시 이용 불가 안내 | 작업 진행 중인지는 code·상태 조회로 확인 |
| 504 | 처리 결과 확인 지연 안내 | 조회 API만 제한적 자동 재시도 가능 |

기존 429 및 NETWORK·TIMEOUT·ABORTED·PARSE_ERROR 등의 클라이언트 오류는 유지한다. 네트워크 단절이나 timeout도 mutation 재전송의 근거로 삼지 않는다. ABORTED는 사용자 오류로 표시하지 않는다.

## 5. Phase별 실행 계획

| Phase | 우선순위 | 결과 | 사용자 확인 포인트 |
|---|---|---|---|
| 1. 계약·타입 확장 | P0 | 82개 계약 등록과 타입·검증 준비 | 확장 범위·미확인 항목·호환 전략 |
| 2. 전달·공통 판단 | P0 | 원본 code/status 보존, 인증·fallback·재시도 제한 | PASS 인증과 도메인 오류 구분, 공통 문구 |
| 3. 서비스 목록 | P1 | 목록 실패·등록 중복·검증 오류 UX | 실패/0건 구분, 입력·성공 결과 유지 |
| 4. 상세 조회·설정 | P1 | 오류 범위 분리, 설정 조치·미실행·진행 중 안내 | 전체 차단 범위, 섹션별 문구·CTA |
| 5. 승인·상태 충돌·실행 결과 | P1 | 최신 상태 대조와 중복 실행 방지 | 승인·취소·timeout 후 상태와 사용자 입력 |
| 6. 후속 code·운영 유지 | P2 | 누락 계약 보완과 실제 필요 code의 추가 매핑 | 추가할 code·화면 범위별 확인 |

### Phase 1 — ErrorCode 계약·타입 확장

**목적:** 화면 동작을 바꾸기 전에 전달된 code를 정확히 다룰 수 있는 기반을 만든다.

작업:

- 카탈로그에 82개 code, expected HTTP, 출처, 의미, 관련 API 그룹, 확인 상태를 등록한다. 기존 code는 신규 code와의 의미·발생 지점 비교 없이 삭제하거나 자동 alias 처리하지 않는다.
- 신규 `lib/constants/backend-error-codes.ts`에 서버 code와 expected HTTP를 선언하고 `BackendErrorCode` 타입과 type guard를 해당 데이터에서 파생하는 방안을 적용한다. 파일명은 제안이며 동일 책임 모듈이 있으면 재사용한다.
- 기존 `AppErrorCode`에 82개를 무조건 합치지 않는다. 제안 구조는 기존 일반 오류 분류를 유지하면서 원본 서버 code를 보존하고 `BackendErrorCode`로 판별하는 방식이다. 기존 rawCode를 우선 재사용해 중복 필드를 피한다.
- expected HTTP는 계약 검증에만 사용한다. 실제 응답의 HTTP를 카탈로그 값으로 재작성하지 않는다.
- 알려진 계약 code와 전용 UX를 가진 code의 목록을 분리한다. 전용 UX 목록은 이후 Phase에서 필요한 항목만 추가한다.
- ADR-008·013 변경안과 레거시 호환 방침을 기록한다. 런타임 분기·로그인 이동·재시도·화면 CTA는 이 Phase에서 연결하지 않는다.

예상 변경 위치: `docs/bff-api/catalogs/error-codes.md`, 관련 discussion, 신규 계약 상수·타입·테스트. `lib/errors.ts`는 필요한 타입 노출 수준으로 제한한다.

완료 기준:

- [x] 전달된 82개 code가 누락·중복 없이 기록되고 Infra 합계가 67개다.
- [x] `INFRA_CREDENTIAL_NOT_FOUND=400`, 도메인 403 세 개, `INFRA_AWS_TARGET_NOT_INITIALIZED=425`, `INFRA_TERRAFORM_TYPE_MISMATCH=422`를 검증하는 계약 테스트를 추가했다. 실행 결과는 §9에 기록한다.
- [x] unknown/null/빈 code 및 상속 키를 거부하는 판별 함수와 테스트를 추가했다.
- [x] 원본과 다른 개수·미제공 항목을 확인됨으로 표시하지 않는다.
- [x] 기존 실행 경로 미연결과 오류 처리 파일 무변경을 확인했고 회귀 테스트·lint·build를 통과했다.
- [ ] 사용자가 Phase 1 결과를 확인한다.

### Phase 2 — 원본 전달·공통 오류 판단

**목적:** 잘못된 로그인·권한 안내와 code/status 손실을 먼저 해결한다. 이후 모든 화면 매핑의 선행 조건이다.

작업:

- `lib/bff/http.ts` → `BffError` → `app/api/_lib/problem.ts` → `fetchJson` → `AppError` 전체 경로에서 원본 code와 실제 HTTP status를 보존한다. 누락 code를 임의의 upstream code로 바꾸지 않는다.
- 원본 timestamp는 UTC ISO 문자열로 보존하고 표시 시점에만 변환한다. requestId는 제공되는 값을 추적 가능하게 전달한다.
- 정상 JSON, code=null, code 없음, unknown code, 비JSON 오류 응답에서도 실제 status를 유지한다. 응답 body 파싱 실패가 status 500을 새로 만드는 근거가 되지 않게 한다.
- 서버 전용 import가 없는 공통 판단 함수를 두어 SSR의 BffError와 CSR의 AppError가 동일한 정책 입력을 사용하게 한다. 전송 계층에 화면별 이동·상태 갱신을 넣지 않는다.
- §4의 우선순위와 공통 HTTP 안내를 적용한다. SSR 최초 진입과 CSR 요청 모두 code를 읽은 다음 인증 여부를 판단한다.
- `BFF_UPSTREAM_AUTH_FAILED(502)`를 사용자 재로그인으로 보내지 않는다.
- 재시도 소비처를 확인하고 502 자동 재시도 금지·mutation 자동 재전송 금지를 적용한다. retriable=true를 자동 실행 허가로 취급하지 않는다. 이 단계에서 새 자동 재시도 기능은 추가하지 않는다.
- ADR-008·013의 새 정책을 확정·개정하고 사용자 문구는 기존 다국어 체계로 제공한다. code명으로 번역 키를 조합해 누락 문구를 노출하지 않는다.

완료 기준:

- [ ] 동일 응답의 code/status가 SSR·CSR에서 보존되고 같은 분류 결과가 나온다.
- [ ] PASS 401은 로그인, PASS 403은 권한 안내, 알려진 도메인 403은 해당 작업 오류로 구분된다.
- [ ] 422·425·501·502·503·504가 500으로 바뀌지 않는다.
- [ ] unknown/null 401·403 정책과 그 밖의 status fallback을 테스트한다.
- [ ] 502 및 mutation timeout에서 자동 재전송이 발생하지 않는다.
- [ ] 사용자가 공통 오류 재현 화면과 문구를 확인한다.

### Phase 3 — 서비스 목록과 타겟소스 등록

**목적:** 조회 실패와 빈 목록을 구분하고 실패 후에도 등록 작업을 이어갈 수 있게 한다.

| 대상 | Code/상황 | 제안 UX·후속 처리 |
|---|---|---|
| 서비스 목록 조회 | 502·503·504 | 해당 영역에 지속되는 실패 안내. 같은 검색 조건의 기존 결과가 있으면 유지하고 최신 조회 실패 표시 |
| 선택 서비스 | `BFF_ACCESS_DENIED` | 서비스 접근 권한 안내와 기존 권한 신청 경로 |
| 선택 서비스 조회 | `INFRA_SERVICE_NOT_FOUND` | 서비스 없음 안내, 선택 목록 재조회. 발생 API에서 code를 확인할 수 있는 경우에만 적용 |
| 타겟소스 생성 | `BFF_TARGET_SOURCE_ALREADY_EXISTS`, `INFRA_TARGET_SOURCE_ALREADY_EXISTS` | 해당 등록 결과 행에 중복 안내, 식별 가능한 기존 대상 링크 |
| 생성 후보·생성 요청 | `BFF_REQUEST_INVALID`, `INFRA_REQUEST_INVALID` | 입력 유지, 필드 정보가 있는 경우 해당 입력란에 표시. 없으면 폼 단위 안내 |

예상 변경 위치: `app/services/_components/ServiceManagementView.tsx`, 목록 하위 UI, `app/components/features/ProjectCreateModal.tsx`, 관련 API helper·문구·테스트.

확인할 시나리오:

- [ ] 초기 조회 실패가 “담당 서비스 없음” 또는 “등록된 대상 없음”으로 보이지 않는다.
- [ ] 검색·페이지 변경 실패 시 이전 조건의 결과를 현재 조건의 결과로 잘못 표시하지 않는다.
- [ ] 서비스 A→B 전환 중 A의 늦은 오류가 B에 표시되지 않는다.
- [ ] 여러 대상 등록에서 성공·중복·실패 행이 분리되고 성공 건이 재등록되지 않는다.
- [ ] 중복 대상 ID를 모르면 “기존 대상 보기”를 추측해 제공하지 않고 목록 확인을 제공한다.
- [ ] 모달의 입력 내용이 유지되고 실패 토스트와 인라인 안내가 중복되지 않는다.
- [ ] 사용자 화면 확인 후 Phase 4 진입을 기록한다.

### Phase 4 — 타겟소스 상세 조회·설정·진행 안내

**목적:** 오류를 해당 섹션에서 해결하게 하고, 타겟소스 자체의 부재와 부가 데이터 부재를 구분한다.

| 대상 | 우선 매핑 code | 제안 처리 |
|---|---|---|
| 상세 대상 조회 | `INFRA_TARGET_SOURCE_NOT_FOUND` | 대상 없음 안내와 해당 서비스 목록 이동·갱신 |
| 스캔 시작 전 | `INFRA_SCAN_NOT_EXECUTED` | 미실행 상태와 스캔 시작 CTA |
| 스캔 진행 | `INFRA_SCAN_IN_PROGRESS` | 실행 중 안내, 최신 작업 상태 조회, 중복 실행 차단 |
| 스캔 실패 | `INFRA_SCAN_FAILED` | 스캔 실패·수행 불가 안내. 원인 확인과 관련 설정 경로 |
| AWS 설정 | `INFRA_AWS_AUTH_FAILED`, `INFRA_AWS_ROLE_NOT_FOUND` | Role·권한 설정 가이드와 명시적 재검증 |
| GCP 설정 | `INFRA_GCP_VPC_SERVICE_CONTROLS_VIOLATION`, `INFRA_GCP_PSC_NOT_APPROVED` | 보안 정책·PSC 승인 상태에 맞는 가이드 |
| 인증 정보 | `INFRA_CREDENTIAL_NOT_FOUND` | 인증 정보 확인·관리 경로. HTTP 400 유지 |
| 초기화·이용 불가 | `INFRA_AWS_TARGET_NOT_INITIALIZED`, `INFRA_AWS_TARGET_UNAVAILABLE`, `INFRA_AWS_TARGET_UNHEALTHY` | 초기화·일시 이용 불가·연동 오류를 구분 |
| Terraform 확인 | `INFRA_TERRAFORM_SCRIPT_NOT_FOUND`, `INFRA_GCP_TERRAFORM_RECHECK_REQUIRED` | 관련 설치 가이드·확인 경로. 전체 타겟소스 없음 처리 금지 |
| Jira 영역 | `JIRA_TICKET_NOT_FOUND`, `JIRA_USER_NOT_FOUND` | 티켓 미연결과 사용자 조회 문제를 구분, 나머지 화면 유지 |

예상 변경 위치: 상세 `page.tsx`, `load-error.ts`, 공통 오류 UI, provider별 설정·스캔 컴포넌트, GuidePanel 및 문구.

확인할 시나리오:

- [ ] 대상 조회 성공 + process-status 404가 타겟소스 삭제 안내로 바뀌지 않는다.
- [ ] 상태 조회 실패 시 기본 정보는 유지하되 상태가 필요한 변경 작업은 필요한 범위에서 제한한다.
- [ ] Jira 실패가 상세 전체를 막지 않고 Jira user 부재를 티켓 미연결로 표시하지 않는다.
- [ ] 도메인 403은 페이지 접근 권한 신청으로 연결되지 않는다.
- [ ] 초기화·실행 중 안내와 실패 안내가 구분되고 polling 실패 토스트가 반복되지 않는다.
- [ ] API 오류만으로 영구적인 상태 배지나 성공·실패 상태를 새로 확정하지 않는다.
- [ ] 사용자가 provider별 가이드·CTA 도착 지점을 확인한 후 Phase 5 진입을 기록한다.

### Phase 5 — 승인 충돌·연결 테스트·실행 결과 확인

**목적:** 중복 제출과 잘못된 상태 전환을 막고, timeout 후 실제 처리 결과를 확인하게 한다.

| 대상 | 우선 매핑 code/상황 | 제안 처리 |
|---|---|---|
| 승인 요청 취소 등 | `BFF_APPROVAL_REQUEST_NOT_FOUND`, `INFRA_APPROVAL_REQUEST_NOT_FOUND` | 처리할 요청 없음 안내, 승인 요청·process-status 재조회 |
| 승인 상태 충돌 | `INFRA_APPROVAL_REQUEST_CONFLICT`, `INFRA_APPROVAL_STATUS_INVALID` | 최신 상태 조회 후 충돌 설명. 사용자 선택과 새 상태를 대조 |
| provider 불일치 | `BFF_TARGET_SOURCE_CLOUD_PROVIDER_MISMATCH` | 최신 대상 정보 확인. 사용자 입력 잘못으로 단정하거나 provider를 임의 변경하지 않음 |
| 연결 테스트 | `INFRA_TEST_CONNECTION_IN_PROGRESS`, `INFRA_TEST_CONNECTION_NO_SUCCESS` | 실행 중 확인 또는 설정 확인·테스트 실행 경로 |
| 반영·선행 작업 | `INFRA_CLUSTER_CREATION_IN_PROGRESS`, `INFRA_TERRAFORM_WORKER_IN_PROGRESS`, `INFRA_TERRAFORM_DEPENDENCY_IN_PROGRESS` | 상태 조회로 전환, 동일 작업 재실행 금지 |
| 결과·스냅샷 부재 | `INFRA_CONFIRMED_INFRA_NOT_FOUND`, `INFRA_INTEGRATED_RESULT_NOT_FOUND` | 해당 데이터의 부재로 처리. 정상 초기 상태인지는 호출 맥락·process-status로 확인 |
| 생성·승인·취소 timeout | 504 또는 클라이언트 TIMEOUT/NETWORK | “처리 결과를 확인하지 못했습니다”와 최신 상태 확인. 실패·성공으로 단정하지 않음 |

[ADR-006](../adr/006-integration-confirmation-approval-redesign.md)과 [provider 상태 정책](../cloud-provider-states.md)을 따른다. 스캔 진행, 승인 대기, 반영 중은 서로 다른 상태이며 하나의 “진행 중” 플래그로 합치지 않는다.

재시도 세부안:

- 조회 API 504에만 최대 2회 등 제한적 재시도를 제안한다. 횟수·대기 간격·대상 API를 이 Phase의 사용자 검토 표에서 확정한 뒤 추가한다.
- 502 자동 재시도 금지는 유지한다. 재시도 정책은 명령 재전송과 별도 상태 API 조회를 구분한다.
- 작업 상태 조회 polling은 기존 주기·중단 조건을 우선 재사용한다. 오류가 진행 중이라는 이유만으로 무한 polling을 추가하지 않는다.
- 최신 상태 재조회도 실패하면 입력·기존 상태를 유지하고 “결과 확인 불가”를 표시한다. 원래 mutation은 다시 보내지 않는다.

확인할 시나리오:

- [ ] 다른 사용자가 먼저 처리한 승인 요청의 취소가 성공으로 표시되지 않는다.
- [ ] 승인 대기·반영 중에는 ADR-006의 제출 제한이 유지된다.
- [ ] 사용자 선택을 조용히 덮어쓰지 않고, 없어진 리소스를 재제출하지 않는다.
- [ ] timeout 후 상태 조회로 완료·진행 중·확인 불가를 구분하며 중복 mutation이 없다.
- [ ] 연결 테스트 성공 결과 부재를 “한 번도 실행하지 않음”으로 단정하지 않는다.
- [ ] 사용자가 충돌·timeout 전후 화면과 요청 횟수를 확인한다.

### Phase 6 — 누락 계약 보완 및 운영 기반 추가 매핑

- BFF가 전달한 Jira 잔여 code·Orchestration 목록을 출처·버전과 함께 등록한다.
- Phase 3~5에서 전용 처리하지 않은 Infra code는 HTTP fallback을 유지한다. 전용 CTA가 도움이 되는 실제 사례부터 별도 매핑 변경을 제안한다.
- 관리자 전용 code의 화면 적용은 별도 범위로 계획한다. 본 단계 진입이 관리자 UI 일괄 변경을 의미하지 않는다.
- 기존 관측 경로로 unknown code, known code의 expected HTTP 불일치, fallback 발생 작업을 확인한다. 새 모니터링 제품·대시보드는 이번 범위에 추가하지 않는다.
- 계약 변경 및 폐기 code 사용을 검증하고, 필요 시 BE 산출물 기반 자동 생성으로 전환한다.

완료 기준: 확인된 후속 계약이 반영되고, 추가 UX가 필요한 항목과 fallback을 유지할 항목이 구분된다. 지속 운영 항목에 “모든 code 전용 UX 구현”을 완료 조건으로 두지 않는다.

## 6. ErrorCode 표와 FE 정책의 관리

| 산출물 | 책임·내용 | 갱신 시점 |
|---|---|---|
| BE 원본 enum·Swagger·릴리스 정보 | code·HTTP·발생 조건의 원본. BFF/Backend 담당 | Backend 계약 변경 |
| `docs/bff-api/catalogs/error-codes.md` | 전체 계약의 검토 가능한 사본, 출처·확인 상태·폐기 정보 | Phase 1 및 계약 변경 |
| `lib/constants/backend-error-codes.ts` 제안 | 런타임에서 쓰는 code·expected HTTP와 타입의 단일 정의 | 계약 등록과 같은 변경 |
| `docs/bff-api/discussions/` | 신규·변경·폐기 논의, BE 기준 버전, 관련 PR | 계약 변경 단위 |
| FE 매핑 정책·기존 locale 문구 | code + 작업 → 표시 범위·문구 키·CTA·갱신·재시도 | 사용자 확인을 거친 Phase 2~5 |
| 본 계획 | Phase 상태, 검증 및 사용자 확인 기록 | Phase 완료·범위 변경 |

초기에는 Markdown과 TS의 code·HTTP 집합 일치 검증으로 수동 갱신 누락을 막는다. BE가 안정적인 JSON/YAML 산출물을 제공하면 계약 표·타입 생성으로 전환한다. 자동화 도입 전에도 upstream 원본과 대조한 버전을 기록하며, repo 내부 일치 검사가 BE 최신 계약 검증을 대체하지는 않는다.

전체 엔드포인트를 별도 수기 복제하지 않는다. 최신 목록은 `/install/v3/api-docs`를 참조하고 카탈로그에는 자체 code 발생 지점과 API 그룹, 해당 화면이 실제 호출하는 작업만 기록한다. 기존 [관리 계획](../bff-api/management-plan.md)의 endpoint 단위 역참조 요구와 충돌하는 부분은 Phase 1 문서 정비에서 함께 조정한다.

화면 매핑 표의 필수 항목:

| 항목 | 예시 |
|---|---|
| 화면·작업 | 타겟소스 상세 / 스캔 시작 |
| code·HTTP | `INFRA_SCAN_IN_PROGRESS` / 409 |
| 표시 위치·문구 | 스캔 영역 / “스캔이 이미 진행 중입니다” |
| CTA·수행 작업 | 진행 상태 확인 / 조회 API 호출 |
| 유지할 상태 | 기존 스캔 결과·사용자 선택 |
| 갱신할 상태 | 현재 스캔 작업 상태 |
| 자동·수동 재시도 | 시작 명령 자동 재전송 없음 |
| 미확인 조건·fallback | 진행 상태 조회도 실패하면 결과 확인 불가 안내 |
| 재현·확인 기록 | mock 응답, 로컬 URL, 기대 결과, 사용자 피드백 |

## 7. 검증과 사용자 확인 방식

각 Phase는 정상 응답, 대상 오류, unknown/null, 연속 오류 후 정상 회복을 함께 검증한다. 응답 fixture는 body의 code뿐 아니라 실제 HTTP status를 포함한다. 오류를 프론트에서만 임의 발생시키는 테스트 외에 HTTP adapter → Next route → AppError 경로를 검증해 중간 변환 손실을 확인한다.

- Phase 1~2: 카탈로그·type guard·오류 추출·정규화·인증 우선순위·원본 status 보존 테스트. 계약·shared lib 변경이므로 `npm run test:run`, `npm run lint`, 빌드 영향에 따라 `npm run build` 실행.
- Phase 3~5: 관련 컴포넌트·사용자 행동 회귀 테스트와 `npm run test:changed`, `npm run lint`, 빌드 영향에 따라 `npm run build` 실행. shared lib·mock·계약 변경 시 `npm run test:run`으로 전환.
- 사용자 검토 자료: 접근 가능한 로컬 화면 URL, code/HTTP/발생 작업, 재현 순서, 변경 전후 안내·CTA, 실제 재요청·상태 조회 횟수, 테스트 결과.
- 확인 자료를 준비한 뒤 사용자 피드백을 받는다. 시간 경과나 답변 부재를 해당 단계 확인으로 기록하지 않는다.
- 이 계획 문서만 작성하는 현재 변경은 Markdown 링크·표·변경 범위·`git diff --check`를 검증한다. 앱 테스트·lint·build 실행은 런타임 구현 단계의 검증 항목이다.

## 8. 진행 기록

| Phase | 구현 상태 | 검증 자료·PR | 사용자 확인·후속 조치 |
|---|---|---|---|
| 계획 문서 | 작성 완료 | 이 문서 | 검토 대기 |
| 1 | 구현·검증 완료 | §9 | Phase 1 실행 승인됨. 결과 확인은 대기 |
| 2 | 미착수 | — | 공통 오류 화면 확인 예정 |
| 3 | 미착수 | — | 서비스 목록·등록 확인 예정 |
| 4 | 미착수 | — | 상세 조회·설정 확인 예정 |
| 5 | 미착수 | — | 승인·연결 테스트·timeout 확인 예정 |
| 6 | 미착수 | — | 후속 계약 수신 및 필요성에 따라 범위 확정 |

## 9. Phase 1 구현 기록 (2026-09-06)

- [계약 목록·타입·판별 함수](../../lib/constants/backend-error-codes.ts): 82개, 원본 기준 expected HTTP, 기존 AppErrorCode와 독립. 실제 응답 생성·변환에 사용하지 않는다.
- [계약 테스트](../../lib/constants/__tests__/backend-error-codes.test.ts): 전체 개수·문서와 code/HTTP 집합 일치·중복·중요 status·unknown 입력·타입 좁히기·기존 allowlist 분리 검증.
- [카탈로그](../bff-api/catalogs/error-codes.md): 출처·그룹·자체 발생 지점·미확인 항목·레거시 호환 기록.
- [ADR 후속 변경안](../bff-api/discussions/2026-09-06-error-codes-phase1-registration.md): Phase 2를 위한 제안만 작성. 현행 ADR과 런타임 정책은 변경하지 않았다.
- 검증 결과: `npm run test:run` — 393개 파일 / 4,191개 테스트 통과(신규 계약 테스트 38개 포함), `npm run lint` — 오류 0 / 기존 파일 경고 48, `npm run build` — 통과. 문서 상대 링크·공백·`git diff --check` 검증 완료.
- 영향 확인: 신규 상수·판별 함수의 소비처는 계약 테스트뿐이다. `lib/errors.ts`, `lib/fetch-json.ts`, `app/api/_lib/problem.ts`, `lib/bff/errors.ts`, `lib/bff/http.ts`, `app/hooks/useApiMutation.ts`, 의존성 lockfile은 변경하지 않았다.
- Phase 2는 시작하지 않았다. 로그인·권한 판단·오류 변환·자동 재시도·화면 문구와 CTA는 기존 동작을 유지한다.
