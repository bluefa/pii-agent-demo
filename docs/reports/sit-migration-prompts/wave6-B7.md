# Task B7 — Scan State UIs (Empty / Running / Error)

## Context
Project: pii-agent-demo (Next.js 14, TS, Tailwind, Korean UI).
Wave 6 single task (after B6 merge).
Create 3 presentational state components that plug into B6's `ScanController` render-props.

## Precondition — verify B6 is merged
```
cd /Users/study/pii-agent-demo
git fetch origin main
git log origin/main --oneline -15 | grep -q "B6" && echo "✓ B6 merged" || { echo "✗ B6 not merged"; exit 1; }
grep -q 'export const ScanController' app/components/features/scan/ScanPanel.tsx || { echo "✗ ScanController missing"; exit 1; }
[ -f app/components/features/scan/ScanHistoryList.tsx ] && { echo "✗ ScanHistoryList should have been deleted by B6"; exit 1; } || echo "✓ history deleted"
```

## Step 1: Worktree
```
bash scripts/create-worktree.sh --topic sit-b7-scan-states --prefix feat
cd /Users/study/pii-agent-demo-sit-b7-scan-states
```

## Step 2: Required reading (in order)
1. `docs/reports/sit-migration-todo-phase1.md` §B7
2. `docs/reports/sit-prototype-migration-plan.md` §3-5-f
3. `design/SIT Prototype.html` L1075-1115 (visual spec for 4 states)
4. `app/components/features/scan/ScanPanel.tsx` — B6 output; read `ScanController` API
5. `lib/theme.ts` — `primaryColors`, `statusColors` tokens
6. `app/components/features/scan/ScanProgressBar.tsx` — existing progress primitive

## Step 3: Files to create

Under `app/components/features/scan/`:

### `ScanEmptyState.tsx`
- Illustration icon (upload/cloud svg) in a circle with `bgColors.muted`
- Heading: `인프라 스캔을 진행해주세요`
- Body: `'Run Infra Scan'을 통해 부위 DB를 조회할 수 있어요`
- No action button (the parent card header provides Run Infra Scan CTA per prototype L1066-1069)

### `ScanRunningState.tsx`
```tsx
interface ScanRunningStateProps {
  progress: number;  // 0-100
}
```
- Rotating arc svg in circle with `primaryColors.bgLight` + `primaryColors.text`
- Heading: `인프라 스캔 진행중입니다`
- Body: `인프라 스캔은 약 <strong>5분</strong> 이내 소요되는 편이며, 리소스가 많을 경우 길어질 수 있어요.` (use JSX `<strong>`, not raw HTML)
- Progress bar: inline linear-gradient `primary` → `indigo-500`, 10px height, rounded-full
- Progress label: `{progress}%` in Geist Mono, tabular-nums

### `ScanErrorState.tsx`
```tsx
interface ScanErrorStateProps {
  onRetry: () => void;
}
```
- Red error-banner: statusColors.error tokens
- Icon: alert-circle svg
- Heading: `인프라 스캔에 실패하였어요`
- Body: `보안 설정 또는 권한 문제로 스캔에 실패하였어요. <Link href="#">가이드 문서</Link>를 확인 후 권한 재설정 후 다시 시도해 주세요.`
- `<button onClick={onRetry}>` secondary/outline — label `다시 시도`

### Update `app/components/features/scan/index.ts`
Add exports: `ScanEmptyState`, `ScanRunningState`, `ScanErrorState`.

## Step 4: Wire into default ScanPanel (or keep for B8)

Two approaches — **pick the minimum viable one**:

**(A) Replace inline UI inside default `ScanPanel`** (recommended):
Open `ScanPanel.tsx`, replace the legacy inline UI with a switch on `state`:
```tsx
export const ScanPanel = (props) => (
  <ScanController {...props}>
    {(s) => (
      <div className={/* card container */}>
        {/* card header with Last Scan + Run Infra Scan button */}
        {s.state === 'EMPTY' && <ScanEmptyState />}
        {s.state === 'IN_PROGRESS' && <ScanRunningState progress={s.progress} />}
        {s.state === 'FAILED' && <ScanErrorState onRetry={s.startScan} />}
        {s.state === 'SUCCESS' && <ScanResultSummary result={s.lastResult} />}  {/* B8 replaces this */}
      </div>
    )}
  </ScanController>
);
```

**(B)** Don't touch `ScanPanel` here — leave SUCCESS state as legacy and let B8 rewrite it. B7 just **creates** the 3 new state components. Recommended if touching ScanPanel risks regression; document the follow-up in PR body.

Default to **(A)** unless the existing ScanPanel internals are complex enough to defer.

## Step 5: Do NOT touch
- `ScanController` (B6 output) — use it
- `ScanProgressBar`, `ScanResultSummary`, `ScanStatusBadge` — existing primitives
- 5 `*ProjectPage.tsx` files
- `ResourceTable.tsx` (B8 scope)
- `useScanPolling.ts`

## Step 6: Visual constraints
- No raw hex. Use `statusColors.error.*`, `primaryColors.*`, `bgColors.*`
- SVG icons: inline, `aria-hidden="true"`
- Keep Korean UI strings verbatim from the design source

## Step 7: Verify
```
npx tsc --noEmit
npm run lint -- app/components/features/scan/
```
Both must pass.

## Step 8: Commit + push + PR
```
git add app/components/features/scan/
git commit -m "feat(scan): Empty/Running/Error state UIs (B7)

3 presentational state components consuming ScanController render-props
from B6. <ScanPanel> default UI now switches on state to render the new
components; SUCCESS state still uses legacy ScanResultSummary (B8 replaces
with DbSelectionTable).

- ScanEmptyState: illus + '인프라 스캔을 진행해주세요'
- ScanRunningState: rotating arc + progress bar (primary→indigo gradient)
  + N% label
- ScanErrorState: red banner + 다시 시도 button

Visual spec: design/SIT Prototype.html L1075-1115.

Spec: docs/reports/sit-migration-todo-phase1.md §B7"
git push -u origin feat/sit-b7-scan-states
```

PR body (write to `/tmp/pr-b7-body.md`):
```
## Summary
Wave 6 — 3 scan state UIs consuming B6's ScanController.

## New
- `ScanEmptyState.tsx`
- `ScanRunningState.tsx` (progress prop)
- `ScanErrorState.tsx` (onRetry prop)

## Wired
- Default `<ScanPanel>` now switches on `state` from ScanController
- SUCCESS state still legacy (B8 scope — DbSelectionTable)

## Test plan
- [x] npx tsc --noEmit
- [x] npm run lint
- [x] Each state renders visually via Network throttling / Mock
- [x] Retry button triggers ScanController.startScan
- [x] Token-only colors (no raw hex)

## Ref
- docs/reports/sit-migration-todo-phase1.md §B7
- design/SIT Prototype.html L1075-1115
```

## ⛔ Do NOT auto-merge
Stop at `gh pr create`. Report URL.

## Return (under 180 words)
1. PR URL
2. tsc / lint results
3. Which approach (A or B) chosen, with rationale
4. ScanController state enum actually used vs what B6 exposed
5. Any visual deviations from prototype (with reason)

## Parallel coordination
- **B5 (Wave 5a)** MAY still be in-flight but doesn't touch `scan/`. No conflict.
- **B8 (Wave 7)** starts after B7 is merged — it replaces SUCCESS state with DbSelectionTable.
