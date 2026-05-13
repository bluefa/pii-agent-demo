# Wave 12 — Step 5 + Step 6 + Step 7 post-install polish (GuideCard + cardTitle)

## Context

The audit (`docs/reports/sit-prototype-implementation-gaps-audit-2026-05-14.md`)
flagged two related gaps across the three post-install ProcessStatus steps:

- **G1 / D1 — GuideCard coverage.** `WAITING_CONNECTION_TEST`,
  `CONNECTION_VERIFIED`, and `INSTALLATION_COMPLETE` register slot keys in
  `resolveStepSlot` (every step × provider × AWS-mode is covered) but the
  step components never mount `<GuideCardContainer>`. Six of seven steps
  ship the pedagogical-overlay pattern dead from the consumer's side; this
  wave closes the last three.
- **G3 / D2 — Card-title typography.** `ConnectionVerifiedStep` and
  `InstallationCompleteStep` hardcode `text-lg font-semibold` on their
  custom card headers. That resolves to 18 px / 600 — the prototype's
  `--type-h3`. The prototype's `--type-h1` for in-card titles is 22 px /
  700 / `-0.01em`. Wave 9 ships the `cardStyles.cardTitle` token; this
  wave swaps the two consumers.

`WAITING_CONNECTION_TEST` has no custom card and no ad-hoc heading — only
the GuideCard mount applies to it.

Scope is intentionally narrow: three step components and their tests. No
shared primitives, no `lib/theme.ts` edit, no table change.

## Precondition

```bash
cd /Users/study/pii-agent-demo
git fetch origin main

# Wave 9 must be merged: cardStyles.cardTitle must exist.
git grep -l "cardTitle" lib/theme.ts && echo "✓ Wave 9 merged (cardTitle token live)"

# Verify the three target step files still match the audit snapshot.
git grep -l "WaitingConnectionTestStep" app/integration/target-sources && echo "✓ Step 5 component present"
git grep -l "ConnectionVerifiedStep" app/integration/target-sources && echo "✓ Step 6 component present"
git grep -l "InstallationCompleteStep" app/integration/target-sources && echo "✓ Step 7 component present"

# resolveStepSlot must already cover the three steps (Wave 0 work).
git grep -l "resolveStepSlot" app/components/features/process-status/GuideCard && echo "✓ resolver present"
```

If `cardTitle` is not present in `lib/theme.ts`, stop. Wave 9 is the upstream
dependency and must land first.

## Step 1: Worktree

```bash
bash scripts/create-worktree.sh --topic sit-step-polish-wave12-step5-6-7-post-install --prefix feat
cd /Users/study/pii-agent-demo-sit-step-polish-wave12-step5-6-7-post-install
```

The worktree path will be
`/Users/study/pii-agent-demo-sit-step-polish-wave12-step5-6-7-post-install`.
Branch: `feat/sit-step-polish-wave12-step5-6-7-post-install`.

## Step 2: Required reading

1. `design/SIT Prototype v7 - standalone.html` — find the `screen-4` Step
   5 / Step 6 / Step 7 blocks. Each block shows the warm-amber
   `.card.guide-variant` GuideCard above the step's main card and uses
   `--type-h1` (22 / 700) for the in-card title. Step 5's read-only
   confirmed-resources table sits below the GuideCard; Step 6 adds a
   StepBanner + retest button; Step 7 adds the HealthBadge in the header
   and the action row.

2. `docs/reports/sit-prototype-implementation-gaps-audit-2026-05-14.md` —
   §3 (per-step state), §4 D1 (Guide Card coverage), §4 D2 (Card
   typography), §8 punch list G1 + G3.

3. `docs/reports/sit-step-polish/wave9-foundation.md` — the upstream
   foundation. Wave 12 imports **`cardStyles.cardTitle`**. It does NOT
   import `CopyButton` (Wave 13 wires it into the
   `ConfirmedIntegrationTable`).

