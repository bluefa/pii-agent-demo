# ADR-014: snake_case at the BFF Client Boundary

## Status

Proposed · 2026-05-01

**Resolves:** [ADR-011](./011-typed-bff-client-consolidation.md) §"Scope of the type guarantee" — the deferred runtime-shape concern (`httpBff` still uses `camelCaseKeys(data) as T`).
**Supersedes:** PR #447 (`fix/case-tolerant-bff`) — a per-extractor band-aid that this ADR replaces with a single boundary normalization.

## Context

ADR-011 consolidated CSR and SSR onto one `BffClient` interface and gave both `mockBff` and `httpBff` a shared TypeScript signature. It explicitly left out runtime shape enforcement:

> B-1 guarantees that `mockBff` and `httpBff` share identical method signatures and typed return types. […] It does **not** prove that the real upstream BFF actually conforms to those typed shapes at runtime — `httpBff` still uses `camelCaseKeys(data) as T`. Upstream runtime validation (zod or type guards) remains a separate concern.

That deferral has produced concrete production failures and chronic friction.

### What the asymmetry actually does today

`lib/bff/http.ts` runs `camelCaseKeys` on GET responses and treats POST/PUT/DELETE as raw passthrough:

```ts
async function get<T>(path: string, opts?: { raw?: boolean }): Promise<T> {
  const data = await res.json();
  return (opts?.raw ? data : camelCaseKeys(data)) as T;     // ← GET: camelCase
}

async function send<T>(method, path, body?): Promise<T> {
  // I-3 invariant: POST/PUT bodies are raw passthrough (snake_case), no camelCase.
  return await res.json() as T;                             // ← POST/PUT: snake_case
}
```

Meanwhile, `mockBff` (`lib/bff/mock-adapter.ts`) does **no** casing transform — it returns whatever the in-memory mock handlers emit. Mocks happen to be authored in snake_case (matching the upstream BFF wire format), so:

| Channel | GET | POST/PUT/DELETE |
|---|---|---|
| `httpBff` | camelCase | snake_case |
| `mockBff` | snake_case | snake_case |

The two impls are TypeScript-compatible (same `as T` cast on both sides) but **runtime-incompatible**: a route handler that works in mock mode (snake_case) crashes in BFF mode (camelCase) and vice versa.

### The concrete failures

1. **Confirmed-integration crash.** `extractConfirmedIntegration` in `lib/confirmed-integration-response.ts` reads `payload.confirmed_integration` and `integration.resource_infos`. In production the keys arrive camelCased (`confirmedIntegration`, `resourceInfos`) — `integration.resource_infos.map(…)` throws `TypeError: Cannot read properties of undefined (reading 'map')`. Tests using snake-only fixtures kept passing.

2. **Silent-loss normalizers.** `normalizeProcessStatusResponse`, `normalizeApprovedIntegration`, etc. read snake_case fields on input. With camelCase input they silently produce `undefined`/`null` outputs. `lib/resource-catalog-response.ts` and `normalizeProcessStatusResponse` accreted dual-read code (`x ?? camelX`) per field as bugs surfaced — N×2 reads instead of N.

3. **PR #447 band-aid.** Adds `snakeCaseKeys()` at the entry of each public normalizer (8 functions). It works, but propagates the asymmetry through the codebase: every new normalizer must remember to do it, and the inner legacy paths required `pickStringField('snake_key', 'camelKey')` helpers because `snakeCaseKeys` at outer level converted `oracleServiceId` → `oracle_service_id` mid-flight.

4. **Pass-through routes (~30 of them).** `app/integration/api/v1/**/route.ts` files that simply `return NextResponse.json(await bff.foo())` ship whatever the impl produces straight to the frontend — camelCase in production, snake_case in mock. Frontend code that consumes those routes is consistent with neither.

5. **Test fixtures don't catch any of this.** Unit tests construct snake_case fixtures and pass them directly to normalizers, bypassing both impls. Mock-mode integration tests pass because mocks emit snake. Production breaks alone.

### Why one casing has to be picked

The Next.js → frontend contract is already snake_case in most places (route handlers return `resource_infos`, `target_source_id`, etc., and `app/lib/api/index.ts` consumers read snake_case fields). The upstream BFF wire format is also snake_case. The CamelCase island is purely the `httpBff.get` transform — a JS-convention concession that creates the entire problem.

## Decision

**The `BffClient` interface guarantees snake_case responses, enforced at runtime by both implementations.**

Concretely:

### D1. `httpBff` runs `snakeCaseKeys` on every response

