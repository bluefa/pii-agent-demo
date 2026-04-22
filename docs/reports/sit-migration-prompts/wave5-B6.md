# Task B6 — ScanPanel headless refactor + history/cooldown deletion

## Context
Project: pii-agent-demo (Next.js 14, TS, Tailwind, Korean UI).
Wave 5b parallel task (pairs with B5).
Per Phase 0 I-05, `ScanHistoryList` and `CooldownTimer` are deleted entirely (no modal preservation). `ScanPanel` is refactored into a headless render-props component so B7 can plug in new state UIs.

## Precondition — verify B4 is merged
```
cd /Users/study/pii-agent-demo
git fetch origin main
git log origin/main --oneline -15 | grep -q "B4" && echo "✓ B4 merged" || { echo "✗ B4 not merged"; exit 1; }
[ -f app/components/features/scan/ScanHistoryList.tsx ] && echo "✓ ScanHistoryList still present (to be deleted)"
```

## Step 1: Worktree
```
bash scripts/create-worktree.sh --topic sit-b6-scan-headless --prefix refactor
cd /Users/study/pii-agent-demo-sit-b6-scan-headless
```

## Step 2: Required reading (in order)
1. `docs/reports/sit-migration-todo-phase1.md` §B6 (full spec — I-05 delete, headless pattern)
2. `docs/reports/sit-prototype-migration-plan.md` §3-5-e
3. `app/components/features/scan/ScanPanel.tsx` — current monolithic panel (to refactor)
4. `app/components/features/scan/ScanHistoryList.tsx` (to delete)
5. `app/components/features/scan/CooldownTimer.tsx` (to delete — already dead code)
6. `app/components/features/scan/index.ts` — export surface
7. `app/hooks/useScanPolling.ts` (do NOT modify — it's the source of truth for scan state)
8. 5 `*ProjectPage.tsx` files — current `<ScanPanel>` usage sites

## Step 3: Delete files
```
git rm app/components/features/scan/ScanHistoryList.tsx
git rm app/components/features/scan/CooldownTimer.tsx
```

## Step 4: Implementation

### 4-1. Refactor `ScanPanel.tsx` into headless + default UI dual export

```tsx
// app/components/features/scan/ScanPanel.tsx
import { useEffect } from 'react';
import { useScanPolling } from '@/app/hooks/useScanPolling';
import { useApiAction } from '@/app/hooks/useApiMutation';
import { startScan } from '@/app/lib/api/scan';
import type { CloudProvider, V1ScanJob, ScanResult, ResourceType } from '@/lib/types';

export type ScanUiState = 'EMPTY' | 'IN_PROGRESS' | 'SUCCESS' | 'FAILED';

export interface ScanControllerRenderProps {
  state: ScanUiState;
  latestJob: V1ScanJob | null;
  lastResult: ScanResult | null;
  lastScanAt: string | undefined;
  progress: number;         // 0–100 (derived from uiState)
  starting: boolean;
  isInProgress: boolean;
  canStart: boolean;
  startScan: () => void;
  refresh: () => void;
}

interface ScanControllerProps {
  targetSourceId: number;
  onScanComplete?: () => void;
  children: (props: ScanControllerRenderProps) => React.ReactNode;
}

// Internal util retained from pre-B6
const scanJobToResult = (job: V1ScanJob): ScanResult | null => {
  const entries = Object.entries(job.resourceCountByResourceType);
  if (entries.length === 0) return null;
  return {
    totalFound: entries.reduce((sum, [, count]) => sum + count, 0),
    byResourceType: entries.map(([resourceType, count]) => ({
      resourceType: resourceType as ResourceType,
      count,
    })),
  };
};

/**
 * Headless scan controller — passes state to render-props children.
 * Consumers (B7 states, DbSelectionTable) decide what to render.
 */
export const ScanController = ({ targetSourceId, onScanComplete, children }: ScanControllerProps) => {
  const { latestJob, uiState, loading, refresh, startPolling } = useScanPolling(targetSourceId, {
    onScanComplete,
  });

  const { execute: doStartScan, loading: starting } = useApiAction(
    () => startScan(targetSourceId),
    {
      onSuccess: () => { startPolling(); refresh(); },
      errorMessage: '스캔을 시작할 수 없습니다.',
    }
  );

  const isInProgress = uiState === 'IN_PROGRESS';
  const canStart = !starting && !isInProgress;
  const lastResult = latestJob && latestJob.scanStatus === 'SUCCESS' ? scanJobToResult(latestJob) : null;
  const lastScanAt = latestJob?.scanStatus === 'SUCCESS' ? latestJob.updatedAt : undefined;
  const state: ScanUiState = isInProgress ? 'IN_PROGRESS'
    : latestJob?.scanStatus === 'FAILED' ? 'FAILED'
    : latestJob?.scanStatus === 'SUCCESS' ? 'SUCCESS'
    : 'EMPTY';
  const progress = isInProgress ? 50 : state === 'SUCCESS' ? 100 : 0;  // simple band; refine if useScanPolling exposes richer

  return <>{children({
    state, latestJob, lastResult, lastScanAt, progress,
    starting, isInProgress, canStart,
    startScan: doStartScan, refresh,
  })}</>;
};

/**
 * Legacy default ScanPanel — renders the pre-B6 UI using ScanController.
 * 5 ProjectPages currently import this; keep compat until they migrate to explicit render-props.
 * B7 ScanEmptyState / ScanRunningState / ScanErrorState slot in here.
 */
interface ScanPanelProps {
  targetSourceId: number;
  cloudProvider: CloudProvider;
  onScanComplete?: () => void;
}

export const ScanPanel = ({ targetSourceId, cloudProvider: _cloudProvider, onScanComplete }: ScanPanelProps) => {
  // Preserve existing visual until B7 introduces new state UIs.
  // If ScanHistoryList / CooldownTimer were rendered here, REMOVE those render paths.
  return (
    <ScanController targetSourceId={targetSourceId} onScanComplete={onScanComplete}>
      {(s) => (/* existing inline UI using ScanProgressBar + ScanResultSummary + startScan button; NO history, NO cooldown */)}
    </ScanController>
  );
};
```

**Key points**:
- `ScanController` is the new headless primary export
- `ScanPanel` keeps backward-compat signature for 5 ProjectPage call sites — no immediate breakage
- Internal UI of `ScanPanel` **must not** import `ScanHistoryList` or `CooldownTimer` (they're deleted)
- `useScanPolling` + `useApiAction` hooks **unchanged**

### 4-2. Update `app/components/features/scan/index.ts`
- Remove `ScanHistoryList`, `CooldownTimer` exports
- Add `ScanController` export (keep `ScanPanel`)

### 4-3. Sanity check `*ProjectPage.tsx` usage
5 ProjectPages currently call `<ScanPanel targetSourceId={...} cloudProvider={...} onScanComplete={...} />`. After B6, that call site continues to work (same props). **Do NOT rewrite them here — that's B7/B8 scope.**

## Step 5: Do NOT touch
- `ScanProgressBar.tsx`, `ScanResultSummary.tsx`, `ScanStatusBadge.tsx` (used by default ScanPanel UI)
- `useScanPolling.ts`, `useApiMutation.ts`
- 5 `*ProjectPage.tsx` files (except verifying imports don't break)
- `ResourceTable.tsx` (B8 scope)

## Step 6: Verify
```
npx tsc --noEmit
npm run lint -- app/components/features/scan/ app/projects/
```
Both must pass. Grep to confirm no surviving imports of deleted files:
```
grep -rn "ScanHistoryList\|CooldownTimer" app/ lib/
# should return nothing (or only comments)
```

## Step 7: Commit + push + PR
```
git add app/components/features/scan/ScanPanel.tsx app/components/features/scan/index.ts
git rm app/components/features/scan/ScanHistoryList.tsx app/components/features/scan/CooldownTimer.tsx
git commit -m "refactor(scan): ScanPanel headless (ScanController) + delete history/cooldown (B6)

- ScanController: new headless render-props export exposing normalized state
- ScanPanel: retained as compat wrapper around ScanController (same props)
- Delete ScanHistoryList.tsx (200 LOC, I-05)
- Delete CooldownTimer.tsx (78 LOC, already dead code)
- useScanPolling / useApiMutation hooks unchanged

Enables B7 (state UIs) and B8 (DbSelectionTable) to plug into ScanController
via render-props.

Spec: docs/reports/sit-migration-todo-phase1.md §B6"
git push -u origin refactor/sit-b6-scan-headless
```

PR body (write to `/tmp/pr-b6-body.md`):
```
## Summary
Wave 5b — ScanPanel headless refactor + I-05 deletion.

## Changes
- New: `ScanController` headless render-props export (normalized `state`, `startScan`, `progress`, …)
- `ScanPanel` retained as backward-compat wrapper for 5 ProjectPage call sites
- Delete `ScanHistoryList.tsx` (-200 LOC)
- Delete `CooldownTimer.tsx` (-78 LOC, dead code)
- Net: **~-280 LOC** (some added for ScanController)

## Phase 0
- I-05: history/cooldown fully deleted, not modal-preserved

## Preserved
- `useScanPolling`, `useApiMutation` hooks untouched
- 5 ProjectPages' `<ScanPanel>` call sites work unchanged
- `ScanProgressBar`, `ScanResultSummary`, `ScanStatusBadge` retained

## Test plan
- [x] npx tsc --noEmit
- [x] npm run lint
- [x] grep confirms no ScanHistoryList/CooldownTimer survivors
- [x] 5 ProjectPages still import ScanPanel with identical props

## Ref
- docs/reports/sit-migration-todo-phase1.md §B6
- Phase 0 I-05
```

## ⛔ Do NOT auto-merge
Stop at `gh pr create`. Report URL.

## Return (under 200 words)
1. PR URL
2. tsc / lint results
3. Final LOC delta (before/after)
4. Confirmation grep returns 0 refs to deleted modules
5. ScanController interface shape you ended up with (if different from spec)

## Parallel coordination
- **B5 (Wave 5a)** runs in parallel. B5 touches `app/projects/[projectId]/` only. No file collision with B6.
- **B7 (Wave 6)** MUST start after B6 is merged (depends on `ScanController` API).
