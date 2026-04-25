# adr011-03 — Group A: targetSources + projects + users (Phase 3+4+5)

## Context

Group A covers three foundation domains that drive the project lifecycle and user bootstrap:

- `targetSources` (3 methods): list/get/create
- `projects` (16 methods): get, delete, create, approve, reject, confirmTargets, completeInstallation, confirmCompletion, credentials, history, resourceCredential, resourceExclusions, resources, scan, terraformStatus, testConnection
- `users` (4 methods): search, getMe, getServices, getServicesPage

This spec implements `httpBff.<domain>` + `mockBff.<domain>` for these three domains and migrates the corresponding route handlers from `client.method()` to `bff.method()`. The route handler v1 transforms (e.g. `extractTargetSource`) stay in the route per ADR-011 B-1.

## Precondition

```
git fetch origin main
[ -f lib/bff/types/target-sources.ts ] || { echo "✗ adr011-02 not merged"; exit 1; }
[ -f lib/bff/types/projects.ts ] || { echo "✗ adr011-02 incomplete"; exit 1; }
grep -q "targetSources: {" lib/bff/types.ts || { echo "✗ BffClient missing targetSources"; exit 1; }
```

## Worktree

```
bash scripts/create-worktree.sh --topic adr011-03-group-a --prefix refactor
cd /Users/study/pii-agent-demo-adr011-03-group-a
```

## Required reading

1. `docs/adr/011-typed-bff-client-consolidation.md` §"Migration Plan", §"Canonical contract variant"
2. `docs/reports/sit-migration-prompts/adr011-method-inventory.md` — Group A rows
3. `docs/reports/sit-migration-prompts/adr011-README.md` §"Cross-cutting decisions"
4. `lib/bff/types.ts` + `lib/bff/types/{target-sources,projects,users}.ts` — typed contracts
5. `lib/api-client/bff-client.ts` — current `targetSources`, `projects`, `users` sections (lines defining `proxyGet/Post/Put/Delete` calls and special wrappers)
6. `lib/api-client/mock/{target-sources,projects,users}.ts` — current mock impls
7. Route handlers under `app/integration/api/v1/`:
   - `target-sources/[targetSourceId]/route.ts` (GET/DELETE)
   - `target-sources/[targetSourceId]/{secrets,resources,terraform-status,scan,scanJob/latest,scan/history,history,test-connection}/route.ts`
   - `services/[serviceCode]/target-sources/route.ts`
   - `users/search/route.ts`, `user/me/route.ts`, `user/services/route.ts`, `user/services/page/route.ts`
   - Confirm/approval routes are NOT in Group A — they're Group D (spec 06). Same for cloud-provider-specific routes (Group B).

## Step 1 — Implement `httpBff` for Group A

For each method in Group A, replace the `NOT_IMPLEMENTED` stub in `lib/bff/http.ts` with a real implementation. Use the existing `httpBff.targetSources.get` as the pattern:

```typescript
targetSources: {
  list: async (serviceCode) => {
    const data = await get<unknown>(`/target-sources/services/${serviceCode}`);
    // existing extraction helper if any (check lib/api-client/bff-client.ts), else direct cast
    return data as ServicesTargetSourcesResponse;
  },
  get: async (id) => {
    const data = await get<TargetSourceDetailResponse>(`/target-sources/${id}`);
    return extractTargetSource(data);  // existing helper, moved import to lib/bff/http.ts
  },
  create: async (body) => {
    // current bff-client.ts has special path branching for serviceCode
    if (body.serviceCode) {
      const { serviceCode, ...rest } = body;
      return post<CreateTargetSourceResult>(`/target-sources/services/${serviceCode}/target-sources`, rest);
    }
    return post<CreateTargetSourceResult>('/target-sources', body);
  },
},
```

Required helpers in `lib/bff/http.ts`:

- `get<T>(path)`: already exists
- `post<T>(path, body)`, `put<T>(path, body)`, `del<T>(path)`: add following the same error-handling pattern as `get<T>`. All use `BffError` for non-2xx, `camelCaseKeys` for response normalization (matches current `proxyGet` behavior).

