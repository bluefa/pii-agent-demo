# S2-W1b — Mock + Route + bff-client (system-reset endpoint + 반려 IA 변경)

> **Recommended model**: **Opus 4.7 MAX** (mock 비즈니스 로직 + ADR-007 NextResponse 디스패치 + 반려 IA 변경 + 회귀 테스트)
> **Estimated LOC**: ~350 (~250 src + ~100 tests)
> **Branch prefix**: `feat/sit-step2-w1b-mock-and-route`
> **Depends on**: S2-W1a (merged)

## Context

S2-W1a 에서 정의한 BFF contract 의 **실 구현 layer**.

세 가지 작업 동시 진행:

1. **system-reset endpoint** — Next.js route + bff-client 호출 + mock 비즈니스 로직.
2. **`scan_status` / `integration_status` 필드 mock 노출** — `approval-requests/latest` / `approved-integration` 응답에서 두 필드를 정상적으로 내려보내도록.
3. **반려 IA 변경 (가장 critical)** — 현재 mock 은 reject 시 processStatus 를 자동으로 1로 회귀시키는데, 이를 **OFF 하고 isRejected=true 만 셋팅**하도록 변경. system-reset 호출 시에만 1로 회귀.

⛔ **본 wave 가 머지되어야 W1c/d/e 가 시작 가능**. mock 응답 형태가 frontend 의존성이라 순서 엄수.

## Precondition

```bash
cd /Users/study/pii-agent-demo
git fetch origin main
[ -f docs/swagger/confirm.yaml ] && grep -q "systemResetApprovalRequest" docs/swagger/confirm.yaml || { echo "✗ S2-W1a 미머지"; exit 1; }
grep -q "ResourceScanStatus" lib/types.ts || { echo "✗ S2-W1a types 미반영"; exit 1; }
[ -f app/integration/api/v1/target-sources/'[targetSourceId]'/approval-requests/cancel/route.ts ] || { echo "✗ cancel route 부재 (참고용)"; exit 1; }
```

## Required reading

1. `docs/swagger/confirm.yaml` (S2-W1a 결과)
2. `docs/bff-api/tag-guides/approval-requests.md` line 326–395 (system-reset)
3. `lib/bff/mock/confirm.ts` 전체 — 반려/취소 mock 로직
4. `lib/bff/mock/target-sources.ts` line 90–250 — `isRejected` / `processStatus` 매핑
5. `app/integration/api/v1/target-sources/[targetSourceId]/approval-requests/cancel/route.ts` 전체 — route handler 패턴 reference
6. `app/api/_lib/handler.ts` `withV1` 시그니처
7. `app/api/_lib/problem.ts` line 1–90 — ProblemDetails / `KnownErrorCode`
8. `lib/approval-bff.ts` `normalizeApprovalActionResponse` — UNAVAILABLE 케이스 처리 추가 필요
9. `lib/bff/client.ts` `bff.confirm.*` namespace
10. `docs/adr/007-api-client-pattern.md` — route 는 thin dispatch, 비즈니스 로직은 mock
11. `lib/__tests__/mock-confirm-process-status.test.ts` — mock 회귀 테스트 reference

## Step 1: Worktree

```bash
bash scripts/create-worktree.sh --topic sit-step2-w1b-mock-and-route --prefix feat
cd /Users/study/pii-agent-demo-sit-step2-w1b-mock-and-route
```

## Step 2: bff-client 메소드 추가 (`lib/bff/client.ts`)

```ts
// bff.confirm namespace 에 추가
async systemResetApprovalRequest(targetSourceId: number): Promise<ApprovalActionResponse> {
  return http.post(`/install/v1/target-sources/${targetSourceId}/approval-requests/system-reset`);
}
```

## Step 3: Mock 구현 — `lib/bff/mock/confirm.ts`

### 3.1. `systemResetApprovalRequest` 함수 추가

