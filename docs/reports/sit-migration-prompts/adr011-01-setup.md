# adr011-01 — Setup: boundary rule completion + per-domain typed shapes

## Context

Two preparatory pieces before any per-domain migration begins:

1. **Boundary rule update**: relax `docs/api/boundaries.md`'s "Forbidden imports" table to permit `@/lib/bff/*` from route handlers during the migration window. (PR #382 already updated `AGENTS.md`; this spec finishes `boundaries.md` and `.claude/skills/anti-patterns/SKILL.md`.)
2. **Typed shapes**: declare per-domain typed return shapes in `lib/bff/types/<domain>.ts` so specs 02-04 have something to extend. This is *type definitions only* — no `BffClient` interface expansion, no httpBff/mockBff stubs.

The merged inventory + types approach (vs. two separate specs) follows the Codex over-engineering review: the typed interface IS the actionable inventory.

## Precondition

```
git fetch origin main
[ -f docs/adr/011-typed-bff-client-consolidation.md ] || { echo "✗ ADR-011 missing"; exit 1; }
[ -f docs/reports/api-client-pattern-review.md ] || { echo "✗ analysis report missing"; exit 1; }
```

## Worktree

```
bash scripts/create-worktree.sh --topic adr011-01-setup --prefix refactor
cd /Users/study/pii-agent-demo-adr011-01-setup
```

## Required reading

1. `docs/adr/011-typed-bff-client-consolidation.md` — full
2. `docs/reports/sit-migration-prompts/adr011-README.md` — invariants I-1..I-4, cross-cutting decisions
3. `docs/reports/api-client-pattern-review.md` §4.2.1 (canonical contract B-1)
4. `docs/api/boundaries.md` — current rules to relax
5. `lib/api-client/types.ts` — the 13 domains + ~72 methods (source of truth for what shapes need declaring)
6. `lib/api-client/bff-client.ts` — current paths and special wrappers (`proxyConfirmedIntegrationGet`, `proxyResourceCatalogGet`)
7. `lib/bff/types.ts`, `lib/bff/http.ts` — existing 2-domain BffClient (the foundation; do NOT touch in this spec)
8. `lib/issue-222-approval.ts` — re-exportable Issue222\* types
9. `lib/confirmed-integration-response.ts`, `lib/target-source-response.ts`, `lib/resource-catalog-response.ts`, `lib/types.ts`, `lib/types/azure.ts`, `lib/types/queue-board.ts` — typed shape sources

## Step 1 — Boundary rule completion

### `docs/api/boundaries.md`

Add a banner near the top:

