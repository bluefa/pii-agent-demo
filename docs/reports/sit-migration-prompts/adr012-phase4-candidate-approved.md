# ADR-012 Phase 4 — Candidate / Approved Cutover and ResourceSection Removal

## Intent

Finish the provider-page cutover to `CloudTargetSourceLayout` by migrating the remaining candidate/approved entry path and deleting the transitional `ResourceSection`.

After Phase 3, the new layout owns steps 2-7. This phase migrates `WAITING_TARGET_CONFIRMATION`, moves its instruction card out of `ProcessStatusCard`, and removes the legacy provider-page body that assembled `ProcessStatusCard` + guide + `ResourceSection` + `RejectionAlert`.

Source ADR: [`docs/adr/012-target-source-page-layout.md`](../../adr/012-target-source-page-layout.md), especially Migration Plan Phase 4.

## Preconditions

- Phase 1, Phase 2, and Phase 3 are merged into `main`.
- `WaitingApprovalStep` and `ApplyingApprovedStep` already exist.
- `ProcessStatusCard` no longer renders approval/applying cards.
- Provider pages route steps 2-7 through `CloudTargetSourceLayout`.

If any precondition is false, stop in `/wave-task` Phase 0 and report the missing previous phase.

## Required Outcome

After this PR is merged:

1. All active cloud `ProcessStatus` values route through `CloudTargetSourceLayout`.
2. `WAITING_TARGET_CONFIRMATION` is implemented by `WaitingTargetConfirmationStep`.
3. The step-1 instruction card is outside `ProcessStatusCard` and owned by `WaitingTargetConfirmationStep` or a small presentation component used by it.
4. Provider pages no longer import or render `ProcessStatusCard`, `GuideCardContainer`, `ResourceSection`, or `RejectionAlert` directly.
5. `ResourceSection.tsx` is deleted and no imports remain.
6. `ProcessStatusCard` owns only status progress, polling, and history tab chrome.
7. The full seven-step cloud layout is readable from `CloudTargetSourceLayout` plus named step components.

## Scope

| Area | Required action |
|---|---|
| Step component | Add `WaitingTargetConfirmationStep.tsx`. It renders page meta, `ProcessStatusCard`, the extracted instruction card, guide card, editable `CandidateResourceSection`, and `RejectionAlert`. |
| Instruction card | Extract the `WAITING_TARGET_CONFIRMATION` instruction block from `ProcessStatusCard` into a small component, for example `TargetConfirmationInstructionCard.tsx`. It accepts enough project/provider context to preserve AWS-specific copy. |
| Layout switch | Add `WAITING_TARGET_CONFIRMATION` to `CloudTargetSourceLayout`. Keep R1 source guard green. |
| Provider pages | Simplify AWS/Azure/GCP pages so their normal path returns only `CloudTargetSourceLayout` with provider identity props. AWS still keeps the pre-process `AwsInstallationModeSelector` branch when no mode is selected. |
| ResourceSection | Delete `app/integration/target-sources/[targetSourceId]/_components/shared/ResourceSection.tsx` after imports are gone. |
| ProcessStatusCard | Remove the step-1 instruction branch and any imports/helpers that become unused. |
| Tests | Add full layout coverage and deletion guards listed below. |

## Component Contract

`WaitingTargetConfirmationStep` uses the same props as the other step components:

```tsx
interface CloudStepProps {
  project: CloudTargetSource;
  identity: ProjectIdentity;
  providerLabel: string;
  action: ReactNode;
  onProjectUpdate: (project: CloudTargetSource) => void;
}
```

Recommended render shape:

```tsx
return (
  <>
    <ProjectPageMeta project={project} providerLabel={providerLabel} identity={identity} action={action} />
    <ProcessStatusCard project={project} onProjectUpdate={onProjectUpdate} />
    <div data-testid="target-confirmation-instructions">
      <TargetConfirmationInstructionCard project={project} />
    </div>
    {slotKey && <GuideCardContainer slotKey={slotKey} />}
    <CandidateResourceSection
      targetSourceId={project.targetSourceId}
      readonly={false}
      refreshProject={refreshProject}
    />
    <RejectionAlert project={project} />
  </>
);
```

