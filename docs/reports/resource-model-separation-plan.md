# Resource 모델 분리 계획 — Candidate / Approved / Confirmed

> PR #357 (wave15-C1) merge 직후 결정. **"연동 대상 선택"** 과 **"연동 확정 정보 목록"** 은 도메인적으로 명백히 다른 개념이며, 같은 배열·타입·변수로 섞여서는 **절대** 안 된다는 원칙에 따라, 현재 하나의 `Resource` 타입으로 혼재되어 있는 리소스 도메인을 타입·훅·UI 세 레벨에서 분리한다.

## 1. 원칙 (불변)

1. **Candidate / Approved / Confirmed 는 같은 배열에 담기지 않는다.**
2. 변환 함수는 **자기 타입만 반환**한다. 공통 타입으로 합치지 않는다.
3. UI 컴포넌트의 `props`는 한 가지 타입만 받는다.
4. 변환 단계에서 **도메인 의미를 바꾸는 하드코딩**(예: confirmed 쪽에 `isSelected: true`)을 제거한다. "선택" 은 candidate 전용 개념.
5. ProjectPage의 한 렌더 순간에는 세 개념 중 **정확히 하나**만 표시된다.

---

## 2. 도메인 모델 — 세 가지 리소스 개념

| 속성 | **Candidate Resource** | **Approved Snapshot** | **Confirmed Integration** |
|---|---|---|---|
| 의미 | 스캔으로 발견한 연동 **후보** | 승인 직후 서버가 **반영 중인 스냅샷** | **운영에 투입된 확정 연동** |
| 생성 주체 | scan (자동 탐지) | 사용자 승인 | 서버 (설치 완료 시) |
| 변경 주체 | 사용자 (선택·배제·설정) | 서버 (읽기 전용, 전이 중) | 서버 (읽기 전용) |
| 대상 ProcessStatus | `WAITING_TARGET_CONFIRMATION`, `WAITING_APPROVAL` | `APPLYING_APPROVED` | `INSTALLING` ~ `INSTALLATION_COMPLETE` |
| 사용자 액션 | 선택 / 배제 / credential 지정 / VM 설정 | 없음 (진행 모니터링) | 없음 (결과 확인) |
| API | `GET /target-sources/{id}/resources` | `GET /target-sources/{id}/approved-integration` | `GET /target-sources/{id}/confirmed-integration` |
| 핵심 식별자 | scan 내 생성 id | 승인 스냅샷의 `resource_id` | 확정 시 할당된 `resource_id` |
| 상태 필드 | `connectionStatus: 'PENDING'` | N/A (전이 중) | `connectionStatus: 'CONNECTED'` |
| credential | 사용자가 부여 | 스냅샷에 포함 | 확정된 credential id |

---

## 3. As-Is — 현재 구조

### 3-1. 타입: 단일 `Resource` 가 세 개념을 모두 커버

`lib/types.ts:192-225` 의 `Resource` 인터페이스는 후보·승인·확정이 필요한 **모든 필드의 합집합**. 어느 필드가 어느 맥락에서 유효한지 타입으로 구별되지 않음.

### 3-2. 변환 함수: 하드코딩으로 "같은 타입인 척"

`lib/resource-catalog.ts`:

| 함수 | 입력 | 출력 | 하드코딩 |
|---|---|---|---|
| `catalogToResources` | `CatalogItem[]` | `Resource[]` | `connectionStatus: 'PENDING'`, `isSelected: false` |
| `approvedIntegrationToResources` | `ResourceSnapshot[]` | `Resource[]` | `connectionStatus: 'CONNECTED'`, `isSelected: true`, `integrationCategory: 'TARGET'` |
| `confirmedIntegrationToResources` | `BffConfirmedIntegration` | `Resource[]` | `connectionStatus: 'CONNECTED'`, `isSelected: true`, `integrationCategory: 'TARGET'` |

→ **후자 두 개가 `isSelected: true` 를 강제 주입**해 "선택" 이라는 candidate 전용 개념을 confirmed 타입에 끌고 들어옴.

### 3-3. 훅: `useProjectResources` 하나가 step 분기 담당 (PR #357 이후)

