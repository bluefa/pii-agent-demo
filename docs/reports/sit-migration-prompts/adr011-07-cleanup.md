# adr011-07 — Phase 6: Final cleanup + naming generalization + ESLint lock

## Context

After specs 03-06 ship, every route handler in `app/integration/api/v1/**` calls `bff.method()`, every domain has a real `httpBff` and `mockBff` impl, and `lib/api-client/*` has become dead code. This spec performs the final cleanup that ADR-011 §"Migration Plan" Phase 6 specifies:

1. Delete `lib/api-client/*` entirely.
2. Naming generalization (per ADR-011 §"Migration Plan" Phase 6):
   - Rename `Issue222*` typed identifiers to domain names (drop the prefix).
   - Delete `lib/issue-222-approval.ts`.
   - Rename or merge `docs/swagger/issue-222-client.yaml`.
3. Rewrite `docs/api/boundaries.md` to the single-pipeline model and re-tighten the route-handler import rule.
4. Add ESLint `no-restricted-imports` to enforce the boundary.
5. Remove any remaining defensive normalize calls in `app/lib/api/index.ts` if any escaped specs 03-06.
6. Move test-only mock helpers (`_resetApprovedIntegrationStore`, etc.) from `lib/api-client/mock/confirm.ts` to a test-helpers location.

## Precondition

```
git fetch origin main

# All four group migrations must be merged
gh pr list --state merged --search "adr011-03" | grep -q "MERGED" || { echo "✗ adr011-03 not merged"; exit 1; }
gh pr list --state merged --search "adr011-04" | grep -q "MERGED" || { echo "✗ adr011-04 not merged"; exit 1; }
gh pr list --state merged --search "adr011-05" | grep -q "MERGED" || { echo "✗ adr011-05 not merged"; exit 1; }
gh pr list --state merged --search "adr011-06" | grep -q "MERGED" || { echo "✗ adr011-06 not merged"; exit 1; }

# No route handler should still import from @/lib/api-client
! rg "from ['\"]@/lib/api-client" app/integration/api/v1 --glob '*.ts' || { echo "✗ residual lib/api-client imports in routes"; exit 1; }

# lib/api-client/* should still exist but be unreferenced from app/
[ -d lib/api-client ] || { echo "✗ lib/api-client already gone — pre-existing cleanup?"; exit 1; }
```

## Worktree

```
bash scripts/create-worktree.sh --topic adr011-07-cleanup --prefix refactor
cd /Users/study/pii-agent-demo-adr011-07-cleanup
```

## Required reading

1. `docs/adr/011-typed-bff-client-consolidation.md` §"Migration Plan" Phase 6
2. `docs/reports/api-client-pattern-review.md` §1.4 (Issue222 keyword footprint), §"Category A/B" (which code stays vs goes)
3. `docs/reports/sit-migration-prompts/adr011-method-inventory.md` (verify all methods migrated)
4. `lib/api-client/types.ts`, `lib/api-client/index.ts`, `lib/api-client/bff-client.ts`, `lib/api-client/mock/*.ts` — slated for deletion; review for any test-only helpers worth keeping
5. `lib/issue-222-approval.ts` — slated for deletion; review for any types not yet re-anchored
6. `lib/bff/types/confirm.ts` — re-exports from `lib/issue-222-approval.ts` will need to become first-class
7. `docs/api/boundaries.md` — to be rewritten
8. `docs/swagger/issue-222-client.yaml` — to be renamed/merged
9. `eslint.config.mjs` — for the new `no-restricted-imports` rule
10. `AGENTS.md`, `.claude/skills/anti-patterns/SKILL.md` — boundary anchors that must reflect the post-cleanup state

## Step 1 — Verify nothing references `lib/api-client`

Before deleting, run:

```
rg "from ['\"]@/lib/api-client" --glob '!node_modules' --glob '!.next' -l
```