4. `app/integration/target-sources/[targetSourceId]/_components/layout/WaitingConnectionTestStep.tsx`
   — current Step 5 shell. Already imports `resolveStepSlot` for some
   downstream slot; never mounts `<GuideCardContainer>`.

5. `app/integration/target-sources/[targetSourceId]/_components/layout/ConnectionVerifiedStep.tsx`
   — current Step 6 shell. Uses `text-lg font-semibold` on its
   `<h2>` (line ~61). No GuideCard.

6. `app/integration/target-sources/[targetSourceId]/_components/layout/InstallationCompleteStep.tsx`
   — current Step 7 shell. Uses `text-lg font-semibold` on its
   `<h2>` (line ~80). No GuideCard.

7. `app/components/features/process-status/GuideCard/resolve-step-slot.ts`
   — slot key resolver. The three step components must invoke it with
   `(project.cloudProvider, project.processStatus, project.awsInstallationMode)`.

8. `app/components/features/process-status/GuideCard/GuideCardContainer.tsx`
   — the consumer-facing component. Its `slotKey` prop is required
   non-null (`GuideSlotKey`); `resolveStepSlot` may return `null`, so
   every consumer must wrap the mount in a `{slotKey && ...}` guard.

9. `app/integration/target-sources/[targetSourceId]/_components/layout/__tests__/WaitingConnectionTestStep.test.tsx`,
   `ConnectionVerifiedStep.test.tsx`,
   `InstallationCompleteStep.test.tsx` — the existing tests this wave extends.

## Step 3: Implementation

### 3-1. Step 5 — `WaitingConnectionTestStep.tsx` GuideCard mount

The current file already calls `resolveStepSlot` (line ~33) but never
mounts the GuideCardContainer. Either reuse the existing call or inline
the call where the container mounts. The choice is style: keep the same
named binding if it already exists.

Mount the GuideCardContainer **after `ProcessStatusCard`**, before
`ConfirmedResourcesSlot`. Match the prototype's order: pedagogical
overlay first, then the step's primary panels.

```tsx
import { GuideCardContainer } from '@/app/components/features/process-status/GuideCard/GuideCardContainer';

// ... inside the return:
<ProcessStatusCard project={project} onProjectUpdate={onProjectUpdate} />
{slotKey && <GuideCardContainer slotKey={slotKey} />}
<ConfirmedResourcesSlot />
<ConnectionTestSlot ... />
<LogicalDbSlot />
<RejectionAlert project={project} />
```

The `slotKey` const is already in scope on line ~33 of the current
file. Reuse it. Do not re-derive.

**No typography change for Step 5.** The step has no custom card and no
ad-hoc `text-lg` heading. Only the GuideCard mount applies.

### 3-2. Step 6 — `ConnectionVerifiedStep.tsx` GuideCard + cardTitle swap

Two changes:

1. **GuideCard mount.** The current file does not call `resolveStepSlot`
   at all (it has no `slotKey` const). Add the import and the resolver
   call.

   ```tsx
   import { resolveStepSlot } from '@/app/components/features/process-status/GuideCard/resolve-step-slot';
   import { GuideCardContainer } from '@/app/components/features/process-status/GuideCard/GuideCardContainer';
   ```

   Inside the component body, derive the slot key:
   ```tsx
   const slotKey = resolveStepSlot(
     project.cloudProvider,
     project.processStatus,
     project.awsInstallationMode,
   );
   ```

   Mount the GuideCardContainer **after `ProcessStatusCard`**, before the
   custom `<section>` card:
   ```tsx
   <ProcessStatusCard project={project} onProjectUpdate={onProjectUpdate} />
   {slotKey && <GuideCardContainer slotKey={slotKey} />}
   <section className={cn(cardStyles.base, 'overflow-hidden')}>
     ...
   </section>
   ```

   Note: the component is currently an implicit-return arrow expression
   (`<Component ... /> => (` JSX `)`). To introduce a `slotKey` local,
   either convert to a block body (`=> { const slotKey = ...; return ( JSX ) }`)
   or inline the resolver inside the JSX `slotKey` prop. The block-body
   form is clearer and matches Step 5's shape; prefer that.

