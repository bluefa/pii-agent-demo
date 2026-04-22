# Task B8 — ResourceTable → DbSelectionTable column reconfig

## Context
Project: pii-agent-demo (Next.js 14, TS, Tailwind, Korean UI).
Wave 7 single task (after B7 merge).
Reconfigure `ResourceTable` and provider-specific body components to match the prototype's 8-column layout. Per Phase 0 I-06, the "스캔 이력" column is a stub (all `—`) until BFF adds the field.

## Precondition — verify B7 is merged
```
cd /Users/study/pii-agent-demo
git fetch origin main
git log origin/main --oneline -20 | grep -q "B7" && echo "✓ B7 merged" || { echo "✗ B7 not merged"; exit 1; }
[ -f app/components/features/scan/ScanEmptyState.tsx ] || { echo "✗ ScanEmptyState missing"; exit 1; }
```

## Step 1: Worktree
```
bash scripts/create-worktree.sh --topic sit-b8-db-table --prefix refactor
cd /Users/study/pii-agent-demo-sit-b8-db-table
```

## Step 2: Required reading (in order)
1. `docs/reports/sit-migration-todo-phase1.md` §B8 (full spec including I-06 stub pattern)
2. `docs/reports/sit-prototype-migration-plan.md` §3-5-g
3. `design/SIT Prototype.html` L1117-1165 (8-column DB table)
4. `app/components/features/ResourceTable.tsx` — current implementation
5. `app/components/features/resource-table/*` — 5 body components (AwsResourceTableBody, GroupedResourceTableBody, FlatResourceTableBody, ResourceRow, ConnectionIndicator, etc.)
6. `lib/types.ts` — `Resource` type shape (which fields exist / which need derivation)

## Step 3: Target 8-column layout

| # | Column | Source |
|---|---|---|
| 1 | checkbox | `selectedIds` membership |
| 2 | 연동 대상 여부 | `isSelected` → green `대상` / gray `비대상` tag |
| 3 | DB Type | `resource.databaseType` or `vmDatabaseConfig.databaseType` → blue tag |
| 4 | Resource ID | `resource.resourceId` (mono font) |
| 5 | Region | `resource.region` or provider-specific (mono font) |
| 6 | DB Name | `resource.resourceName` (mono font) |
| 7 | 연동 완료 여부 | ProcessStatus-derived helper — '연동 완료' / '연동 진행중' / '—' |
| 8 | 스캔 이력 | **stub** — `getResourceScanHistory(r) → null` → renders `—` for all rows (I-06) |

## Step 4: New helpers

### `lib/resource/integration-status.ts` (or co-locate)
```ts
import type { Resource, ProcessStatus } from '@/lib/types';
import { ProcessStatus as PS } from '@/lib/types';

export const getResourceIntegrationStatus = (
  resource: Resource,
  processStatus: ProcessStatus,
): '연동 완료' | '연동 진행중' | '—' => {
  if (!resource.isSelected) return '—';
  if (processStatus === PS.INSTALLATION_COMPLETE) return '연동 완료';
  if (processStatus >= PS.APPLYING_APPROVED) return '연동 진행중';
  return '—';
};
```

### `lib/resource/scan-history.ts` (stub — I-06)
```ts
import type { Resource } from '@/lib/types';

/**
 * Returns the scan-history status for a resource.
 *
 * I-06 (Phase 0): BFF has not yet published a scanHistoryStatus field on Resource.
 * Until it does, this helper returns null for every resource and the DbSelectionTable
 * renders '—'. When the field lands, update this helper body — no caller changes needed.
 */
export const getResourceScanHistory = (_resource: Resource): null => null;
```

Keep the stub as ONE function so T17 or a follow-up PR can swap in a real implementation without touching any table component.

## Step 5: ResourceTable + provider body updates

Apply the 8-column schema consistently to:
- `AwsResourceTableBody.tsx` (cluster layout — may have subtotal rows; preserve)
- `GroupedResourceTableBody.tsx` (Azure / GCP region grouping)
- `FlatResourceTableBody.tsx` (IDC / SDU)
- `ResourceRow.tsx` (shared row rendering)

**Constraints**:
- VmDatabaseConfigPanel + InstancePanel children **preserved** (do not modify their internals)
- Checkbox enablement still driven by `processStatus === WAITING_TARGET_CONFIRMATION || isEditMode`
- `showCredentialColumn` logic (CONNECTION_VERIFIED / INSTALLATION_COMPLETE) — decide: keep as additional column OR fold into the 8-column layout. Recommended: **keep as 9th column** (credential assignment) only when active — do not drop functionality.