Expected: zero matches outside `lib/api-client/*` itself. If any match exists, identify whether it's in scope of an earlier spec that wasn't completed correctly, or a new edge case discovered now. Don't proceed with deletion until the result is clean.

## Step 2 — Move test-only mock helpers

`lib/api-client/mock/confirm.ts` exports test-only helpers:

- `_resetApprovedIntegrationStore`
- `_fastForwardApproval`
- `_setApprovedIntegration`

These are imported from test files (e.g. `lib/__tests__/mock-confirm-process-status.test.ts`). Move them to a new file:

```
lib/bff/__tests__/_helpers.ts  (or lib/bff/test-helpers.ts)
```

Update imports in test files. The test helpers continue to operate on the same mock stores (which are now in `lib/bff/mock-adapter.ts` per spec 06 — or wherever spec 06 placed the confirm stores).

## Step 3 — Delete `lib/api-client/*`

```
git rm -r lib/api-client/
```

This removes:
- `lib/api-client/types.ts` (ApiClient interface)
- `lib/api-client/index.ts` (the env-var dispatcher)
- `lib/api-client/bff-client.ts` (the proxyXxx HTTP client)
- `lib/api-client/mock/*.ts` (all mock impls — moved to mockBff in specs 03-06)

Verify nothing breaks: `npx tsc --noEmit && npm run build`.

## Step 4 — Issue222 naming generalization

This is the user-requested generalization (ADR-011 Phase 6 cleanup item).

### 4-1. Rename `Issue222*` types to domain names

Inside `lib/bff/types/confirm.ts` (currently re-exports from `lib/issue-222-approval.ts`), promote the type definitions to first-class declarations and drop the `Issue222` prefix. Examples:

| Old name | New name |
|---|---|
| `Issue222ApprovalRequestPayload` | `ApprovalRequestPayload` |
| `Issue222ApprovalRequestBody` | `ApprovalRequestBody` |
| `Issue222ApprovedIntegration` | `ApprovedIntegrationPayload` |
| `Issue222ConfirmedIntegration` | already covered by `BffConfirmedIntegration`? Verify |
| `Issue222ProcessStatus` | `ProcessStatusEnum` (or merge with existing `ProcessStatus`) |
| `Issue222ProcessStatusResponse` | `ProcessStatusResponse` |
| `Issue222ApprovalActionResponse` | `ApprovalActionResponse` |
| `Issue222ApprovalHistoryPage` | `ApprovalHistoryPage` |
| `Issue222ApprovalStatus` | `ApprovalStatus` |
| `Issue222ResourceConfigDto` | `ResourceConfigDto` |
| `Issue222CloudProvider` | `CloudProviderUpstream` (distinguish from existing `CloudProvider`) |
| `Issue222CreateTargetSourceBody` | `CreateTargetSourceBody` |

Watch for collisions with existing types — adjust the new name to avoid conflict (e.g. `CloudProvider` already exists in `lib/types.ts`).

Update all references via project-wide search/replace, scoped to `app/`, `lib/`, and tests. Skip `docs/reports/*` (historical) and `docs/feature/*` (historical migration notes).

### 4-2. Delete `lib/issue-222-approval.ts`

After 4-1, the file should have no remaining first-class declarations (everything moved into `lib/bff/types/confirm.ts`). Most internal helper functions (`toStringOrUndefined`, `mapApprovalStatus`, etc.) are also dead — they served defensive normalization that B-1 made obsolete.

```
git rm lib/issue-222-approval.ts
```

If any defensive helper is still referenced (e.g. an input-side normalize from spec 06 Step 3 decision), move it inline to the consuming file or a more domain-appropriate location.

### 4-3. Rename `docs/swagger/issue-222-client.yaml`

Two options:

- **Rename**: `docs/swagger/install-v1-client.yaml` (matches the upstream `/install/v1/**` contract base path)
- **Merge into existing**: fold its contents into `docs/swagger/confirm.yaml` if there's no other home for it

