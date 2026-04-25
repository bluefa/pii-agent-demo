# adr011-05 — Group C: services + dashboard + dev + scan + taskAdmin (Phase 3+4+5)

## Context

Group C bundles five smaller, mostly orthogonal domains:

- `services` (7 methods across `permissions`, `projects`, `settings.aws`, `settings.azure`)
- `dashboard` (3 methods): summary, systems, systemsExport
- `dev` (2 methods): getUsers, switchUser (developer auth-switching)
- `scan` (4 methods): get, getHistory, create, getStatus
- `taskAdmin` (1 method): getApprovalRequestQueue

Routes (~11 total): admin dashboard, services authorized-users / settings, scan history/status, task-admin queue board, dev user switching.

Most routes are simple `client.x.y()` → `NextResponse.json(await response.json())` pass-through. The notable exception is `dashboard.systemsExport` which streams a CSV/file response (verify in inventory).

This spec is the lightest in Group A/B/C/D. Use it as the template-confirming spec — if patterns from spec 03/04 don't fit cleanly here, surface the mismatch.

## Precondition

```
git fetch origin main
[ -f lib/bff/types/services.ts ] || { echo "✗ adr011-02 not merged"; exit 1; }
grep -q "scan: {" lib/bff/types.ts || { echo "✗ BffClient missing scan"; exit 1; }
```

## Worktree

```
bash scripts/create-worktree.sh --topic adr011-05-group-c --prefix refactor
cd /Users/study/pii-agent-demo-adr011-05-group-c
```

## Required reading

1. `docs/adr/011-typed-bff-client-consolidation.md`
2. `docs/reports/sit-migration-prompts/adr011-method-inventory.md` — Group C rows
3. `docs/reports/sit-migration-prompts/adr011-README.md` §"Cross-cutting decisions"
4. `docs/reports/sit-migration-prompts/adr011-03-group-a-foundation.md` — same pattern, slightly different domains
5. `lib/bff/types.ts` + `lib/bff/types/{services,dashboard,dev,scan,task-admin}.ts`
6. `lib/api-client/bff-client.ts` — Group C sections
7. `lib/api-client/mock/{services,dashboard,dev,scan,queue-board}.ts`
8. Route handlers:
   - `admin/dashboard/{summary,systems,systems/export}/route.ts`
   - `services/[serviceCode]/{authorized-users,authorized-users/[userId],projects,settings/{aws,azure},settings/aws/verify-scan-role}/route.ts`
   - `task-admin/approval-requests/route.ts`
   - `dev/switch-user/route.ts`
   - `target-sources/[targetSourceId]/{scan,scanJob/latest,scan/history,scans/[scanId]}/route.ts`

## Step 1 — Implement `httpBff` for Group C

Same pattern as specs 03/04. Notable details:

### `dashboard.systemsExport`

Returns a file (CSV or similar) — current `bffClient` uses `proxyGet` which assumes JSON response. Verify the actual content type. If non-JSON:

- Add a `getRaw(path): Promise<Response>` helper to `lib/bff/http.ts`
- `httpBff.dashboard.systemsExport` returns `Promise<Response>` (or a typed wrapper like `{ blob: Blob; filename: string }`)
- Route handler streams the response back

If the inventory says it's JSON after all, ignore — standard `get<T>` works.

### `taskAdmin.getApprovalRequestQueue`

Takes a typed `QueueBoardQueryParams` (already exists in `lib/types/queue-board.ts`). Use it directly.

### `services.permissions.list/add/remove`

Path includes `serviceCode` (string). No id-normalization concern since serviceCode is naturally a string.

### `dev.switchUser`

Mock-only behavior in production, but the path exists in BFF too. Follow the same migration pattern.

## Step 2 — Implement `mockBff` for Group C

Cross-cutting decision #3: drop mock-only `authorize()`. For Group C this affects:

- `mockClient.services.*` — removes service-code permission check (BFF will do it)
- `mockClient.dashboard.*` — removes admin role check
- `mockClient.dev.*` — keep auth-switching logic since it's the *purpose* of these endpoints