## Step 6: Selection summary

Below the table, render:
```tsx
<div className="flex justify-between items-center mt-4">
  <span className="text-xs text-gray-500">
    총 <strong>{totalCount}</strong>건 · <strong className={primaryColors.text}>{selectedCount}</strong>건 선택됨
  </span>
  <Button variant="primary" onClick={handleConfirm}>연동 대상 승인 요청</Button>
</div>
```

Wire `handleConfirm` to the existing approval request flow. Already done by 5 ProjectPages — check `handleConfirmTargets` pattern.

## Step 7: SUCCESS state integration with B7

Replace the legacy `<ScanResultSummary>` call in the default `ScanPanel` SUCCESS branch with `<DbSelectionTable>` (the refactored ResourceTable — same component, just renamed conceptually; if the file name stays `ResourceTable.tsx`, fine).

If rename preferred: `git mv ResourceTable.tsx DbSelectionTable.tsx` and update all callers — **skip if risky**, keep filename.

## Step 8: Do NOT touch
- `ScanController`, `ScanEmptyState`, `ScanRunningState`, `ScanErrorState` (B6/B7 output)
- `useScanPolling`
- 5 `*ProjectPage.tsx` files (only if filename changes; otherwise no edits needed)
- VmDatabaseConfigPanel / InstancePanel internals

## Step 9: Verify
```
npx tsc --noEmit
npm run lint -- app/components/features/ResourceTable.tsx app/components/features/resource-table/ lib/resource/
```
Both must pass.

Per-provider smoke check (read the code to confirm the 8 columns render — do not need to run the server):
- AWS cluster grouping: 8 columns + subtotals
- Azure/GCP region grouping: 8 columns
- IDC/SDU flat: 8 columns
- Selection summary line at bottom

## Step 10: Commit + push + PR
```
git add app/components/features/ResourceTable.tsx app/components/features/resource-table/ lib/resource/
git commit -m "refactor(resource): DbSelectionTable 8-column reconfig (B8)

Per prototype Screen 4 (L1117-1165), the DB selection table now renders 8
columns: checkbox / 대상여부 / DB Type / Resource ID / Region / DB Name /
연동완료여부 / 스캔이력.

Per Phase 0 I-06, getResourceScanHistory() returns null — column renders '—'
for every row until BFF publishes the scanHistoryStatus field. Swapping in
real data needs only this single helper update.

New helpers:
- lib/resource/integration-status.ts — getResourceIntegrationStatus
- lib/resource/scan-history.ts — getResourceScanHistory (stub, I-06)

Selection summary '총 N건 · M건 선택됨 + 연동 대상 승인 요청' below table.

Credential column retained as conditional 9th column (CONNECTION_VERIFIED+).

Spec: docs/reports/sit-migration-todo-phase1.md §B8"
git push -u origin refactor/sit-b8-db-table
```

PR body (write to `/tmp/pr-b8-body.md`):
```
## Summary
Wave 7 — ResourceTable 8-column reconfig per prototype Screen 4.

## Changes
- `ResourceTable.tsx` + 3 provider bodies (Aws/Grouped/Flat) + ResourceRow: 8-column layout
- New: `lib/resource/integration-status.ts`
- New: `lib/resource/scan-history.ts` (stub for I-06)
- Selection summary + 연동 대상 승인 요청 CTA below table

## Phase 0
- I-06: 스캔 이력 column stubbed to '—' via single helper; swap-in plan documented

## Preserved
- VmDatabaseConfigPanel / InstancePanel internals
- Checkbox enablement logic
- Credential column as conditional 9th column (status ≥ CONNECTION_VERIFIED)

## Test plan
- [x] npx tsc --noEmit
- [x] npm run lint
- [x] Column order matches prototype for AWS / Azure / GCP / IDC / SDU
- [x] Stub helper returns null for every resource → all rows show '—'
- [x] Selection summary + approval CTA renders

## Ref
- docs/reports/sit-migration-todo-phase1.md §B8
- Phase 0 I-06
```

## ⛔ Do NOT auto-merge
Stop at `gh pr create`. Report URL.

## Return (under 200 words)
1. PR URL
2. tsc / lint results
3. Whether you renamed to `DbSelectionTable.tsx` or kept `ResourceTable.tsx`
4. Exact column order rendered (confirm matches spec)
5. Handling decision for the credential column (kept conditional vs dropped)
6. Any Resource field mismatches requiring fallback logic

## Parallel coordination
- Single-track task. B7 is the last prerequisite.
- T17 (Wave 8) starts after B8.
