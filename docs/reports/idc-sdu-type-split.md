# IDC / SDU 타입 분리 wave

> `Project` 인터페이스에서 `resources: Resource[]` 의존을 IDC / SDU 측에서도 제거하기 위해, provider 전용 타입 (`IdcProject`, `SduProject`) 을 분리.
>
> **Phase 4 (`project-resources-removal`) 머지 완료 후 시작.**
>
> 이 wave 머지 후 "final removal wave" 에서 `Project.resources` 필드 / normalizer 라인 / swagger `resources` 필드 실제 삭제.

## Context

### 현재 상태 (본 wave 시작 시점 기대치)

`Project.resources` 는 Phase 4 에서 `@deprecated` JSDoc 마킹만 된 채 남아있음. AWS/Azure/GCP 는 `project.resources` 를 더 이상 사용하지 않지만 IDC/SDU 가 여전히 사용 중:

| 파일 | 라인 | 용도 |
|---|---|---|
| `app/integration/target-sources/[targetSourceId]/_components/idc/IdcProjectPage.tsx` | 202, 204 | 비편집 모드에서 `IdcResourceTable` 데이터 |
| `app/integration/target-sources/[targetSourceId]/_components/idc/IdcProcessStatusCard.tsx` | 359 | 선택된 리소스 필터 (`isSelected`) |
| `app/integration/target-sources/[targetSourceId]/_components/idc/IdcProcessStatusCard.tsx` | 385 | 방화벽 가이드 렌더 데이터 |

SDU 는 현재 `project.resources` 를 직접 쓰지 않지만 `Project` 타입을 prop 으로 받고 있어 타입 분리 대상에 포함.

### 왜 분리해야 하는가

1. `Project.resources` 필드의 `@deprecated` 마킹이 점진적 제거를 유도해야 하는데, IDC/SDU 가 유일한 소비자로 남아있으면 타입 자체를 지울 수 없음.
2. IDC / SDU 는 cloud provider 와 도메인 모델이 본질적으로 다름 (cloud scan 없음, catalog API 없음, provider 식별자 없음). `Project` 하나로 묶여있으면 AWS/Azure/GCP 용 필드 (`awsAccountId`, `subscriptionId`, `gcpProjectId`, `terraformState.serviceTf` 등) 가 IDC/SDU prop 에도 노출되어 혼란.
3. `ResourceCatalogItem` / `ConfirmedIntegrationResourceInfo` 기반의 step 별 API 체계를 cloud provider 3종 이 따르고 있는데, IDC/SDU 는 고유의 리소스 등록 플로우 (수동 입력) 가 있어 타입으로 분리하는 게 자연스러움.

## Goal

1. `IdcProject` / `SduProject` 전용 타입 정의. `Project` 와 공통 필드는 상위 `BaseProject` 로 추출 or 복사. Resources 는 IDC 에만 포함.
2. IDC / SDU 라우트 (`app/integration/target-sources/[targetSourceId]/_components/idc/*`, `.../sdu/*`) 와 상위 라우팅 (`app/integration/target-sources/[targetSourceId]/page.tsx` 또는 equivalent) 을 `IdcProject` / `SduProject` 로 내리기.
3. IDC 내부의 `project.resources` 사용처 3곳을 `idcProject.resources` (전용 필드) 로 치환.
4. `getProject` 의 반환 타입을 `Project | IdcProject | SduProject` union 으로 확장, 또는 cloud provider 별 분기 API 로 분할.

## Done 정의 (본 wave 한정)

| 항목 | 본 wave 에서 처리 | Final removal wave 에서 처리 |
|---|---|---|
| `IdcProject` / `SduProject` 타입 정의 | ✅ | — |
| IDC / SDU 페이지의 `project.resources` 사용 제거 | ✅ | — |
| `getProject` 반환 타입 분화 or union | ✅ | — |
| `Project.resources` 타입 필드 존재 여부 | `@deprecated` 유지, 삭제 X | 실제 삭제 |
| `lib/target-source-response.ts` normalize 의 `resources` 라인 | 유지 | 삭제 |
| `mockTargetSources.get` / `mockProjects.get` 의 resources 반환 | 유지 (IDC/SDU 만 consumer) | 삭제 |
| `docs/swagger/issue-222-client.yaml` 의 `ClientTargetSourceDetail.resources` | deprecated 유지 | 삭제 |

