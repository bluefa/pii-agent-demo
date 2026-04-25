# adr011-04 — Confirm domain migration (preserve normalize)

## Context

Migrate the `confirm` domain — 15 methods, ~11 routes, the most entangled with Issue #222 friction. Per Codex over-engineering review, this spec **only migrates** `client.confirm.*` to `bff.confirm.*` and **preserves all current `normalizeIssue222*` behavior**. Removing the defensive normalize layer is deferred to a separate follow-up — bundling it with the migration maximizes I-3 (response shape) risk in the highest-stakes domain.

In-scope:
- Extend `BffClient` with the `confirm` domain
- Implement `httpBff.confirm.*` (special wrappers like `proxyConfirmedIntegrationGet` move into the typed methods — Cat B from analysis report)
- Implement `mockBff.confirm.*` preserving stores and timers
- Migrate route handlers to `bff.confirm.*` with **all current normalize calls intact**

Out-of-scope (deferred):
- Removing output-side `normalizeIssue222*` calls from route handlers
- Removing normalize calls from `app/lib/api/index.ts`
- Deleting `lib/issue-222-approval.ts`
- Renaming `Issue222*` types

## Precondition

```
git fetch origin main
[ -f lib/bff/types/confirm.ts ] || { echo "✗ adr011-01 not merged"; exit 1; }
[ -f lib/issue-222-approval.ts ] || { echo "✗ Issue222 helpers missing"; exit 1; }
```

## Worktree

```
bash scripts/create-worktree.sh --topic adr011-04-confirm --prefix refactor
cd /Users/study/pii-agent-demo-adr011-04-confirm
```

## Required reading

1. `docs/adr/011-typed-bff-client-consolidation.md`
2. `docs/reports/sit-migration-prompts/adr011-README.md` §"Cross-cutting decisions" #6 — normalize cleanup deferred
3. `lib/bff/types/confirm.ts` (re-exports from `lib/issue-222-approval.ts`)
4. `lib/issue-222-approval.ts` — defensive normalize functions; **stays in this PR**
5. `lib/confirmed-integration-response.ts` — `extractConfirmedIntegration`, `ConfirmedIntegrationResponsePayload`
6. `lib/resource-catalog-response.ts` — `extractResourceCatalog`, `ResourceCatalogResponsePayload`
7. `lib/api-client/bff-client.ts` — `confirm` section + `proxyConfirmedIntegrationGet`, `proxyResourceCatalogGet` wrappers
8. `lib/api-client/mock/confirm.ts` — current mock (preserve stores)
9. Route handlers under `app/integration/api/v1/target-sources/[targetSourceId]/`:
   - `approval-requests/route.ts` (POST + GET)
   - `approval-requests/{approve,reject,cancel,latest}/route.ts`
   - `approval-history/route.ts`
   - `approved-integration/route.ts`
   - `confirmed-integration/route.ts`
   - `process-status/route.ts`
   - `test-connection/{route.ts,latest,results}`
   - `pii-agent-installation/confirm/route.ts`
   - `resources/credential/route.ts`
   - `resources/route.ts`

## Step 1 — Extend `BffClient` for confirm

Add `confirm` to `lib/bff/types.ts` with all 15 methods. Return types are the typed shapes from `lib/bff/types/confirm.ts` (re-exports from `lib/issue-222-approval.ts` per spec 01). Casing per **I-3**: GET methods camelCase, POST/PUT raw passthrough.

## Step 2 — Implement `httpBff.confirm`

Standard pattern. Two methods need extra care because of their special wrappers in current `bff-client.ts`:

### `getConfirmedIntegration`

Currently `proxyConfirmedIntegrationGet` calls BFF then runs `extractConfirmedIntegration(payload)` to handle envelope variance (`{confirmed_integration: {...}}` vs flat). Move that handling **inside** the typed method:

```typescript
getConfirmedIntegration: async (id) => {
  const data = await get<ConfirmedIntegrationResponsePayload>(`/target-sources/${id}/confirmed-integration`);
  return extractConfirmedIntegration(data);
},
```

`extractConfirmedIntegration` and helpers stay in `lib/confirmed-integration-response.ts` — only the import location changes.

### `getResources`

