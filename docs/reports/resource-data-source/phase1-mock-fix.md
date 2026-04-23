# Phase 1 — Mock 수정: confirmed-integration 누락 + targetSource 누설 차단

## Context

- 감사 문서: `docs/reports/resource-data-source-audit-2026-04-23.md` §2.1 / §2.10 / §4.5 / §4.6
- 두 가지 mock 결함을 함께 수정해 후속 phase 의 검증 기반 마련.

### 결함 1 — `mockTargetSources.get` 가 내부 Project 누설

`lib/api-client/mock/target-sources.ts:142-147`:
```ts
get: async (targetSourceId) => {
  const response = await mockProjects.get(targetSourceId);
  const { project } = await response.json();
  return NextResponse.json({ targetSource: project });  // ← Project.resources 까지 노출
},
```

→ `Project` 의 `resources: Resource[]` 가 응답에 묻어 나옴. Issue 222 정식 응답에는 없는 필드.

### 결함 2 — APPLYING_APPROVED → INSTALLING 전이 시점에 confirmed-integration 미반영

`lib/api-client/mock/confirm.ts:514-546` `getConfirmedIntegration`:
- snapshot store 에 값이 있으면 그것을 반환 — 단 store 는 "변경요청 시 이전 보존" 경로에서만 set 됨.
- snapshot 없으면 `installation.status === 'COMPLETED'` AND `connectionStatus === 'CONNECTED'` 인 리소스만 반환.

`lib/api-client/mock/confirm.ts:837-895` 자동 전이 (`getProcessStatus` 안):
- 승인 후 20 초 경과 → `installation.status: 'IN_PROGRESS'` 로 업데이트.
- snapshot store 미수정. → step 4 (INSTALLING), step 5 (WAITING_CONNECTION_TEST) 동안 `getConfirmedIntegration` 항상 EMPTY.

신규 정책 ("step 4 부터 confirmed-integration 으로만 표시") 을 만족하려면 mock 도 함께 채워져야 함.

## Precondition

```bash
cd /Users/study/pii-agent-demo
git fetch origin main
[ -f lib/api-client/mock/target-sources.ts ] || { echo "✗ source missing"; exit 1; }
[ -f lib/api-client/mock/confirm.ts ] || { echo "✗ source missing"; exit 1; }
[ -f lib/api-client/mock/__tests__/confirm-process-status.test.ts ] || \
  echo "(no existing test file under that name; new tests go to lib/__tests__/...)"
```

## Step 1 — Worktree

```bash
bash scripts/create-worktree.sh --topic resource-mock-fix --prefix fix
cd /Users/study/pii-agent-demo-resource-mock-fix
```

## Step 2 — Required reading

1. `docs/reports/resource-data-source-audit-2026-04-23.md` §2.1, §2.10, §4.5, §4.6
2. `lib/api-client/mock/target-sources.ts:101-148` (`toIssue222TargetSourceInfo`, `get`)
3. `lib/api-client/mock/confirm.ts:30-72` (snapshot stores, helpers)
4. `lib/api-client/mock/confirm.ts:194-220` (`toConfirmedIntegrationResourceInfo`)
5. `lib/api-client/mock/confirm.ts:280-300` (변경요청 시 snapshot 보존 로직 — 참조)
6. `lib/api-client/mock/confirm.ts:514-546` (`getConfirmedIntegration`)
7. `lib/api-client/mock/confirm.ts:837-895` (APPLYING → INSTALLING 자동 전이)
8. `lib/issue-222-approval.ts` 또는 `lib/confirmed-integration-response.ts` (응답 형식)
9. `app/integration/api/v1/target-sources/[targetSourceId]/confirmed-integration/route.ts` — 빈 응답 → 404 변환 (참조; 이 단계에서는 미변경)

## Step 3 — Implementation

### 3-1. targetSource 누설 차단

`lib/api-client/mock/target-sources.ts` 의 `get` 핸들러 변경:

```ts
get: async (targetSourceId) => {
  const response = await mockProjects.get(targetSourceId);
  if (!response.ok) return response;
  const { project } = await response.json();
  return NextResponse.json({ targetSource: toIssue222TargetSourceInfo(project) });
},
```

검증 포인트: 응답 객체에 `resources` 필드가 없어야 함.

> ⚠ Phase 4 가 `Project.resources` 필드를 정식으로 제거하기 전까지, **클라 normalizer (`lib/target-source-response.ts:214`) 가 `value.resources` 가 없을 때 `[]` 로 폴백**하므로 즉각적 UI 회귀는 없을 것. 다만 Mock 시드 / 다른 mock 핸들러 체인에서 `targetSource.resources` 를 기대하는 곳이 없는지 grep 으로 확인:
>
> ```bash
> grep -rn "targetSource\.resources\|targetSource\[.resources.\]" /Users/study/pii-agent-demo --include="*.ts" --include="*.tsx" | grep -v ".test."
> ```
>
> 사이트가 있다면 spec 외 리스크로 분류, deferred 에 기록 (수정은 Phase 4 에서).

### 3-2. confirmed-integration 채움 — 자동 전이 시점

`lib/api-client/mock/confirm.ts` 의 자동 전이 분기 (`elapsedMs >= MOCK_APPLYING_DELAY_MS`) 안, `mockData.updateProject` 직후, **ApprovedIntegration 의 selected 리소스를 confirmedIntegrationSnapshotStore 에 set**:

```ts
if (elapsedMs >= MOCK_APPLYING_DELAY_MS) {
  // ... (기존 progressedStatus / updateProject)

  // NEW: ApprovedIntegration 의 selected 리소스를 ConfirmedIntegration 으로 마이그레이션
  const approvedIntegration = approvedIntegrationStore.get(project.id);
  if (approvedIntegration && !confirmedIntegrationSnapshotStore.has(project.id)) {
    const updatedAfter = mockData.getProjectByTargetSourceId(Number(targetSourceId))!;
    const selectedResources = updatedAfter.resources.filter((r) =>
      approvedIntegration.resource_infos.some((ai) => ai.resource_id === r.id),
    );
    if (selectedResources.length > 0) {
      confirmedIntegrationSnapshotStore.set(project.id, {
        resource_infos: selectedResources.map(toConfirmedIntegrationResourceInfo),
      });
    }
  }
  // ... (기존 NextResponse.json 반환)
}
```

⛔ 주의 사항:
- `confirmedIntegrationSnapshotStore.has(project.id)` 가드는 변경요청 케이스(이전 확정 보존) 와 충돌하지 않도록 — 변경요청 보존이 이미 set 되어 있으면 덮어쓰지 않음.
- 진짜 production BFF 동작은 알 수 없음. 이건 mock 동작 정합성 회복 목적. PR body 에 명시.

### 3-3. confirmed-integration derive 조건 보완 (보강)

`getConfirmedIntegration` 의 폴백 (snapshot 이 없을 때) 도 정렬:

```ts
// before
if (activeResources.length === 0
    || project.status.installation.status !== 'COMPLETED') {
  return NextResponse.json(createEmptyConfirmedIntegration());
}

// after  — installation.status 가 IN_PROGRESS / COMPLETED 인 경우 모두 채움
//        — connectionStatus 필터는 connection-test 단계 이후에만 적용
if (project.status.installation.status === 'PENDING') {
  return NextResponse.json(createEmptyConfirmedIntegration());
}
const includesConnectionFilter =
  project.processStatus === ProcessStatus.CONNECTION_VERIFIED ||
  project.processStatus === ProcessStatus.INSTALLATION_COMPLETE;
const eligibleResources = project.resources.filter((r) =>
  r.isSelected && (!includesConnectionFilter || r.connectionStatus === 'CONNECTED'),
);
if (eligibleResources.length === 0) {
  return NextResponse.json(createEmptyConfirmedIntegration());
}
return NextResponse.json({
  resource_infos: eligibleResources.map(toConfirmedIntegrationResourceInfo),
});
```

