# ADR-012 Phase 2 — Confirmed-Data Steps Migration

## Intent

Migrate the remaining confirmed-data render paths into the ADR-012 step-component architecture after Phase 1 has landed.

This phase expands the new path from Azure `INSTALLING` to:

- AWS `INSTALLING` when `awsInstallationMode` is already selected.
- GCP `INSTALLING`.
- All providers for `WAITING_CONNECTION_TEST`, `CONNECTION_VERIFIED`, and `INSTALLATION_COMPLETE`.

At the end of this PR, step 4-7 card order is owned by named step components and slots. The legacy `ConfirmedIntegrationSection` may still exist for cleanup, but no cloud provider page should route step 4-7 through `ResourceSection`.

Source ADR: [`docs/adr/012-target-source-page-layout.md`](../../adr/012-target-source-page-layout.md), especially Migration Plan Phase 2.

## Preconditions

- Phase 1 is merged into `main`.
- `CloudTargetSourceLayout`, `InstallingStep`, `CloudInstallingStep`, `InstallationStatusSlot`, `ConfirmedResourcesSlot`, and `ConfirmedIntegrationDataProvider` already exist on current `origin/main`.
- The Phase 1 R1 architecture test is green before this work starts.

If any precondition is false, stop in `/wave-task` Phase 0 and report the mismatch instead of re-implementing Phase 1.

## Required Outcome

After this PR is merged:

1. AWS / Azure / GCP `INSTALLING` with a valid provider setup render through `CloudTargetSourceLayout`.
2. AWS projects with no `awsInstallationMode` still render `AwsInstallationModeSelector` before entering any process-step layout.
3. `WAITING_CONNECTION_TEST`, `CONNECTION_VERIFIED`, and `INSTALLATION_COMPLETE` render through a new `ConnectionTestStep`.
4. For `INSTALLING`, `InstallationStatusSlot` appears before `ConfirmedResourcesSlot`.
5. For connection-test steps, `ConfirmedResourcesSlot` appears before the connection-test action slot, matching the legacy table-first order.
6. `ConfirmedActions` inside `ConfirmedIntegrationSection` is no longer used by any provider-page render path for step 4-7.
7. R1 / R2 / R3 / R4 / C1 guardrails remain true.

## Scope

| Area | Required action |
|---|---|
| Layout switch | Extend `CloudTargetSourceLayout.tsx` so `WAITING_CONNECTION_TEST`, `CONNECTION_VERIFIED`, and `INSTALLATION_COMPLETE` return `<ConnectionTestStep ... />`. Keep the file free of `cloudProvider` and `awsInstallationMode`. |
| Installing gate | Update `InstallingStep.tsx` only if current product behavior proves a provider-specific order override is needed. Default decision: do **not** add `AwsManualInstallingStep`; AWS manual/auto both use `CloudInstallingStep` because only card content differs. |
| Provider status adapters | Add `AwsInstallationStatus.tsx` and `GcpInstallationStatus.tsx` under provider folders near existing page components or the layout subtree, matching the Phase 1 `AzureInstallationStatus` adapter style. They are pure adapters around `AwsInstallationInline` / `GcpInstallationInline`. |
| Installation slot | Update `InstallationStatusSlot.tsx` to dispatch AWS, Azure, and GCP. It remains selection-only: no fetch, no permission checks, no lifecycle state. |
| Connection step | Add `ConnectionTestStep.tsx`. It wraps the step body in `ConfirmedIntegrationDataProvider`, renders page meta, process status, guide card, `ConfirmedResourcesSlot`, a new connection-test slot, and `RejectionAlert`. |
| Connection slot | Add `ConnectionTestSlot.tsx`. It reads `useConfirmedIntegration().state`; while loading/error it returns `null` because `ConfirmedResourcesSlot` owns those rows. When ready, it renders `ConnectionTestPanel` with `confirmed={state.data}` and `onResourceUpdate={refreshProject}`. |
| Provider routing | Modify `AwsProjectPage.tsx`, `AzureProjectPage.tsx`, and `GcpProjectPage.tsx` so step 4-7 statuses return `<CloudTargetSourceLayout ... />`. Steps 1-3 stay on the legacy provider-page body until later phases. |
| Tests | Add/extend routing, slot dispatch, and DOM-order tests listed below. Keep the Phase 1 lifecycle tests green. |

## Component Contract

The step props continue the Phase 1 shape. Re-read the actual Phase 1 files on `origin/main` and match their names exactly.

```tsx
interface CloudStepProps {
  project: CloudTargetSource;
  identity: ProjectIdentity;
  providerLabel: string;
  action: ReactNode;
  onProjectUpdate: (project: CloudTargetSource) => void;
}
```

