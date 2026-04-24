# 리소스 데이터 소스 감사 — 2026-04-23

> Provider 페이지(AWS / Azure / GCP)의 "리소스" 표시가 어디서 오는지 빠짐없이 감사하고, step 별 단일 데이터 소스 정책으로 재정렬하기 위한 분석 문서.
> IDC / SDU 는 이번 범위 밖 (현행 유지) — `IdcProjectPage` 와 `IdcProcessStatusCard` 의 `project.resources` 사용은 의도적으로 손대지 않음.

## 0. Executive Summary

**문제**

1. `Project.resources` 필드가 BFF 정식 응답 스펙(Issue 222) 에 없음에도 mock 의 `mockTargetSources.get` 이 내부 객체를 그대로 흘려서 클라가 "받아쓰고" 있음. UI 17+ 사이트가 이 누설된 값에 의존.
2. `loadAzureResources` / `loadGcpResources` 가 step 무관하게 4개/2개 API 를 Promise.all 로 부르고 결과를 builder 로 병합 → step 별로 어떤 API 가 진실인지 모호.
3. `ProcessStatusCard` 가 step 2/3 에서 `getConfirmedIntegration` 을 부름 (변경요청 배너용) — 신규 정책에 위반.
4. Admin `InfraCard` 가 step 무관하게 `getConfirmedIntegration` 을 부르고 404 를 폴백 없이 에러로 표시 → 모든 카드에서 항상 "확정 정보를 불러올 수 없어요".
5. **Mock 의 confirmed-integration 이 INSTALLING(step 4) 진입 시 채워지지 않음** — `getConfirmedIntegration` mock 은 `installation.status === 'COMPLETED'` AND `connectionStatus === 'CONNECTED'` 인 리소스만 반환. step 4-5 (INSTALLING / WAITING_CONNECTION_TEST) 에서 항상 EMPTY.

**신규 정책 (한 줄 요약)**

| Step | 데이터 소스 |
|---|---|
| 1 WAITING_TARGET_CONFIRMATION (연동 대상 DB 선택) | `GET /resources` |
| 2 WAITING_APPROVAL (승인 대기) | **호출 없음** (현 단계는 리소스 표시 자체를 보류) |
| 3 APPLYING_APPROVED (반영 중) | `GET /approved-integration` |
| 4-7 INSTALLING ~ INSTALLATION_COMPLETE (Agent 설치 이후) | `GET /confirmed-integration` |

이 외에는 어떤 컴포넌트도 "리소스 목록" 을 자체 추출/병합 해서는 안 됨.

---

## 1. 용어 / 데이터 소스 카탈로그

### 1.1 ProcessStatus (`lib/types.ts:5-13`)

| # | enum | 라벨 |
|---|---|---|
| 1 | `WAITING_TARGET_CONFIRMATION` | 연동 대상 확정 대기 (= "연동 대상 DB 선택") |
| 2 | `WAITING_APPROVAL` | 승인 대기 |
| 3 | `APPLYING_APPROVED` | 연동대상 반영 중 |
| 4 | `INSTALLING` | 설치 진행 중 (= "Agent 설치") |
| 5 | `WAITING_CONNECTION_TEST` | 연결 테스트 필요 |
| 6 | `CONNECTION_VERIFIED` | 연결 확인 완료 (관리자 확정 대기) |
| 7 | `INSTALLATION_COMPLETE` | 설치 완료 |

### 1.2 리소스 관련 API 카탈로그

| 함수 (app/lib/api/index.ts) | HTTP 경로 | 반환 형태 | 의미 |
|---|---|---|---|
| `getProject(targetSourceId)` | `GET /target-sources/{id}` | `Project` (스펙상 `resources` 없어야 함) | TargetSource 메타데이터 |
| `getConfirmResources(targetSourceId)` | `GET /target-sources/{id}/resources` | `{ resources: ConfirmResourceItem[] }` | provider 에서 스캔된 전체 리소스 카탈로그 |
| `getApprovalHistory(id, page, size)` | `GET /target-sources/{id}/approval-history` | `ApprovalHistoryResponse` | 승인 요청 페이지네이션 |
| `getApprovedIntegration(id)` | `GET /target-sources/{id}/approved-integration` | `ApprovedIntegrationResponse` | 승인 확정 스냅샷 (반영 중 단계의 "원본") |
| `getConfirmedIntegration(id)` | `GET /target-sources/{id}/confirmed-integration` | `ConfirmedIntegrationResponse` | 최종 확정된 연동 대상 |

