# Wave 14-B1c — AzureProjectPage God-Component Split

## Context
Audit §B1 🔴 + §C1 🔴. `AzureProjectPage.tsx` = **405 LOC + 15 useState**. Split 로 C1 (state sprawl) 자연 해소 기대.

## Precondition
```
cd /Users/study/pii-agent-demo
git fetch origin main
target="app/integration/target-sources/[targetSourceId]/_components/azure/AzureProjectPage.tsx"
[ -f "$target" ] || { echo "✗ path drifted"; exit 1; }
loc=$(wc -l < "$target")
states=$(grep -c useState "$target")
echo "LOC=$loc useState=$states (baselines 405/15)"
```

## Step 1: Worktree
```
bash scripts/create-worktree.sh --topic wave14-b1c-azure-split --prefix refactor
cd /Users/study/pii-agent-demo-wave14-b1c-azure-split
```

## Step 2: Required reading
1. 전체 AzureProjectPage.tsx
2. `app/integration/target-sources/[targetSourceId]/_components/azure/` 하위 기존 파일 (`AzureSubnetGuide` 등)
3. `.claude/skills/anti-patterns/SKILL.md` §B1, §C1, §D6
4. wave11-B1 (useReducer) + wave12-B1 (split) + wave12-B3 (useInstallationStatus) 패턴
5. 소비처: `grep -rln "AzureProjectPage" app --include="*.tsx"`

## Step 3: State 분류 후 split 전략

### 3-1. 15 useState 를 3 cluster 로 분류

Grep 결과 (line 80–95):

| Cluster | States | 추출처 |
|---------|--------|--------|
| **A. Settings/data fetch** | `fallbackSettings`, `catalogResources`, `latestApprovalRequest`, `approvedIntegration`, `confirmedIntegration`, `resourceLoading`, `resourceLoaded`, `resourceError` (~8) | `useAzureProjectData` 훅 (wave12-B3 의 `useInstallationStatus` 류) |
| **B. VM config form** | `selectedIds`, `draftVmConfigs`, `expandedVmId` (~3) | `useVmConfigForm` 훅 + 사용 컴포넌트 |
| **C. Approval modal** | `approvalModalOpen`, `approvalError`, `submitting` (~3) | wave11-B2 QueueBoard 처럼 discriminated union 또는 modal-local state |

useState 한 개만 남겨도 되면 reducer 불요. **target: 소비 useState 3 개 이하**.

### 3-2. 타겟 구조

```
app/integration/target-sources/[targetSourceId]/_components/azure/
├── AzureProjectPage.tsx              (main, ≤ 220 LOC)
├── useAzureProjectData.ts            (cluster A 훅, ~80 LOC)
├── useVmConfigForm.ts                (cluster B 훅, ~60 LOC)
└── (기존 파일 유지)
```

Modal state (cluster C) 는 크기 작아 main 안에서 discriminated union 으로 압축 or local state 유지 (spec scope 조절).

### 3-3. `useAzureProjectData`

```ts
export interface AzureProjectData {
  settings: AzureV1Settings | null;
  catalogResources: ConfirmResourceItem[];
  latestApprovalRequest: ApprovalHistoryResponse['content'][number] | null;
  approvedIntegration: ApprovedIntegrationResponse['approved_integration'] | null;
  confirmedIntegration: ConfirmedIntegrationResponse;
  loading: boolean;
  loaded: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useAzureProjectData(targetSourceId: number): AzureProjectData { ... }
```

- 여러 API 호출 `Promise.all` 로 병렬
- 에러는 `ERROR_MESSAGES.STATUS_FETCH_FAILED` fallback (wave11-A1 정책 준수)
- wave12-B3 의 `useInstallationStatus` 패턴 참고 (ref-based callback stability)

### 3-4. `useVmConfigForm`

```ts
interface VmConfigFormState {
  selectedIds: string[];
  draftVmConfigs: Record<string, VmDatabaseConfig>;
  expandedVmId: string | null;
}

export function useVmConfigForm(initial?: Partial<VmConfigFormState>) {
  // useReducer 또는 combined useState — 관련 set* 함수들을 노출
  return { selectedIds, draftVmConfigs, expandedVmId, select, setConfig, expand, reset };
}
```