2. **cardTitle token swap.** Replace the `<h2>` className:
   ```diff
   - <h2 className={cn('text-lg font-semibold', textColors.primary)}>
   + <h2 className={cardStyles.cardTitle}>
       완료 여부 관리자 승인 대기
     </h2>
   ```

   `cardStyles.cardTitle` already carries `text-gray-900` (per Wave 9),
   so `textColors.primary` is no longer needed in the className.
   `textColors` is still imported elsewhere in the file? Check after the
   edit — if `textColors` becomes unused, remove the import per the
   Surgical-Changes rule (orphan from your edit).

### 3-3. Step 7 — `InstallationCompleteStep.tsx` GuideCard + cardTitle swap

Two changes, parallel to Step 6.

1. **GuideCard mount.** Add the resolver + container imports and derive
   `slotKey` inside the component.

   ```tsx
   import { resolveStepSlot } from '@/app/components/features/process-status/GuideCard/resolve-step-slot';
   import { GuideCardContainer } from '@/app/components/features/process-status/GuideCard/GuideCardContainer';
   ```

   Convert the implicit-return arrow body to a block-body form so the
   `slotKey` local lives outside the JSX (same as Step 6).

   Mount the GuideCardContainer **after `ProcessStatusCard`**, before the
   custom `<section>` card:
   ```tsx
   <ProcessStatusCard project={project} onProjectUpdate={onProjectUpdate} />
   {slotKey && <GuideCardContainer slotKey={slotKey} />}
   <section className={cn(cardStyles.base, 'overflow-hidden')}>
     ...
   </section>
   ```

2. **cardTitle token swap.** Replace the `<h2>` className:
   ```diff
   - <h2 className={cn('text-lg font-semibold', textColors.primary)}>
   + <h2 className={cardStyles.cardTitle}>
       PII 모니터링 모듈 연동 완료
     </h2>
   ```

   Same orphan check on `textColors` after the edit.

### 3-4. Imports — keep them sorted

`@/lib/theme` already imports `cardStyles` in Step 6 and Step 7. No
new import needed for the token swap. The only new imports are the two
GuideCard symbols, and (for Step 6 / Step 7) the `resolveStepSlot`
function.

Match the existing import order in each file: external packages first,
then `@/lib/*`, then `@/app/components/*`, then `@/app/integration/*`,
each block alphabetized. The repository style does not run a sorter
across blocks, but within a block alphabetical is the norm.

### 3-5. Test updates

Three test files. Each gets one or two new assertions.

#### `WaitingConnectionTestStep.test.tsx`

Add a single test that the GuideCardContainer renders. Mock the
`GuideCardContainer` module so the test does not depend on the CMS:

```tsx
vi.mock('@/app/components/features/process-status/GuideCard/GuideCardContainer', () => ({
  GuideCardContainer: ({ slotKey }: { slotKey: string }) => (
    <div data-testid="guide-card-container" data-slot-key={slotKey} />
  ),
}));
```

The existing `WaitingConnectionTestStep.test.tsx` already mocks
`resolve-step-slot` to return `null` for some scenarios. Override the
mock for the new test so the resolver yields a non-null key (otherwise
the `{slotKey && ...}` guard short-circuits and the container never
mounts):

```tsx
vi.mock('@/app/components/features/process-status/GuideCard/resolve-step-slot', () => ({
  resolveStepSlot: vi.fn(() => 'stub-slot-key'),
}));
```

Assertion:
```tsx
it('mounts GuideCardContainer when the resolver returns a slot key', () => {
  render(<WaitingConnectionTestStep {...defaultProps} />);
  const guide = screen.getByTestId('guide-card-container');
  expect(guide).toBeInTheDocument();
  expect(guide.getAttribute('data-slot-key')).toBe('stub-slot-key');
});
```

The literal `'stub-slot-key'` is intentionally not a real registry key —
the test asserts the mount, not the registry contents. Real slot keys
live in `lib/constants/guide-registry.ts` and may drift.

