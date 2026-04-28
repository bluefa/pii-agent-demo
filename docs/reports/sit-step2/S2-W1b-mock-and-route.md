# S2-W1b — Mock + Route + BFF client (system-reset endpoint + 반려 IA 변경)

> **Recommended model**: **Opus 4.7 MAX** (mock 비즈니스 로직 + ADR-011 typed BFF client 분산 계층 + 반려 상태 전이 변경 + calculator 변경 + 회귀 테스트)
> **Estimated LOC**: ~400 (~270 src + ~130 tests)
> **Branch prefix**: `feat/sit-step2-w1b-mock-and-route`
> **Depends on**: S2-W1a (merged)

## Context

S2-W1a 에서 정의한 BFF contract 의 **실 구현 layer**.

네 가지 작업 동시 진행:

1. **system-reset endpoint** — Next.js route + BFF client method (typed) + mock 비즈니스 로직.
2. **`scan_status` / `integration_status` 필드 mock 노출** — `approved-integration` 응답에서 두 필드를 정상적으로 내려보내도록 (S3-W1a 가 사용). `approval-requests/latest` 는 리소스 배열을 반환하지 않으므로 **본 endpoint 는 변경 대상 아님**.
3. **`ExcludedResourceInfo` 확장 mock 노출** — `excluded_resource_infos[*]` 에 `resource_name` / `database_type` / `database_region` / `scan_status` / `integration_status` 필드 채우기 (S3-W1a 가 사용).
4. **반려 IA 변경 (가장 critical, 구조적 변경)** — 현재 mock 은 reject 시 `targets: { confirmed: false }` + `getCurrentStep` 호출로 **Step 1 으로 자동 회귀**시킨다. 이를 변경하려면 단순히 processStatus 만 두는 것이 아니라:
   - `lib/bff/mock/confirm.ts` 의 reject 로직: `targets.confirmed` 보존 + 요청 리소스 snapshot 보존, `approval.status='REJECTED'` 만 변경
   - `lib/process/calculator.ts` 의 `getCurrentStep`: `approval.status === 'REJECTED'` 분기 추가하여 Step 2 유지 (현재는 `targets.confirmed === false` 조건으로 Step 1 강제 회귀)
   - system-reset 호출 시에만 `targets.confirmed=false` + `approval.status='IDLE'` 로 reset → Step 1 회귀

⛔ **본 wave 가 머지되어야 W1c/d/e 가 시작 가능**. mock 응답 형태가 frontend 의존성이라 순서 엄수.

⚠️ **ADR-011 기반 BFF client 계층** (ADR-007 은 ADR-011 로 대체되어 파일이 삭제됨):
- `lib/bff/types.ts` — `BffClient` interface 에 method signature 추가
- `lib/bff/http.ts` — HTTP impl 에 `httpBff.confirm.*` 메소드 추가
- `lib/bff/mock-adapter.ts` — `mockBff.confirm.*` 에 mock dispatch 추가
- `lib/bff/mock/confirm.ts` — 실제 mock 비즈니스 로직 (mutate state)

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
3. `lib/bff/mock/confirm.ts` 전체 — 반려/취소 mock 로직 (특히 line 1083–1110 의 reject 로직 — `targets.confirmed=false` 셋팅)
4. `lib/process/calculator.ts` 전체 — 특히 `getCurrentStep` line 27–35 (`targets.confirmed === false` → Step 1 회귀 로직 — 본 wave 에서 변경 필요)
5. `lib/bff/mock/target-sources.ts` line 90–250 — `isRejected` / `processStatus` 매핑
6. `app/integration/api/v1/target-sources/[targetSourceId]/approval-requests/cancel/route.ts` 전체 — route handler 패턴 reference
7. `app/api/_lib/handler.ts` `withV1` 시그니처
8. `app/api/_lib/problem.ts` line 1–90 — ProblemDetails / `KnownErrorCode`
9. `lib/approval-bff.ts` `normalizeApprovalActionResponse` — UNAVAILABLE 케이스 처리 추가 필요
10. **ADR-011** (`docs/adr/011-typed-bff-client-consolidation.md`) — typed BFF client 분산 계층 (interface vs impl)
11. `lib/bff/types.ts` — `BffClient` interface (method signature 추가 위치)
12. `lib/bff/http.ts` — HTTP impl (`httpBff.confirm.*` namespace, line 211–250)
13. `lib/bff/mock-adapter.ts` — mock dispatch (`mockBff.confirm.*`, line 179–215)
14. `lib/bff/client.ts` — dispatcher (변경 거의 없음 — `IS_MOCK ? mockBff : httpBff` 만 수행)
15. `lib/__tests__/mock-confirm-process-status.test.ts` — mock 회귀 테스트 reference