`ConnectionTestStep` derives the same `refreshProject` callback pattern used by `CloudInstallingStep`. It also derives the guide slot with:

```tsx
resolveStepSlot(project.cloudProvider, project.processStatus, project.awsInstallationMode)
```

The third argument is allowed in step components and provider pages, but not in `CloudTargetSourceLayout`. This preserves R1: the top-level layout switches only on `processStatus`.

Recommended render shape:

```tsx
return (
  <ConfirmedIntegrationDataProvider targetSourceId={project.targetSourceId}>
    <ProjectPageMeta project={project} providerLabel={providerLabel} identity={identity} action={action} />
    <ProcessStatusCard project={project} onProjectUpdate={onProjectUpdate} />
    {slotKey && <GuideCardContainer slotKey={slotKey} />}
    <ConfirmedResourcesSlot />
    <ConnectionTestSlot targetSourceId={project.targetSourceId} refreshProject={refreshProject} />
    <RejectionAlert project={project} />
  </ConfirmedIntegrationDataProvider>
);
```

`ConnectionTestSlot` should wrap its ready child in `<div data-testid="connection-test">` so order tests do not depend on Korean copy or nested panel structure.

`InstallationStatusSlot` and `ConfirmedResourcesSlot` must keep the Phase 1 test ids:

- `data-testid="installation-status"`
- `data-testid="confirmed-resources"`

## Implementation Steps

### 1. Adapter and slot expansion

Add `AwsInstallationStatus` and `GcpInstallationStatus` as pure adapters:

- Accept `{ project, refreshProject }` or the exact Phase 1 slot prop shape.
- Pass `targetSourceId={project.targetSourceId}`.
- Pass `onInstallComplete={refreshProject}`.
- Do not read confirmed data unless the existing inline component requires it. Today AWS and GCP inline components do not require `confirmed`.
- Do not add provider-specific state or polling; existing inline components own installation-status polling.

Then update `InstallationStatusSlot` to dispatch:

```tsx
switch (project.cloudProvider) {
  case 'AWS':
    return <AwsInstallationStatus project={project} refreshProject={refreshProject} />;
  case 'Azure':
    return <AzureInstallationStatus project={project} refreshProject={refreshProject} />;
  case 'GCP':
    return <GcpInstallationStatus project={project} refreshProject={refreshProject} />;
}
```

If TypeScript exhaustiveness requires a default, return `null` only after explicitly proving `CloudProvider` cannot include IDC/SDU on current `origin/main`.

### 2. Connection step

Add `ConnectionTestSlot` and `ConnectionTestStep`.

`ConnectionTestSlot` must be small. It may read `useConfirmedIntegration().state`, but it must not call `getConfirmedIntegration`, maintain local state, or derive permissions.

`ConnectionTestStep` owns order only. It should not duplicate `ConfirmedResourcesSlot` internals and should not import `ConfirmedResource`.

### 3. Provider routing

Update provider pages with a small predicate such as a local helper or inline `Set`:

```tsx
const isConfirmedDataStep =
  project.processStatus === ProcessStatus.INSTALLING ||
  project.processStatus === ProcessStatus.WAITING_CONNECTION_TEST ||
  project.processStatus === ProcessStatus.CONNECTION_VERIFIED ||
  project.processStatus === ProcessStatus.INSTALLATION_COMPLETE;
```

For AWS, the existing `!project.awsInstallationMode` branch stays before this predicate. Do not route AWS projects without a selected installation mode into `CloudTargetSourceLayout`.

For Azure and GCP, step 4-7 should return `CloudTargetSourceLayout`; steps 1-3 keep the legacy body exactly as before.

### 4. Tests

Add or extend tests for:

- `InstallationStatusSlot` dispatches AWS / Azure / GCP adapters and keeps `installation-status` wrapper.
- `ConnectionTestStep` renders `confirmed-resources` before `connection-test`.
- AWS routing:
  - `INSTALLING` with `awsInstallationMode` mounts `CloudTargetSourceLayout`.
  - missing `awsInstallationMode` still mounts `AwsInstallationModeSelector`, not `CloudTargetSourceLayout`.
  - `WAITING_CONNECTION_TEST` mounts `CloudTargetSourceLayout`.
- GCP routing: `INSTALLING` and one connection-test status mount `CloudTargetSourceLayout`.
- Azure routing: Phase 1 `INSTALLING` still mounts `CloudTargetSourceLayout`, and one connection-test status now mounts it too.
- R1 architecture test from Phase 1 still passes.

Mock `CloudTargetSourceLayout` in provider-page routing tests so they only verify routing decisions. Mock installation inline components in slot tests so the tests do not trigger real polling hooks.

