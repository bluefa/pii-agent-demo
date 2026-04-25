# ADR-012 Phase 5 — Cleanup and Boundary Lock

## Intent

Finalize the ADR-012 migration by removing legacy confirmed-action residue and adding automated boundary checks that prevent the original regression class from returning.

By this point, provider pages should delegate normal cloud process rendering to `CloudTargetSourceLayout`, and step components should own card order. This phase removes code that only supported the old four-layer branching model and locks the new ownership rules with tests.

Source ADR: [`docs/adr/012-target-source-page-layout.md`](../../adr/012-target-source-page-layout.md), especially Migration Plan Phase 5.

## Preconditions

- Phase 1 through Phase 4 are merged into `main`.
- `ResourceSection.tsx` has already been deleted.
- `ProcessStatusCard` no longer renders step-specific content.
- Step 1-7 cloud process statuses route through `CloudTargetSourceLayout`.

If any precondition is false, stop in `/wave-task` Phase 0 and report the missing previous phase.

## Required Outcome

After this PR is merged:

1. No render path depends on `ConfirmedIntegrationSection` or its internal `ConfirmedActions` switch.
2. Dead confirmed-action branches are removed.
3. Provider pages are protected by an automated C1 boundary test: no imports from `@/lib/types/resources`.
4. `CloudTargetSourceLayout` R1 protection remains and is complemented by a process-status coverage test.
5. Slot source guards catch obvious R2 regressions (`useState`, `useEffect`, and direct API fetches in slot files).
6. Docs summarize the final ADR-012 ownership model and list the guard tests that enforce it.

## Scope

| Area | Required action |
|---|---|
| Confirmed legacy cleanup | Delete `ConfirmedIntegrationSection.tsx` if no imports remain. If `ConfirmedIntegrationTable.tsx` or `confirmed/errors.ts` are still used by `ConfirmedResourcesSlot`, keep them. |
| Export cleanup | Update `confirmed/index.ts` or related barrel exports so deleted modules are not exported. Delete the barrel only if no imports remain. |
| Boundary tests | Add a source-text architecture test that checks AWS/Azure/GCP `*ProjectPage.tsx` files do not import `@/lib/types/resources` or resource-domain type names. |
| Layout coverage test | Add or strengthen a test that every current cloud `ProcessStatus` case maps to a step component in `CloudTargetSourceLayout`. |
| Slot purity guard | Add a source-text test for slot files that catches obvious R2 violations: `useState`, `useEffect`, `getConfirmedIntegration`, `getApprovedIntegration`, `getConfirmResources`, and `fetch(`. |
| Docs | Update this README pack or add a short completion note under `docs/reports/sit-migration-prompts/adr012-README.md` if the implemented shape differs from the planned shape. |

## Cleanup Rules

Delete only code proven dead on current `origin/main`.

Use `rg` before removal:

```bash
rg -n "ConfirmedIntegrationSection|ConfirmedActions" app lib docs
rg -n "from '@/app/integration/target-sources/\\[targetSourceId\\]/_components/confirmed'" app lib
rg -n "ConfirmedIntegrationTable|getConfirmedErrorMessage" app lib
```

Expected cleanup:

- `ConfirmedIntegrationSection.tsx` should be deleted when no imports remain.
- The private `ConfirmedActions` component disappears with that file.
- `ConfirmedIntegrationTable.tsx` likely remains if `ConfirmedResourcesSlot` uses it.
- `confirmed/errors.ts` likely remains if `ConfirmedResourcesSlot` uses `getConfirmedErrorMessage`.
- Do not delete table/errors modules only because they live in the same folder.

If `ConfirmedIntegrationSection` is still imported after Phase 4, stop and report. Do not keep both old and new confirmed-action paths alive in Phase 5.

## Boundary Tests

### C1 provider-page resource type guard

Add a Vitest source-text test near the target-source components, for example:

`app/integration/target-sources/[targetSourceId]/_components/ProjectPage.boundary.test.ts`

It should read:

- `aws/AwsProjectPage.tsx`
- `azure/AzureProjectPage.tsx`
- `gcp/GcpProjectPage.tsx`

Assert:

- No `from '@/lib/types/resources'` or `from "@/lib/types/resources"`.
- No imported type names `CandidateResource`, `ApprovedResource`, or `ConfirmedResource`.

Keep this source-text test focused on provider pages. Step/resource components are allowed to import resource-domain types where appropriate.

### R1 layout provider-axis guard

Keep the Phase 1 test. If the test file was narrow, update it to also reject:

- `project.cloudProvider`
- `project.awsInstallationMode`
- `CloudProvider`
- `AwsInstallationMode`

Do not reject generic prop passing or type imports that are required by the current component signature unless they actually expose provider-axis branching. Prefer precise regexes over broad substrings.

### Process-status coverage

Add a test that fails if a new cloud `ProcessStatus` enum member is added without a layout decision. A practical pattern is:

- Mock each step component to a sentinel.
- Render `CloudTargetSourceLayout` for each current `ProcessStatus` value.
- Assert the expected sentinel appears.

This is not a provider matrix test. It proves that the top-level process switch has no silent default for known cloud statuses.

