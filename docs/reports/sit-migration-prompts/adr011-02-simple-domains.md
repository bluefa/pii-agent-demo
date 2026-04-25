# adr011-02 — Simple/core domains migration

## Context

Migrate the eight domains with no composite routes and no Issue #222 entanglement:

- `targetSources` (3 methods)
- `projects` (16 methods — biggest single domain)
- `users` (4)
- `services` (7 — across permissions, projects, settings)
- `dashboard` (3)
- `dev` (2)
- `scan` (4)
- `taskAdmin` (1)

Total: ~40 methods across ~25 routes. All thin pass-through; no composition; no defensive normalization stack to worry about.

This spec **extends `BffClient`** for these domains, **implements `httpBff` and `mockBff`** for them, and **migrates the corresponding route handlers** to call `bff.x.y(...)` instead of `client.x.y(...)`. v1 transforms (`extractTargetSource`, etc.) stay in route layer per ADR-011 B-1.

It also defines the **shared `withV1` BffError handling** that specs 03 and 04 will reuse — first one wins.

## Precondition

```
git fetch origin main
[ -f lib/bff/types/projects.ts ] || { echo "✗ adr011-01 not merged"; exit 1; }
[ -f lib/bff/types/services.ts ] || { echo "✗ adr011-01 incomplete"; exit 1; }
```

## Worktree

```
bash scripts/create-worktree.sh --topic adr011-02-simple-domains --prefix refactor
cd /Users/study/pii-agent-demo-adr011-02-simple-domains
```

## Required reading

1. `docs/adr/011-typed-bff-client-consolidation.md` §"Migration Plan", §"Canonical contract variant"
2. `docs/reports/sit-migration-prompts/adr011-README.md` §"Observable Behavior Invariants", §"Cross-cutting decisions"
3. `docs/reports/sit-migration-prompts/adr011-README.md` §"What actually changes" — the worked example
4. `lib/bff/types.ts`, `lib/bff/types/{target-sources,projects,users,services,dashboard,dev,scan,task-admin}.ts`
5. `lib/api-client/bff-client.ts` — sections for these 8 domains (paths and methods to copy verbatim)
6. `lib/api-client/mock/{target-sources,projects,users,services,dashboard,dev,scan,queue-board}.ts`
7. `lib/bff/http.ts` — existing pattern (`get<T>(path)` helper, `BffError` style)
8. Route handlers under `app/integration/api/v1/`:
   - `target-sources/[targetSourceId]/{route.ts,secrets,resources,terraform-status,scan,scan/history,scanJob/latest,history,test-connection,scans/[scanId]}/route.ts`
   - `services/[serviceCode]/{authorized-users,authorized-users/[userId],projects,target-sources,settings/{aws,azure},settings/aws/verify-scan-role}/route.ts`
   - `admin/dashboard/{summary,systems,systems/export}/route.ts`
   - `task-admin/approval-requests/route.ts`
   - `dev/switch-user/route.ts`
   - `users/search/route.ts`, `user/{me,services,services/page}/route.ts`
9. `app/api/_lib/handler.ts` — `withV1` middleware (target for BffError handling)

## Step 1 — Extend `BffClient` interface

Modify `lib/bff/types.ts` to add the 8 domain entries. Methods take `number` for ids (per cross-cutting decision in spec 01); return types come from the per-domain type files spec 01 created.

Example:

```typescript
import type { TargetSourceDetailResponse, ServicesTargetSourcesResponse, CreateTargetSourceResult } from '@/lib/bff/types/target-sources';
// ... 7 more domain imports

export interface BffClient {
  targetSources: {
    get: (id: number) => Promise<TargetSourceDetailResponse>;  // existing — preserve signature
    list: (serviceCode: string) => Promise<ServicesTargetSourcesResponse>;
    create: (body: CreateTargetSourceRequest) => Promise<CreateTargetSourceResult>;
  };
  projects: { /* 16 methods */ };
  users: {
    me: () => Promise<CurrentUser>;  // existing
    search: (query: string, excludeIds: string[]) => Promise<UserSearchResponse>;
    getServices: () => Promise<ServicesResponse>;
    getServicesPage: (page: number, size: number, query?: string) => Promise<ServicesPageResponse>;
  };
  services: { /* nested permissions/projects/settings */ };
  dashboard: { /* 3 methods */ };
  dev: { /* 2 methods */ };
  scan: { /* 4 methods */ };
  taskAdmin: { /* 1 method */ };
}
```