⚠️ **Preserve the current GET/POST asymmetry — DO NOT "fix" it in this migration**. Current `proxyGet` runs `camelCaseKeys`, but `proxyPost/Put` is raw passthrough. CSR-side helpers in `app/lib/api/index.ts` depend on this asymmetry — for example `createApprovalRequest` uses `fetchInfraJson<unknown>` (no camelCase) and then runs `normalizeIssue222ApprovalRequestSummary` on snake_case fields like `target_source_id`. Changing POST behavior to camelCase would silently break those normalizers.

Concretely:
- `httpBff.<x>.<y>` for GET methods: returns `camelCaseKeys(data)` — typed shape is camelCase. Matches current `proxyGet`.
- `httpBff.<x>.<y>` for POST/PUT/DELETE methods: returns raw passthrough — typed shape uses snake_case fields exactly as the upstream BFF returns. Matches current `proxyPost/Put/Delete`.

The typed shapes in `lib/bff/types/<domain>.ts` (defined in spec 02) MUST reflect this casing. If a POST shape was defined as camelCase in spec 02, fix it here to snake_case to preserve wire compatibility. Mock implementations (Step 2) must produce the same casing as their corresponding HTTP impl.

> The asymmetry itself is undesirable but resolving it requires auditing every CSR consumer. That's a separate ADR/PR after the typed-client migration completes.

## Step 2 — Implement `mockBff` for Group A

For each method, port `lib/api-client/mock/<domain>.ts` logic into `mockBff.<domain>`. Three rules:

1. **Drop the `NextResponse.json(...)` wrap** — `mockBff` returns typed data directly, throws `BffError` on failure.
2. **Drop the `authorize()` mock-only auth check** — BFF doesn't authenticate. If a route test relied on mock-side auth, factor it into a separate test helper. Update affected tests.
3. **Match the typed return shape exactly** — TypeScript will fail otherwise. Use the type imports from `lib/bff/types/<domain>.ts`.

Example port (`mock/projects.ts:get` → `mockBff.projects.get`):

```typescript
// before (NextResponse-typed)
get: async (projectId) => {
  const auth = await authorize(projectId);
  if (auth.error) return auth.error;
  return NextResponse.json({ project: auth.project });
}

// after (typed)
get: async (id) => {
  const project = mockData.getProjectByTargetSourceId(id);
  if (!project) throw new BffError(404, 'PROJECT_NOT_FOUND', `Project ${id} not found`);
  return project;  // typed Project shape
}
```

The old `lib/api-client/mock/<domain>.ts` files **stay untouched** in this PR — they remain operational for any route still pointing to `client.x.y()` after this PR (which should be none in Group A, but possibly in Groups B/C/D until those specs merge). Spec 07 deletes them.

## Step 3 — Migrate route handlers to `bff.method()`

For every route handler that calls `client.targetSources.*`, `client.projects.*`, or `client.users.*`, replace the call site:

```typescript
// before
const response = await client.projects.get(String(parsed.value));
if (!response.ok) return response;
const data = await response.json();
return NextResponse.json(extractTargetSource(data));

// after
const project = await bff.projects.get(parsed.value);  // typed, throws on error
return NextResponse.json(project);
```

Error handling: `withV1` already wraps the handler in try/catch. `BffError` thrown from `bff.x.y()` propagates to `withV1`'s `handleUnexpectedError` which produces a ProblemDetails response. Verify this matches the current `if (!response.ok) return response` behavior — if not, add explicit `try { ... } catch (e) { if (e instanceof BffError) return problemFromBff(e); throw e; }` or update `withV1` to recognize `BffError` (preferred — single update, no per-route changes).

### Imports

- Remove `import { client } from '@/lib/api-client'`
- Add `import { bff } from '@/lib/bff/client'`
- Drop `as SomeShape` casts that worked around `Promise<NextResponse>`

### Argument type adjustment