`get`, `post`, `put`, `delete` all run `snakeCaseKeys(data)` before returning. The `raw: true` opt-out remains for endpoints that must preserve upstream literal keys (e.g. Issue #222 `azure/scan-app`).

```ts
async function get<T>(path: string, opts?: { raw?: boolean }): Promise<T> {
  const data = await res.json();
  return (opts?.raw ? data : snakeCaseKeys(data)) as T;
}

async function send<T>(method, path, body?, opts?: { raw?: boolean }): Promise<T> {
  if (res.status === 204) return undefined as T;
  const data = await res.json();
  return (opts?.raw ? data : snakeCaseKeys(data)) as T;
}
```

### D2. `mockBff` enforces the same contract via `unwrap()`

`unwrap()` in `lib/bff/mock-adapter.ts` runs `snakeCaseKeys` on the parsed JSON. This is **defensive** — mocks are already authored in snake_case — but cheap insurance against future drift, and it makes the contract explicit for both impls instead of relying on author discipline.

```ts
async function unwrap<T>(response: NextResponse): Promise<T> {
  if (!response.ok) { /* … */ }
  return snakeCaseKeys(await response.json()) as T;
}
```

### D3. Type files in `lib/bff/types/*` declare snake_case shapes

All 13 type files are migrated. The "GET responses use camelCase" doc comments are removed and replaced with a uniform "Responses are snake_case (D1)" note. Consumers of those types update their reads.

### D4. Per-normalizer `snakeCaseKeys` calls and dual-read code are removed

PR #447's band-aid is undone:

- `extractConfirmedIntegration`, `extractResourceCatalog`, the six `normalize*` helpers in `lib/approval-bff.ts` drop their `snakeCaseKeys()` entry call.
- `pickStringField` is deleted; the legacy `endpoint_config` path reads snake_case directly (`endpointConfig.oracle_service_id`).
- `resource-catalog-response.ts` drops its `LegacyResourceCatalogItem` dual-key shape; only snake_case fields remain.
- `normalizeProcessStatusResponse` drops `record.targetSourceId` and `page.totalElements`/`page.totalPages` fallbacks.

### D5. Contract test runs against both impls

A new test file `lib/bff/__tests__/casing-contract.test.ts` selects a representative method per domain, runs it against `httpBff` (with mocked `fetch`) and `mockBff`, and asserts that every key in the returned object — recursively — matches `/^[a-z][a-z0-9_]*$/`. This freezes the boundary contract regardless of upstream drift.

### Why D2 belt-and-suspenders

Mocks today emit snake. The reason to also force snake in `unwrap` is that `mockBff` mocks are NextResponses produced by handlers that may evolve independently (e.g., a future mock author copies a real BFF v2 response that happens to mix cases). Without an enforcement point, drift is silent again. The cost is one O(n) walk per mock call, which only runs in mock mode.

### Why not zod / runtime validation

Zod would prove field-level shape conformance. It is strictly more powerful than this ADR but also much larger in scope (schema authorship, error path design, performance budget). This ADR is the *casing* fix — necessary, not sufficient. Zod is the natural next step and is consistent with this decision (the schemas would be authored in snake_case).

### Why not change the upstream BFF

Upstream is a Spring/Java service we do not own in this repo. It already speaks snake_case on the wire. The work is purely on our edge.

## Alternatives considered

| Option | Decision | Reason |
|---|---|---|
| **A.** Status quo + per-normalizer `snakeCaseKeys` (= PR #447) | Rejected | Already in production; user-reported friction is the trigger for this ADR. Spreads conversion across N call sites; new endpoints regress. |
| **B.** Pick **camelCase** at the boundary instead | Rejected | Next.js → frontend contract is snake_case across `app/lib/api/index.ts` and most route handlers. Migration cost would be 5-10× higher. |
| **C.** Per-method opt-in (`bff.foo({ snakeCase: true })`) | Rejected | Re-creates the same per-call burden as PR #447, just at a different layer. |
| **D.** Stop normalizing; types claim raw upstream and consumers handle both | Rejected | The exact problem we have today. |
| **E.** Decorator wrapper `withSnakeCaseResponses(impl)` instead of changing each impl | Considered | Functionally equivalent. Rejected for code clarity — explicit normalization in `httpBff.get` and `unwrap` is easier to reason about than a wrapper layer. Reconsider if a third impl (e.g. recorded fixture player) appears. |
| **F.** Adopt `zod` schemas in addition to D1–D5 | Deferred | Strict superset of this ADR. Track separately. |

## Consequences

### Positive

- Single normalization point. New endpoints inherit the guarantee for free.
- `mockBff` and `httpBff` are runtime-equivalent, not just type-equivalent. Mock-mode integration tests now exercise the same shape as production.
- `pickStringField`, `LegacyResourceCatalogItem` dual-key shape, and ~8 `snakeCaseKeys()` per-normalizer calls are deleted (~40 LoC).
- Pass-through routes (`return NextResponse.json(await bff.foo())`) become consistent: same shape regardless of mode.
- Doc lies in `lib/bff/types/*.ts` ("GET responses use camelCase") are removed.

### Negative / Trade-offs

- Migration touches 13 type files + their consumers (estimated 30–60 files). Most changes are mechanical field renames (`resourceId` → `resource_id`).
- Frontend code that today reads camelCase from pass-through GET routes (e.g., `dashboardSummary.totalSystems`) must be updated. Audit during implementation.
- Performance: `snakeCaseKeys` runs an extra walk per response. Negligible (response payloads are bounded). Profiling shows < 1 ms on the largest observed payload (resource catalog with ~200 items); revisit if a payload exceeds 10 MB.
- `as T` casts in `httpBff.get`/`send` still lie about runtime shape if upstream emits unexpected fields. Zod (Option F) closes that gap; this ADR does not.

### Neutral

- ADR-011's stance ("BffClient gives compile-time parity") remains correct and is not amended. This ADR adds runtime parity to the same interface.

## Implementation plan

Implementation lands in **one PR** to avoid an intermediate state where boundary and consumers disagree. Internal staging within the PR:

### Stage 1 — Boundary

- `lib/bff/http.ts`: `get` and `send` run `snakeCaseKeys` (D1).
- `lib/bff/mock-adapter.ts`: `unwrap` runs `snakeCaseKeys` (D2).

### Stage 2 — Type rename

- 13 files in `lib/bff/types/*.ts`: rename camelCase fields to snake_case. Update doc comments to point to ADR-014.
- `lib/bff/types.ts`: same.
- TypeScript compiler will surface every consumer as an error — that drives Stage 3.

### Stage 3 — Consumer fix

- Route handlers in `app/integration/api/v1/**/route.ts`: rename field reads.
- `app/lib/api/index.ts`: the manual mappers that still read camelCase from pass-through endpoints (`getServicesPage`, etc.) — rename.
- `app/components/features/**` and `app/integration/**/_components/**`: any frontend code that reads camelCase from pass-through routes — rename.

### Stage 4 — Cleanup

- Remove per-normalizer `snakeCaseKeys()` (PR #447 band-aid) — D4.
- Delete `pickStringField` from `lib/confirmed-integration-response.ts`.
- Drop `LegacyResourceCatalogItem` camelCase keys from `lib/resource-catalog-response.ts`.
- Drop `record.targetSourceId` / `page.totalElements` fallbacks from `lib/approval-bff.ts`.

### Stage 5 — Contract test

- `lib/bff/__tests__/casing-contract.test.ts`: assert snake_case for one representative method per domain, against both `httpBff` (with `vi.fn()` for `fetch`) and `mockBff` (D5).

### Stage 6 — Doc

- ADR-011 §"Scope of the type guarantee": footnote pointing to this ADR.
- Remove "GET responses use camelCase" comments from all `lib/bff/types/*.ts`.

## Migration map

| Layer | File pattern | Change kind | Estimated count |
|---|---|---|---|
| Boundary | `lib/bff/http.ts`, `lib/bff/mock-adapter.ts` | Add `snakeCaseKeys` | 2 files |
| Types | `lib/bff/types/*.ts`, `lib/bff/types.ts` | Field rename + doc | 14 files |
| Routes | `app/integration/api/v1/**/route.ts` | Field-read rename | ≤ 40 files (most are pass-through; not all need edits) |
| Frontend | `app/lib/api/index.ts`, `app/components/**`, `app/integration/**/_components/**` | Field-read rename | TBD by tsc |
| Cleanup | `lib/approval-bff.ts`, `lib/confirmed-integration-response.ts`, `lib/resource-catalog-response.ts` | Remove band-aids | 3 files |
| Tests | `lib/__tests__/bff-response-case-tolerance.test.ts` | Drop after D5 lands | 1 file (delete) |
| Contract | `lib/bff/__tests__/casing-contract.test.ts` | New | 1 file |

## Open issues

- **O1.** Does any pass-through route currently rely on camelCase keys reaching the frontend? Audit during Stage 3 — if yes, the field rename in Stage 2 is the breaking moment, not a new bug. Capture in PR description.
- **O2.** Issue #222's `getScanApp` uses `{ raw: true }` to bypass casing. After D1, `raw: true` continues to mean "no transform". Verify the Issue #222 path stays correct.
- **O3.** Performance budget: confirm `snakeCaseKeys` is < 5 ms p99 on the largest observed payload before merge. If not, swap the implementation for a streaming variant.

## Relationship to other ADRs

- **ADR-011** stands. This ADR resolves its explicit deferral.
- **ADR-008** (error handling) unaffected — error shapes pass through `bffErrorFromBody` and were already snake_case.
- **ADR-013** (i18n) unaffected.