---

## 2. 기존(As-Is) 정책

### 2.1 `project.resources` 의 출처와 누설 경로

**서버 측 정식 응답 변환기** `lib/api-client/mock/target-sources.ts:101-111`:

```ts
const toIssue222TargetSourceInfo = (project: Project) => ({
  targetSourceId, description, cloudProvider,
  createdAt, serviceCode, updatedAt,
  ...metadata
});  // ← resources 필드 없음 (정상)
```

**그러나 `get` 핸들러는 다른 경로를 탐** `lib/api-client/mock/target-sources.ts:142-147`:

```ts
get: async (targetSourceId) => {
  const response = await mockProjects.get(targetSourceId);
  const { project } = await response.json();
  return NextResponse.json({ targetSource: project });  // ← 내부 Project 그대로 노출
},
```

**클라 normalizer 가 받아옴** `lib/target-source-response.ts:214`:

```ts
resources: Array.isArray(value.resources)
  ? value.resources as Project['resources']
  : [],
```

**`Project` 인터페이스** `lib/types.ts:236-244`:

```ts
export interface Project {
  ...
  resources: Resource[];  // ← 스펙상 존재해서는 안 되는 필드
  ...
}
```

**작동 방식**

- Mock 모드: `mockProjects.get` 이 내부 Project 를 그대로 돌려주므로 `resources` 가 채워짐.
- 실제 BFF 모드: `GET /target-sources/{id}` 응답에 `resources` 가 없음 → `[]` 로 fallback. UI 가 빈 리스트로 깨짐.

→ **Mock 에서만 동작하는 비-스펙 의존**.

### 2.2 `project.resources` 사용처 — 전수

#### 2.2.1 Provider 페이지 (수정 대상)

| 파일 | 라인 | 용도 |
|---|---|---|
| `app/integration/target-sources/[targetSourceId]/_components/aws/AwsProjectPage.tsx` | 34 | `selectedIds` 초기화 (`isSelected` 인 리소스의 id 추출) |
| 〃 | 44 | `vmConfigs` 초기화 (각 리소스의 `vmDatabaseConfig` 추출) |
| 〃 | 58-59 | `approvalResources` 파생 (selectedIds 기반 `isSelected` 재계산) |
| 〃 | 107-110 | `handleConfirmTargets` — 선택된 VM 리소스 검증 (미설정 VM 경고) |
| 〃 | 125 | `handleApprovalSubmit` — 승인 요청 body 의 `resource_inputs` 빌드 |
| 〃 | 175 | `<ProcessStatusCard resources={project.resources}>` |
| 〃 | 194 | `<ResourceTransitionPanel resources={project.resources}>` (step 3) |
| 〃 | 206-209 | `<DbSelectionCard resources={project.resources.map(...)}>` (step 1, 2, 4-7 → 신규 정책상 step 4-7 분리 필요) |
| `app/integration/target-sources/[targetSourceId]/_components/azure/AzureProjectPage.tsx` | 180 | `buildAzureOwnedResources({ projectResources: project.resources, ... })` 의 입력. step 1 selection fallback (4순위) |
| `app/integration/target-sources/[targetSourceId]/_components/gcp/GcpProjectPage.tsx` | 50 | `selectedIds` 초기화 |
| 〃 | 59 | `vmConfigs` 초기화 |
| 〃 | 68 | `useState<Resource[]>(project.resources)` — `resources` 상태의 초기값 (직후 `loadGcpResources` 가 덮어씀) |

#### 2.2.2 IDC (이번 범위 밖, 참조용)

| 파일 | 라인 | 용도 |
|---|---|---|
| `app/integration/target-sources/[targetSourceId]/_components/idc/IdcProjectPage.tsx` | 202, 204 | 비편집 모드에서 IdcResourceTable 데이터 |
| `app/integration/target-sources/[targetSourceId]/_components/idc/IdcProcessStatusCard.tsx` | 359, 385 | 선택 리소스 / 방화벽 가이드 데이터 |

#### 2.2.3 서버측 mock 내부 (수정 불필요 — 내부 구현)