`TargetConfirmationInstructionCard` should preserve the current copy and AWS-specific additional note from `ProcessStatusCard`. Use existing `statusColors` / `cn` tokens; do not introduce raw feature colors.

## Implementation Steps

### 1. Extract step-1 instruction presentation

Move the current `WAITING_TARGET_CONFIRMATION` block out of `ProcessStatusCard` into a new small component. Preserve behavior exactly:

- AWS title: `수행 절차`.
- Non-AWS title: `안내`.
- AWS ordered-list items stay the same.
- Non-AWS single instruction stays the same.
- AWS IAM note stays the same.

Do not change wording in this phase unless required by lint or layout constraints.

### 2. Add `WaitingTargetConfirmationStep`

Add the new step file and derive `refreshProject` in the same way as earlier steps. The `CandidateResourceSection` is editable (`readonly={false}`) in this step.

Use `resolveStepSlot(project.cloudProvider, ProcessStatus.WAITING_TARGET_CONFIRMATION, project.awsInstallationMode)` for guide slot resolution.

### 3. Extend `CloudTargetSourceLayout`

Add:

```tsx
case ProcessStatus.WAITING_TARGET_CONFIRMATION:
  return <WaitingTargetConfirmationStep {...props} />;
```

Do not add provider conditions.

### 4. Simplify provider pages

For Azure and GCP, the returned normal page body should become:

```tsx
return (
  <main className="max-w-[1200px] mx-auto p-7 space-y-6">
    <CloudTargetSourceLayout
      project={project}
      identity={identity}
      providerLabel="..."
      action={<DeleteInfrastructureButton />}
      onProjectUpdate={onProjectUpdate}
    />
  </main>
);
```

If previous phases put `<main>` inside `CloudTargetSourceLayout`, follow the current Phase 0 code shape instead; do not nest duplicate `<main>` wrappers. The final page should have exactly one page-level wrapper.

For AWS, keep:

```tsx
if (!project.awsInstallationMode) {
  return (
    <main ...>
      <ProjectPageMeta ... />
      <AwsInstallationModeSelector ... />
    </main>
  );
}
```

Then return the layout for all process statuses with a selected installation mode.

Remove now-unused provider-page imports:

- `useCallback`
- `getProject`
- `ProcessStatusCard`
- `GuideCardContainer`
- `resolveStepSlot`
- `ResourceSection`
- `RejectionAlert`

Only remove imports that are actually unused on current `origin/main`.

### 5. Delete `ResourceSection`

After provider pages no longer import it, delete `ResourceSection.tsx`. Then run:

```bash
! rg -n "ResourceSection" app/integration/target-sources/\[targetSourceId\]/_components
```

If anything still imports it, fix the caller rather than leaving a dead compatibility export.

### 6. Tests

Add/extend tests:

- `WaitingTargetConfirmationStep` renders instruction card before guide/resource section.
- `TargetConfirmationInstructionCard` preserves AWS-specific and non-AWS copy.
- `ProcessStatusCard` no longer contains the step-1 instruction copy. Use a source-text test or render test with a `WAITING_TARGET_CONFIRMATION` fixture.
- `CloudTargetSourceLayout` has explicit cases for all seven `ProcessStatus` enum values used by cloud providers.
- Provider pages render `CloudTargetSourceLayout` for `WAITING_TARGET_CONFIRMATION`.
- `ResourceSection` deletion guard: no import/reference remains.

Prefer mocked child components for step-order tests. Do not hit resource APIs from layout-order tests.

### 7. Self-audit, verify, commit, push, PR

