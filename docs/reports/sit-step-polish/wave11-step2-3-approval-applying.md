# Wave 11 — Step 2 (WAITING_APPROVAL) + Step 3 (APPLYING_APPROVED) polish

## Context

Wave 9 (foundation) ships `cardStyles.cardTitle` in `lib/theme.ts` and
`CopyButton` in `app/components/ui/CopyButton.tsx`. Wave 11 is the first
consumer wave: it closes two of the six "no Guide Card" gaps from the
audit (`docs/reports/sit-prototype-implementation-gaps-audit-2026-05-14.md`,
§4 D1, punch list G1) and swaps the ad-hoc `text-lg font-semibold` card
header in `WaitingApprovalCard` for the new `cardStyles.cardTitle`
token (§4 D2, punch list G3).

Scope is intentionally narrow:

- Step 2 (`WAITING_APPROVAL`) — mount `GuideCardContainer` after
  `ProcessStatusCard`, before `WaitingApprovalCard`. Swap card title token.
- Step 3 (`APPLYING_APPROVED`) — mount `GuideCardContainer` after
  `ProcessStatusCard`, before `ApprovalApplyingBanner`.
- Tests — extend the three existing test files.

Wave 11 does **NOT** wire `CopyButton` into the approval/approved tables.
Wave 13 owns that integration for `WaitingApprovalTable`,
`ApprovedIntegrationTable`, and `ConfirmedIntegrationTable`. Wave 10
owns the `CopyButton` adoption on `InstallResourceTable`.

## Precondition

```bash
cd /Users/study/pii-agent-demo
git fetch origin main
git grep -l "cardStyles.cardTitle" lib/theme.ts && echo "✓ Wave 9 merged (cardTitle)"
git grep -l "export const CopyButton" app/components/ui/CopyButton.tsx && echo "✓ Wave 9 merged (CopyButton)"
```

Both lines must print the "merged" message. If either fails, Wave 9 has
not landed yet — stop and wait. Wave 11 imports `cardStyles.cardTitle`;
without Wave 9 the build will fail.

## Step 1: Worktree

```bash
bash scripts/create-worktree.sh --topic sit-step-polish-wave11-step2-3-approval-applying --prefix feat
cd /Users/study/pii-agent-demo-sit-step-polish-wave11-step2-3-approval-applying
```

The worktree branch name will be
`feat/sit-step-polish-wave11-step2-3-approval-applying`.

## Step 2: Required reading

1. `design/SIT Prototype v7 - standalone.html` — `screen-4` Step 2 and
   Step 3 blocks. Confirm both surfaces show the `.card.guide-variant`
   warm-amber guide card directly under the process status bar, before
   the step's main content card.
2. `docs/reports/sit-prototype-implementation-gaps-audit-2026-05-14.md`
   §3 (rows for WAITING_APPROVAL and APPLYING_APPROVED) and §4 D1 / D2.
   These are the source of truth for what Wave 11 fixes.
3. `app/integration/target-sources/[targetSourceId]/_components/layout/WaitingTargetConfirmationStep.tsx`
   — the reference pattern. Wave 11 copies the same `slotKey` +
   `{slotKey && <GuideCardContainer ... />}` shape so all step
   components stay structurally identical.
4. `app/components/features/process-status/GuideCard/resolve-step-slot.ts`
   — slot-key resolver. Signature: `resolveStepSlot(provider,
   currentStep, installationMode?)`. The `installationMode` argument is
   **always optional** — only the `provider === 'AWS'` branch reads it.
   Passing `project.awsInstallationMode` unconditionally is safe: for
   Azure / GCP the resolver ignores it.
5. `app/integration/target-sources/[targetSourceId]/_components/layout/WaitingApprovalStep.tsx`
   — Wave 11 target #1.
6. `app/integration/target-sources/[targetSourceId]/_components/layout/WaitingApprovalCard.tsx`
   — Wave 11 target #2 (card-title token swap).
7. `app/integration/target-sources/[targetSourceId]/_components/layout/ApplyingApprovedStep.tsx`
   — Wave 11 target #3. Note this file already computes `slotKey` but
   does not render the container; Wave 11 completes that wiring.
8. `app/integration/target-sources/[targetSourceId]/_components/layout/WaitingApprovalStep.test.tsx`,
   `WaitingApprovalCard.test.tsx`, `ApplyingApprovedStep.test.tsx`
   — three test files to extend.

