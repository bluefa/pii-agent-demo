# S2-W1a — BFF Contract (swagger snippet + types)

> **Recommended model**: Sonnet 4.6
> **Estimated LOC**: ~80 (~50 yaml + ~30 ts types)
> **Branch prefix**: `feat/sit-step2-w1a-bff-contract`
> **Depends on**: 없음 (단독 진입)

## Context

PR #420 으로 `docs/bff-api/tag-guides/approval-requests.md` 에 정의된 신규 endpoint·필드를 **`docs/swagger/`** 와 **`lib/types.ts`** 로 끌어오는 작업.

본 wave 는 **타입/계약 단계** — 실제 mock/route 구현은 S2-W1b 에서 한다.

추가 대상:
- `POST /target-sources/{id}/approval-requests/system-reset`
- `ResourceConfigDto.scan_status: UNCHANGED | NEW_SCAN`
- `ResourceConfigDto.integration_status: INTEGRATED | NOT_INTEGRATED`
- `ApprovalActionResponseDto` 의 status enum 에 `UNAVAILABLE` 추가 확인

## Precondition

```bash
cd /Users/study/pii-agent-demo
git fetch origin main
[ -f docs/bff-api/tag-guides/approval-requests.md ] || { echo "✗ PR #420 미머지"; exit 1; }
grep -q "system-reset" docs/bff-api/tag-guides/approval-requests.md || { echo "✗ system-reset 명세 부재"; exit 1; }
[ -f docs/swagger/confirm.yaml ] || { echo "✗ confirm.yaml 부재"; exit 1; }
```

## Required reading

1. `docs/bff-api/tag-guides/approval-requests.md` line 326–395 (system-reset)
2. `docs/bff-api/tag-guides/approval-requests.md` line 850–945 (`ResourceConfigDto`, `ResourceInputDto`, `ApprovalActionResponseDto`)
3. `docs/swagger/confirm.yaml` 전체 (확장 대상)
4. `lib/types.ts` line 1–300 (확장 대상)
5. `lib/bff/types/target-sources.ts` (BFF 응답 타입)
6. `docs/reports/design-migration-plan-step2to7.md` Step 2 섹션 (필드 매핑 결정)

## Step 1: Worktree

```bash
bash scripts/create-worktree.sh --topic sit-step2-w1a-bff-contract --prefix feat
cd /Users/study/pii-agent-demo-sit-step2-w1a-bff-contract
```

## Step 2: Swagger 확장 — `docs/swagger/confirm.yaml`

### 2.1. Path 추가

`/target-sources/{targetSourceId}/approval-requests/cancel` 다음 줄에 system-reset path 추가:

```yaml
  /target-sources/{targetSourceId}/approval-requests/system-reset:
    parameters:
      - $ref: '#/components/parameters/TargetSourceId'
    post:
      tags:
        - Approval Process
      summary: 승인 요청 시스템 리셋 (반려/UNAVAILABLE → IDLE)
      operationId: systemResetApprovalRequest
      x-expected-duration: 200ms 이내
      description: |
        REJECTED 또는 UNAVAILABLE 상태인 approval-request 를 IDLE 로 명시적으로 reset 합니다.
        사용자가 "연동 대상 DB 다시 선택하기" 액션을 트리거할 때 호출되며,
        이 호출 후 processStatus 는 WAITING_TARGET_CONFIRMATION (1) 으로 회귀합니다.

        본 endpoint 도입 이유: 반려 시 BFF 가 자동으로 processStatus 를 회귀시키지 않고,
        사용자가 반려 사유를 확인한 뒤 명시적으로 reset 을 트리거하도록 한다.
      responses:
        '200':
          description: 시스템 리셋 성공
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ApprovalActionResponseDto'
        '400':
          description: 변경 불가 상태
        '403':
          $ref: '#/components/responses/PermissionDenied'
        '404':
          description: 리셋할 approval-request 없음
        '409':
          description: REJECTED 또는 UNAVAILABLE 상태가 아님
```

### 2.2. `ApprovalActionResponseDto` 의 status enum 확인 (보존)

`docs/swagger/confirm.yaml` 의 **`ApprovalActionResponseDto`** (line 888) 와 `ApprovalLifecycleStatus` (line 974–983) 는 이미 `UNAVAILABLE` 을 포함하고 있음. 별도 변경 불필요.

⚠️ **혼동 주의**: confirm.yaml line 1256 에 별개 schema `ApprovalActionResponse` (Dto 없는 이름) 가 존재하나 이는 **legacy** 로, `success/result + APPROVED/REJECTED enum` 만 가짐 (다른 endpoint 의 응답). system-reset / cancel 등 신규 응답은 `ApprovalActionResponseDto` 를 참조해야 함.

본 wave 의 작업: 위 path snippet (Step 2.1) 의 `$ref` 가 정확히 `ApprovalActionResponseDto` 를 가리키는지 검증만 수행.

