# ErrorCode Phase 1 계약 등록 및 Phase 2 ADR 변경안

> Confluence: TBD — 별도 페이지 미지정
> Confluence Title: [26.09.06] ErrorCode 계약 등록 및 단계별 적용 관련 논의
> 상태: Draft
> 작성일: 2026-09-06
> 마지막 수정일: 2026-09-06
> 대상 Tag: error-codes
> 변경 유형: Added
> 변경 방향: BE-first
> 담당: FE / BFF 담당 확인 대기
> 관련 PR: 미생성

## 1. 배경·근거

사용자가 대화에서 BFF 오류 처리 문서 6~10장·부록 B를 전달하고, 서비스 목록·타겟소스 상세 UX를 단계별로 직접 확인하기를 요청했다. Phase 1 구현은 승인되었으며 범위는 계약 목록·독립 타입·검증이다. 이 문서의 Draft는 upstream 대조 및 Phase 2 동작 변경안의 검토 상태이며, Phase 1 구현 승인 여부와 구분한다.

등록 항목은 BFF 13 + Infra 67 + Jira 전달분 2 = 82개다. BFF 제목의 12개와 표의 13개 불일치, Jira 잔여 6개·Orchestration 미제공, upstream 버전 미확인은 [카탈로그](../catalogs/error-codes.md)에 기록했다. 최신 BE 코드를 직접 조회한 것으로 간주하지 않는다.

## 2. Phase 1 결정·호환성

- [BACKEND_ERROR_CODES](../../../lib/constants/backend-error-codes.ts)는 전달된 code와 expected HTTP를 정의한다. BackendErrorCode는 키에서 파생하고 isBackendErrorCode는 unknown 입력의 정확한 등록 여부만 판단한다.
- HTTP와 code는 필수 1:1 관계가 아니다. 현재 전달본이 code별 HTTP 하나를 명시해 단일 예상값으로 보관한다. 실제 응답 status를 수정하거나 status만으로 code를 역추론하는 용도가 아니다.
- 기존 AppErrorCode·KNOWN_ERROR_CODES·rawCode·BffError·fetchJson·ProblemDetails·화면 코드를 수정하지 않는다. 신규 판별 함수도 기존 실행 경로에 연결하지 않는다.
- 레거시 VALIDATION_FAILED·GUIDE_CONTENT_INVALID 등은 삭제·alias 처리하지 않는다. 발생 조건과 배포 버전이 확인된 뒤 별도 호환 전환을 결정한다.
- 외부 API의 요청·응답 schema, route, Swagger, generated client를 변경하지 않는다. 따라서 Phase 1 검증은 전달본·repo 사본 간 일치이며 실서버 계약 검증이 아니다.
- 전체 엔드포인트 목록 대신 그룹 및 자체 code 발생 지점을 카탈로그에 유지한다. 기존 Tag 가이드의 레거시 참조는 보존한다. 미검증 신규 계약으로 기존 endpoint별 표를 일괄 갱신하지 않는다.

## 3. Phase 2 ADR 변경안 — 아직 적용하지 않음

### ADR-008

현재의 “401/403은 항상 PASS 인증·인가 오류”와 5xx retriable 기본값은 새 계약과 맞지 않는다. 아래 변경안을 Phase 2 리뷰 시 확정하고 [ADR-008](../../adr/008-error-handling-strategy.md)을 함께 개정한다.

1. 원본 code·실제 HTTP status·timestamp·requestId를 정규화 경로 끝까지 보존한다. code 부재와 FE fallback을 구분한다.
2. 알려진 code 의미 → code 부재 시 인증·인가 → 전용 처리 없는 5xx → unknown/null의 실제 HTTP fallback 순으로 처리한다. unknown 401/403은 HTTP fallback을 따르는 안이며 구현 전 확인한다.
3. 알려진 도메인 403을 PASS 권한 거부로 분류하지 않는다. SSR/CSR이 동일한 정책을 사용한다.
4. 502 자동 재시도 금지. mutation timeout은 재전송 대신 결과 조회. 조회 API 504의 제한적 재시도는 대상·횟수·간격을 별도 확정한다.

### ADR-013

[ADR-013 D2](../../adr/013-i18n-architecture.md)의 AppErrorCode 확장 제한은 Phase 1에서 유지한다. Phase 2에도 기존 일반 분류를 유지하면서 rawCode를 서버 code 판별에 활용하는 안을 우선한다. 원본 code 전달 보장은 Phase 2 작업이다.

사용자 문구는 FE의 다국어 정책으로 관리하고 서버 message/detail은 진단용으로 유지한다. 계약 등록과 번역·전용 UI 등록을 분리하고, 모든 code에 번역 키가 있다고 가정하지 않는다. ADR 개정안은 이 논의 문서에만 기록했으며 현행 ADR의 승인된 정책을 미리 변경하지 않았다.

## 4. 계약·운영 문서 정합성

[관리 계획 §4.4.6](../management-plan.md#446-전달-계약-일괄-등록-phase-1)은 Phase 1 계약 사본과 기존 운영 UX 표의 역할을 구분한다. 신규 사본에는 code·HTTP·의미와 공통 출처·확인 상태·관련 API 그룹을 기록하며, endpoint별 동작 확인 전에는 전용 UX·재시도 정책을 채웠다고 주장하지 않는다.

문서와 TS의 전체 집합·status 일치, 82개 수량, 중요한 비표준 status, null·unknown·상속 키 거부, 기존 UI allowlist와의 분리를 테스트한다. upstream 원본 대조는 수신된 문서/버전이 확보되면 추가한다.

## 5. 후속 작업

- Phase 1 검증 결과와 사용자 확인은 [진행 계획](../../feature/error-code-expansion-phase-plan.md)에 기록한다.
- BFF에 확인할 질문과 누락 목록은 카탈로그 §7.11을 참조한다. 이 작업에서 외부 메시지를 보내지는 않는다.
- Phase 2 시작 시 공통 오류 재현 시나리오·문구를 제시하고 사용자 확인을 거쳐 적용한다.
- Phase 3~5의 화면 매핑은 별도 변경으로 진행한다.
