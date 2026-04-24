# Wave 16-D3 - Approved And Confirmed Section Migration

## Context

D2 moved Step1 candidate work to component level. This PR moves approved snapshot and confirmed integration rendering/fetching to component-level sections, removing duplicate confirmed fetch paths.

## Precondition

```bash
cd /Users/study/pii-agent-demo
git fetch origin main
rg -n "CandidateResourceSection" app/integration/target-sources/[targetSourceId]/_components
```

## Step 1: Worktree

```bash
bash scripts/create-worktree.sh --topic wave16-d3-approved-confirmed-section-migration --prefix refactor
cd /Users/study/pii-agent-demo-wave16-d3-approved-confirmed-section-migration
```

## Step 2: Required Reading

- `docs/reports/resource-model-separation-plan.md` sections 5-3, 5-4, 5-5, 7/D3
- `app/components/features/process-status/ResourceTransitionPanel.tsx`
- `app/components/features/integration-target-info/IntegrationTargetInfoCard.tsx`
- `app/components/features/process-status/ConnectionTestPanel.tsx`
- AWS/Azure/GCP ProjectPage files
- Provider installation inline components that currently receive legacy `Resource[]`
- `lib/resource-catalog.ts`

## Scope

Create approved and confirmed sections and table components. Remove duplicate confirmed fetch from ProjectPage.

Expected new files:

| File | Purpose |
|---|---|
| `app/integration/target-sources/[targetSourceId]/_components/approved/ApprovedIntegrationSection.tsx` | Owns `getApprovedIntegration`, loading/error/retry, transform to `ApprovedResource[]`. |
| `app/integration/target-sources/[targetSourceId]/_components/approved/ApprovedIntegrationTable.tsx` | Presentation from `ResourceTransitionPanel`. |
| `app/integration/target-sources/[targetSourceId]/_components/approved/errors.ts` | Approved error mapper. |
| `app/integration/target-sources/[targetSourceId]/_components/confirmed/ConfirmedIntegrationSection.tsx` | Owns `getConfirmedIntegration`, loading/error/retry, transform to `ConfirmedResource[]`. |
| `app/integration/target-sources/[targetSourceId]/_components/confirmed/ConfirmedIntegrationTable.tsx` | Presentation from `IntegrationTargetInfoCard`. |
| `app/integration/target-sources/[targetSourceId]/_components/confirmed/errors.ts` | Confirmed error mapper. |

Expected updates:

| File | Change |
|---|---|
| `app/lib/api/index.ts` | Add `{ signal?: AbortSignal }` options to approved/confirmed fetch APIs if missing. |
| AWS/Azure/GCP ProjectPage files | Render approved/confirmed sections for the appropriate process statuses. Remove ProjectPage confirmed resource fetch/state. |
| `ConnectionTestPanel` | If it needs confirmed resources, pass `ConfirmedResource[]` or a narrow connection-test resource type, not legacy `Resource[]`. |
| Provider installation inline components | If they need confirmed resources, accept a narrow confirmed resource contract rather than legacy `Resource[]`. |

## API Call Shape After This PR

`ApprovedIntegrationSection` calls:

```ts
getApprovedIntegration(targetSourceId, { signal })
```

`ConfirmedIntegrationSection` calls:

```ts
getConfirmedIntegration(targetSourceId, { signal })
```

ProjectPage should not call either API directly. The existing duplicate confirmed fetch path should be gone.

## Behavior Rules

- Approved and confirmed resources must not include `isSelected`.
- Confirmed data must not be created by setting all selected ids.
- Use `AbortController`; do not use `let cancelled = false`.
- Keep provider-specific installation status cards provider-specific. Do not generalize them in this PR.
- If a component truly needs "connection-test resource" fields, define the narrow type explicitly instead of widening confirmed data back to legacy `Resource`.

## Out Of Scope

- Shared `ResourceSection` switch. That is D4.
- Removing all legacy `Resource` exports. That is D4.
- Reworking provider installation status UX.

## Acceptance Criteria

- Approved snapshot has exactly one fetch owner: `ApprovedIntegrationSection`.
- Confirmed integration has exactly one fetch owner: `ConfirmedIntegrationSection`.
- ProjectPage no longer has confirmed resource loading/error state.
- `IntegrationTargetInfoCard` and `ResourceTransitionPanel` are either deleted or left only as transitional wrappers with no direct fetch. Prefer deletion.

## Verification

```bash
npx tsc --noEmit
npm run lint -- app/integration/target-sources/[targetSourceId]/_components app/components/features/process-status app/components/features/integration-target-info
rg -n "getApprovedIntegration|getConfirmedIntegration|confirmedIntegrationToResources|approvedIntegrationToResources" app/integration/target-sources/[targetSourceId]/_components/*/*ProjectPage.tsx
rg -n "isSelected: true|setSelectedIds\\(|let cancelled|cancelled = false" app/integration/target-sources/[targetSourceId]/_components app/components/features
```

Both `rg` commands should return no hits in ProjectPage/resource-fetch paths.

Manual QA:

- Applying-approved step shows approved snapshot transition.
- Installing/connection-test/verified/complete steps show confirmed integration list.
- Connection test still starts and credential setup still works.
- No duplicate network call for confirmed integration when entering installing step.

## Commit

```bash
git commit -m "refactor(resources): move approved confirmed data into sections (wave16-D3)"
```

## Return

Report PR URL, confirmed duplicate-fetch removal evidence, API call ownership, legacy components deleted/kept, and manual QA notes.
