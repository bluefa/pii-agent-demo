# Phase 2 — `IntegrationTargetInfoCard` 신규 + step 4-7 분기

## Context

- 감사 문서: `docs/reports/resource-data-source-audit-2026-04-23.md` §4.2 / §4.4.2
- 의존: **Phase 1 (mock fix) 머지 완료 후 시작.** Phase 1 가 confirmed-integration 응답을 step 4 부터 채우도록 수정해야 검증 가능.

## Goal

Step 4-7 (INSTALLING / WAITING_CONNECTION_TEST / CONNECTION_VERIFIED / INSTALLATION_COMPLETE) 에서 사용할 신규 카드 컴포넌트 추가:

- 제목: "연동 대상 정보"
- 부연: "관리자 확정된 연동 대상 DB 목록입니다"
- Run Infra Scan 버튼 / Last Scan 타임스탬프 / 체크박스 / 셀렉터 일체 없음
- 자체 `getConfirmedIntegration` 호출 (부모 prefetch 금지)
- Read-only 표

기존 `DbSelectionCard` 는 step 1-2 에서만 사용하도록 좁힘. step 3 은 `ResourceTransitionPanel` 유지 (Phase 2 범위 밖, Phase 4 또는 별도 wave 에서 데이터 소스 교체).

## 알려진 과도기 상태 (Phase 2 머지 직후 ~ Phase 4 머지 전)

**step 4-7 에서 confirmed-integration 이 중복 호출됨**:

- 신규 `IntegrationTargetInfoCard` — 마운트 시 1회 (본 PR 에서 추가)
- `loadAzureResources` / `loadGcpResources` — 페이지 마운트 시 1회 (Phase 4 까지 유지)

즉 Azure/GCP step 4-7 진입 시 **동일 API 가 2회** 호출됨. AWS 는 `loadAws*` 가 없어 신규 카드의 1회만 호출됨.

이 중복은 **의도된 과도기**:
- Phase 2 에서 `loadAzureResources` / `loadGcpResources` 를 건드리지 않는 이유는 — 이들은 step 1-3 의 `buildAzureOwnedResources` / catalog-confirmed merge 에도 쓰이기 때문. Phase 4 가 `project.resources` 폐기 + builder 해체와 함께 묶어야 안전.
- Phase 4 머지 후에는 load 함수가 step ≤ 3 한정 catalog-only 로 재편되면서 step 4-7 에서는 신규 카드의 1회만 남음 → "single-source" 달성.

Phase 2 PR description 에 이 과도기를 명시하고, 네트워크 탭 스크린샷으로 Phase 2 머지 직후 Azure/GCP 에 2회 호출이 보이는 것을 문서화 (검증 기준이 "0 중복" 이 아니라 "신규 카드가 자체 fetch 하는가" 임을 분명히 함).

## "Single-source" 달성 기준 정의 (acceptance)

| Phase 머지 후 | step 4-7 의 confirmed-integration 호출 횟수 | 단일 소스? |
|---|---|---|
| Phase 2 (본 PR) | AWS 1 / Azure 2 / GCP 2 | ❌ 과도기 |
| Phase 4 | AWS 1 / Azure 1 / GCP 1 | ✅ 완료 |

Phase 2 의 성공 조건은 "신규 카드가 자체 fetch 한다" + "`IntegrationTargetInfoCard` 가 step 4-7 에서 렌더된다" 까지. **중복 제거는 Phase 4 의 성공 조건**.

## Precondition

```bash
cd /Users/study/pii-agent-demo
git fetch origin main
[ -f app/components/features/scan/DbSelectionCard.tsx ] || { echo "✗ source missing"; exit 1; }
[ -f app/integration/target-sources/[targetSourceId]/_components/aws/AwsProjectPage.tsx ] || { echo "✗ source missing"; exit 1; }
[ -f app/integration/target-sources/[targetSourceId]/_components/azure/AzureProjectPage.tsx ] || { echo "✗ source missing"; exit 1; }
[ -f app/integration/target-sources/[targetSourceId]/_components/gcp/GcpProjectPage.tsx ] || { echo "✗ source missing"; exit 1; }

# Phase 1 머지 확인
git log origin/main --oneline -20 | grep -i "resource-mock-fix" || \
  { echo "✗ Phase 1 (resource-mock-fix) 가 origin/main 에 머지되지 않음"; exit 1; }
```

## Step 1 — Worktree

```bash
bash scripts/create-worktree.sh --topic integration-target-info-card --prefix feat
cd /Users/study/pii-agent-demo-integration-target-info-card
```

## Step 2 — Required reading