| 파일 | 갯수 | 비고 |
|---|---|---|
| `lib/api-client/mock/projects.ts` | 12 사이트 | mock store 내부 |
| `lib/api-client/mock/confirm.ts` | 11 사이트 | mock store 내부 |
| `lib/mock-azure.ts`, `mock-gcp.ts`, `mock-scan.ts` | 9 사이트 | mock seed/시뮬레이션 |

→ 서버측 mock 내부에서는 `Project` 가 도메인 모델로 정당하게 `resources: Resource[]` 를 가짐. 문제는 이 모델을 BFF 응답으로 그대로 외부에 흘리는 데 있음 (§2.1).

### 2.3 `loadAzureResources` — 4개 API 병합 (`AzureProjectPage.tsx:132-170`)

**호출 시점**: `useEffect(..., [loadAzureResources, currentStep, project.updatedAt])` → 페이지 진입 시 + step 변경 시 + project 업데이트 시 매번.

**호출 내역** (Promise.all):

| # | API | 폴백 |
|---|---|---|
| 1 | `getConfirmResources(id)` | 없음 (실패 시 throw) |
| 2 | `getApprovalHistory(id, 0, 1)` | `isMissingSnapshotError` → 빈 페이지 |
| 3 | `getApprovedIntegration(id)` | `isMissingSnapshotError` → `{ approved_integration: null }` |
| 4 | `getConfirmedIntegration(id)` | `isMissingSnapshotError` → `EMPTY_CONFIRMED_INTEGRATION` |

**결과 처리**: `buildAzureOwnedResources` (`lib/azure-resource-ownership.ts:253`) 가 4 입력을 받아 한 데이터 구조로 병합.

`resolveSelectionState` (`azure-resource-ownership.ts:198-251`) 의 selection 우선순위:

1. `approvedIntegration.size > 0` → approved-integration
2. `(WAITING_APPROVAL || APPLYING_APPROVED) && projectSelection.size > 0` → project-resources
3. `WAITING_APPROVAL && approvalHistorySelection.size > 0` → approval-history
4. `confirmedSelection.size > 0` → confirmed-integration
5. `projectSelection.size > 0` → project-resources (기본 폴백)
6. catalog only (empty)

→ 한 컴포넌트가 4개 source 를 알아서 병합하므로 **step 별 진실의 원천이 모호**.

### 2.4 `loadGcpResources` — 2개 API 병합 (`GcpProjectPage.tsx:72-134`)

**호출 시점**: `useEffect(..., [loadGcpResources])` — 페이지 진입 시 1회.

**호출 내역** (Promise.all):

| # | API |
|---|---|
| 1 | `getConfirmResources(id)` |
| 2 | `getConfirmedIntegration(id).catch(EMPTY)` |

**결과 처리** (`GcpProjectPage.tsx:86-122`): catalog 순회 → 각 리소스에 대해 `confirmedIntegrationResponse.resource_infos.find(...)` 조회 → `isSelected`/`selectedCredentialId` 주입. 즉 catalog + confirmed 의 inline merge.

→ confirmed-integration 을 step 무관하게 부르는 위반.

### 2.5 AWS 페이지 — `project.resources` 직접 의존

`AwsProjectPage` 는 별도 load 함수 없이 `project.resources` 를 그대로 모든 step 에서 사용. 즉:

- step 1 (선택 UI) — `project.resources` (=mock 누설값) 로 카탈로그 표시
- step 3 (반영 중) — `project.resources` 를 `ResourceTransitionPanel` 에 전달 (panel 내부에서 별도로 confirmed-integration 도 추가 fetch)
- step 4-7 — 동일하게 `project.resources` 전달

→ AWS 만 4-source 병합도, catalog API 호출도 안 함. **3 provider 가 서로 다른 패턴**.

### 2.6 `ProcessStatusCard` — step 2/3 에서 confirmed-integration 호출

`app/components/features/ProcessStatusCard.tsx:88-111`:

```ts
useEffect(() => {
  const needsConfirmedIntegration =
    currentStep === ProcessStatus.WAITING_APPROVAL
    || currentStep === ProcessStatus.APPLYING_APPROVED;
  if (!needsConfirmedIntegration || !project.targetSourceId) return;
  void getConfirmedIntegration(project.targetSourceId).then(...).catch(...);
}, [currentStep, project.targetSourceId]);
```

목적: `hasConfirmedIntegration` flag 로 `ApprovalWaitingCard` / `ApprovalApplyingBanner` 안에 "이미 확정된 연동이 있음" 변경요청 배너 노출 여부 결정.