```ts
export async function systemResetApprovalRequest(
  targetSourceId: number,
): Promise<ApprovalActionResponse> {
  const project = getProjectOrThrow(targetSourceId);

  // 409 — REJECTED/UNAVAILABLE 만 허용
  if (!project.isRejected && project.lastApprovalResult !== 'UNAVAILABLE') {
    throw new BffError({
      status: 409,
      code: 'APPROVAL_REQUEST_NOT_RESETTABLE',
      message: 'REJECTED 또는 UNAVAILABLE 상태에서만 system-reset 호출 가능합니다.',
    });
  }

  // mutation: processStatus 를 1 (WAITING_TARGET_CONFIRMATION) 로 회귀, isRejected 클리어
  project.processStatus = ProcessStatus.WAITING_TARGET_CONFIRMATION;
  project.isRejected = false;
  project.rejectionReason = undefined;
  project.rejectedAt = undefined;
  project.lastApprovalResult = 'CANCELLED'; // history 보존

  return {
    request_id: project.lastApprovalRequestId ?? 0,
    status: 'CANCELLED',
    processed_at: new Date().toISOString(),
    processed_by: { user_id: 'system' },
    reason: 'system-reset triggered by user',
  };
}
```

### 3.2. 반려 처리 변경 — `rejectApprovalRequest` 함수 (CRITICAL)

기존 mock 의 reject 로직에서 **processStatus 자동 회귀 코드 제거**.

```ts
// ❌ 변경 전
project.processStatus = ProcessStatus.WAITING_TARGET_CONFIRMATION;
project.isRejected = true;

// ✅ 변경 후
// processStatus 는 WAITING_APPROVAL (2) 그대로 유지
project.isRejected = true;
project.rejectionReason = body.reason;
project.rejectedAt = new Date().toISOString();
project.lastApprovalResult = 'REJECTED';
```

⛔ 이 변경은 **회귀 위험이 가장 큰 변경** — 모든 reject 관련 테스트 재실행 필수.

### 3.3. `scan_status` / `integration_status` 노출

`getApprovalRequestLatest`, `getApprovedIntegration` 응답 매핑에 두 필드 추가:

```ts
// 각 ResourceConfigDto 매핑
{
  // ... 기존 필드
  scan_status: resource.scanStatus ?? null,
  integration_status: resource.integrationStatus ?? null,
}
```

→ Mock seed 데이터에 두 필드를 일부 리소스에 셋팅 (전부 채울 필요 없음 — null 케이스도 demo 가치 있음).

## Step 4: Next.js Route — system-reset

### `app/integration/api/v1/target-sources/[targetSourceId]/approval-requests/system-reset/route.ts` (~30 LOC)

```ts
import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { BffError } from '@/lib/bff/errors';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { problemResponse } from '@/app/api/_lib/problem';
import { normalizeApprovalActionResponse } from '@/lib/approval-bff';

export const POST = withV1(async (_request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const payload = await bff.confirm.systemResetApprovalRequest(parsed.value);

  return NextResponse.json(
    normalizeApprovalActionResponse(payload, { fallbackStatus: 'CANCELLED' }),
  );
});
```

⛔ ADR-007 준수: route 는 thin dispatch, 비즈니스 로직은 mock 에서. cancel route 와 동일한 패턴 (단, history fallback 은 system-reset 에 불필요 — system 이 직접 mutate 했으므로).

## Step 5: Frontend API helper — `app/lib/api/index.ts`

기존 `cancelApprovalRequest` 패턴을 참조하여 동일 구조로 `systemResetApprovalRequest` 추가:

```ts
export async function systemResetApprovalRequest(
  targetSourceId: number,
): Promise<ApprovalActionResponse> {
  return fetchJson(
    `/integration/api/v1/target-sources/${targetSourceId}/approval-requests/system-reset`,
    { method: 'POST' },
  );
}
```

## Step 6: Tests

### 6.1. Mock unit tests — `lib/__tests__/mock-confirm-system-reset.test.ts` (신규, ~80 LOC)

