# Resource 모델 분리 계획 — Candidate / Approved / Confirmed

> PR #357 (wave15-C1) merge 직후 결정. **"연동 대상 선택"** 과 **"연동 확정 정보 목록"** 은 도메인적으로 명백히 다른 개념이며, 같은 배열·타입·변수로 섞여서는 **절대** 안 된다는 원칙에 따라, 현재 하나의 `Resource` 타입으로 혼재되어 있는 리소스 도메인을 타입·훅·UI 세 레벨에서 분리한다.

## 1. 원칙 (불변)

1. **Candidate / Approved / Confirmed 는 같은 배열에 담기지 않는다.**
2. 변환 함수는 **자기 타입만 반환**한다. 공통 타입으로 합치지 않는다.
3. UI 컴포넌트의 `props`는 한 가지 타입만 받는다.
4. 변환 단계에서 **도메인 의미를 바꾸는 하드코딩**(예: confirmed 쪽에 `isSelected: true`)을 제거한다. "선택" 은 candidate 전용 개념.
5. ProjectPage의 한 렌더 순간에는 세 개념 중 **정확히 하나**만 표시된다.
6. 리소스 타입 문자열 기반 특수 동작(VM endpoint 설정 등)은 ProjectPage / Table 에 흩어두지 않고 **candidate behavior registry** 에 선언한다.

---

## 2. 도메인 모델 — 세 가지 리소스 개념

| 속성 | **Candidate Resource** | **Approved Snapshot** | **Confirmed Integration** |
|---|---|---|---|
| 의미 | 스캔으로 발견한 연동 **후보** | 승인 직후 서버가 **반영 중인 스냅샷** | **운영에 투입된 확정 연동** |
| 생성 주체 | scan (자동 탐지) | 사용자 승인 | 서버 (설치 완료 시) |
| 변경 주체 | 사용자 (선택·배제·설정) | 서버 (읽기 전용, 전이 중) | 서버 (읽기 전용) |
| 대상 ProcessStatus | `WAITING_TARGET_CONFIRMATION`, `WAITING_APPROVAL` | `APPLYING_APPROVED` | `INSTALLING` ~ `INSTALLATION_COMPLETE` |
| 사용자 액션 | 선택 / 배제 / credential 지정 / endpoint 설정 | 없음 (진행 모니터링) | 없음 (결과 확인) |
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
| 6 | VM 전용 판단이 ProjectPage 까지 새어 있음 | `AwsProjectPage` / `AzureProjectPage` / `GcpProjectPage` 가 `isVmResource` 를 import 해 승인 검증 수행 |
| 7 | 리소스 타입별 특수 동작이 늘어나면 `isVm` 류 분기가 각 레이어에 반복될 구조 | 현재는 VM 만 있지만 향후 타입별 설정 UI / 검증 / payload 생성이 늘어날 가능성 |

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
export type CandidateConfigKind = 'none' | 'credential' | 'endpoint';
export type CandidateBehaviorKey = 'default' | 'credential' | 'endpoint';

