# Wave 15-C1 — AWS/Azure/GCP ProjectPage 공통 훅 추출

## Context
Post-#342 (project.resources 의존 제거) 이후 AWS/Azure/GCP 3 provider ProjectPage 의 **useState 구조가 거의 동일**하게 수렴. **단일 훅 2개** 추출로 C1 3건 + B1 부분 해결.

## Audit baseline (main @ `a1c42fa`)

| 파일 | LOC | useState |
|------|-----|----------|
| `_components/aws/AwsProjectPage.tsx` | 302 | 11 |
| `_components/azure/AzureProjectPage.tsx` | 339 | 13 |
| `_components/gcp/GcpProjectPage.tsx` | 314 | 11 |

공통 useState (3 pages):
- `selectedIds: string[]`
- `vmConfigs` (or `draftVmConfigs` in Azure): `Record<string, VmDatabaseConfig>`
- `submitting: boolean`
- `approvalModalOpen: boolean`
- `approvalError: string | null`
- `expandedVmId: string | null`
- `resources: Resource[]`, `resourceLoading`, `resourceError`, `retryNonce`

Azure 고유:
- `fallbackSettings: AzureV1Settings | null`
- `resourceLoaded: boolean`

## Precondition
```
cd /Users/study/pii-agent-demo
git fetch origin main
for f in aws azure gcp; do
  cnt=$(grep -c useState app/integration/target-sources/\[targetSourceId\]/_components/$f/${f^}ProjectPage.tsx 2>/dev/null)
  echo "$f: $cnt useState"
done
# expected: aws=11 azure=13 gcp=11 (± minor drift)
```

## Step 1: Worktree
```
bash scripts/create-worktree.sh --topic wave15-c1-project-page-hooks --prefix refactor
cd /Users/study/pii-agent-demo-wave15-c1-project-page-hooks
```

## Step 2: Required reading
1. 3 provider ProjectPage full read
2. `#342` commit (`1e98162`) — 현재 patterns 이해
3. wave11-B1 (useReducer), wave12-B3 (useInstallationStatus 훅 패턴) 선례
4. `.claude/skills/anti-patterns/SKILL.md` §C1, §D3 (3-way 중복 hook)
5. 기존 `ApprovalRequestModal` 컴포넌트의 prop 계약

## Step 3: Hook 설계

### 3-1. `app/integration/target-sources/[targetSourceId]/_components/shared/useProjectPageFormState.ts`

VM 선택 + config + approval modal 을 하나로:

```ts
'use client';

import { useCallback, useState } from 'react';
import type { VmDatabaseConfig } from '@/lib/types';

export interface ProjectPageFormState {
  selectedIds: string[];
  vmConfigs: Record<string, VmDatabaseConfig>;
  submitting: boolean;
  approvalModalOpen: boolean;
  approvalError: string | null;
  expandedVmId: string | null;
}

export function useProjectPageFormState() {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [vmConfigs, setVmConfigs] = useState<Record<string, VmDatabaseConfig>>({});
  const [submitting, setSubmitting] = useState(false);
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const [expandedVmId, setExpandedVmId] = useState<string | null>(null);

  const openApprovalModal = useCallback(() => {
    setApprovalError(null);
    setApprovalModalOpen(true);
  }, []);

  const closeApprovalModal = useCallback(() => {
    setApprovalModalOpen(false);
    setApprovalError(null);
  }, []);

  const toggleExpanded = useCallback((id: string) => {
    setExpandedVmId((prev) => (prev === id ? null : id));
  }, []);

  return {
    selectedIds, setSelectedIds,
    vmConfigs, setVmConfigs,
    submitting, setSubmitting,
    approvalModalOpen, openApprovalModal, closeApprovalModal,
    approvalError, setApprovalError,
    expandedVmId, toggleExpanded,
  };
}
```

### 3-2. `app/integration/target-sources/[targetSourceId]/_components/shared/useProjectResources.ts`

