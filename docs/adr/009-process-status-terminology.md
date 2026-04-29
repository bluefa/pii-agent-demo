# ADR-009: processStatus 용어 체계 확정 및 BFF 계산 모델

## 상태
승인됨 · 2026-04-30 현재 BFF 계약 기준으로 갱신

## 날짜
2026-02-16

## 맥락

### Semantic Collision

기존 FE `ProcessStatus` enum에서 `WAITING_TARGET_CONFIRMATION`(값 1)은 **"1단계 — 사용자가 리소스를 아직 선택하지 않은 상태"** 를 의미한다.

ADR-006 D-008에서 "승인 완료 후 확정 반영 대기(반영 중)" 상태가 필요해졌고, PR #146(ADR-008 초안)에서 이 상태의 이름을 동일하게 `WAITING_TARGET_CONFIRMATION`으로 정의했다. 이는 아래 두 가지 문제를 발생시킨다:

1. **같은 이름이 정반대 의미를 가리킴** — "리소스 미선택" vs "인프라 반영 중"
2. **FE enum(숫자)과 BFF enum(문자열)이 이름은 같지만 의미가 다름** — 코드 리뷰/디버깅 시 혼동

### 현재 구현과의 정렬

초기 ADR-009는 승인 객체 존재 여부만으로 계산하는 4-state 모델(`REQUEST_REQUIRED`, `WAITING_APPROVAL`, `APPLYING_APPROVED`, `TARGET_CONFIRMED`)을 정의했다. 이후 실제 BFF 계약은 target source의 coarse lifecycle을 함께 표현하는 7-state 모델로 정착했다.

따라서 이 ADR은 현재 코드의 BFF 계약을 정본으로 삼아 갱신한다:

- `lib/approval-bff.ts`의 `BffApprovalProcessStatus`
- `app/lib/api/index.ts`의 `BffProcessStatus`
- `app/integration/api/v1/target-sources/[targetSourceId]/process-status/route.ts`의 `ProcessStatus` → BFF status 매핑

4-state 이름은 과거/호환 입력으로만 남긴다. 신규 코드와 문서는 7-state BFF status를 사용한다.

## 결정

### D-001: FE "반영 중" 상태의 canonical 이름은 `APPLYING_APPROVED`

- FE `ProcessStatus.WAITING_TARGET_CONFIRMATION`은 기존 의미("1단계: 연동 대상 확정 대기")를 유지한다.
- FE에서 "승인 완료 후 확정 반영 중" 상태는 **`APPLYING_APPROVED`** 로 명명한다.
- BFF wire status에서는 동일 단계를 **`CONFIRMING`** 으로 표현한다.
- 두 이름은 레이어가 다르다:
  - FE enum: 화면 단계와 StepProgressBar 중심
  - BFF `process_status`: target source lifecycle 문자열 계약

### D-002: BFF `process_status` enum 확정

BFF가 반환하는 `process_status` 필드의 정본 값은 아래 7개다:

| BFF 값 | FE `ProcessStatus` 매핑 | 의미 |
|----|----|----|
| `IDLE` | `WAITING_TARGET_CONFIRMATION` | 승인 요청/반영/설치가 진행 중이 아니며 사용자의 연동 대상 확정이 필요한 상태 |
| `PENDING` | `WAITING_APPROVAL` | 승인 요청이 생성되어 관리자 승인/반려를 기다리는 상태 |
| `CONFIRMING` | `APPLYING_APPROVED` | 승인된 요청이 target source 확정 정보로 반영 중인 상태 |
| `CONFIRMED` | `INSTALLING` | 연동 대상이 확정되어 PII Agent 설치 단계에 진입한 상태 |
| `INSTALLED` | `WAITING_CONNECTION_TEST` | 설치가 완료되어 연결 테스트가 필요한 상태 |
| `CONNECTED` | `CONNECTION_VERIFIED` | 연결 테스트가 성공했고 운영/관리자 확인이 필요한 상태 |
| `COMPLETED` | `INSTALLATION_COMPLETE` | 연동 프로세스가 완료된 상태 |

`healthy`는 `UNKNOWN | HEALTHY | UNHEALTHY | DEGRADED` 중 하나이며, `evaluated_at`은 UTC ISO-8601 문자열이다.

