# Phase 4 — `Project.resources` 폐기 + provider 페이지 catalog 호출 전환

## Context

- 감사 문서: `docs/reports/resource-data-source-audit-2026-04-23.md` §2.1, §2.2, §2.3, §2.4, §2.5, §4.3, §4.5
- 의존: **Phase 1, 2, 3 모두 머지 완료 후 시작.** 신규 카드(P2) + ProcessStatusCard 정리(P3) 가 끝나야 `project.resources` 의존이 step 1 영역으로 좁혀짐.

## Goal

**본 phase 의 확정된 Done 정의** — `Project.resources` 필드는 **제거하지 않음 (유지, deprecated 마킹)**. AWS/Azure/GCP 코드에서만 의존을 제거. IDC/SDU 는 별도 wave 에서 정리. 타입 제거는 IDC/SDU wave 머지 후 별도 "final removal" wave 에서.

### 확정 정책: 단계적 폐기 — 이번 phase 의 범위

| 항목 | 본 phase 에서 처리 | 나중 wave 에서 처리 |
|---|---|---|
| `Project.resources` 타입 필드 | `@deprecated` JSDoc 마킹 | IDC/SDU wave 후 final removal wave 에서 실제 삭제 |
| `lib/target-source-response.ts:214` normalize | 유지 (IDC/SDU 가 여전히 사용) | 최종 wave 에서 삭제 |
| AWS/Azure/GCP provider 페이지의 `project.resources` 사용 | **모두 제거** (catalog 직접 fetch 로 전환) | — |
| IDC / SDU 의 `project.resources` 사용 | 건드리지 않음 | 별도 IDC/SDU wave |
| `loadAzureResources` 4-API 병합 | **폐기 or step 1 catalog 단독으로 단순화** | — |
| `loadGcpResources` 2-API 병합 | **폐기 or step 1 catalog 단독으로 단순화** | — |
| `buildAzureOwnedResources` 4-source fallback | **폐기 또는 catalog-only mapper 로 단순화** | — |
| `ResourceTransitionPanel` 데이터 소스 | `getApprovedIntegration` 으로 교체 | — |
| `mockTargetSources.get` 의 Project 누설 차단 | Phase 1 에서 이동됨 → **본 phase 에서 처리** | — |

### 왜 "필드 제거" 가 아니라 "deprecated 마킹" 인가

감사 문서 초안에서는 "제거" 로 표현했지만 실행 시점에 재평가 결과:

1. IDC / SDU 는 catalog API 가 없고 (`lib/issue-222-approval.ts` / `lib/issue-222-target-source.ts` 에도 IDC/SDU 라우트 없음), `project.resources` 외에 대체 데이터 소스가 바로 없음.
2. 본 phase 에서 IDC/SDU 까지 강제로 같이 다루면 범위가 커지고, 사용자 정책 ("IDC/SDU 는 범위 밖") 에도 어긋남.
3. 타입 필드를 남기되 "구버전 호환" 용도로 제한함을 `@deprecated` + 주석으로 명시. Type-level safety 는 소실되지만, linter / IDE hint 로 점진적 마이그레이션 유도.
4. IDC/SDU 가 정리된 뒤 별도 final removal wave 에서 타입 / normalizer / mock get 의 resources 필드를 함께 삭제. PR description 에 명시 + follow-up issue 생성 권장.

`Project` 인터페이스에 다음 형태로 남김:

```ts
export interface Project {
  ...
  /**
   * @deprecated AWS/Azure/GCP 는 step 별 전용 API 사용. IDC/SDU 만 사용.
   *   별도 wave 에서 IDC/SDU 를 전용 타입으로 분리한 뒤 완전 제거.
   *   신규 코드에서 참조 금지.
   */
  resources: Resource[];
  ...
}
```

`target-source-response.ts:214` 의 normalize 도 동일 이유로 유지.
`mockTargetSources.get` 누설 차단은 본 phase 의 필수 항목으로 이동 (Phase 1 에서 swagger contract 이슈로 deferred 된 부분).

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

Phase 1 의 `fix/resource-mock-fix` PR 에서 분석 결과 `mockTargetSources.get` 누설 차단은 Phase 4 에서 처리하기로 확정됨 (이유: swagger `ClientTargetSourceDetail` 가 `resources` 를 required 로 정의하고 있고, `toIssue222TargetSourceInfo` 가 AWS/GCP 식별자 필드 (`awsAccountId` / `gcpProjectId`) 및 `id` / `status` / `terraformState` / `isRejected` 누락). 본 phase 에서:

