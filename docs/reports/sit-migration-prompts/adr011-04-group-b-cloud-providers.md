# adr011-04 — Group B: aws + azure + gcp (Phase 3+4+5, composite-route heavy)

## Context

Group B covers the three cloud-provider-specific domains:

- `aws` (5 methods): checkInstallation, setInstallationMode, getInstallationStatus, getTerraformScript, verifyTfRole
- `azure` (8 methods): checkInstallation, getInstallationStatus, getSettings, getSubnetGuide, getScanApp, vmCheckInstallation, vmGetInstallationStatus, vmGetTerraformScript
- `gcp` (4 methods): checkInstallation, getInstallationStatus, getScanServiceAccount, getTerraformServiceAccount

Routes (~19 across `aws/`, `azure/`, `gcp/` subtrees) include the **most complex compositions in the codebase**:

1. Azure `check-installation/route.ts` and `installation-status/route.ts` call BOTH `client.azure.checkInstallation()` and `client.azure.vmCheckInstallation()`, then merge the two responses through `buildV1Response(dbStatus, vmStatus)`. The VM call is best-effort — if it fails, route returns DB-only.
2. `_lib/transform.ts` defines `LegacyInstallationStatus`, `LegacyVmInstallationStatus` and `buildV1Response`. Per ADR-011 B-1, these stay in the route layer (NOT moved into `httpBff`).

This spec is the largest non-confirm group. Treat the composite handling as the main risk surface.

## Precondition

```
git fetch origin main
[ -f lib/bff/types/aws.ts ] || { echo "✗ adr011-02 not merged"; exit 1; }
[ -f lib/bff/types/azure.ts ] || { echo "✗ adr011-02 incomplete"; exit 1; }
grep -q "azure: {" lib/bff/types.ts || { echo "✗ BffClient missing azure"; exit 1; }
# adr011-03 may or may not be merged — Group B is parallel.
```

## Worktree

```
bash scripts/create-worktree.sh --topic adr011-04-group-b --prefix refactor
cd /Users/study/pii-agent-demo-adr011-04-group-b
```

## Required reading

1. `docs/adr/011-typed-bff-client-consolidation.md` §"Composite route processing" (4.2.2 of the analysis report it cites)
2. `docs/reports/api-client-pattern-review.md` §4.2.2 — composite route handling pattern
3. `docs/reports/sit-migration-prompts/adr011-method-inventory.md` — Group B rows; pay attention to the "Composite?" column
4. `lib/bff/types.ts` + `lib/bff/types/{aws,azure,gcp}.ts`
5. `lib/api-client/bff-client.ts` — `aws`, `azure`, `gcp` sections
6. `lib/api-client/mock/{aws,azure,gcp}.ts`
7. **Composite route source**: `app/integration/api/v1/azure/target-sources/[targetSourceId]/{check-installation,installation-status}/route.ts`
8. **Composite transform**: `app/integration/api/v1/azure/target-sources/[targetSourceId]/_lib/transform.ts` (full file)
9. **Composite test fixtures**: `app/integration/api/v1/__tests__/azure-installation-status-route.test.ts`
10. Cloud-specific transforms in `app/integration/api/v1/aws/...`, `gcp/...` subtrees (mostly thinner than azure)
11. AGENTS.md ADR-006 guard (approval/install/confirmation flows) — Group B touches install, must respect ADR-006 if it constrains anything

## Step 1 — Implement `httpBff` for Group B

Same pattern as spec 03. Replace `NOT_IMPLEMENTED` stubs with real `get<T>/post<T>/put<T>/del<T>` calls based on `lib/api-client/bff-client.ts` paths. Notable details:

### `azure.checkInstallation` and `vmCheckInstallation`

Both currently use `proxyPost` with empty body (`proxyPost(\`/target-sources/${id}/azure/check-installation\`, {})`). Migrate as straightforward `post<LegacyInstallationStatus>(...)` and `post<LegacyVmInstallationStatus>(...)` — composition is the route's responsibility, not BffClient's.