`aws`, `azure`, `gcp`, `confirm` are NOT added here — they come in spec 03 and spec 04.

## Step 2 — Implement `httpBff` for these 8 domains

Add `post<T>(path, body)`, `put<T>(path, body)`, `del<T>(path)` helpers to `lib/bff/http.ts` matching the existing `get<T>` pattern. Important per **I-3**:

- `get<T>` returns `camelCaseKeys(data) as T` (matches current `proxyGet`)
- `post<T>`, `put<T>`, `del<T>` return raw passthrough — `await res.json() as T`, **no** `camelCaseKeys`. This matches current `proxyPost/Put/Delete`.

Then implement each method by copying the path/method from `lib/api-client/bff-client.ts` verbatim. Example:

```typescript
targetSources: {
  get: async (id) => {
    const data = await get<TargetSourceDetailResponse>(`/target-sources/${id}`);
    return extractTargetSource(data);  // existing helper, import preserved
  },
  list: async (serviceCode) => get<ServicesTargetSourcesResponse>(`/target-sources/services/${serviceCode}`),
  create: async (body) => {
    if (body.serviceCode) {
      const { serviceCode, ...rest } = body;
      return post<CreateTargetSourceResult>(`/target-sources/services/${serviceCode}/target-sources`, rest);
    }
    return post<CreateTargetSourceResult>('/target-sources', body);
  },
},
```

For `dashboard.systemsExport` if non-JSON: add `getRaw(path): Promise<Response>` to httpBff helpers and have the impl return `Response`. Verify content type during smoke tests.

## Step 3 — Implement `mockBff` for these 8 domains

Port logic from `lib/api-client/mock/<domain>.ts` into `mockBff.<domain>` in `lib/bff/mock-adapter.ts`. Three rules:

1. **Drop `NextResponse.json(...)` wrap** — return typed data directly. Throw `BffError` on failure.
2. **Mock-only `authorize()` — preserve by default** (cross-cutting decision #3). Keep the auth check; if it returns 401/403 currently, throw `BffError(401, ...)` or `BffError(403, ...)` with the same code/message. Tests asserting these statuses continue to pass via `withV1`'s BffError → ProblemDetails mapping (Step 4).
3. **Match the typed shape exactly** — use the type imports from `lib/bff/types/<domain>.ts`. Verify casing matches Step 2's `httpBff` (GET camelCase, POST/PUT/DELETE snake_case).

Old `lib/api-client/mock/<domain>.ts` files **stay untouched**. They become dead code after this PR's route migrations but spec 05 deletes them.

## Step 4 — `withV1` BffError handling (shared infrastructure)

Update `app/api/_lib/handler.ts` so that:

- A thrown `BffError` from inside the handler converts to a ProblemDetails response with `{ status, code, message, requestId }`, equivalent to `transformLegacyError`'s output for the same status.
- Other thrown errors continue to be `INTERNAL_ERROR` 500.

Reuse `app/api/_lib/problem.ts` builders. The transformation MUST produce a body byte-identical to what `transformLegacyError(NextResponse.json(error, { status }))` produces today — verify with one test (e.g. construct a `BffError(404, 'NOT_FOUND', 'foo')`, run through the new handler path, compare to old path's output).

This change is shared with specs 03 and 04. **First spec to merge ships it.** Specs 03/04 PRs check `app/api/_lib/handler.ts` already has BffError handling and skip if so; otherwise they implement it.

## Step 5 — Migrate route handlers (~25 routes)

For each handler that calls `client.{targetSources,projects,users,services,dashboard,dev,scan,taskAdmin}.*`:

```diff
-import { client } from '@/lib/api-client';
+import { bff } from '@/lib/bff/client';
 ...
-const response = await client.projects.get(String(parsed.value));
-if (!response.ok) return response;
-const data = await response.json() as Shape;
-return NextResponse.json(transform(data));
+const data = await bff.projects.get(parsed.value);
+return NextResponse.json(transform(data));
```

The route's external contract is unchanged (per I-2, I-3). Only internal dispatch is typed.

Edge cases:
- DELETE handlers: `bff.services.permissions.remove(...)` may return `void`. Route returns `new NextResponse(null, { status: 204 })`.
- `dashboard.systemsExport` non-JSON: route streams the `Response` returned by `bff.dashboard.systemsExport(...)`.

## Step 6 — Update route integration tests

For each test file under `app/integration/api/v1/__tests__/*` that mocks Group A/C clients:

```diff
-vi.mocked(client.projects.get).mockResolvedValue(NextResponse.json(fixture));
+vi.mocked(bff.projects.get).mockResolvedValue(fixture);  // typed value, no NextResponse wrap

-vi.mocked(client.projects.get).mockResolvedValue(NextResponse.json({...}, { status: 404 }));
+vi.mocked(bff.projects.get).mockRejectedValue(new BffError(404, 'NOT_FOUND', '...'));
```

If a test relied on a specific 401/403 from `mockClient`'s `authorize()`, the equivalent under ADR-011 is `mockBff.x.y` throwing `BffError(401|403, ...)`. The route response body should be byte-identical (per Step 4's transform).

**Add new tests** if a domain's existing coverage is thin. Each migrated method should have at least one success-path test and one failure-path test.

## Acceptance criteria

- [ ] `lib/bff/types.ts` extends `BffClient` with the 8 domains.
- [ ] `lib/bff/http.ts` has real `httpBff.{targetSources,projects,users,services,dashboard,dev,scan,taskAdmin}.*` impls; `post/put/del/getRaw` helpers added (no camelCase on POST/PUT/DELETE per I-3).
- [ ] `lib/bff/mock-adapter.ts` has real `mockBff.{...}.*` impls; mock-only auth checks preserved as `BffError` throws.
- [ ] `app/api/_lib/handler.ts` `withV1` recognizes `BffError` and produces ProblemDetails byte-identical to `transformLegacyError` output.
- [ ] All ~25 route handlers under Group A/C scope use `bff` not `client`; `as Shape` casts removed.
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm run test:run`, `npm run build` all pass.
- [ ] **I-1**: every `httpBff` method preserves the URL/method/query/body produced by the corresponding `bff-client.ts` entry. Codex (optional but recommended) verifies.
- [ ] **I-2**: `find app/integration/api/v1 -name "route.ts" | sort` is identical pre/post.
- [ ] **I-3**: route integration tests cover at least one success + one failure scenario per migrated method. All existing tests pass without fixture shape changes (any required change is logged with rationale).
- [ ] **I-4**: `withV1` ProblemDetails parity verified by a dedicated unit test comparing old (`NextResponse + transformLegacyError`) vs new (`BffError + new path`) outputs for the same status/code/message.

## Out of scope

- Cloud providers (aws/azure/gcp) — spec 03
- Confirm domain — spec 04
- Deleting `lib/api-client/*` — spec 05
- Renaming `Issue222*` — spec 05

## Open decisions

- **`dashboard.systemsExport` content type**: confirm during implementation (look at current behavior). Default to `getRaw + Response` passthrough if non-JSON.
- **mock-only auth tests**: list any tests that change behavior. Preserve unless the test itself was a smell.

## Dependencies

- After: `adr011-01` merged
- Parallel with: `adr011-03`, `adr011-04`
- Before: `adr011-05`

## Estimated effort

XL — but mechanical. ~40 methods × (httpBff + mockBff + route + test). Plan 10-14 hours. The `withV1` BffError handling (Step 4) is the most novel piece; once shipped, subsequent groups inherit it.

## /codex-review

Optional. Recommended only if the `withV1` BffError → ProblemDetails parity feels uncertain.

## PR title

`refactor(adr011): migrate simple/core domains to typed BffClient (Phase 3-5 for 8 domains)`