```
> **Migration in progress (ADR-011)**: route handlers may import from
> `@/lib/bff/*` in addition to `@/lib/api-client/*` during the per-domain
> rollout. The single-pipeline rule is re-tightened in adr011-05.
```

In the "Forbidden imports" table, change the route handler row from:
- `app/integration/api/v1/**/route.ts → MUST NOT import @/app/lib/api/*, @/lib/bff/*`

to:
- `app/integration/api/v1/**/route.ts → MUST NOT import @/app/lib/api/*. May import @/lib/api-client/* (legacy) or @/lib/bff/* (preferred during ADR-011 migration).`

### `.claude/skills/anti-patterns/SKILL.md`

In the "API boundary anti-patterns" section, add a footnote: *"Route handlers may use `@/lib/bff/*` during the ADR-011 migration window. See `docs/reports/sit-migration-prompts/adr011-README.md`."*

### `AGENTS.md`

Already updated by PR #382. Verify the §"API + ADR Guardrails" still has the ADR-011 transitional rule. Append one line at the end of that block:

```
  - Track per-domain migration status in PR titles (`refactor/adr011-NN-*`).
```

(No method-inventory file — Codex review removed that as duplicating the typed interface.)

## Step 2 — Per-domain typed shapes

Create `lib/bff/types/<domain>.ts` for each of the 13 domains. These files **only declare types** — they are not imported by `lib/bff/types.ts` (the BffClient interface) yet. Specs 02-04 will extend BffClient and import from these.

### File layout

```
lib/bff/types/
  target-sources.ts   # exports TargetSourceDetailResponse, ServicesTargetSourcesResponse, CreateTargetSourceResult
  projects.ts         # 16 method shapes — re-export from lib/types.ts where possible
  users.ts            # CurrentUser, ServicesPageResponse, etc.
  aws.ts              # LegacyAwsInstallationStatus, etc. (extracted from current `as Shape` casts)
  azure.ts            # LegacyInstallationStatus, LegacyVmInstallationStatus (move from _lib/transform.ts), AzureSettings
  gcp.ts
  services.ts         # AuthorizedUser, ServiceSettings, etc.
  dashboard.ts
  dev.ts
  scan.ts             # ScanJob, ScanHistoryPage, etc.
  task-admin.ts       # ApprovalRequestQueueItem, etc.
  confirm.ts          # re-exports Issue222* types from lib/issue-222-approval.ts (rename in spec 05)
```

### Sourcing rules

For each method in `lib/api-client/types.ts`:

1. **GET methods** → typed shape is camelCase (matches current `proxyGet` `camelCaseKeys` output). If a typed shape already exists in `lib/types.ts` or similar, re-export. Otherwise declare based on the route handler's current `as Shape` cast or the `extractXxx` helper input.
2. **POST/PUT/DELETE methods** → typed shape is **snake_case** (matches current raw passthrough — see I-3 invariant). If only a camelCase type exists today, declare a snake_case sibling. Common pattern: BFF returns snake_case, then `extractTargetSource` or `normalizeIssue222*` converts; the BFF layer's typed shape uses the snake_case form.

### Special transforms (Cat B from analysis report)

`extractConfirmedIntegration`, `extractResourceCatalog`, `extractTargetSource` — these stay in their current locations (`lib/confirmed-integration-response.ts`, etc.). Specs 02/03/04 will import them inside `httpBff.<domain>.<method>` impls.

### `lib/bff/types/confirm.ts` and Issue222 re-exports

```typescript
// lib/bff/types/confirm.ts
export type {
  Issue222ApprovalRequestPayload,
  Issue222ApprovalRequestBody,
  Issue222ApprovalActionResponse,
  Issue222ApprovedIntegration,
  Issue222ApprovalHistoryPage,
  Issue222ProcessStatusResponse,
  Issue222ResourceConfigDto,
  // ... whatever's in use
} from '@/lib/issue-222-approval';

export type { ConfirmedIntegrationResponsePayload, BffConfirmedIntegration } from '@/lib/confirmed-integration-response';
export type { ResourceCatalogResponsePayload } from '@/lib/resource-catalog-response';
```

The `Issue222*` prefix is preserved per cross-cutting decision #4 (rename deferred to spec 05).

## Step 3 — `lib/bff/types.ts` is NOT extended in this spec

Leave `lib/bff/types.ts` with its existing 2-domain interface. Specs 02-04 each extend it for their domains.

This avoids the `NOT_IMPLEMENTED` stub churn that the Codex review flagged. `httpBff` and `mockBff` continue to satisfy the unchanged 2-domain `BffClient`. Per-domain spec PRs add domains incrementally.

## Acceptance criteria

- [ ] `docs/api/boundaries.md` has the migration banner and relaxed route-handler import rule.
- [ ] `.claude/skills/anti-patterns/SKILL.md` has the ADR-011 footnote.
- [ ] `AGENTS.md` has the PR-title tracking line appended.
- [ ] `lib/bff/types/<domain>.ts` exists for each of the 13 domains, exporting typed shapes for every method in `lib/api-client/types.ts` (GET → camelCase, POST/PUT/DELETE → snake_case per I-3).
- [ ] `lib/bff/types.ts` is **unchanged** in this PR (still the 2-domain interface).
- [ ] `lib/bff/http.ts`, `lib/bff/mock-adapter.ts` are **unchanged**.
- [ ] No file under `app/integration/api/v1/**` is modified.
- [ ] No file under `lib/api-client/**` is modified.
- [ ] `npx tsc --noEmit` passes (new type files don't need to be referenced; they just need to compile).
- [ ] `npm run lint` passes.
- [ ] `npm run build` passes.
- [ ] **I-1, I-2, I-3, I-4** trivially pass — this is type-definitions only, no behavior change.

## Out of scope

- Implementing any `httpBff.<domain>.<method>` (specs 02-04)
- Implementing any `mockBff.<domain>.<method>` (specs 02-04)
- Touching route handlers (specs 02-04)
- Renaming `Issue222*` (spec 05 optional appendix)
- Deleting `lib/api-client/*` (spec 05)

## Dependencies

- After: ADR-011 merged (already done — #374, #382)
- Before: `adr011-02`, `adr011-03`, `adr011-04`

## Estimated effort

Medium-Large. ~13 type files × type sourcing per method. Plan 4-6 hours. Most methods can re-export existing types; only when no typed shape exists today does the implementer need to declare one based on current `as` casts.

## Open decisions

- **id type normalization (`string` → `number`)**: ApiClient uses `string` for `targetSourceId`. Existing `lib/bff/http.ts` uses `number`. Decision: standardize on `number` in BffClient method signatures (specs 02-04 will commit to this). This spec only declares the typed return shapes, not the method signatures.
- **`Issue222CloudProvider` collision**: existing `CloudProvider` type in `lib/types.ts` is internal (`'AWS' | 'GCP' | 'Azure'`); `Issue222CloudProvider` is upstream BFF (`'AWS' | 'GCP' | 'AZURE'`). Re-export with the prefix preserved — rename in spec 05.

## /codex-review

Optional. The work is mechanical type sourcing.

## PR title

`refactor(adr011): setup — boundary rule update + per-domain typed shapes`
