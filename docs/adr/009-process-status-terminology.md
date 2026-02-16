# ADR-009: processStatus 용어 체계 확정 및 BFF 계산 모델

## 상태
승인됨

## 날짜
2026-02-16

## 맥락

### Semantic Collision

기존 FE `ProcessStatus` enum에서 `WAITING_TARGET_CONFIRMATION`(값 1)은 **"1단계 — 사용자가 리소스를 아직 선택하지 않은 상태"** 를 의미한다.

ADR-006 D-008에서 "승인 완료 후 확정 반영 대기(반영 중)" 상태가 필요해졌고, PR #146(ADR-008 초안)에서 이 상태의 이름을 동일하게 `WAITING_TARGET_CONFIRMATION`으로 정의했다. 이는 아래 두 가지 문제를 발생시킨다:

1. **같은 이름이 정반대 의미를 가리킴** — "리소스 미선택" vs "인프라 반영 중"
2. **FE enum(숫자)과 BFF enum(문자열)이 이름은 같지만 의미가 다름** — 코드 리뷰/디버깅 시 혼동

### 추가 배경

- ADR-004(FE 계산 모델)는 `targets.confirmed` boolean만으로 판단하므로, 반영 중에 `confirmed`가 일시적으로 false가 되면 UI가 1단계로 역행하는 결함이 있다.
- ADR-006 D-009에서 정의한 calculator 판단 로직(`ApprovedIntegration 존재? → 반영 중`)이 FE enum에 대응하는 값이 없다.

## 결정

### D-001: "반영 중" 상태의 canonical 이름은 `APPLYING_APPROVED`

- `WAITING_TARGET_CONFIRMATION`은 기존 의미("1단계: 연동 대상 확정 대기")를 유지한다.
- "승인 완료 후 확정 반영 중" 상태는 **`APPLYING_APPROVED`** 로 명명한다.
- 기존 FE enum 값과 충돌하지 않으며, 의미가 자명하다: "approved → confirmed 전환 중."

### D-002: BFF TargetSourceProcessStatus enum 확정

BFF가 반환하는 `process_status` 필드의 값은 아래 4개로 고정한다:

| 값 | 의미 | ADR-006 상태 조합 |
|----|------|-------------------|
| `REQUEST_REQUIRED` | 요청 필요 (리소스 미선택 또는 연동 완료 후 변경 전) | X/X/X, O/X/X |
| `WAITING_APPROVAL` | 승인 대기 | X/O/X, O/O/X |
| `APPLYING_APPROVED` | 승인 반영 중 (Black Box) | X/X/O, O/X/O |
| `TARGET_CONFIRMED` | 연동 확정 완료 | O/X/X |

> `REQUEST_REQUIRED`는 확정 정보 존재 여부와 무관하게 "현재 활성 요청/반영이 없는 상태"를 의미한다.
> `TARGET_CONFIRMED`는 확정 정보가 존재하면서 활성 요청/반영이 없는 경우에만 해당한다.
> 구분은 `status_inputs.has_confirmed_integration`으로 가능하다.

**참고**: `REQUEST_REQUIRED`와 `TARGET_CONFIRMED`의 분리 근거 — 확정 정보가 있을 때(`TARGET_CONFIRMED`)는 "현재 연동 정보 보기"가 메인 뷰이고, 없을 때(`REQUEST_REQUIRED`)는 "리소스 선택 → 승인 요청" 플로우가 메인 뷰이다. UI 렌더링 분기가 근본적으로 다르므로 별도 상태로 유지한다.

### D-003: 계산 책임을 BFF로 단일화 (ADR-004 폐기)

- Frontend는 `processStatus` 계산을 직접 수행하지 않는다.
- BFF가 계산된 `process_status`를 반환한다.
- Frontend는 반환된 상태를 렌더링/폴링만 수행한다.
- ADR-004(FE 계산 모델)를 폐기한다.

### D-004: 계산 우선순위

단일 target source에 대해 아래 우선순위로 계산한다:

```
1. has_pending_approval_request = true  → WAITING_APPROVAL
2. has_approved_integration = true      → APPLYING_APPROVED
3. has_confirmed_integration = true     → TARGET_CONFIRMED
4. 그 외                                → REQUEST_REQUIRED
```

### D-005: API 계약

신규 API 2개:

- `GET /target-sources/{targetSourceId}/process-status` — 캐시 허용 조회 (200ms~2s)
- `POST /target-sources/{targetSourceId}/check-process-status` — 강제 재계산 (10s~30s)

두 API는 동일한 응답 스키마(`ProcessStatusResponse`)를 사용한다.

승인 요청 입력 모델은 `input_data.resource_inputs[]`로 통합한다:

- `vm_configs`는 top-level에서 제거한다.
- VM 입력은 `resource_input.vm_config`로 전달한다.
- RDS credential 선택은 `resource_input.credential_id`로 전달한다.
- 리소스별 선택/제외는 `selected` + `exclusion_reason`으로 관리한다.

### D-006: "반영 중 신규 요청 차단" 정책의 API 계약

`POST /approval-requests` 호출 시 아래 조건에서 409를 반환한다:

| 조건 | 에러 코드 | 메시지 |
|------|----------|--------|
| `ApprovedIntegration` 존재 (반영 중) | `CONFLICT_APPLYING_IN_PROGRESS` | 승인된 내용이 반영 중입니다. 완료 후 다시 요청해주세요. |
| `PENDING` ApprovalRequest 존재 | `CONFLICT_REQUEST_PENDING` | 이미 승인 요청이 진행 중입니다. |

## 결과

- `WAITING_TARGET_CONFIRMATION`의 semantic collision이 해소됨.
- "반영 중" 상태가 `APPLYING_APPROVED`로 명확히 구분되어 FE/BE 간 혼동이 제거됨.
- 409 에러 코드로 "반영 중 신규 요청 차단" 정책이 API 계약에 명시됨.
- 승인 요청 입력이 리소스 단위 `resource_input`으로 통합되어 VM/credential 입력 경로가 일관화됨.
- 후속 구현(T2: BFF API, T7: FE 전환)이 이 용어 체계를 기반으로 진행 가능.

## 관련

- [ADR-004](./004-process-status-refactoring.md): 폐기됨 (본 ADR로 대체)
- [ADR-006](./006-integration-confirmation-approval-redesign.md): 승인 프로세스/객체 분리 규칙
- [ADR-008](./008-error-handling-strategy.md): CSR 에러 처리 전략
- `docs/swagger/confirm.yaml`: API 스펙 반영
- `docs/swagger/MIGRATION_PLAN.md`: 매핑 표
