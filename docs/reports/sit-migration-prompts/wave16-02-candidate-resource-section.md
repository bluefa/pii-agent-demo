# Wave 16-02 - Candidate Resource Section

## Intent

Add separated resource types and move Step1 candidate DB select/API/approval behavior out of AWS/Azure/GCP ProjectPage components into `CandidateResourceSection`.

This is the main cleanup for the complex ProjectPage effect that currently branches on process status, calls candidate/confirmed APIs, sets `resources`, and mutates `selectedIds`.

Source: `docs/reports/resource-model-separation-plan.md` sections 1-5 and 7/D1-D2.

## Required Outcome

Step1 is component-level CSR:

- `CandidateResourceSection` owns `getConfirmResources`, loading, error, retry, cancellation, selected ids, endpoint draft state, expanded row state, and approval modal state.
- ProjectPage only decides that the candidate section is visible for `WAITING_TARGET_CONFIRMATION` and `WAITING_APPROVAL`.
- ProjectPage does not know whether a resource is VM-like and does not build endpoint/credential-specific approval payloads.

## Scope

Add the new model and migrate the candidate path in one PR.

| Area | Required action |
|---|---|
| Types | Add `lib/types/resources/{candidate,approved,confirmed,candidate-behavior,index}.ts`. |
| Transformers | Add `catalogToCandidates`, `approvedIntegrationToApproved`, `confirmedIntegrationToConfirmed`. Legacy approved/confirmed adapters may remain until Wave 16-03. |
| Candidate behavior | Add `CANDIDATE_RESOURCE_BEHAVIORS` with `default`, `credential`, and `endpoint`. VM maps to endpoint behavior, but only the behavior layer should know type strings such as `EC2` or `AZURE_VM`. |
| Candidate section | Add `CandidateResourceSection`, `CandidateResourceTable`, `CandidateEndpointConfigPanel`, and candidate error helpers under the target-source `_components` tree. |
| API options | Add `{ signal?: AbortSignal }` to `getConfirmResources` if missing. |
| ProjectPages | Remove candidate fetch/selection/approval state from AWS/Azure/GCP pages. Render `CandidateResourceSection` for Step1 and readonly mode for approval-waiting if needed. |

## API Call Shape

`CandidateResourceSection` is the only Step1 candidate fetch owner:

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

CSR behavior difference from the old page-level effect:

- The resource table shows its own localized loading/error state after the section mounts.
- Switching away from Step1 unmounts the section and aborts the request.
- Parent ProjectPage no longer carries stale candidate selection state into installing/confirmed steps.

## Guardrails

- Do not create a union/mega type that recombines Candidate, Approved, and Confirmed.
- `CandidateResource` must not contain `isSelected`; selection is section state.
- `ApprovedResource` and `ConfirmedResource` must not contain `isSelected`.
- ProjectPage must not import `isVmResource`, `configKind`, `behaviorKey`, `CandidateResource`, or candidate behavior registry.
- Candidate table may render by `configKind`, but must not compare raw resource type strings.
- Use `useApiMutation()` for approval mutation if moving approval submission code.
- Use `AbortController`; do not use `let cancelled = false`.

## Out Of Scope

- Migrating approved/confirmed display and fetch owners. That is Wave 16-03.
- Deleting legacy `Resource`, `ResourceTable`, `IntegrationTargetInfoCard`, or `ResourceTransitionPanel` unless they become fully unused in this PR.

## Acceptance Criteria

- AWS/Azure/GCP ProjectPage no longer calls `getConfirmResources`, `catalogToResources`, or `catalogToCandidates`.
- AWS/Azure/GCP ProjectPage no longer stores candidate `selectedIds`, endpoint draft state, expanded resource id, or approval modal state.
- Step1 approval payload is built through candidate behavior registry.
- VM-specific branching is not present in ProjectPage.
- `npx tsc --noEmit`, `npm run lint`, and relevant tests pass.

## Verification

```bash
rg -n "getConfirmResources|catalogToResources|catalogToCandidates|isVmResource|configKind|behaviorKey" app/integration/target-sources/[targetSourceId]/_components/*/*ProjectPage.tsx
rg -n "resource\\.type === 'EC2'|resource\\.type === 'AZURE_VM'" app/integration/target-sources/[targetSourceId]/_components/candidate
rg -n "let cancelled|cancelled = false" app/integration/target-sources/[targetSourceId]/_components app/components/features
npx tsc --noEmit
npm run lint
npm run test:run
```

Expected:

- ProjectPage grep returns no hits.
- Candidate raw type-string grep returns no hits outside behavior implementation.
- Cancellation grep returns no candidate resource-fetch hits.

Manual QA:

- AWS Step1 candidate list loads, selection works, approval request works.
- Azure VM endpoint setup validation works.
- GCP Step1 selection and approval still work.
- Approval waiting renders candidate data read-only if current UX requires it.

## Return

Report PR URL, exact Step1 API call owner, ProjectPage state removed, behavior registry decisions, validation results, and any legacy adapters intentionally left for Wave 16-03.