## Step 1: Worktree

```bash
bash scripts/create-worktree.sh --topic sit-step2-w1b-mock-and-route --prefix feat
cd /Users/study/pii-agent-demo-sit-step2-w1b-mock-and-route
```

## Step 2: BFF Client typed 계층 method 추가 (ADR-011)

ADR-011 의 typed client 패턴 — interface / http impl / mock dispatch 세 곳에 method 추가.

### 2.1. `lib/bff/types.ts` — `BffClient.confirm` interface 확장

```ts
// confirm namespace 에 추가
systemResetApprovalRequest: (id: number) => Promise<unknown>;
```

### 2.2. `lib/bff/http.ts` — HTTP impl 추가

기존 `cancelApprovalRequest` 등과 동일한 패턴 (line 243):

```ts
systemResetApprovalRequest: (id) =>
  post<unknown>(`/target-sources/${id}/approval-requests/system-reset`, {}),
```

### 2.3. `lib/bff/mock-adapter.ts` — mock dispatch 추가

기존 `cancelApprovalRequest` 등과 동일한 패턴 (line 208):

```ts
systemResetApprovalRequest: async (id) =>
  unwrap<unknown>(await mockConfirm.systemResetApprovalRequest(String(id))),
```

⛔ `lib/bff/client.ts` 자체는 dispatcher 일 뿐 (`IS_MOCK ? mockBff : httpBff`) — 본 wave 에서 변경 없음.

## Step 3: Mock 구현 — `lib/bff/mock/confirm.ts`

### 3.1. `systemResetApprovalRequest` 함수 추가

```ts
export async function systemResetApprovalRequest(
  targetSourceId: number,
): Promise<ApprovalActionResponseDto> {
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

### 3.2. 반려 처리 변경 — `rejectApprovalRequest` 함수 (CRITICAL — 구조적 변경)

현재 mock reject 로직 (line 1083–1110) 은 다음을 수행:

1. 선택 리소스를 모두 `isSelected=false` 로 해제
2. `targets: { confirmed: false, selectedCount: 0, excludedCount: 0 }` 셋팅
3. `getCurrentStep(updatedStatus)` 호출 → calculator 가 `targets.confirmed === false` 로 인해 **Step 1 강제 회귀**

본 wave 의 변경:

```ts
// ✅ 변경 후 — Step 2 머무름 + REJECTED 표지
const updatedStatus: ProjectStatus = {
  ...project.status,
  // ⛔ targets.confirmed 보존 — Step 1 회귀 방지
  // targets: { confirmed: false, selectedCount: 0, excludedCount: 0 },  // 삭제
  approval: { status: 'REJECTED', rejectedAt: now, rejectionReason: reason },
};

// 선택 리소스 snapshot 보존 (system-reset 시까지 유지) — 다시 노출 가능하도록
// const updatedResources = project.resources.map(...isSelected=false...) // 삭제

const calculatedProcessStatus = getCurrentStep(updatedStatus);
// → 변경 후 calculator 가 approval.status === 'REJECTED' 분기 처리 (Step 3.2-bis)

mockData.updateProject(project.id, {
  processStatus: calculatedProcessStatus,
  status: updatedStatus,
  // resources 변경 안 함 — 원본 보존
  isRejected: true,
  rejectionReason: reason,
  rejectedAt: now,
});
```

### 3.2-bis. `lib/process/calculator.ts` `getCurrentStep` 변경 (CRITICAL)

기존 line 27–35:

```ts
// ❌ 변경 전 — targets.confirmed === false 면 무조건 Step 1
if (status.targets?.confirmed !== true) {
  return ProcessStatus.WAITING_TARGET_CONFIRMATION;
}
```

```ts
// ✅ 변경 후 — REJECTED 인 경우 Step 2 유지
if (status.targets?.confirmed !== true) {
  // 반려 직후 사용자가 system-reset 으로 명시적 복귀할 때까지 Step 2 머무름
  if (status.approval?.status === 'REJECTED') {
    return ProcessStatus.WAITING_APPROVAL;
  }
  return ProcessStatus.WAITING_TARGET_CONFIRMATION;
}
```

⛔ **이 변경은 회귀 위험이 가장 큰 변경**. 모든 calculator / process-status / reject 관련 테스트 재실행 필수.

⛔ Step 1 회귀의 **유일한 트리거**는 system-reset (Step 3.1) 이 되어야 함. system-reset 호출 시:
```ts
project.status.targets.confirmed = false;
project.status.approval.status = 'IDLE';
```
→ calculator 가 자연스럽게 Step 1 반환.

### 3.3. `scan_status` / `integration_status` mock 노출

`getApprovedIntegration` 응답 매핑에 두 필드 추가 (`approval-requests/latest` 는 리소스 배열을 반환하지 않으므로 변경 대상 아님):

```ts
// approved-integration 응답의 resource_infos[*] (ResourceConfigDto)
{
  // ... 기존 필드
  scan_status: resource.scanStatus ?? null,
  integration_status: resource.integrationStatus ?? null,
}