→ 신규 정책 위반: step 2/3 에서 confirmed-integration 호출.

### 2.7 `ConfirmedIntegrationCollapse` — step 2/3 에서 펼침 시 호출

`app/components/features/process-status/ConfirmedIntegrationCollapse.tsx:21-34`:

`ApprovalWaitingCard` / `ApprovalApplyingBanner` 가 사용. 사용자가 "기존 확정 정보 보기" 버튼을 누르면 그제서야 `getConfirmedIntegration` 호출.

→ step 2/3 에서 user 액션으로 호출되는 호출.

### 2.8 `ResourceTransitionPanel` — step 3 에서 confirmed-integration 호출

`app/components/features/process-status/ResourceTransitionPanel.tsx:58-66`:

```ts
useEffect(() => {
  getConfirmedIntegration(targetSourceId)
    .then(...)
    .catch(() => setOldResources(null))
    .finally(() => setFetched(true));
}, [targetSourceId]);
```

용도: 변경요청 시 "기존 연동 리소스" vs "신규 연동 리소스" 비교 표 표시. Step 3 (`APPLYING_APPROVED`) 에서만 마운트되므로 신규 정책 위반.

### 2.9 Admin `InfraCard` — step 무관하게 호출 + 폴백 없음

`app/components/features/admin/infrastructure/InfraCard.tsx:34-49`:

```ts
const canExpand =
  project.cloudProvider !== 'IDC' && project.cloudProvider !== 'SDU' &&
  project.processStatus >= ProcessStatus.INSTALLING;  // step 4+

const fetchResources = async () => {
  setFetchState('loading');
  try {
    const res = await getConfirmedIntegration(project.targetSourceId);
    setConfirmedResources(res.resource_infos);
    setFetchState('idle');
  } catch {
    setConfirmedResources([]);
    setFetchState('error');  // ← 404 도 모두 에러로 표시
  }
};
```

**route 가 빈 응답을 404 로 변환** `app/integration/api/v1/target-sources/[targetSourceId]/confirmed-integration/route.ts:30-32`:

```ts
if (payload.resource_infos.length === 0) {
  return createNotFoundProblem(requestId);
}
```

→ Mock 한계 (§2.10) 와 합쳐져 step 4 진입 직후에도 404 → "확정 정보를 불러올 수 없어요" 가 항상 표시됨.

### 2.10 **Mock confirmed-integration 의 derive 조건** (이번에 새로 발견된 문제)

`lib/api-client/mock/confirm.ts:514-546`:

```ts
getConfirmedIntegration: async (targetSourceId) => {
  ...
  // 1. 변경 요청 중 보존된 이전 확정 스냅샷 확인
  const snapshot = confirmedIntegrationSnapshotStore.get(project.id);
  if (snapshot) return NextResponse.json(snapshot);

  // 2. 현재 프로젝트 상태에서 확정 정보 도출
  const activeResources = project.resources.filter(
    (r) => r.isSelected && r.connectionStatus === 'CONNECTED'
  );
  if (activeResources.length === 0
      || project.status.installation.status !== 'COMPLETED') {
    return NextResponse.json(createEmptyConfirmedIntegration());
  }
  return NextResponse.json({
    resource_infos: activeResources.map(toConfirmedIntegrationResourceInfo),
  });
},
```

**Snapshot 이 set 되는 경로** (단 1곳):
`lib/api-client/mock/confirm.ts:283-293` — **신규 approval request 생성 시점에**, 이미 `installation.status === 'COMPLETED'` 였다면 그 직전 confirmed 를 보존. 이건 "변경요청 → 기존 확정 비교용" 보존이지 "APPLYING → INSTALLING 전이 시 확정 채움" 이 아님.

**APPLYING → INSTALLING 자동 전이** (`lib/api-client/mock/confirm.ts:837-866`):
- 승인 후 20초 경과 → `installation.status: 'IN_PROGRESS'` 로 업데이트
- **`confirmedIntegrationSnapshotStore` 미수정**
- ApprovedIntegration → ConfirmedIntegration 마이그레이션 없음