## Precondition

```bash
cd /Users/study/pii-agent-demo
git fetch origin main

# Phase 4 머지 확인
git log origin/main --oneline -30 | grep -i "project-resources-removal" || \
  { echo "✗ Phase 4 가 origin/main 에 머지되지 않음"; exit 1; }

# Phase 4 에서 project.resources 가 IDC 외에서 사라졌는지 확인
grep -rn "project\.resources\b" app/ --include="*.ts" --include="*.tsx" | grep -v ".test." | grep -v "/idc/" | grep -v "/sdu/"
# → 기대: 0 hit
```

## Step 1 — Worktree

```bash
bash scripts/create-worktree.sh --topic idc-sdu-type-split --prefix refactor
cd /Users/study/pii-agent-demo-idc-sdu-type-split
cp /Users/study/pii-agent-demo/.env.local .env.local
npm install
```

## Step 2 — Required reading

1. `docs/reports/resource-data-source-audit-2026-04-23.md` §2.2.2 (IDC 사용처)
2. `docs/reports/resource-data-source/phase4-project-resources-removal.md` § Done 정의 (deprecated 유지 이유)
3. `lib/types.ts:236-269` (`Project` 인터페이스 현재 상태)
4. `lib/target-source-response.ts:60-230` (normalizer + `isProject`)
5. `app/integration/target-sources/[targetSourceId]/_components/idc/IdcProjectPage.tsx` 전체
6. `app/integration/target-sources/[targetSourceId]/_components/idc/IdcProcessStatusCard.tsx:140-200, 274-390` (FirewallGuide + 렌더링)
7. `app/integration/target-sources/[targetSourceId]/_components/sdu/SduProjectPage.tsx` 전체
8. `app/integration/target-sources/[targetSourceId]/_components/sdu/SduProcessStatusCard.tsx`
9. `app/integration/target-sources/[targetSourceId]/page.tsx` (or wherever the provider-based branching happens)
10. `app/lib/api/index.ts:184-189` (`getProject`)
11. `lib/issue-222-target-source.ts` (cloud provider enum, IDC/UNKNOWN 처리)

## Step 3 — Implementation

### 3-1. 타입 정의 — `BaseTargetSource` / `CloudTargetSource` / `IdcTargetSource` / `SduTargetSource`

**제안 형태** (`lib/types.ts`):

```ts
export interface BaseTargetSource {
  id: string;
  targetSourceId: number;
  projectCode: string;
  serviceCode: string;
  processStatus: ProcessStatus;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  name: string;
  description: string;
  isRejected: boolean;
  rejectionReason?: string;
  approvalComment?: string;
  approvedAt?: string;
  piiAgentInstalled?: boolean;
  piiAgentConnectedAt?: string;
  completionConfirmedAt?: string;
}

export interface CloudTargetSource extends BaseTargetSource {
  cloudProvider: 'AWS' | 'Azure' | 'GCP';
  terraformState: TerraformState;
  // cloud provider 별 식별자
  awsAccountId?: string;
  awsRegionType?: 'global' | 'china';
  awsInstallationMode?: AwsInstallationMode;
  tenantId?: string;
  subscriptionId?: string;
  gcpProjectId?: string;
  // AWS/Azure/GCP 는 resources 를 step 별 API 로 fetch — 타입에 없음
}

export interface IdcTargetSource extends BaseTargetSource {
  cloudProvider: 'IDC';
  terraformState: TerraformState;
  resources: Resource[];  // ← IDC 에만 존재
}

export interface SduTargetSource extends BaseTargetSource {
  cloudProvider: 'SDU';
  terraformState: TerraformState;
  // SDU 는 resources 사용 안 함 — 타입에 없음
}

export type TargetSource = CloudTargetSource | IdcTargetSource | SduTargetSource;

/** @deprecated TargetSource union 으로 마이그레이션 중. 신규 코드에서 사용 금지. */
export type Project = TargetSource & { resources: Resource[] };
```

⚠ 주의:
- 기존 `Project` alias 를 당분간 유지해 호환성 확보 (AWS/Azure/GCP 페이지가 아직 `Project` 를 import 중이면).
- `TargetSource` 를 정식 이름으로 하되, 기존 consumer 호환을 위해 `Project` 는 alias 로 남기고 본 wave 에서 실제 호출부를 `TargetSource` / `IdcTargetSource` / `SduTargetSource` 로 이전.

