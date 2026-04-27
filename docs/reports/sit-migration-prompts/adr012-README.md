# ADR-012 — Target Source Page Layout Migration

ADR commit: `main@f1a23b4` (PR #390 merge — ADR-012 hardened with R1-R4). The ADR reference SHA is fixed; the **implementation baseline** is whatever `origin/main` resolves to when `/wave-task` runs. Each phase rebases on `origin/main` per the wave-task pipeline before implementation.

Source ADR: [`docs/adr/012-target-source-page-layout.md`](../../adr/012-target-source-page-layout.md)

This pack drives the incremental migration from the current four-layer step-branching sprawl to the step-component + slot architecture decided in ADR-012. The full migration runs in five specs. Each spec ships as one PR via `/wave-task` and keeps `tsc` / `lint` / `test` / `build` green at every commit.

## Why incremental

A single big-bang PR would touch all three provider pages, `ProcessStatusCard`, `ResourceSection`, and the seven `ProcessStatus` step branches at once. That bundle is too large for safe review and would re-introduce the same regression class ADR-012 is trying to fix. The five-phase split lets each PR deliver visible value, ship a focused diff, and verify a narrow surface.

## Execution Order

Phases must run sequentially. Each phase narrows the surface owned by the legacy path until phase 5 deletes the residue.

| Key | Spec | Goal | Effort |
|---|---|---|---|
| `adr012-phase1` | `adr012-phase1-azure-installing.md` | Add `CloudTargetSourceLayout` and the components for Azure `INSTALLING`. Route only Azure `INSTALLING` through the new path. Land R1 source-text test. Fixes `/integration/target-sources/1003`. | Medium |
| `adr012-phase2` | `adr012-phase2-confirmed-steps.md` | Migrate AWS/GCP `INSTALLING` and steps 5-7 (`WAITING_CONNECTION_TEST`, `CONNECTION_VERIFIED`, `INSTALLATION_COMPLETE`) into their step components. Stop using `ConfirmedActions` for new paths. | Medium-large |
| `adr012-phase3` | `adr012-phase3-approval-applying.md` | Move `ApprovalWaitingCard` and `ApprovalApplyingBanner` out of `ProcessStatusCard` into `WaitingApprovalStep` and `ApplyingApprovedStep`. | Medium |
| `adr012-phase4` | `adr012-phase4-candidate-approved.md` | Migrate the remaining candidate / approved paths, route all cloud process statuses through `CloudTargetSourceLayout`, and delete `ResourceSection.tsx`. | Medium-large |
| `adr012-phase5` | `adr012-phase5-cleanup-boundary-lock.md` | Remove confirmed-action legacy residue, add boundary-lock tests, and document the final ADR-012 ownership model. | Medium |

Phase 2-5 specs are intentionally explicit even though later implementation details may shift after earlier PRs land. `/wave-task` implementers must re-read the current `origin/main` shape at Phase 0 and preserve the intent if file names or signatures have drifted.

## Invocation

Run each command from a fresh Claude Code session with Opus 4.7. Do not start the next command until the previous `/wave-task` PR is merged into `main`; every command rebases on the current `origin/main`.

### Session 1

```bash
/wave-task docs/reports/sit-migration-prompts/adr012-phase1-azure-installing.md
```

After the Phase 1 PR is merged:

```bash
/wave-task docs/reports/sit-migration-prompts/adr012-phase2-confirmed-steps.md
```

### Session 2

```bash
/wave-task docs/reports/sit-migration-prompts/adr012-phase3-approval-applying.md
```

After the Phase 3 PR is merged:

```bash
/wave-task docs/reports/sit-migration-prompts/adr012-phase4-candidate-approved.md
```

### Session 3

```bash
/wave-task docs/reports/sit-migration-prompts/adr012-phase5-cleanup-boundary-lock.md
```

## Direct Prompt List

Use this list when launching each wave individually:

```bash
/wave-task docs/reports/sit-migration-prompts/adr012-phase1-azure-installing.md
/wave-task docs/reports/sit-migration-prompts/adr012-phase2-confirmed-steps.md
/wave-task docs/reports/sit-migration-prompts/adr012-phase3-approval-applying.md
/wave-task docs/reports/sit-migration-prompts/adr012-phase4-candidate-approved.md
/wave-task docs/reports/sit-migration-prompts/adr012-phase5-cleanup-boundary-lock.md
```

## Model Guidance

All specs are suitable for Opus 4.7. Phase 2 and Phase 4 intentionally contain larger cross-file migrations so the implementer can keep the layout contracts, routing changes, and tests in one mental model.

| Spec | Recommended model | Reason |
|---|---|---|
| Phase 1 | Opus 4.7 | First architectural slice, data provider lifecycle, order tests. |
| Phase 2 | Opus 4.7 | Three providers plus confirmed-data step migration and routing tests. |
| Phase 3 | Opus 4.7 | UI ownership extraction from `ProcessStatusCard` with polling behavior preserved. |
| Phase 4 | Opus 4.7 | Final provider-page routing cutover and `ResourceSection` removal. |
| Phase 5 | Opus 4.7 | Cleanup plus architecture guards that must not overfit to transitional code. |

## Global Rules (apply to every phase)

These derive from ADR-012's Architectural Rules section. Every phase PR must respect them.

- **R1** — `CloudTargetSourceLayout` must not reference `cloudProvider` or `awsInstallationMode`. Enforced by Vitest source-text test landed in phase 1; subsequent phases must keep the test green.
- **R2** — Slots (`InstallationStatusSlot`, `ConfirmedResourcesSlot`, future slots) only choose. No fetch, permission check, CTA branching, or business state.
- **R3** — Provider-specific override step components (`AwsManualInstallingStep`, etc.) are reserved for card-order changes. Card-content differences use slots inside the default step.
- **R4** — `ConfirmedIntegrationDataProvider` exposes confirmed-integration data only. Adding `candidate`, `approved`, guide, permission, or terraform-status fields is forbidden. Future shared data needs a parallel provider and an ADR amendment.
- **C1 (preserved from #371)** — provider `ProjectPage` components must not import `@/lib/types/resources` (`CandidateResource`, `ApprovedResource`, `ConfirmedResource`). Phase 5 adds an automated lint/grep rule.

## Cross-Phase Ownership Target

By the end of Phase 5:

- Provider pages (`AwsProjectPage`, `AzureProjectPage`, `GcpProjectPage`) own provider identity metadata and provider-specific pre-process guards only.
- `CloudTargetSourceLayout` owns the `ProcessStatus` switch and remains provider-axis agnostic.
- Step components own card order as JSX.
- Slots choose provider-specific card bodies or bridge a single data provider to a presentation component.
- `ProcessStatusCard` owns only status progress, polling, and history tab chrome; it no longer owns step-specific cards.
- Confirmed, candidate, and approved resource sections own their own data and UI below the step layer.

## What Each Phase Does Not Solve

- **Pixel-perfect rendering** is out of scope for the entire migration. Order regressions are caught by DOM-order tests; spacing/visual chrome regressions are not. Browser screenshot tooling is an open question (ADR-012 §Open Questions Q1).
- **BFF process-status model** stays as defined by ADR-009.
- **IDC / SDU layouts** are not designed by this ADR. If `CloudProvider` widens, `CloudTargetSourceLayout` must fail explicitly until separate IDC/SDU step components are designed.

## Stopping Criteria

If any phase cannot keep `tsc --noEmit` green, the session must stop and report the exact blocker rather than inventing a sub-phase. Spec authors fix the spec; implementers do not silently scope-creep.

## Final Guard Inventory (post-Phase 5)

Phase 5 lands four automated source-text guards that prevent the regressions ADR-012 was designed to fix from quietly returning. All four run in `npm run test:run` alongside the rest of the suite.

| Guard | Test file | Protects |
|---|---|---|
| **R1** — Layout provider-axis isolation | `app/integration/target-sources/[targetSourceId]/_components/layout/CloudTargetSourceLayout.architecture.test.ts` | Top-level layout cannot branch on `cloudProvider`, `awsInstallationMode`, `CloudProvider` type, or `AwsInstallationMode` type. |
| **R2 (coarse)** — Slot purity | `app/integration/target-sources/[targetSourceId]/_components/layout/Slots.purity.test.ts` | `InstallationStatusSlot` / `ConfirmedResourcesSlot` / `ConnectionTestSlot` must not contain `useState`, `useEffect`, direct API helpers (`getConfirmedIntegration`, `getApprovedIntegration`, `getConfirmResources`), or raw `fetch(`. |
| **C1** — Provider-page resource-type boundary | `app/integration/target-sources/[targetSourceId]/_components/ProjectPage.boundary.test.ts` | AWS / Azure / GCP `*ProjectPage.tsx` cannot import from `@/lib/types/resources` or reference `CandidateResource` / `ApprovedResource` / `ConfirmedResource`. |
| **Routing coverage** — Process-status exhaustion | `app/integration/target-sources/[targetSourceId]/_components/layout/CloudTargetSourceLayout.coverage.test.tsx` | A single `STATUS_TO_SENTINEL: Record<ProcessStatus, string>` map drives both per-status routing assertions and an enum-exhaustion check. Adding a new `ProcessStatus` member fails the suite until it is mapped to a step component. |

These guards complement (do not replace) the existing per-step DOM-order tests landed by Phases 1-3 (`CloudInstallingStep.test.tsx`, `ConnectionTestStep.test.tsx`, `WaitingApprovalStep.test.tsx`, `ApplyingApprovedStep.test.tsx`, `WaitingTargetConfirmationStep.test.tsx`).

Implementation deviations from the pack:
- Phase 3 extracted a shared `isLayoutRoutedStatus` helper in `route-step.ts`; Phase 4 deleted it because the predicate became always-true once `WAITING_TARGET_CONFIRMATION` was absorbed.
- Phase 4 lifted the single `<main>` page-shell out of the `CloudTargetSourceLayout` switch (originally repeated per case).
- Phase 4 collapsed Azure and GCP provider pages to identity construction + a single `<CloudTargetSourceLayout>` return; AWS keeps the pre-process `AwsInstallationModeSelector` gate per spec.