AWS/Azure/GCP 모두 같은 훅을 호출하고, 내부의 `loadResources` 콜백이 step에 따라 분기:

```
WAITING_TARGET_CONFIRMATION → catalogToResources(getConfirmResources())
INSTALLING+                 → confirmedIntegrationToResources(getConfirmedIntegration())
그 외                       → []
```

`APPLYING_APPROVED` 는 이 훅을 우회하고 `ResourceTransitionPanel` 이 내부적으로 `getApprovedIntegration` 을 호출.

### 3-4. UI: 단일 컴포넌트가 양쪽을 모두 렌더

- `DbSelectionCard` (`app/components/features/scan/`) — **candidate 선택** UI. `processStatus` 로 candidate 와 "승인 대기" 상태를 스스로 구분.
- `IntegrationTargetInfoCard` (`app/components/features/integration-target-info/`) — **confirmed 표시**. 자체 fetch.
- `ResourceTransitionPanel` (`app/components/features/process-status/`) — **approved snapshot 전이** 애니메이션. 자체 fetch.

→ 세 컴포넌트는 이미 도메인별로 분리되어 있으나, 그들이 받는 **타입(`Resource[]`)이 동일**해서 타입 체계상의 구분은 없음.

### 3-5. 현재 구조의 문제

| # | 문제 | 근거 |
|---|---|---|
| 1 | "선택됨" 이라는 개념이 confirmed 에 의미 없는데 강제 주입 | `confirmedIntegrationToResources` 의 `isSelected: true` |
| 2 | `setSelectedIds(all)` 이 confirmed 단계에서도 실행 | `AwsProjectPage.handleResourcesLoaded` — 선택 개념 자체가 없는데 선택 state를 업데이트 |
| 3 | `connectionStatus`, `integrationCategory` 가 변환 단계에서 하드코딩 | `PENDING`/`CONNECTED`, `TARGET` 하드코딩 |
| 4 | `Resource` 타입의 어느 필드가 어느 시점에서 유효한지 타입으로 표현 불가 | 전체 union 공동 필드 |
| 5 | 같은 `resources` 변수가 두 도메인을 가리킴 → 코드 읽을 때 맥락 추정 필요 | `AwsProjectPage.tsx` 내 동일 변수가 step에 따라 다른 의미 |

---

## 4. Step 별 리소스 표시 — As-Is

AWS/Azure/GCP 공통. IDC/SDU 는 별도 파이프라인 — 섹션 6 에 별도 정리.

| ProcessStatus | 값 | 렌더되는 컴포넌트 | 리소스 소스 | 도메인 개념 |
|---|---:|---|---|---|
| `WAITING_TARGET_CONFIRMATION` | 1 | `DbSelectionCard` | `useProjectResources` (catalog API) | **Candidate** |
| `WAITING_APPROVAL` | 2 | `DbSelectionCard` (입력 잠금) + `ProcessStatusCard` 내부 `ApprovalWaitingCard` | 상위 전달 (직전 candidate) | **Candidate** (read-only) |
| `APPLYING_APPROVED` | 3 | `ResourceTransitionPanel` | 내부 fetch (`getApprovedIntegration`) | **Approved Snapshot** |
| `INSTALLING` | 4 | `IntegrationTargetInfoCard` + provider-specific `InstallationStatusCard` | 내부 fetch (`getConfirmedIntegration`) + `useProjectResources` | **Confirmed** |
| `WAITING_CONNECTION_TEST` | 5 | `IntegrationTargetInfoCard` + `ConnectionTestPanel` | 동 | **Confirmed** |
| `CONNECTION_VERIFIED` | 6 | 동 | 동 | **Confirmed** |
| `INSTALLATION_COMPLETE` | 7 | 동 | 동 | **Confirmed** |

→ Confirmed 구간에서 **동일 데이터를 2 경로로 중복 fetch** 함 (ProjectPage 의 `useProjectResources` 와 `IntegrationTargetInfoCard` 내부 fetch). 이것도 As-Is 의 문제.

---

## 5. To-Be — 목표 구조

### 5-1. 타입 분리

`lib/types/resources/` 하위로 분리 (이름은 제안, 최종 wave 에서 확정):