Run `/wave-task` Phase 3-6. The PR body must explicitly say `ResourceSection` was deleted and provider pages now delegate normal cloud process rendering to `CloudTargetSourceLayout`.

## Subagent Fan-out

| Substep | Fan-out target | Constraint |
|---|---|---|
| Instruction extraction + tests | One subagent can own `TargetConfirmationInstructionCard` and its tests. | Must not edit provider pages. |
| `WaitingTargetConfirmationStep` + layout tests | One subagent can own the step and `CloudTargetSourceLayout` test updates. | Must not delete `ResourceSection`. |
| Provider-page simplification | Main session recommended. | Touches all provider pages and must resolve import cleanup consistently. |

The main session deletes `ResourceSection` only after all routing edits are integrated.

## Guardrails

- **R1**: `CloudTargetSourceLayout.tsx` still cannot mention `cloudProvider` or `awsInstallationMode`.
- **R2**: Do not introduce slots for candidate resources. `CandidateResourceSection` already owns candidate data and UI.
- **R3**: Do not introduce provider-specific target-confirmation step components. Provider-specific instruction copy belongs in `TargetConfirmationInstructionCard`.
- **R4**: Do not use `ConfirmedIntegrationDataProvider` outside confirmed-data steps.
- **C1**: Provider pages and step components must not import `@/lib/types/resources`.
- Keep AWS no-mode selector behavior unchanged.
- Do not change candidate resource API calls or approval request payload behavior.

## Out of Scope

- Deleting `ConfirmedIntegrationSection.tsx` (Phase 5).
- Adding screenshot regression tooling.
- Redesigning the step instruction card.
- Changing guide CMS slot definitions.
- IDC/SDU layout support.

## Acceptance Criteria

- All active cloud process statuses are handled by `CloudTargetSourceLayout`.
- `WAITING_TARGET_CONFIRMATION` order is readable in `WaitingTargetConfirmationStep`.
- `ProcessStatusCard` no longer renders any step-specific card or instruction content.
- Provider pages no longer import `ResourceSection`.
- `ResourceSection.tsx` is deleted.
- Existing Phase 1-3 tests remain green.
- `npx tsc --noEmit`: 0 errors.
- `npm run lint`: 0 new warnings.
- `npm run test:run`: all current baseline tests plus new tests are green.
- `npm run build`: clean.

## Verification Commands

```bash
! rg -nP "\bcloudProvider\b|\bawsInstallationMode\b" \
  app/integration/target-sources/\[targetSourceId\]/_components/layout/CloudTargetSourceLayout.tsx

! rg -n "ResourceSection" \
  app/integration/target-sources/\[targetSourceId\]/_components

! rg -nP "ApprovalWaitingCard|ApprovalApplyingBanner|리소스를 스캔하고 연동할 대상을 선택한 뒤 확정해주세요|AWS Console" \
  app/components/features/ProcessStatusCard.tsx

! rg -nP "from\s+['\"]@/lib/types/resources['\"]" \
  app/integration/target-sources/\[targetSourceId\]/_components/{aws,azure,gcp}/*ProjectPage.tsx \
  app/integration/target-sources/\[targetSourceId\]/_components/layout

npx tsc --noEmit
npm run lint
npm run test:run
npm run build
```

## PR Description Template

```markdown
## Summary
- Spec: `docs/reports/sit-migration-prompts/adr012-phase4-candidate-approved.md` @ <SHA>
- ADR reference: ADR-012 Migration Plan Phase 4
- Routes all active cloud process statuses through `CloudTargetSourceLayout`
- Deletes `ResourceSection.tsx`

## Changed files
<git diff --stat>

## Verification
- [ ] npx tsc --noEmit
- [ ] npm run lint
- [ ] npm run test:run
- [ ] npm run build
- [ ] Manual smoke: 1002, 1003, 1005, 1008, 1010

## Deferred
- Confirmed legacy cleanup and boundary lock: Phase 5
```