### 2.3. `ResourceConfigDto` 에 `scan_status` / `integration_status` 추가

기존 `ResourceConfigDto` 정의에 두 필드 추가:

```yaml
ResourceConfigDto:
  type: object
  properties:
    # ... 기존 필드 유지
    scan_status:
      type: string
      enum: [UNCHANGED, NEW_SCAN]
      nullable: true
      description: |
        직전 confirmed-integration 대비 본 리소스의 스캔 상태.
        - NEW_SCAN: 이번 스캔에서 처음 등장
        - UNCHANGED: 직전 스캔과 동일
        - null: 정보 없음 (UI 는 `—` 로 표시)
    integration_status:
      type: string
      enum: [INTEGRATED, NOT_INTEGRATED]
      nullable: true
      description: |
        본 리소스의 confirmed-integration 등록 여부.
        - INTEGRATED: 이미 confirmed integration 에 포함
        - NOT_INTEGRATED: 미포함
        - null: 정보 없음 (UI 는 `—` 로 표시)
```

## Step 3: TypeScript 타입 확장 — `lib/types.ts`

### 3.1. `ResourceScanStatus` / `ResourceIntegrationStatus` 추가

```ts
// ===== Approval Request Resource Metadata (PR #420) =====

export type ResourceScanStatus = 'UNCHANGED' | 'NEW_SCAN';
export type ResourceIntegrationStatus = 'INTEGRATED' | 'NOT_INTEGRATED';
```

### 3.2. `ApprovalRequestResource` 확장 (또는 신규 정의)

기존 `ResourceInputDto` / `ResourceConfigDto` 매핑 타입에 두 옵션 필드 추가. 기존 필드 시그니처 변경 금지.

```ts
export interface ApprovalResourceMetadata {
  scanStatus?: ResourceScanStatus;        // null 가능 — UI 는 `—`
  integrationStatus?: ResourceIntegrationStatus;
}
```

→ 본 wave 에서는 **타입만 추가**한다. `ApprovalRequestLatestResponse` 등 응답 타입 통합은 S2-W1b 에서 BFF normalize 로직과 함께 진행.

### 3.3. `ApprovalActionStatus` 타입 확인 (보존)

기존 union type (`lib/types.ts` 또는 `lib/approval-bff.ts`) 이 `UNAVAILABLE` 을 이미 포함하는지 grep 으로 확인:

```bash
grep -nE "ApprovalActionStatus|ApprovalLifecycleStatus" lib/types.ts lib/approval-bff.ts
```

→ 이미 포함되어 있으면 변경 없음.
→ 누락되어 있으면 본 wave 에서 추가:

```ts
export type ApprovalActionStatus =
  | 'PENDING' | 'APPROVED' | 'AUTO_APPROVED' | 'REJECTED'
  | 'CANCELLED' | 'UNAVAILABLE' | 'CONFIRMED';
```

⛔ 변경 시 모든 switch / Record literal 의 exhaustive 케이스 추가 필수.

## Step 4: Self-Audit

`/sit-recurring-checks` + `/simplify` + `/vercel-react-best-practices` 순차 실행.

추가 검증:
- swagger snippet 들이 `docs/bff-api/tag-guides/approval-requests.md` 와 의미적으로 일치하는지 line 단위 확인.
- enum 변경이 type assertion 의 exhaustive switch 문에 영향 주는지 grep:
  ```bash
  grep -rn "ApprovalActionStatus" lib/ app/ | grep -v ".test." | grep -v ".d.ts"
  ```
  → 모든 switch / Record literal 에 `UNAVAILABLE` 케이스 추가 (또는 `// TODO(S2-W1b)` 마커).

## Step 5: Verify

```bash
npx tsc --noEmit
npm run lint -- docs/swagger/confirm.yaml lib/types.ts
```

## Step 6: PR

```markdown
## Summary
- Spec: `docs/reports/sit-step2/S2-W1a-bff-contract.md` @ <SHA>
- Wave: S2-W1a
- 의존: 없음
- 디자인 reference: `design/app/SIT Prototype v2.html` line 1535–1610

## Changed files
- docs/swagger/confirm.yaml — system-reset path + ResourceConfigDto 필드
- lib/types.ts — ResourceScanStatus / ResourceIntegrationStatus / ApprovalActionStatus 확장

## Deferred to later waves
- system-reset endpoint 의 mock + Next.js route + bff-client → S2-W1b
- WaitingApprovalStep 표 컬럼 wiring → S2-W1c
```

## ⛔ 금지

- 본 wave 에서 mock / route / UI 코드 수정 금지 (S2-W1b 이후 분리).
- 기존 `confirm.yaml` schema 수정 (필드 삭제 / 의미 변경) 금지 — 추가만.
- enum 추가 시 기존 케이스를 알파벳 순으로 재정렬 금지 (diff 노이즈 차단).
