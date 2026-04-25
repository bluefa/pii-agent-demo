# adr011-03 — Cloud providers: aws + azure + gcp (composite-route heavy)

## Context

Three cloud-provider domains:
- `aws` (5 methods) — no composite routes
- `azure` (8 methods) — **two composite routes**: `check-installation` and `installation-status` call DB + VM endpoints and merge via `buildV1Response`
- `gcp` (4 methods) — no composite routes

~17 methods, ~19 routes. Risk surface: the Azure DB+VM composition. Per ADR-011 B-1, composition stays in route handlers; `httpBff.azure.checkInstallation` and `httpBff.azure.vmCheckInstallation` are independent typed methods, the route merges them.

This spec depends on the `withV1` BffError handling shipped by spec 02 (or this spec, whichever merges first).

## Precondition

```
git fetch origin main
[ -f lib/bff/types/aws.ts ] || { echo "✗ adr011-01 not merged"; exit 1; }
[ -f lib/bff/types/azure.ts ] || { echo "✗ adr011-01 incomplete"; exit 1; }
# adr011-02 may or may not be merged — parallel allowed.
```

## Worktree

```
bash scripts/create-worktree.sh --topic adr011-03-cloud --prefix refactor
cd /Users/study/pii-agent-demo-adr011-03-cloud
```

## Required reading

1. `docs/adr/011-typed-bff-client-consolidation.md`
2. `docs/reports/sit-migration-prompts/adr011-README.md` §"What actually changes", §"Observable Behavior Invariants"
3. `docs/reports/api-client-pattern-review.md` §4.2.2 — composite route handling pattern under B-1
4. `lib/bff/types/{aws,azure,gcp}.ts`
5. `lib/api-client/bff-client.ts` — aws/azure/gcp sections
6. `lib/api-client/mock/{aws,azure,gcp}.ts`
7. **Composite source**: `app/integration/api/v1/azure/target-sources/[targetSourceId]/{check-installation,installation-status}/route.ts` (read full)
8. **Composite transform**: `app/integration/api/v1/azure/target-sources/[targetSourceId]/_lib/transform.ts` (read full)
9. **Composite tests**: `app/integration/api/v1/__tests__/azure-installation-status-route.test.ts`
10. AGENTS.md ADR-006 guard — Group B touches install flows; respect ADR-006 if it constrains anything

## Step 1 — Extend `BffClient` for cloud domains

Add `aws`, `azure`, `gcp` to `lib/bff/types.ts` per the typed shapes from spec 01's per-domain files. Casing rule per **I-3**: GET methods camelCase, POST/PUT/DELETE snake_case.

## Step 2 — Implement `httpBff` for cloud domains

If spec 02 hasn't merged yet, this spec adds the `post/put/del` helpers to `lib/bff/http.ts` first (no camelCase on non-GET methods). Otherwise reuse.

Then implement each method by copying paths verbatim from `bff-client.ts`. Notable:

- **`azure.checkInstallation` / `vmCheckInstallation`**: independent methods, no composition here. Route handler does the merge.
- **`azure.getScanApp`**: PR #253's missing-method case. Confirm typed shape matches BFF response (snake_case fields).
- **`aws.verifyTfRole`**: service-level (not target-source-level) endpoint at `/aws/verify-tf-role`.

## Step 3 — Implement `mockBff` for cloud domains

Port from `lib/api-client/mock/{aws,azure,gcp}.ts`. Cross-cutting decision #3: **preserve mock-only auth by default**. Convert authorize-failures to `BffError(401|403)` throws. This is critical for Azure since multiple tests assert these statuses.

For Azure mock data store: existing `mockData.getProjectByTargetSourceId` lookups stay. No store reorganization.

## Step 4 — `withV1` BffError handling (if not already shipped)

If spec 02 already merged and `app/api/_lib/handler.ts` recognizes `BffError`, skip this step. Otherwise implement it here per spec 02 §Step 4. Verify byte-identical ProblemDetails output to `transformLegacyError`.

## Step 5 — Migrate non-composite routes (most of cloud)

Standard pattern from spec 02 §Step 5. Replace `client.aws.getInstallationStatus` etc. with `bff.aws.getInstallationStatus`, drop `as Shape` casts.

## Step 6 — Migrate composite Azure routes

`check-installation/route.ts` (POST) and `installation-status/route.ts` (GET) currently:

```typescript
const response = await client.azure.checkInstallation(String(parsed.value));
if (!response.ok) return response;
const dbStatus = await response.json() as LegacyInstallationStatus;

let vmStatus: LegacyVmInstallationStatus | null = null;
try {
  const vmResponse = await client.azure.vmCheckInstallation(String(parsed.value));
  if (vmResponse.ok) vmStatus = await vmResponse.json() as LegacyVmInstallationStatus;
} catch { /* silent */ }

return NextResponse.json(buildV1Response(dbStatus, vmStatus));
```

After:

```typescript
const dbStatus = await bff.azure.checkInstallation(parsed.value);  // typed, throws on error

let vmStatus: LegacyVmInstallationStatus | null = null;
try {
  vmStatus = await bff.azure.vmCheckInstallation(parsed.value);
} catch (e) {
  if (!(e instanceof BffError)) throw e;
  console.warn(`[azure check-installation] vm check failed: ${e.code}`);  // explicit, fixes anti-pattern F2
}

return NextResponse.json(buildV1Response(dbStatus, vmStatus));
```

The VM-failure tolerance is preserved. Adding the explicit `instanceof BffError` check + warning log fixes the silent-catch anti-pattern (F2) without changing observable behavior — non-BffError exceptions still propagate.

`_lib/transform.ts` (`buildV1Response`, `LegacyInstallationStatus`, `LegacyVmInstallationStatus`) **stays in route layer**.

## Step 7 — Tests

Update Azure composite-route tests:

```diff
-vi.mocked(client.azure.getInstallationStatus).mockResolvedValue(NextResponse.json(dbFixture));
-vi.mocked(client.azure.vmGetInstallationStatus).mockResolvedValue(NextResponse.json(vmFixture));
+vi.mocked(bff.azure.getInstallationStatus).mockResolvedValue(dbFixture);
+vi.mocked(bff.azure.vmGetInstallationStatus).mockResolvedValue(vmFixture);
```

VM-failure scenario:

```diff
-vi.mocked(client.azure.vmGetInstallationStatus).mockResolvedValue(NextResponse.json({error:'X'}, {status:500}));
+vi.mocked(bff.azure.vmGetInstallationStatus).mockRejectedValue(new BffError(500, 'VM_UNAVAILABLE', 'X'));
```

Verify the route still returns DB-only status when VM call rejects. Add a test for the new explicit warning log if you want stronger coverage.

## Acceptance criteria

- [ ] `BffClient` extended with `aws`, `azure`, `gcp`.
- [ ] `httpBff.{aws,azure,gcp}.*` all real impls.
- [ ] `mockBff.{aws,azure,gcp}.*` all real impls; mock-only auth preserved as `BffError` throws.
- [ ] All ~19 cloud route handlers use `bff` not `client`; `as Legacy*` casts removed.
- [ ] Azure composite routes preserve VM-failure tolerance with explicit `BffError instanceof` check + warning log.
- [ ] `_lib/transform.ts` is unchanged (other than removing now-unused exports if they moved entirely to `lib/bff/types/azure.ts`).
- [ ] If spec 02 hasn't merged: `withV1` BffError handling implemented here.
- [ ] `npx tsc/lint/test/build` all pass.
- [ ] **I-1, I-2, I-3, I-4**: paths preserved, route files unmoved, integration tests cover success + failure paths for every migrated method, ProblemDetails parity verified.

## Out of scope

- `services/[serviceCode]/settings/{aws,azure}/*` — that's `services` domain (spec 02)
- Confirm flow — spec 04
- Deleting `lib/api-client/{aws,azure,gcp}.ts` — spec 05

## Open decisions

- **`getScanApp` casing**: per PR #253, current mock returns snake_case. Verify spec 01's `lib/bff/types/azure.ts` declares snake_case for `getScanApp` (it's a GET, but the BFF response is snake_case — exception to the GET-camelCase rule because `proxyGet`'s camelCase only happens *after* fetch; if upstream BFF returns camelCase already, `camelCaseKeys` is a no-op). Confirm during implementation.

## Dependencies

- After: `adr011-01` merged
- Parallel with: `adr011-02`, `adr011-04`
- Before: `adr011-05`

## Estimated effort

Large. 17 methods + 19 routes + 2 composite handlers. Plan 8-12 hours. Composite routes are the only real risk — budget extra time for smoke comparison there.

## /codex-review

**Mandatory** before merge. Composite-route changes are exactly where Codex catches subtle behavior shifts.

## PR title

`refactor(adr011): migrate cloud providers (aws + azure composite + gcp) to typed BffClient`