```ts
describe('systemResetApprovalRequest', () => {
  it('REJECTED 상태에서 호출 시 processStatus=1, isRejected=false', async () => { ... });
  it('UNAVAILABLE 상태에서 호출 시 processStatus=1', async () => { ... });
  it('PENDING 상태에서 호출 시 409', async () => { ... });
  it('CONFIRMED 상태에서 호출 시 409', async () => { ... });
  it('Target Source 없음 → 404', async () => { ... });
});
```

### 6.2. Reject 회귀 테스트 — `lib/__tests__/mock-confirm-process-status.test.ts` 수정

기존 테스트 중 `reject 후 processStatus === WAITING_TARGET_CONFIRMATION` 을 expect 하던 케이스를 모두 **`processStatus === WAITING_APPROVAL && isRejected === true`** 로 변경.

⛔ 기존 테스트를 의미 보존하지 못한 채 수정하면 안 됨 — 각 케이스의 행동 변경 의도가 spec 과 일치하는지 line 단위 확인.

### 6.3. Route smoke test — `app/integration/api/v1/__tests__/approval-requests.system-reset.test.ts` (신규, ~50 LOC)

200 / 409 / 404 path 검증.

## Step 7: Self-Audit

`/sit-recurring-checks` + `/simplify` + `/vercel-react-best-practices` 순차.

추가:
- mock 파일에서 `try/catch` 직접 사용 여부 (CLAUDE.md 금지) — `BffError` throw 패턴만 사용.
- Reject IA 변경이 admin 화면 (`app/integration/admin/...`) 에 영향 주는지 grep — admin reject 화면이 user side 의 isRejected 필드에 의존하면 동일 IA 가정으로 갈 수 있음.

## Step 8: Verify

```bash
npx tsc --noEmit
npm run lint -- lib/bff/ app/integration/api/v1/target-sources/
npm run test -- lib/__tests__/mock-confirm
USE_MOCK_DATA=true npm run dev   # 수동: reject → Step 2 머무름 / system-reset → Step 1 회귀
```

## Step 9: PR

```markdown
## Summary
- Spec: `docs/reports/sit-step2/S2-W1b-mock-and-route.md` @ <SHA>
- Wave: S2-W1b
- 의존: S2-W1a (merged)

## Changed files
- lib/bff/client.ts — systemResetApprovalRequest method
- lib/bff/mock/confirm.ts — systemReset / reject IA / scan_status & integration_status
- lib/approval-bff.ts — UNAVAILABLE 케이스 normalize
- app/integration/api/v1/target-sources/[targetSourceId]/approval-requests/system-reset/route.ts (신규)
- app/lib/api/index.ts — systemResetApprovalRequest helper
- lib/__tests__/mock-confirm-system-reset.test.ts (신규)
- lib/__tests__/mock-confirm-process-status.test.ts — reject IA 회귀 케이스 수정
- app/integration/api/v1/__tests__/approval-requests.system-reset.test.ts (신규)

## Manual verification
- [ ] USE_MOCK_DATA=true 환경에서:
  - [ ] reject 후 화면이 Step 2 에 머무르고 isRejected=true 가 표시됨
  - [ ] system-reset 호출 후 Step 1 으로 자동 라우팅
  - [ ] approval-requests/latest 응답에 scan_status / integration_status 필드 노출

## Deferred to later waves
- WaitingApprovalStep 테이블에 두 필드 노출 → S2-W1c
- 취소 confirm modal → S2-W1d
- "다시 선택하기" 버튼 wiring → S2-W1e
```

## ⛔ 금지

- 반려 IA 변경 시 기존 `isRejected=true` 로직 외 다른 필드 의미 변경 금지.
- mock seed data 의 기존 리소스 ID / projectCode 변경 금지 (회귀 테스트 안정성).
- system-reset 의 응답 status 를 새 enum 값으로 만들지 말 것 — 기존 `CANCELLED` 또는 `REJECTED` 재사용.
- Frontend 컴포넌트 수정 금지 — W1c/d/e 영역.