```
// lib/types/resources/candidate.ts
export interface CandidateResource {
  id: string;
  resourceId: string;
  type: string;
  databaseType: DatabaseType;
  integrationCategory: IntegrationCategory;
  selectedCredentialId?: string;
  vmDatabaseConfig?: VmDatabaseConfig;
  // candidate 고유: scan metadata, 배제 이력 등
  metadata: ConfirmResourceMetadata;
  connectionStatus: 'PENDING';
}

// lib/types/resources/approved.ts
export interface ApprovedResource {
  resourceId: string;
  type: string;
  databaseType: DatabaseType | null;
  endpointConfig: ApprovedEndpointConfig | null;
  credentialId: string | null;
  // approved 고유: 승인 시점, 승인자, 전이 단계 표시용 필드
}

// lib/types/resources/confirmed.ts
export interface ConfirmedResource {
  resourceId: string;
  type: string;
  databaseType: DatabaseType | null;
  host: string | null;
  port: number | null;
  credentialId: string | null;
  // confirmed 고유: 연결 상태 실시간 값, 운영 metadata
  connectionStatus: 'CONNECTED' | 'DISCONNECTED';
}
```

**union 으로 합치지 않는다.** 세 타입을 함께 다뤄야 할 함수가 있다면 discriminated union 이 아니라 각자 다른 함수로 분리.

### 5-2. 훅 분리

| 훅 | 대상 Step | API | 반환 |
|---|---|---|---|
| `useCandidateResources(targetSourceId)` | WAITING_TARGET_CONFIRMATION, WAITING_APPROVAL | `getConfirmResources` | `CandidateResource[]` |
| `useApprovedIntegration(targetSourceId)` | APPLYING_APPROVED | `getApprovedIntegration` | `ApprovedResource[]` |
| `useConfirmedIntegration(targetSourceId)` | INSTALLING+ | `getConfirmedIntegration` | `ConfirmedResource[]` |

공통되는 fetch/retry/cancel 인프라는 **내부 `useAsyncResource<T>` 유틸** 하나에 두고 세 훅이 그 위에 얹히는 구조. PR #357 의 `useProjectResources` 는 `useAsyncResource` 로 역할 축소 후 제거.

`useProjectPageFormState` 의 `selectedIds` / `vmConfigs` 는 candidate 전용 상태가 됨. 훅 이름도 `useCandidateFormState` 로 rename.

### 5-3. UI 컴포넌트 분리

| 기존 | 개편 후 | 받는 타입 |
|---|---|---|
| `DbSelectionCard` | `CandidateResourceTable` (신규) | `CandidateResource[]` |
| (없음) | `ApprovalWaitingBanner` (ProcessStatusCard 내부 분리) | `CandidateResource[]` |
| `ResourceTransitionPanel` | `ApprovedIntegrationTransition` (rename) | `ApprovedResource[]` |
| `IntegrationTargetInfoCard` | `ConfirmedIntegrationTable` (rename/확장) | `ConfirmedResource[]` |

공유되던 `ResourceTable` 은 타입 파라미터 없이 **세 테이블이 각자 자기 타입 전용으로 구현**. 공통 시각 요소(`TableRow`, `StatusBadge`)는 design-system 레벨에서만 공유.

### 5-4. ProjectPage 구조 (AWS/Azure/GCP)

```tsx
// 의사 코드. 실제 구현은 wave 스펙에서 확정.
export const AwsProjectPage = ({ project, ... }) => {
  const currentStep = getProjectCurrentStep(project);

  return (
    <main>
      <ProjectPageMeta ... />
      <ProcessStatusCard project={project} ... />
      <GuideCard currentStep={currentStep} ... />
      <ResourceSection step={currentStep} targetSourceId={project.targetSourceId} />
      <RejectionAlert project={project} />
    </main>
  );
};

const ResourceSection = ({ step, targetSourceId }) => {
  switch (step) {
    case ProcessStatus.WAITING_TARGET_CONFIRMATION:
    case ProcessStatus.WAITING_APPROVAL:
      return <CandidateResourceSection targetSourceId={targetSourceId} readonly={step === WAITING_APPROVAL} />;

    case ProcessStatus.APPLYING_APPROVED:
      return <ApprovedIntegrationTransition targetSourceId={targetSourceId} />;

    case ProcessStatus.INSTALLING:
    case ProcessStatus.WAITING_CONNECTION_TEST:
    case ProcessStatus.CONNECTION_VERIFIED:
    case ProcessStatus.INSTALLATION_COMPLETE:
      return <ConfirmedIntegrationSection targetSourceId={targetSourceId} />;

    default:
      return null;
  }
};
```