### `aws.verifyTfRole`

Special: it's a service-level (not target-source-level) endpoint. Path is `/aws/verify-tf-role`, body optional. Type: `Promise<VerifyTfRoleResult>`.

### `azure.getScanApp`

PR #253's missing-method case. Verify the typed shape matches the actual BFF response (snake_case fields per the original PR description). Add a comment in `lib/bff/types/azure.ts` noting the case-shape contract.

## Step 2 — Implement `mockBff` for Group B

Same rules as spec 03 (drop NextResponse wrap, drop authorize, match typed shape). Notable details:

### Composite mock alignment

For Azure, current `mockClient.azure.checkInstallation` and `vmCheckInstallation` produce data that the route's `buildV1Response` later merges. Under ADR-011, `mockBff.azure.checkInstallation` returns `LegacyInstallationStatus` directly and `mockBff.azure.vmCheckInstallation` returns `LegacyVmInstallationStatus`. The route's composition logic stays unchanged.

⚠️ Verify the existing mock data populates the EXACT typed shapes — any field defaults that route code relied on must be present in mockBff output. Run the smoke tests in Step 6 to catch shape mismatches.

### Mock-only `authorize()` removal

`mockClient.azure.authorize()` does target-source resolution + role check. The role check goes away (BFF doesn't auth). The target-source resolution becomes a simple lookup — if the project doesn't exist, throw `BffError(404, 'PROJECT_NOT_FOUND', ...)`.

## Step 3 — Migrate route handlers (with composite-route care)

### Non-composite routes (most of Group B)

Standard pattern from spec 03:

```typescript
// before
const response = await client.aws.getInstallationStatus(String(parsed.value));
if (!response.ok) return response;
const data = await response.json() as LegacyAwsInstallationStatus;
return NextResponse.json(transformAwsStatus(data));

// after
const data = await bff.aws.getInstallationStatus(parsed.value);
return NextResponse.json(transformAwsStatus(data));
```

### Composite routes (Azure check-installation + installation-status)

Pattern from analysis report §4.2.2:

```typescript
// app/integration/api/v1/azure/target-sources/[targetSourceId]/check-installation/route.ts
export const POST = withV1(async (_request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const dbStatus = await bff.azure.checkInstallation(parsed.value);  // typed, throws on error

  let vmStatus: LegacyVmInstallationStatus | null = null;
  try {
    vmStatus = await bff.azure.vmCheckInstallation(parsed.value);
  } catch (e) {
    // VM is best-effort — log and proceed with DB-only result
    if (!(e instanceof BffError)) throw e;
    console.warn(`[azure check-installation] vm check failed: ${e.code}`);
  }

  return NextResponse.json(buildV1Response(dbStatus, vmStatus));
});
```

Same pattern for `installation-status/route.ts` (GET version).

The **silent VM failure tolerance** is intentional and matches current behavior (current code does `try { ... } catch {}`). Capture the warning so it's visible in logs going forward — current empty catch is an anti-pattern (F2 silent-catch).

## Step 4 — Update composite-route tests

`azure-installation-status-route.test.ts` currently mocks two `client.azure.*` calls. Update to mock two `bff.azure.*` calls:

```typescript
// before
vi.mocked(client.azure.getInstallationStatus).mockResolvedValue(NextResponse.json(dbFixture));
vi.mocked(client.azure.vmGetInstallationStatus).mockResolvedValue(NextResponse.json(vmFixture));

// after
vi.mocked(bff.azure.getInstallationStatus).mockResolvedValue(dbFixture);
vi.mocked(bff.azure.vmGetInstallationStatus).mockResolvedValue(vmFixture);
```

For VM-failure scenarios:

```typescript
// before
vi.mocked(client.azure.vmGetInstallationStatus).mockResolvedValue(NextResponse.json({error:'X'}, {status:500}));

// after
vi.mocked(bff.azure.vmGetInstallationStatus).mockRejectedValue(new BffError(500, 'VM_UNAVAILABLE', 'X'));
```

Verify that the route still returns DB-only status when VM call rejects.

## Step 5 — Cloud-specific transforms stay put

Do NOT move these out of route handlers in this spec:

- `app/integration/api/v1/azure/target-sources/[targetSourceId]/_lib/transform.ts` (`buildV1Response`, etc.)
- `app/integration/api/v1/aws/.../_lib/*` if any
- `app/integration/api/v1/gcp/.../_lib/*` if any

These are Swagger v1 transforms (Category C in the analysis report). Per B-1 contract, they remain in route layer.

## Step 6 — Smoke tests

```bash
USE_MOCK_DATA=true npm run dev
# in another terminal:
curl -s http://localhost:3001/integration/api/v1/azure/target-sources/1005/installation-status | jq .
curl -s -XPOST http://localhost:3001/integration/api/v1/azure/target-sources/1005/check-installation | jq .
curl -s http://localhost:3001/integration/api/v1/aws/target-sources/1003/installation-status | jq .
curl -s http://localhost:3001/integration/api/v1/gcp/target-sources/1004/installation-status | jq .
# response shapes must be identical to pre-PR (use `git stash; curl; git stash pop` to compare).
```

Capture output diff in PR description if any field shifts (e.g. due to camelCase symmetry fix).

## Acceptance criteria

- [ ] `httpBff.{aws,azure,gcp}.<method>` all real (no `NOT_IMPLEMENTED`).
- [ ] `mockBff.{aws,azure,gcp}.<method>` all real.
- [ ] All route handlers under `app/integration/api/v1/{aws,azure,gcp}/**` import `bff` not `client`.
- [ ] All `as Legacy*` casts removed.
- [ ] Composite routes (azure check-installation, installation-status) preserve VM-failure tolerance with explicit `BffError` instanceof check + warning log.
- [ ] `app/integration/api/v1/azure/target-sources/[targetSourceId]/_lib/transform.ts` is unchanged (other than possibly removing the now-unused `Legacy*` exports if they moved entirely to `lib/bff/types/azure.ts`).
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm run test:run`, `npm run build` all pass.
- [ ] Smoke test outputs (Step 6) match pre-PR responses field-for-field.

## Out of scope

- `services/[serviceCode]/settings/{aws,azure}/*` — that's `services` domain in Group C (spec 05)
- Confirm flow approval routes — Group D (spec 06)
- Deleting `lib/api-client/{aws,azure,gcp}.ts` — spec 07

## Open decisions

- **azure mock data store init**: current `mockClient.azure` may rely on `mockData.getProjectByTargetSourceId(...)` for project lookups. This stays — `mockBff.azure.*` continues to read from `lib/mock-azure.ts` and `lib/mock-data.ts`. No store reorganization in this spec.
- **`getScanApp` snake_case**: per PR #253, current mock returns snake_case (`app_id`, `last_verified_at`). The typed shape in `lib/bff/types/azure.ts` (defined in spec 02) should match. Verify and adjust spec 02 retroactively if needed.

## Dependencies

- After: `adr011-02` merged (typed contracts available)
- Parallel with: `adr011-03`, `adr011-05`, `adr011-06`
- Before: `adr011-07`
- Coordinates with: spec 03 must define the `withV1` BffError handling. If 03 hasn't merged yet, this spec implements that change instead — first one wins.

## Estimated effort

XL. 17 methods + 19 routes + 2 composite handlers + composite test fixture rewrite. Plan 10-14 hours. The composite work is the main risk; budget extra time for smoke testing.

## /codex-review

**Mandatory** before merge — composite route changes are the kind of subtle behavior shift Codex catches well. Focus on:
- VM-failure tolerance behavior parity
- camelCase symmetry for new `post<T>/put<T>` helpers
- Whether `_lib/transform.ts` was correctly left untouched

## PR title

`refactor(adr011): migrate Group B (aws + azure + gcp incl. composite routes) to typed BffClient`
