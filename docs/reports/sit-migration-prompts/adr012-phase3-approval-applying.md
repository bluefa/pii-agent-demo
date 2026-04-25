# ADR-012 Phase 3 — Approval and Applying Step Extraction

## Intent

Move approval/applying step-specific cards out of `ProcessStatusCard` and into named ADR-012 step components.

This phase migrates:

- `WAITING_APPROVAL` to `WaitingApprovalStep`.
- `APPLYING_APPROVED` to `ApplyingApprovedStep`.

`ProcessStatusCard` must remain the process progress + history frame. It should still own polling for approval/applying status transitions, but it should no longer render `ApprovalWaitingCard` or `ApprovalApplyingBanner`.

Source ADR: [`docs/adr/012-target-source-page-layout.md`](../../adr/012-target-source-page-layout.md), especially Migration Plan Phase 3.

## Preconditions

- Phase 1 and Phase 2 are merged into `main`.
- `CloudTargetSourceLayout` already handles `INSTALLING`, `WAITING_CONNECTION_TEST`, `CONNECTION_VERIFIED`, and `INSTALLATION_COMPLETE`.
- The confirmed-data path is green before this work starts.

If Phase 2 did not land cleanly, stop in `/wave-task` Phase 0 and report the missing contracts.

## Required Outcome

After this PR is merged:

1. All providers render `WAITING_APPROVAL` through `CloudTargetSourceLayout` and `WaitingApprovalStep`.
2. All providers render `APPLYING_APPROVED` through `CloudTargetSourceLayout` and `ApplyingApprovedStep`.
3. `ApprovalWaitingCard` is rendered as a sibling of `ProcessStatusCard`, not inside it.
4. `ApprovalApplyingBanner` is rendered as a sibling of `ProcessStatusCard`, not inside it.
5. `ProcessStatusCard` keeps status polling and the history tab unchanged.
6. Candidate/approved resource placement for these two steps is readable inside the step components.
7. No provider `ProjectPage` imports resource-domain types.

## Scope

| Area | Required action |
|---|---|
| Layout switch | Extend `CloudTargetSourceLayout.tsx` with `WAITING_APPROVAL` and `APPLYING_APPROVED` cases. Keep R1 provider-axis source guard green. |
| Waiting approval step | Add `WaitingApprovalStep.tsx`. It renders page meta, `ProcessStatusCard`, `ApprovalWaitingCard` when not rejected, guide card, `CandidateResourceSection readonly`, and `RejectionAlert`. |
| Applying approved step | Add `ApplyingApprovedStep.tsx`. It renders page meta, `ProcessStatusCard`, `ApprovalApplyingBanner`, guide card, `ApprovedIntegrationSection`, and `RejectionAlert`. |
| ProcessStatusCard | Remove imports and JSX branches for `ApprovalWaitingCard` and `ApprovalApplyingBanner`. Keep `WAITING_APPROVAL` / `APPLYING_APPROVED` polling behavior intact. Remove only local helpers that become unused because those two cards moved out. |
| Provider routing | Update AWS/Azure/GCP pages so `WAITING_APPROVAL` and `APPLYING_APPROVED` return `CloudTargetSourceLayout`. `WAITING_TARGET_CONFIRMATION` remains legacy until Phase 4. |
| Tests | Add step order tests, ProcessStatusCard extraction test, and provider routing tests. |

## Component Contract

Use the same step props as previous phases:

```tsx
interface CloudStepProps {
  project: CloudTargetSource;
  identity: ProjectIdentity;
  providerLabel: string;
  action: ReactNode;
  onProjectUpdate: (project: CloudTargetSource) => void;
}
```

Both new step components derive `refreshProject` in the step layer, not in provider pages:

```tsx
const refreshProject = useCallback(async () => {
  const updated = await getProject(project.targetSourceId);
  onProjectUpdate(updated as CloudTargetSource);
}, [onProjectUpdate, project.targetSourceId]);
```