각 섹션 컴포넌트 내부에서만 해당 타입의 훅을 호출. **ProjectPage 는 세 타입을 인지하지 않는다**.

---

## 6. Step 별 리소스 표시 — To-Be

### 6-1. AWS / Azure / GCP

| ProcessStatus | 렌더 컴포넌트 | 사용 훅 | 타입 |
|---|---|---|---|
| `WAITING_TARGET_CONFIRMATION` | `CandidateResourceSection` → `CandidateResourceTable` | `useCandidateResources` | `CandidateResource[]` |
| `WAITING_APPROVAL` | `CandidateResourceSection` (readonly) + `ApprovalWaitingBanner` | `useCandidateResources` | `CandidateResource[]` |
| `APPLYING_APPROVED` | `ApprovedIntegrationTransition` | `useApprovedIntegration` | `ApprovedResource[]` |
| `INSTALLING` | `ConfirmedIntegrationSection` → `ConfirmedIntegrationTable` + provider-specific `InstallationStatusCard` | `useConfirmedIntegration` | `ConfirmedResource[]` |
| `WAITING_CONNECTION_TEST` | `ConfirmedIntegrationSection` + `ConnectionTestPanel` | `useConfirmedIntegration` | `ConfirmedResource[]` |
| `CONNECTION_VERIFIED` | 동 | 동 | 동 |
| `INSTALLATION_COMPLETE` | 동 | 동 | 동 |

### 6-2. IDC / SDU — **Wave 16-D0 에 의해 코드베이스에서 제거**

IDC (수동 입력 기반, 승인 단계 skip) 와 SDU (S3 업로드 기반 별도 파이프라인) 는 본 Resource 모델 분리의 **선행 과제 Wave 16-D0** (아래 섹션 7 참조) 에서 코드베이스 전체에서 삭제된다. 따라서 Resource 모델 분리의 대상 범위는 **AWS / Azure / GCP 3 provider 한정**.

IDC/SDU 가 반복적으로 각 wave spec 의 "제외" 항목으로 명시되어 오면서 누적돼 온 예외 분기 비용을 없애기 위한 전면 제거 결정. D0 완료 후 본 문서의 To-Be 모델과 Wave 16-D1~D4 는 **3 provider 만** 다룬다.

원래 처리 방식이 필요하면 git history 에서 D0 직전 커밋 (또는 `archive/idc-sdu-pre-removal` tag) 을 참조.

---

## 7. 마이그레이션 계획 (Wave 16 시리즈)

Wave 간 의존성이 있으므로 순차 진행 권장. 병렬 수행은 Wave 내부 D?a / D?b 분해 수준에서만.

---

### Wave 16-D0: IDC / SDU 도메인 전면 제거 (**선행 과제**)

Resource 모델 분리 (D1~D4) 는 IDC/SDU 예외 분기가 남아있는 상태에서 시작하면 예외 설계 비용이 D5 로 이월될 수밖에 없음. D0 에서 코드베이스의 IDC/SDU 전체를 걷어낸 뒤 D1 을 시작한다.

#### 전제

- 본 프로젝트는 Mock-level demo (`USE_MOCK_DATA=true` 환경) — 실 서비스 사용자 / 외부 BFF 연동 없음 가정. **merge 전 재확인 필요**.
- BFF 계약 (`docs/swagger/idc.yaml`, `sdu.yaml`) 은 미래 실연동을 위한 참조였으나 본 리포 범위에서는 재생성 불필요.
- 복원 가능성은 git history + `archive/idc-sdu-pre-removal` tag 로 유지.

#### 영향 범위 실측 (`/Users/study/pii-agent-demo` 전수 조사 기준)

