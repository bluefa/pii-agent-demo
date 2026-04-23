# Phase 4 — `Project.resources` 폐기 + provider 페이지 catalog 호출 전환

## Context

- 감사 문서: `docs/reports/resource-data-source-audit-2026-04-23.md` §2.1, §2.2, §2.3, §2.4, §2.5, §4.3, §4.5
- 의존: **Phase 1, 2, 3 모두 머지 완료 후 시작.** 신규 카드(P2) + ProcessStatusCard 정리(P3) 가 끝나야 `project.resources` 의존이 step 1 영역으로 좁혀짐.

## Goal

1. `Project.resources: Resource[]` 타입 필드 제거
2. `lib/target-source-response.ts:214` normalize 제거
3. AWS / Azure / GCP provider 페이지에서 `project.resources` 의존 제거 — step 1 (DbSelectionCard) 데이터를 `getConfirmResources` (catalog) 호출로 직접 fetch
4. `loadAzureResources` 의 4-API 병합 / `buildAzureOwnedResources` 의 4-source fallback 폐기 (step 1 catalog 호출만 남김 또는 단순화)
5. `loadGcpResources` 의 2-API 병합 폐기 (step 1 catalog 단독)
6. (Phase 2 에서 처리하지 않은 경우) `ResourceTransitionPanel` 의 데이터 소스를 `getApprovedIntegration` 으로 교체

## Precondition

```bash
cd /Users/study/pii-agent-demo
git fetch origin main

# Phase 1, 2, 3 머지 확인
for phase in resource-mock-fix integration-target-info-card process-status-confirmed-cleanup; do
  git log origin/main --oneline -50 | grep -i "$phase" || \
    { echo "✗ Phase '$phase' not merged"; exit 1; }
done
```

⚠️ 본 phase 는 가장 영향 범위가 크며 실제 회귀 위험도 가장 높음. dev 환경 + admin 페이지 + 3 provider 페이지 step 1-7 전 시나리오 수동 검증 필수.

## Step 1 — Worktree

```bash
bash scripts/create-worktree.sh --topic project-resources-removal --prefix refactor
cd /Users/study/pii-agent-demo-project-resources-removal
```

## Step 2 — Required reading

1. `docs/reports/resource-data-source-audit-2026-04-23.md` §2.2.1 (전수 사용처 표), §4.3
2. `lib/types.ts:236-269` (Project 인터페이스)
3. `lib/target-source-response.ts:160-230` (normalizeTargetSource / extractTargetSource)
4. `app/integration/target-sources/[targetSourceId]/_components/aws/AwsProjectPage.tsx` 전체
5. `app/integration/target-sources/[targetSourceId]/_components/azure/AzureProjectPage.tsx` 전체
6. `app/integration/target-sources/[targetSourceId]/_components/gcp/GcpProjectPage.tsx` 전체
7. `lib/azure-resource-ownership.ts` 전체
8. `app/lib/api/index.ts:217-240` (`getConfirmResources` / `ConfirmResourceItem`)
9. `app/components/features/scan/DbSelectionCard.tsx` (resources prop 사용 패턴)
10. `app/components/features/process-status/ResourceTransitionPanel.tsx` (Phase 2 미수정 시 본 phase 에서 처리)

## Step 3 — Implementation

### 3-1. AWS 페이지 — catalog fetch 도입

`AwsProjectPage.tsx`:

- `useState<ConfirmResourceItem[]>(...)` + `useState` loading/error/loaded 추가
- `useEffect` 에서 step ≤ 2 일 때만 `getConfirmResources(project.targetSourceId)` 호출 (step 3+ 는 신규 카드 / ResourceTransitionPanel 이 자체 fetch)
- `selectedIds` 초기값: catalog 응답 후 derive (혹은 `[]` 으로 시작 후 catalog 도착 시 setSelectedIds 적용)
- `vmConfigs` 초기값: catalog 응답 후 build
- `approvalResources` / `handleConfirmTargets` / `handleApprovalSubmit`: `project.resources` → `catalog` 또는 `resources state` 로 교체
- `<ProcessStatusCard resources={...}>` 의 prop 출처: catalog state 사용. 단 `selectedResources` 파생을 위해서는 `isSelected` 필드가 필요 — catalog `ConfirmResourceItem` 에는 isSelected 가 없음. 따라서 `resources state` 는 `Resource[]` 형태여야 함 (= 직접 변환).