Recommendation: rename. Update references in:
- `app/integration/api-docs/page.tsx` (or wherever the Swagger UI lives) — the spec selector
- `app/api/swagger-spec/[slug]/route.ts` (or equivalent) — the slug routing
- `docs/swagger/README.md` — the spec index
- Any test that loads the spec

## Step 5 — Rewrite `docs/api/boundaries.md`

The file currently describes a 2-pipeline architecture with the migration banner from spec 01. Rewrite to the single-pipeline post-migration model:

```
┌─────────────────────────────────────────────────────────────────────┐
│ Where code runs      │ Uses                                          │
├─────────────────────────────────────────────────────────────────────┤
│ Browser (CSR)        │ @/app/lib/api/*       ← hop 1: Next route    │
│ Server Component     │ @/lib/bff/client      ← direct, typed         │
│ Next.js Route        │ @/lib/bff/client      ← typed dispatch        │
└─────────────────────────────────────────────────────────────────────┘
```

Single typed BffClient. CSR still goes via Next route (transport hop 1) → route handler → bff. RSC calls bff directly. No more two parallel implementations.

Re-tighten the "Forbidden imports" table:

| From | Must NOT import |
|---|---|
| `app/components/**` (CSR) | `@/lib/bff/*` (use `@/app/lib/api/*`) |
| Server Components | `@/app/lib/api/*` (use `@/lib/bff/client`) |
| Route handlers | `@/app/lib/api/*` (use `@/lib/bff/client`) |
| Anywhere | `@/lib/api-client/*` (deleted) |

Remove the "Open questions" section — all three are now resolved (boundary, schema, ESLint).

## Step 6 — Add ESLint `no-restricted-imports`

In `eslint.config.mjs`, add a rule:

```js
{
  files: ['app/components/**/*.{ts,tsx}', 'app/integration/target-sources/**/*.{ts,tsx}'],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [
        {
          group: ['@/lib/bff/*'],
          message: 'CSR components must use @/app/lib/api/* — see docs/api/boundaries.md',
        },
        {
          group: ['@/lib/api-client/*'],
          message: 'lib/api-client/* was removed in ADR-011. Use @/lib/bff/client (server) or @/app/lib/api/* (CSR).',
        },
      ],
    }],
  },
},
{
  files: ['app/integration/api/v1/**/route.ts', 'app/**/page.tsx'],  // route handlers + RSC pages
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [
        {
          group: ['@/app/lib/api/*'],
          message: 'Route handlers and Server Components must use @/lib/bff/client — see docs/api/boundaries.md',
        },
      ],
    }],
  },
},
```

Adjust file globs to match actual project layout. Run `npm run lint` and fix any violations surfaced (any remaining import will fail the build).

## Step 7 — AGENTS.md + anti-patterns SKILL.md

`AGENTS.md` §"API + ADR Guardrails" — replace the migration-transitional rule with the post-migration rule:

```
- ADR-011 (Typed BFF Client Consolidation):
  - All routes dispatch to `bff.method()` from `@/lib/bff/client`.
  - Server Components also use `bff` directly (server-only).
  - Mock business logic lives in `@/lib/bff/mock-adapter.ts` (extension files).
  - ESLint enforces the boundary; CI fails on violations.
```

`.claude/skills/anti-patterns/SKILL.md` §"API boundary anti-patterns" — update the four core rules to match Step 5's table.

## Step 8 — `app/lib/api/index.ts` final pass

For any remaining defensive runtime guards in `app/lib/api/index.ts` whose justification was "the route response shape is uncertain" — review and remove. The route now returns the typed `bff.x.y()` result, so most field-level fallbacks are redundant.

Domain mapping (e.g. number-to-string id conversion for `ApprovedIntegrationResponse`) STAYS — that's intentional CSR-layer transform.