| 카테고리 | 삭제 대상 | 실측 |
|---|---|---:|
| 타입 | `lib/types/idc.ts`, `lib/types/sdu.ts` | 2 파일 / ~238 LOC |
| API 모듈 | `app/lib/api/idc.ts`, `app/lib/api/sdu.ts` | 2 파일 / ~224 LOC |
| API routes | `app/integration/api/v1/idc/`, `app/integration/api/v1/sdu/` | 19 파일 |
| Mock 데이터 | `lib/mock-idc.ts`, `lib/mock-sdu.ts`, `lib/api-client/mock/idc.ts`, `lib/api-client/mock/sdu.ts`, mockProjects seed 내 인스턴스 | 4+ 파일 / ~954 LOC |
| UI feature | `app/components/features/idc/`, `app/components/features/sdu/` | 12 파일 |
| ProjectPage | `_components/idc/` (9 파일), `_components/sdu/` (3 파일) | 12 파일 |
| 상수 | `lib/constants/idc.ts`, `lib/constants/sdu.ts` | 2 파일 / ~225 LOC |
| Process 로직 | `lib/process/sdu-guide-bridge.ts`, `lib/process/calculator.ts` 내 IDC 분기 | 1 삭제 + 1 수정 |
| 테스트 | `lib/__tests__/mock-idc.test.ts`, `lib/__tests__/mock-sdu.test.ts` + 통합 테스트 부분 | 2 전체 + N 부분 |
| Swagger | `docs/swagger/idc.yaml`, `docs/swagger/sdu.yaml` | 2 파일 / ~1,167 LOC |
| 기타 문서 | `docs/sdu-process-design.md`, `docs/cloud-provider-states.md` / `spec.md` / `user-stories-and-flows.md` 내 IDC/SDU 섹션 | ~5 파일 |
| **분기 제거** | `InfraCard.tsx`, `TerraformStatusModal.tsx`, `CloudInfoCell.tsx` 등 `cloudProvider === 'IDC' / 'SDU'` 참조 | ~10-15 파일 |

**총 삭제 규모**: 약 **57 파일 / 5,800+ LOC** (리포 전체의 약 12%).
**총 수정 규모**: 약 **35 파일** (분기 제거 / 타입 축소 / mockProjects seed 정리).

#### 핵심 변경

- `CloudProvider` union: `'AWS' | 'Azure' | 'GCP' | 'IDC' | 'SDU'` → `'AWS' | 'Azure' | 'GCP'` (`lib/types.ts:25`)
- `lib/types.ts:38-39` 의 UNKNOWN → IDC 정규화 로직 제거
- `getCurrentStepWithoutApproval` (IDC 전용) 제거. `getProjectCurrentStep` 은 AWS/Azure/GCP 공통 `getCurrentStepWithApproval` 하나로 귀결
- `ProjectCreateModal` / `provider-mapping.ts` 에서 IDC chip 제거 (현재 이미 `enabled: false`)

#### 단계별 PR 분할 (의존성 순)

| 하위 wave | 범위 | 결과 |
|---|---|---|
| **D0-a** 진입점 차단 | ProjectCreateModal 에서 IDC/SDU 옵션 제거, `provider-mapping.ts:8` 의 idc 엔트리 삭제, ProviderChipGrid 조정 | 이후 IDC/SDU 신규 생성 경로 차단. 기존 인스턴스는 여전히 라우팅됨. 안전한 1차 cut-off. |
| **D0-b** 런타임 계층 제거 | `app/integration/api/v1/idc/ | sdu/` 전체 (19 routes) + `app/lib/api/{idc,sdu}.ts` + `lib/mock-{idc,sdu}.ts` + `lib/api-client/mock/{idc,sdu}.ts` + `lib/__tests__/mock-{idc,sdu}.test.ts` + mockProjects seed 에서 IDC/SDU 제거 | 런타임에서 IDC/SDU 호출 불가. TypeScript 컴파일 대량 에러 발생 → D0-c 로 해소. |
| **D0-c** UI 컴포넌트 제거 | `app/components/features/{idc,sdu}/` + `_components/{idc,sdu}/` 전체 + target-source 페이지의 provider 라우팅 분기에서 IDC/SDU case 제거 | UI 빌드 오류 해소. |
| **D0-d** 타입 / 상수 / process 정리 | `lib/types/{idc,sdu}.ts` 삭제, `CloudProvider` union 축소, `lib/constants/{idc,sdu}.ts` 삭제, `lib/process/calculator.ts` IDC 분기 제거, `sdu-guide-bridge.ts` 삭제, 10-15개 분기 단순화 | TypeScript green. 3 provider 만 남음. |
| **D0-e** 문서 정리 | `docs/swagger/{idc,sdu}.yaml` 삭제, `docs/sdu-process-design.md` 삭제, 기타 문서 IDC/SDU 섹션 제거, `CLAUDE.md` / skill 문서 언급 정리 | 문서 정합성 확보. |