### 3-2. `lib/target-source-response.ts` normalizer 분화

- `isProject` → `isIdcTargetSource` / `isSduTargetSource` / `isCloudTargetSource` 로 분할 or discriminated check 추가.
- `normalizeTargetSource` 가 `cloudProvider` 값을 보고 적절한 `TargetSource` 서브타입 리턴.
- IDC 만 `resources: Array.isArray(value.resources) ? ... : []` 유지. Cloud/SDU 는 resources 필드 제거.
- Cloud provider 별 식별자 (`awsAccountId` 등) 는 기존대로 normalizer 에서 읽되, 타입에 맞춰 `CloudTargetSource` 에만 할당.

### 3-3. `getProject` API 타입 변경

```ts
export const getProject = async (targetSourceId: number): Promise<TargetSource> => {
  ...
};
```

- 반환 타입을 `Project` → `TargetSource` 로. Consumer 에서 discriminated union 기반 narrowing.
- 라우팅 레이어 (`app/integration/target-sources/[targetSourceId]/page.tsx` 또는 `target-source client component`) 에서 `targetSource.cloudProvider` 로 분기해 `IdcProjectPage` / `SduProjectPage` / 3 cloud provider 페이지에 각각 narrowed type 전달.

### 3-4. IDC 페이지 마이그레이션

`IdcProjectPage.tsx` / `IdcProcessStatusCard.tsx`:

- `project: Project` → `project: IdcTargetSource` (prop 타입 변경).
- `project.resources` 는 그대로 사용 가능 (타입이 `IdcTargetSource` 라서 resources 필드 존재).
- `onProjectUpdate: (project: Project) => void` → `onProjectUpdate: (project: IdcTargetSource) => void`.
- `getProject` 반환 타입이 union 이므로 IDC 페이지 내부에서 narrowing 또는 라우팅 레이어에서 분기 + narrowed 타입으로 내려받음.

### 3-5. SDU 페이지 마이그레이션

`SduProjectPage.tsx` / `SduProcessStatusCard.tsx`:

- `project: Project` → `project: SduTargetSource`.
- SDU 는 `resources` 를 쓰지 않으므로 변경 거의 없음. 타입만 교체.
- `onProjectUpdate` 시그니처 갱신.

### 3-6. AWS/Azure/GCP 페이지 — 부수 마이그레이션

- `project: Project` → `project: CloudTargetSource` (또는 `CloudTargetSource & { cloudProvider: 'AWS' }` 같은 narrowing).
- `project.resources` 사용은 이미 Phase 4 에서 제거됨 → 타입 교체만.

### 3-7. Mock 쪽 유지

`lib/api-client/mock/target-sources.ts` / `lib/api-client/mock/projects.ts` / `lib/api-client/mock/confirm.ts` 등의 내부는 `Project` (= `TargetSource & { resources: Resource[] }`) 로 계속 취급. 내부 도메인 모델에는 resources 가 있어야 mock 시뮬레이션이 가능 (스캔 결과 저장, 승인 요청 처리 등).

외부 응답 shape 는 이미 Phase 4 에서 정리됨 (`toIssue222TargetSourceInfo` 가 cloud provider 에는 resources 를 내보내지 않음). IDC/SDU 응답 변환은 이번 wave 에서 추가로 정리 필요:

- Cloud target-sources: `toIssue222TargetSourceInfo(project)` 그대로 → `resources` 없음 (이미 Phase 4).
- IDC target-sources: 전용 변환기 (`toIdcTargetSource`) 추가 — `resources` 포함.
- SDU target-sources: 전용 변환기 (`toSduTargetSource`) 추가 — `resources` 없음.

### 3-8. 검증 쿼리

```bash
# Project 타입 직접 참조 사이트 (TargetSource union 으로 마이그레이션 되어야 함)
grep -rn "import.*Project\b\|: Project\b\|Project\[" app/ --include="*.ts" --include="*.tsx" | grep -v ".test." | grep -v "@/lib/types"
# → 기대: AWS/Azure/GCP 페이지는 CloudTargetSource, IDC 페이지는 IdcTargetSource, SDU 페이지는 SduTargetSource 로 교체된 상태

# project.resources 사용처
grep -rn "project\.resources\b" app/ --include="*.ts" --include="*.tsx" | grep -v ".test."
# → 기대: IDC 만 hit
```