복잡도에 따라 useReducer vs useState 조합 선택. 스펙 scope: "작동만 하면 OK", 내부 구현 선택은 agent.

### 3-5. Approval modal 압축 (optional)

```ts
type ApprovalState =
  | { status: 'closed' }
  | { status: 'open' }
  | { status: 'submitting' }
  | { status: 'error'; message: string };

const [approval, setApproval] = useState<ApprovalState>({ status: 'closed' });
```

위 3 useState 를 1 로. wave11-B2 패턴.

## Step 4: Do NOT touch
- Main `AzureProjectPage` 의 prop 계약
- JSX 렌더 로직 / styling (cn/theme 교체 제외)
- API layer
- Azure 하위 기존 파일 (AzureSubnetGuide, AzurePeApprovalGuide, AzureResourceList)
- process-status 하위 (AzureInstallationInline — wave12-B3 범위)

## Step 5: Verify
```
npx tsc --noEmit
npm run lint -- app/integration/target-sources/[targetSourceId]/_components/azure/
npm run build
```

목표:
- `wc -l AzureProjectPage.tsx` ≤ 220
- `grep -c useState AzureProjectPage.tsx` ≤ 3

수동 검증:
- Azure 프로젝트 상세 페이지 렌더
- VM 선택/설정/전개 UI 정상 동작
- Approval 요청 모달 열기/제출/에러/닫기 full loop
- Refresh 동작
- Scan 결과와 resource table 연동

## Step 6: Commit + push + PR

```
git add app/integration/target-sources/[targetSourceId]/_components/azure/
git commit -m "refactor(azure): split AzureProjectPage data/form hooks (wave14-B1c)

Audit §B1 (405 LOC god) + §C1 (15 useState).

- useAzureProjectData hook 추출 (settings/catalog/approval/confirmed/resource fetch + loading/error 통합)
- useVmConfigForm hook 추출 (selectedIds/draftVmConfigs/expandedVmId)
- Approval modal state 3 useStates → 1 discriminated union (wave11-B2 pattern)
- Main: 405 → ~220 LOC, 15 → 3 useState

No prop contract change, no consumer modification."
git push -u origin refactor/wave14-b1c-azure-split
```

PR body (`/tmp/pr-wave14-b1c-body.md`):
```
## Summary
Split `AzureProjectPage.tsx` (405 LOC, 15 useState) into lean main + 2 extracted hooks, addressing both B1 (god-component) and C1 (state sprawl).

## Changes
- `useAzureProjectData.ts` (new, ~80 LOC) — 5 data fetches + 3 loading/error states
- `useVmConfigForm.ts` (new, ~60 LOC) — VM config form cluster
- `AzureProjectPage.tsx` — 405 → ≤ 220 LOC, 15 → ≤ 3 useState
- Approval modal 3 booleans → 1 discriminated union (wave11-B2 pattern)

## Why
2 audit items at once. Hook extraction is surgical (JSX unchanged). Follows wave11-B1/B2 + wave12-B3 patterns.

## Deliberately excluded
- JSX / rendering / styling
- Prop contract, consumers
- API layer
- Sibling Azure components (AzureSubnetGuide, PeApprovalGuide, ResourceList, InstallationInline)

## Verify
- [x] tsc, lint, build
- [x] Manual: VM selection/config/expand, approval full loop, refresh
- [x] Final useState count ≤ 3

## Parallel coordination
- Safe with B1a, B1b, C1 (AdminDashboard), E1b
```

## ⛔ Do NOT auto-merge
Stop at `gh pr create`. Report the URL.

## Return (under 200 words)
1. PR URL
2. tsc / lint / build
3. LOC + useState before/after
4. Hook 선택: useReducer vs 결합 useState (근거)
5. Approval modal 압축 여부 (discriminated union or 유지)
6. `useAzureProjectData` 의 concurrent fetch 전략 (Promise.all vs sequential)
7. Deviations with rationale

## Parallel coordination
- **파일 overlap 없음**: 대상이 `_components/azure/` 하위만
  - wave14-B1a (`dashboard/SystemsTable`)
  - wave14-B1b (`_components/idc/IdcProcessStatusCard`)
  - wave14-C1 (`AdminDashboard`)
  - wave14-E1b (`features/idc/IdcResourceInputPanel`)
- 전 병렬 안전