## Step 3: Implementation

### 3-1. Step 2 — `WaitingApprovalStep.tsx` GuideCard mount

Add the slotKey computation and conditional render. Match the pattern in
`WaitingTargetConfirmationStep` exactly.

```diff
  'use client';

  import { useCallback, type ReactNode } from 'react';
  import type { CloudTargetSource } from '@/lib/types';
+ import { ProcessStatus } from '@/lib/types';
  import { getProject } from '@/app/lib/api';
  import { ProcessStatusCard } from '@/app/components/features/ProcessStatusCard';
+ import { GuideCardContainer } from '@/app/components/features/process-status/GuideCard/GuideCardContainer';
+ import { resolveStepSlot } from '@/app/components/features/process-status/GuideCard/resolve-step-slot';
  import {
    ProjectPageMeta,
    RejectionAlert,
    type ProjectIdentity,
  } from '@/app/integration/target-sources/[targetSourceId]/_components/common';
  import { WaitingApprovalCard } from '@/app/integration/target-sources/[targetSourceId]/_components/layout/WaitingApprovalCard';
  import { WaitingApprovalCancelButton } from '@/app/integration/target-sources/[targetSourceId]/_components/layout/WaitingApprovalCancelButton';
```

Inside the component body, derive `slotKey` next to the existing
`refreshProject` callback:

```diff
  export const WaitingApprovalStep = ({
    project,
    identity,
    providerLabel,
    action,
    onProjectUpdate,
  }: WaitingApprovalStepProps) => {
+   const slotKey = resolveStepSlot(
+     project.cloudProvider,
+     ProcessStatus.WAITING_APPROVAL,
+     project.awsInstallationMode,
+   );
+
    const refreshProject = useCallback(async () => {
```

In the JSX tree, insert the container **after** `ProcessStatusCard`,
**before** `WaitingApprovalCard`:

```diff
        <ProcessStatusCard project={project} onProjectUpdate={onProjectUpdate} />
+       {slotKey && <GuideCardContainer slotKey={slotKey} />}
        <WaitingApprovalCard
          targetSourceId={project.targetSourceId}
```

Final DOM order:
`ProjectPageMeta` → `ProcessStatusCard` → `GuideCardContainer` →
`WaitingApprovalCard` → `RejectionAlert`.

### 3-2. Step 2 — `WaitingApprovalCard.tsx` card-title token swap

The card header currently uses `text-lg font-semibold` (= 18 px / 600).
Replace with `cardStyles.cardTitle` (= 22 px / 700 / -0.01em) per audit
§4 D2 and punch list G3.

`cardStyles` is already imported on line 32 of the current file
(`import { cardStyles, cn, statusColors, textColors } from '@/lib/theme';`).
No new import is required.

```diff
        <div>
-         <h2 className={cn('text-lg font-semibold', textColors.primary)}>
+         <h2 className={cn(cardStyles.cardTitle)}>
            연동 대상 승인 대기
          </h2>
```

**Why drop `textColors.primary`:** the new `cardStyles.cardTitle` token
already pins `text-gray-900` (per Wave 9 §3-3). The cn() merge would
keep both classes; Tailwind's last-write resolution makes them
redundant. Drop `textColors.primary` from this site to keep the
class list lean.

If `textColors` ends up unused inside `WaitingApprovalCard.tsx` after
this edit, also drop it from the import line — surgical cleanup of an
import this edit orphaned. Do not touch any other unused symbol the
edit did not create.

### 3-3. Step 3 — `ApplyingApprovedStep.tsx` GuideCard mount

This file already computes `slotKey` but does not consume it. Wave 11
completes the wiring: import `GuideCardContainer` and render it after
`ProcessStatusCard`.

```diff
  import { ProcessStatusCard } from '@/app/components/features/ProcessStatusCard';
  import { ApprovalApplyingBanner } from '@/app/components/features/process-status/ApprovalApplyingBanner';
+ import { GuideCardContainer } from '@/app/components/features/process-status/GuideCard/GuideCardContainer';
  import { resolveStepSlot } from '@/app/components/features/process-status/GuideCard/resolve-step-slot';
```

In the JSX tree, insert the container **after** `ProcessStatusCard`,
**before** the `data-testid="approval-applying"` wrapper:

```diff
        <ProcessStatusCard project={project} onProjectUpdate={onProjectUpdate} />
+       {slotKey && <GuideCardContainer slotKey={slotKey} />}
        <div data-testid="approval-applying">
          <ApprovalApplyingBanner targetSourceId={project.targetSourceId} />
        </div>
```

The existing `slotKey` declaration (lines 30–34) does not need to
change — it already passes `project.processStatus` (which equals
`APPLYING_APPROVED` when this component is mounted) and
`project.awsInstallationMode`.

Final DOM order:
`ProjectPageMeta` → `ProcessStatusCard` → `GuideCardContainer` →
`approval-applying` wrapper → `ApprovedIntegrationSection` →
`RejectionAlert`.

### 3-4. Test — `WaitingApprovalStep.test.tsx`

Extend the existing test file with a single new assertion: the
`GuideCardContainer` mounts when `slotKey` resolves to a non-null value.

Add module mocks for the GuideCard primitives so the test does not
depend on the CMS slot registry:

```typescript
vi.mock('@/app/components/features/process-status/GuideCard/GuideCardContainer', () => ({
  GuideCardContainer: ({ slotKey }: { slotKey: string }) => (
    <div data-testid="guide-card-container" data-slot-key={slotKey} />
  ),
}));

vi.mock('@/app/components/features/process-status/GuideCard/resolve-step-slot', () => ({
  resolveStepSlot: vi.fn(() => 'stub-slot-key'),
}));
```

The mock returns any non-null string — the test only asserts that the
container mounts (`getByTestId('guide-card-container')`). The literal
deliberately avoids encoding a specific enum value (`ProcessStatus`
numeric values live in `lib/types.ts` and can drift; the test should not
recreate them).

Add the assertion to the existing happy-path test:

```typescript
it('renders WaitingApprovalCard with the project targetSourceId and a cancel button slot', () => {
  render(
    <WaitingApprovalStep
      project={azureWaitingApprovalFixture}
      identity={identityFixture}
      providerLabel="Azure Infrastructure"
      action={null}
      onProjectUpdate={() => {}}
    />,
  );

  expect(screen.getByTestId('guide-card-container')).toBeTruthy();
  const card = screen.getByTestId('waiting-approval-card');
  expect(card.textContent).toContain('1003');
  expect(screen.getByTestId('waiting-approval-cancel-button')).toBeTruthy();
});
```

Optional: add a DOM-order assertion so the container is asserted to
land between `ProcessStatusCard` and `WaitingApprovalCard`. The
`ProcessStatusCard` mock currently returns `null`, so the simplest
ordering check is `guide-card-container` precedes `waiting-approval-card`:

```typescript
const guide = screen.getByTestId('guide-card-container');
const card = screen.getByTestId('waiting-approval-card');
const ordering = guide.compareDocumentPosition(card);
expect(ordering & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
```

### 3-5. Test — `WaitingApprovalCard.test.tsx`

Add one assertion that the card title applies the new token. The
simplest, most stable check is on the rendered `<h2>` className —
verify it contains the `text-[22px]` class fragment (the Tailwind
arbitrary-value class produced by `cardStyles.cardTitle`).

```typescript
it('renders the card title with the cardStyles.cardTitle token', async () => {
  getApprovedIntegrationMock.mockResolvedValueOnce(buildResponse());
  render(<WaitingApprovalCard targetSourceId={1003} />);

  const heading = screen.getByRole('heading', { name: '연동 대상 승인 대기' });
  expect(heading.className).toContain('text-[22px]');
  expect(heading.className).toContain('font-bold');
});
```

The existing test on line 74 (`'renders title, sub-text, status pill,
and banner copy'`) continues to pass because `screen.getByText(
'연동 대상 승인 대기')` matches text content regardless of class.

Do not modify the existing tests beyond adding the new one.

### 3-6. Test — `ApplyingApprovedStep.test.tsx`

The current file (lines 15–21) already mocks both `GuideCardContainer`
to `null` and `resolveStepSlot` to `null`. Wave 11 replaces these
mocks with non-null returns so the new mount assertion is meaningful.