#### `ConnectionVerifiedStep.test.tsx`

Two new assertions: GuideCard mounts, and the heading uses
`cardStyles.cardTitle`.

Add both mocks (Step 6 has no existing resolver mock — these tests are
new ground):

```tsx
vi.mock('@/app/components/features/process-status/GuideCard/GuideCardContainer', () => ({
  GuideCardContainer: ({ slotKey }: { slotKey: string }) => (
    <div data-testid="guide-card-container" data-slot-key={slotKey} />
  ),
}));

vi.mock('@/app/components/features/process-status/GuideCard/resolve-step-slot', () => ({
  resolveStepSlot: vi.fn(() => 'stub-slot-key'),
}));
```

```tsx
it('mounts GuideCardContainer when the resolver returns a slot key', () => {
  render(<ConnectionVerifiedStep {...defaultProps} />);
  const guide = screen.getByTestId('guide-card-container');
  expect(guide).toBeInTheDocument();
  expect(guide.getAttribute('data-slot-key')).toBe('stub-slot-key');
});

it('renders the card title with the cardTitle token', () => {
  render(<ConnectionVerifiedStep {...defaultProps} />);
  const h2 = screen.getByRole('heading', { level: 2, name: /완료 여부 관리자 승인 대기/ });
  // Spot-check 22px / font-bold — the exact class string lives in
  // cardStyles.cardTitle (lib/theme.ts).
  expect(h2.className).toContain('text-[22px]');
  expect(h2.className).toContain('font-bold');
});
```

#### `InstallationCompleteStep.test.tsx`

Parallel to Step 6 — add the same two `vi.mock` calls, then:

```tsx
it('mounts GuideCardContainer when the resolver returns a slot key', () => {
  render(<InstallationCompleteStep {...defaultProps} />);
  const guide = screen.getByTestId('guide-card-container');
  expect(guide).toBeInTheDocument();
  expect(guide.getAttribute('data-slot-key')).toBe('stub-slot-key');
});

it('renders the card title with the cardTitle token', () => {
  render(<InstallationCompleteStep {...defaultProps} />);
  const h2 = screen.getByRole('heading', { level: 2, name: /PII 모니터링 모듈 연동 완료/ });
  expect(h2.className).toContain('text-[22px]');
  expect(h2.className).toContain('font-bold');
});
```

### 3-6. Browser order sanity

The prototype's per-step visual order is:

```
PageMeta
ProcessStatusCard
GuideCardContainer        ← new in this wave
[step main panels]
RejectionAlert
```

For Step 5, "step main panels" = `ConfirmedResourcesSlot +
ConnectionTestSlot + LogicalDbSlot`.

For Step 6 / Step 7, "step main panels" = the custom `<section>` card.

If the GuideCard is mounted in the wrong order (e.g. after the main
panel), the warm-amber overlay sits below the table and the
pedagogical-overlay pattern reads broken. Verify the JSX order matches
the bullet above before pushing.

## Step 4: Do NOT touch

- **ADR-014 R3 stepper four files.** `ProcessProgressBar.tsx`,
  `InstallationProcessProgressBar.tsx`, `StepProgressBar.tsx`, and the
  `motion/` directory under `process-status/`. Frozen by ADR.
- **Step 2 / 3 / 4 components.** `WaitingApprovalStep.tsx`,
  `WaitingApprovalCard.tsx`, `ApplyingApprovedStep.tsx`,
  `InstallingStep.tsx`, `CloudInstallingStep.tsx` belong to Wave 10 / 11.
- **Tables.** Table polish is split:
  - Wave 13 owns `ConfirmedIntegrationTable`, `WaitingApprovalTable`,
    `ApprovedIntegrationTable` (CopyButton adoption).
  - Wave 10 owns `InstallResourceTable` (lives under
    `app/components/features/process-status/install-task-pipeline/`).
- **`LogicalDbSlot` and `ConnectionTestSlot`.** No render-tree change.
  Wave 12 only adds a sibling above them in Step 5.