### D-003: 계산 책임은 BFF/route 계층에 둔다

- Frontend 컴포넌트는 승인 객체 조합으로 현재 단계를 직접 계산하지 않는다.
- BFF 또는 Next route가 `process_status`를 반환하고, CSR helper는 이를 typed DTO로 정규화한다.
- UI는 `process_status`를 FE `ProcessStatus`와 비교/매핑해 렌더링과 polling을 수행한다.
- 상세 설치 진행률과 provider별 세부 상태는 여전히 provider별 `installation-status` API가 담당한다.

### D-004: 호환 입력 매핑

과거 4-state 값은 신규 계약이 아니지만, mock/legacy upstream 응답을 깨지 않기 위해 정규화 레이어가 아래처럼 받아들인다:

| Legacy 입력 | 현재 BFF 값 |
|----|----|
| `REQUEST_REQUIRED` | `IDLE` |
| `WAITING_APPROVAL` | `PENDING` |
| `APPLYING_APPROVED` | `CONFIRMING` |
| `TARGET_CONFIRMED` | `CONFIRMED` |

이 매핑은 backward compatibility 용도다. 신규 route, mock, API 문서는 7-state 값을 기준으로 작성한다.

### D-005: API 계약

API:

- Upstream BFF: `GET /target-sources/{targetSourceId}/process-status`
- Next internal route: `GET /integration/api/v1/target-sources/{targetSourceId}/process-status`

응답:

```typescript
interface ProcessStatusResponse {
  target_source_id: number;
  process_status:
    | 'IDLE'
    | 'PENDING'
    | 'CONFIRMING'
    | 'CONFIRMED'
    | 'INSTALLED'
    | 'CONNECTED'
    | 'COMPLETED';
  healthy: 'UNKNOWN' | 'HEALTHY' | 'UNHEALTHY' | 'DEGRADED';
  evaluated_at: string;
}
```

현재 Next route는 `bff.confirm.getProcessStatus()` 응답을 정규화한 뒤, 가능한 경우 `bff.targetSources.get()`의 `processStatus`를 보조 조회해 화면 단계와 동일한 lifecycle status로 보정한다. target source 조회가 실패하면 `process-status` 원 응답을 그대로 사용한다.

### D-006: "반영 중 신규 요청 차단" 정책의 API 계약

`POST /approval-requests` 호출 시 아래 조건에서 409를 반환한다:

| 조건 | 에러 코드 | 메시지 |
|------|----------|--------|
| `ApprovedIntegration` 존재 또는 BFF가 반영 중으로 판단 | `CONFLICT_APPLYING_IN_PROGRESS` | 승인된 내용이 반영 중입니다. 완료 후 다시 요청해주세요. |
| `PENDING` ApprovalRequest 존재 | `CONFLICT_REQUEST_PENDING` | 이미 승인 요청이 진행 중입니다. |

## 결과

- `WAITING_TARGET_CONFIRMATION`의 semantic collision이 해소됨.
- FE `APPLYING_APPROVED`와 BFF `CONFIRMING`의 레이어별 의미가 명확해짐.
- 과거 4-state 모델은 호환 입력으로만 남고, 신규 문서/코드는 7-state BFF 계약을 따른다.
- provider별 상세 설치 상태는 `installation-status` API에 남기되, coarse lifecycle은 `process_status` 한 필드로 폴링할 수 있다.
- 승인 요청 입력은 리소스 단위 `resource_input`으로 통합되어 VM/credential 입력 경로가 일관화됨.

## 관련

- [ADR-004](./004-process-status-refactoring.md): 폐기됨 (본 ADR로 대체)
- [ADR-006](./006-integration-confirmation-approval-redesign.md): 승인 프로세스/객체 분리 규칙
- [ADR-008](./008-error-handling-strategy.md): CSR 에러 처리 전략
- [ADR-011](./011-typed-bff-client-consolidation.md): route/server의 typed BFF client 경계
- `lib/approval-bff.ts`: `BffApprovalProcessStatus`, `normalizeProcessStatusResponse`
- `app/lib/api/index.ts`: CSR `ProcessStatusResponse`
- `app/integration/api/v1/target-sources/[targetSourceId]/process-status/route.ts`: Next route adapter
- `docs/swagger/confirm.yaml`: BFF process-status 스펙
