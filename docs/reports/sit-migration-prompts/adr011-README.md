# ADR-011 Implementation Plan — Typed BFF Client Consolidation

> ADR: [docs/adr/011-typed-bff-client-consolidation.md](../../adr/011-typed-bff-client-consolidation.md)
> Analysis: [docs/reports/api-client-pattern-review.md](../api-client-pattern-review.md)
> Strategy: Option B-1 (typed legacy upstream shape)

This plan was simplified after a Codex over-engineering review (PR #387). 7 specs collapsed to 5; redundant inventory artifacts and runtime stubs dropped; group structure reduced to 3 implementation tiers based on actual risk.

---

## What actually changes (abstract overview)

The migration touches three layers per domain. **Architecture before**:

```
                    │ client (lib/api-client/index.ts)
                    │   = mockClient OR bffClient (env var picks)
Component ──────────┤   returns Promise<NextResponse>
  fetch /int/api/v1/x ↓
                Route handler
                    │ const r = await client.x.y(id);
                    │ if (!r.ok) return r;
                    │ const data = await r.json() as Shape;  ← cast, not typed
                    │ return NextResponse.json(transform(data));
                    ↓
                bff-client.ts → upstream BFF
                                OR
                mock-client/x.ts (in-memory)
```

**Architecture after**:

```
                    │ bff (lib/bff/client.ts)
                    │   = mockBff OR httpBff (same env var)
Component ──────────┤   returns Promise<TypedShape>
  fetch /int/api/v1/x ↓
                Route handler
                    │ const data = await bff.x.y(id);  ← typed, no cast
                    │ return NextResponse.json(transform(data));
                    ↓
                lib/bff/http.ts → upstream BFF
                                OR
                lib/bff/mock-adapter.ts (in-memory)
```

The route handler shrinks by 4-5 lines per call site, the `as Shape` cast disappears, and mock + HTTP impls share the same TypeScript contract — so a missing method or a snake/camel drift becomes a compile error instead of a runtime surprise.

### Worked example: `GET /target-sources/{id}`

**Files touched (one PR)**:
1. `lib/bff/types/target-sources.ts` — declare `TargetSourceDetailResponse` (already exists in `lib/target-source-response.ts`; just re-export)
2. `lib/bff/types.ts` — extend `BffClient` with `targetSources.get`
3. `lib/bff/http.ts` — add real `httpBff.targetSources.get` impl using existing `get<T>(path)` helper
4. `lib/bff/mock-adapter.ts` — add real `mockBff.targetSources.get` impl reading from `lib/mock-data.ts`
5. `app/integration/api/v1/target-sources/[targetSourceId]/route.ts` — switch `client.targetSources.get(...)` → `bff.targetSources.get(...)`, drop the `as` cast

**Diff sketch** (route handler):

```diff
-import { client } from '@/lib/api-client';
+import { bff } from '@/lib/bff/client';

 export const GET = withV1(async (_request, { requestId, params }) => {
   const parsed = parseTargetSourceId(params.targetSourceId, requestId);
   if (!parsed.ok) return problemResponse(parsed.problem);

-  const response = await client.targetSources.get(String(parsed.value));
-  if (!response.ok) return response;
-  const data = await response.json();
-  return NextResponse.json(extractTargetSource(data));
+  const data = await bff.targetSources.get(parsed.value);
+  return NextResponse.json(extractTargetSource(data));
 });
```

The route's external contract is identical: same URL, same response body, same status codes. Only the *internal* dispatch is typed.

Per ADR-011 B-1 the v1 transform (`extractTargetSource`) **stays in the route**. Transforms are NOT moved into `httpBff` (that's B-2, deferred). A composite route like Azure `check-installation` keeps its DB+VM merge logic in the handler.

---

## ⛔ Observable Behavior Invariants (DO NOT change)

Four non-negotiable invariants. Every implementation spec checks them.

| ID | Invariant | Verification |
|---|---|---|
| **I-1** | Upstream BFF call paths/methods/queries/bodies preserved | Codex review compares removed `bff-client.ts` lines to added `lib/bff/http.ts` lines (1:1) |
| **I-2** | Next.js public route URLs and `route.ts` file locations preserved | `find app/integration/api/v1 -name route.ts \| sort` identical pre/post |
| **I-3** | Route response wire shape preserved — including the existing GET-camelCase / POST-passthrough asymmetry | Route integration tests + smoke `curl` baseline diff (representative endpoints) |
| **I-4** | HTTP status codes + ProblemDetails error body shape preserved | `BffError` thrown from `bff.x.y()` is converted by `withV1` to the same ProblemDetails fields `transformLegacyError` produces today |

### Why I-3 says "preserve the asymmetry"

Current `proxyGet` runs `camelCaseKeys`; current `proxyPost/Put` is raw passthrough (snake_case). CSR helpers like `normalizeIssue222ApprovalRequestSummary` read `target_source_id` from POST responses. **Changing POST behavior to camelCase would silently break those normalizers.** This migration consolidates clients only — it does NOT fix the asymmetry. Resolving it is a separate post-migration ADR.

### Verification: integration tests, not theatre

Per Codex review: behavior preservation is enforced by **route-level integration tests** that run in `npm run test:run` (existing `app/integration/api/v1/__tests__/*.test.ts` suite), not by manual curl ceremonies. Each implementation spec adds or updates tests for its domains.

Manual `curl` smoke is allowed as optional debugging during implementation, not as a merge gate.

---

## Spec inventory

| Key | Phase | Title | Effort | Depends on | Parallelizable with |
|---|---|---|---|---|---|
| `adr011-01` | 1+2 | Setup: boundary rule update + per-domain typed shapes | M-L | — | — |
| `adr011-02` | 3-5 | Simple/core domains: targetSources + projects + users + services + dashboard + dev + scan + taskAdmin | XL | 01 | 03, 04 |
| `adr011-03` | 3-5 | Cloud providers: aws + azure (composite) + gcp | L | 01 | 02, 04 |
| `adr011-04` | 3-5 | Confirm domain: migrate only, preserve normalize | L | 01 | 02, 03 |
| `adr011-05` | 6 | Cleanup: delete `lib/api-client/*`, ESLint lock, boundary docs final. Issue222 rename optional appendix. | M | 02, 03, 04 | — |

## Dependency graph

```
              ┌──────────────────────┐
              │ adr011-01 — setup    │
              │ (boundary + types)   │
              └──────────┬───────────┘
                         │
       ┌─────────────────┼─────────────────┐
       ▼                 ▼                 ▼
  ┌──────────┐    ┌──────────┐    ┌──────────┐    (3 parallel sessions)
  │ adr011-02│    │ adr011-03│    │ adr011-04│
  │ simple   │    │ cloud    │    │ confirm  │
  └─────┬────┘    └─────┬────┘    └─────┬────┘
        └───────────────┼───────────────┘
                        ▼
              ┌──────────────────────┐
              │ adr011-05 — cleanup  │
              └──────────────────────┘
```

## Wave plan (suggested session distribution)

| Wave | Specs | Sessions | Notes |
|---|---|---|---|
| **W1 — Setup** | 01 | 1 sequential | Adds typed shapes (no httpBff/mockBff method changes) |
| **W2 — Implementation** | 02, 03, 04 | 3 parallel sessions | Independent domains; do NOT serialize |
| **W3 — Cleanup** | 05 | 1 session | After all three W2 PRs merge |

Total: 4 sessions across 3 waves. W2 wall-clock = max of three groups, not their sum.

---

## Cross-cutting decisions (locked)

Decided once here. Implementers don't relitigate.

1. **Canonical contract: B-1** (typed legacy upstream shape). v1 transforms (e.g. `_lib/transform.ts buildV1Response`, `extractTargetSource`, `extractConfirmedIntegration`) stay in route handlers.
2. **Coexistence**: old `lib/api-client/*` stays operational until spec 05 deletes it. Per-domain specs add `bff.<domain>` and migrate routes; old `client.<domain>` entries become dead but compile-clean.
3. **Mock-only auth (`authorize()` in `lib/api-client/mock/*.ts`)**: **per-domain decision, default = preserve.** If existing route tests assert mock 401/403 behavior, that behavior is part of the contract for this migration. Drop it only if the implementer can show no test depends on it AND no UI flow depends on it. (Stricter than the prior global-removal policy — Codex called that one out as risky.)
4. **Issue222\* naming**: **deferred.** Re-export from `lib/bff/types/confirm.ts` if convenient. The project-wide rename is an optional appendix in spec 05; it can be skipped or split into a separate small PR if execution risk is high.
5. **Composite routes**: composition stays in route layer (B-2 deferred indefinitely).
6. **Normalize cleanup in confirm domain**: spec 04 migrates `client.confirm.*` → `bff.confirm.*` while **preserving** all current `normalizeIssue222*` calls. Removing them is a separate follow-up — not bundled with the migration.

---

## Conventions

- Every spec follows `/wave-task` pipeline. Invoke as `/wave-task adr011-NN`.
- Branch prefix: `refactor/adr011-NN-<short-name>`.
- `/codex-review` mandatory for **specs 03 (cloud composite) and 04 (confirm)** only — these are the high-risk surfaces. Optional elsewhere.
- Each PR description references ADR-011 + the specific spec.

## Audit gates (every spec)

- `npx tsc --noEmit`
- `npm run lint`
- `npm run test:run` — route integration tests must pass and cover the migrated domains
- `npm run build`
- `bash scripts/contract-check.sh --mode diff --base origin/main --head HEAD`

## How to start

```
/wave-task adr011-01
```

After 01 merges, distribute 02/03/04 across 3 sessions (sequential or parallel). After all three merge:

```
/wave-task adr011-05
```
