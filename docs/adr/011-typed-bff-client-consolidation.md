# ADR-011: Typed BFF Client Consolidation

## Status

Accepted (2026-04-25) — supersedes ADR-007 «API Client 패턴 도입» (file removed; see git history at commit `3e88b08` and prior).

## Context

ADR-007 («API Client 패턴 도입», accepted 2026-02-14) introduced the pattern where `app/integration/api/v1/**/route.ts` dispatches to `client.method()` and `client` is selected between `mockClient` and `bffClient` via `USE_MOCK_DATA`. After ~2.5 months of production use, the pattern has not delivered its intended benefits and has accumulated structural friction:

1. **Two HTTP clients targeting the same upstream.** `lib/api-client/bff-client.ts` (for Pipeline 1 / CSR route handlers) and `lib/bff/http.ts` (for Pipeline 2 / Server Components) both talk to the same `${BFF_API_URL}`. Pipeline 2 stalled at 2 of 13 domains while Pipeline 1 grew to cover all of them. `docs/api/boundaries.md:167` already flagged this as an open question.

2. **`ApiClient` returns `Promise<NextResponse>`.** The abstraction boundary is on the HTTP transport, not on domain data. Consequently:
   - `mockClient` and `bffClient` agree only on "produce the same NextResponse body", and that body shape is not enforced by TypeScript.
   - 13 of 59 route handlers use `response.json() as SomeShape` casts (A2 anti-pattern); 27 total unwrap before further processing.
   - Route handlers perform substantial post-client work (`_lib/transform.ts`, `extractConfirmedIntegration`, `lib/issue-222-approval.ts` of 529 lines) that the ADR-007 "thin dispatcher" model did not anticipate.

3. **Issue #222 friction.** Five follow-up PRs (#234 #235 #237 #240 #253) each repeated the same pattern: change an upstream BFF contract, then edit three layers in lock-step — `lib/api-client/bff-client.ts`, the route handler, and `app/lib/api/index.ts`. PR #235 alone added 498 lines (`lib/issue-222-approval.ts`) and 184 lines to `app/lib/api/index.ts` to normalize a single domain. PR #253 fixed a `mockScan.getHistory`/`create`/`getStatus` response body-shape drift that TypeScript could not detect.

The analysis report [`docs/reports/api-client-pattern-review.md`](../reports/api-client-pattern-review.md) documents this in detail and was cross-reviewed by Codex (gpt-5.5, two rounds) before this ADR was written.

## Decision

Consolidate the two HTTP clients into **one canonical typed BFF client rooted in `lib/bff/*`**. `BffClient` is expanded to cover all domains currently served by `ApiClient`, returns typed domain data rather than `NextResponse`, and is used by both Server Components and `app/integration/api/v1/**/route.ts` handlers. Route handlers become thin adapters that call `bff.x.y(id)` and serialize the typed return.

### Canonical contract variant: B-1 (typed legacy upstream shape)

`BffClient` methods return the *typed upstream BFF shape* — the same shape that `_lib/transform.ts` and `lib/issue-222-approval.ts` already consume as input. For example:

```typescript
bff.azure.getInstallationStatus(id): Promise<LegacyInstallationStatus>;
```

Route handlers keep their existing Swagger v1 transforms:

```typescript
export const GET = withV1(async (_request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const dbStatus = await bff.azure.getInstallationStatus(String(parsed.value));  // typed, no cast
  return NextResponse.json(buildV1Response(dbStatus, null));
});
```

### Why B-1 and not B-2 or B-3

| Variant | Return shape | Chosen | Reason |
|---|---|---|---|
| B-1 | Typed legacy upstream | Yes | Smallest migration; removes `as` casts and mock-vs-HTTP signature drift without moving transform logic. |
| B-2 | Public Swagger v1 shape | Deferred per-domain | Would absorb `_lib/transform.ts` into `httpBff`; introduces BFF-side composition (e.g. DB+VM join) and composite mock fidelity concerns. Valuable but not a prerequisite. |
| B-3 | UI/domain model | No | Makes the contract opaque to external Swagger validation. |

B-2 is left as an optional, per-domain follow-up to be performed selectively after B-1 is complete — never as a blanket migration.

### Scope of the type guarantee (explicit limitation)

B-1 guarantees that `mockBff` and `httpBff` share identical method signatures and typed return types. This catches mock completeness gaps and snake/camel drift at compile time. It does **not** prove that the real upstream BFF actually conforms to those typed shapes at runtime — `httpBff` still uses `camelCaseKeys(data) as T` (`lib/bff/http.ts:44-45`). Upstream runtime validation (zod or type guards) remains a separate concern. The analysis report Option D (shared zod schemas) becomes an optional complement to this ADR, not an alternative.

> **Update (2026-05-01):** The casing portion of this deferral is closed by [ADR-014](./014-bff-snake-case-boundary.md), which enforces snake_case at the BFF client boundary in both `httpBff` and `mockBff`. Field-level shape validation (zod/type guards) is still future work.

### Rejected alternatives