If current `origin/main` already exposes a shared helper from earlier phases, use that helper instead of duplicating the callback.

### `WaitingApprovalStep` render shape

```tsx
return (
  <>
    <ProjectPageMeta project={project} providerLabel={providerLabel} identity={identity} action={action} />
    <ProcessStatusCard project={project} onProjectUpdate={onProjectUpdate} />
    {!project.isRejected && (
      <div data-testid="approval-waiting">
        <ApprovalWaitingCard targetSourceId={project.targetSourceId} onCancelSuccess={refreshProject} />
      </div>
    )}
    {slotKey && <GuideCardContainer slotKey={slotKey} />}
    <CandidateResourceSection targetSourceId={project.targetSourceId} readonly refreshProject={refreshProject} />
    <RejectionAlert project={project} />
  </>
);
```

Keep the existing rejection behavior: the approval waiting card is hidden when `project.isRejected`, and `RejectionAlert` owns the visible rejected message.

### `ApplyingApprovedStep` render shape

```tsx
return (
  <>
    <ProjectPageMeta project={project} providerLabel={providerLabel} identity={identity} action={action} />
    <ProcessStatusCard project={project} onProjectUpdate={onProjectUpdate} />
    <div data-testid="approval-applying">
      <ApprovalApplyingBanner targetSourceId={project.targetSourceId} />
    </div>
    {slotKey && <GuideCardContainer slotKey={slotKey} />}
    <ApprovedIntegrationSection targetSourceId={project.targetSourceId} />
    <RejectionAlert project={project} />
  </>
);
```

The `data-testid` wrappers are for DOM-order tests only; do not use them for styling.

## Implementation Steps

### 1. Add step components

Create `WaitingApprovalStep.tsx` and `ApplyingApprovedStep.tsx` in the same step/layout folder used by previous phases.

Both components:

- Use `resolveStepSlot(project.cloudProvider, project.processStatus, project.awsInstallationMode)` for guide slot resolution.
- May reference `project.cloudProvider` and `project.awsInstallationMode` because they are step components, not the top-level layout.
- Must not import `CandidateResource`, `ApprovedResource`, or `ConfirmedResource`.
- Must not duplicate provider-page identity logic.

### 2. Extend layout switch

Update `CloudTargetSourceLayout`:

```tsx
case ProcessStatus.WAITING_APPROVAL:
  return <WaitingApprovalStep {...props} />;
case ProcessStatus.APPLYING_APPROVED:
  return <ApplyingApprovedStep {...props} />;
```

Do not add provider conditions in this file.

### 3. Extract from `ProcessStatusCard`

Remove:

- `ApprovalWaitingCard` import.
- `ApprovalApplyingBanner` import.
- `refreshProject` callback that existed only for `ApprovalWaitingCard`, if it becomes unused.
- The JSX blocks that render those two cards.

Keep:

- `StepProgressBar`.
- Tab state and history tab.
- Approval/applying polling effect using `getProcessStatus` and `getProject`.
- `onProjectUpdate` callback behavior.
- The `WAITING_TARGET_CONFIRMATION` instruction block. That moves in Phase 4, not here.

### 4. Provider routing

For all three provider pages, add `WAITING_APPROVAL` and `APPLYING_APPROVED` to the set of statuses routed to `CloudTargetSourceLayout`.

AWS rule remains: if `!project.awsInstallationMode`, keep the existing `AwsInstallationModeSelector` branch before the layout routing predicate.

### 5. Tests

Add tests that isolate layout order and ownership:

- `WaitingApprovalStep` renders `approval-waiting` after process status and before guide/resource sections.
- `WaitingApprovalStep` does not render `approval-waiting` when `project.isRejected` is true.
- `ApplyingApprovedStep` renders `approval-applying` before `ApprovedIntegrationSection`.
- `ProcessStatusCard` no longer renders approval cards when rendered with `WAITING_APPROVAL` / `APPLYING_APPROVED` fixtures. Prefer module mocks for `ApprovalWaitingCard` and `ApprovalApplyingBanner` that would fail if mounted.
- Provider routing tests prove AWS/Azure/GCP `WAITING_APPROVAL` and `APPLYING_APPROVED` mount `CloudTargetSourceLayout`.

