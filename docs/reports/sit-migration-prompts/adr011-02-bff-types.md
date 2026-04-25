# adr011-02 — Phase 2: BffClient types expanded for all domains

## Context

Spec 01 produced `adr011-method-inventory.md` enumerating ~72 methods across 13 domains in `ApiClient`. This spec defines the **typed contract** in `lib/bff/types.ts` so that specs 03-06 can implement `httpBff` and `mockBff` against a single source of truth.

Per ADR-011 §"Canonical contract variant: B-1": every method returns the *typed legacy upstream shape* — the same structure that `_lib/transform.ts` and `extractConfirmedIntegration` currently consume as input. v1 transforms remain in route handlers (specs 03-06).

## Precondition

```
git fetch origin main
[ -f docs/reports/sit-migration-prompts/adr011-method-inventory.md ] || { echo "✗ adr011-01 not merged"; exit 1; }
[ -f docs/adr/011-typed-bff-client-consolidation.md ] || { echo "✗ ADR-011 missing"; exit 1; }
```

## Worktree

```
bash scripts/create-worktree.sh --topic adr011-02-bff-types --prefix refactor
cd /Users/study/pii-agent-demo-adr011-02-bff-types
```

## Required reading

1. `docs/adr/011-typed-bff-client-consolidation.md` — full
2. `docs/reports/sit-migration-prompts/adr011-method-inventory.md` — the per-domain method list
3. `lib/api-client/types.ts` — current `ApiClient` interface (the source for method signatures)
4. `lib/api-client/bff-client.ts` — current proxy paths and special wrappers (`proxyConfirmedIntegrationGet`, `proxyResourceCatalogGet`)
5. `lib/bff/types.ts` — existing 2-domain `BffClient` (the foundation to expand)
6. `lib/bff/http.ts` — existing `httpBff` impl pattern (the `get<T>(path)` helper, error handling style)
7. `lib/bff/mock-adapter.ts` — existing `mockBff` to extend
8. `lib/issue-222-approval.ts` — typed shape candidates: `Issue222ApprovalRequestPayload`, `Issue222ApprovedIntegration`, `Issue222ProcessStatusResponse`, `Issue222ResourceConfigDto`, etc.
9. `lib/confirmed-integration-response.ts` — `ConfirmedIntegrationResponsePayload`, `BffConfirmedIntegration`
10. `lib/target-source-response.ts` — `TargetSourceDetailResponse`
11. `lib/types.ts`, `lib/types/azure.ts`, `lib/types/queue-board.ts` — existing domain types

## Step 1 — Type sourcing strategy

For each method in the inventory, identify the canonical typed shape from one of three sources, in priority order:

1. **Existing typed shape**: a type already defined somewhere in `lib/` matches the upstream BFF response. Use it directly. Example: `targetSources.get` → `TargetSourceDetailResponse`.
2. **Issue222\* alias**: many `confirm` methods already have a typed shape via `Issue222*` types in `lib/issue-222-approval.ts`. Re-export from `lib/bff/types.ts` (keep the prefix; spec 07 renames). Example: `confirm.createApprovalRequest` → `Issue222ApprovalRequestPayload`.
3. **New definition needed**: no existing typed shape. Define a new interface in `lib/bff/types/<domain>.ts` based on the route handler's current cast (e.g. `LegacyInstallationStatus` from `_lib/transform.ts`).

If a route currently does `await response.json() as LegacyX`, that `LegacyX` is the canonical typed shape — promote it to `lib/bff/types/<domain>.ts`.

## Step 2 — File layout

```
lib/bff/
  types.ts            # BffClient interface (root); imports from per-domain type files
  types/
    target-sources.ts # TargetSourceDetailResponse, etc.
    projects.ts       # all 16 projects.* method shapes
    users.ts
    aws.ts            # LegacyAwsInstallationStatus, etc.
    azure.ts          # LegacyInstallationStatus + LegacyVmInstallationStatus moved here
    gcp.ts
    services.ts
    dashboard.ts
    dev.ts
    scan.ts           # LegacyScanJob etc.
    confirm.ts        # Issue222* re-exports + any non-Issue222 confirm types
    task-admin.ts
  http.ts             # extended with stub methods (throw 'not implemented in adr011-02')
  mock-adapter.ts     # extended with stub methods (same)
```

Per-domain split keeps `lib/bff/types.ts` itself small (just the root interface + imports) and parallels `lib/api-client/mock/<domain>.ts` structure.

## Step 3 — Implement types.ts

Replace the current 19-line `lib/bff/types.ts` with a root interface that mirrors `ApiClient` from `lib/api-client/types.ts`, except:

- Method names: same as ApiClient (preserve to ease later route migration)
- Return types: typed domain data instead of `Promise<NextResponse>`
- Argument types: prefer `number` for ids (existing httpBff convention) over `string`. Capture this normalization decision in the inventory.

Example structure:

```typescript
import type {
  TargetSourceDetailResponse,
  ServicesTargetSourcesResponse,
  CreateTargetSourceResult,
} from '@/lib/bff/types/target-sources';
import type { /* ... */ } from '@/lib/bff/types/projects';
// ... 11 more domain imports

export interface BffClient {
  targetSources: {
    list: (serviceCode: string) => Promise<ServicesTargetSourcesResponse>;
    get: (id: number) => Promise<TargetSourceDetailResponse>;
    create: (body: CreateTargetSourceRequest) => Promise<CreateTargetSourceResult>;
  };
  projects: { /* 16 methods */ };
  users: { /* 4 methods */ };
  aws: { /* 5 methods */ };
  azure: { /* 8 methods */ };
  gcp: { /* 4 methods */ };
  services: {
    permissions: { /* 3 methods */ };
    projects: { /* 1 method */ };
    settings: {
      aws: { /* 3 methods */ };
      azure: { /* 1 method */ };
    };
  };
  dashboard: { /* 3 methods */ };
  dev: { /* 2 methods */ };
  scan: { /* 4 methods */ };
  taskAdmin: { /* 1 method */ };
  confirm: { /* 15 methods */ };
}
```

## Step 4 — Stub `httpBff` and `mockBff`

To keep the codebase compiling after this PR, both `lib/bff/http.ts` (`httpBff`) and `lib/bff/mock-adapter.ts` (`mockBff`) must satisfy the expanded `BffClient` interface. For methods not yet implemented, add stubs that throw:

```typescript
const NOT_IMPLEMENTED = (method: string) => () => {
  throw new Error(`[bff] ${method} is not implemented in adr011-02 — see specs adr011-03 through adr011-06`);
};

export const httpBff: BffClient = {
  targetSources: {
    list: NOT_IMPLEMENTED('targetSources.list'),
    get: async (id) => { /* existing impl preserved */ },
    create: NOT_IMPLEMENTED('targetSources.create'),
  },
  // ... preserve the 2 existing real impls (targetSources.get, users.me equivalent)
  // ... stub everything else
};
```

The existing real `httpBff.targetSources.get` and `httpBff.users.me` (current `lib/bff/http.ts`) **must continue to work** — Server Component callers depend on them. Verify after the change with `npm run build`.

`mockBff` likewise stubs everything except the 2 existing real methods.

## Step 5 — Type-only changes do not touch route handlers

⛔ This spec must NOT modify any route handler under `app/integration/api/v1/**`. Route handlers continue to call `client.method()` returning NextResponse. The new `BffClient` exists only as type definitions + stubs in this PR. Specs 03-06 wire it in per-domain.

⛔ Also do not delete `lib/issue-222-approval.ts` or rename `Issue222*` types. Re-export them through `lib/bff/types/confirm.ts`. Spec 07 handles the rename.

## Acceptance criteria

- [ ] `lib/bff/types.ts` exports `BffClient` covering all 13 domains.
- [ ] `lib/bff/types/<domain>.ts` exists for each domain with the typed shapes.
- [ ] `lib/bff/http.ts` exports `httpBff: BffClient` — existing real impls preserved, new methods stubbed via `NOT_IMPLEMENTED`.
- [ ] `lib/bff/mock-adapter.ts` exports `mockBff: BffClient` — existing real impls preserved, new methods stubbed.
- [ ] `npx tsc --noEmit` passes.
- [ ] `npm run build` passes (Server Components calling existing `bff.targetSources.get`, etc. still work).
- [ ] `npm run test:run` passes — no behavior changes, only new type surface.
- [ ] No file under `app/integration/api/v1/**` has been modified.
- [ ] No file under `lib/api-client/**` has been modified.

## Tests

Add a single contract test `lib/bff/__tests__/types-coverage.test.ts` that imports both `httpBff` and `mockBff` and checks their keys match the `BffClient` interface keys (TypeScript will catch this at compile time, but the test makes any future regression visible at test time too).

## Out of scope

- Implementing any new method (specs 03-06)
- Touching route handlers (specs 03-06)
- Deleting `lib/issue-222-approval.ts` or renaming Issue222* types (spec 07)
- Removing `lib/api-client/*` (spec 07)

## Dependencies

- After: `adr011-01` merged
- Before: `adr011-03`, `adr011-04`, `adr011-05`, `adr011-06`

## Estimated effort

Large. The type sourcing decisions (which existing type to re-use vs. when to define new) take judgment on every method. Plan 6-8 hours for a careful pass + tsc fixes.

## Open decisions

- **id type normalization (`string` → `number`)**: ApiClient uses `string` for `targetSourceId`. Existing `lib/bff/http.ts` uses `number`. Spec 02 standardizes on `number` (matches BFF int64 contract). Routes that pass `String(parsed.value)` to `client.x.y(...)` will need adjustment in specs 03-06; this spec only commits to the BffClient type.
- **`URLSearchParams` argument types**: `dashboard.systems(params: URLSearchParams)` — keep `URLSearchParams`, or normalize to a typed query object? Recommendation: keep `URLSearchParams` for now (simpler migration). Spec 03/05 may revisit.

## /codex-review

Mandatory before merge. Focus areas: (a) all method shapes have a typed return (no `unknown`/`any`), (b) re-export of `Issue222*` types preserves backward compat with existing `lib/issue-222-approval.ts` consumers, (c) stub coverage actually compiles against the interface.

## PR title

`refactor(adr011): expand BffClient types to cover all domains (Phase 2)`
