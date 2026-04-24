# Wave 17-B — External `TargetSource` Contract Slim

## Context
Project: pii-agent-demo (Next.js 14, TS, Tailwind, Korean UI).

Structural cleanup of `lib/target-source-response.ts` and the external `TargetSource` type.
Removes **two fabricated fields** — `status` and `terraformState` — that have no live UI
consumption post-wave16, **deletes the TerraformStatusModal** and its dead fallback
branch in `ProcessStatusCard`, and **drops unreachable defensive code paths** in the
normalizer. Background and root-cause analysis in [`README.md`](./README.md).

Builds on:
- [wave17-A](./wave17-A-guard-fix.md) (same-file overlap in `lib/target-source-response.ts`).
- wave16 (PR #362, merged `6d81fd7`) — narrowed `CloudProvider` to `'AWS' | 'Azure' | 'GCP'`,
  which makes the IDC/SDU fallback in `ProcessStatusCard` statically unreachable — this is
  what unblocks `terraformState` removal from scope.

## What changes

### Contract

Before:
```ts
export interface BaseTargetSource {
  ...
  status: ProjectStatus;           // ← fabricated, no UI consumer
  terraformState: TerraformState;  // ← fabricated to PENDING default, live caller dead
                                   //   after wave16
  ...
}
```

After:
```ts
export interface BaseTargetSource {
  ...
  // status removed
  // terraformState removed
  ...
}

// Both fields move to Project (mock-internal) so mock state transitions still work:
export type Project = BaseTargetSource & {
  ...
  status: ProjectStatus;
  terraformState: TerraformState;
  resources: Resource[];
  ...
};
```

### Dead code removal in `extractTargetSource`

1. `{ target_source }` snake envelope handling — unreachable after `camelCaseKeys` in
   `lib/api-client/bff-client.ts:59` and mock's camelCase emission.
2. `{ project }` legacy envelope handling — mock uses `{ project }` only in mock-internal
   `/projects/*` routes which never flow through `extractTargetSource`.
3. Snake_case dual-key fallbacks in every `readValue(value, 'foo', 'foo_bar')` — snake keys
   never arrive for the same reason as #1.
4. `buildDerivedStatus` function + `isProjectStatus` helper — `status` no longer in output.
5. `buildTerraformState` function + `isTerraformState` helper — `terraformState` no longer
   in output.
6. `isTargetSource` early-return — wave17-A's subagent flagged this as effectively dead
   code (no production payload satisfies every sub-check simultaneously after both
   fabricated fields leave the output). Remove the guard and the early return; always run
   normalization. `normalizeCloudProvider` is idempotent on already-normalized values
   (`'Azure' → 'Azure'`).
7. `status` + `terraformState` field emission in mock `toIssue222TargetSourceInfo`.

### TerraformStatusModal deletion

`app/components/features/TerraformStatusModal.tsx` (172 LOC) — delete. Its sole caller is
the IDC/SDU fallback button in `ProcessStatusCard.tsx:225-238`, which is statically
unreachable after wave16 (`CloudProvider = 'AWS' | 'Azure' | 'GCP'`).

### ProcessStatusCard dead-branch cleanup

In `app/components/features/ProcessStatusCard.tsx` (current `origin/main`):
- `getProgress` helper (L47-54) — terraform progress counter, no longer meaningful.
- `terraformModal = useModal()` (L70) — no longer needed.
- `progress = getProgress(project)` (L72) — remove.
- IDC/SDU fallback `<button onClick={() => terraformModal.open()}>` branch in the
  `INSTALLING` step (L225-237) — unreachable ternary tail, AWS/Azure/GCP cover all cases.
- Modal render block (L271-277) — remove with modal.
- `TerraformStatus` import — remove if no longer used.
- `TerraformStatusModal` dynamic import (L24) — remove.

### Calculator simplification

`getProjectCurrentStep(project)` in `lib/process/calculator.ts` currently returns
`getCurrentStep(project.status)` — a round trip that recomputes `processStatus` from the
fabricated `status`. All UI callers have `project.processStatus` already populated by the
normalizer. Delete `getProjectCurrentStep`, have callers read `project.processStatus`
directly. Keep `getCurrentStep(status: ProjectStatus): ProcessStatus` for mock internal use
(`lib/mock-test-connection.ts:210`).

## Precondition
```
cd /Users/study/pii-agent-demo
git fetch origin main

# wave17-A must be merged into origin/main first
git log origin/main --oneline | grep -qiE "wave17-a|tighten isTargetSource" \
  || { echo "✗ wave17-A not yet merged — rebase blocked"; exit 1; }

# wave16 must be merged (TerraformStatusModal unreachability depends on this)
git log origin/main --oneline | grep -qiE "wave16|remove IDC/SDU" \
  || { echo "✗ wave16 not yet merged — terraformState removal premature"; exit 1; }

[ -f lib/target-source-response.ts ] || { echo "✗ source file missing"; exit 1; }
[ -f app/components/features/TerraformStatusModal.tsx ] || { echo "ℹ modal already removed"; }
[ -f lib/process/calculator.ts ] || { echo "✗ calculator missing"; exit 1; }
```

## Step 1: Worktree
```
bash scripts/create-worktree.sh --topic wave17-b-target-source-slim --prefix refactor
cd /Users/study/pii-agent-demo-wave17-b-target-source-slim
```

## Step 2: Required reading

1. [`docs/reports/target-source-cleanup/README.md`](./README.md) — end-to-end background.
2. `lib/types.ts` — current `BaseTargetSource` / `CloudTargetSource` / `Project` definitions
   on `origin/main` post-wave16 (`CloudProvider = 'AWS' | 'Azure' | 'GCP'`).
3. `lib/target-source-response.ts` (whole file, ~260 LOC post-wave17-A) — normalizer being
   slimmed.
4. `lib/api-client/mock/target-sources.ts` (esp. `toIssue222TargetSourceInfo` and mock
   `create` that constructs `Project`) — mock emission.
5. `lib/process/calculator.ts` — helpers being simplified.
6. `docs/swagger/user.yaml` — BFF `TargetSourceDetail` schema (no `status`, no
   `terraformState`) — the contract anchor.
7. `docs/swagger/issue-222-client.yaml:823-880` — post-normalizer client-side response
   schema. Update: drop `status` AND `terraformState` from
   `ClientTargetSourceDetail` required + properties.
8. `app/components/features/ProcessStatusCard.tsx` — terraform-modal wiring being removed.
9. `app/components/features/TerraformStatusModal.tsx` — component being deleted.
10. UI consumers of `getProjectCurrentStep`:
    - `app/integration/api/v1/target-sources/[targetSourceId]/process-status/route.ts`
    - `app/integration/target-sources/[targetSourceId]/_components/{aws,azure,gcp}/*.tsx`
    - `app/components/features/ProcessStatusCard.tsx`
11. `lib/api-client/mock/confirm.ts`, `lib/api-client/mock/projects.ts`,
    `lib/mock-test-connection.ts`, `lib/mock-data.ts` — extensive reads of `project.status.*`
    and writes to `project.terraformState`. All operate on internal `Project`, which keeps
    both fields. **Do not touch.**

## Step 3: Implementation

### 3-1. Move `status` and `terraformState` from `BaseTargetSource` to `Project`

In `lib/types.ts`:

```diff
 export interface BaseTargetSource {
   id: string;
   targetSourceId: number;
   projectCode: string;
   serviceCode: string;
   processStatus: ProcessStatus;
-  status: ProjectStatus;
-  terraformState: TerraformState;
   createdAt: string;
   updatedAt: string;
   ...
 }
```

```diff
 export type Project = BaseTargetSource & {
   cloudProvider: CloudProvider;
+  status: ProjectStatus;
+  terraformState: TerraformState;
   resources: Resource[];
   awsInstallationMode?: AwsInstallationMode;
   ...
 };
```

Keep `TerraformState` and `TerraformStatus` interfaces/types in `lib/types.ts` — they are
still used by mock's `Project` and by the internal installation-status API transform
(`app/integration/api/v1/aws/target-sources/_lib/installation-transform.ts`).

### 3-2. Slim `lib/target-source-response.ts`

Starting from the post-wave17-A state:

#### Remove `isProjectStatus` helper
(The `isProjectStatus` block, ~8 LOC.) Delete.

#### Remove `isTerraformState` helper
(The `isTerraformState` block, ~4 LOC.) Delete.

#### Remove `isCloudProvider` / `isTargetSource` / early-return

wave17-A added `isCloudProvider` for the guard. Now the guard itself goes away:

```diff
-const isCloudProvider = ...
-const isTargetSource = (value: unknown): value is TargetSource => ( ... );
```

And in `normalizeTargetSource`:
```diff
 const normalizeTargetSource = (value): TargetSource => {
-  if (isTargetSource(value)) return value;
   if (!isRecord(value)) {
     throw new Error('target source payload must be an object');
   }
   ...
 };
```

`normalizeCloudProvider` handles already-normalized values idempotently, so re-running
normalization on a mock-emitted payload (with `cloudProvider: 'AZURE'`) is fine and
correct.

#### Remove `buildDerivedStatus` function
(L104-147, ~44 LOC.) Delete.

#### Remove `buildTerraformState` function
(L149-163, ~15 LOC.) Delete.

#### Remove `createInitialProjectStatus` import
(L1.) Delete (no longer used here).

#### Slim `unwrapTargetSourcePayload`

```ts
const unwrapTargetSourcePayload = (
  payload: TargetSourceDetailResponse,
): TargetSource | Record<string, unknown> => {
  if (isRecord(payload) && 'targetSource' in payload && isRecord(payload.targetSource)) {
    return payload.targetSource;
  }
  return payload as TargetSource | Record<string, unknown>;
};
```

Delete the `'target_source'` and `'project'` branches.

#### Shrink `TargetSourceDetailResponse` type union

```ts
export interface TargetSourceEnvelopeResponse {
  targetSource: TargetSource | Record<string, unknown>;
}

export type TargetSourceDetailResponse =
  | TargetSource
  | Record<string, unknown>
  | TargetSourceEnvelopeResponse;
```

Delete `TargetSourceSnakeEnvelopeResponse` and `LegacyProjectEnvelopeResponse` interfaces
and their union arms.

#### Kill snake_case dual-key fallbacks in normalizer

Every call like `readValue(value, 'targetSourceId', 'target_source_id')` becomes direct
property access. Example:

```ts
// Before:
const targetSourceId = parseTargetSourceId(
  readValue(value, 'targetSourceId', 'target_source_id'),
);
// After:
const targetSourceId = parseTargetSourceId(value.targetSourceId);
```

Apply to every call site: `createdAt`, `processStatus`, `cloudProvider`, `projectCode`,
`serviceCode`, `updatedAt`, `name`, `description`, `rejectionReason`, `tenantId`,
`subscriptionId`, `awsAccountId`, `awsRegionType`, `gcpProjectId`.

Remove `readValue`/`readString` helpers entirely if no multi-key call remains. Inline the
single-key shape guard (`typeof x === 'string' ? x : undefined`) if still needed — or add
a small `asString(v)` helper if inlined in more than ~3 places.

For the Azure/GCP `metadata` fallback (BFF swagger nests credential IDs under `metadata`,
mock emits them top-level), keep a single targeted read. Minimal. Example:

```ts
const metadata = isRecord(value.metadata) ? value.metadata : null;
const tenantId = asString(value.tenantId)
  ?? (metadata ? asString(metadata.tenantId) : undefined);
```

#### Drop `status` and `terraformState` from normalizer output

In `normalizeTargetSource`, the returned object no longer carries `status` or
`terraformState`. Adjust `base` / return object accordingly.

#### Expected file size

Post-wave17-A: ~260 LOC → **~70-90 LOC** after this spec.

### 3-3. Simplify `lib/process/calculator.ts`

Delete `getProjectCurrentStep`:

```diff
-export const getProjectCurrentStep = (project: {
-  status: ProjectStatus;
-}): ProcessStatus => {
-  return getCurrentStep(project.status);
-};
```

Keep `getCurrentStep(status)` and `createInitialProjectStatus()` — mock/test callers still
need them.

Update `lib/process/index.ts`:

```diff
 export {
   getCurrentStep,
-  getProjectCurrentStep,
   createInitialProjectStatus,
 } from './calculator';
```

### 3-4. Update UI call sites for `getProjectCurrentStep`

Four files. Pattern: remove `getProjectCurrentStep` import; replace its call with
`project.processStatus`.

**`app/integration/target-sources/[targetSourceId]/_components/aws/AwsProjectPage.tsx`**
```diff
-import { getProjectCurrentStep } from '@/lib/process';
...
-  const currentStep = getProjectCurrentStep(project);
+  const currentStep = project.processStatus;
```

Same edit in `azure/AzureProjectPage.tsx`, `gcp/GcpProjectPage.tsx`, and
`app/components/features/ProcessStatusCard.tsx`.

**`app/integration/api/v1/target-sources/[targetSourceId]/process-status/route.ts`**

Delete the defensive ternary — `processStatus` is always a valid enum after normalization:

```diff
-  const project = extractTargetSource(await projectResponse.json() as TargetSourceDetailResponse);
-  const currentStep =
-    typeof project.processStatus === 'number' && ProcessStatus[project.processStatus] !== undefined
-      ? project.processStatus
-      : getProjectCurrentStep(project);
+  const project = extractTargetSource(await projectResponse.json() as TargetSourceDetailResponse);
+  const currentStep = project.processStatus;
```

Remove unused imports (`getProjectCurrentStep`, possibly `ProcessStatus` if no longer
referenced).

### 3-5. Delete `app/components/features/TerraformStatusModal.tsx`

Whole file. Verify no other importer via grep:
```
grep -rn "TerraformStatusModal" app lib --include="*.ts" --include="*.tsx"
```

Only `ProcessStatusCard.tsx` should come up — and that import will be removed in §3-6.

### 3-6. Clean `ProcessStatusCard.tsx`

In `app/components/features/ProcessStatusCard.tsx`:

```diff
-const TerraformStatusModal = dynamic(() => import('./TerraformStatusModal').then(m => ({ default: m.TerraformStatusModal })));
```

```diff
-const getProgress = (project: CloudTargetSource) => {
-  const items: TerraformStatus[] = [project.terraformState.bdcTf];
-  if (project.cloudProvider === 'AWS' && project.terraformState.serviceTf) {
-    items.unshift(project.terraformState.serviceTf);
-  }
-  const completed = items.filter(s => s === 'COMPLETED').length;
-  return { completed, total: items.length };
-};
```

```diff
-  const terraformModal = useModal();
-  const progress = getProgress(project);
```

```diff
-  import { CloudTargetSource, ProcessStatus, TerraformStatus, Resource } from '@/lib/types';
+  import { CloudTargetSource, ProcessStatus, Resource } from '@/lib/types';
```

In the `INSTALLING` branch (currently L206-240), collapse the three-provider ternary to
its exhaustive form. Since `CloudProvider` is the narrow `'AWS' | 'Azure' | 'GCP'` union,
the ternary can be flattened — any of:

```tsx
{currentStep === ProcessStatus.INSTALLING && (
  project.cloudProvider === 'Azure' ? (
    <AzureInstallationInline ... />
  ) : project.cloudProvider === 'AWS' ? (
    <AwsInstallationInline ... />
  ) : (
    <GcpInstallationInline ... />
  )
)}
```

Or a switch via a small inline `renderInstallation()` helper if readability wins. Do not
add a fallback branch — TS narrowing + the `CloudProvider` union guarantee exhaustiveness.

Delete the modal render block:
```diff
-      {terraformModal.isOpen && project.cloudProvider !== 'Azure' && (
-        <TerraformStatusModal
-          terraformState={project.terraformState}
-          cloudProvider={project.cloudProvider}
-          onClose={() => terraformModal.close()}
-        />
-      )}
```

### 3-7. Update `lib/api-client/mock/target-sources.ts`

In `toIssue222TargetSourceInfo` (currently L111-145), remove the `status: project.status`
and `terraformState: project.terraformState` lines. Mock still stores both on internal
`Project`; external emission drops them.

No other mock changes — `mock/confirm.ts`, `mock/projects.ts`, `mock-test-connection.ts`
all work on internal `Project` (still has `status` + `terraformState`).

### 3-8. Update `docs/swagger/issue-222-client.yaml`

In `ClientTargetSourceDetail` (L823-880):
- Remove `status` and `terraformState` from `required` array.
- Remove `status` and `terraformState` from `properties`.

### 3-9. Update tests

#### `lib/__tests__/target-source-response.test.ts`

**Fixture (L7-21)**: remove `status: createInitialProjectStatus()` and
`terraformState: { bdcTf: 'PENDING' }` lines. Remove `createInitialProjectStatus` import if
no longer referenced. The fixture type is `CloudTargetSource`, which no longer has either
field.

**Delete `'unwraps snake_case envelope payload'` test** — envelope removed.

**Delete `'unwraps legacy project envelope payload'` test** — envelope removed.

**Delete `'returns flat payload as-is'` test** — with the early-return gone the normalizer
always clones. Identity (`.toBe`) no longer holds; a value-equality test here is redundant
with the camelCase test.

**Rewrite the Issue 222 test**:
- Change input keys from snake to camel (snake_case fallbacks removed).
- Remove `status` and `terraformState` from expected output.
- Example:
  ```ts
  it('normalizes Issue #222 camelCase target source detail to the TargetSource read model', () => {
    expect(extractTargetSource({
      description: 'Azure detail only payload',
      targetSourceId: 4242,
      processStatus: 'CONFIRMED',
      cloudProvider: 'AZURE',
      createdAt: '2026-03-29T00:00:00Z',
      metadata: {
        tenantId: 'tenant-1',
        subscriptionId: 'subscription-1',
      },
    })).toEqual({
      id: 'target-source-4242',
      targetSourceId: 4242,
      projectCode: '',
      serviceCode: '',
      cloudProvider: 'Azure',
      processStatus: ProcessStatus.INSTALLING,
      createdAt: '2026-03-29T00:00:00Z',
      updatedAt: '2026-03-29T00:00:00Z',
      name: 'TS-4242',
      description: 'Azure detail only payload',
      isRejected: false,
      tenantId: 'tenant-1',
      subscriptionId: 'subscription-1',
    });
  });
  ```

**Update the wave17-A camelCase AZURE test** — remove `status` and `terraformState` from
the input fixture; keep the `.cloudProvider → 'Azure'` assertion.

#### Other test files

Files referencing `createInitialProjectStatus` or `.terraformState` operate on the internal
`Project` type — these should compile unchanged because `Project` keeps both fields. Run
the full vitest suite to catch anything missed.

If a UI test imports `TerraformStatusModal`, update or delete that test.

## Step 4: Do NOT touch

- `lib/mock-data.ts`, `lib/api-client/mock/confirm.ts`, `lib/api-client/mock/projects.ts`,
  `lib/mock-test-connection.ts` — all operate on internal `Project` (which keeps `status`
  + `terraformState`). Do not thread `.processStatus` through mock's internal state
  machine.
- `TerraformState` / `TerraformStatus` types in `lib/types.ts` — still used by
  `installation-transform.ts` and mock internal.
- `CloudProvider` type, `Issue222CloudProvider` type, `CLOUD_PROVIDER_ALIASES` map —
  wave16 territory.
- Public API names (`extractTargetSource`, `TargetSourceDetailResponse`,
  `TargetSourceEnvelopeResponse`) — rename would cascade unnecessarily.
- `app/integration/api/v1/aws/target-sources/_lib/installation-transform.ts` — its
  `bdcTf.status` / `serviceTfScripts` live on a separate installation-status response
  type, not on `TargetSource`. Unchanged.

## Step 5: Verify

```
npx tsc --noEmit
npm run lint -- lib app docs/swagger/issue-222-client.yaml
npx vitest run
```

- `tsc` must exit 0. Most likely failures: stale `.status` / `.terraformState` references
  on `TargetSource` or stale `getProjectCurrentStep` / `TerraformStatusModal` imports — fix
  both.
- Lint: 0 new warnings.
- Full vitest run passes. Expected test updates only in
  `lib/__tests__/target-source-response.test.ts`.

**Dev-server smoke** (required — multi-file change):

```
bash scripts/dev.sh /integration/target-sources/1003
```

- Visit IDs for each provider: `1006` (AWS), `1003` (Azure), `1002` (GCP).
- Detail pages render without ErrorState (wave17-A fix still holds).
- `ProcessStatusCard` renders normally. The IDC/SDU fallback was dead code; its removal
  should not be visible.
- `INSTALLING` step for each provider still shows the provider-specific Installation
  Inline component.
- Create flow (admin → add target source) succeeds.

## Step 6: Commit + push + PR

```
git add lib app docs/swagger/issue-222-client.yaml
git commit -m "refactor(target-source): slim external TargetSource contract + delete TerraformStatusModal (wave17-B)

BFF spec (docs/swagger/user.yaml TargetSourceDetail) carries neither status
nor terraformState. The frontend fabricated both: status via buildDerivedStatus
(for a round-trip through getProjectCurrentStep that recomputes processStatus),
terraformState as a PENDING default. No UI component reads .status directly.
The only caller of TerraformStatusModal — the IDC/SDU fallback button in
ProcessStatusCard — became statically unreachable after wave16 narrowed
CloudProvider to 'AWS' | 'Azure' | 'GCP'.

Structural changes:
- lib/types.ts: move status + terraformState from BaseTargetSource to Project
  (mock-internal). TargetSource/CloudTargetSource drop both fields externally.
- lib/target-source-response.ts: delete buildDerivedStatus, buildTerraformState,
  isProjectStatus, isTerraformState, isCloudProvider (wave17-A), isTargetSource
  + early-return (always-dead after both fabricated fields leave the output),
  {target_source}/{project} envelope handling, snake_case readValue fallbacks.
  Roughly ~260 → ~80 LOC.
- lib/process/calculator.ts: remove getProjectCurrentStep. Keep getCurrentStep
  and createInitialProjectStatus for mock-internal state transitions.
- lib/api-client/mock/target-sources.ts: toIssue222TargetSourceInfo drops
  status + terraformState from emitted shape.
- app/components/features/TerraformStatusModal.tsx: deleted.
- app/components/features/ProcessStatusCard.tsx: drop terraformModal,
  getProgress, TerraformStatusModal import + render, IDC/SDU fallback branch
  in the INSTALLING ternary.
- 4 UI pages + ProcessStatusCard + process-status route: getProjectCurrentStep
  calls → project.processStatus (already authoritative post-normalization).
- docs/swagger/issue-222-client.yaml: drop status + terraformState from
  ClientTargetSourceDetail.

Depends on: wave17-A (PR #366) + wave16 (PR #362).

Follow-up (future waves, out of scope here):
- Mock toIssue222TargetSourceInfo further slim to match user.yaml shape
  exactly (drop name, isRejected, internal fields). Requires consumer audit."
git push -u origin refactor/wave17-b-target-source-slim
```

PR body (write to `/tmp/pr-wave17-b-body.md`):

```
## Summary

Removes two fabricated fields (`status`, `terraformState`) from the external
`TargetSource` contract — the BFF swagger spec includes neither, no UI
component consumed them in production after wave16, and the normalizer was
doing unnecessary round-trips. Also drops three unreachable envelope/fallback
paths plus the always-dead `isTargetSource` early-return, cutting
`lib/target-source-response.ts` from ~260 LOC to ~80 LOC. Deletes
`TerraformStatusModal` (only caller was the IDC/SDU fallback in
`ProcessStatusCard`, statically unreachable post-wave16).

Depends on:
- wave17-A (`fix(target-source): tighten isTargetSource cloudProvider check`) — PR #366.
- wave16 (IDC/SDU removal, `CloudProvider` narrowed to AWS/Azure/GCP) — PR #362.

## Contract change

`TargetSource` (external, post-normalizer):
- `status: ProjectStatus` — removed
- `terraformState: TerraformState` — removed

`Project` (mock-internal):
- `status`, `terraformState` — moved here from `BaseTargetSource`. Externally invisible.

BFF response unaffected — it never sent either field to begin with.

## Normalizer cleanup (`lib/target-source-response.ts`)

- `{ target_source }` snake envelope — deleted (unreachable after `camelCaseKeys`).
- `{ project }` legacy envelope — deleted (not used for this path).
- `readValue(value, 'foo', 'foo_bar')` snake fallbacks — deleted (snake keys never arrive).
- `buildDerivedStatus`, `buildTerraformState`, `isProjectStatus`, `isTerraformState` —
  deleted.
- `isCloudProvider` + `isTargetSource` early-return — deleted. `normalizeCloudProvider`
  is idempotent so always-running normalization is safe.
- Total LOC: ~260 → ~80.

## UI changes

- `app/components/features/TerraformStatusModal.tsx` — deleted (172 LOC).
- `app/components/features/ProcessStatusCard.tsx`:
  - `terraformModal`, `getProgress`, `TerraformStatusModal` import + render — removed.
  - `INSTALLING` step ternary collapsed to exhaustive AWS/Azure/GCP form.
- `getProjectCurrentStep(project)` → `project.processStatus` in:
  - `app/integration/api/v1/target-sources/[targetSourceId]/process-status/route.ts`
  - `app/integration/target-sources/[targetSourceId]/_components/{aws,azure,gcp}/*.tsx`
  - `app/components/features/ProcessStatusCard.tsx`
- `getProjectCurrentStep` export removed from `lib/process`.

## Out of scope (follow-up waves)

- Further slim of mock `toIssue222TargetSourceInfo` to match `user.yaml` shape exactly
  (drop `name`, `isRejected`, internal fields). Requires consumer audit.
- If `ProcessStatusCard` ever needs live terraform progress for non-AWS providers,
  wire through a dedicated installation-status endpoint — not through the target-source
  detail contract.

## Test plan
- [x] `npx tsc --noEmit`
- [x] `npm run lint -- lib app`
- [x] `npx vitest run` — all pass (test updates in
  `lib/__tests__/target-source-response.test.ts`).
- [x] Manual: AWS (`1006`), Azure (`1003`), GCP (`1002`) detail pages render.
- [x] Manual: `INSTALLING`-step inline installation components render per provider.
- [x] Manual: Admin create flow succeeds.

## Ref

- Spec: `docs/reports/target-source-cleanup/wave17-B-contract-slim.md`
- Background: `docs/reports/target-source-cleanup/README.md`
- Preceded by: wave17-A (PR #366), wave16 (PR #362).
```

## ⛔ Do NOT auto-merge

Stop at `gh pr create`. Report the URL.

## Return (under 250 words)

1. PR URL.
2. `tsc` / `lint` / `vitest` results.
3. LOC delta for `lib/target-source-response.ts` (expected ~260 → ~80).
4. LOC delta for `TerraformStatusModal.tsx` (expected: -172 full deletion).
5. `ProcessStatusCard.tsx` LOC delta + whether the `INSTALLING` ternary is cleanly
   exhaustive (no `// @ts-expect-error`, no fallback).
6. Number of UI call sites migrated from `getProjectCurrentStep`.
7. Test file changes summary (which tests dropped, which rewritten).
8. Any `.status` / `.terraformState` / `TerraformStatusModal` reference you couldn't
   migrate cleanly (record under PR `## Follow-up`).
9. Any behavior divergence the test suite surfaced.

## Parallel coordination

- Blocked by: **wave17-A merged** (same file `lib/target-source-response.ts`) AND
  **wave16 merged** (`CloudProvider` narrowed → IDC/SDU fallback unreachable).
- Blocks: further mock response slim (separate follow-up wave).