→ AWS 가 가장 까다로움. `ConfirmResourceItem` → `Resource` 변환 헬퍼 도입 (GCP 의 `loadGcpResources:86-122` 참고하되 confirmed-integration 의존은 제거).

### 3-2. Azure 페이지 — `loadAzureResources` 단순화

기존 4 API Promise.all → step 1-2 일 때 `getConfirmResources` 만. `latestApprovalRequest` / `approvedIntegration` / `confirmedIntegration` state 와 그 사용처 제거.

`buildAzureOwnedResources` 단순화:
- `projectResources` / `latestApprovalRequest` / `approvedIntegration` / `confirmedIntegration` 인풋 모두 제거
- `catalog` + (사용자 액션 기반 selection state) 만으로 reduce
- `resolveSelectionState` 제거 (또는 단순한 catalog → `Resource[]` mapper 만 남김)

테스트 파일이 있다면 (`lib/__tests__/azure-resource-ownership.test.ts` 등) 함께 정리.

### 3-3. GCP 페이지 — `loadGcpResources` 단순화

`getConfirmResources` 만 호출. `getConfirmedIntegration` 호출 제거. `convertedResources` 매핑에서 `confirmedResourceInfo` 의존 제거 (`isSelected` / `selectedCredentialId` 는 catalog 단독 또는 `[]` 시작).

### 3-4. (Phase 2 미처리 시) `ResourceTransitionPanel` 데이터 소스 교체

`getConfirmedIntegration` → `getApprovedIntegration` 으로 교체.
- snapshot 형식 변환 헬퍼 (`snapshotToResources`) 의 입력 타입 조정
- "기존 vs 신규" 비교 의도였다면 그 로직은 제거 (approved-integration 단독 표시)

### 3-5. 타입 / normalizer 제거

`lib/types.ts:244` — `resources: Resource[];` 필드 삭제.

`lib/target-source-response.ts:214` — `resources: ...` 라인 삭제.

이로 인한 컴파일 에러는 위 3-1 ~ 3-4 의 변경으로 모두 해소되어야 함. 잔존 에러는:

```bash
npx tsc --noEmit 2>&1 | grep "Property 'resources' does not exist on type 'Project'"
```

→ 발견되는 사이트마다 catalog fetch 또는 다른 데이터 소스로 전환.

### 3-6. Mock `mockTargetSources.get` — 잔여 정리

Phase 1 에서 이미 `toIssue222TargetSourceInfo` 통과하도록 수정됨. 본 phase 에서는 변경 없음. 단 정합성 검사:
```bash
grep -n "targetSource.*resources\|targetSource\[.resources.\]" lib/ app/ \
  --include="*.ts" --include="*.tsx" -r | grep -v ".test."
# → 기대: 0 hit
```

### 3-7. IDC / SDU — 손대지 않음

`IdcProjectPage` / `IdcProcessStatusCard` 의 `project.resources` 사용은 **본 phase 범위 밖**. 이들은 별도 wave 에서 처리.

→ Phase 4 가 `Project.resources` 필드를 제거하면 IDC 코드도 컴파일 에러. 옵션:

- (A) `Project` 가 아닌 `IdcProject` 같은 별도 타입을 정의하고 IDC 만 그 타입 사용
- (B) `Project` 에 `resources` 를 deprecated 로 남기고 본 phase 는 cloud provider (AWS/Azure/GCP) 만 cleanup
- (C) IDC 도 같은 wave 에 포함

**권장: (B)**. 타입 시그니처를 deprecated comment 로 표시하되 필드는 남기고, AWS/Azure/GCP 코드의 의존만 제거. 별도 IDC wave 후 (B) → (A) 전환.