export interface CandidateResource {
  id: string;
  resourceId: string;
  type: string;
  databaseType: DatabaseType;
  integrationCategory: IntegrationCategory;
  selectedCredentialId?: string;
  configKind: CandidateConfigKind;
  behaviorKey: CandidateBehaviorKey;
  endpointConfig?: EndpointConfigDraft;
  networkInterfaces?: AzureVmNic[];
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

### 5-2. Candidate behavior registry

Candidate 에만 리소스 타입별 사용자 입력 / 검증 / approval payload 생성이 존재한다. 현재는 VM 리소스(EC2, `AZURE_VM`)만 endpoint 설정이 필요하지만, 이후 리소스 타입별 특수 동작이 늘어날 수 있으므로 `isVm` 분기를 상위 컴포넌트에 노출하지 않는다.

`catalogToCandidates` 는 raw catalog item 을 `CandidateResource` 로 변환할 때 `configKind` / `behaviorKey` 를 함께 정규화한다.

```
// lib/types/resources/candidate-behavior.ts
export interface CandidateResourceBehavior {
  configKind: CandidateConfigKind;
  isConfigured(resource: CandidateResource, draft: CandidateDraftState): boolean;
  buildApprovalInput(resource: CandidateResource, draft: CandidateDraftState): ApprovalResourceInputData | undefined;
}

export const CANDIDATE_RESOURCE_BEHAVIORS: Record<CandidateBehaviorKey, CandidateResourceBehavior> = {
  default: noneBehavior,
  credential: credentialBehavior,
  endpoint: endpointBehavior,
};
```

규칙:
- `ProjectPage` 는 `isVm`, `configKind`, `behaviorKey` 를 직접 확인하지 않는다.
- `CandidateResourceSection` 은 behavior registry 로 선택 후보 검증과 `resource_inputs` 생성을 수행한다.
- `CandidateResourceTable` 은 `configKind` 에 맞는 입력 UI 를 렌더하되, 리소스 타입 문자열(`EC2`, `AZURE_VM`)을 직접 비교하지 않는다.
- VM 은 `endpoint` behavior 의 첫 구현일 뿐이다. 새 리소스 타입 특수 동작은 behavior 추가로 확장하고 page / section switch 를 늘리지 않는다.

### 5-3. Fetch 는 Section 컴포넌트의 책임

공통 훅 (`useProjectResources`, `useAsyncResource` 같은 추상화) 을 **두지 않는다**. 각 타입마다 대응하는 **Section 컴포넌트**가 자기 데이터의 fetch / 로딩 / 에러 / 취소 를 **직접** 소유한다.

근거:
- 세 타입 (Candidate / Approved / Confirmed) 은 fetch URL · 응답 shape · refresh 정책 · 에러 메시지가 **모두 다르다**. 공통 훅을 두면 옵션 파라미터가 늘어나 호출부가 2-hop 으로 멀어지고, 실제로 "어떤 API 를 치는지" 읽으려면 훅 구현까지 들어가야 한다.
- Section 컴포넌트가 mount 될 때 자기 API 를 부르고 unmount 시 취소하는 구조가 **가장 단순하고 테스트가 쉽다** — 훅 모킹 대신 fetch 모킹만으로 충분.
- 공통화가 필요한 부분은 **순수 함수** (`getErrorMessage`, 변환 함수 `catalogToCandidates` 등) 로만 공유하고, state 는 각 컴포넌트가 독립적으로.

| Section | 내부에서 호출하는 API | 상태 소유 |
|---|---|---|
| `CandidateResourceSection` | `getConfirmResources` | `AsyncState<CandidateResource[]>`, `selectedIds`, endpoint draft state, approval modal state |
| `ApprovedIntegrationSection` | `getApprovedIntegration` | `AsyncState<ApprovedResource[]>` |
| `ConfirmedIntegrationSection` | `getConfirmedIntegration` | `AsyncState<ConfirmedResource[]>` |

> PR #357 의 `useProjectResources`, `useProjectPageFormState` 는 **Wave 16-D4 에서 제거**. `selectedIds` / endpoint draft state / approval modal state 는 `CandidateResourceSection` 내부로 이동 (candidate 전용 관심사이므로).

### 5-4. Section / Table 2-tier 구분

각 리소스 타입별로 **Section (fetch + state)** 와 **Table (pure presentation)** 를 분리한다.

| 타입 | Section (fetch · 상태) | Table (data-in / UI-out) | 대체되는 기존 |
|---|---|---|---|
| Candidate | `CandidateResourceSection` | `CandidateResourceTable` | `DbSelectionCard` (분해됨) |
| Approved | `ApprovedIntegrationSection` | `ApprovedIntegrationTable` + 전이 애니메이션 | `ResourceTransitionPanel` (rename + 내부 정리) |
| Confirmed | `ConfirmedIntegrationSection` | `ConfirmedIntegrationTable` | `IntegrationTargetInfoCard` (rename) |

Table 은 **자기 타입의 배열과 필요한 핸들러만** props 로 받는다. Section 만 ProjectPage 에 노출되며, Section 내부의 fetch / loading / error 는 외부에서 보이지 않는다.

공유되던 `ResourceTable` 은 타입 파라미터를 쓰는 제네릭 대신 **세 Table 이 각자 자기 타입 전용**으로 구현. 공통 시각 요소(`TableRow`, `StatusBadge`) 는 design-system 수준에서만 공유.

### 5-5. Cancellation 은 `AbortController` 로만

현재 `useProjectResources` 의 `let cancelled = false` 패턴을 **폐기**한다. 대신 AbortController 기반으로 표준화:

- `fetchJson` / 각 API client 의 옵션에 `{ signal?: AbortSignal }` 을 표준화 (이미 `lib/fetch-json.ts` 가 signal 을 forwarding 하도록 되어 있음).
- 각 Section 의 `useEffect` 에서 `new AbortController()` 를 만들고 `signal` 을 fetch 에 전달.
- cleanup 에서 `controller.abort()` → 네트워크 요청 자체가 끊기고, fetch 는 `AbortError` 를 throw.
- catch 블록에서 `err.name === 'AbortError'` 는 무시. 그 외만 state 에 반영.

효과:
- 수동 boolean flag 가 없어진다.
- 기존에는 "응답은 받고 setState 만 무시" 했지만, 이제는 **요청 자체가 취소**되어 네트워크 / 메모리 비용도 절감.
- Section 간 로직이 독립적이어서 한 Section 의 cancel 이 다른 Section 에 영향 없음.

표준 Section 구현 패턴 (의사 코드):

```tsx
// _components/shared/async-state.ts (신설)
export type AsyncState<T> =
  | { status: 'loading' }
  | { status: 'ready'; data: T }
  | { status: 'error'; message: string };
```

```tsx
// _components/candidate/CandidateResourceSection.tsx (Wave 16-D2 신설)
'use client';

import { useEffect, useState } from 'react';
import { getConfirmResources } from '@/app/lib/api';
import { catalogToCandidates } from '@/lib/resource-catalog';
import type { CandidateResource } from '@/lib/types/resources/candidate';
import { getCandidateErrorMessage } from './errors';
import type { AsyncState } from '@/app/integration/target-sources/[targetSourceId]/_components/shared/async-state';

interface Props {
  targetSourceId: number;
  readonly?: boolean;
  // selection / endpoint draft / approval 은 이 컴포넌트 내부에서 관리
}

export function CandidateResourceSection({ targetSourceId, readonly }: Props) {
  const [state, setState] = useState<AsyncState<CandidateResource[]>>({ status: 'loading' });
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading' });

    (async () => {
      try {
        const response = await getConfirmResources(targetSourceId, { signal: controller.signal });
        setState({ status: 'ready', data: catalogToCandidates(response.resources) });
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setState({ status: 'error', message: getCandidateErrorMessage(err) });
      }
    })();

    return () => controller.abort();
  }, [targetSourceId, retryNonce]);

  if (state.status === 'loading') return <LoadingState />;
  if (state.status === 'error') {
    return <ErrorState message={state.message} onRetry={() => setRetryNonce((n) => n + 1)} />;
  }
  return (
    <CandidateResourceTable
      candidates={state.data}
      readonly={readonly}
      /* ...selection / approval modal 상태는 이 Section 내부에서 추가 useState 로 관리 */
    />
  );
}
```

Approved / Confirmed Section 도 같은 패턴, API / 타입 / 에러 메시지만 다르다.

### 5-6. ProjectPage 구조 (AWS/Azure/GCP)

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

| ProcessStatus | Section (fetch 책임) | Table (presentation) | 호출 API | 타입 |
|---|---|---|---|---|
| `WAITING_TARGET_CONFIRMATION` | `CandidateResourceSection` | `CandidateResourceTable` | `getConfirmResources` | `CandidateResource[]` |
| `WAITING_APPROVAL` | `CandidateResourceSection` (readonly) + `ApprovalWaitingBanner` | `CandidateResourceTable` | `getConfirmResources` | `CandidateResource[]` |
| `APPLYING_APPROVED` | `ApprovedIntegrationSection` | `ApprovedIntegrationTable` (전이 애니메이션 포함) | `getApprovedIntegration` | `ApprovedResource[]` |
| `INSTALLING` | `ConfirmedIntegrationSection` + provider-specific `InstallationStatusCard` | `ConfirmedIntegrationTable` | `getConfirmedIntegration` | `ConfirmedResource[]` |
| `WAITING_CONNECTION_TEST` | `ConfirmedIntegrationSection` + `ConnectionTestPanel` | `ConfirmedIntegrationTable` | `getConfirmedIntegration` | `ConfirmedResource[]` |
| `CONNECTION_VERIFIED` | 동 | 동 | 동 | 동 |
| `INSTALLATION_COMPLETE` | 동 | 동 | 동 | 동 |

각 Section 은 **자기 행의 API 만** 호출하며, 다른 Section 의 state · fetch · cancel 과 상호작용하지 않는다. ProjectPage 는 step 에 따라 **정확히 하나의 Section** 만 렌더.

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

#### 핵심 삭제 대상 (확정)

본 wave 가 제거하는 두 축:

- **Mock data** — `lib/mock-idc.ts`, `lib/mock-sdu.ts`, `lib/api-client/mock/{idc,sdu}.ts`, `mockProjects` seed 의 IDC/SDU 인스턴스, 관련 테스트 (`lib/__tests__/mock-{idc,sdu}.test.ts`).
- **Component** — `app/components/features/{idc,sdu}/` 전체, `_components/{idc,sdu}/` 전체 (`IdcProjectPage`, `SduProjectPage`, 각 provider 의 process-status / input-panel 등).

위 두 축이 D0 의 의도이며, 나머지 항목(타입/상수/API routes/문서)은 **위 두 축을 지웠을 때 빌드 / 정합성을 유지하기 위해 동반 제거**되는 것이다.

#### 전제

- 본 프로젝트는 Mock-level demo (`USE_MOCK_DATA=true`) 환경으로 운용됨. IDC/SDU 제거에 따른 외부 영향 없음.
- 복원은 git history + D0 착수 직전에 찍는 `archive/idc-sdu-pre-removal` tag 로 충분.

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

- 본 문서의 섹션 **5-6 To-Be ProjectPage** 가 IDC/SDU 예외 없이 **3 provider 만** 다룸 (이미 반영 완료)
- 섹션 **6-2 (IDC / SDU)** 가 한 줄 "제거됨" 표기로 축약 (이미 반영 완료)
- 섹션 **7 의 Wave 16-D5** 불필요 → 삭제 (이 개정에서 함께 제거)
- 이후 wave spec 들이 "IDC/SDU 제외" 단서를 달 필요가 없음
- 리포 LOC ~12% 감소, 타입 surface 축소

#### 실행 세부 절차 (D0 착수 시)

- 착수 직전 `archive/idc-sdu-pre-removal` tag 를 `main` 에 생성 / push.
- D0-a ~ D0-e 각 하위 wave 를 순서대로 개별 PR 로 진행. 각 PR 은 `tsc --noEmit` / `npm run lint` / `npm run test:run` / `next build` 가 모두 통과해야 merge.
- `memory/` 내 IDC/SDU 관련 노트(`feedback_preserve_bug_rationalization.md` 등)는 D0-e 의 범위에 포함해 함께 정리.

---

### Wave 16-D1: 타입 분리 + 변환 함수 분리

**의존**: Wave 16-D0 완료.

**목표**: `Resource` 단일 union 타입을 `CandidateResource` / `ApprovedResource` / `ConfirmedResource` 3개 독립 타입으로 쪼갠다. 변환 함수도 각자 자기 타입만 반환.

**신설 파일**

| 파일 | 내용 |
|---|---|
| `lib/types/resources/candidate.ts` | `CandidateResource` interface. scan 메타, `connectionStatus: 'PENDING'` literal, `configKind` / `behaviorKey`, `isSelected` 없음 (선택은 Section state) |
| `lib/types/resources/candidate-behavior.ts` | `CandidateResourceBehavior`, `CandidateDraftState`, `CandidateConfigKind`, `CandidateBehaviorKey` 타입 |
| `lib/types/resources/approved.ts` | `ApprovedResource` interface. 승인 스냅샷 필드, 전이 단계 식별 필드 |
| `lib/types/resources/confirmed.ts` | `ConfirmedResource` interface. 실시간 `connectionStatus: 'CONNECTED' | 'DISCONNECTED'` |
| `lib/types/resources/index.ts` | 3 타입 re-export |

**수정 파일**

| 파일 | 변경 |
|---|---|
| `lib/resource-catalog.ts` | `catalogToResources` → `catalogToCandidates(...): CandidateResource[]`. `catalogToCandidates` 에서 `configKind` / `behaviorKey` 정규화. `confirmedIntegrationToResources` → `confirmedIntegrationToConfirmed(...): ConfirmedResource[]`. `approvedIntegrationToResources` → `approvedIntegrationToApproved(...): ApprovedResource[]`. **하드코딩(`isSelected: true`, `integrationCategory: 'TARGET'`) 제거**. |
| `lib/types.ts` | 기존 `Resource` 는 **삭제** (union alias 유지 금지 — 섞임 방지). |
| `app/lib/api/index.ts` | `getConfirmResources` 반환 타입 유지 (raw). 각 Section 이 변환 함수로 후처리. |
| `lib/__tests__/resource-catalog-response.test.ts` | 3 타입 기준으로 재작성 |

**검증 기준**
- `tsc --noEmit` 0 errors. 기존 `Resource` 를 참조하는 모든 호출부가 D2 에서 교체될 예정이므로, D1 단독으로는 **모든 호출부가 빌드 깨지는 상태** → D1 PR 은 D2 와 **세트로 진행**하거나 `Resource` 임시 alias 를 D2 merge 시점에 지우는 방식 중 택일. 권장: D1+D2 통합 PR.

---

### Wave 16-D2: Section 컴포넌트 도입 (fetch 책임 이관)

**의존**: Wave 16-D1.

**목표**: 공통 훅 (`useProjectResources`, `useProjectPageFormState`) 을 제거하고, 각 타입별 Section 컴포넌트가 직접 fetch · state · cancellation 을 소유하도록 한다.

**신설 파일**

| 파일 | 내용 |
|---|---|
| `_components/shared/async-state.ts` | `AsyncState<T>` discriminated union + 공통 `<LoadingState/>`, `<ErrorState/>` export |
| `_components/candidate/CandidateResourceSection.tsx` | `getConfirmResources` 직접 호출. `selectedIds`, endpoint draft state, `expandedResourceId`, approval modal state 를 내부 useState 로 소유. AbortController 사용. |
| `_components/candidate/candidate-resource-behavior.ts` | `CANDIDATE_RESOURCE_BEHAVIORS`. `default` / `credential` / `endpoint` behavior 구현. 선택 후보 검증과 approval payload 생성 담당. |
| `_components/candidate/errors.ts` | `getCandidateErrorMessage` (순수 함수) |
| `_components/approved/ApprovedIntegrationSection.tsx` | `getApprovedIntegration` 직접 호출. AbortController 사용. |
| `_components/approved/errors.ts` | `getApprovedErrorMessage` |
| `_components/confirmed/ConfirmedIntegrationSection.tsx` | `getConfirmedIntegration` 직접 호출. AbortController 사용. |
| `_components/confirmed/errors.ts` | `getConfirmedErrorMessage` |

**각 Section 표준 구조** (5-5 의 의사 코드 패턴을 3 곳에 반복):

```tsx
export function XxxSection({ targetSourceId, ... }) {
  const [state, setState] = useState<AsyncState<XxxResource[]>>({ status: 'loading' });
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading' });
    (async () => {
      try {
        const response = await getXxx(targetSourceId, { signal: controller.signal });
        setState({ status: 'ready', data: transform(response) });
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setState({ status: 'error', message: getXxxErrorMessage(err) });
      }
    })();
    return () => controller.abort();
  }, [targetSourceId, retryNonce]);

  // ...state.status 분기 + Table 렌더
}
```

**삭제 파일** (D2 에서 바로 제거)

- `_components/shared/useProjectResources.ts` (PR #357 산출물)
- `_components/shared/useProjectPageFormState.ts` (PR #357 산출물)

**API client 수정**: 기존 API 함수에 `{ signal?: AbortSignal }` 옵션 추가. `lib/fetch-json.ts` 는 이미 signal forwarding 지원 → `app/lib/api/index.ts` 의 각 함수 시그니처만 확장.

**ProjectPage (AWS/Azure/GCP) 수정**: 기존 `useProjectResources` / `useProjectPageFormState` 호출을 삭제하고, step 에 따라 해당 Section 렌더. (ResourceSection switch 자체는 D4 에서 도입 — D2 시점은 아직 3 ProjectPage 에 inline switch.)

**Candidate behavior 이관**: 기존 provider ProjectPage 가 직접 수행하던 VM 판별 / endpoint 설정 누락 검증 / approval payload 생성을 `candidate-resource-behavior.ts` 로 이동. ProjectPage 는 `isVmResource`, `configKind`, `behaviorKey` 를 import 하지 않는다.

**검증 기준**
- `tsc --noEmit` 0 errors.
- `npm run lint` 0 new warnings.
- AWS / Azure / GCP 페이지 full loop 수동 QA (scan → 선택 → 승인 → APPLYING → INSTALLING).
- 기존 `let cancelled = false` 패턴이 repo 전체에서 0 개 (grep `cancelled = false`).
- `grep -rn "isVmResource" app/integration/target-sources app/components/features/process-status` → 0 hits. VM 판단은 candidate behavior 또는 candidate table 내부로 제한.

---

### Wave 16-D3: Table 컴포넌트 분리 (presentation 순수화)

**의존**: Wave 16-D2.

**목표**: Section 내부에서 렌더되는 JSX 를 Table 컴포넌트로 분리. Table 은 **fetch / loading / error 를 모른다** — 자기 타입 배열과 핸들러 props 만 받음.

**신설 파일**

| 파일 | 내용 |
|---|---|
| `_components/candidate/CandidateResourceTable.tsx` | `candidates: CandidateResource[]`, `selectedIds: string[]`, `drafts: CandidateDraftState`, `onDraftChange`, `onRequestApproval`, `readonly?` 등 props. 기존 `DbSelectionCard` 의 presentation 로직 이식. `configKind` 로 입력 UI 선택. |
| `_components/candidate/CandidateEndpointConfigPanel.tsx` | 기존 `VmDatabaseConfigPanel` 을 endpoint 설정 패널로 rename/일반화. VM 은 첫 소비자일 뿐이며 `EC2` / `AZURE_VM` 문자열 비교는 behavior layer 에서만 허용. |
| `_components/approved/ApprovedIntegrationTable.tsx` | `approved: ApprovedResource[]`, 전이 시각화 내장. 기존 `ResourceTransitionPanel` 의 presentation 이식. |
| `_components/confirmed/ConfirmedIntegrationTable.tsx` | `confirmed: ConfirmedResource[]`. 기존 `IntegrationTargetInfoCard` 의 presentation 이식. |

**삭제 파일** (D3 에서 제거)

- `app/components/features/scan/DbSelectionCard.tsx` 및 내부 files
- `app/components/features/integration-target-info/IntegrationTargetInfoCard.tsx`
- `app/components/features/process-status/ResourceTransitionPanel.tsx`

(분해된 subcomponent 중 재사용 가능한 건 design-system / 공통 UI 폴더로 승격.)

**Section 수정**: D2 에서 각 Section 이 인라인 렌더하던 부분을 Table 컴포넌트 호출로 교체.

**중복 제거**: 기존 provider ProjectPage (AWS/Azure/GCP) 가 `IntegrationTargetInfoCard` 와 `useProjectResources` 로 **confirmed 데이터를 2 경로로 fetch** 하던 버그 → D2+D3 완료 시점에 Section 만이 유일한 fetch 주체가 되므로 자동 해소.

**검증 기준**
- `tsc --noEmit` 0 errors.
- 시각적 회귀 테스트 (기존 UI 와 일치) — 각 provider 페이지 스크린샷 비교.
- 순환 의존 없음 (`_components/candidate/`, `approved/`, `confirmed/` 세 디렉터리 간 import 금지).
- `CandidateResourceTable` 은 `resource.type === 'EC2'` / `resource.type === 'AZURE_VM'` 같은 문자열 비교를 하지 않는다. 입력 UI 는 `configKind` 로만 결정.

---

### Wave 16-D4: ProjectPage 재구조 + 잔재 제거

**의존**: Wave 16-D2, D3.

**목표**: 3 ProjectPage 의 step 분기 로직을 `ResourceSection` switch 컴포넌트로 통일. 기존 훅 · 타입 alias · 변환 함수명 잔재 정리.

**신설 파일**

| 파일 | 내용 |
|---|---|
| `_components/shared/ResourceSection.tsx` | `{ step, targetSourceId }` 받아 step 에 따라 정확히 하나의 Section 렌더 (5-6 의 switch 패턴) |

**수정 파일**

| 파일 | 변경 |
|---|---|
| `_components/aws/AwsProjectPage.tsx` | step 분기 / `renderStepCard` 제거 → `<ResourceSection step={currentStep} targetSourceId={...} />` 한 줄. `useProjectResources` / `useProjectPageFormState` import 제거. AWS 고유 (AwsInstallationModeSelector 가드) 유지. |
| `_components/azure/AzureProjectPage.tsx` | 동. Azure 의 `fallbackSettings` / `resourceLoaded` 도 이 시점에 재평가 — resourceLoaded 는 불필요해짐 (Section 이 자체 loading 관리). |
| `_components/gcp/GcpProjectPage.tsx` | 동. |

**삭제 파일**

- PR #357 산출물: `useProjectResources.ts`, `useProjectPageFormState.ts` (D2 에서 이미 삭제 — 여기서는 import 잔재 확인)
- 기존 `renderStepCard` 패턴이 Section switch 로 대체되므로 각 ProjectPage 내 `renderStepCard` 함수 삭제

**원칙 재확인**
- ProjectPage 는 `CandidateResource` / `ApprovedResource` / `ConfirmedResource` 중 어느 타입도 **직접 참조하지 않는다**. 타입은 Section/Table 내부에만 머문다.
- ProjectPage 는 `isVm`, `configKind`, `behaviorKey` 같은 candidate 리소스 세부 분기를 직접 참조하지 않는다.
- `let cancelled = false` 패턴이 repo 전체에서 **0 개** (CI grep check 추가 권장).
- `catalogToResources` 같은 옛 함수명은 D1 에서 이미 rename 되어 있음을 확인.

**검증 기준**
- `tsc --noEmit` 0 errors.
- `npm run lint` 0 new warnings.
- AWS/Azure/GCP 3 페이지 수동 QA full loop.
- `grep -rn "cancelled = false\|let cancelled" app lib` → 0 hits.
- `grep -rn "useProjectResources\|useProjectPageFormState" app lib` → 0 hits.

---

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
| Candidate behavior | ~2-3 | 리소스 타입별 설정 / 검증 / payload 생성 registry |
| API client | 1 (`app/lib/api/index.ts`) | 타입 시그니처 조정만 |
| 훅 | 3-4 신설 + 1-2 제거 | 내부 인프라 재배치 |
| UI 컴포넌트 | 4-6 rename/분리 | props 타입 변경 + endpoint 설정 패널 일반화 |
| ProjectPage | 3 (AWS/Azure/GCP) | 조건부 렌더 로직 단순화 |
| 테스트 | ~5-10 | 새 타입 기반으로 교체 |

Wave 16-D1~D4 합 ≈ 22–28 파일 수준. 한 PR 로 묶는 것은 리스크가 크므로 **4 wave** 로 분할 권장.

---

## 9. 원칙 재확인 (merge 전 체크리스트)

### 9-1. Wave 16-D0 전반 (각 하위 wave PR merge 전)

- [ ] D0 시작 전 `archive/idc-sdu-pre-removal` tag 생성 여부 확인.
- [ ] Mock-only 가정 유효 — 외부 BFF 에 IDC/SDU endpoint 의존이 없음을 재확인.
- [ ] D0-a ~ D0-e 는 **순서대로** 진행. TypeScript 빌드가 중간 단계에서도 녹색이 되도록 단계 경계 유지.
- [ ] `CloudProvider` union 축소 후 다른 wave PR 과의 conflict 여부 사전 점검.

### 9-2. Wave 16-D1 ~ D4 (Resource 모델 분리)

각 wave PR merge 전 아래 체크가 모두 통과해야 함.

**타입 · 도메인 경계**
- [ ] 어떤 함수/변수/타입도 `CandidateResource | ConfirmedResource` 같은 union 을 신설하지 않는다.
- [ ] 변환 함수 어디에도 `isSelected: true`, `integrationCategory: 'TARGET'` 같은 의미-주입 하드코딩이 남아있지 않다.
- [ ] ProjectPage / 공용 layout 은 `CandidateResource` · `ApprovedResource` · `ConfirmedResource` 중 어느 타입도 **직접 import 하지 않는다** (타입은 Section/Table 내부에만).
- [ ] Candidate 타입은 리소스 타입별 특수 동작을 `configKind` / `behaviorKey` 로 표현한다. `isVm` boolean 을 도메인 공통 타입으로 승격하지 않는다.

**Section · Table 구조**
- [ ] 공통 fetch 훅 (`useProjectResources`, `useAsyncResource<T>`, `useCandidateResources` 등) 을 **신설하지 않는다**. fetch 는 Section 컴포넌트의 `useEffect` 내에서 직접.
- [ ] Table 컴포넌트는 API / fetch / loading state 를 **모른다** — props 로만 데이터를 받는다.
- [ ] 한 Section 은 **자기 타입의 API 1 개만** 호출한다. 두 API 를 동시에 부르지 않는다.
- [ ] ProjectPage 의 한 렌더 순간에 **candidate 와 confirmed 가 동시에 존재**하지 않는다 (`ResourceSection` switch 로 보장).
- [ ] `CandidateResourceSection` 만 candidate behavior registry 를 사용한다. ProjectPage / ProcessStatusCard 는 `isVmResource`, `configKind`, `behaviorKey` 를 import 하지 않는다.
- [ ] `CandidateResourceTable` 은 입력 UI 선택을 `configKind` 로 수행한다. 리소스 타입 문자열 비교는 registry / 변환 계층으로 제한한다.

**Cancellation**
- [ ] `let cancelled = false` / `if (cancelled) return;` 패턴이 repo 전체에서 **0 개**. (`grep -rn "cancelled = false" app lib` 자동 확인)
- [ ] 모든 Section 의 fetch 는 `AbortController.signal` 을 API client 에 전달하고, cleanup 에서 `controller.abort()` 로 중단.
- [ ] catch 블록은 `err.name === 'AbortError'` 를 무시하고 그 외만 state 로 반영.

**중복 fetch**
- [ ] 동일 리소스 정보를 두 경로로 중복 fetch 하지 않는다 (예: ProjectPage + 자식 컴포넌트 둘 다 `getConfirmedIntegration`). D2+D3 완료 시점 확인.
- [ ] Confirmed 구간에서 `selectedIds` / endpoint draft state 같은 candidate 전용 상태가 사용되지 않는다.

**선행 조건**
- [ ] IDC / SDU 관련 분기가 repo 에 남아있지 않다 (Wave 16-D0 완료 확인).

---

## 참고

- PR #357 (wave15-C1): 3 provider 간 useState 중복 제거. Candidate/Confirmed 분리는 의도적으로 미포함.
- `docs/domain/README.md`: PII 통합 전체 플로우.
- `docs/swagger/*.yaml`: 각 API 원본 계약.
- `lib/types.ts:192-225`: 현재의 단일 `Resource` 타입 정의.
- `lib/resource-catalog.ts:76-136`: 세 변환 함수와 하드코딩 지점.