각각 개별 PR 권장. **총 5 PR, 1-2 일 작업 규모**.

#### D0 완료 후 달라지는 것

- 본 문서의 섹션 **5.4 To-Be ProjectPage** 가 IDC/SDU 예외 없이 **3 provider 만** 다룸 (이미 반영 완료)
- 섹션 **6.2 (IDC / SDU)** 가 한 줄 "제거됨" 표기로 축약 (이미 반영 완료)
- 섹션 **7 의 Wave 16-D5** 불필요 → 삭제 (이 개정에서 함께 제거)
- 이후 wave spec 들이 "IDC/SDU 제외" 단서를 달 필요가 없음
- 리포 LOC ~12% 감소, 타입 surface 축소

#### 결정 필요 사항

1. **Mock-only 여부 재확인** — 외부 BFF 가 IDC/SDU endpoint 를 호출하는 환경이 있다면 backend 측 삭제 타이밍 조율 필요.
2. **아카이브 tag 정책** — `archive/idc-sdu-pre-removal` 을 D0 시작 직전에 찍을지.
3. **memory/ 기록 처리** — `memory/` 아래 IDC/SDU 관련 노트 (feedback_preserve_bug_rationalization.md 등) 를 정리할지 그대로 둘지. 사용자 판단 영역.

---

### Wave 16-D1: 타입 분리

- `lib/types/resources/candidate.ts`, `approved.ts`, `confirmed.ts` 신설.
- 변환 함수 3개가 각자 새 타입 반환. 하드코딩 제거.
- 기존 `Resource` 는 **deprecated alias** 유지 (D4 까지 한시).
- 테스트: `lib/__tests__/resource-catalog-response.test.ts` 등 직접 교정.

### Wave 16-D2: 훅 분리

- `useAsyncResource<T>` 내부 유틸 도입.
- `useCandidateResources` / `useApprovedIntegration` / `useConfirmedIntegration` 세 훅 신설.
- PR #357 의 `useProjectResources` deprecate. AWS/Azure/GCP 3 ProjectPage 의 호출부 교체.
- `useProjectPageFormState` → `useCandidateFormState` rename. Confirmed 구간에서는 호출 안 함.

### Wave 16-D3: UI 컴포넌트 분리

- `CandidateResourceTable` 신설. `DbSelectionCard` 내부 로직 이식.
- `ConfirmedIntegrationTable` rename (`IntegrationTargetInfoCard`).
- `ApprovedIntegrationTransition` rename (`ResourceTransitionPanel`).
- 공통 JSX 는 design-system 레벨만 유지.

### Wave 16-D4: ProjectPage 재구조 + 잔재 제거

- `ResourceSection` switch 컴포넌트 도입.
- 3 ProjectPage 의 step 분기 로직을 `ResourceSection` 으로 이관.
- deprecated `Resource` 타입 alias 삭제.
- 옛 변환 함수명 정리 (`catalogToResources` → `catalogToCandidates`, 등).

> ~~Wave 16-D5: IDC 호환 / SDU 검토~~ — **Wave 16-D0 에 의해 흡수**. IDC/SDU 자체가 제거되므로 호환 검토 불필요.

---

## 8. 영향 범위 (사전 추정)

### 8-1. Wave 16-D0 (IDC/SDU 제거) — 실측

