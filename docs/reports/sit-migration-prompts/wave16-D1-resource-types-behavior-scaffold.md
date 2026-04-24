# Wave 16-D1 - Resource Types And Behavior Scaffold

## Context

PR358 requires separating Candidate, Approved, and Confirmed resources. This D1 is intentionally additive so `/wave-task` can produce a build-green PR. Do not delete the legacy `Resource` type or old converter names in this PR.

## Precondition

```bash
cd /Users/study/pii-agent-demo
git fetch origin main
rg -n "IDC|SDU|idc|sdu" app lib && exit 1 || true
```

## Step 1: Worktree

```bash
bash scripts/create-worktree.sh --topic wave16-d1-resource-types-behavior-scaffold --prefix refactor
cd /Users/study/pii-agent-demo-wave16-d1-resource-types-behavior-scaffold
```

## Step 2: Required Reading

- `docs/reports/resource-model-separation-plan.md` sections 1-5 and 7/D1
- `lib/types.ts`
- `lib/resource-catalog.ts`
- `lib/resource-catalog-response.ts`
- `lib/confirmed-integration-response.ts`
- `app/components/features/resource-table/ResourceRow.tsx`
- AWS/Azure/GCP ProjectPage files under `app/integration/target-sources/[targetSourceId]/_components/`

## Scope

Add new resource-domain types and transform functions while preserving legacy exports for current consumers.

Expected new files:

| File | Purpose |
|---|---|
| `lib/types/resources/candidate.ts` | `CandidateResource`, `CandidateConfigKind`, `CandidateBehaviorKey`, endpoint draft-related fields. No `isSelected`. |
| `lib/types/resources/approved.ts` | `ApprovedResource`, approval snapshot-only fields. No selection fields. |
| `lib/types/resources/confirmed.ts` | `ConfirmedResource`, confirmed integration-only fields. No selection fields. |
| `lib/types/resources/candidate-behavior.ts` | `CandidateDraftState`, `CandidateResourceBehavior` interface, behavior keys. |
| `lib/types/resources/index.ts` | Re-export resource-domain types. |

Expected updates:

| File | Change |
|---|---|
| `lib/resource-catalog.ts` | Add `catalogToCandidates`, `approvedIntegrationToApproved`, `confirmedIntegrationToConfirmed`. Keep legacy `catalogToResources`, `approvedIntegrationToResources`, `confirmedIntegrationToResources` as temporary adapters until D4. |
| `lib/__tests__/resource-catalog-response.test.ts` or new tests | Add assertions that approved/confirmed transforms do not expose `isSelected`, and candidate transform assigns `configKind`/`behaviorKey`. |

## Behavior Rules

- `CandidateResource` owns `configKind` and `behaviorKey` normalization.
- VM resources map to endpoint behavior, but ProjectPage must not learn this in D1.
- `ApprovedResource` and `ConfirmedResource` must not include `isSelected`.
- Do not create a `ResourceUnion` alias. If a temporary adapter is necessary for legacy UI, keep it in `lib/resource-catalog.ts` and mark it as transitional.

## Out Of Scope

- ProjectPage migration
- Section components
- Table split
- Deleting `Resource` from `lib/types.ts`
- Deleting `isVmResource`

## Acceptance Criteria

- New types compile and can be imported independently.
- New transform functions return new types.
- Existing UI still compiles through transitional legacy exports.
- No ProjectPage imports new resource-domain types yet.

## Verification

```bash
npx tsc --noEmit
npm run lint -- lib/types/resources lib/resource-catalog.ts
npm run test:run -- resource-catalog
rg -n "export type .*ResourceUnion|type .* = CandidateResource \\| ApprovedResource \\| ConfirmedResource" lib
```

The final `rg` command must return no hits.

## Commit

```bash
git commit -m "refactor(resources): add separated resource type scaffold (wave16-D1)"
```

## Return

Report PR URL, new type files, transformer compatibility strategy, tests, and which legacy exports remain for D2-D4.