1. `docs/reports/resource-data-source-audit-2026-04-23.md` §4.2, §4.4
2. `app/components/features/scan/DbSelectionCard.tsx` — 현재 step 무관 카드 (참조)
3. `app/components/features/process-status/ResourceTransitionPanel.tsx` — step 3 (참조; 미변경)
4. `app/components/features/admin/infrastructure/InfraDbTable.tsx` — admin 의 read-only 표 (디자인 참조 가능)
5. `app/components/features/admin/infrastructure/InfraCardBody.tsx` — empty/error UI 패턴 참조
6. `app/lib/api/index.ts:333-338` — `getConfirmedIntegration` 시그니처
7. `app/lib/api/index.ts:217-235` — `ConfirmedIntegrationResourceItem` 형식
8. 3 provider 페이지 step 분기 (수정 대상):
   - `app/integration/target-sources/[targetSourceId]/_components/aws/AwsProjectPage.tsx:191-221`
   - `app/integration/target-sources/[targetSourceId]/_components/azure/AzureProjectPage.tsx:371-395`
   - `app/integration/target-sources/[targetSourceId]/_components/gcp/GcpProjectPage.tsx:256-306`

## Step 3 — Implementation

### 3-1. 신규 컴포넌트 — `IntegrationTargetInfoCard`

위치: `app/components/features/integration-target-info/IntegrationTargetInfoCard.tsx`
(또는 `app/components/features/scan/` 와 같은 레벨에 두는 게 맞다면 그 위치. 권장은 새 폴더)

```tsx
'use client';

import { useEffect, useState } from 'react';
import { getConfirmedIntegration } from '@/app/lib/api';
import type { ConfirmedIntegrationResourceItem } from '@/app/lib/api';
import { cardStyles, cn, textColors } from '@/lib/theme';
import { LoadingSpinner } from '@/app/components/ui/LoadingSpinner';

interface IntegrationTargetInfoCardProps {
  targetSourceId: number;
}

type FetchState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; resources: ConfirmedIntegrationResourceItem[] };

export const IntegrationTargetInfoCard = ({ targetSourceId }: IntegrationTargetInfoCardProps) => {
  const [state, setState] = useState<FetchState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });

    void getConfirmedIntegration(targetSourceId)
      .then((response) => {
        if (cancelled) return;
        setState({ status: 'ready', resources: response.resource_infos });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof Error && error.message.includes('CONFIRMED_INTEGRATION_NOT_FOUND')) {
          setState({ status: 'ready', resources: [] });
          return;
        }
        const message = error instanceof Error ? error.message : '연동 대상 정보를 불러오지 못했습니다.';
        setState({ status: 'error', message });
      });

    return () => {
      cancelled = true;
    };
  }, [targetSourceId]);

  return (
    <section className={cn(cardStyles.base, 'overflow-hidden')}>
      <header className="px-6 py-4 border-b border-gray-100">
        <h2 className="text-[15px] font-semibold text-gray-900">연동 대상 정보</h2>
        <p className={cn('mt-1 text-xs', textColors.tertiary)}>
          관리자 확정된 연동 대상 DB 목록입니다.
        </p>
      </header>
      <div className="px-6 py-6">
        {renderBody(state)}
      </div>
    </section>
  );
};

function renderBody(state: FetchState) {
  if (state.status === 'loading') {
    return (
      <div className="flex items-center justify-center gap-3 py-8">
        <LoadingSpinner />
        <span className="text-sm text-gray-500">불러오는 중...</span>
      </div>
    );
  }
  if (state.status === 'error') {
    return (
      <div className="text-sm text-red-600 py-4">{state.message}</div>
    );
  }
  if (state.resources.length === 0) {
    return (
      <div className="text-sm text-gray-500 py-8 text-center">
        확정된 연동 대상 DB 가 없습니다.
      </div>
    );
  }
  return (
    <table className="w-full text-sm">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">리소스 ID</th>
          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">유형</th>
          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">DB 타입</th>
          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Credential</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {state.resources.map((resource) => (
          <tr key={resource.resource_id}>
            <td className="px-3 py-2 font-mono text-xs text-gray-700">{resource.resource_id}</td>
            <td className="px-3 py-2 text-xs text-gray-600">{resource.resource_type}</td>
            <td className="px-3 py-2 text-xs text-gray-600">{resource.database_type ?? '-'}</td>
            <td className="px-3 py-2 text-xs text-gray-600">{resource.credential_id ?? '-'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

세부:
- 컬러는 `lib/theme` 토큰 우선. 위 sketch 의 `text-gray-*`, `bg-gray-50` 등은 토큰화 (`textColors.*`, `bgColors.*`) 로 정리.
- `LoadingSpinner` 가 없는 위치라면 `app/components/ui/LoadingSpinner` 경로 검증 후 import.
- `ConfirmedIntegrationResourceItem` 의 정확한 필드는 `app/lib/api/index.ts` 와 `lib/issue-222-approval.ts` 에서 확인.

### 3-2. `index.ts` barrel

`app/components/features/integration-target-info/index.ts`:
```ts
export { IntegrationTargetInfoCard } from './IntegrationTargetInfoCard';
```

### 3-3. 3 Provider 페이지 step 분기 변경

각 provider 페이지의 step 분기를 다음 패턴으로:

```tsx
{currentStep === ProcessStatus.APPLYING_APPROVED ? (
  <ResourceTransitionPanel
    targetSourceId={project.targetSourceId}
    resources={...}
    cloudProvider={project.cloudProvider}
    processStatus={currentStep}
  />
) : currentStep >= ProcessStatus.INSTALLING ? (
  <IntegrationTargetInfoCard targetSourceId={project.targetSourceId} />
) : (
  <DbSelectionCard
    targetSourceId={project.targetSourceId}
    cloudProvider={project.cloudProvider}
    {...}
  />
)}
```

⛔ DbSelectionCard prop / ResourceTransitionPanel prop 의 `resources` 출처는 **이번 spec 에서 변경하지 않음**. Phase 4 가 처리.

대상 파일:
- `app/integration/target-sources/[targetSourceId]/_components/aws/AwsProjectPage.tsx:191-221`
- `app/integration/target-sources/[targetSourceId]/_components/azure/AzureProjectPage.tsx:371-395`
- `app/integration/target-sources/[targetSourceId]/_components/gcp/GcpProjectPage.tsx:256-306`

### 3-4. (선택) Admin `InfraCard` empty state 정상화

본 spec 의 직접 범위는 아니지만 같은 데이터 흐름이라 함께 처리하면 깔끔:

`app/components/features/admin/infrastructure/InfraCard.tsx:39-49` — 404 (`CONFIRMED_INTEGRATION_NOT_FOUND`) 를 catch 분기에서 empty 로 폴백. 그 외 에러만 error 상태.

```ts
} catch (error: unknown) {
  if (error instanceof Error && error.message.includes('CONFIRMED_INTEGRATION_NOT_FOUND')) {
    setConfirmedResources([]);
    setFetchState('idle');
    return;
  }
  setConfirmedResources([]);
  setFetchState('error');
}
```

이 변경을 본 PR 에 포함할지는 자유. 포함 시 PR description 에 명시.

## Step 4 — Do NOT touch

- `Project.resources` 필드 / normalizer / mock get → Phase 4
- `ProcessStatusCard` 의 `hasConfirmedIntegration` / `ConfirmedIntegrationCollapse` 사용 → Phase 3
- `loadAzureResources` / `loadGcpResources` / `buildAzureOwnedResources` → Phase 4
- `ResourceTransitionPanel` 데이터 소스 교체 → Phase 4 또는 별도 wave
- IDC / SDU 페이지

## Step 5 — Verify

```bash
npx tsc --noEmit
npm run lint -- app/components/features/integration-target-info/ \
  app/integration/target-sources/[targetSourceId]/_components/aws/AwsProjectPage.tsx \
  app/integration/target-sources/[targetSourceId]/_components/azure/AzureProjectPage.tsx \
  app/integration/target-sources/[targetSourceId]/_components/gcp/GcpProjectPage.tsx
