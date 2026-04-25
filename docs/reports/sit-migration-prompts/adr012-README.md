# ADR-012 — Target Source Page Layout Migration

ADR commit: `main@f1a23b4` (PR #390 merge — ADR-012 hardened with R1-R4). The ADR reference SHA is fixed; the **implementation baseline** is whatever `origin/main` resolves to when `/wave-task` runs. Each phase rebases on `origin/main` per the wave-task pipeline before implementation.

Source ADR: [`docs/adr/012-target-source-page-layout.md`](../../adr/012-target-source-page-layout.md)

This pack drives the incremental migration from the current four-layer step-branching sprawl to the step-component + slot architecture decided in ADR-012. The full migration runs in five phases. Each phase ships as one PR via `/wave-task` and keeps `tsc` / `lint` / `test` / `build` green at every commit.

## Why incremental

A single big-bang PR would touch all three provider pages, `ProcessStatusCard`, `ResourceSection`, and the seven `ProcessStatus` step branches at once. That bundle is too large for safe review and would re-introduce the same regression class ADR-012 is trying to fix. The five-phase split lets each PR deliver visible value, ship a focused diff, and verify a narrow surface.

## Execution Order

Phases must run sequentially. Each phase narrows the surface owned by the legacy path until phase 5 deletes the residue.

| Key | Spec | Goal | Effort |
|---|---|---|---|
| `adr012-phase1` | `adr012-phase1-azure-installing.md` | Add `CloudTargetSourceLayout` and the components for Azure `INSTALLING`. Route only Azure `INSTALLING` through the new path. Land R1 source-text test. Fixes `/integration/target-sources/1003`. | Medium |
| `adr012-phase2` | (TBD) | Migrate AWS/GCP `INSTALLING` and steps 5-7 (`WAITING_CONNECTION_TEST`, `CONNECTION_VERIFIED`, `INSTALLATION_COMPLETE`) into their step components. Stop using `ConfirmedActions` for new paths. | Medium |
| `adr012-phase3` | (TBD) | Move `ApprovalWaitingCard` and `ApprovalApplyingBanner` out of `ProcessStatusCard` into `WaitingApprovalStep` and `ApplyingApprovedStep`. | Medium |
| `adr012-phase4` | (TBD) | Migrate steps 1-3 (candidate / approved). Delete `ResourceSection.tsx` after no render path imports it. | Medium |
| `adr012-phase5` | (TBD) | Cleanup: remove dead branches in `ProcessStatusCard` and `ConfirmedIntegrationSection`. Add lint/grep rule preventing `*ProjectPage.tsx` from importing `@/lib/types/resources`. | Low |

Specs for phases 2-5 are written when phase 1 lands. Drafting them upfront would freeze details that depend on what phase 1 actually exposes (slot interfaces, data provider lifecycle in practice).

## Invocation

```bash
/wave-task docs/reports/sit-migration-prompts/adr012-phase1-azure-installing.md
```

## Global Rules (apply to every phase)

These derive from ADR-012's Architectural Rules section. Every phase PR must respect them.

- **R1** — `CloudTargetSourceLayout` must not reference `cloudProvider` or `awsInstallationMode`. Enforced by Vitest source-text test landed in phase 1; subsequent phases must keep the test green.
- **R2** — Slots (`InstallationStatusSlot`, `ConfirmedResourcesSlot`, future slots) only choose. No fetch, permission check, CTA branching, or business state.
- **R3** — Provider-specific override step components (`AwsManualInstallingStep`, etc.) are reserved for card-order changes. Card-content differences use slots inside the default step.
- **R4** — `ConfirmedIntegrationDataProvider` exposes confirmed-integration data only. Adding `candidate`, `approved`, guide, permission, or terraform-status fields is forbidden. Future shared data needs a parallel provider and an ADR amendment.
- **C1 (preserved from #371)** — provider `ProjectPage` components must not import `@/lib/types/resources` (`CandidateResource`, `ApprovedResource`, `ConfirmedResource`). Phase 5 adds an automated lint/grep rule.

## What Each Phase Does Not Solve

- **Pixel-perfect rendering** is out of scope for the entire migration. Order regressions are caught by DOM-order tests; spacing/visual chrome regressions are not. Browser screenshot tooling is an open question (ADR-012 §Open Questions Q1).
- **BFF process-status model** stays as defined by ADR-009.
- **IDC / SDU layouts** are not designed by this ADR. If `CloudProvider` widens, `CloudTargetSourceLayout` must fail explicitly until separate IDC/SDU step components are designed.

## Stopping Criteria

If any phase cannot keep `tsc --noEmit` green, the session must stop and report the exact blocker rather than inventing a sub-phase. Spec authors fix the spec; implementers do not silently scope-creep.