`bff` methods take `number` for ids (per spec 02 normalization). Routes currently do `String(parsed.value)`. Change to `parsed.value` directly (it's already a `number` from `parseTargetSourceId`).

## Step 4 — `withV1` BffError handling

Update `app/api/_lib/handler.ts` and `app/api/_lib/problem.ts` so that:

- A thrown `BffError` from inside the handler converts to a ProblemDetails response with the BFF's `code` and `status`.
- Other thrown errors continue to be `INTERNAL_ERROR` 500.

This is a single change that benefits all subsequent group migrations (specs 04, 05, 06).

## Step 5 — Update route tests

For each migrated route handler that has tests:

- Replace `vi.mocked(client.x.y).mockResolvedValue(NextResponse.json({...}))` with `vi.mocked(bff.x.y).mockResolvedValue({...})` — typed value, no NextResponse wrap.
- Replace failure mocks: `vi.mocked(client.x.y).mockResolvedValue(NextResponse.json({...}, {status:404}))` → `vi.mocked(bff.x.y).mockRejectedValue(new BffError(404, 'NOT_FOUND', '...'))`.
- Auth-related test scenarios: mock-only `authorize()` is gone, so tests checking 401/403 from authorize must be removed (those scenarios are not BffClient's contract) or relocated to integration tests.

## Acceptance criteria

- [ ] `httpBff.{targetSources,projects,users}.<method>` all have real implementations (no `NOT_IMPLEMENTED`).
- [ ] `mockBff.{targetSources,projects,users}.<method>` all have real implementations.
- [ ] Every route handler under Group A imports `bff` not `client`.
- [ ] Every route handler under Group A removes `as Shape` casts.
- [ ] `withV1` recognizes `BffError` and converts to ProblemDetails.
- [ ] `npx tsc --noEmit` passes.
- [ ] `npm run lint` passes.
- [ ] `npm run test:run` passes — including updated route tests.
- [ ] `npm run build` passes.
- [ ] `bash scripts/contract-check.sh --mode diff --base origin/main --head HEAD` passes.
- [ ] **I-1, I-2, I-3, I-4 invariants** (`adr011-README.md` §"Observable Behavior Invariants") all pass:
  - I-1: `httpBff` impl preserves every BFF URL/method/body byte-for-byte vs current `bff-client.ts`. Codex review confirms.
  - I-2: `find app/integration/api/v1 -name "route.ts" | sort` is identical before/after.
  - I-3: Smoke-test framework (README) for Group A endpoints — `target-sources/{id}`, `target-sources/{id}/secrets`, `target-sources/{id}/scan/history` (POST + GET), `services/{code}/target-sources`, `user/me`, `user/services`, `users/search` — produces zero `diff` output between baseline and current.
  - I-4: at least one error-path smoke (e.g. `target-sources/99999` for 404) produces identical ProblemDetails body.

## Out of scope

- Cloud provider domains (aws/azure/gcp) — spec 04
- Admin/utility (services, dashboard, dev, scan, taskAdmin) — spec 05
- Confirm domain — spec 06
- Deleting `lib/api-client/*` — spec 07
- Renaming `Issue222*` types — spec 07

## Open decisions (from `adr011-README.md` §"Cross-cutting decisions")

- mock-only `authorize()`: dropped, per cross-cutting decision #3. If any Group A test scenario depends on it, file a follow-up issue and skip-add the test for the migration window. Document each skipped test in this spec's PR description.

## Dependencies

- After: `adr011-02` merged
- Parallel with: `adr011-04`, `adr011-05`, `adr011-06`
- Before: `adr011-07`

## Estimated effort

XL. 23 methods × (httpBff impl + mockBff impl + route migration + test fixture rewrite). Plan 8-12 hours. The `withV1` BffError handling change (Step 4) is shared across all groups — get it right here so specs 04/05/06 don't need to redo it.

## /codex-review

Recommended (not mandatory). Focus on (a) consistent error mapping (`BffError` → ProblemDetails), (b) `camelCaseKeys` symmetry between `httpBff.post/put` and `mockBff.post/put` outputs.

## PR title

`refactor(adr011): migrate Group A (targetSources + projects + users) to typed BffClient`
