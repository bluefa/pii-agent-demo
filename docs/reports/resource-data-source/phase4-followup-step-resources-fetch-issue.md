# Phase 4 follow-up — step 4-7 `confirmed-integration` 중복 호출 제거

> Phase 4 (#342) 머지 시점에 수용된 deviation 해소.
>
> **우선순위**: 낮음 (기능적 정상, 성능 최적화 + 단일 소스 정책 완결 목적).
> **시작 시점**: IDC/SDU 타입 분리 wave 및 final removal wave 머지 후, 모든 리소스 데이터 소스 정리가 stabilize 된 뒤.

## Context

PR #342 리뷰에서 P1 deviation 으로 식별:

- `docs/reports/resource-data-source/phase2-integration-target-info-card.md` § "Single-source 달성 기준"
  - Phase 4 머지 후 기대치: **step 4-7 의 confirmed-integration 호출 = AWS 1 / Azure 1 / GCP 1**
- 실제 Phase 4 머지 후 상태: **AWS 2 / Azure 2 / GCP 2**

### 2회 호출이 되는 이유

각 provider 페이지 (`AwsProjectPage.tsx`, `AzureProjectPage.tsx`, `GcpProjectPage.tsx`) 의 useEffect:

```ts
} else if (currentStep >= ProcessStatus.INSTALLING) {
  const response = await getConfirmedIntegration(project.targetSourceId).catch(...);
  setResources(confirmedResources);
  setSelectedIds(confirmedResources.map((r) => r.id));
}
```

동시에 `IntegrationTargetInfoCard` 가 마운트되면서 자체 `getConfirmedIntegration` 호출 (Phase 2 에서 도입, Phase 4 의 "Do NOT touch" 대상이라 미변경).

### 중복 호출이 필요했던 이유 (Phase 4 시점)

- `ConnectionTestPanel` (step 5+) 과 `AzureInstallationInline` (step 4) 이 `selectedResources` prop 을 소비
- Provider 페이지가 `resources` state 를 갖고 있어야 `ProcessStatusCard → *InstallationInline / ConnectionTestPanel` 로 내려줄 수 있음
- Phase 4 시점에 `IntegrationTargetInfoCard` 의 prop 구조를 변경하는 것은 scope 외 판단

## Goal

Step 4-7 에서 `getConfirmedIntegration` 호출을 **1회** 로 단일화.

## 해결 옵션

### (A) `IntegrationTargetInfoCard` 를 "prop 우선, fallback self-fetch" 패턴으로 확장 (권장)

`IntegrationTargetInfoCard` 에 `resources?: ConfirmedIntegrationResourceItem[]` prop 추가:

```tsx
interface IntegrationTargetInfoCardProps {
  targetSourceId: number;
  resources?: ConfirmedIntegrationResourceItem[];  // 부모가 이미 갖고 있으면 내려줌
}

// 내부 useEffect:
// - resources prop 이 주어지면 fetch 생략, prop 사용
// - 없으면 기존 self-fetch 동작
```

Provider 페이지에서:
```tsx
<IntegrationTargetInfoCard
  key={project.targetSourceId}
  targetSourceId={project.targetSourceId}
  resources={confirmedIntegrationResources}  // provider 페이지가 이미 fetch 한 raw 응답
/>
```

**장점**: Admin `InfraCard` 와 같은 standalone 사용처는 기존처럼 동작, provider 페이지 사용처만 단일화.
**단점**: 두 모드 (self-fetch / prop) 지원 → 상태 복잡도 약간 증가.

### (B) Provider 페이지 useEffect 에서 step ≥ INSTALLING 분기 제거

Provider 페이지가 step 4+ 에서 `getConfirmedIntegration` 을 부르지 않도록 변경. 대신 `ConnectionTestPanel` / `AzureInstallationInline` 등 downstream 컴포넌트가 자체 fetch.

**장점**: Provider 페이지 단순화.
**단점**: 여러 downstream 컴포넌트가 각각 fetch → admin 페이지와 달리 step 4-7 전 영역에서 2-3 회 이상으로 오히려 늘어날 가능성. `selectedResources` 가 ProcessStatusCard 상위에서 공유되는 구조가 깨짐.

### (C) 공통 context / hook 도입

`useConfirmedIntegration(targetSourceId)` 훅 또는 Context 로 confirmed-integration 데이터를 프로바이더 페이지 레벨에서 한번만 fetch 하고, `IntegrationTargetInfoCard` / `ConnectionTestPanel` / `AzureInstallationInline` 등이 같은 훅을 사용.

**장점**: 가장 깔끔한 구조.
**단점**: 이 변경만으로는 큰 값이 없고, 향후 SWR / React Query 도입과 함께 고려하는 게 나음. 추가 abstraction 비용.

## 권장 방향

**옵션 (A)**. 가장 작은 변경으로 spec acceptance 달성. `IntegrationTargetInfoCard` 의 prop 을 optional 로 확장만 하면 됨.

## Scope (옵션 A 기준)

### In-scope

- `app/components/features/integration-target-info/IntegrationTargetInfoCard.tsx` — `resources?: ConfirmedIntegrationResourceItem[]` prop 추가, 내부 useEffect 에 "prop 우선" 분기
- 3 provider 페이지 — useEffect 에서 confirmedIntegration 응답을 state 에 유지, `IntegrationTargetInfoCard` 에 prop 전달

### Out of scope

- Admin `InfraCard` — `IntegrationTargetInfoCard` 사용처 아님, 영향 없음
- `ConnectionTestPanel` / `AzureInstallationInline` 의 `resources` 소비 로직
- SWR / React Query 도입

## Precondition

```bash
cd /Users/study/pii-agent-demo
git fetch origin main

# 다음 wave 들이 먼저 머지되어 있어야 함 (이 follow-up 은 모든 리소스 데이터 소스 정리 후)
# - IDC/SDU 타입 분리 wave (docs/reports/idc-sdu-type-split.md)
# - Final removal wave (Project.resources 필드 실제 삭제)
```

## Verify

- `npx tsc --noEmit` → exit 0
- `npm run lint` → exit 0
- `npm run build` → exit 0

수동 검증 — Network 탭:
- step 4 (INSTALLING) 진입 → `/confirmed-integration` 호출 **1 회** (기존 2 회)
- step 5 (WAITING_CONNECTION_TEST) → 1 회
- step 6 (CONNECTION_VERIFIED) → 1 회
- step 7 (INSTALLATION_COMPLETE) → 1 회
- Admin `/integration/admin` 에서 TS 펼치기 → 기존처럼 1 회 (회귀 없음)

## Return (under 200 words)

1. PR URL
2. tsc / lint / build 결과
3. 3 provider × 4 step (4-7) × 호출 횟수 매트릭스 — 전부 1 회 확인
4. Admin InfraCard 회귀 없음 확인
5. Spec deviation 있으면 명시