### 5. Self-audit, verify, commit, push, PR

Run `/wave-task` Phase 3-6 exactly. The PR body must call out that `ConfirmedIntegrationSection` remains only as legacy residue for later cleanup if it is still imported by `ResourceSection`.

## Subagent Fan-out

Use `/wave-task` fan-out only where files are independent:

| Substep | Fan-out target | Constraint |
|---|---|---|
| Adapter and installation slot tests | One subagent can own `AwsInstallationStatus`, `GcpInstallationStatus`, and `InstallationStatusSlot` tests. | Must not edit provider pages. |
| Connection step and order tests | One subagent can own `ConnectionTestStep`, `ConnectionTestSlot`, and DOM-order tests. | Must not edit installation slot files. |
| Provider routing tests | One subagent can write routing tests after the main session decides the exact routing predicate. | Must not edit layout components unless returning a test-only import fix. |

The main session owns final provider-page edits and conflict resolution.

## Guardrails

- **R1**: `CloudTargetSourceLayout.tsx` must not match `\bcloudProvider\b` or `\bawsInstallationMode\b`.
- **R2**: `InstallationStatusSlot` and `ConnectionTestSlot` only choose/bridge. No `useState`, no `useEffect`, no API calls.
- **R3**: Do not add `AwsManualInstallingStep` unless AWS has a real order difference from `CloudInstallingStep`. A manual-mode content difference belongs inside `AwsInstallationStatus` or the existing AWS inline component.
- **R4**: Do not add connection-test, installation, guide, permission, candidate, or approved data to `ConfirmedIntegrationDataProvider`.
- **C1**: Provider pages must not import `@/lib/types/resources`.
- Do not modify API routes, BFF contracts, swagger files, or mock business logic in this phase.

## Out of Scope

- Moving `ApprovalWaitingCard` or `ApprovalApplyingBanner` out of `ProcessStatusCard` (Phase 3).
- Migrating `WAITING_TARGET_CONFIRMATION`, `WAITING_APPROVAL`, or `APPLYING_APPROVED` to the layout (Phase 3/4).
- Deleting `ResourceSection.tsx` (Phase 4).
- Deleting `ConfirmedIntegrationSection.tsx` (Phase 5).
- Adding IDC/SDU support.

## Acceptance Criteria

- `/integration/target-sources/1008` (AWS `INSTALLING`) uses the new layout and renders installation status before confirmed resources.
- `/integration/target-sources/1010` (AWS `WAITING_CONNECTION_TEST`) uses the new layout and renders confirmed resources before connection test.
- `/integration/target-sources/1003` (Azure `INSTALLING`) still uses the Phase 1 path and remains fixed.
- A GCP `INSTALLING` fixture or synthetic typed fixture uses the new layout.
- AWS no-mode projects still render `AwsInstallationModeSelector`.
- `npx tsc --noEmit`: 0 errors.
- `npm run lint`: 0 new warnings.
- `npm run test:run`: all current baseline tests plus new tests are green.
- `npm run build`: clean.

## Verification Commands

```bash
! rg -nP "\bcloudProvider\b|\bawsInstallationMode\b" \
  app/integration/target-sources/\[targetSourceId\]/_components/layout/CloudTargetSourceLayout.tsx

! rg -nP "from\s+['\"]@/lib/types/resources['\"]" \
  app/integration/target-sources/\[targetSourceId\]/_components/{aws,azure,gcp}/*ProjectPage.tsx

! rg -nE "useState|useEffect|getConfirmedIntegration|getApprovedIntegration|getConfirmResources" \
  app/integration/target-sources/\[targetSourceId\]/_components/layout/{InstallationStatusSlot,ConnectionTestSlot}.tsx

npx tsc --noEmit
npm run lint
npm run test:run
npm run build
```

## PR Description Template

```markdown
## Summary
- Spec: `docs/reports/sit-migration-prompts/adr012-phase2-confirmed-steps.md` @ <SHA>
- ADR reference: ADR-012 Migration Plan Phase 2
- Migrates AWS/GCP INSTALLING and all provider connection-test steps to `CloudTargetSourceLayout`

## Changed files
<git diff --stat>

## Verification
- [ ] npx tsc --noEmit
- [ ] npm run lint
- [ ] npm run test:run
- [ ] npm run build
- [ ] Manual smoke: 1003, 1008, 1010, one GCP INSTALLING/connection fixture

## Deferred
- Approval/applying extraction: Phase 3
- Candidate/approved final cutover and `ResourceSection` deletion: Phase 4
- Confirmed legacy cleanup and boundary lock: Phase 5
```