### R2 slot source guard

Add a source-text test for slot files under the layout folder:

- `InstallationStatusSlot.tsx`
- `ConfirmedResourcesSlot.tsx`
- `ConnectionTestSlot.tsx` if present

Assert they do not contain:

- `useState`
- `useEffect`
- `getConfirmedIntegration`
- `getApprovedIntegration`
- `getConfirmResources`
- `fetch(`

This is intentionally a coarse guard. It does not replace review for semantic slot purity, but it blocks the most common drift.

## Implementation Steps

### 1. Inventory dead imports

Run the `rg` commands above and record the result in the PR body. If an old import remains, decide whether it is a real caller or a stale export.

### 2. Remove confirmed legacy residue

Delete `ConfirmedIntegrationSection.tsx` and clean exports/imports. Keep `ConfirmedIntegrationTable.tsx` and confirmed error helpers if used by the new slots.

Do not change the confirmed table presentation in this phase unless removing the old section reveals an unused prop/import.

### 3. Add architecture tests

Add tests for C1, R1, process-status coverage, and R2 coarse slot purity.

Use `readFileSync` source tests for C1/R1/R2. Use Testing Library only for process-status render coverage if mocking step components is straightforward on current `origin/main`.

### 4. Documentation update

Update `adr012-README.md` only if current implementation differs from the pack. Keep the direct `/wave-task` prompt list intact.

If the migration exactly matches the pack, add a short "Final guard inventory" section listing the architecture tests and what they protect.

### 5. Self-audit, verify, commit, push, PR

Run `/wave-task` Phase 3-6. Phase 5 is cleanup, but it still must run `build` because barrel export changes can break route bundles.

## Subagent Fan-out

| Substep | Fan-out target | Constraint |
|---|---|---|
| Dead-code inventory | One subagent can run read-only `rg` and report import graph. | No edits. |
| Architecture tests | One subagent can add source-text tests. | Must not delete files. |
| Cleanup edits | Main session recommended. | Deletes files and updates barrels/imports. |

Do not let two agents edit barrel exports or the same test file concurrently.

## Guardrails

- Do not remove `ConfirmedIntegrationTable` or confirmed error helpers if new slots use them.
- Do not add new lint infrastructure if Vitest source-text tests satisfy the boundary-lock goal.
- Do not widen C1 beyond provider pages; resource-layer components may import resource-domain types.
- Do not convert R2 into an over-broad rule that blocks legitimate presentational components.
- Do not touch API routes, swagger, or BFF mocks.
- Keep all previous ADR-012 tests green.

## Out of Scope

- Pixel/screenshot regression tooling.
- IDC/SDU layout design.
- Refactoring `CandidateResourceSection`, `ApprovedIntegrationSection`, or `ConfirmedIntegrationTable` beyond import cleanup.
- Changing process-status enum semantics.
- New visual design.

## Acceptance Criteria

- `ConfirmedIntegrationSection.tsx` is deleted, or the PR body contains a clear blocker proving it cannot be deleted yet. The expected successful path is deletion.
- No `ConfirmedActions` symbol remains in app code.
- Provider-page resource-type boundary test exists and passes.
- R1 layout source-text test still passes.
- Process-status coverage test exists and passes for all current cloud statuses.
- Slot purity source guard exists and passes.
- `npx tsc --noEmit`: 0 errors.
- `npm run lint`: 0 new warnings.
- `npm run test:run`: all current baseline tests plus new tests are green.
- `npm run build`: clean.

## Verification Commands

```bash
! rg -n "ConfirmedActions" app lib

! rg -n "ConfirmedIntegrationSection" \
  app/integration/target-sources/\[targetSourceId\]/_components

! rg -nP "from\s+['\"]@/lib/types/resources['\"]|CandidateResource|ApprovedResource|ConfirmedResource" \
  app/integration/target-sources/\[targetSourceId\]/_components/{aws,azure,gcp}/*ProjectPage.tsx

! rg -nP "\bcloudProvider\b|\bawsInstallationMode\b" \
  app/integration/target-sources/\[targetSourceId\]/_components/layout/CloudTargetSourceLayout.tsx

! rg -nE "useState|useEffect|getConfirmedIntegration|getApprovedIntegration|getConfirmResources|fetch\\(" \
  app/integration/target-sources/\[targetSourceId\]/_components/layout/*Slot.tsx

npx tsc --noEmit
npm run lint
npm run test:run
npm run build
```

## PR Description Template

```markdown
## Summary
- Spec: `docs/reports/sit-migration-prompts/adr012-phase5-cleanup-boundary-lock.md` @ <SHA>
- ADR reference: ADR-012 Migration Plan Phase 5
- Removes confirmed legacy action path and adds boundary-lock tests

## Cleanup inventory
<rg summary for ConfirmedIntegrationSection / ConfirmedActions / confirmed table helpers>

## Changed files
<git diff --stat>

## Verification
- [ ] npx tsc --noEmit
- [ ] npm run lint
- [ ] npm run test:run
- [ ] npm run build

## Deferred
- None for ADR-012 migration. Remaining screenshot tooling is ADR-012 Open Question Q1.
```