Mock child sections (`CandidateResourceSection`, `ApprovedIntegrationSection`, guide card, modals) where needed to avoid API calls. These are order/ownership tests, not data-fetch tests.

### 6. Self-audit, verify, commit, push, PR

Run `/wave-task` Phase 3-6. The PR body must explicitly say that `WAITING_TARGET_CONFIRMATION` instruction extraction is deferred to Phase 4.

## Subagent Fan-out

| Substep | Fan-out target | Constraint |
|---|---|---|
| Step components and order tests | One subagent can implement both new step files plus their tests. | Must not edit `ProcessStatusCard`. |
| ProcessStatusCard extraction | Main session only or one subagent. | Must preserve polling effect and history tab. |
| Provider routing tests | One subagent can add routing tests after the route predicate is chosen. | Must not edit step components. |

If a subagent finds that `ProcessStatusCard` polling depends on the extracted cards, stop and report; do not silently rewrite the polling model.

## Guardrails

- **R1**: `CloudTargetSourceLayout.tsx` still cannot mention `cloudProvider` or `awsInstallationMode`.
- **R2**: No new slots are required in this phase. Do not introduce a slot for approval/applying unless a real provider-specific content difference appears.
- **R3**: Do not add provider-specific approval/applying step components.
- **R4**: Do not expand `ConfirmedIntegrationDataProvider`; approval/applying steps do not use confirmed data.
- **C1**: Provider pages and step components must not import `@/lib/types/resources`.
- Do not change approval API behavior, approval modal forms, or process status calculation.

## Out of Scope

- Moving the `WAITING_TARGET_CONFIRMATION` instruction block out of `ProcessStatusCard` (Phase 4).
- Deleting `ResourceSection.tsx` (Phase 4).
- Deleting confirmed legacy code (Phase 5).
- Visual redesign of approval cards.
- Browser screenshot tooling.

## Acceptance Criteria

- `WAITING_APPROVAL` page order is readable in `WaitingApprovalStep`.
- `APPLYING_APPROVED` page order is readable in `ApplyingApprovedStep`.
- `ProcessStatusCard` no longer imports or renders `ApprovalWaitingCard` / `ApprovalApplyingBanner`.
- Approval/applying polling still works: tests or code inspection prove the polling effect remains.
- AWS/Azure/GCP route `WAITING_APPROVAL` and `APPLYING_APPROVED` to `CloudTargetSourceLayout`.
- Existing Phase 1/2 tests remain green.
- `npx tsc --noEmit`: 0 errors.
- `npm run lint`: 0 new warnings.
- `npm run test:run`: all current baseline tests plus new tests are green.
- `npm run build`: clean.

## Verification Commands

```bash
! rg -nP "\bcloudProvider\b|\bawsInstallationMode\b" \
  app/integration/target-sources/\[targetSourceId\]/_components/layout/CloudTargetSourceLayout.tsx

! rg -nP "ApprovalWaitingCard|ApprovalApplyingBanner" \
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
- Spec: `docs/reports/sit-migration-prompts/adr012-phase3-approval-applying.md` @ <SHA>
- ADR reference: ADR-012 Migration Plan Phase 3
- Extracts approval/applying step-specific cards out of `ProcessStatusCard`

## Changed files
<git diff --stat>

## Verification
- [ ] npx tsc --noEmit
- [ ] npm run lint
- [ ] npm run test:run
- [ ] npm run build

## Deferred
- WAITING_TARGET_CONFIRMATION instruction extraction and `ResourceSection` removal: Phase 4
- Confirmed legacy cleanup and boundary lock: Phase 5
```
