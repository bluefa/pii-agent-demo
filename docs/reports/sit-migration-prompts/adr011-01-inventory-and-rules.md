# adr011-01 — Phase 0 Inventory + Phase 1 Boundary Rule Update

## Context

ADR-011 supersedes ADR-007. Before any code migration begins, two pieces of preparatory work must ship:

1. **Phase 0 — Inventory**: a per-domain table that lists every method currently exposed by `lib/api-client/types.ts`, the corresponding upstream BFF path (from `lib/api-client/bff-client.ts`), the current `_lib/transform.ts` or `extractXxx` helper used (if any), the current mock impl location, and the route handler(s) that call it. Implementers of specs 03-06 will use this table as their source of truth.
2. **Phase 1 — Boundary rule update**: relax the documented "route handler can only import `@/lib/api-client/*`" rule so that route handler migrations in specs 03-06 do not violate the project's own anti-pattern catalog.

Both pieces are docs/rules-only. No `.ts` source code is modified.

## Precondition

```
git fetch origin main
[ -f docs/adr/011-typed-bff-client-consolidation.md ] || { echo "✗ ADR-011 not merged yet"; exit 1; }
[ -f docs/reports/api-client-pattern-review.md ] || { echo "✗ analysis report missing"; exit 1; }
```

## Worktree

```
bash scripts/create-worktree.sh --topic adr011-01-inventory-rules --prefix refactor
cd /Users/study/pii-agent-demo-adr011-01-inventory-rules
```

## Required reading

1. `docs/adr/011-typed-bff-client-consolidation.md` (full)
2. `docs/reports/api-client-pattern-review.md` §4.2.1 (canonical contract), §5.2 (phases), Appendix A/B (Codex findings)
3. `docs/api/boundaries.md` (current rules to relax)
4. `lib/api-client/types.ts` (the 13 domains + ~72 methods)
5. `lib/api-client/bff-client.ts` (path/method mapping)
6. `lib/api-client/mock/index.ts` and the `mock/<domain>.ts` files (mock structure)
7. `lib/bff/types.ts` (existing 2-domain BffClient — the starting point)
8. `lib/bff/http.ts` (existing `httpBff` impl pattern)
9. `AGENTS.md` (ADR-007 guard to relax)
10. `.claude/skills/anti-patterns/SKILL.md` § "API boundary anti-patterns"

## Step 1 — Produce the inventory

Create `docs/reports/sit-migration-prompts/adr011-method-inventory.md` with one table per ApiClient domain. Columns:

| Method | Upstream path + verb | route.ts paths | _lib/transform helper | Special wrapper | Mock impl notes | Composite? | Group |
|---|---|---|---|---|---|---|---|

- "Special wrapper" captures `proxyConfirmedIntegrationGet`, `proxyResourceCatalogGet`, etc.
- "Composite" = the route calls more than one client method or applies fallback (e.g. azure `check-installation` calling DB + VM).
- "Group" = A / B / C / D per the README — drives spec assignment.

Source data: `lib/api-client/bff-client.ts` for paths, `app/integration/api/v1/**/route.ts` for callers. Use `rg` to enumerate.

The 13 domains:

- `targetSources`, `projects`, `users` → Group A
- `aws`, `azure`, `gcp` → Group B (azure has composite)
- `services`, `dashboard`, `dev`, `scan`, `taskAdmin` → Group C
- `confirm` → Group D

For each domain, also list:

- Current mock-only auth helpers (e.g. `mockClient.azure.authorize()`) and decide: per spec 03/04/05/06, will these be replicated in mockBff or replaced with test-only helpers? Capture the recommendation here, not just the list.
- The `app/lib/api/index.ts` helper(s) that consume each route (so spec 07 cleanup can target them precisely).

Inventory must be **exhaustive** — if it misses a method, the per-group spec implementer will discover it mid-migration and that's painful. Cross-check by counting `client.<domain>.<method>` call sites against the table.

## Step 2 — Update boundary rules

### 2-1. `docs/api/boundaries.md`

Modify the "Forbidden imports" table to allow `@/lib/bff/*` from route handlers during the migration window. Add a banner at the top:

```
> **Migration in progress (ADR-011)**: route handlers may now import from
> `@/lib/bff/*` in addition to `@/lib/api-client/*`. The single-pipeline
> rule will be re-tightened in adr011-07. See ADR-011 §Migration Plan.
```

Update the route-handler row of the "Forbidden imports" table:
- Before: `app/integration/api/v1/**/route.ts (route handler) → MUST NOT import @/app/lib/api/*, @/lib/bff/*`
- After: `app/integration/api/v1/**/route.ts (route handler) → MUST NOT import @/app/lib/api/*. May import @/lib/api-client/* (legacy) or @/lib/bff/* (preferred during ADR-011 migration).`

Update §"Module layout" Pipeline 1 description to acknowledge dual-client transition.

### 2-2. `AGENTS.md` — partially done in PR #382, finish here

PR #382 (commit `90182cf`) already replaced the ADR-007 rule block with an ADR-011 transitional block. Append one line to the bottom of the §"API + ADR Guardrails" → ADR-011 block:

```
  - Track per-domain migration status in `docs/reports/sit-migration-prompts/adr011-method-inventory.md`.
```

Do not rewrite the rest of the block — leave PR #382's wording intact.

### 2-3. `.claude/skills/anti-patterns/SKILL.md`

In "API boundary anti-patterns" section: keep the four core rules but add a footnote pointing to ADR-011 transition rules. Do not delete the boundary rules — they apply post-migration.

## Step 3 — ADR-011 cross-references

Update `docs/adr/011-typed-bff-client-consolidation.md`:

- Add a "Tracking" sub-section under §Migration Plan with a link to `adr011-method-inventory.md`.
- Verify that the migration plan table in ADR-011 matches `adr011-README.md`. Fix discrepancies in either direction (the README is the working plan; ADR is the policy doc).

## Acceptance criteria

- [ ] `docs/reports/sit-migration-prompts/adr011-method-inventory.md` exists and lists every method in `lib/api-client/types.ts`. Method count matches `rg -c "^\s*\w+:\s+\(" lib/api-client/types.ts` for sanity.
- [ ] `docs/api/boundaries.md` has the migration banner and the relaxed import rule.
- [ ] `AGENTS.md` references ADR-011 instead of ADR-007 for the route dispatch guard.
- [ ] `.claude/skills/anti-patterns/SKILL.md` boundary section has the ADR-011 footnote.
- [ ] ADR-011 has the Tracking sub-section.
- [ ] `npx tsc --noEmit` passes (no code changes, but verify nothing was accidentally edited).
- [ ] `npm run lint` passes.

## Tests

No new tests required — docs/rules only. Verify by inspection.

## Out of scope (do NOT do here)

- Touching any `.ts` source file under `lib/`, `app/`, `hooks/`. This spec is docs+rules only.
- Implementing any BffClient method.
- Renaming `Issue222*` types — that's spec 07.

## Dependencies

- After: ADR-011 merge (PR currently containing ADR-011)
- Before: every other spec in the ADR-011 series

## Estimated effort

Medium. The inventory is the bulk of the work — ~13 domains × cross-referencing 4 sources per method. Plan 4-6 hours for a thorough inventory.

## Open decisions

None at this spec — all cross-cutting decisions are locked in `adr011-README.md` §"Cross-cutting decisions". This spec just publishes the inventory.

## PR title

`refactor(adr011): publish method inventory and relax boundary rules for migration window`