| 영역 | 삭제 | 수정 |
|---|---:|---:|
| 타입 | 2 파일 (~238 LOC) | `CloudProvider` union 축소 (~1 파일) |
| API 모듈 + routes | 21 파일 (~1,400+ LOC) | — |
| Mock / seed | 4+ 파일 (~954 LOC) | mockProjects seed 정리 (1-2 파일) |
| UI feature / ProjectPage | 24 파일 | target-source 페이지 라우팅 (1-2 파일) |
| 상수 / process | 3 파일 (~225 LOC) | `calculator.ts` 분기 제거 |
| 테스트 | 2+ 파일 | 통합 테스트 중 IDC/SDU assertion (~3-5 파일) |
| Swagger / 문서 | ~7 파일 (~1,167+ LOC) | 도메인 문서 내 섹션 제거 (3-5 파일) |
| cloudProvider 분기 | — | 10-15 파일 단순화 |
| **합** | **~57 파일 / ~5,800+ LOC** | **~35 파일** |

### 8-2. Wave 16-D1 ~ D4 (Resource 모델 분리) — 사전 추정

D0 완료 이후 기준. 3 provider 한정이므로 범위 축소됨.

| 영역 | 파일 수 | 변경 성격 |
|---|---:|---|
| 타입 | ~3-5 | 신설 + 기존 합집합 타입 축소 |
| 변환 함수 | 1 (`resource-catalog.ts`) | 반환 타입 변경, 하드코딩 제거 |
| API client | 1 (`app/lib/api/index.ts`) | 타입 시그니처 조정만 |
| 훅 | 3-4 신설 + 1-2 제거 | 내부 인프라 재배치 |
| UI 컴포넌트 | 3-4 rename/분리 | props 타입 변경 |
| ProjectPage | 3 (AWS/Azure/GCP) | 조건부 렌더 로직 단순화 |
| 테스트 | ~5-10 | 새 타입 기반으로 교체 |

Wave 16-D1~D4 합 ≈ 20–25 파일 수준. 한 PR 로 묶는 것은 리스크가 크므로 **4 wave** 로 분할 권장.

---

## 9. 원칙 재확인 (merge 전 체크리스트)

### 9-1. Wave 16-D0 전반 (각 하위 wave PR merge 전)

- [ ] D0 시작 전 `archive/idc-sdu-pre-removal` tag 생성 여부 확인.
- [ ] Mock-only 가정 유효 — 외부 BFF 에 IDC/SDU endpoint 의존이 없음을 재확인.
- [ ] D0-a ~ D0-e 는 **순서대로** 진행. TypeScript 빌드가 중간 단계에서도 녹색이 되도록 단계 경계 유지.
- [ ] `CloudProvider` union 축소 후 다른 wave PR 과의 conflict 여부 사전 점검.

### 9-2. Wave 16-D1 ~ D4 (Resource 모델 분리)

각 wave PR merge 전 아래 체크가 모두 통과해야 함.

- [ ] 어떤 함수/변수/타입도 `CandidateResource | ConfirmedResource` 같은 union 을 신설하지 않는다.
- [ ] 변환 함수 어디에도 `isSelected: true`, `integrationCategory: 'TARGET'` 같은 의미-주입 하드코딩이 남아있지 않다.
- [ ] ProjectPage 의 한 렌더 순간에 **candidate 와 confirmed 가 동시에 존재**하지 않는다 (switch/early-return 로 보장).
- [ ] Confirmed 구간에서 `selectedIds` / `vmConfigs` 같은 candidate 전용 상태가 사용되지 않는다.
- [ ] 동일 리소스 정보를 두 경로로 중복 fetch 하지 않는다 (예: ProjectPage + 자식 컴포넌트 둘 다 `getConfirmedIntegration` 호출).
- [ ] IDC / SDU 관련 분기가 남아있지 않다 (D0 완료 확인).

---

## 참고

- PR #357 (wave15-C1): 3 provider 간 useState 중복 제거. Candidate/Confirmed 분리는 의도적으로 미포함.
- `docs/domain/README.md`: PII 통합 전체 플로우.
- `docs/swagger/*.yaml`: 각 API 원본 계약.
- `lib/types.ts:192-225`: 현재의 단일 `Resource` 타입 정의.
- `lib/resource-catalog.ts:76-136`: 세 변환 함수와 하드코딩 지점.