```diff
- vi.mock('@/app/components/features/process-status/GuideCard/GuideCardContainer', () => ({
-   GuideCardContainer: () => null,
- }));
-
- vi.mock('@/app/components/features/process-status/GuideCard/resolve-step-slot', () => ({
-   resolveStepSlot: () => null,
- }));
+ vi.mock('@/app/components/features/process-status/GuideCard/GuideCardContainer', () => ({
+   GuideCardContainer: ({ slotKey }: { slotKey: string }) => (
+     <div data-testid="guide-card-container" data-slot-key={slotKey} />
+   ),
+ }));
+
+ vi.mock('@/app/components/features/process-status/GuideCard/resolve-step-slot', () => ({
+   resolveStepSlot: vi.fn(() => 'stub-slot-key'),
+ }));
```

Add a new test asserting the mount:

```typescript
it('renders GuideCardContainer with the resolved slotKey', () => {
  render(
    <ApplyingApprovedStep
      project={azureApplyingApprovedFixture}
      identity={identityFixture}
      providerLabel="Azure Infrastructure"
      action={null}
      onProjectUpdate={() => {}}
    />,
  );

  const guide = screen.getByTestId('guide-card-container');
  expect(guide.getAttribute('data-slot-key')).toBe('stub-slot-key');
});
```

Extend the existing DOM-order test so the container also lands before
`approval-applying`:

```typescript
it('renders approval-applying before approved-integration-section', () => {
  render(<ApplyingApprovedStep ... />);

  const guide = screen.getByTestId('guide-card-container');
  const applying = screen.getByTestId('approval-applying');
  const approved = screen.getByTestId('approved-integration-section');

  const guideBeforeApplying = guide.compareDocumentPosition(applying);
  expect(guideBeforeApplying & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

  const applyingBeforeApproved = applying.compareDocumentPosition(approved);
  expect(applyingBeforeApproved & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});
```

## Step 4: Do NOT touch

Out-of-scope file boundaries — Wave 11 must not modify any of these.
A diff that crosses these lines must be reverted before push.

- ADR-014 R3 four files (stepper):
  `app/components/features/process-status/ProcessProgressBar.tsx`,
  `InstallationProcessProgressBar.tsx`, `StepProgressBar.tsx`,
  `app/components/features/process-status/motion/`.
- Step 4 / 5 / 6 / 7 components — Waves 10 and 12 own them:
  - `CloudInstallingStep.tsx`, `InstallingStep.tsx`,
    `InstallationStatusSlot.tsx` (Wave 10).
  - `WaitingConnectionTestStep.tsx`, `ConnectionVerifiedStep.tsx`,
    `InstallationCompleteStep.tsx` (Wave 12).
- Table components — `CopyButton` adoption is split:
  - Wave 13 owns `WaitingApprovalTable.tsx`, `ApprovedIntegrationTable.tsx`,
    `ConfirmedIntegrationTable.tsx`.
  - Wave 10 owns `InstallResourceTable.tsx` (lives under
    `app/components/features/process-status/install-task-pipeline/`).
- BFF / swagger / `lib/types.ts` — no field rename, no new payload,
  no new endpoint.
- `lib/theme.ts` — Wave 9 already shipped `cardStyles.cardTitle`. Wave 11
  is purely a consumer; do not add or rename tokens here.
- `app/components/ui/CopyButton.tsx` — Wave 9 ships it; Wave 13 wires
  it. Do not import it in Wave 11.
- `app/integration/target-sources/[targetSourceId]/_components/layout/WaitingTargetConfirmationStep.tsx`
  — reference only. No changes.
- `app/components/features/process-status/GuideCard/resolve-step-slot.ts`,
  `GuideCardContainer.tsx`, `GuideCardPure.tsx`,
  `lib/constants/guide-registry.ts` — Wave 11 consumes them as-is.

## Step 5: Verify

```bash
npx tsc --noEmit
npm run lint -- \
  app/integration/target-sources/'[targetSourceId]'/_components/layout/WaitingApprovalStep.tsx \
  app/integration/target-sources/'[targetSourceId]'/_components/layout/WaitingApprovalCard.tsx \
  app/integration/target-sources/'[targetSourceId]'/_components/layout/ApplyingApprovedStep.tsx \
  app/integration/target-sources/'[targetSourceId]'/_components/layout/WaitingApprovalStep.test.tsx \
  app/integration/target-sources/'[targetSourceId]'/_components/layout/WaitingApprovalCard.test.tsx \
  app/integration/target-sources/'[targetSourceId]'/_components/layout/ApplyingApprovedStep.test.tsx
npm test --run \
  app/integration/target-sources/'[targetSourceId]'/_components/layout/WaitingApprovalStep.test.tsx \
  app/integration/target-sources/'[targetSourceId]'/_components/layout/WaitingApprovalCard.test.tsx \
  app/integration/target-sources/'[targetSourceId]'/_components/layout/ApplyingApprovedStep.test.tsx
```

