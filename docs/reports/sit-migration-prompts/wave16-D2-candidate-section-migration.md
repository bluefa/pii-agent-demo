# Wave 16-D2 - Candidate Section Migration

## Context

This is the user-facing Step1 cleanup. Candidate DB select/fetch/selection/approval state moves from AWS/Azure/GCP ProjectPage components into `CandidateResourceSection`. This removes the complex ProjectPage-level `useEffect` branch for `WAITING_TARGET_CONFIRMATION`.

## Precondition

```bash
cd /Users/study/pii-agent-demo
git fetch origin main
test -d lib/types/resources
rg -n "catalogToCandidates|CandidateResourceBehavior" lib
```

## Step 1: Worktree

```bash
bash scripts/create-worktree.sh --topic wave16-d2-candidate-section-migration --prefix refactor
cd /Users/study/pii-agent-demo-wave16-d2-candidate-section-migration
```

## Step 2: Required Reading

- `docs/reports/resource-model-separation-plan.md` sections 5-2, 5-3, 5-5, 7/D2
- `app/integration/target-sources/[targetSourceId]/_components/aws/AwsProjectPage.tsx`
- `app/integration/target-sources/[targetSourceId]/_components/azure/AzureProjectPage.tsx`
- `app/integration/target-sources/[targetSourceId]/_components/gcp/GcpProjectPage.tsx`
- `app/components/features/scan/DbSelectionCard.tsx`
- `app/components/features/ResourceTable.tsx`
- `app/components/features/resource-table/ResourceRow.tsx`
- `app/components/features/process-status/ApprovalRequestModal.tsx`
- `app/lib/api/index.ts`

## Scope

Introduce candidate-level section and table components. Migrate only the candidate/Step1 path in this PR.

Expected new files:

| File | Purpose |
|---|---|
| `app/integration/target-sources/[targetSourceId]/_components/shared/async-state.ts` | `AsyncState<T>` and small loading/error helpers if needed. |
| `app/integration/target-sources/[targetSourceId]/_components/candidate/CandidateResourceSection.tsx` | Owns `getConfirmResources`, loading/error/retry, `selectedIds`, endpoint draft state, expanded row state, approval modal state. |
| `app/integration/target-sources/[targetSourceId]/_components/candidate/CandidateResourceTable.tsx` | Candidate presentation. No API calls. |
| `app/integration/target-sources/[targetSourceId]/_components/candidate/CandidateEndpointConfigPanel.tsx` | Generalized endpoint config UI. VM is the first consumer. |
| `app/integration/target-sources/[targetSourceId]/_components/candidate/candidate-resource-behavior.ts` | `CANDIDATE_RESOURCE_BEHAVIORS` implementation for default/credential/endpoint. |
| `app/integration/target-sources/[targetSourceId]/_components/candidate/errors.ts` | Candidate error-message mapper. |

Expected updates:

| File | Change |
|---|---|
| `app/lib/api/index.ts` | Add `{ signal?: AbortSignal }` options to candidate fetch API if missing. |
| AWS/Azure/GCP ProjectPage files | Remove candidate fetch/selection/approval state. Render `CandidateResourceSection` for `WAITING_TARGET_CONFIRMATION` and read-only candidate section for `WAITING_APPROVAL` if the current UX needs it. |
| Existing candidate UI files | Either stop importing them from ProjectPage or keep as transitional helpers used by `CandidateResourceTable`. |

## API Call Shape After This PR

`CandidateResourceSection` is the only owner of Step1 candidate fetch:

```tsx
useEffect(() => {
  const controller = new AbortController();
  setState({ status: 'loading' });

  void getConfirmResources(targetSourceId, { signal: controller.signal })
    .then(response => setState({ status: 'ready', data: catalogToCandidates(response.resources) }))
    .catch(error => {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setState({ status: 'error', message: getCandidateErrorMessage(error) });
    });

  return () => controller.abort();
}, [targetSourceId, retryNonce]);
```

No ProjectPage should call `getConfirmResources`, `catalogToResources`, or `catalogToCandidates` after this PR.

## Behavior Rules

- ProjectPage must not import `isVmResource`, `configKind`, `behaviorKey`, or behavior registry.
- Candidate validation and approval `resource_inputs` generation must go through `CANDIDATE_RESOURCE_BEHAVIORS`.
- Candidate table may choose input UI by `configKind`, but must not compare `resource.type === 'EC2'` or `resource.type === 'AZURE_VM'`.
- Use `AbortController`; do not use `let cancelled = false`.
- Use `useApiMutation()` for approval mutation if the existing flow is being moved.

## Out Of Scope

- Approved/confirmed section migration
- Deleting `IntegrationTargetInfoCard`
- Deleting `ResourceTransitionPanel`
- Deleting legacy `Resource` type
- Shared `ResourceSection` switch. That is D4.

## Acceptance Criteria

- The complex Step1 resource `useEffect` is gone from AWS/Azure/GCP ProjectPage.
- Step1 DB select is component-level CSR in `CandidateResourceSection`.
- Page-level state no longer stores candidate `selectedIds` or endpoint draft state.
- ProjectPage contains no VM-specific candidate validation.
- Candidate resource fetch is one API call on section mount and one call per retry.

## Verification

```bash
npx tsc --noEmit
npm run lint -- app/integration/target-sources/[targetSourceId]/_components app/lib/api/index.ts
rg -n "getConfirmResources|catalogToResources|catalogToCandidates|isVmResource" app/integration/target-sources/[targetSourceId]/_components/*/*ProjectPage.tsx
rg -n "let cancelled|cancelled = false" app/integration/target-sources/[targetSourceId]/_components app/components/features
rg -n "resource\\.type === 'EC2'|resource\\.type === 'AZURE_VM'" app/integration/target-sources/[targetSourceId]/_components/candidate
```

All three `rg` commands should return no hits.

Manual QA:

- AWS Step1 scan result loads and retry works.
- Azure Step1 VM endpoint config validation works.
- GCP Step1 endpoint config validation works if VM-like resources exist.
- Approval request payload still matches existing API shape.

## Commit

```bash
git commit -m "refactor(resources): move candidate selection into section (wave16-D2)"
```

## Return

Report PR URL, before/after ProjectPage candidate state, exact Step1 API call path, behavior registry decisions, and manual QA notes.
