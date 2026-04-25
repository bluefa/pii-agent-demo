# adr011-06 — Group D: confirm domain (Phase 3+4+5, Issue #222 surface)

## Context

Group D is the `confirm` domain — 15 methods, ~11 routes, and the **largest concentration of Issue #222 friction** in the codebase. This spec migrates the most complex group.

Methods:
- `getResources` — special wrapper currently uses `proxyResourceCatalogGet` + `extractResourceCatalog`
- `createApprovalRequest`, `approveApprovalRequest`, `rejectApprovalRequest`, `cancelApprovalRequest`
- `getConfirmedIntegration` — special wrapper `proxyConfirmedIntegrationGet` + `extractConfirmedIntegration`
- `getApprovedIntegration`, `getApprovalHistory`, `getApprovalRequestLatest`
- `getProcessStatus`
- `confirmInstallation`, `updateResourceCredential`, `testConnection`, `getTestConnectionResults`, `getTestConnectionLatest`

Issue #222 ties:
- `lib/issue-222-approval.ts` (529 lines) — defensive normalization, called from BOTH route handlers AND `app/lib/api/index.ts`. Per the redundancy analysis (analysis report §"Category A"), ~410 of these lines disappear under B-1 once mockBff and httpBff share typed contracts.
- `app/lib/api/index.ts` — ~60 lines of normalize call sites in approval-related helpers (Cat A).
- 5 route handlers under `target-sources/[targetSourceId]/approval-*` and `confirmed-integration/`, `approved-integration/`, `process-status/` each have 5-7 normalize call sites.

This spec deletes the route handler-side normalize calls and reduces the `app/lib/api/index.ts` reliance, BUT does NOT delete `lib/issue-222-approval.ts` itself (spec 07 does that, after all consumers are gone).

## Precondition

```
git fetch origin main
[ -f lib/bff/types/confirm.ts ] || { echo "✗ adr011-02 not merged"; exit 1; }
grep -q "confirm: {" lib/bff/types.ts || { echo "✗ BffClient missing confirm"; exit 1; }
[ -f lib/issue-222-approval.ts ] || { echo "✗ Issue222 helpers missing — already cleaned up?"; exit 1; }
```

## Worktree

```
bash scripts/create-worktree.sh --topic adr011-06-group-d --prefix refactor
cd /Users/study/pii-agent-demo-adr011-06-group-d
```

## Required reading