## Step 4 — Do NOT touch

- `Project.resources` 타입 필드 자체 삭제 (Final removal wave)
- `lib/target-source-response.ts` normalizer 의 resources 라인 삭제 (Final removal wave)
- `mockTargetSources.get` / `mockProjects.get` 의 내부 도메인 모델 구조 (mock 내부는 `resources` 를 계속 써야 함)
- `docs/swagger/issue-222-client.yaml` 의 resources 필드 삭제 (Final removal wave)

## Step 5 — Verify

```bash
npx tsc --noEmit
npm run lint -- lib/types.ts lib/target-source-response.ts app/integration/target-sources/
npm run build
npm test 2>&1 | tail -30
```

### 타입 정합성 grep

```bash
# 신규 타입 정의 확인
grep -n "^export interface Idc\|^export interface Sdu\|^export interface Cloud\|^export type TargetSource" lib/types.ts

# Project alias 는 deprecated 로 유지
grep -n "@deprecated.*Project\b\|export type Project\b\|export interface Project\b" lib/types.ts
```

### 수동 검증

1. `bash scripts/dev.sh /Users/study/pii-agent-demo-idc-sdu-type-split`
2. IDC TargetSource 진입 → 렌더 정상, 리소스 추가/편집/제거 시나리오 회귀 없음
3. SDU TargetSource 진입 → 렌더 정상, 설치 / connection-test / S3 upload 플로우 회귀 없음
4. AWS/Azure/GCP TargetSource 진입 → step 1-7 전 범위 회귀 없음 (타입 narrowing 이 맞게 작동하는지)

## Step 6 — Commit / push / PR

```
refactor(target-sources): IdcTargetSource / SduTargetSource / CloudTargetSource 분리 (idc-sdu-type-split)

근거: docs/reports/resource-data-source/phase4-project-resources-removal.md § Done 정의 (후속 wave).

- lib/types.ts: BaseTargetSource / CloudTargetSource / IdcTargetSource / SduTargetSource / TargetSource union 정의. Project 는 deprecated alias 로 유지 (Final removal wave 까지).
- lib/target-source-response.ts: normalizer 분화 (cloudProvider 기반 discriminated return).
- app/lib/api/index.ts: getProject 반환 타입 Project → TargetSource.
- IDC/SDU 페이지 prop 타입 마이그레이션.
- AWS/Azure/GCP 페이지 prop 타입 마이그레이션 (CloudTargetSource 로 narrow).
- Mock 응답 변환기에 toIdcTargetSource / toSduTargetSource 추가.

Project.resources 타입 필드 / normalizer 라인 / swagger 는 Final removal wave 에서 실제 삭제.
Mock 내부 도메인 모델은 계속 resources 포함 (시뮬레이션용).
```

## Step 7 — Self-review

`/sit-recurring-checks` → `/simplify` → `/vercel-react-best-practices` 순차. TypeScript 타입 정의 변경이 광범위하므로 `/pr-context-review` 를 `--max-review-loops 2` 로 실행.

## Return (under 300 words)

1. PR URL
2. `tsc` / `lint` / `build` / `test` 결과
3. 신규 타입 정의 수 + 변경 파일 수
4. `project.resources` 잔존 사용처 (IDC 만 hit 인지)
5. `import.*Project` 잔존 사용처 (deprecated alias 사용 최소화 확인)
6. 수동 검증 매트릭스 (AWS / Azure / GCP / IDC / SDU × 주요 플로우)
7. `/pr-context-review` 결과 (iteration 횟수 + applied/deferred)
8. Spec deviation 목록 (Project alias 유지 범위 / narrowing 패턴 선택 등)

## 후속 wave

**Final removal wave**: 본 wave 머지 + stabilization 후
- `Project.resources` 타입 필드 삭제
- `Project` deprecated alias 삭제
- `lib/target-source-response.ts` normalizer 의 resources 라인 삭제
- `mockTargetSources.get` / `mockProjects.get` 의 resources 반환 제거 (단, mock 내부 도메인 모델은 유지)
- `docs/swagger/issue-222-client.yaml` 의 `ClientTargetSourceDetail.resources` 삭제