리소스 fetch + retry:

```ts
'use client';

import { useCallback, useEffect, useState } from 'react';
import { ERROR_MESSAGES } from '@/lib/constants/messages';
import type { Resource } from '@/lib/types';

interface UseProjectResourcesOptions {
  targetSourceId: number;
  loadResources: (id: number) => Promise<Resource[]>;
  getErrorMessage?: (err: unknown) => string;
  onLoaded?: (resources: Resource[]) => void;
}

export interface UseProjectResourcesResult {
  resources: Resource[];
  loading: boolean;
  error: string | null;
  retryNonce: number;
  reload: () => void;
}

const defaultErrorMessage = (err: unknown) =>
  err instanceof Error ? err.message : ERROR_MESSAGES.STATUS_FETCH_FAILED;

export function useProjectResources({
  targetSourceId,
  loadResources,
  getErrorMessage = defaultErrorMessage,
  onLoaded,
}: UseProjectResourcesOptions): UseProjectResourcesResult {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  const reload = useCallback(() => setRetryNonce((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await loadResources(targetSourceId);
        if (cancelled) return;
        setResources(data);
        onLoaded?.(data);
      } catch (err) {
        if (cancelled) return;
        setError(getErrorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [targetSourceId, retryNonce, loadResources, getErrorMessage, onLoaded]);

  return { resources, loading, error, retryNonce, reload };
}
```

⚠️ `loadResources`/`getErrorMessage`/`onLoaded` 는 caller 쪽에서 안정 reference 로 제공 필요. Azure 의 `getResourceErrorMessage` 같은 provider helper 는 module-top `const` 로 정의 → stable.

Azure 고유 `fallbackSettings`, `resourceLoaded` 는 훅에 포함 **안 함** — Azure 내부에 local state 유지.

### 3-3. 3 Provider migration

각 ProjectPage 에서:
```ts
// Before
const [selectedIds, setSelectedIds] = useState<string[]>([]);
const [vmConfigs, setVmConfigs] = useState<Record<string, VmDatabaseConfig>>({});
const [submitting, setSubmitting] = useState(false);
const [approvalModalOpen, setApprovalModalOpen] = useState(false);
const [approvalError, setApprovalError] = useState<string | null>(null);
const [expandedVmId, setExpandedVmId] = useState<string | null>(null);
const [resources, setResources] = useState<Resource[]>([]);
const [resourceLoading, setResourceLoading] = useState(true);
const [resourceError, setResourceError] = useState<string | null>(null);
const [retryNonce, setRetryNonce] = useState(0);
const reloadResources = useCallback(() => setRetryNonce((n) => n + 1), []);

// fetch useEffect (inlined)...

// After
const form = useProjectPageFormState();
const { resources, loading: resourceLoading, error: resourceError, reload: reloadResources } =
  useProjectResources({
    targetSourceId,
    loadResources: loadAwsResources,  // provider 별 함수
    getErrorMessage: getResourceErrorMessage,  // Azure 만, 없으면 default
  });
```

### 3-4. 예상 축소

| 파일 | Before | After (target) |
|------|--------|---------------|
| Hook 1 `useProjectPageFormState.ts` | 0 | ~45 |
| Hook 2 `useProjectResources.ts` | 0 | ~50 |
| `AwsProjectPage.tsx` | 302 / 11 states | ~240 / ≤ 2 states |
| `AzureProjectPage.tsx` | 339 / 13 states | ~280 / ≤ 4 states (Azure 고유 2개 유지) |
| `GcpProjectPage.tsx` | 314 / 11 states | ~250 / ≤ 2 states |

C1 threshold (10+) 모두 해소.

## Step 4: Do NOT touch
- Provider 고유 fetch 함수 (`loadAwsResources`, `loadAzureResources`, `loadGcpResources`)
- API layer
- JSX 렌더 / 버튼 / modal 컴포넌트
- `ApprovalRequestModal` prop 계약
- `EMPTY_CONFIRMED_INTEGRATION` / `isMissingConfirmedSnapshot` / 기타 #342 가 도입한 상수
- Azure 고유 `fallbackSettings`, `resourceLoaded` → 유지
- IDC / SDU ProjectPage (사용자 요청: 제외)