**결과**: step 4 (INSTALLING), step 5 (WAITING_CONNECTION_TEST) 동안 `getConfirmedIntegration` 은 항상 EMPTY (혹은 변경요청 케이스라면 "이전" 스냅샷). 진짜 "이번 확정된 리소스" 는 step 6 (CONNECTION_VERIFIED, `installation.status === 'COMPLETED'` AND 일부 리소스 `connectionStatus === 'CONNECTED'`) 에 도달해야 비로소 채워짐.

**결론**: 신규 정책 ("step 4 부터 confirmed-integration 으로만 표시") 을 만족하려면 mock 도 함께 고쳐져야 함. APPLYING_APPROVED → INSTALLING 전이 시점에 `confirmedIntegrationSnapshotStore.set(project.id, {...approved 리소스...})` 하거나, derive 조건을 `installation.status !== 'PENDING'` (즉 IN_PROGRESS 부터 채움) 로 완화.

---

## 3. 기존 정책 — Step × Provider 매트릭스 (As-Is)

### 3.1 AWS

| Step | "리소스" 표시 컴포넌트 | 데이터 소스 | API 호출 |
|---|---|---|---|
| 1 WAITING_TARGET_CONFIRMATION | `DbSelectionCard` | `project.resources` (mock 누설값) | (없음 — `getProject` 응답에 묻어옴) |
| 2 WAITING_APPROVAL | `DbSelectionCard` (잠금) + `ProcessStatusCard` 내 `ConfirmedIntegrationCollapse` | `project.resources` + `confirmed-integration` | `getConfirmedIntegration` (변경요청 배너 + collapse) |
| 3 APPLYING_APPROVED | `ResourceTransitionPanel` | `project.resources` (신규) + `confirmed-integration` (기존 비교) | `getConfirmedIntegration` |
| 4 INSTALLING | `DbSelectionCard` (Run Infra Scan 노출됨) + `AwsInstallationInline` (selected) | `project.resources` | (없음) |
| 5 WAITING_CONNECTION_TEST | `DbSelectionCard` + `ConnectionTestPanel` (selected) | `project.resources` | (없음) |
| 6 CONNECTION_VERIFIED | `DbSelectionCard` + `ConnectionTestPanel` | `project.resources` | (없음) |
| 7 INSTALLATION_COMPLETE | `DbSelectionCard` + `ConnectionTestPanel` | `project.resources` | (없음) |

### 3.2 Azure

| Step | "리소스" 표시 컴포넌트 | 데이터 소스 | API 호출 |
|---|---|---|---|
| 1 | `DbSelectionCard` | `azureResources` (= `buildAzureOwnedResources` 산출물) | `loadAzureResources` × 4 API |
| 2 | `DbSelectionCard` (잠금) + `ProcessStatusCard` 내 `ConfirmedIntegrationCollapse` | `azureResources` + `confirmed-integration` | `loadAzureResources` × 4 API + `getConfirmedIntegration` (배너 + collapse) |
| 3 | `ResourceTransitionPanel` | `azureResources` (신규) + `confirmed-integration` (기존) | `loadAzureResources` × 4 API + `getConfirmedIntegration` |
| 4 | `DbSelectionCard` + `AzureInstallationInline` | `azureResources` | `loadAzureResources` × 4 API + Azure installation status |
| 5-7 | `DbSelectionCard` + `ConnectionTestPanel` | `azureResources` | `loadAzureResources` × 4 API |

### 3.3 GCP

| Step | "리소스" 표시 컴포넌트 | 데이터 소스 | API 호출 |
|---|---|---|---|
| 1 | `DbSelectionCard` | `resources` state (= catalog + confirmed merge) | `loadGcpResources` × 2 API |
| 2 | `DbSelectionCard` (잠금) + collapse | `resources` + confirmed-integration | `loadGcpResources` × 2 API + `getConfirmedIntegration` |
| 3 | `ResourceTransitionPanel` | `resources` + confirmed-integration | `loadGcpResources` × 2 API + `getConfirmedIntegration` |
| 4 | `DbSelectionCard` + `GcpInstallationInline` | `resources` | `loadGcpResources` × 2 API |
| 5-7 | `DbSelectionCard` + `ConnectionTestPanel` | `resources` | `loadGcpResources` × 2 API |

### 3.4 Admin (`/integration/admin`)

| 위치 | 호출 조건 | API | 현상 |
|---|---|---|---|
| `InfraCard` 카드 펼침 | `processStatus >= INSTALLING` | `getConfirmedIntegration` | 404 → "확정 정보를 불러올 수 없어요" 항상 표시 (Mock derive 조건 + route 의 empty→404 변환 합산) |

