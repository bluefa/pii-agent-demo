# S4G-W1b — Common DB List + Task Detail Modal

> **Recommended model**: **Opus 4.7 MAX** (두 source join + 신규 modal + 탭 카운트 + per-resource state mapping)
> **Estimated LOC**: ~380 (~250 component + ~130 tests)
> **Branch prefix**: `feat/sit-step4-gcp-w1b-db-table-and-modal`
> **Depends on**: S4G-W1a (merged)

## Context

Step 4 GCP 분기의 **하단 공용 DB List + Task Detail Modal** 구현.

작업 범위:

1. **`Step4DbListTable`** 신규 — 공용 DB List 테이블 (시안 line 1755–1789)
   - 컬럼: `DB Type / Resource ID / Region / DB Name / 서비스 리소스 상태`
   - GCP installation-status + confirmed-integration **두 source join** 으로 행 데이터 구성
2. **`InstallTaskDetailModal`** 신규 — 카드 클릭 시 리소스별 진행 상태 (시안 line 2328–2360)
   - 탭: `전체` / `완료` / `진행중` (각 카운트 표시)
   - 행: `Resource ID / DB Type / Region / 진행 완료 여부`
3. **W1a 의 `InstallTaskPipeline` onClick wiring** — 카드 클릭 시 modal open + 클릭한 step 정보 전달.
4. `GcpInstallationInline.tsx` 에서 두 컴포넌트 통합.

⛔ **사용자 결정 (Q4G-2) 반영**: "서비스 리소스 상태" 컬럼은 per-resource `installationStatus` (`COMPLETED` / `IN_PROGRESS` / `FAIL`) 로 분기. **3-card aggregate 가 아님**.

## Precondition

```bash
cd /Users/study/pii-agent-demo
git fetch origin main
[ -f app/components/features/process-status/install-task-pipeline/InstallTaskPipeline.tsx ] || { echo "✗ S4G-W1a 미머지"; exit 1; }
[ -f app/components/features/process-status/install-task-pipeline/InstallTaskCard.tsx ] || { echo "✗ S4G-W1a 미머지"; exit 1; }
[ -f app/integration/target-sources/'[targetSourceId]'/_components/data/ConfirmedIntegrationDataProvider.tsx ] || { echo "✗ ConfirmedIntegrationDataProvider 부재"; exit 1; }
grep -q "GCP_STEP_PIPELINE_LABELS" lib/constants/gcp.ts || { echo "✗ S4G-W1a label 미반영"; exit 1; }
```

## Required reading

1. `design/app/SIT Prototype v2.html` line 1755–1789 (공용 DB List) + line 2328–2360 (Task Detail Modal) + line 879–906 (탭 CSS)
2. `app/components/features/process-status/gcp/GcpInstallationInline.tsx` (수정 대상 — W1a 의 산출 반영 후)
3. `app/components/features/process-status/gcp/GcpResourceStatusTable.tsx` 전체 — 제거 대상 (시안 컬럼 다름)
4. `app/integration/target-sources/[targetSourceId]/_components/data/ConfirmedIntegrationDataProvider.tsx` — confirmed-integration 데이터 provider
5. `app/integration/target-sources/[targetSourceId]/_components/layout/CloudInstallingStep.tsx` — provider context wrap 위치
6. `lib/types/resources/confirmed.ts` — `ConfirmedResource` (region / databaseName 부재 확인)
   - `lib/types/resources/approved.ts` — `ApprovedResource` (region / databaseName 부재 확인)
   - `lib/types/resources/index.ts` — barrel
7. `lib/constants/gcp.ts` — W1a 가 추가한 label / pipeline builder
8. `app/api/_lib/v1-types.ts` line 142–179 — `GcpResourceStatus` / `GcpInstallationStatusValue` / `GcpStepStatus`
9. `app/components/ui/Modal.tsx` 전체 — 기존 일반 modal shell. 본 wave 의 Task Detail Modal 이 재사용 (또는 inline 으로 구성)
   - ⚠️ S2-W1d 의 `ConfirmStepModal` 은 본 wave 가 머지될 시점에 존재하지 않을 수 있음. **Step 4 GCP 는 Step 2 wave 와 독립**이므로 `Modal.tsx` 만 reference
10. `lib/theme.ts` — `tagStyles` / `tableStyles`
11. `docs/reports/sit-step4-gcp/00-README.md` §9 (디자인 원칙)

