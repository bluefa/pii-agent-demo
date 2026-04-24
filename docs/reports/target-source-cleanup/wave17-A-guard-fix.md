# Wave 17-A — `isTargetSource` Guard Fix

## Context
Project: pii-agent-demo (Next.js 14, TS, Tailwind, Korean UI).

Tightens the `isTargetSource` type guard in `lib/target-source-response.ts` to a **literal
`CloudProvider` whitelist** so that Issue222-shaped payloads with `cloudProvider: 'AZURE'`
are no longer short-circuited as already-normalized. Root cause and trace in
[`README.md`](./README.md).

See [wave17-B](./wave17-B-contract-slim.md) for the follow-up structural cleanup — out of
scope here.

## Precondition
```
cd /Users/study/pii-agent-demo
git fetch origin main
[ -f lib/target-source-response.ts ] || { echo "✗ source file missing"; exit 1; }
[ -f lib/__tests__/target-source-response.test.ts ] || { echo "✗ test file missing"; exit 1; }
grep -q "typeof value.cloudProvider === 'string'" lib/target-source-response.ts \
  || { echo "✗ baseline check missing — bug already fixed or code drifted"; exit 1; }
```

No prerequisite merges. Works on current `origin/main` (HEAD `acbbfe8` as of spec authoring).

## Step 1: Worktree
```
bash scripts/create-worktree.sh --topic wave17-a-target-source-guard --prefix fix
cd /Users/study/pii-agent-demo-wave17-a-target-source-guard
```

## Step 2: Required reading
1. `lib/target-source-response.ts:67-74` — current `isTargetSource` guard.
2. `lib/target-source-response.ts:181-182` — `normalizeTargetSource` early-return that the
   loose guard triggers.
3. `lib/types.ts:25` — `CloudProvider` union (`'AWS' | 'Azure' | 'GCP' | 'IDC' | 'SDU'`).
4. `lib/api-client/mock/target-sources.ts:36-44, 98-99, 111-116, 180` — mock emits
   `cloudProvider: 'AZURE'` via `toIssue222CloudProvider('Azure')` wrapped in
   `{ targetSource: ... }`.
5. `app/integration/target-sources/[targetSourceId]/_components/ProjectDetail.tsx:24-37` —
   downstream consumer that fails `case 'Azure':` when receiving raw `'AZURE'`.
6. `lib/__tests__/target-source-response.test.ts:40-88` — existing `AZURE` test (covers
   **snake_case** input only; camelCase `TargetSource`-shaped input with `'AZURE'` is NOT
   covered — this spec adds that case).

## Step 3: Implementation

### 3-1. Add `isCloudProvider` helper

In `lib/target-source-response.ts`, **near the other type-guard helpers** (around L62-L74):

```ts
const isCloudProvider = (value: unknown): value is CloudProvider =>
  value === 'AWS'
  || value === 'Azure'
  || value === 'GCP'
  || value === 'IDC'
  || value === 'SDU';
```

Literal equality — do not import from `lib/types.ts` or build from an array of strings. The
whitelist is short and the helper must be self-contained.

### 3-2. Replace the loose check

Change the `typeof value.cloudProvider === 'string'` line inside `isTargetSource`:

```ts
// Before (L71):
  && typeof value.cloudProvider === 'string'
// After:
  && isCloudProvider(value.cloudProvider)
```

Do **not** touch the other five guard checks (`isRecord`, `id`, `targetSourceId`, `status`,
`terraformState`). Those are addressed by wave17-B.

### 3-3. Add the missing test case

In `lib/__tests__/target-source-response.test.ts`, add a new `it(...)` **inside the existing
`describe('extractTargetSource', ...)` block**, placed after the "normalizes Issue #222 ...
AZURE" test (L40-88). Model it on the `project` fixture (L7-21):

```ts
it('normalizes AZURE to Azure when a camelCase TargetSource-shaped payload carries the Issue #222 enum', () => {
  const result = extractTargetSource({
    id: 'proj-1',
    targetSourceId: 1003,
    projectCode: 'N-IRP-001',
    serviceCode: 'SERVICE-A',
    cloudProvider: 'AZURE',
    processStatus: ProcessStatus.WAITING_TARGET_CONFIRMATION,
    status: createInitialProjectStatus(),
    terraformState: { bdcTf: 'PENDING' },
    createdAt: '2026-02-16T10:00:00Z',
    updatedAt: '2026-02-16T10:10:00Z',
    name: 'proj-1',
    description: '',
    isRejected: false,
  });
  expect(result.cloudProvider).toBe('Azure');
});
```

This is the exact shape `toIssue222TargetSourceInfo` emits in the mock detail endpoint.
Before the fix, this test asserts `'AZURE'` (guard passes, raw returned) — so it would fail.
After the fix, the guard rejects raw `'AZURE'`, normalization runs,
`normalizeCloudProvider('AZURE') → 'Azure'`. Passes.

### 3-4. Do NOT modify

- Envelope unwrap (`{ targetSource } / { target_source } / { project }`) — wave17-B territory.
- `readValue`/`readString` snake_case fallbacks — wave17-B territory.
- `buildDerivedStatus`, `buildTerraformState` — wave17-B territory.
- `CloudProvider` type in `lib/types.ts` — do not touch, even though wave16 narrows it.
- Any mock file — mock behavior is unchanged; only the normalizer tightens.
- `ProjectDetail.tsx` or any UI — the fix makes `case 'Azure':` work correctly without UI
  changes.