1. `lib/api-client/mock/target-sources.ts` 의 `toIssue222TargetSourceInfo` 확장 — AWS/GCP 식별자 + `status` + `terraformState` + `isRejected` + `id` 포함. `resources` 만 제외.
2. `mockTargetSources.get` 을 이 확장된 변환기로 통과시킴.
3. `lib/target-source-response.ts` 의 normalizer 에 AWS/GCP 식별자 읽기 로직 추가 (metadata 에서도 읽도록).
4. `docs/swagger/issue-222-client.yaml` 의 `ClientTargetSourceDetail` 에서 `resources` 를 `required` 에서 제거하고 "deprecated" 명시. 단 삭제는 하지 않음 (IDC/SDU 가 여전히 사용).

정합성 검사:
```bash
grep -rn "targetSource.*resources\|targetSource\[.resources.\]" lib/ app/ \
  --include="*.ts" --include="*.tsx" | grep -v ".test."
# → 기대: IDC/SDU 관련 사이트만 hit (normalizer fallback path 로 넘겨지는 경로)
```

### 3-7. IDC / SDU — 손대지 않음 (본 phase 범위 밖)

`IdcProjectPage.tsx:202-204` / `IdcProcessStatusCard.tsx:359,385` 는 본 phase 에서 변경하지 않음. 이들은 별도 IDC/SDU wave 에서 정리.

**본 phase 의 IDC/SDU 호환성 유지 방식** (§ Goal 의 "단계적 폐기" 참고):

- `Project.resources` 타입 필드는 **삭제하지 않음**. `@deprecated` JSDoc 만 추가:
  ```ts
  export interface Project {
    ...
    /**
     * @deprecated AWS/Azure/GCP 는 step 별 전용 API 사용. IDC/SDU 만 사용.
     *   별도 wave 에서 IDC/SDU 를 전용 타입으로 분리한 뒤 완전 제거.
     *   신규 코드에서 참조 금지.
     */
    resources: Resource[];
    ...
  }
  ```

- `lib/target-source-response.ts` 의 normalize 에서도 `resources` 라인 유지 (IDC/SDU normalize 호환).

- 단, AWS/Azure/GCP 코드에서는 `project.resources` 호출이 모두 제거됨 (3-1~3-5 에 의거).

### 후속 wave (본 PR 범위 밖)

1. **IDC/SDU 전용 타입 분리 wave**: `IdcProject` / `SduProject` 타입 정의 + IDC/SDU 라우트에서 사용. `Project.resources` 의존을 IDC/SDU 에서도 제거.
2. **Final removal wave** (위 1 머지 후): `Project.resources` 필드 / normalizer 라인 / swagger `resources` 필드 실제 삭제. `mockTargetSources.get` / `mockProjects.get` 의 내부 구현도 정비.

PR description 에 follow-up issue 링크 명시 권장.

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
refactor(target-sources): AWS/Azure/GCP 의 project.resources 의존 제거 + step 별 API 분리 (project-resources-removal)

근거: docs/reports/resource-data-source-audit-2026-04-23.md §2.1-§2.5, §4.3, §4.5.

Done 정의:
- AWS / Azure / GCP provider 페이지: project.resources 의존 전부 제거,
  getConfirmResources(catalog) 자체 fetch 로 전환
- loadAzureResources 4-API 병합 폐기 또는 step 1 catalog 단독으로 단순화
- buildAzureOwnedResources: catalog-only mapper 로 단순화 (4-source fallback 폐기)
- loadGcpResources 2-API 병합 폐기 또는 step 1 catalog 단독
- ResourceTransitionPanel 데이터 소스를 getApprovedIntegration 으로 교체
- mockTargetSources.get 의 Project 누설 차단 (toIssue222TargetSourceInfo 확장 +
  AWS/GCP 식별자 / status / terraformState / id 포함, resources 만 제외)
- target-source-response.ts normalizer 에 AWS/GCP 식별자 읽기 로직 추가
- swagger ClientTargetSourceDetail 의 resources 를 required 에서 제거 (deprecated)
- Project.resources 타입 필드: @deprecated JSDoc 마킹 (IDC/SDU 호환 유지 위해 삭제 X)

Out of scope — 별도 wave:
- IDC / SDU 페이지의 project.resources 사용 제거 → 별도 IDC/SDU wave
- Project.resources 완전 삭제 → 위 wave 머지 후 final removal wave
```

## Step 7 — Self-review

`/sit-recurring-checks`, `/simplify`, `/vercel-react-best-practices` 순차. 본 phase 는 영향 범위가 커서 self-review 후 `/pr-context-review` 도 명시적으로 수행.

## Return (under 200 words)

1. PR URL
2. tsc / lint / build / test 결과
3. `project.resources` 잔존 사용처 (IDC 외 0 인지)
4. 3 provider × 7 step 수동 검증 매트릭스 (각 셀 PASS/FAIL)
5. Spec 대비 deviation (Project.resources 완전 제거 / deprecated 절충 / IDC 분리 등 의사결정)