For `mockBff.scan.create`: if the existing mock had idempotency or rate-limit logic, decide whether to keep (production-like) or drop (auth-only). Recommendation: keep idempotency, drop auth.

## Step 3 — Migrate route handlers

11 routes, all standard pattern from spec 03 Step 3. Notable handler-level concerns:

### `admin/dashboard/systems/export/route.ts`

If `dashboard.systemsExport` returns `Response` (Step 1), route is:

```typescript
export const GET = withV1(async (request) => {
  const params = new URL(request.url).searchParams;
  const upstream = await bff.dashboard.systemsExport(params);
  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: upstream.headers,
  });
});
```

If JSON, standard pattern.

### `services/[serviceCode]/authorized-users/[userId]/route.ts` (DELETE)

DELETE handler — return appropriate 204 No Content if BffClient method returns void.

### `target-sources/[targetSourceId]/scans/[scanId]/route.ts`

Has two path params. Pass both as numbers to `bff.scan.get(targetSourceId, scanId)`.

## Step 4 — Tests

Standard test fixture rewrites per spec 03 Step 5. Group C tests are mostly under `app/integration/api/v1/__tests__/`. Notable:

- `dashboard-summary-route.test.ts`, `dashboard-systems-route.test.ts` if they exist — straight rewrites.
- `services-route.test.ts` — drop authorize-failure scenarios.

## Step 5 — Smoke tests

```bash
USE_MOCK_DATA=true npm run dev
curl -s http://localhost:3001/integration/api/v1/admin/dashboard/summary | jq .
curl -s 'http://localhost:3001/integration/api/v1/admin/dashboard/systems?page=0&size=10' | jq .
curl -s http://localhost:3001/integration/api/v1/task-admin/approval-requests?status=PENDING | jq .
curl -s http://localhost:3001/integration/api/v1/services/SERVICE-A/authorized-users | jq .
curl -s http://localhost:3001/integration/api/v1/target-sources/1003/scanJob/latest | jq .
```

## Acceptance criteria

- [ ] `httpBff.{services,dashboard,dev,scan,taskAdmin}.*` all real (no `NOT_IMPLEMENTED`).
- [ ] `mockBff.{services,dashboard,dev,scan,taskAdmin}.*` all real.
- [ ] All route handlers under Group C scope use `bff` not `client`.
- [ ] `dashboard.systemsExport` streams correctly (verify content type matches pre-PR).
- [ ] Standard `tsc/lint/test/build` pass.
- [ ] **I-1, I-2, I-3, I-4 invariants** (`adr011-README.md` §"Observable Behavior Invariants") all pass:
  - I-1: `httpBff.{services,dashboard,dev,scan,taskAdmin}` paths byte-for-byte equal to current `bff-client.ts`.
  - I-2: route file layout unchanged.
  - I-3: smoke framework — `admin/dashboard/{summary,systems}`, `services/{code}/{authorized-users,projects,settings/aws,settings/azure}`, `task-admin/approval-requests`, `target-sources/{id}/{scan,scanJob/latest,scan/history}` — zero diff.
  - I-4: error paths preserved.
- [ ] If `dashboard.systemsExport` is non-JSON, the `Content-Type` and body bytes match pre-PR exactly.

## Out of scope

- Issue222 namespace cleanup — spec 07
- ESLint enforcement — spec 07

## Open decisions

- **`dashboard.systemsExport` content type**: confirm in inventory (spec 01). Adjust this spec accordingly during implementation. If the contract is unclear, default to `getRaw` + `Response` passthrough — preserves current behavior.

## Dependencies

- After: `adr011-02` merged
- Parallel with: `adr011-03`, `adr011-04`, `adr011-06`
- Before: `adr011-07`
- Coordinates with: if `withV1` BffError handling hasn't shipped via spec 03/04, ship it here.

## Estimated effort

Large. 17 methods × (httpBff + mockBff + route + test) but each domain is simpler than Group A or B. Plan 6-8 hours.

## /codex-review

Recommended (not mandatory) — Group C is the most mechanical of the four parallel groups.

## PR title

`refactor(adr011): migrate Group C (services + dashboard + dev + scan + taskAdmin) to typed BffClient`