→ snapshot store 가 set 되지 않은 엣지(자동 전이 직후 polling 타이밍 등) 에서도 step 4 부터 채워짐.

### 3-4. 회귀 테스트

`lib/__tests__/mock-confirm-process-status.test.ts` (이미 존재 시) 또는 신규 `lib/__tests__/mock-confirmed-integration-step4.test.ts`:

```ts
it('APPLYING_APPROVED → INSTALLING 자동 전이 직후 confirmed-integration 가 채워진다', async () => {
  // 1. 프로젝트 시드 → step 2 (WAITING_APPROVAL)
  // 2. _setApprovedIntegration(...) 호출 → step 3 (APPLYING_APPROVED) 시뮬레이션
  // 3. _fastForwardApproval(...) → 자동 전이 트리거
  // 4. mockConfirm.getProcessStatus(...) → 자동 전이 발생
  // 5. mockConfirm.getConfirmedIntegration(...) → resource_infos.length > 0 검증
});

it('mockTargetSources.get 응답에 resources 필드가 없다', async () => {
  const res = await mockTargetSources.get('1001');
  const body = await res.json();
  expect(body.targetSource).not.toHaveProperty('resources');
});
```

기존 테스트가 `targetSource.resources` 를 단언한다면 그것은 회귀가 아니라 누설 차단 의도이므로 **테스트를 수정**하고 PR body 에 명시.

## Step 4 — Do NOT touch

- Provider 페이지 (AWS / Azure / GCP) — Phase 2/4 범위
- `ProcessStatusCard` / `ApprovalWaitingCard` / `ApprovalApplyingBanner` — Phase 3 범위
- `Project` 타입 (`lib/types.ts`) — Phase 4 범위
- `lib/target-source-response.ts:214` normalize — Phase 4 범위
- BFF route `confirmed-integration/route.ts` 의 404 변환 — 이번 단계에서는 미변경 (별도 의사결정 필요)
- IDC / SDU 관련 mock — 본 정책 외

## Step 5 — Verify

```bash
npx tsc --noEmit
npm run lint -- lib/api-client/mock/target-sources.ts lib/api-client/mock/confirm.ts lib/__tests__/
npm run build
npm test -- mock-confirmed-integration-step4 2>&1 | tail -30
```

수동 검증:
1. `bash scripts/dev.sh /Users/study/pii-agent-demo-resource-mock-fix`
2. mock seed 의 step 4 (INSTALLING) TS 진입 → DevTools Network → `/confirmed-integration` 응답 `resource_infos.length > 0` 확인
3. step 1 TS 의 `/target-sources/{id}` 응답 → `targetSource.resources` 필드 없음 확인

## Step 6 — Commit + push + PR

`/wave-task` 가 자동으로 처리. 수동 commit 시 메시지:

```
fix(mock): confirmed-integration step 4 진입 시 채움 + targetSource resources 누설 차단 (resource-mock-fix)

근거: docs/reports/resource-data-source-audit-2026-04-23.md §2.10, §2.1.

변경:
- mockTargetSources.get → toIssue222TargetSourceInfo 통과
- 자동 전이(APPLYING → INSTALLING) 시 ApprovedIntegration → ConfirmedIntegrationSnapshotStore 마이그레이션
- getConfirmedIntegration derive 조건 완화 (installation.status === 'PENDING' 만 empty, connectionStatus 필터는 step 6+ 한정)

회귀 테스트 추가.

Out of scope (Phase 2-4):
- Project.resources 필드 제거
- target-source-response.ts normalizer 수정
- Provider 페이지 / ProcessStatusCard 수정
```

## Step 7 — Self-review (Phase 3 of /wave-task)

`/sit-recurring-checks`, `/simplify`, `/vercel-react-best-practices` 순차 실행.

## Return (under 200 words)

1. PR URL
2. tsc / lint / build / test 결과
3. 추가된 테스트 수
4. mock 누설 검증 grep 결과 (Step 3-1 의 `targetSource.resources` 사용처)
5. Spec 대비 deviation