## Step 1: Worktree

```bash
bash scripts/create-worktree.sh --topic sit-step4-gcp-w1b-db-table-and-modal --prefix feat
```

## Step 2: 두 source join 헬퍼

### 위치: `app/components/features/process-status/install-task-pipeline/join-installation-resources.ts` (~60 LOC)

⚠️ **데이터 source gap 인지**: `ConfirmedResource` (`lib/types/resources/confirmed.ts`) 는 `resourceId / type / databaseType / host / port / oracleServiceId / networkInterfaceId / ipConfigurationName / credentialId / connectionStatus` 만 가지고 있고, **`region` / `databaseName` 필드는 부재**. 동일하게 `ApprovedResource` (`approved.ts`) 도 부재.

→ Region / DB Name 의 source 결정:
- (a) 본 wave 에서 두 컬럼을 `—` 로 노출 + sub-issue 로 분리 — **임시 결정 (현재 BFF/타입 으로 채울 수 없으므로)**
- (b) `confirmedIntegrationToConfirmed` (`lib/resource-catalog`) + `ConfirmedResource` 타입 확장하여 `database_region` / `resource_name` 보존 — BFF 응답 (`ResourceConfigDto`) 에 필드 존재 (S2-W1a 가 enum 만, 메타는 별도). 본 wave 에서 ConfirmedResource 까지 손대는 것은 scope 초과.
- (c) `getResources` catalog 를 별도 fetch 하여 메타 join — 추가 네트워크 요청 비용.

본 plan **임시 결정: (a)**. Region / DB Name 은 `—` 표시. 별도 issue (예: "Step 4 DB List Region/DB Name 노출 — ConfirmedResource 확장") 로 분리하여 후속 wave 에서 (b) 진행.

```ts
import type { GcpResourceStatus, GcpInstallationStatusValue } from '@/app/api/_lib/v1-types';
import type { ConfirmedResource } from '@/lib/types/resources/confirmed';

export interface Step4ResourceRow {
  resourceId: string;
  databaseType?: string;
  /** 현재 ConfirmedResource 에 부재 — null 표시. 후속 wave 가 source 추가. */
  region?: string;
  /** 현재 ConfirmedResource 에 부재 — fallback 으로 GcpResourceStatus.resourceName 사용. */
  databaseName?: string;
  installationStatus: GcpInstallationStatusValue;
  source: GcpResourceStatus;
}

/**
 * GCP installation-status 응답 + confirmed-integration 응답을 resourceId 로 join.
 * confirmed-integration 미존재 또는 매칭 안 되는 리소스는 메타 필드만 undefined 로 채움.
 */
export const joinGcpResources = (
  installation: GcpResourceStatus[],
  confirmed: readonly ConfirmedResource[],
): Step4ResourceRow[] => {
  const confirmedById = new Map<string, ConfirmedResource>(
    confirmed.map((r) => [r.resourceId, r]),
  );

  return installation.map((r) => {
    const c = confirmedById.get(r.resourceId);
    return {
      resourceId: r.resourceId,
      databaseType: c?.databaseType ?? undefined,
      region: undefined,                            // (a) 임시 — 후속 wave 가 채움
      databaseName: r.resourceName ?? undefined,    // GCP installation-status 의 resourceName 만 사용
      installationStatus: r.installationStatus,
      source: r,
    };
  });
};
```

⛔ `ConfirmedResource.region` / `ConfirmedResource.databaseName` 사용 금지 (실제 부재).

## Step 3: `Step4DbListTable` 컴포넌트 신규

### 위치: `app/components/features/process-status/install-task-pipeline/Step4DbListTable.tsx` (~120 LOC)

