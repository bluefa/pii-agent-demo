# Wave 16-D0d - IDC/SDU Type And Process Cleanup

## Context

D0a-D0c removed entry, UI, runtime APIs, and mock seeds. This PR shrinks core provider types and process logic to AWS/Azure/GCP only.

## Precondition

```bash
cd /Users/study/pii-agent-demo
git fetch origin main
test ! -d app/integration/api/v1/idc
test ! -d app/integration/api/v1/sdu
test ! -d app/components/features/idc
test ! -d app/components/features/sdu
```

## Step 1: Worktree

```bash
bash scripts/create-worktree.sh --topic wave16-d0d-idc-sdu-type-process-cleanup --prefix refactor
cd /Users/study/pii-agent-demo-wave16-d0d-idc-sdu-type-process-cleanup
```

## Step 2: Required Reading

- `lib/types.ts`
- `lib/types/idc.ts`
- `lib/types/sdu.ts`
- `lib/process/calculator.ts`
- `lib/process/index.ts`
- `lib/process/sdu-guide-bridge.ts`
- `lib/constants/idc.ts`
- `lib/constants/sdu.ts`
- `lib/constants/process-guides.ts`
- `lib/constants/labels.ts`
- `lib/theme.ts`
- `app/components/ui/CloudProviderIcon.tsx`
- `lib/resource-catalog-response.ts`
- `lib/confirmed-integration-response.ts`
- `lib/target-source-response.ts`

## Scope

Remove IDC/SDU from active type/process surfaces.

Expected deletes:

| Path | Notes |
|---|---|
| `lib/types/idc.ts` | No runtime/UI consumer remains. |
| `lib/types/sdu.ts` | No runtime/UI consumer remains. |
| `lib/constants/idc.ts` | No runtime/UI consumer remains. |
| `lib/constants/sdu.ts` | No runtime/UI consumer remains. |
| `lib/process/sdu-guide-bridge.ts` | SDU-only mapper. |

Expected updates:

| File | Change |
|---|---|
| `lib/types.ts` | Shrink `CloudProvider` and target-source unions to `'AWS' | 'Azure' | 'GCP'`. Remove IDC/SDU target-source variants. |
| `lib/process/calculator.ts` | Remove IDC no-approval branch and SDU calculator. Keep AWS/Azure/GCP approval flow. |
| `lib/process/index.ts` | Remove IDC/SDU process exports. |
| `lib/constants/process-guides.ts` | Remove IDC/SDU guides and registry entries. |
| `lib/constants/labels.ts` | Remove IDC/SDU labels/descriptions. |
| `lib/theme.ts` | Remove IDC/SDU provider colors. |
| `app/components/ui/CloudProviderIcon.tsx` | Remove IDC/SDU icons and mapping. |
| `lib/resource-catalog-response.ts` | Remove IDC fallback/defaults if they are active logic. |
| `lib/confirmed-integration-response.ts` | Remove IDC fallback/defaults if they are active logic. |
| `lib/target-source-response.ts` | Remove IDC/SDU response branches. |

## Out Of Scope

- Historical ADR edits unless they fail type/lint checks.
- Active docs and swagger cleanup. That is D0e.
- Resource-model Candidate/Approved/Confirmed work. That starts in D1.

## Acceptance Criteria

- Active TypeScript code treats cloud provider as AWS/Azure/GCP only.
- There is no `getCurrentStepWithoutApproval` or SDU-specific process export.
- No UI provider icon/theme entry remains for IDC/SDU.
- Existing AWS/Azure/GCP flows still type-check.

## Verification

```bash
npx tsc --noEmit
npm run lint -- lib app/components/ui
npm run test:run
rg -n "'IDC'|'SDU'|\\bIdc\\b|\\bSdu\\b|\\bidc\\b|\\bsdu\\b" app lib
```

The final `rg` command should return no active code hits. If a hit remains because it is a historical comment or fixture name, either remove it or document why it is safe.

## Commit

```bash
git commit -m "refactor(provider): shrink active providers to AWS Azure GCP (wave16-D0d)"
```

## Return

Report PR URL, removed type/process files, `tsc`, lint, test result, and remaining IDC/SDU grep hits with rationale.