Same pattern with `extractResourceCatalog` and `ResourceCatalogResponsePayload`.

### Other 13 methods

Plain `get<T>/post<T>/put<T>` calls. Type returns match the `Issue222*` re-exports.

## Step 3 — Implement `mockBff.confirm`

Port logic from `lib/api-client/mock/confirm.ts` while **preserving all mock state**:

- `approvedIntegrationStore` (Map)
- `confirmedIntegrationSnapshotStore` (Map)
- `approvalTimestampStore` (Map)
- Auto-transition timers (`MOCK_APPLYING_DELAY_MS`, `MOCK_INSTALLATION_DELAY_MS`)
- Test-only helpers `_resetApprovedIntegrationStore`, `_fastForwardApproval`, `_setApprovedIntegration`

These stores and helpers **stay in `lib/api-client/mock/confirm.ts`** for now. `mockBff.confirm` imports them. Spec 05 cleanup decides whether to relocate the file.

Cross-cutting decision #3: preserve mock-only `authorize()` failures as `BffError(401|403)` throws. Tests asserting these statuses continue to work via `withV1`'s BffError → ProblemDetails mapping (from spec 02 or 03).

Drop the `NextResponse.json(...)` wrap — return typed data directly.

## Step 4 — Migrate route handlers (preserving normalize)

⛔ **Do NOT remove `normalizeIssue222*` calls in this PR.** That's a separate follow-up. The migration here is *narrowly* `client.x.y(...)` → `bff.x.y(...)` for transport, with all input-side and output-side normalization preserved.

Example — `approval-requests/route.ts` POST handler:

```diff
-import { client } from '@/lib/api-client';
+import { bff } from '@/lib/bff/client';
 import { normalizeIssue222ApprovalRequestBody, normalizeIssue222ApprovalRequestSummary, normalizeIssue222ProcessStatusResponse } from '@/lib/issue-222-approval';

 export const POST = withV1(async (request, { requestId, params }) => {
   const parsed = parseTargetSourceId(params.targetSourceId, requestId);
   if (!parsed.ok) return problemResponse(parsed.problem);

   const rawBody = await request.json().catch(() => ({}));
   const body = normalizeIssue222ApprovalRequestBody(rawBody);                            // ← preserved
-  const response = await client.confirm.createApprovalRequest(String(parsed.value), body);
-  if (!response.ok) return response;
+  const payload = await bff.confirm.createApprovalRequest(parsed.value, body);            // ← typed return

   const resourceInputs = Array.isArray(body.resource_inputs) ? body.resource_inputs : []; // ← preserved
   const resourceTotalCount = resourceInputs.length;
   const resourceSelectedCount = resourceInputs.filter(/* ... */).length;

   let fallbackStatus: 'PENDING' | 'AUTO_APPROVED' = 'PENDING';
-  const statusResponse = await client.confirm.getProcessStatus(String(parsed.value));
-  if (statusResponse.ok) {
-    const issueStatus = normalizeIssue222ProcessStatusResponse(await statusResponse.json(), { target_source_id: parsed.value });
-    if (issueStatus.process_status === 'CONFIRMING') fallbackStatus = 'AUTO_APPROVED';
-  }
+  try {
+    const issueStatus = normalizeIssue222ProcessStatusResponse(
+      await bff.confirm.getProcessStatus(parsed.value),
+      { target_source_id: parsed.value },
+    );
+    if (issueStatus.process_status === 'CONFIRMING') fallbackStatus = 'AUTO_APPROVED';
+  } catch (e) {
+    if (!(e instanceof BffError)) throw e;
+    // best-effort fallback derivation; preserve existing if-not-ok-skip behavior
+  }

-  const finalPayload = normalizeIssue222ApprovalRequestSummary(await response.json(), {
+  const finalPayload = normalizeIssue222ApprovalRequestSummary(payload, {                  // ← normalize preserved
     targetSourceId: parsed.value,
     fallbackStatus,
     fallbackTotalCount: resourceTotalCount,
     fallbackSelectedCount: resourceSelectedCount,
   });

   return NextResponse.json(finalPayload, { status: 200 });
 });
```