// approved-integration 응답의 excluded_resource_infos[*] (ExcludedResourceInfo — PR #420 확장)
{
  resource_id: r.resourceId,
  exclusion_reason: r.exclusionReason,
  resource_name: r.resourceName ?? null,
  database_type: r.databaseType ?? null,
  database_region: r.databaseRegion ?? null,
  scan_status: r.scanStatus ?? null,
  integration_status: r.integrationStatus ?? null,
}
```

→ Mock seed 데이터에 두 필드를 일부 리소스에 셋팅. null 케이스도 demo 가치 있으므로 일부는 비워둠.

### 3.4. `app/lib/api/index.ts` normalizer 확장 (S3-W1a 가 사용)

기존 `toApprovedIntegrationResourceSnapshot` (line 302–309) 가 두 필드를 보존하지 않으므로 확장:

```ts
const toApprovedIntegrationResourceSnapshot = (
  resource: ResourceConfigDto,
): ApprovedIntegrationResourceItem => ({
  resource_id: resource.resource_id ?? '',
  resource_type: resource.resource_type ?? '',
  endpoint_config: toEndpointConfigSnapshot(resource),
  credential_id: resource.credential_id ?? null,
  // ✨ 본 wave 가 추가
  scan_status: resource.scan_status ?? null,
  integration_status: resource.integration_status ?? null,
  database_region: resource.database_region ?? null,
  resource_name: resource.resource_name ?? null,
});
```

→ `ApprovedIntegrationResourceItem` 타입도 확장 필요 (옵션 필드 4개 추가).
→ excluded snapshot 매핑에도 동일 필드 추가.

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

⛔ ADR-011 준수: route 는 thin dispatch, 비즈니스 로직은 mock 에서. cancel route 와 동일한 패턴 (단, history fallback 은 system-reset 에 불필요 — system 이 직접 mutate 했으므로).

## Step 5: Frontend API helper — `app/lib/api/index.ts`

기존 `cancelApprovalRequest` 패턴을 참조하여 동일 구조로 `systemResetApprovalRequest` 추가:

```ts
export async function systemResetApprovalRequest(
  targetSourceId: number,
): Promise<ApprovalActionResponseDto> {
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
- lib/bff/types.ts — `BffClient.confirm.systemResetApprovalRequest` interface 추가
- lib/bff/http.ts — httpBff.confirm.systemResetApprovalRequest 구현
- lib/bff/mock-adapter.ts — mockBff.confirm.systemResetApprovalRequest dispatch
- lib/bff/mock/confirm.ts — systemResetApprovalRequest 비즈니스 로직 + reject IA 변경 (targets.confirmed 보존) + scan_status / integration_status / ExcludedResourceInfo 확장 필드
- lib/process/calculator.ts — `getCurrentStep` 에 `approval.status === 'REJECTED'` 분기 추가 (Step 2 유지)
- lib/approval-bff.ts — UNAVAILABLE 케이스 normalize
- app/lib/api/index.ts — `systemResetApprovalRequest` helper + `toApprovedIntegrationResourceSnapshot` 의 4개 필드 보존 확장 + `ApprovedIntegrationResourceItem` 타입 확장
- app/integration/api/v1/target-sources/[targetSourceId]/approval-requests/system-reset/route.ts (신규)
- lib/__tests__/mock-confirm-system-reset.test.ts (신규)
- lib/__tests__/mock-confirm-process-status.test.ts — reject IA 회귀 케이스 수정
- lib/__tests__/process-calculator-rejected.test.ts (신규) — calculator 의 REJECTED 분기 검증
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
