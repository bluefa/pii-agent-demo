# SIT Step Polish — Waves 9–13

Spec set for closing the implementation gaps between
`design/SIT Prototype v7 - standalone.html` and the post-Wave-7 target-source
detail surface.

## Origin

Driven by `docs/reports/sit-prototype-implementation-gaps-audit-2026-05-14.md`
(PR #473). The audit found seven dimensions of drift; the remediation is
sliced into one foundation wave plus four parallel waves.

## Scope guard (read first)

Frontend-only. No BFF endpoint changes, no swagger updates, no schema
expansion. Two strong constraints (inherited from Waves 0–7):

1. **ProcessStatus stepper motion is off-limits.** Four files remain frozen
   across every wave below:
   - `app/components/features/process-status/ProcessProgressBar.tsx`
   - `app/components/features/process-status/InstallationProcessProgressBar.tsx`
   - `app/components/features/process-status/motion/**`
   - `app/components/features/process-status/StepProgressBar.tsx`
2. **No new BFF fields.** Per-resource Integrated/Healthy/Per-provider state
   continues to be derived from existing payloads — every new state field
   added in this set is a UI-side derive, not a BFF schema change.

## Wave layout

| Wave | Title | Type | Scope | Depends on |
|---|---|---|---|---|
| 9 | Foundation primitives | Code (UI) | `CopyButton`, `cardStyles.cardTitle`, `ScanPill` new/changed states, page `bg-muted` shell | — |
| 10 | Step 4 (INSTALLING) polish | Code (UI) | `CloudInstallingStep`, `InstallResourceTable` — Provider tag, GCP fork decision, provider-aware status label, GuideCard mount, CopyButton on mono cells | Wave 9 |
| 11 | Step 2 + Step 3 polish | Code (UI) | `WaitingApprovalStep`/`WaitingApprovalCard`, `ApplyingApprovedStep` — GuideCard mount, `cardTitle` token swap | Wave 9 |
| 12 | Step 5 + Step 6 + Step 7 polish | Code (UI) | `WaitingConnectionTestStep`, `ConnectionVerifiedStep`, `InstallationCompleteStep` — GuideCard mount, `cardTitle` token swap | Wave 9 |
| 13 | Table copy-on-hover (3 tables) | Code (UI) | `WaitingApprovalTable`, `ApprovedIntegrationTable`, `ConfirmedIntegrationTable` — adopt `CopyButton` on mono cells | Wave 9 |

Step 1 (`WaitingTargetConfirmationStep`) is **out of scope** — it already
mounts `GuideCardContainer` (Waves 0–7 outcome) and its typography is
delegated to children that already consume `cardStyles.*`. No spec needed.

## Dependency graph

```
Wave 9 (foundation)
  ├── Wave 10 (Step 4)
  ├── Wave 11 (Step 2+3)
  ├── Wave 12 (Step 5+6+7)
  └── Wave 13 (3 tables)
```

After Wave 9 lands, Waves 10–13 run **fully in parallel** — their file scopes
do not overlap. The audit's three-wave recommendation was rebucketed into
this five-wave layout so that Step 4's unique provider work doesn't block
the simpler step polish.

### File-scope matrix (parallelism proof)

**Production files** (each wave's own components; test files follow the
same scope):

| File | W10 | W11 | W12 | W13 |
|---|:---:|:---:|:---:|:---:|
| `CloudInstallingStep.tsx` | ✓ |  |  |  |
| `InstallResourceTable.tsx` | ✓ |  |  |  |
| `GcpInstallationInline.tsx` (caller update) | ✓ |  |  |  |
| `WaitingApprovalStep.tsx` |  | ✓ |  |  |
| `WaitingApprovalCard.tsx` |  | ✓ |  |  |
| `ApplyingApprovedStep.tsx` |  | ✓ |  |  |
| `WaitingConnectionTestStep.tsx` |  |  | ✓ |  |
| `ConnectionVerifiedStep.tsx` |  |  | ✓ |  |
| `InstallationCompleteStep.tsx` |  |  | ✓ |  |
| `WaitingApprovalTable.tsx` |  |  |  | ✓ |
| `ApprovedIntegrationTable.tsx` |  |  |  | ✓ |
| `ConfirmedIntegrationTable.tsx` |  |  |  | ✓ |

Test files (`__tests__/<Component>.test.tsx`) are owned by the same wave
as the component they cover. The waves never touch each other's tests.

**Parallelism proof:** no file row is assigned to more than one of
Waves 10–13. ✓

## Out-of-scope acknowledgements

The audit flagged a few items that are **not** in this set:

1. **`Tooltip` keyboard a11y** — open Wave 5 follow-up; will be a separate
   fix PR scoped to the `Tooltip` primitive.
2. **Decorative hover lift** (`approval-stat`, `install-task`) — P3 in the
   audit; defer until higher-priority items land.
3. **Step 1 polish** — already complete.
4. **Tooltip coverage on column headers / abbreviated cells** — content-driven
   work; the affected cells will get tooltips on a per-surface basis as copy
   gets finalized.

## How to execute a wave

Each `waveN-*.md` is self-contained and `/wave-task` compatible:

```
/wave-task docs/reports/sit-step-polish/wave9-foundation.md
```

Wave 9 must merge before Waves 10–13 can run (it ships the `CopyButton`,
`cardStyles.cardTitle`, and `ScanPill` semantic states that the later waves
import). After Wave 9 is on `origin/main`:

```
# in four separate worktrees, in parallel
/wave-task docs/reports/sit-step-polish/wave10-step4-installing.md
/wave-task docs/reports/sit-step-polish/wave11-step2-3-approval-applying.md
/wave-task docs/reports/sit-step-polish/wave12-step5-6-7-post-install.md
/wave-task docs/reports/sit-step-polish/wave13-tables-copy-hover.md
```

## File index

- `00-README.md` — this file
- `wave9-foundation.md` — `CopyButton`, `cardStyles.cardTitle`, `ScanPill` states, page `bg-muted` shell
- `wave10-step4-installing.md` — `CloudInstallingStep` Provider tag + GCP fork + GuideCard; `InstallResourceTable` provider-aware label + CopyButton
- `wave11-step2-3-approval-applying.md` — GuideCard mount in Step 2/3; `cardTitle` token swap in `WaitingApprovalCard`
- `wave12-step5-6-7-post-install.md` — GuideCard mount in Step 5/6/7; `cardTitle` token swap in `ConnectionVerifiedStep`, `InstallationCompleteStep`
- `wave13-tables-copy-hover.md` — `CopyButton` on mono cells in `WaitingApprovalTable`, `ApprovedIntegrationTable`, `ConfirmedIntegrationTable`

## Acceptance for this README

This README is correct when:
- A new contributor can pick a wave name and run `/wave-task` against it
  without prior context.
- The file-scope matrix above matches each wave spec's actual touched files.
- Wave 9's exported primitives are what Waves 10–13 import.
- Step 1's exclusion is justified by the existing GuideCard mount.