```ts
export interface Project {
  ...
  /** @deprecated IDC/SDU 만 사용. AWS/Azure/GCP 는 catalog API 로 fetch. 별도 wave 에서 IDC 도 분리 예정. */
  resources: Resource[];
  ...
}
```

이 절충은 spec 외 의사결정이므로 PR description 에 명시. 반대로 (A)/(C) 를 선택하면 spec 자체 갱신 후 진행.

## Step 4 — Do NOT touch

- `IntegrationTargetInfoCard` (Phase 2 도입) → 데이터 소스 자체 fetch 이미 OK
- `ProcessStatusCard` (Phase 3 정리 완료) → `resources` prop 출처만 catalog 로 변경, useEffect 추가 금지
- Mock store 내부 (`lib/api-client/mock/projects.ts` / `confirm.ts` 의 `project.resources` 사용은 도메인 모델로 정상)
- IDC / SDU 페이지

## Step 5 — Verify

```bash
npx tsc --noEmit
npm run lint -- app/integration/target-sources/[targetSourceId]/_components/ \
  lib/types.ts lib/target-source-response.ts lib/azure-resource-ownership.ts
npm run build
npm test 2>&1 | tail -50

# project.resources 사용처 검사 — IDC 만 남아야 함
grep -rn "project\.resources\b" app/ --include="*.ts" --include="*.tsx" | grep -v ".test."
# → 기대: idc/IdcProjectPage.tsx, idc/IdcProcessStatusCard.tsx 만 hit
```

수동 (3 provider × 7 step):
1. `bash scripts/dev.sh /Users/study/pii-agent-demo-project-resources-removal`
2. AWS / Azure / GCP 각각:
   - step 1: DbSelectionCard 렌더, 카탈로그 API 호출 1회
   - step 2: DbSelectionCard 잠금 또는 공백, **API 호출 0회**
   - step 3: ResourceTransitionPanel 렌더, approved-integration API 호출 1회 (Phase 2 에서 미처리 시 본 phase 에서 처리)
   - step 4-7: IntegrationTargetInfoCard 렌더, confirmed-integration API 호출 1회
   - step 1 → 2 → 4 등 step 전이 시 중복 호출 없음

3. Admin `/integration/admin`:
   - step 1-3 TS: 펼치기 비활성
   - step 4-7 TS 펼치기 → confirmed-integration 1회, 표 정상

## Step 6 — Commit / push / PR

```
refactor(target-sources): Project.resources 폐기 + provider 페이지 catalog 호출 전환 (project-resources-removal)

근거: docs/reports/resource-data-source-audit-2026-04-23.md §2.1-§2.5, §4.3, §4.5.

- AWS / Azure / GCP provider 페이지: project.resources 의존 제거, getConfirmResources(catalog) 자체 fetch
- loadAzureResources 4-API 병합 폐기, buildAzureOwnedResources 단순화 (또는 제거)
- loadGcpResources 2-API 병합 폐기
- (Phase 2 미처리 시) ResourceTransitionPanel 데이터 소스 → getApprovedIntegration
- Project.resources 필드: deprecated 마킹 후 IDC/SDU 만 사용 (또는 완전 제거 — 의사결정 PR description)
- target-source-response.ts normalizer 의 resources 필드 제거

Out of scope:
- IDC / SDU 페이지 정리 (별도 wave)
- Project.resources 완전 삭제 (IDC/SDU 분리 후 별도 wave)
```

## Step 7 — Self-review

`/sit-recurring-checks`, `/simplify`, `/vercel-react-best-practices` 순차. 본 phase 는 영향 범위가 커서 self-review 후 `/pr-context-review` 도 명시적으로 수행.

## Return (under 200 words)

1. PR URL
2. tsc / lint / build / test 결과
3. `project.resources` 잔존 사용처 (IDC 외 0 인지)
4. 3 provider × 7 step 수동 검증 매트릭스 (각 셀 PASS/FAIL)
5. Spec 대비 deviation (Project.resources 완전 제거 / deprecated 절충 / IDC 분리 등 의사결정)