npm run build
```

수동:
1. `bash scripts/dev.sh /Users/study/pii-agent-demo-integration-target-info-card`
2. step 4 (INSTALLING) AWS / Azure / GCP TS 각 1개씩 진입
3. "연동 대상 정보" 카드 렌더 확인
4. Run Infra Scan / Last Scan / 체크박스 / 셀렉터 없음 확인
5. confirmed-integration 응답이 비어있으면 "확정된 연동 대상 DB 가 없습니다." empty state
6. step 5/6/7 도 동일 카드 렌더 확인

## Step 6 — Commit / push / PR

```
feat(scan): IntegrationTargetInfoCard 신규 + step 4-7 분기 (integration-target-info-card)

근거: docs/reports/resource-data-source-audit-2026-04-23.md §4.2, §4.4.2.

- IntegrationTargetInfoCard 신규: step 4-7 read-only 카드, 자체 getConfirmedIntegration 호출
- AWS/Azure/GCP provider 페이지 step 분기: APPLYING_APPROVED → ResourceTransitionPanel, INSTALLING+ → 신규 카드, else → DbSelectionCard
- (옵션 포함 시) Admin InfraCard 의 404 → empty 폴백

Phase 2 / 4 phases.

Out of scope (Phase 4):
- DbSelectionCard / ResourceTransitionPanel 의 resources prop 출처 변경
- project.resources 필드 제거
```

## Step 7 — Self-review

`/sit-recurring-checks`, `/simplify`, `/vercel-react-best-practices` 순차.

## Return (under 200 words)

1. PR URL
2. tsc / lint / build 결과
3. 신규 파일 / 수정 파일 목록
4. step 4-7 진입 시 confirmed-integration 호출 횟수 (네트워크 탭 기준 1회 기대)
5. Spec 대비 deviation
