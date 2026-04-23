# Task — Detail page integration finalize (Wave 9)

## Context
Project: pii-agent-demo (Next.js 14, TS, Tailwind, Korean UI).
Wave 9 — single session task. Closes the two visible gaps that remained after B4/B7/B8 merged:

1. **`GuideCard` (B2's amber warm variant) is never rendered** on the 5 provider detail pages. The prototype places it between `프로세스 진행 상태` (Stepper) and `연동 대상 DB 선택` cards.
2. **The "Cloud 리소스" card on detail pages still looks like the pre-migration component.** The prototype shows a single card titled `연동 대상 DB 선택` with header actions (Last Scan timestamp + Run Infra Scan button), and the body is a state-driven switch (Empty / Running / Error / Success → 8-column table).

This wave inserts `GuideCard`, unifies the scan+table into one `DbSelectionCard`, and removes the duplicated guide inside `ProcessStatusCard`.

## Precondition — verify Phase 1 migration complete
```
cd /Users/study/pii-agent-demo
git fetch origin main

# B8 DbSelectionTable + B7 scan states must be in
git log origin/main --oneline -25 | grep -q "(B8)" && echo "✓ B8 merged" || { echo "✗ B8 not merged"; exit 1; }
git log origin/main --oneline -25 | grep -q "(B7)" && echo "✓ B7 merged" || { echo "✗ B7 not merged"; exit 1; }
git log origin/main --oneline -25 | grep -q "(B2)" && echo "✓ B2 merged" || { echo "✗ B2 not merged"; exit 1; }

# GuideCard component must exist
[ -f app/components/features/process-status/GuideCard.tsx ] || { echo "✗ GuideCard missing"; exit 1; }
# ScanController must exist (B6)
grep -q "export const ScanController" app/components/features/scan/ScanPanel.tsx || { echo "✗ ScanController missing"; exit 1; }
```

## Step 1: Worktree
```
bash scripts/create-worktree.sh --topic wave9-detail-integration --prefix feat
cd /Users/study/pii-agent-demo-wave9-detail-integration
```

## Step 2: Required reading (in order)
1. `docs/reports/sit-migration-prompts/wave9-detail-integration.md` (this file)
2. `design/SIT Prototype.html` L1036-1174 (GuideCard + 연동 대상 DB 선택 card)
3. `app/components/features/process-status/GuideCard.tsx` — B2 output, public API
4. `app/components/features/scan/ScanPanel.tsx` — current ScanController + ScanPanel wrapper
5. `app/components/features/scan/{ScanEmptyState,ScanRunningState,ScanErrorState}.tsx` — B7 outputs
6. `app/components/features/ResourceTable.tsx` — B8's 8-column DbSelectionTable (note: file name still `ResourceTable.tsx`)
7. `app/components/features/ProcessStatusCard.tsx` — find `<StepGuide>` render (around line 212)
8. 5 `*ProjectPage.tsx` files under `app/projects/[projectId]/{aws,azure,gcp,idc,sdu}/`
9. `lib/process.ts` for `getProjectCurrentStep` (so GuideCard receives the correct step)
10. `lib/theme.ts` — `cardStyles`, `primaryColors`, `textColors`, `buttonStyles`, `statusColors` for token use

## Step 3: Implementation

### 3-1. New `app/components/features/scan/DbSelectionCard.tsx`

Single card that replaces the current `ScanPanel` + separate `ResourceTable` duo in ProjectPage detail.

**Props** (same fields ProjectPage already passes to ResourceTable + existing ScanPanel):
```tsx
interface DbSelectionCardProps {
  // ScanController trigger
  targetSourceId: number;
  cloudProvider: CloudProvider;
  onScanComplete?: () => void;

  // ResourceTable passthrough (used when state === 'SUCCESS')
  resources: Resource[];
  processStatus: ProcessStatus;
  isEditMode?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  credentials?: SecretKey[];
  onCredentialChange?: (resourceId: string, credentialId: string | null) => void;
  expandedVmId?: string | null;
  onVmConfigToggle?: (id: string | null) => void;
  onVmConfigSave?: (resourceId: string, config: VmDatabaseConfig) => void;
  onEditModeChange?: (isEdit: boolean) => void;
}
```

**Card structure (follows prototype L1053-1075)**:
```tsx
<section className={cardStyles.base + " overflow-hidden"}>
  <header className="flex items-start justify-between px-6 py-4 border-b border-gray-100">
    <div>
      <h2 className="text-[15px] font-semibold text-gray-900">연동 대상 DB 선택</h2>
      <p className="mt-1 text-xs text-gray-500">
        Infra Scan을 통해 부위 DB 조회 후 Agent 연동 대상 DB를 선택하세요.
      </p>
    </div>
    <div className="flex items-center gap-3">
      {lastScanAt && (
        <span className="inline-flex items-center gap-1 text-[11.5px] text-gray-500">
          <ClockIcon />
          Last Scan: {formatDate(lastScanAt)}
        </span>
      )}
      <Button
        variant="primary"
        disabled={!canStart}
        onClick={startScan}
      >
        <PlayIcon /> Run Infra Scan
      </Button>
    </div>
  </header>

  <div className="px-6 py-6">
    {state === 'EMPTY'       && <ScanEmptyState />}
    {state === 'IN_PROGRESS' && <ScanRunningState progress={progress} />}
    {state === 'FAILED'      && <ScanErrorState onRetry={startScan} />}
    {state === 'SUCCESS'     && (
      <ResourceTable
        resources={resources}
        cloudProvider={cloudProvider}
        processStatus={processStatus}
        isEditMode={isEditMode}
        selectedIds={selectedIds}
        onSelectionChange={onSelectionChange}
        credentials={credentials}
        onCredentialChange={onCredentialChange}
        expandedVmId={expandedVmId}
        onVmConfigToggle={onVmConfigToggle}
        onVmConfigSave={onVmConfigSave}
        onEditModeChange={onEditModeChange}
      />
    )}
  </div>
</section>
```

Wrap the above in `<ScanController>` render-props so `state / lastScanAt / progress / canStart / startScan` come from that hook.

**Implementation notes**:
- Hoist `ClockIcon` and `PlayIcon` as module-level JSX consts (Vercel rule `rendering-hoist-jsx`)
- All colors via `lib/theme.ts` tokens — no raw hex
- `formatDate` from existing `lib/utils/date` (check path via grep if unsure)
- Export from `app/components/features/scan/index.ts`

### 3-2. Modify 5 `*ProjectPage.tsx` files

For each provider (AWS/Azure/GCP/IDC/SDU) in the main return path (NOT the `APPLYING_APPROVED` / early-return branches):

#### Add `<GuideCard>` between `<ProcessStatusCard>` and the resource card
```tsx
<ProcessStatusCard ... />
<GuideCard
  currentStep={currentStep}
  provider={project.cloudProvider}
  installationMode={project.awsInstallationMode}  // AWS only; omit elsewhere
/>
{/* existing resource section below */}
```

#### Replace `<ScanPanel> + <ResourceTable>` duo with `<DbSelectionCard>`
```tsx
// Before (AWS example)
<div className={cn(cardStyles.base, 'overflow-hidden')}>
  <div className="px-6 pt-6">
    <h2 ...>Cloud 리소스</h2>
  </div>
  <ScanPanel ... />
  <ResourceTable ... />
</div>

// After
<DbSelectionCard
  targetSourceId={project.targetSourceId}
  cloudProvider={project.cloudProvider}
  onScanComplete={async () => {
    const updated = await getProject(project.targetSourceId);
    onProjectUpdate(updated);
  }}
  resources={project.resources.map(r => ({ ...r, vmDatabaseConfig: vmConfigs[r.id] || r.vmDatabaseConfig }))}
  processStatus={currentStep}
  isEditMode={effectiveEditMode}
  selectedIds={selectedIds}
  onSelectionChange={setSelectedIds}
  credentials={credentials}
  onCredentialChange={handleCredentialChange}
  expandedVmId={expandedVmId}
  onVmConfigToggle={setExpandedVmId}
  onVmConfigSave={handleVmConfigSave}
  onEditModeChange={setIsEditMode}
/>
```

- `APPLYING_APPROVED` branch keeps existing `<ResourceTransitionPanel>` unchanged
- IDC / SDU pages: skip ResourceTable-specific props that don't apply (check each file — some use custom resource tables)
- Remove imports of `ScanPanel` and `ResourceTable` if no longer referenced after this change. Add `DbSelectionCard`, `GuideCard`.

### 3-3. `app/components/features/ProcessStatusCard.tsx`

Remove the standalone `<StepGuide>` render (~line 212):
```tsx
// Remove this line entirely:
<StepGuide currentStep={currentStep} cloudProvider={project.cloudProvider} />
```

The top-level `<GuideCard>` now replaces it. Clean up any unused imports (`StepGuide`) once the render is gone. `ProcessGuideModal` stays (opened via Stepper's `onGuideClick`).

## Step 4: Do NOT touch
- `GuideCard.tsx` internals (B2 output) — use as-is
- `ScanController` (inside ScanPanel.tsx) — use as-is
- `ScanEmptyState.tsx`, `ScanRunningState.tsx`, `ScanErrorState.tsx` — use as-is
- `ResourceTable.tsx` (B8) — use as-is
- `ScanPanel` backward-compat wrapper in the same file — leave the function in place; it becomes orphan after this wave (candidate for follow-up cleanup). Do NOT delete here to avoid scope creep.
- `useScanPolling.ts`
- `ProcessGuideModal`, `StepProgressBar`, `ProcessGuideStepCard`
- `ResourceTransitionPanel`

## Step 5: Verify
```
npx tsc --noEmit
npm run lint -- app/projects/ app/components/features/scan/ app/components/features/ProcessStatusCard.tsx
```
Both must pass. Lint warning count: orphan `ScanPanel` wrapper may now show unused; that is expected and is documented as a follow-up.

**Visual smoke (optional, if dev server is easy)**:
- `/integration/projects/{any-id}` in a browser with live server shows:
  - `GuideCard` (amber warm card) between Stepper and DB card
  - DB card title `연동 대상 DB 선택` with subtitle
  - Header right side: `Last Scan: …` + `Run Infra Scan` button
  - ScanController states render correctly

## Step 6: Commit + push + PR
```
git add app/components/features/scan/ app/components/features/ProcessStatusCard.tsx app/projects/[projectId]/
git commit -m "feat(detail): insert GuideCard + unified DbSelectionCard (Wave 9)

Closes two visible gaps vs Screen 4 prototype:
1. GuideCard (B2 warm variant) now rendered between ProcessStatusCard
   and the DB selection card on all 5 provider detail pages.
2. DbSelectionCard replaces the 'Cloud 리소스' container — single card
   with '연동 대상 DB 선택' header (title + subtitle + Last Scan badge +
   Run Infra Scan button) and state-driven body (Empty/Running/Error/
   Success → ResourceTable).

Removes duplicate <StepGuide> render from ProcessStatusCard (GuideCard
covers it at the page level).

ScanPanel backward-compat wrapper in scan/ScanPanel.tsx now orphan;
separate cleanup PR will remove it.

Spec: docs/reports/sit-migration-prompts/wave9-detail-integration.md"
git push -u origin feat/wave9-detail-integration
```

PR body (write to `/tmp/pr-wave9-body.md`):
```
## Summary
Wave 9 — final detail page integration. Closes the visible gaps user flagged after B4/B7/B8:

1. **GuideCard inserted** (amber warm variant from B2) — between `ProcessStatusCard` and the DB selection card on all 5 provider pages.
2. **DbSelectionCard consolidation** — replaces the "Cloud 리소스" container with a single `연동 대상 DB 선택` card whose body is state-driven via `ScanController`.

## Changes
- New: `app/components/features/scan/DbSelectionCard.tsx`
- Updated: 5 `*ProjectPage.tsx` — insert `<GuideCard>` + swap scan/table duo for `<DbSelectionCard>`
- Updated: `app/components/features/ProcessStatusCard.tsx` — remove duplicate `<StepGuide>`

## Preserved
- `GuideCard.tsx`, `ScanController`, `ScanEmptyState/Running/Error`, `ResourceTable` internals
- `ResourceTransitionPanel` (APPLYING_APPROVED case)
- `ScanPanel` wrapper is now orphan — flagged for follow-up cleanup (NOT deleted here)

## Prototype reference
`design/SIT Prototype.html` L1036-1174.

## Test plan
- [x] `npx tsc --noEmit`
- [x] `npm run lint`
- [x] Live: `/integration/projects/{id}` renders guide card + new DB card with correct states
- [ ] Scan flow (Empty → Running → Success) remains functional for all 5 providers

## Follow-ups
- Remove orphan `ScanPanel` default-export wrapper in `scan/ScanPanel.tsx` (small cleanup PR)
- `ResourceTransitionPanel` visual unification (not in Wave 9 scope)

## Ref
- docs/reports/sit-migration-prompts/wave9-detail-integration.md
- User-flagged gaps: GuideCard missing, 연동 대상 DB 선택 card title/layout mismatch
```

## ⛔ Do NOT auto-merge
Stop at `gh pr create`. Report URL.

## Return (under 250 words)
1. PR URL
2. `tsc` / `lint` results (warning count vs baseline)
3. Per-file list of resource-prop mapping (especially IDC/SDU that may not use standard ResourceTable API)
4. `<StepGuide>` removal location + any `StepGuide` import cleanup
5. Any deviation from spec + rationale (e.g. if IDC/SDU need a different card layout for their custom resource input panels)

## Parallel coordination
Single track — Wave 9 is the last UI change of Phase 1. No parallel sibling.

Follow-up (after merge): small cleanup PR for orphan `ScanPanel` wrapper.