Aim: reduce `app/lib/api/index.ts` line count from current ~667 down to ~500-550 (per analysis report estimate).

## Step 9 — ADR-011 status update

Update `docs/adr/011-typed-bff-client-consolidation.md`:

- Status line: leave as `Accepted (2026-04-25)` — the decision was made then; implementation completion doesn't change the decision date.
- Add a small "Implementation completed (YYYY-MM-DD)" note in §"Migration Plan" pointing to all merged spec PRs.

## Step 10 — Smoke tests

Full smoke pass — every endpoint surveyed in specs 03-06's smoke sections:

```bash
USE_MOCK_DATA=true npm run dev

# Group A
curl -s http://localhost:3001/integration/api/v1/target-sources/1003 | jq .
curl -s http://localhost:3001/integration/api/v1/user/me | jq .

# Group B
curl -s http://localhost:3001/integration/api/v1/azure/target-sources/1005/installation-status | jq .

# Group C
curl -s http://localhost:3001/integration/api/v1/admin/dashboard/summary | jq .

# Group D
curl -s http://localhost:3001/integration/api/v1/target-sources/1005/approved-integration | jq .
```

Compare each output to the *original* pre-ADR-011 baseline (use `git stash` on a clone of origin/main from before #374 if necessary). All field shapes match.

## Acceptance criteria

- [ ] `lib/api-client/*` directory does not exist on disk.
- [ ] `lib/issue-222-approval.ts` does not exist.
- [ ] No `Issue222*` identifier exists in `app/`, `lib/` (except in `docs/reports/*` and `docs/feature/*` historical files).
- [ ] `docs/swagger/issue-222-client.yaml` renamed (or merged) — Swagger UI loads from the new path.
- [ ] `docs/api/boundaries.md` describes single typed pipeline; no migration banner; "Open questions" removed.
- [ ] `eslint.config.mjs` has `no-restricted-imports` rules per Step 6.
- [ ] `AGENTS.md` and `.claude/skills/anti-patterns/SKILL.md` reflect post-migration state.
- [ ] `app/lib/api/index.ts` reduced by 100-150 lines from current state.
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm run test:run`, `npm run build` all pass.
- [ ] Smoke test outputs match pre-ADR-011 baseline.

## Out of scope

- Adopting zod schema validation at any boundary — that's a future decision (analysis report Option D)
- TanStack Query — future decision (Option C)
- Server Action conversion — orthogonal future ADR

## Open decisions

- **Documentation references in `docs/reports/*`**: leave as-is per ADR-011 cross-cutting decision. They are historical artifacts. If any report contains *active* (non-historical) operational guidance referring to `Issue222*` or `lib/issue-222-approval.ts`, fix only that specific reference — do not bulk-rewrite history.
- **`Issue222CloudProvider` rename collision**: existing `CloudProvider` type in `lib/types.ts` is the *internal* enum (`'AWS' | 'GCP' | 'Azure'`). `Issue222CloudProvider` is the upstream BFF enum (`'AWS' | 'GCP' | 'AZURE'`). Recommended new name: `BffCloudProvider` to keep them distinct.

## Dependencies

- After: `adr011-03`, `adr011-04`, `adr011-05`, `adr011-06` all merged
- Final spec — no successors

## Estimated effort

Large. Many small changes across the codebase, but each is mechanical. The largest sub-task is the Issue222 rename (project-wide). Plan 8-10 hours including the full smoke pass.

## /codex-review

**Mandatory** before merge. Final policy lock — the post-migration state should be cross-validated. Focus on:
1. Boundary rules (Step 5/6/7) are internally consistent.
2. ESLint rules don't accidentally break legitimate imports.
3. No `Issue222*` identifier escaped the rename.
4. Smoke test parity is preserved.

## PR title

`refactor(adr011): finalize migration — remove lib/api-client, generalize Issue222 naming, lock boundaries (Phase 6)`