Every `normalizeIssue222*` call is preserved. The only changes are:
- import `bff` instead of `client`
- typed return from `bff.confirm.*` (no `as` cast, no `if (!response.ok) return response`)
- `BffError instanceof` check for the optional-call (process-status fallback) to preserve "skip on failure" semantics

Apply this pattern to all ~11 confirm route handlers.

## Step 5 — `app/lib/api/index.ts` is NOT modified

Confirm-domain helpers in `app/lib/api/index.ts` continue to call `fetchInfraJson` and apply `normalizeIssue222*`. They are unaffected — the route's response wire shape is unchanged (per **I-3**).

## Step 6 — Update route tests

Standard rewrites:

```diff
-vi.mocked(client.confirm.createApprovalRequest).mockResolvedValue(NextResponse.json(rawFixture));
+vi.mocked(bff.confirm.createApprovalRequest).mockResolvedValue(typedFixture);
```

Fixtures should match the typed shape from `lib/bff/types/confirm.ts` (i.e. the `Issue222*` types). If the existing fixture was already producing snake_case BFF-shaped data (likely, since current tests mock `proxyPost` raw passthrough), it should work without modification.

For failure paths: replace `NextResponse.json(...,{status:404})` with `new BffError(404, 'NOT_FOUND', '...')`.

For mock store tests (`mock-confirm-process-status.test.ts`): verify `mockBff.confirm.getProcessStatus(id)` returns the typed payload directly. Test-only helpers (`_resetApprovedIntegrationStore` etc.) imports may need the path updated if the file moved (it shouldn't have in this spec).

## Acceptance criteria

- [ ] `BffClient` extended with `confirm`.
- [ ] `httpBff.confirm.*` all real; `extractConfirmedIntegration`/`extractResourceCatalog` called inside the relevant methods.
- [ ] `mockBff.confirm.*` all real; mock stores + timers preserved; auto-transition behavior unchanged.
- [ ] Test-only helpers (`_reset*`, `_fastForward*`, `_setApprovedIntegration`) still exported and usable from tests.
- [ ] All ~11 confirm route handlers use `bff.confirm.*`.
- [ ] **All `normalizeIssue222*` calls in route handlers and `app/lib/api/index.ts` are PRESERVED** (this is a hard rule — verify by grep `rg "normalizeIssue222"` showing same count pre/post in those files).
- [ ] `lib/issue-222-approval.ts` is **unchanged**.
- [ ] `lib/confirmed-integration-response.ts`, `lib/resource-catalog-response.ts` are **unchanged** (only their import location changes).
- [ ] `npx tsc/lint/test/build` all pass.
- [ ] **I-1, I-2, I-3, I-4** all hold. Run integration tests covering at least:
  - `POST /target-sources/{id}/approval-requests` success path
  - `GET /target-sources/{id}/approval-history` success path
  - `GET /target-sources/{id}/confirmed-integration` envelope-variant + flat shapes
  - `GET /target-sources/{id}/process-status` after auto-transition delay
  - One 404 path (e.g. cancel on missing approval-request)

## Out of scope

- Removing any `normalizeIssue222*` call (separate follow-up after spec 05)
- Deleting `lib/issue-222-approval.ts` (spec 05 optional appendix)
- Renaming `Issue222*` (spec 05 optional appendix)
- Touching `app/lib/api/index.ts` (separate follow-up)

## Open decisions

- **mock-only `authorize()` in confirm**: preserve. Several confirm tests likely depend on it (approval needing service permissions, etc.).

## Dependencies

- After: `adr011-01` merged
- Parallel with: `adr011-02`, `adr011-03`
- Before: `adr011-05`
- Coordinates with: `withV1` BffError handling — first of {02, 03, 04} to merge ships it.

## Estimated effort

Large. 15 methods × (httpBff + mockBff + route + test) but each is mechanical because *no normalize is removed*. Plan 8-10 hours. The risk-reduction from deferring normalize cleanup is the entire point — don't be tempted to "clean up while we're here".

## /codex-review

**Mandatory** before merge. Two focuses:
1. Every `normalizeIssue222*` call is genuinely preserved (zero removed).
2. `extractConfirmedIntegration` envelope-variance handling preserved inside `httpBff.confirm.getConfirmedIntegration`.

## PR title

`refactor(adr011): migrate confirm domain to typed BffClient (preserve normalize layer)`
