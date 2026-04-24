# Wave 16-03 - Approved/Confirmed Sections And Legacy Cleanup

## Intent

Finish resource-model separation by moving approved snapshot and confirmed integration data into component-owned sections, adding a shared `ResourceSection` switch, and deleting legacy `Resource` remnants.

Source: `docs/reports/resource-model-separation-plan.md` sections 5-3 through 5-6 and 7/D3-D4.

## Required Outcome

ProjectPage resource rendering becomes:

```tsx
<ResourceSection step={currentStep} targetSourceId={project.targetSourceId} />
```

Only the section that is currently mounted performs its API call.

## Scope

| Area | Required action |
|---|---|
| Approved section | Add `ApprovedIntegrationSection`, `ApprovedIntegrationTable`, and error helper. It owns `getApprovedIntegration`, loading/error/retry, `AbortController`, and `approvedIntegrationToApproved`. |
| Confirmed section | Add `ConfirmedIntegrationSection`, `ConfirmedIntegrationTable`, and error helper. It owns `getConfirmedIntegration`, loading/error/retry, `AbortController`, and `confirmedIntegrationToConfirmed`. |
| Shared switch | Add `_components/shared/ResourceSection.tsx` and map process statuses to exactly one section. |
| ProjectPages | Replace inline resource branching in AWS/Azure/GCP pages with shared `ResourceSection`. Keep provider-specific installation-mode/status cards only. |
| Consumers | Update `ConnectionTestPanel`, credential setup, and provider installation inline components to use `ConfirmedResource` or a narrower connection-test resource type instead of legacy `Resource`. |
| Legacy removal | Delete legacy `Resource` type, old converters, `ResourceTable`, `resource-table/*`, `DbSelectionCard`, `IntegrationTargetInfoCard`, and `ResourceTransitionPanel` when replaced. |

## API Call Ownership

| ProcessStatus | Section | API |
|---|---|---|
| `WAITING_TARGET_CONFIRMATION` | `CandidateResourceSection` | `getConfirmResources` |
| `WAITING_APPROVAL` | `CandidateResourceSection` readonly/approval-waiting mode | `getConfirmResources` if data must be restored |
| `APPLYING_APPROVED` | `ApprovedIntegrationSection` | `getApprovedIntegration` |
| `INSTALLING` | `ConfirmedIntegrationSection` | `getConfirmedIntegration` |
| `WAITING_CONNECTION_TEST` | `ConfirmedIntegrationSection` | `getConfirmedIntegration` |
| `CONNECTION_VERIFIED` | `ConfirmedIntegrationSection` | `getConfirmedIntegration` |
| `INSTALLATION_COMPLETE` | `ConfirmedIntegrationSection` | `getConfirmedIntegration` |

No ProjectPage should directly call any resource API after this PR.

## Guardrails

- Approved and confirmed resources must not contain `isSelected`.
- Do not preserve `setSelectedIds(all)` or any confirmed-as-selected behavior.
- Do not create a shared resource mega type to satisfy old component props.
- If connection testing needs a different shape, define a narrow explicit type.
- ProjectPage must not import resource-domain types, behavior registry, `isVmResource`, `configKind`, or `behaviorKey`.
- Use `AbortController`; remove `let cancelled = false` resource-fetch patterns.

## Acceptance Criteria

- Candidate, Approved, and Confirmed arrays are never mixed.
- Approved data has exactly one fetch owner: `ApprovedIntegrationSection`.
- Confirmed data has exactly one fetch owner: `ConfirmedIntegrationSection`.
- Confirmed integration is no longer fetched through both ProjectPage and `IntegrationTargetInfoCard`.
- Legacy converter names are gone: `catalogToResources`, `approvedIntegrationToResources`, `confirmedIntegrationToResources`.
- `useProjectResources` and `useProjectPageFormState` are gone if still present from earlier PRs.
- `npx tsc --noEmit`, `npm run lint`, `npm run test:run`, and `npm run build` pass.

## Verification

```bash
rg -n "getConfirmResources|getApprovedIntegration|getConfirmedIntegration" app/integration/target-sources/[targetSourceId]/_components/*/*ProjectPage.tsx
rg -n "catalogToResources|approvedIntegrationToResources|confirmedIntegrationToResources|useProjectResources|useProjectPageFormState" app lib
rg -n "isVmResource|configKind|behaviorKey" app/integration/target-sources/[targetSourceId]/_components/*/*ProjectPage.tsx
rg -n "isSelected: true|setSelectedIds\\(|let cancelled|cancelled = false" app lib
rg -n "interface Resource|type Resource" lib/types.ts lib/types app/components/features app/integration/target-sources/[targetSourceId]/_components
npx tsc --noEmit
npm run lint
npm run test:run
npm run build
```

Expected:

- ProjectPage API-call grep returns no hits.
- Legacy converter/hook grep returns no hits.
- ProjectPage VM/behavior grep returns no hits.
- `isSelected: true` and confirmed `setSelectedIds` patterns return no hits.
- `Resource` grep contains only approved names such as `CandidateResource`, `ApprovedResource`, `ConfirmedResource`, browser/API terms, or unrelated display text.

Manual QA:

- AWS full flow: Step1, approval request, applying approved, installing, connection test, complete.
- Azure full flow: VM endpoint setup, approval, installing status, connection test.
- GCP full flow: Step1, approval, installing, connection test.
- Network tab confirms only the visible resource section fetches its API.

## Return

Report PR URL, deleted legacy files/exports, ProjectPage simplification summary, API call ownership evidence, validation results, and any remaining resource-domain exceptions with rationale.