---

## 4. 신규(To-Be) 정책

### 4.1 핵심 원칙

1. **단계별 단일 데이터 소스**: 한 step 의 "리소스" 표시는 단 하나의 API 응답에서만 옴. 병합 금지.
2. **`Project.resources` 폐기**: 타입에서 제거 + mock 누설 차단 + UI 의존 제거.
3. **컴포넌트 = step 단위로 분리**: `DbSelectionCard` 는 step 1 전용. `IntegrationTargetInfoCard` (신규) 는 step 4-7 전용. step 3 은 `ResourceTransitionPanel` 유지.
4. **호출은 그 컴포넌트가 책임**: 컴포넌트가 마운트될 때 자기 데이터를 자기 fetch. 부모 페이지에서 미리 부르는 prefetch 금지.

### 4.2 Step × API 매트릭스 (To-Be, 3 provider 동일)

| Step | 컴포넌트 | API | 메모 |
|---|---|---|---|
| 1 WAITING_TARGET_CONFIRMATION ("연동 대상 DB 선택") | `DbSelectionCard` | `GET /resources` (`getConfirmResources`) | Run Infra Scan 버튼 활성, 선택 가능 |
| 2 WAITING_APPROVAL ("승인 대기") | (리소스 영역 미표시 또는 placeholder) | **호출 없음** | 우선 step 2 에서는 리소스 표시 자체를 보류. 승인 화면 작업 시 별도 요구사항 도출 |
| 3 APPLYING_APPROVED ("연동 대상 반영중") | `ResourceTransitionPanel` (개편) | `GET /approved-integration` (`getApprovedIntegration`) | 현행처럼 "기존 vs 신규" 비교가 필요하면 추가로 confirmed-integration 도 가능하나, 이번 정책 한정으로는 approved-integration 단독 |
| 4 INSTALLING ("Agent 설치") | **`IntegrationTargetInfoCard` (신규)** | `GET /confirmed-integration` (`getConfirmedIntegration`) | "연동 대상 정보" 카드. Run Infra Scan 버튼 없음. 읽기전용 표 |
| 5 WAITING_CONNECTION_TEST | `IntegrationTargetInfoCard` | `GET /confirmed-integration` | 동일 |
| 6 CONNECTION_VERIFIED | `IntegrationTargetInfoCard` | `GET /confirmed-integration` | 동일 |
| 7 INSTALLATION_COMPLETE | `IntegrationTargetInfoCard` | `GET /confirmed-integration` | 동일 |

### 4.3 Provider 페이지 책임 변경

| 항목 | 현재 | 신규 |
|---|---|---|
| `loadAzureResources` | 4 API Promise.all + builder 병합 | **삭제** (또는 step 1 한정 catalog 호출만) |
| `loadGcpResources` | 2 API Promise.all + inline merge | **삭제** (또는 step 1 한정 catalog 호출만) |
| AWS `project.resources` 직접 사용 | 모든 step | **금지** — step 별 컴포넌트가 자기 fetch |
| `buildAzureOwnedResources` | 4 source 병합 | **폐기** (또는 step 1 selection 복원 한정으로 단순화) |

### 4.4 컴포넌트 책임

#### 4.4.1 `DbSelectionCard` (step 1 전용으로 좁힘)

- 마운트 시 `getConfirmResources(id)` 호출.
- "연동 대상 DB 선택" 제목, "Run Infra Scan" 버튼, 체크박스/크레덴셜 셀렉터/VM 설정/승인 요청 버튼.
- step 2 에서는 부모가 렌더링 자체를 안 함.

#### 4.4.2 `IntegrationTargetInfoCard` (신규)

- step 4-7 에서만 마운트.
- 마운트 시 `getConfirmedIntegration(id)` 자체 호출.
- 제목: "연동 대상 정보". 부연: "관리자 확정된 연동 대상 DB 목록입니다".
- Run Infra Scan / Last Scan / 체크박스 / 셀렉터 일체 없음. **Read-only 표**.
- 컬럼: 리소스 ID / 리소스 타입 / DB 타입 / Credential / (필요 시) host:port.

#### 4.4.3 `ResourceTransitionPanel` (step 3 — 데이터 소스 단순화)

