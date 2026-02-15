# ADR-008: Target Source processStatus를 BFF에서 계산/반환

## 상태
승인됨

## 날짜
2026-02-14

## 맥락

기존 방향(Frontend 계산)은 `processStatus`를 안정적으로 유지하기 어렵다.

- Terraform 반영이 서비스 측에서 직접 수행되어 상태 전이 이벤트를 BFF가 완전 추적하기 어렵다.
- 승인 완료 후 확정 반영까지 과도기(반영 중) 상태가 존재한다. 단순 `targets.confirmed` 기준 계산만으로는 단계가 역행될 수 있다.
- processStatus 계산은 Infra Manager 조회가 필요하며, 최소 10초~30초가 소요될 수 있다.

ADR-006에서 정의한 3개 객체(Confirmed / ApprovalRequest / ApprovedIntegration)와 단일 존재 제약을 기준으로,
processStatus는 "target source 상태 스냅샷만으로 계산되는 BFF 읽기 모델"로 확정한다.

## 결정

### D-001: 계산 책임을 BFF로 단일화

- Frontend는 processStatus 계산을 직접 수행하지 않는다.
- BFF가 계산된 processStatus를 반환한다.
- Frontend는 반환된 상태를 렌더링/폴링만 수행한다.

### D-002: 계산 입력은 target source 상태로 제한

계산 입력은 아래 상태 데이터로 고정한다.

- ConfirmedIntegration 존재 여부
- PENDING ApprovalRequest 존재 여부
- ApprovedIntegration 존재 여부
- 마지막 ApprovalResult
- Black Box 지표(`input_reflected`, `service_tf_installed`, `bdc_tf_installed`)

### D-003: processStatus 결정 규칙

단일 target source에 대해 아래 우선순위로 계산한다.

1. `has_pending_approval_request = true` -> `WAITING_APPROVAL`
2. `has_approved_integration = true` -> `WAITING_TARGET_CONFIRMATION` (승인 완료 후 확정 반영 대기/반영 중)
3. `has_confirmed_integration = true` -> `TARGET_CONFIRMED`
4. 그 외 -> `REQUEST_REQUIRED`

### D-004: API 계약

신규 API:

- `GET /target-sources/{targetSourceId}/process-status`
  - 캐시 허용 조회
  - `x-expected-duration: "200ms ~ 2s"`
- `POST /target-sources/{targetSourceId}/check-process-status`
  - 강제 재계산 조회
  - `x-expected-duration: "10s ~ 30s"`

두 API는 **동일한 응답 스키마(`ProcessStatusResponse`)**를 사용한다.

## 결과

- processStatus를 FE 계산/임의 상태전이에 의존하지 않고 서버에서 일관되게 제공할 수 있다.
- 승인 완료 후 반영 중 상태를 안정적으로 표현할 수 있어 단계 역행(1단계 튐) 문제가 줄어든다.
- 느린 계산 경로를 `check-process-status`로 분리해 UX 폴링 정책을 명확히 할 수 있다.

## 관련 ADR

- [ADR-004](./004-process-status-refactoring.md): 폐기됨 (본 ADR로 대체)
- [ADR-006](./006-integration-confirmation-approval-redesign.md): 승인 프로세스/객체 분리 규칙

## 관련 파일

- `docs/swagger/confirm.yaml`
- `docs/adr/004-process-status-refactoring.md`