- **Option A — status quo + ESLint + minor patches.** Does not solve the type-level mock-vs-BFF drift that caused Issue #222.
- **Option D — keep both clients, add shared zod schemas.** Runtime validation only; preserves the cognitive cost of two pipelines. Retained as a fallback if this ADR's migration cost is later rejected (see §Fallback).
- **Option E — change `ApiClient` return type to typed data, keep `lib/bff/*` separate.** Delivers compile-time protection but preserves two pipelines. Rejected because the two-client cognitive overhead is the second-most-cited complaint after type drift.
- **Option C — TanStack Query + zod full rewrite.** Out of scope for this ADR; may be revisited after migration completes.

## Consequences

### Positive

- Single source of truth for BFF access. CSR route handlers and Server Components call the same typed API.
- `mockBff` and `httpBff` share the same typed contract; missing methods and shape drift become compile errors.
- `as` casts in route handlers (13 files today) can be removed as domains migrate.
- `app/lib/api/*` helpers can drop defensive normalization where the BFF typed response already matches (partial recovery of PR #235 growth).
- Resolves the `boundaries.md` two-client open question. The schema-validation gap is **not** resolved by this ADR — upstream runtime validation via zod or type guards is deferred to a separate future decision (see §Scope).

### Negative / Trade-offs

- Migration is non-mechanical: 13 domains × multiple methods × 5-7 route handlers per domain. Composite routes (e.g. Azure `check-installation` joining DB+VM) require explicit handling.
- Route tests currently fixture `client.x.y()` to return `NextResponse`; these fixtures must be rewritten.
- During migration (Phases 2-5) two clients coexist. Conventions must prevent new work from adding to the deprecated `lib/api-client/*`.
- Compile-time protection is for client signatures only — upstream BFF runtime shape still needs zod or type guards as a separate concern.

### Migration Plan

Phases are detailed in `docs/reports/api-client-pattern-review.md:§5.2`. Summary:

| Phase | Purpose | PR Count | Notes |
|---|---|---|---|
| 0 | Per-domain method inventory + composite-route identification | 1 (doc) | Output is the Phase 2-5 work breakdown |
| 1 | Boundary rule update (prerequisite) | 1 | `docs/api/boundaries.md`, `AGENTS.md`, `.claude/skills/anti-patterns/SKILL.md` — permit `@/lib/bff/*` imports from route handlers during migration |
| 2 | Expand `BffClient` interface in `lib/bff/types.ts` to cover all domains | 1 | Return types are the B-1 typed legacy shapes |
| 3 | Expand `httpBff` | 3-5 (per domain) | Preserve special transforms (`extractConfirmedIntegration`, etc.) inside the client methods |
| 4 | Expand `mockBff` | 3-5 (per domain) | Decide per-domain whether `authorize()` mock-only auth logic stays, moves, or is removed |
| 5 | Route handler migration | 5-7 (per domain) | Replace `client.x.y()` with `bff.x.y()`; remove `as` casts; update route tests |
| 6 | Cleanup + final boundary lock + naming generalization | 1 (large) | Remove `lib/api-client/*`; rewrite `boundaries.md` to the single-pipeline model; add ESLint `no-restricted-imports`. **Naming generalization**: rename `Issue222*` typed identifiers to domain names (no prefix) when moving them into `lib/bff/types.ts`; delete `lib/issue-222-approval.ts`; rename or merge `docs/swagger/issue-222-client.yaml`. Historical references in `docs/feature/` and `docs/reports/` are kept as-is (records of the original migration). |

Phase 1 **must** ship before any Phase 5 route migration — otherwise the first migration PR violates the project's own boundary rules (this lesson is explicitly flagged in the analysis report round-2 appendix).

Phases 2-4 can run in the background concurrently with other BFF wave work. Phases 5-6 start with domains that have no pending upstream BFF changes to minimize rebase pain.

### Fallback

If, during Phase 0 inventory, the per-domain cost estimate is deemed unacceptable, this ADR-011 is withdrawn by a separate supersession ADR-012 «Mock-BFF Schema Validation» that adopts Option D (shared zod schemas) as a minimum-protection measure. ADR-012 would in turn explicitly supersede this ADR-011, and separately decide whether to author a fresh policy document at the next free ADR ID (ADR-007's content is preserved only in git history). This fallback is recorded here so that a future withdrawal does not require rediscovering the alternative; the lifecycle transition itself must still be enacted by that follow-up ADR.

## Related Files

- `docs/reports/api-client-pattern-review.md` — analysis that motivated this ADR, including two rounds of Codex cross-review
- ADR-007 «API Client 패턴 도입» — superseded and removed; the file existed at `docs/adr/007-api-client-pattern.md` until commit following the present one. See git history.
- `docs/api/boundaries.md` — current two-pipeline documentation; will be rewritten in Phase 6
- `lib/api-client/*` — pipeline to be removed in Phase 6
- `lib/bff/*` — canonical client to be expanded
- `app/integration/api/v1/**/route.ts` — 59 handlers migrating in Phase 5
- `app/lib/api/*` — CSR helpers; normalization logic revisited in Phase 6
- `AGENTS.md`, `.claude/skills/anti-patterns/SKILL.md` — boundary rules updated in Phase 1