Browser smoke (any mock target source at WAITING_APPROVAL and at
APPLYING_APPROVED):

- **WAITING_APPROVAL** —
  - The amber Guide Card appears below the process status bar and above
    the "연동 대상 승인 대기" card.
  - The card header "연동 대상 승인 대기" reads visibly larger than before
    (22 px vs. previous 18 px). The eyebrow/subtitle/timeline meta line
    below it is unchanged.
- **APPLYING_APPROVED** —
  - The amber Guide Card appears below the process status bar and above
    the "승인 적용 중" applying banner.
  - The applying banner and approved integration table render unchanged.

Stepper guard (ADR-014 R3):

```bash
git diff --name-only origin/main -- \
  app/components/features/process-status/ProcessProgressBar.tsx \
  app/components/features/process-status/InstallationProcessProgressBar.tsx \
  app/components/features/process-status/StepProgressBar.tsx \
  app/components/features/process-status/motion/ \
  | (read -r line && echo "✗ stepper modified: $line" || echo "✓ stepper untouched")
```

Touched-file guard — Wave 11's diff should be exactly these six files:

```bash
git diff --name-only origin/main
```

Expected:
```
app/integration/target-sources/[targetSourceId]/_components/layout/ApplyingApprovedStep.test.tsx
app/integration/target-sources/[targetSourceId]/_components/layout/ApplyingApprovedStep.tsx
app/integration/target-sources/[targetSourceId]/_components/layout/WaitingApprovalCard.test.tsx
app/integration/target-sources/[targetSourceId]/_components/layout/WaitingApprovalCard.tsx
app/integration/target-sources/[targetSourceId]/_components/layout/WaitingApprovalStep.test.tsx
app/integration/target-sources/[targetSourceId]/_components/layout/WaitingApprovalStep.tsx
```

Anything outside this list is a scope violation — revert before push.

## Step 6: Commit + push + PR

```bash
git add \
  app/integration/target-sources/'[targetSourceId]'/_components/layout/WaitingApprovalStep.tsx \
  app/integration/target-sources/'[targetSourceId]'/_components/layout/WaitingApprovalCard.tsx \
  app/integration/target-sources/'[targetSourceId]'/_components/layout/ApplyingApprovedStep.tsx \
  app/integration/target-sources/'[targetSourceId]'/_components/layout/WaitingApprovalStep.test.tsx \
  app/integration/target-sources/'[targetSourceId]'/_components/layout/WaitingApprovalCard.test.tsx \
  app/integration/target-sources/'[targetSourceId]'/_components/layout/ApplyingApprovedStep.test.tsx

git commit -m "feat(step-polish): Step 2+3 — GuideCard mount + cardTitle token swap (wave11)

- WaitingApprovalStep: mount GuideCardContainer after ProcessStatusCard
  using resolveStepSlot(provider, WAITING_APPROVAL, awsInstallationMode).
- WaitingApprovalCard: replace ad-hoc 'text-lg font-semibold' header
  with cardStyles.cardTitle (22px / 700 / -0.01em) per audit §4 D2.
- ApplyingApprovedStep: render the already-computed slotKey via
  GuideCardContainer between ProcessStatusCard and ApprovalApplyingBanner.
- Tests: assert GuideCardContainer mounts on both steps and that the
  WaitingApprovalCard heading carries the new token classes.

Closes audit punch-list items G1 (partial — Step 2/3 of six) and G3
(partial — WaitingApprovalCard of three).

Stepper four-file guard passes. No BFF / swagger / type changes.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"

git fetch origin main
git rebase origin/main
git push -u origin feat/sit-step-polish-wave11-step2-3-approval-applying
```

PR body:

```
## Summary

Wave 11 of the step-polish set. Two narrow consumer changes against
Wave 9's foundation primitives:

- Step 2 (WAITING_APPROVAL) and Step 3 (APPLYING_APPROVED) now mount
  the prototype's amber Guide Card directly below the process status
  bar. Closes part of audit punch-list item G1.
- WaitingApprovalCard's header heading swaps from the ad-hoc 18 px
  size to the prototype's 22 px `cardStyles.cardTitle` token. Closes
  part of punch-list item G3.

## Changes

- `layout/WaitingApprovalStep.tsx` — imports `ProcessStatus`,
  `GuideCardContainer`, `resolveStepSlot`; derives `slotKey` and
  renders the container after `ProcessStatusCard`.
- `layout/WaitingApprovalCard.tsx` — h2 className swapped from
  `'text-lg font-semibold'` + `textColors.primary` to
  `cardStyles.cardTitle`.
- `layout/ApplyingApprovedStep.tsx` — imports `GuideCardContainer` and
  renders it next to the already-present `slotKey` computation.
- Three test files updated: mocks for the GuideCard primitives, mount
  assertions, DOM-order assertions, and a className assertion on the
  card title.

## Coverage progress (audit punch list)

- G1 (GuideCard on six steps) — Wave 8 covered Step 1; Wave 11 covers
  Steps 2 and 3. Steps 4, 5, 6, 7 remain (Waves 10 and 12).
- G3 (cardTitle token swap on three components) — Wave 11 covers
  WaitingApprovalCard. ConnectionVerifiedStep and
  InstallationCompleteStep remain (Wave 12).

## Out of scope (deliberate)

- Table CopyButton adoption (Wave 13).
- Step 4 / 5 / 6 / 7 components (Waves 10 / 12).
- Tooltip coverage / keyboard a11y (audit G6 / G7; deferred).
- ScanPill new/changed semantic wiring (Wave 13).
- Page bg-muted shell (Wave 9 already shipped).

## Test plan

- [ ] GuideCardContainer renders on Step 2 (WaitingApprovalStep test)
- [ ] GuideCardContainer renders on Step 3 (ApplyingApprovedStep test)
- [ ] Step 3 DOM order: GuideCard → applying → approved
- [ ] WaitingApprovalCard h2 carries the `text-[22px]` token class
- [ ] Existing tests for both steps still pass
- [ ] Stepper four-file guard passes
- [ ] Diff scope = the six listed files
```

## Step 7: Self-review checklist

- [ ] `resolveStepSlot` is called with `ProcessStatus.WAITING_APPROVAL`
      in `WaitingApprovalStep`. Not a literal `4`, not the project's
      runtime `processStatus` — explicit per-step enum so the slot key
      cannot drift if the component is ever re-used.
- [ ] `WaitingApprovalStep` and `ApplyingApprovedStep` use the same
      `{slotKey && <GuideCardContainer slotKey={slotKey} />}` shape as
      `WaitingTargetConfirmationStep` — null guard preserves the
      "missing CMS slot = no render" behaviour.
- [ ] `WaitingApprovalCard.tsx` import line is `cardStyles, cn,
      statusColors, textColors` — verify `textColors` is still
      referenced inside the file before the edit. If the only consumer
      was the h2 swap, drop it from the import. Otherwise keep.
- [ ] `cardStyles.cardTitle` is the only new className applied to the
      h2; no `font-semibold` / `text-lg` / `textColors.primary` left
      behind.
- [ ] Three test files all carry the new GuideCard mock and at least one
      mount or className assertion.
- [ ] No `any`, no relative imports, no raw hex.
- [ ] Diff is exactly six files. No accidental edits to
      `WaitingTargetConfirmationStep.tsx`, no formatting drift on
      surrounding lines.
- [ ] Stepper four-file guard passes.
- [ ] `npx tsc --noEmit` 0 errors; `npm run lint` 0 new warnings on the
      six changed files.

## Acceptance for this wave

Wave 11 is correct when:

- Browsing a mock target source at `WAITING_APPROVAL` renders the amber
  Guide Card between the process status bar and the "연동 대상 승인 대기"
  card, on Azure, AWS (both AUTO and MANUAL modes), and GCP.
- Browsing a mock target source at `APPLYING_APPROVED` renders the amber
  Guide Card between the process status bar and the applying banner, on
  all three providers.
- The "연동 대상 승인 대기" card header reads at 22 px / 700 (visibly
  larger than the previous 18 px / 600), with the existing eyebrow /
  meta line unchanged.
- All three updated test files pass; existing assertions inside those
  files still pass.
- `git diff --name-only origin/main` returns exactly the six files
  listed in Step 5.
- Stepper four-file guard passes.
- Audit punch-list G1 progresses by two of six remaining steps; G3
  progresses by one of three remaining components.