```tsx
'use client';

import { cn, tableStyles, bgColors, textColors, borderColors, tagStyles } from '@/lib/theme';
import type { GcpInstallationStatusValue } from '@/app/api/_lib/v1-types';
import type { Step4ResourceRow } from './join-installation-resources';

interface Step4DbListTableProps {
  rows: Step4ResourceRow[];
}

const STATUS_LABEL: Record<GcpInstallationStatusValue, string> = {
  COMPLETED: '완료',
  IN_PROGRESS: '진행중',
  FAIL: '실패',
};

const STATUS_TAG: Record<GcpInstallationStatusValue, string> = {
  COMPLETED: tagStyles.green,    // 시안 line 1774: tag green
  IN_PROGRESS: tagStyles.orange, // 시안 line 1781: tag orange
  FAIL: tagStyles.red,           // 시안 미정의 — Q4G-2 답변에 따라 FAIL 추가 케이스 대응
};
// ⚠️ semantic alias (success/warning/error) 는 W1c 가 theme.ts 에 추가. 본 wave 는 색상 키 직접 사용.

export const Step4DbListTable = ({ rows }: Step4DbListTableProps) => {
  if (rows.length === 0) {
    return (
      <div className={cn('px-4 py-3 rounded-lg border text-sm', borderColors.default, textColors.tertiary)}>
        설치 대상 리소스가 없습니다.
      </div>
    );
  }

  return (
    <div className={cn('overflow-hidden rounded-lg border', borderColors.default)}>
      <table className="w-full text-sm">
        <thead className={bgColors.muted}>
          <tr>
            <th className={cn(tableStyles.headerCell, 'text-left text-xs font-semibold uppercase tracking-wide', textColors.tertiary)}>DB Type</th>
            <th className={cn(tableStyles.headerCell, 'text-left text-xs font-semibold uppercase tracking-wide', textColors.tertiary)}>Resource ID</th>
            <th className={cn(tableStyles.headerCell, 'text-left text-xs font-semibold uppercase tracking-wide', textColors.tertiary)}>Region</th>
            <th className={cn(tableStyles.headerCell, 'text-left text-xs font-semibold uppercase tracking-wide', textColors.tertiary)}>DB Name</th>
            <th className={cn(tableStyles.headerCell, 'text-left text-xs font-semibold uppercase tracking-wide', textColors.tertiary)}>서비스 리소스 상태</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.resourceId} className={cn(tableStyles.row, 'border-t', borderColors.light)}>
              <td className={tableStyles.cell}>
                {row.databaseType ? <span className={tagStyles.blue}>{row.databaseType}</span> : <span>—</span>}
              </td>
              <td className={cn(tableStyles.cell, 'font-mono text-[12px]', textColors.secondary)}>
                {row.resourceId}
              </td>
              <td className={cn(tableStyles.cell, 'font-mono text-[12px]', textColors.secondary)}>
                {row.region ?? '—'}
              </td>
              <td className={cn(tableStyles.cell, 'font-mono text-[12px]', textColors.secondary)}>
                {row.databaseName ?? '—'}
              </td>
              <td className={tableStyles.cell}>
                <span className={STATUS_TAG[row.installationStatus]}>
                  {STATUS_LABEL[row.installationStatus]}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
```

⛔ null/undefined → `—` (em-dash) 통일 (00-README §11).

## Step 4: `InstallTaskDetailModal` 컴포넌트 신규

### 위치: `app/components/features/process-status/install-task-pipeline/InstallTaskDetailModal.tsx` (~150 LOC)

#### 4.1. Props

```ts
import type { GcpStepKey } from '@/lib/constants/gcp';
import type { Step4ResourceRow } from './join-installation-resources';

interface InstallTaskDetailModalProps {
  open: boolean;
  onClose: () => void;
  /** 클릭한 step (title 표시 + 어떤 step status 를 보여줄지 결정) */
  stepKey: GcpStepKey | null;
  rows: Step4ResourceRow[];
}
```

#### 4.2. 시안 정합

- 시안 line 2328–2360 의 modal:
  - title: 클릭한 step 의 라벨 (예: `서비스 측 리소스 설치 진행`)
  - sub: `리소스별 설치 진행 현황을 확인할 수 있어요.`
  - 탭: `전체` / `완료` / `진행중` + 각 카운트
  - 표 컬럼: `Resource ID / DB Type / Region / 진행 완료 여부`
  - 확인 버튼

#### 4.3. 탭 / 카운트 / 필터

```tsx
type Tab = 'all' | 'done' | 'running';

// stepKey 가 결정되면 그 step 의 status 를 기준으로 분류
const filterRows = (rows: Step4ResourceRow[], stepKey: GcpStepKey, tab: Tab): Step4ResourceRow[] => {
  return rows.filter((row) => {
    const stepStatus = row.source[stepKey].status;
    if (stepStatus === 'SKIP') return false;     // 모든 탭에서 skip 제외
    if (tab === 'all') return true;
    if (tab === 'done') return stepStatus === 'COMPLETED';
    if (tab === 'running') return stepStatus === 'IN_PROGRESS' || stepStatus === 'FAIL';
    return false;
  });
};
```