1. `docs/adr/011-typed-bff-client-consolidation.md` — full
2. `docs/reports/api-client-pattern-review.md` §2.2 (Issue #222 PRs), §"Category A" redundancy analysis
3. `docs/reports/sit-migration-prompts/adr011-method-inventory.md` — Group D rows
4. `lib/bff/types/confirm.ts` (from spec 02 — should re-export Issue222\* types)
5. `lib/issue-222-approval.ts` — the 529-line normalize file (read fully)
6. `lib/confirmed-integration-response.ts` — `extractConfirmedIntegration`, `ConfirmedIntegrationResponsePayload`
7. `lib/resource-catalog-response.ts` — `extractResourceCatalog`, `ResourceCatalogResponsePayload`
8. `lib/api-client/bff-client.ts` — `confirm` section + `proxyConfirmedIntegrationGet`, `proxyResourceCatalogGet` wrappers
9. `lib/api-client/mock/confirm.ts` — current mock (large, ~600+ lines)
10. Route handlers (read all):
    - `target-sources/[targetSourceId]/approval-requests/route.ts` (POST + GET)
    - `target-sources/[targetSourceId]/approval-requests/{approve,reject,cancel,latest}/route.ts`
    - `target-sources/[targetSourceId]/approval-history/route.ts`
    - `target-sources/[targetSourceId]/approved-integration/route.ts`
    - `target-sources/[targetSourceId]/confirmed-integration/route.ts`
    - `target-sources/[targetSourceId]/process-status/route.ts`
    - `target-sources/[targetSourceId]/test-connection/route.ts` and related
    - `target-sources/[targetSourceId]/pii-agent-installation/confirm/route.ts`
    - `target-sources/[targetSourceId]/resources/credential/route.ts`
11. `app/lib/api/index.ts` — Issue #222 helper functions (`createApprovalRequest`, `getApprovedIntegration`, `getConfirmedIntegration`, `getApprovalHistory`, `getApprovalRequestLatest`, `getProcessStatus`, etc.)
12. `app/components/features/process-status/ProcessStatusCard.tsx` — confirm-flow consumer (verify no behavior shift)

## Step 1 — Implement `httpBff.confirm`

Standard pattern from spec 03, with two special wrappers:

### `getConfirmedIntegration`

Currently `proxyConfirmedIntegrationGet` calls the BFF, then runs `extractConfirmedIntegration(payload)` to handle envelope variance (`{confirmed_integration: {...}}` vs flat). Move that envelope handling **inside** `httpBff.confirm.getConfirmedIntegration`:

```typescript
getConfirmedIntegration: async (id) => {
  const data = await get<ConfirmedIntegrationResponsePayload>(`/target-sources/${id}/confirmed-integration`);
  return extractConfirmedIntegration(data);  // Cat B from analysis report
},
```

`extractConfirmedIntegration` and its helpers stay where they are (`lib/confirmed-integration-response.ts`) — only the import location changes (now inside `lib/bff/http.ts`).

### `getResources` (resource catalog)

Same pattern with `extractResourceCatalog` and `ResourceCatalogResponsePayload`.

### Other methods

For methods whose typed shape is `Issue222*`, the return type is `Promise<Issue222ApprovalRequestPayload>` etc., re-exported from `lib/bff/types/confirm.ts`. The httpBff impl calls `get`/`post` and returns the typed result. **No** runtime normalize via `normalizeIssue222*` inside httpBff — typed contract guarantees the shape (this is the whole point of B-1).

## Step 2 — Implement `mockBff.confirm`

Port `lib/api-client/mock/confirm.ts` logic into `mockBff.confirm`. Confirm domain has the most mock-side state in the codebase:

- `approvedIntegrationStore` (Map)
- `confirmedIntegrationSnapshotStore` (Map)
- `approvalTimestampStore` (Map)
- Auto-transition timers (`MOCK_APPLYING_DELAY_MS`, `MOCK_INSTALLATION_DELAY_MS`)
- Test-only helpers `_resetApprovedIntegrationStore`, `_fastForwardApproval`, `_setApprovedIntegration`

These stores and helpers **stay in their current location** (`lib/api-client/mock/confirm.ts`) and `mockBff.confirm` imports/uses them. The mock retains its production-like simulation behavior — only the surface changes from `Promise<NextResponse>` to `Promise<TypedShape>`.

`_reset*` test helpers are referenced from existing tests. Continue exporting them (with the `lib/api-client/mock/confirm.ts` file path) until spec 07 deletes the file. Spec 07 then moves them to a test-helpers location.

### Drop normalize-on-output

Current `mockClient.confirm.createApprovalRequest` constructs a NextResponse body that the route then re-normalizes. Under B-1, the mock returns a typed `Issue222ApprovalRequestPayload` directly — no normalize on the way out. **Verify** that mock fixtures already conform to the typed shape; if not, fix the fixture (not the type).

## Step 3 — Migrate route handlers

This is the highest-leverage step. Each route currently has a pattern like:

```typescript
// before — 5 layers of work in 50 lines
const rawBody = await request.json().catch(() => ({}));
const body = normalizeIssue222ApprovalRequestBody(rawBody);
const response = await client.confirm.createApprovalRequest(String(parsed.value), body);
if (!response.ok) return response;

const resourceInputs = Array.isArray(body.resource_inputs) ? body.resource_inputs : [];
// ... fallback computations ...

let fallbackStatus: 'PENDING' | 'AUTO_APPROVED' = 'PENDING';
const statusResponse = await client.confirm.getProcessStatus(String(parsed.value));
if (statusResponse.ok) {
  const issueStatus = normalizeIssue222ProcessStatusResponse(await statusResponse.json(), {
    target_source_id: parsed.value,
  });
  if (issueStatus.process_status === 'CONFIRMING') fallbackStatus = 'AUTO_APPROVED';
}

const payload = normalizeIssue222ApprovalRequestSummary(await response.json(), {
  targetSourceId: parsed.value,
  fallbackStatus,
  fallbackTotalCount: resourceTotalCount,
  fallbackSelectedCount: resourceSelectedCount,
});
return NextResponse.json(payload, { status: 200 });
```

After:

```typescript
// after — typed bff returns ready-to-respond payload
const rawBody = await request.json().catch(() => ({}));
const body = normalizeIssue222ApprovalRequestBody(rawBody);  // input normalize stays for now (request-side defensive)

const payload = await bff.confirm.createApprovalRequest(parsed.value, body);

// Fallback computation: only needed if BFF doesn't already populate these fields.
// Verify by inspecting the typed Issue222ApprovalRequestPayload.
const enriched = enrichApprovalRequestPayload(payload, {
  targetSourceId: parsed.value,
  fallbackStatus: await deriveFallbackStatus(parsed.value),
  fallbackTotalCount: countSelected(body),
  fallbackSelectedCount: countAll(body),
});

return NextResponse.json(enriched, { status: 200 });
```

### Decide: keep `normalizeIssue222*` or remove?

For each route, classify each `normalizeIssue222*` call:

- **Input-side** (e.g. `normalizeIssue222ApprovalRequestBody(rawBody)` on `request.json()`): typed contract is between *BffClient → caller*, NOT *caller → request*. Request body comes from the browser and is genuinely `unknown`. Keep input-side normalize.
- **Output-side** (e.g. `normalizeIssue222ApprovalRequestSummary(await response.json(), {...})`): under B-1, `bff.confirm.createApprovalRequest` returns the typed payload. The defensive normalize is redundant — REMOVE.
- **Fallback enrichment** (e.g. computing `fallbackStatus` from process-status): keep but rewrite without `normalizeIssue222ProcessStatusResponse` (use the typed `bff.confirm.getProcessStatus(id)` result directly).

After this step, the route handler should be ~50% shorter and have zero `normalizeIssue222*` calls on output.

## Step 4 — Update `app/lib/api/index.ts`

Approximately 60 lines of normalize calls in CSR helpers (per Category A from analysis report). For each Issue222 helper function in `app/lib/api/index.ts`:

```typescript
// before
export const getApprovedIntegration = async (id, opts) => {
  const payload = normalizeIssue222ApprovedIntegration(
    await fetchInfraJson<unknown>(`${CONFIRM_BASE}/${id}/approved-integration`, ...),
  );
  return { /* mapping to ApprovedIntegrationResponse */ };
};

// after
export const getApprovedIntegration = async (id, opts) => {
  const payload = await fetchInfraJson<Issue222ApprovedIntegration>(`${CONFIRM_BASE}/${id}/approved-integration`, ...);
  return { /* same mapping to ApprovedIntegrationResponse */ };
};
```

The `fetchInfraJson` call now declares the typed shape directly. The route returns this shape (per Step 3). The `normalizeIssue222*` call disappears.

⚠️ **The mapping logic (`{ approved_integration: { id: String(...), ... } }`) STAYS** — that's domain mapping (Cat D), not defensive normalize. Same for `toEndpointConfigSnapshot`, `toApprovedIntegrationResourceSnapshot`, etc.

## Step 5 — Tests

This is the heaviest test rewrite of all groups. Approval flow has the largest test surface.

### Route handler tests

`approval-requests-latest-route.test.ts`, `approved-integration-route.test.ts`, etc.:

```typescript
// before
vi.mocked(client.confirm.getApprovedIntegration).mockResolvedValue(NextResponse.json(rawFixture));

// after
vi.mocked(bff.confirm.getApprovedIntegration).mockResolvedValue(typedFixture);
```

Fixtures may need shape updates if they were producing pre-normalize raw shapes (e.g. snake_case missing fields).

### app-lib-api tests

`lib/__tests__/app-lib-api-index.test.ts` already exists and is large. Update mocks for `fetchInfraJson` to return typed shapes directly instead of raw shapes.

### Mock-confirm tests

`lib/__tests__/mock-confirm-process-status.test.ts` — verify `mockBff.confirm.getProcessStatus` returns the typed payload directly.

## Step 6 — Smoke tests

```bash
USE_MOCK_DATA=true npm run dev

curl -s -XPOST http://localhost:3001/integration/api/v1/target-sources/1005/approval-requests \
  -H "content-type: application/json" \
  -d '{"resource_inputs":[{"resource_id":"res-1","selected":true}]}' | jq .

curl -s http://localhost:3001/integration/api/v1/target-sources/1005/approval-requests/latest | jq .
curl -s 'http://localhost:3001/integration/api/v1/target-sources/1005/approval-history?page=0&size=5' | jq .
curl -s http://localhost:3001/integration/api/v1/target-sources/1005/approved-integration | jq .
curl -s http://localhost:3001/integration/api/v1/target-sources/1005/confirmed-integration | jq .
curl -s http://localhost:3001/integration/api/v1/target-sources/1005/process-status | jq .
curl -s http://localhost:3001/integration/api/v1/target-sources/1005/test-connection/latest | jq .
```

Compare each output to pre-PR (use a separate worktree on origin/main). All field names and values must match exactly.

## Acceptance criteria

- [ ] `httpBff.confirm.*` all real (no `NOT_IMPLEMENTED`); `extractConfirmedIntegration`, `extractResourceCatalog` called inside the relevant httpBff methods.
- [ ] `mockBff.confirm.*` all real; mock stores (`approvedIntegrationStore`, etc.) preserved.
- [ ] Test-only helpers (`_resetApprovedIntegrationStore`, `_fastForwardApproval`, `_setApprovedIntegration`) still exported and used by tests.
- [ ] All Group D route handlers use `bff.confirm.*`.
- [ ] All output-side `normalizeIssue222*` calls removed from route handlers.
- [ ] `app/lib/api/index.ts` Issue222 helper functions use typed `fetchInfraJson<Issue222*>` and drop output-side normalize calls.
- [ ] Domain mapping logic (`{ approved_integration: { id: String(...) } }` etc.) preserved.
- [ ] `lib/issue-222-approval.ts` is **NOT deleted** in this PR — only its consumers shrink. Spec 07 deletes the file.
- [ ] `lib/confirmed-integration-response.ts`, `lib/resource-catalog-response.ts` **NOT moved** — only their import location changes.
- [ ] `npx tsc/lint/test/build` all pass.
- [ ] All smoke test outputs match pre-PR exactly.

## Out of scope

- Deleting `lib/issue-222-approval.ts` (spec 07)
- Renaming `Issue222*` types to clean domain names (spec 07)
- Renaming `docs/swagger/issue-222-client.yaml` (spec 07)

## Open decisions

- **Input-side normalize retention**: `normalizeIssue222ApprovalRequestBody` stays per Step 3 reasoning. Document in PR description.
- **`fallbackStatus` derivation logic**: current routes call `client.confirm.getProcessStatus()` to compute fallback. Verify whether the typed `bff.confirm.createApprovalRequest` return already populates this — if so, drop the second call entirely (saves a roundtrip).

## Dependencies

- After: `adr011-02` merged
- Parallel with: `adr011-03`, `adr011-04`, `adr011-05`
- Before: `adr011-07`

## Estimated effort

XL — the largest spec. 15 methods × (httpBff + mockBff + multiple route handlers + multiple test fixtures + app/lib/api updates) plus the Issue #222 friction surface. Plan 12-16 hours. Treat the smoke-test parity (Step 6) as the merge gate.

## /codex-review

**Mandatory** before merge. Three focuses:
1. Each `normalizeIssue222*` removal is genuinely safe (output is typed, not raw).
2. `extractConfirmedIntegration` envelope-variance handling preserved.
3. Mock store auto-transition timers still fire correctly under the new typed return.

## PR title

`refactor(adr011): migrate Group D (confirm domain — Issue #222 surface) to typed BffClient`