- 마운트 시 `getApprovedIntegration(id)` 자체 호출 → `resource_infos` 표시.
- "기존 vs 신규" 비교가 정말 필요한지는 별도 UX 검토 사항 — 우선 구현은 approved-integration 단독.

#### 4.4.4 `ProcessStatusCard`

- step 2/3 에서 `getConfirmedIntegration` 호출 제거.
- `hasConfirmedIntegration` flag 폐기.
- `ApprovalWaitingCard` / `ApprovalApplyingBanner` 에서 변경요청 배너 / `ConfirmedIntegrationCollapse` 사용 중단 (또는 step 4+ 로 이동).

#### 4.4.5 Admin `InfraCard`

- `canExpand` 조건 유지 (`processStatus >= INSTALLING`).
- 신규 컴포넌트 (또는 inline) 가 mount 시 `getConfirmedIntegration` 호출.
- 빈 응답 (spec 상 404) 도 "연동 확정된 DB 가 없어요" empty state 로 정상 처리. error UI 는 진짜 네트워크 실패용.
- (선택) BFF route 가 empty 를 200 으로 반환하도록 변경 — 그러면 클라가 더 자연스러움.

### 4.5 타입 / 서버측 정리

| 항목 | 변경 |
|---|---|
| `Project.resources: Resource[]` (`lib/types.ts:244`) | **삭제** |
| `lib/target-source-response.ts:214` resources normalize | **삭제** |
| `mockTargetSources.get` (`lib/api-client/mock/target-sources.ts:142-147`) | `toIssue222TargetSourceInfo` 통과 후 반환하도록 수정 (`{ targetSource: toIssue222TargetSourceInfo(project) }`) |

### 4.6 Mock confirmed-integration 정책 (신규)

**조건 (택 1)**:

- (A) APPLYING_APPROVED → INSTALLING 자동 전이 시점 (`confirm.ts:857-866`) 에 `confirmedIntegrationSnapshotStore.set(project.id, { resource_infos: ApprovedIntegration 의 selected 리소스 매핑 })` 추가. → 자연스러운 ApprovedIntegration → ConfirmedIntegration 마이그레이션.
- (B) `getConfirmedIntegration` derive 조건 (`confirm.ts:539`) 을 `installation.status !== 'PENDING'` 으로 완화. 그리고 `connectionStatus === 'CONNECTED'` 필터를 step 6+ 에서만 적용.

추천: **(A)**. Snapshot store 가 이미 변경요청 보존용으로 존재하므로, 정상 흐름에서도 동일 store 를 사용해 일관성 유지.

---

## 5. Gap Analysis (기존 → 신규)

### 5.1 삭제

| 항목 | 위치 |
|---|---|
| `Project.resources` 필드 | `lib/types.ts:244` |
| `resources` normalize | `lib/target-source-response.ts:214` |
| `loadAzureResources` 의 4-API 병합 | `AzureProjectPage.tsx:132-170` |
| `loadGcpResources` 의 2-API 병합 | `GcpProjectPage.tsx:72-134` |
| `buildAzureOwnedResources` 의 4-source fallback | `lib/azure-resource-ownership.ts:198-251` |
| `ProcessStatusCard` 의 `hasConfirmedIntegration` useEffect | `ProcessStatusCard.tsx:88-111` |
| `DbSelectionCard` 의 step ≥ 4 사용 | `Aws/Azure/GcpProjectPage.tsx` step 분기 |

### 5.2 수정

| 항목 | 변경 |
|---|---|
| `mockTargetSources.get` | 내부 Project 누설 차단 (Issue222 변환 통과) |
| `DbSelectionCard` | step 1 전용으로 prop API 좁힘. `getConfirmResources` 자체 fetch 또는 부모 prop 둘 중 결정 |
| `ResourceTransitionPanel` | 데이터 소스를 `approved-integration` 으로 교체 (현재 confirmed-integration) |
| Admin `InfraCard` | empty (404 또는 200-empty) → "연동 확정된 DB 가 없어요" empty state |
| BFF route `confirmed-integration/route.ts` | (선택) empty 를 200 으로 반환 |
| Mock `getConfirmedIntegration` derive | INSTALLING 진입 시점부터 채워지도록 수정 (§4.6) |

### 5.3 추가

