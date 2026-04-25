# adr011-05 — Cleanup: delete lib/api-client + ESLint lock + boundary docs final

## Context

After specs 02-04 ship, every route handler calls `bff.method()` and `lib/api-client/*` is dead code. This spec performs the **minimum** cleanup needed to lock in the new architecture:

1. Delete `lib/api-client/*` directory
2. Re-tighten `docs/api/boundaries.md` to single-pipeline model
3. Add ESLint `no-restricted-imports` to enforce the boundary
4. Update `AGENTS.md` and anti-patterns SKILL to reflect post-migration state

**Optional appendix** (separately scoped — can be skipped or split into a follow-up PR):

5. Issue222 naming generalization (rename `Issue222*` types, delete `lib/issue-222-approval.ts` if all consumers gone, rename `docs/swagger/issue-222-client.yaml`)

Per Codex over-engineering review, the original spec 07 was a grab bag (deletion + ESLint + Issue222 rename + Swagger rename + LOC reduction + smoke diff + app/lib/api line-count target). This trimmed version keeps only the **load-bearing** pieces; cosmetics are deferred.

## Precondition

```
git fetch origin main

gh pr list --state merged --search "adr011-02" | grep -q "MERGED" || { echo "✗ adr011-02 not merged"; exit 1; }
gh pr list --state merged --search "adr011-03" | grep -q "MERGED" || { echo "✗ adr011-03 not merged"; exit 1; }
gh pr list --state merged --search "adr011-04" | grep -q "MERGED" || { echo "✗ adr011-04 not merged"; exit 1; }

# No route handler should still import @/lib/api-client
! rg "from ['\"]@/lib/api-client" app/integration/api/v1 --glob '*.ts' \
  || { echo "✗ residual lib/api-client imports in routes — finish specs 02-04 first"; exit 1; }
```

## Worktree

```
bash scripts/create-worktree.sh --topic adr011-05-cleanup --prefix refactor
cd /Users/study/pii-agent-demo-adr011-05-cleanup
```

## Required reading

1. `docs/adr/011-typed-bff-client-consolidation.md` §"Migration Plan" Phase 6
2. `docs/reports/sit-migration-prompts/adr011-README.md`
3. Current state of `lib/api-client/*`, `docs/api/boundaries.md`, `AGENTS.md`, `eslint.config.mjs`
4. (For the optional appendix) `docs/reports/api-client-pattern-review.md` §1.4 — Issue222 footprint

## Step 1 — Verify nothing references lib/api-client

```
rg "from ['\"]@/lib/api-client" --glob '!node_modules' --glob '!.next' -l
```

Expected: zero matches outside `lib/api-client/*` itself. If any external reference exists, identify which spec missed it and fix in that spec's follow-up before continuing here.

## Step 2 — Move test-only mock helpers (if any)

`lib/api-client/mock/confirm.ts` exports test-only helpers (`_resetApprovedIntegrationStore`, `_fastForwardApproval`, `_setApprovedIntegration`). Move them to:

```
lib/bff/__tests__/_helpers.ts
```

Update imports in test files (`lib/__tests__/*`). The helpers continue operating on the same in-memory stores (which spec 04 placed in `lib/bff/mock-adapter.ts` or kept in `lib/api-client/mock/confirm.ts` — verify and adjust).

## Step 3 — Delete `lib/api-client/*`

```
git rm -r lib/api-client/
```

Verify build:

```
npx tsc --noEmit && npm run lint && npm run test:run && npm run build
```

If any failure: investigate; the most likely cause is a stray import that grep missed (e.g. dynamic import string).

## Step 4 — Rewrite `docs/api/boundaries.md`

Replace the migration banner with the single-pipeline model:

```
┌─────────────────────────────────────────────────────────────────────┐
│ Where code runs      │ Uses                                          │
├─────────────────────────────────────────────────────────────────────┤
│ Browser (CSR)        │ @/app/lib/api/*       ← hop 1: Next route    │
│ Server Component     │ @/lib/bff/client      ← direct, typed         │
│ Next.js Route        │ @/lib/bff/client      ← typed dispatch        │
└─────────────────────────────────────────────────────────────────────┘
```

Tighten the "Forbidden imports" table:

| From | Must NOT import |
|---|---|
| `app/components/**` (CSR) | `@/lib/bff/*` (use `@/app/lib/api/*`) |
| Server Components | `@/app/lib/api/*` (use `@/lib/bff/client`) |
| `app/integration/api/v1/**/route.ts` | `@/app/lib/api/*` (use `@/lib/bff/client`) |
| Anywhere | `@/lib/api-client/*` (deleted) |

Remove the §"Open questions" section — three of them are now resolved (boundary, schema validation in I-3 framing, two-client question). Add a §"Resolved by ADR-011" footer:

> The previous "Open questions" — two HTTP clients, schema validation gap, ESLint enforcement — were addressed by ADR-011 over specs adr011-01 through adr011-05.

## Step 5 — ESLint `no-restricted-imports`

In `eslint.config.mjs`, add:

```js
{
  files: ['app/components/**/*.{ts,tsx}', 'app/integration/target-sources/**/*.{ts,tsx}'],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [
        { group: ['@/lib/bff/*'], message: 'CSR components must use @/app/lib/api/* — see docs/api/boundaries.md' },
        { group: ['@/lib/api-client/*'], message: 'lib/api-client/* was removed in ADR-011. Use @/lib/bff/client (server) or @/app/lib/api/* (CSR).' },
      ],
    }],
  },
},
{
  files: ['app/integration/api/v1/**/route.ts'],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [
        { group: ['@/app/lib/api/*'], message: 'Route handlers use @/lib/bff/client — see docs/api/boundaries.md' },
      ],
    }],
  },
},
```

Adjust globs to match actual project layout. Run `npm run lint` and fix any violation surfaced.

## Step 6 — `AGENTS.md` and anti-patterns SKILL

`AGENTS.md` §"API + ADR Guardrails" — replace the migration-transitional rule with the post-migration rule:

```
- ADR-011 (Typed BFF Client Consolidation):
  - Routes dispatch to `bff.method()` from `@/lib/bff/client`.
  - Server Components also use `bff` directly (server-only).
  - Mock business logic lives in `@/lib/bff/mock-adapter.ts`.
  - ESLint enforces the boundary.
```

`.claude/skills/anti-patterns/SKILL.md` §"API boundary anti-patterns" — replace the migration footnote with the locked four-rule table from Step 4.

## Step 7 — Smoke check

Run the full test suite and one round of representative integration tests:

```
npm run test:run
npm run build
```

That's the gate. No two-port baseline diff ceremony — by this point three migration PRs have all passed integration tests, ESLint enforces the boundary, and `lib/api-client/*` deletion would have failed `tsc` if anything still referenced it.

## Acceptance criteria

- [ ] `lib/api-client/*` directory does not exist on disk.
- [ ] Test-only mock helpers relocated and tests still import them correctly.
- [ ] `docs/api/boundaries.md` is rewritten to single-pipeline; "Open questions" section removed.
- [ ] `eslint.config.mjs` has `no-restricted-imports` rules per Step 5; `npm run lint` passes.
- [ ] `AGENTS.md` and `.claude/skills/anti-patterns/SKILL.md` reflect post-migration state.
- [ ] `npx tsc/lint/test/build` all pass.
- [ ] **I-1, I-2, I-3, I-4** trivially preserved — no source code under `app/` or `lib/bff/` is modified in this spec (cleanup is deletions + docs + ESLint config only).

## Optional appendix — Issue222 naming generalization

If execution capacity allows AND the implementer is confident, perform these in this PR. Otherwise file a follow-up issue and leave to a separate small PR.

### A1. Rename `Issue222*` types in `lib/bff/types/confirm.ts`

Current: re-exports from `lib/issue-222-approval.ts`. Move definitions in-place and drop the prefix:

| Old | New |
|---|---|
| `Issue222ApprovalRequestPayload` | `ApprovalRequestPayload` |
| `Issue222ApprovedIntegration` | `ApprovedIntegrationPayload` |
| `Issue222ProcessStatusResponse` | `ProcessStatusResponse` |
| `Issue222ApprovalActionResponse` | `ApprovalActionResponse` |
| `Issue222ApprovalHistoryPage` | `ApprovalHistoryPage` |
| `Issue222ResourceConfigDto` | `ResourceConfigDto` |
| `Issue222CloudProvider` | `BffCloudProvider` (avoid collision with internal `CloudProvider`) |
| `Issue222CreateTargetSourceBody` | `CreateTargetSourceBody` |

Update consumers via project-wide search/replace (skip `docs/reports/*` and `docs/feature/*` — historical).

### A2. Delete `lib/issue-222-approval.ts` only if fully unused

After A1 and any pending normalize-cleanup follow-up, check:

```
rg "from ['\"]@/lib/issue-222-approval" --glob '!node_modules' --glob '!.next'
```

If zero matches: `git rm lib/issue-222-approval.ts`. If non-zero: leave the file; document remaining consumers in a follow-up issue.

### A3. Rename `docs/swagger/issue-222-client.yaml`

Rename to `docs/swagger/install-v1-client.yaml` (or merge into `docs/swagger/confirm.yaml`). Update Swagger UI page references and the spec slug router.

### Appendix gating

If A1/A2/A3 introduce risk (e.g. revealing an unresolved import), revert the appendix portion only and ship Steps 1-7. Naming is cosmetic; deletion of `lib/api-client/*` is the real win.

## Out of scope

- TanStack Query — future ADR
- zod schema validation at routes — future ADR (Option D from analysis report)
- Server Action conversion — orthogonal future ADR
- Removing `normalizeIssue222*` calls from `app/lib/api/index.ts` — separate follow-up after this spec, not bundled

## Dependencies

- After: `adr011-02`, `adr011-03`, `adr011-04` all merged
- Final spec — no successors

## Estimated effort

Medium. Steps 1-7 are mechanical (~3-5 hours). The optional appendix adds ~2-3 hours if pursued. Total upper bound 8 hours; lower bound 4.

## /codex-review

Optional. Run only if the optional appendix is included AND the rename touches >50 files.

## PR title

`refactor(adr011): finalize migration — delete lib/api-client, lock boundary, ESLint enforcement`

(If appendix included): append `+ Issue222 naming generalization`
