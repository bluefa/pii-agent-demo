# Wave 16-D4 - Resource Section Switch And Legacy Cleanup

## Context

D1-D3 introduced separated resource types and component-owned sections. This PR finishes the migration: ProjectPage uses one shared `ResourceSection` switch, and transitional legacy `Resource`/converter/table remnants are removed.

## Precondition

```bash
cd /Users/study/pii-agent-demo
git fetch origin main
rg -n "CandidateResourceSection|ApprovedIntegrationSection|ConfirmedIntegrationSection" app/integration/target-sources/[targetSourceId]/_components
```

## Step 1: Worktree

```bash
bash scripts/create-worktree.sh --topic wave16-d4-resource-section-cleanup --prefix refactor
cd /Users/study/pii-agent-demo-wave16-d4-resource-section-cleanup
```

## Step 2: Required Reading

- `docs/reports/resource-model-separation-plan.md` sections 5-6, 7/D4, 9
- AWS/Azure/GCP ProjectPage files
- `lib/types.ts`
- `lib/types/resources/`
- `lib/resource-catalog.ts`
- `app/components/features/ResourceTable.tsx`
- `app/components/features/resource-table/`
- Any transitional wrappers left from D2/D3

## Scope

Create the shared switch and delete migration leftovers.

Expected new file:

| File | Purpose |
|---|---|
| `app/integration/target-sources/[targetSourceId]/_components/shared/ResourceSection.tsx` | Takes `{ step, targetSourceId }` and renders exactly one of candidate/approved/confirmed sections. |

Expected updates:

| File | Change |
|---|---|
| AWS/Azure/GCP ProjectPage files | Replace inline resource step branching with `<ResourceSection step={currentStep} targetSourceId={project.targetSourceId} />`. Keep provider-specific cards and installation-mode guards only. |
| `lib/types.ts` | Remove legacy `Resource` if no longer used. |
| `lib/resource-catalog.ts` | Remove transitional legacy converters: `catalogToResources`, `approvedIntegrationToResources`, `confirmedIntegrationToResources`. |
| `app/components/features/ResourceTable.tsx` and `app/components/features/resource-table/` | Delete if no longer used, or shrink to design-system-level primitives only if multiple new tables import them. |
| `app/components/features/scan/DbSelectionCard.tsx` | Delete if still present as transitional candidate UI. |
| `app/components/features/integration-target-info/` | Delete if still present as transitional confirmed UI. |
| `app/components/features/process-status/ResourceTransitionPanel.tsx` | Delete if still present as transitional approved UI. |

## ResourceSection Rules

Map process status exactly:

| ProcessStatus | Section |
|---|---|
| `WAITING_TARGET_CONFIRMATION` | `CandidateResourceSection` |
| `WAITING_APPROVAL` | `CandidateResourceSection` with `readonly` or approval-waiting mode |
| `APPLYING_APPROVED` | `ApprovedIntegrationSection` |
| `INSTALLING` | `ConfirmedIntegrationSection` |
| `WAITING_CONNECTION_TEST` | `ConfirmedIntegrationSection` |
| `CONNECTION_VERIFIED` | `ConfirmedIntegrationSection` |
| `INSTALLATION_COMPLETE` | `ConfirmedIntegrationSection` |

No default branch that silently renders candidate data for unknown states. Use `assertNever` or return `null` only when the type system proves the status is outside resource-rendering steps.

## Behavior Rules

- ProjectPage must not import any resource-domain type.
- ProjectPage must not import `isVmResource`, `configKind`, `behaviorKey`, or candidate behavior registry.
- ProjectPage must not call resource APIs directly.
- No legacy converter name should remain.
- No `let cancelled = false` resource-fetch pattern should remain.

## Acceptance Criteria

- AWS/Azure/GCP ProjectPage resource rendering is one shared component call.
- Legacy `Resource` type is removed or reduced to a non-resource-domain type only if there is a separately justified consumer. Prefer removal.
- Candidate/Approved/Confirmed arrays are never mixed.
- Resource-specific behavior remains behind candidate behavior registry.

## Verification

```bash
npx tsc --noEmit
npm run lint -- app/integration/target-sources/[targetSourceId]/_components app/components/features lib
npm run test:run
rg -n "\\bResource\\b" lib/types.ts app/integration/target-sources/[targetSourceId]/_components app/components/features | head -50
rg -n "catalogToResources|approvedIntegrationToResources|confirmedIntegrationToResources|useProjectResources|useProjectPageFormState" app lib
rg -n "isVmResource|configKind|behaviorKey" app/integration/target-sources/[targetSourceId]/_components/*/*ProjectPage.tsx
rg -n "let cancelled|cancelled = false" app lib
```

Expected:

- Legacy converter/hook `rg` returns no hits.
- ProjectPage `isVmResource|configKind|behaviorKey` `rg` returns no hits.
- Cancellation `rg` returns no resource-fetch hits. If non-resource effects remain, list them with rationale.
- `Resource` grep should show only approved new names such as `CandidateResource`, `ApprovedResource`, `ConfirmedResource`, or unrelated browser/API names.

Manual QA:

- AWS full flow: Step1 selection, approval request, applying approved, installing, connection test, complete.
- Azure full flow: VM endpoint setup, approval, installing status, connection test.
- GCP full flow: Step1 selection, approval, installing, connection test.

## Commit

```bash
git commit -m "refactor(resources): centralize resource section rendering (wave16-D4)"
```

## Return

Report PR URL, deleted legacy files/exports, ProjectPage LOC/useState before-after for AWS/Azure/GCP, verification results, and remaining deliberate resource-domain exceptions if any.