### 3-5. Scope discipline

If you find another loose-check pattern while working, **record it in the PR body under
`## Follow-up`** — do not fix in this PR. wave17-B will address the broader structure.

## Step 4: Verify

```
npx tsc --noEmit
npm run lint -- lib/target-source-response.ts lib/__tests__/target-source-response.test.ts
npx vitest run lib/__tests__/target-source-response.test.ts
```

- `tsc` must exit 0.
- Lint: 0 new warnings.
- Test run: all pass, including the new test case.

Dev-server smoke (optional but recommended):

```
bash scripts/dev.sh /integration/target-sources/1003
```

Navigate to a mock Azure target source (id `1003`). Before fix: "지원하지 않는 클라우드
프로바이더입니다." After fix: Azure project page renders.

## Step 5: Commit + push + PR

```
git add lib/target-source-response.ts lib/__tests__/target-source-response.test.ts
git commit -m "fix(target-source): tighten isTargetSource cloudProvider check (wave17-A)

Issue222 'AZURE' emitted by mock's toIssue222TargetSourceInfo short-circuited
normalizeTargetSource because the guard only checked typeof string. Tightened
to a CloudProvider literal whitelist so raw enum values fall through to
normalizeCloudProvider('AZURE') → 'Azure'. Previously the Azure project
detail page rendered ErrorState via ProjectDetail's switch default branch.

- lib/target-source-response.ts: add isCloudProvider helper, replace
  'typeof cloudProvider === string' with isCloudProvider(cloudProvider)
- lib/__tests__/target-source-response.test.ts: add camelCase TargetSource-shaped
  AZURE test case (not covered by the existing snake_case AZURE test)

Follow-up: wave17-B removes the fabricated status/envelope dead paths in
normalizeTargetSource entirely."
git push -u origin fix/wave17-a-target-source-guard
```

PR body (write to `/tmp/pr-wave17-a-body.md`):

```
## Summary

Tighten `isTargetSource` guard in `lib/target-source-response.ts` so that
Issue222 `cloudProvider: 'AZURE'` payloads from the mock no longer short-circuit
the normalizer. Adds the camelCase test case that would have caught this
(the existing AZURE test only covers snake_case minimal payloads, which fail
the guard for other reasons and so hit normalization via a different path).

## Root cause

PR #356 (d5989ba) renamed `isProject` → `isTargetSource` and changed the
"distinguishing check" from `Array.isArray(value.resources)` to
`typeof value.cloudProvider === 'string'`. Any string passed — including
the Issue222 enum `'AZURE'` the mock emits — so the guard returned `true`
and the normalizer's early-return skipped `normalizeCloudProvider`.

`ProjectDetail.tsx:24-37` switch has `case 'Azure':`, which did not match
raw `'AZURE'`, so Azure detail pages rendered the ErrorState default branch.

AWS/GCP/IDC coincidentally have Issue222 enum literals that match the
`CloudProvider` type (`'AWS'`, `'GCP'`, `'IDC'`) — latent but not visible.
SDU is protected by an explicit mock branch in `toTargetSourceInfoCloudProvider`.

## Changes

- `lib/target-source-response.ts`
  - `isCloudProvider(value)` literal-whitelist helper (+6 LOC)
  - `isTargetSource` uses it instead of `typeof … === 'string'` (1 LOC)

- `lib/__tests__/target-source-response.test.ts`
  - New test: camelCase `TargetSource`-shaped payload with `cloudProvider: 'AZURE'`
    → normalized to `'Azure'` (+15 LOC)

## Out of scope

- `{ target_source }` snake envelope removal, `{ project }` envelope removal,
  snake_case `readValue` fallback removal — wave17-B.
- `status` / `terraformState` fabrication removal — wave17-B.
- `TerraformStatusModal` deprecation — future wave, blocks on wave16 IDC/SDU
  removal.

## Test plan

- [x] `npx tsc --noEmit`
- [x] `npm run lint -- lib/target-source-response.ts lib/__tests__/target-source-response.test.ts`
- [x] `npx vitest run lib/__tests__/target-source-response.test.ts`
- [x] Manual: mock Azure target source page (id 1003) renders Azure page (not ErrorState)

## Ref

- Spec: `docs/reports/target-source-cleanup/wave17-A-guard-fix.md`
- Background: `docs/reports/target-source-cleanup/README.md`
- Follow-up: `docs/reports/target-source-cleanup/wave17-B-contract-slim.md`
```

## ⛔ Do NOT auto-merge

Stop at `gh pr create`. Report the URL.

## Return (under 200 words)

1. PR URL
2. `tsc` / `lint` / `vitest` results
3. Line count net change (expected: +~20 LOC)
4. Confirmation that **no other files were touched** beyond the two in scope
5. Any guard pattern smell you noticed but deferred (record under PR `## Follow-up`)

## Parallel coordination

- Blocks: wave17-B (same file, must land first)
- Blocked by: nothing
- Safe parallel specs: none in this wave