- **BFF / swagger / `lib/types`.** No schema change. The GuideCard
  consumes existing slot keys.
- **`lib/theme.ts`.** Wave 9 ships `cardTitle`. Wave 12 only consumes.
- **`lib/constants/guide-registry.ts`.** Slot keys for the three steps
  are already registered (per the audit §4 D1 table). Content gaps are
  a CMS task, not a code task.
- **Wave 9 deliverables.** `CopyButton`, `ScanPill` `new`/`changed`,
  `CloudTargetSourceLayout` `bg-muted` wrap — all merged before
  Wave 12 starts. No re-touch.
- **`WaitingTargetConfirmationStep.tsx`.** It already mounts the
  GuideCard (the only step that did before this wave-set). Untouched.
- **`resolve-step-slot.ts`.** Pure consumer in this wave. No edit.
- **`PageMeta.tsx` / `ProjectPageMeta`.** Untouched. The cardTitle
  token applies only to in-card titles, not the page-level identity
  block.

## Step 5: Verify

```bash
npx tsc --noEmit

npm run lint -- \
  app/integration/target-sources/'[targetSourceId]'/_components/layout/WaitingConnectionTestStep.tsx \
  app/integration/target-sources/'[targetSourceId]'/_components/layout/ConnectionVerifiedStep.tsx \
  app/integration/target-sources/'[targetSourceId]'/_components/layout/InstallationCompleteStep.tsx \
  app/integration/target-sources/'[targetSourceId]'/_components/layout/__tests__/WaitingConnectionTestStep.test.tsx \
  app/integration/target-sources/'[targetSourceId]'/_components/layout/__tests__/ConnectionVerifiedStep.test.tsx \
  app/integration/target-sources/'[targetSourceId]'/_components/layout/__tests__/InstallationCompleteStep.test.tsx

npm test --run \
  app/integration/target-sources/'[targetSourceId]'/_components/layout/__tests__/WaitingConnectionTestStep.test.tsx \
  app/integration/target-sources/'[targetSourceId]'/_components/layout/__tests__/ConnectionVerifiedStep.test.tsx \
  app/integration/target-sources/'[targetSourceId]'/_components/layout/__tests__/InstallationCompleteStep.test.tsx \
  app/integration/target-sources/'[targetSourceId]'/_components/layout/__tests__/CloudTargetSourceLayout.coverage.test.tsx
```

Browser smoke (mock data, one target source per provider):

- **Azure × WAITING_CONNECTION_TEST.** GuideCard appears between
  `ProcessStatusCard` and `ConfirmedResourcesSlot`. Warm-amber surface.
  Content rendered per the slot's CMS entry (or the empty/loading
  placeholder if CMS has nothing for that key).
- **AWS-AUTO × WAITING_CONNECTION_TEST.** Same as above; slot key
  branches to the AWS-auto variant.
- **AWS-MANUAL × WAITING_CONNECTION_TEST.** Slot key uses the
  `manual` variant.
- **GCP × WAITING_CONNECTION_TEST.** Slot key resolves via the GCP
  branch of the registry (see `lib/constants/guide-registry.ts` for the
  literal key).
- **Azure × CONNECTION_VERIFIED.** GuideCard appears between
  `ProcessStatusCard` and the "완료 여부 관리자 승인 대기" card. The
  card's `<h2>` reads visibly larger than before (22 px vs 18 px).
- **Azure × INSTALLATION_COMPLETE.** GuideCard appears between
  `ProcessStatusCard` and the "PII 모니터링 모듈 연동 완료" card.
  Card title is 22 px. HealthBadge in the header still renders.
- All three providers × all three steps: no console errors, no
  layout shift, no React key warnings.

Stepper four-file guard:

```bash
git diff --name-only origin/main -- \
  app/components/features/process-status/ProcessProgressBar.tsx \
  app/components/features/process-status/InstallationProcessProgressBar.tsx \
  app/components/features/process-status/StepProgressBar.tsx \
  app/components/features/process-status/motion/ \
  | (read -r line && echo "✗ stepper modified: $line" || echo "✓ stepper untouched")
```