| 항목 | 위치 |
|---|---|
| `IntegrationTargetInfoCard` (신규 컴포넌트) | `app/components/features/scan/IntegrationTargetInfoCard.tsx` (또는 더 적절한 디렉터리) |
| step 분기 추가 | `Aws/Azure/GcpProjectPage.tsx` — step 4+ 에서 신규 카드 렌더 |

---

## 6. 마이그레이션 플랜 (제안)

PR 단위로 4 phase 로 분할 권장.

### Phase 1 — Mock 수정 (선행)

- `mockTargetSources.get` 누설 차단 (`toIssue222TargetSourceInfo` 통과)
- Mock `confirmedIntegrationSnapshotStore` 채움 시점 수정 (APPLYING → INSTALLING 전이)
- 회귀 테스트 추가: step 4 진입 직후 `getConfirmedIntegration` 가 비지 않은 응답 반환

### Phase 2 — `IntegrationTargetInfoCard` 도입 + Provider 페이지 step 4+ 분기

- 신규 컴포넌트 추가
- AWS / Azure / GCP 페이지의 step 분기 변경 (step 3 = ResourceTransitionPanel 유지, step 4+ = 신규 카드)
- 신규 카드는 자체 `getConfirmedIntegration` fetch
- Admin `InfraCard` empty state 처리 정상화

### Phase 3 — `ProcessStatusCard` confirmed-integration 호출 제거

- `hasConfirmedIntegration` flag 와 useEffect 삭제
- `ApprovalWaitingCard` / `ApprovalApplyingBanner` 의 변경요청 배너 / Collapse 정리

### Phase 4 — `project.resources` 폐기 (마지막, 영향 범위 최대)

- AWS 페이지: step 1 → `getConfirmResources` 호출하도록 전환. `selectedIds` 초기화/`vmConfigs` 초기화/`approvalResources` 빌드를 catalog 응답으로 재구성.
- Azure 페이지: `loadAzureResources` 폐기 또는 step 1 catalog 호출만 남김. `buildAzureOwnedResources` 폐기 또는 단순화.
- GCP 페이지: `loadGcpResources` 폐기 또는 step 1 catalog 호출만 남김. `convertedResources` 매핑을 catalog 단독으로 재구성.
- IDC 페이지: 본 정책 외 — 별도 follow-up 으로 분리.
- `Project.resources` 타입 필드 제거. `target-source-response.ts:214` normalize 제거.

각 phase 마다 회귀 테스트와 dev 서버 smoke 검증 동반.

---

## 7. 관찰된 부수 이슈 (참고용)

- `ResourceTransitionPanel.tsx:69` — `resources.filter(r => r.isSelected).length` 가 신규 카운트로 표시되는데, prop 으로 받는 `resources` 가 `approvalResources` (selectedIds 기반 isSelected 재계산) 인지, 원본인지 provider 마다 일관성 없음.
- `ConfirmedIntegrationCollapse` 와 `ResourceTransitionPanel` 이 동시에 같은 step (step 3) 에서 confirmed-integration 을 fetch — 중복 호출.
- `useEffect(..., [loadAzureResources, currentStep, project.updatedAt])` 의 deps 에 `currentStep` 이 있어 step 변경마다 4 API 재호출. mock 환경에서 polling + step 전이 시 다회 호출 패턴.

---

## 8. 검증 시나리오 (구현 후 회귀)

| # | 시나리오 | 기대 |
|---|---|---|
| V1 | step 1 진입 → 네트워크 탭 | `getConfirmResources` 1회만. confirmed-integration / approved-integration / approval-history 호출 없음 |
| V2 | step 2 진입 → 네트워크 탭 | 리소스 관련 API 호출 0회 |
| V3 | step 3 진입 → 네트워크 탭 | `getApprovedIntegration` 1회만 |
| V4 | step 4-7 진입 → 네트워크 탭 | `getConfirmedIntegration` 1회만 |
| V5 | step 4 진입 직후 (mock 자동전이 직후) | confirmed-integration 응답이 비지 않음 (approved 리소스가 매핑됨) |
| V6 | Admin /integration/admin 에서 step 4-7 TS 펼치기 | confirmed-integration 응답이 채워져 있고 표가 정상 렌더 |
| V7 | Admin 에서 step 1-3 TS | 펼치기 비활성 (`canExpand=false`) |
| V8 | `Project` 타입 검색 (`grep -r "project\.resources"`) | provider 페이지에서 0 hit (IDC 제외) |