⚠️ "진행중" 탭에 FAIL 도 포함할지는 시안에 명시 없음. 본 plan 임시 결정: **포함** (사용자 액션 필요한 상태). reviewer 검토 후 별도 탭 추가 고려.

#### 4.4. 진행 완료 여부 셀

```tsx
const STEP_STATUS_LABEL = {
  COMPLETED: '완료',
  IN_PROGRESS: '진행중',
  FAIL: '실패',
  SKIP: '해당없음',
};
```

#### 4.5. 탭 segmented control (시안 line 879–906 정합)

```tsx
const tabClass = (active: boolean) => cn(
  'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md',
  'text-[12.5px] font-semibold cursor-pointer',
  active
    ? 'bg-white shadow-[0_1px_2px_rgba(0,0,0,0.06)] text-gray-900'
    : 'bg-transparent text-gray-500',
);

const countBadgeClass = (active: boolean) => cn(
  'inline-block min-w-[18px] px-1.5 py-px rounded-full text-[11px] font-bold text-center',
  active ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500',
);
```

→ W1c 가 token 화 (`tabStyles.segmented`).

#### 4.6. Modal 외곽

기존 `app/components/ui/Modal.tsx` 의 외곽 / backdrop / focus trap 재사용. width 는 시안의 `.logical-modal` (line 915–917): **`width: 880px`** — `w-[880px]` 사용.

⛔ S2-W1d 의 `ConfirmStepModal` 컴포넌트 사용하지 않음 (Step 4 는 Step 2 wave 와 독립이며, ConfirmStepModal 은 confirm 액션 전용 — 본 modal 은 정보 표시).

기존 `Modal.tsx` 가 width 를 `max-w-2xl` 같은 default 로 강제하면 본 wave 에서 width prop 노출하도록 확장하거나 inline modal 로 작성.

## Step 5: `GcpInstallationInline.tsx` 수정 — modal state + onClick wiring

```tsx
import { useState } from 'react';
import { useConfirmedIntegration } from '@/app/integration/target-sources/[targetSourceId]/_components/data/ConfirmedIntegrationDataProvider';
import { joinGcpResources } from '@/app/components/features/process-status/install-task-pipeline/join-installation-resources';
import { Step4DbListTable } from '@/app/components/features/process-status/install-task-pipeline/Step4DbListTable';
import { InstallTaskDetailModal } from '@/app/components/features/process-status/install-task-pipeline/InstallTaskDetailModal';
import type { GcpStepKey } from '@/lib/constants/gcp';

// ... 기존 hook usage

const [openStep, setOpenStep] = useState<GcpStepKey | null>(null);
const { state: confirmedState } = useConfirmedIntegration();
const confirmedResources = confirmedState.status === 'ready' ? confirmedState.data : [];
const joined = joinGcpResources(resources, confirmedResources);

const pipelineItems = buildGcpPipelineItems(resources).map((item) => ({
  ...item,
  onClick: () => setOpenStep(item.key),
}));

return (
  <div className="w-full space-y-3">
    {/* 기존 헤더 / 새로고침 버튼 / 에러 banner */}
    <InstallTaskPipeline items={pipelineItems} />
    <Step4DbListTable rows={joined} />

    <InstallTaskDetailModal
      open={openStep !== null}
      onClose={() => setOpenStep(null)}
      stepKey={openStep}
      rows={joined}
    />
  </div>
);
```

⛔ **실제 export 는 `useConfirmedIntegration`** (not `useConfirmedIntegrationContext`). 반환 shape 는 `{ state: AsyncState<readonly ConfirmedResource[]>, retry: () => void }` 이므로 `state.status === 'ready'` 분기 필요. `confirmed` 라는 직접 필드는 없음.

⛔ `loading` / `error` 분기 시 빈 배열 fallback (`[]`) 으로 join 진행 — `Step4DbListTable` 자체 empty state 가 처리. 또는 별도 spinner / error banner 분기.

## Step 6: 기존 컴포넌트 정리

```bash
grep -rln "GcpResourceStatusTable" app/ | grep -v __tests__
```

→ `GcpInstallationInline.tsx` + barrel `app/components/features/process-status/gcp/index.ts` 만이면 삭제.
→ **`app/components/features/process-status/gcp/index.ts` 의 export 라인 제거 필수**:
```ts
// 제거 대상
export { GcpResourceStatusTable } from './GcpResourceStatusTable';
```