Wave-9-deliverable regression guard:

```bash
git diff --name-only origin/main -- \
  app/components/ui/CopyButton.tsx \
  app/components/ui/CopyButton.test.tsx \
  app/components/ui/ScanPill.tsx \
  lib/theme.ts \
  | (read -r line && echo "✗ wave-9 file touched: $line" || echo "✓ wave-9 files untouched")
```

If anything in this guard prints `✗`, stop and revert. Wave 12 must not
modify Wave 9 deliverables.

## Step 6: Commit + push + PR

```bash
git add \
  app/integration/target-sources/'[targetSourceId]'/_components/layout/WaitingConnectionTestStep.tsx \
  app/integration/target-sources/'[targetSourceId]'/_components/layout/ConnectionVerifiedStep.tsx \
  app/integration/target-sources/'[targetSourceId]'/_components/layout/InstallationCompleteStep.tsx \
  app/integration/target-sources/'[targetSourceId]'/_components/layout/__tests__/WaitingConnectionTestStep.test.tsx \
  app/integration/target-sources/'[targetSourceId]'/_components/layout/__tests__/ConnectionVerifiedStep.test.tsx \
  app/integration/target-sources/'[targetSourceId]'/_components/layout/__tests__/InstallationCompleteStep.test.tsx

git commit -m "$(cat <<'EOF'
feat(step-polish): Step 5+6+7 — GuideCard mount + cardTitle token swap (wave12)

Closes the audit's G1 (GuideCard coverage) and G3 (card-title token) on
the three post-install ProcessStatus states.

- WaitingConnectionTestStep: mount GuideCardContainer after
  ProcessStatusCard. No typography change.
- ConnectionVerifiedStep: mount GuideCardContainer after
  ProcessStatusCard; swap text-lg font-semibold for cardStyles.cardTitle
  on the in-card h2.
- InstallationCompleteStep: same as Step 6.
- Tests: each step asserts GuideCardContainer renders with the resolved
  slot key. Step 6 and Step 7 also assert the h2 uses cardTitle.

resolveStepSlot already covers these three states × three providers ×
AWS-mode (Wave 0). Wave 9 ships cardStyles.cardTitle.

Out of scope: tables (Wave 13), Steps 2/3/4 (Wave 10/11), stepper
(ADR-014 R3), lib/theme.ts (Wave 9).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"

git fetch origin main
git rebase origin/main
git push -u origin feat/sit-step-polish-wave12-step5-6-7-post-install
```

PR body:

```
## Summary

Wave 12 of the SIT step-polish set. Closes the audit's G1 (GuideCard
coverage on the post-install steps) and G3 (card-title typography
token) on three step components.

## Changes

- `WaitingConnectionTestStep.tsx` — mount `GuideCardContainer` between
  `ProcessStatusCard` and `ConfirmedResourcesSlot`. The `slotKey` const
  was already derived in this file; reuse it.
- `ConnectionVerifiedStep.tsx` — derive `slotKey`, mount
  `GuideCardContainer` before the custom card. Swap
  `text-lg font-semibold` on the `<h2>` for `cardStyles.cardTitle`.
- `InstallationCompleteStep.tsx` — same shape as Step 6.
- Tests — each step file gains a GuideCard render assertion. Step 6 and
  Step 7 also assert the `<h2>` uses the 22px / font-bold token.

## Upstream dependency

- Wave 9 (`cardStyles.cardTitle` in `lib/theme.ts`) must be on `main`
  before this PR merges. Precondition check is in the spec.

## Out of scope

- Tables (Wave 13 owns `ConfirmedIntegrationTable` polish including
  the `CopyButton` adoption).
- Step 2 / Step 3 / Step 4 components (Waves 10/11).
- `lib/theme.ts` (Wave 9 ships `cardTitle`; Wave 12 only consumes).
- `resolveStepSlot.ts` and the guide registry (Wave 0 owns).
- ADR-014 R3 stepper files.

## Test plan
- [x] WaitingConnectionTestStep — GuideCardContainer mounts with the
      resolved slot key.
- [x] ConnectionVerifiedStep — GuideCardContainer mounts; `<h2>` uses
      cardTitle.
- [x] InstallationCompleteStep — GuideCardContainer mounts; `<h2>`
      uses cardTitle.
- [x] CloudTargetSourceLayout.coverage.test.tsx still passes (step
      sentinel untouched).
- [x] Stepper four-file guard passes.
- [x] Wave-9-deliverable guard passes (no edits to those files).
- [x] Browser smoke per provider × state in the spec's Step 5.
```