## Step 5: Verify
```
npx tsc --noEmit
npm run lint -- app/integration/target-sources/[targetSourceId]/_components/
npm run build
```

확인:
```
for f in aws azure gcp; do
  states=$(grep -c useState app/integration/target-sources/\[targetSourceId\]/_components/$f/${f^}ProjectPage.tsx)
  echo "$f: $states useState (target: aws/gcp ≤ 2, azure ≤ 4)"
done
```

수동:
- AWS / Azure / GCP 3 provider 페이지 각각 렌더 → VM 선택 / 설정 / 전개 / approval modal 열기·제출·에러·닫기 / 재시도 버튼
- 3 페이지가 동일 hook 통과 후에도 provider 별 behavior 정확히 유지

## Step 6: Commit + push + PR
```
git add app/integration/target-sources/[targetSourceId]/_components/shared/ \
        app/integration/target-sources/[targetSourceId]/_components/{aws,azure,gcp}/
git commit -m "refactor(target-sources): extract 3-provider common hooks (wave15-C1)

Post-#342 로 수렴된 AWS/Azure/GCP ProjectPage 의 동형 useState 패턴을
generic 훅 2개로 통합.

- useProjectPageFormState: selectedIds/vmConfigs/submitting/approval/expandedVmId
- useProjectResources<T>: fetch + retry + loading/error + retryNonce + reload
- 3 provider page LOC ~20% 감소, useState 모두 C1 threshold 하회
- Azure 고유 fallbackSettings/resourceLoaded 는 provider-local 유지"
git push -u origin refactor/wave15-c1-project-page-hooks
```

PR body (`/tmp/pr-wave15-c1-body.md`):
```
## Summary
Extract 2 common hooks shared by AWS/Azure/GCP ProjectPage. Resolves C1 for all 3 providers.

## Changes
- `_components/shared/useProjectPageFormState.ts` (new, ~45 LOC)
- `_components/shared/useProjectResources.ts` (new, ~50 LOC)
- AWS ProjectPage: 11 useState → ≤ 2
- Azure ProjectPage: 13 useState → ≤ 4 (2 provider-local)
- GCP ProjectPage: 11 useState → ≤ 2
- Net LOC across 3 files: ~900 → ~770 + 95 hook

## Why
Post-#342 3 providers 가 near-identical state pattern 으로 수렴. Provider 추가 / 공통 정책 변경 시 single source.

## Deliberately excluded
- Provider-specific fetch (loadXxxResources)
- API layer, JSX, modals
- Azure fallbackSettings / resourceLoaded (provider-local)
- IDC / SDU ProjectPage (deprecated scope)

## Verify
- [x] tsc, lint, build
- [x] 3 provider 화면 full loop

## Parallel coordination
- Safe with all other wave15 specs (different files)
```

## ⛔ Do NOT auto-merge
Stop at `gh pr create`. Report URL.

## Return (under 200 words)
1. PR URL
2. tsc / lint / build
3. useState before/after for each of 3 files
4. Hook API 선택 근거 (useReducer 대신 useState 조합)
5. Azure 고유 state 2개 처리 방식
6. Provider fetch 함수가 inline 생성되면 useEffect 무한 루프 가능성 → 어떻게 방지했는지
7. Deviations with rationale

## Parallel coordination
- **파일 overlap 없음**:
  - wave15-B1-admin-dashboard-slim (`features/AdminDashboard.tsx`)
  - wave15-B1-queue-board-split (`features/queue-board/*`)
  - wave15-B1-systems-table-filters-split (`features/dashboard/SystemsTableFilters.tsx`)
  - wave15-H1-icons-foundation (docs only)
- 4-way 병렬 안전