## Step 7: Tests

### 7.1. `join-installation-resources.test.ts` (~50 LOC)

- installation + confirmed 모두 매칭 → 메타 채워짐
- installation 에 있고 confirmed 에 없음 → 메타 undefined
- confirmed 에만 있고 installation 에 없음 → 결과 미포함 (installation 기준)
- 빈 배열 처리

### 7.2. `Step4DbListTable.test.tsx` (~50 LOC)

- 5개 컬럼 헤더 검증
- installationStatus 별 status pill 라벨 / class
- region / databaseName null → `—`
- empty state 카피

### 7.3. `InstallTaskDetailModal.test.tsx` (~80 LOC)

- 탭별 카운트 정확
- 탭 전환 시 행 필터 정확
- SKIP 인 리소스는 모든 탭에서 제외
- step 별 title 정확
- ESC / backdrop click → onClose
- 빈 행 시 empty state

### 7.4. `GcpInstallationInline.integration.test.tsx` (~40 LOC)

- 카드 클릭 → modal open + 해당 step 의 행만 노출
- modal close → state reset

## Step 8: Self-Audit

`/sit-recurring-checks` + `/simplify` + `/vercel-react-best-practices`.

추가:
- 카피 매칭:
  ```bash
  grep -F "서비스 리소스 상태" app/components/features/process-status/install-task-pipeline/
  grep -F "리소스별 설치 진행 현황을 확인할 수 있어요" app/components/features/process-status/install-task-pipeline/
  grep -F "진행 완료 여부" app/components/features/process-status/install-task-pipeline/
  ```
- Provider 영향 없음 검증:
  ```bash
  git diff --name-only origin/main...HEAD | grep -E "(azure|aws|idc|sdu)" && exit 1 || echo "✓ GCP 외 변경 없음"
  ```

## Step 9: Verify

```bash
npx tsc --noEmit
npm run lint -- app/components/features/process-status/install-task-pipeline/
npm run test -- Step4DbListTable InstallTaskDetailModal join-installation-resources GcpInstallationInline
USE_MOCK_DATA=true npm run dev   # 수동 시나리오 검증
```

## Step 10: PR

```markdown
## Summary
- Spec: `docs/reports/sit-step4-gcp/S4G-W1b-db-table-and-modal.md` @ <SHA>
- Wave: S4G-W1b
- 의존: S4G-W1a (merged)
- 디자인 reference: `design/app/SIT Prototype v2.html` line 1755–1789 (DB List) + 2328–2360 (Modal)

## Changed files
- app/components/features/process-status/install-task-pipeline/join-installation-resources.ts (신규)
- app/components/features/process-status/install-task-pipeline/Step4DbListTable.tsx (신규)
- app/components/features/process-status/install-task-pipeline/InstallTaskDetailModal.tsx (신규)
- app/components/features/process-status/gcp/GcpInstallationInline.tsx — Step4DbListTable / Modal wiring + W1a pipeline onClick
- (조건부 삭제) app/components/features/process-status/gcp/GcpResourceStatusTable.tsx
- 테스트 신규/수정

## Manual verification
- [ ] 시안 line 1755–1789 (DB List) + 2328–2360 (Modal) 픽셀 비교 — 스크린샷 첨부
- [ ] Q4G-2: per-resource installationStatus 분기 (COMPLETED/IN_PROGRESS/FAIL) 표시 정상
- [ ] 카드 클릭 → modal open → 탭 전환 → 행 필터 정상
- [ ] confirmed-integration 미매칭 리소스 → DB Type / Region / DB Name 셀 `—`

## Deferred to later waves
- 디자인 토큰 정리 (`tabStyles.segmented` / `tagStyles.error` / arbitrary values) → S4G-W1c
```

## ⛔ 금지

- 시안 카피 변경.
- BFF 명세 변경.
- per-resource installationStatus 외 다른 source 로 "서비스 리소스 상태" 결정 (Q4G-2 위반).
- Provider (Azure/AWS) 컴포넌트 수정.
- S2-W1d 의 `ConfirmStepModal` 컴포넌트 props 변경 (본 wave 의 modal 은 별개 컴포넌트).
- `useApiMutation` 외 try/catch 직접 작성.