## Step 7: Self-review checklist

- [ ] `WaitingConnectionTestStep` JSX order: `PageMeta` → `ProcessStatusCard`
      → `GuideCardContainer` → `ConfirmedResourcesSlot` →
      `ConnectionTestSlot` → `LogicalDbSlot` → `RejectionAlert`.
- [ ] `ConnectionVerifiedStep` JSX order: `PageMeta` → `ProcessStatusCard`
      → `GuideCardContainer` → custom `<section>` → `RejectionAlert`.
- [ ] `InstallationCompleteStep` JSX order: `PageMeta` →
      `ProcessStatusCard` → `GuideCardContainer` → custom `<section>` →
      `RejectionAlert`.
- [ ] `GuideCardContainer` invoked with `slotKey={slotKey}` only; no
      extra props invented.
- [ ] `slotKey` derived from `(project.cloudProvider,
      project.processStatus, project.awsInstallationMode)` — the same
      signature for all three steps.
- [ ] `cardStyles.cardTitle` consumed via the `cardStyles` import that
      already exists in Step 6 / Step 7. No new import for `cardTitle`.
- [ ] `text-lg font-semibold` is gone from `ConnectionVerifiedStep` and
      `InstallationCompleteStep`. `git grep "text-lg font-semibold"
      app/integration/target-sources/'[targetSourceId]'/_components/layout/`
      returns zero hits on these three files.
- [ ] `textColors.primary` is removed from the `<h2>` className when
      it becomes redundant with `cardStyles.cardTitle`. If `textColors`
      becomes unused in the file, the import is removed.
- [ ] No `any` introduced. No relative imports introduced. No raw hex
      added.
- [ ] No new file outside the three step components and their tests.
- [ ] No edit to `lib/theme.ts`, `resolve-step-slot.ts`, or any table.
- [ ] Stepper four-file guard passes.
- [ ] Wave-9-deliverable guard passes (`CopyButton.tsx`, `ScanPill.tsx`,
      `lib/theme.ts`, `CloudTargetSourceLayout.tsx` not modified by
      this wave).
- [ ] `npx tsc --noEmit` is clean.
- [ ] `npm run lint` is clean on the six files in scope.
- [ ] `npm test --run` on the three step test files plus the coverage
      test is green.

## Acceptance for this wave

Wave 12 is correct when:

- `WaitingConnectionTestStep`, `ConnectionVerifiedStep`, and
  `InstallationCompleteStep` each render `<GuideCardContainer>` after
  `ProcessStatusCard` and before their step-specific panels.
- The slot key passed to `GuideCardContainer` matches what
  `resolveStepSlot(project.cloudProvider, project.processStatus,
  project.awsInstallationMode)` returns for the rendered project.
- `ConnectionVerifiedStep` and `InstallationCompleteStep` render their
  in-card `<h2>` with `cardStyles.cardTitle` — visibly 22 px / 700, not
  the previous 18 px / 600.
- `WaitingConnectionTestStep` has no typography change.
- The Wave-9 deliverables (`CopyButton`, `ScanPill` states,
  `CloudTargetSourceLayout` shell, `cardTitle` token) are untouched.
- ADR-014 R3 stepper four-file guard passes.
- `tsc` is clean, lint is clean, the three step test files plus the
  coverage test are green.
