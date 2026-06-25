# ADR-019 zod-codegen Migration Plan

**Branch:** `refactor/adr019-zod-codegen` · **Base:** `main@8af57d2` (#507)
**Status:** in progress · orchestrated (this doc is the contract every subagent reads first)

## 0. Goal

The swagger (`docs/swagger/install-v1.yaml`) is the single source of truth. Generate
zod schemas from it; validate the BFF response at the boundary; delete every
hand-written wire type and rename-only normalizer. Casing is **not** forced to
camelCase. The API client returns the generated zod Response type verbatim.

This **amends ADR-019 D1/D2/D4** (camelCaseKeys-default + camelCase zod) — see §7.

## 1. Locked architecture (do not deviate)

```
BFF raw JSON (snake)
  │
  ▼ Router (app/integration/api/v1/**/route.ts)   ── the ONLY validation point
     return NextResponse.json(schemas.X.parse(raw))      // zod Response, snake, verbatim
  │
  ▼ API client (app/lib/api/*)
     fn(...): Promise<z.infer<typeof schemas.X>>          // generated type, in AND out
  │
  ▼ CSR Adapter (selector / view-model)  ── ONLY when join / reshape / compute is needed
     buildXxx(domainA, domainB, ...): XxxView            // camel view out, pure fn, no zod
  │
  ▼ UI
```

### Rules

1. **Router = parse only.** Each route returns `schemas.<Name>.parse(rawFromBff)`.
   No `camelCaseKeys`, no `as T`, no hand normalizer. One schema per response.
   - Request bodies: type the body as `z.infer<typeof schemas.<Req>>` and pass through
     verbatim (ADR-019 D3 — request casing is the BFF's, per-endpoint). Optional
     `schemas.<Req>.parse(body)` self-check before send; type alone is usually enough.
2. **API client returns the generated type.** `z.infer<typeof schemas.X>` (snake).
   No parallel hand-written domain interface that merely renames fields.
3. **Adapter = join / reshape / compute ONLY.** A pure CSR function that takes one or
   more *already-validated* zod Response objects and returns a camel view. This is the
   only place snake→camel happens, and only because a join/reshape needs it anyway.
   - **No rename-only adapter.** If the only change is `foo_bar`→`fooBar`, do NOT write
     an adapter — let the zod (snake) type flow to the UI.
   - **Computed fields** (a value not in the contract, e.g. `testAck`) are *derived in
     the adapter from contract fields*, never read from a non-existent wire key.
4. **Delete, don't keep.** Every `lib/bff/types/*.ts` hand wire type and every
   `lib/*-response.ts` / `lib/approval-bff.ts` rename normalizer that this migration
   replaces is removed. Leaving them "just in case" is a migration failure.
5. **Mock returns the wire shape (snake), validated by the same schema.** Mock factories
   produce objects that `schemas.X.parse()` accepts. A mock that needs `as any` to pass
   is a mock bug, not a schema bug.

## 2. Codegen workflow

- `npm run gen:api` (`scripts/gen-api.mjs`) regenerates `lib/generated/install-v1.ts` from the
  swagger. **NEVER edit `docs/swagger/install-v1.yaml`** — it is the source of truth, owned by
  the BFF/spec author. Never hand-edit the generated file either.
- zod is **v3** (`zod@^3`) — the generator emits v3 syntax (`z.record(v)`, `.passthrough()`).
- **Optionality is handled in code, not the spec.** A schema with no `required` in swagger
  generates `.partial()` (every field optional). Consumers absorb that in the adapter
  (`?? []`, `if (field)` guards) — do **not** add `required` to the swagger to make fields
  non-optional. (If stricter validation is wanted, the spec owner adds `required` at source.)
- **Generator-hostile swagger is fixed in the generated OUTPUT, not the spec.** `cloud_type`
  carries a `(?i)` inline-flag `pattern` (invalid ECMA regex) that makes the generator emit
  non-compiling `.enum().regex(/(?i).../)`. `scripts/gen-api.mjs` strips that `.regex(...)`
  from the output (the enum already constrains the value). The swagger is untouched.

## 3. Domain partition (work units)

Each unit = one subagent. Ownership is **file-exclusive** except the shared barrels in §4.

| Unit | Routes (under app/integration/api/v1) | Wire types to delete | Normalizers to delete | Mock files |
|---|---|---|---|---|
| **TC** (reference) | `test-connection/*` (5) | `bff/types/test-connection.ts` | `test-connection-response.ts` | `bff/mock/confirm.ts`†, `mock-test-connection.ts` |
| **APPROVAL** | `…/approval-history`, `…/approval-requests{,/approve,/cancel,/latest,/reject}`, `…/approval-unavailable{,/confirm}` | `bff/types/confirm.ts`† (approval parts) | `approval-bff.ts`, `approval-response.ts` | `bff/mock/confirm.ts`† |
| **TS-CORE** | `target-sources/[id]{,/route}`, `…/resources{,/credential}`, `…/confirmed-integration`, `…/approved-integration`, `…/process-status`, `…/secrets`, `…/pii-agent-installation/confirm`, `…/excluded-databases/*`, `…/tested-logical-databases/*` | `bff/types/target-sources.ts`, `bff/types/confirm.ts`† (resource/integration parts) | `confirmed-integration-response.ts`, `target-source-response.ts`, `resource-catalog-response.ts`, `logical-db-response.ts` | `bff/mock/confirm.ts`†, `bff/mock/target-sources.ts`, `bff/mock/logical-db.ts` |
| **AWS** | `aws/*` (4) | `bff/types/aws.ts` | — | `bff/mock/aws.ts`, `mock-installation.ts` (aws) |
| **AZURE** | `azure/*` + `…/azure/scan-app` (3) | `bff/types/azure.ts` | — | `bff/mock/azure.ts`, `mock-azure.ts` |
| **GCP** | `gcp/*` (4) | `bff/types/gcp.ts` | — | `bff/mock/gcp.ts`, `mock-gcp.ts` |
| **IDC** | `idc/*` (4) | `bff/types/idc.ts` | (idc mapper in `app/lib/api/idc.ts` is a **sanctioned reshape adapter** — keep, retype its input to `z.infer`) | `bff/mock/idc.ts`, `mock-idc.ts` |
| **SCAN** | `…/scan{,/history}`, `…/scanJob/latest` | `bff/types/scan.ts` | — | `bff/mock/scan.ts`, `mock-scan.ts` |
| **ADMIN** | `admin/dashboard/*` (3), `admin/guides/[name]` | `bff/types/dashboard.ts`, `bff/types/guides.ts` | — | `bff/mock/dashboard.ts`, `bff/mock/guides*.ts`, `mock-dashboard.ts` |
| **USER** | `user/*`, `users/search`, `services/*`, `task-admin/*`, `dev/*`, `health` | `bff/types/users.ts`, `bff/types/services.ts`, `bff/types/task-admin.ts`, `bff/types/dev.ts`, `bff/types/projects.ts` | — | `bff/mock/users.ts`, `bff/mock/services.ts`, `bff/mock/queue-board.ts`, `bff/mock/dev.ts` |

† **`bff/mock/confirm.ts` and `bff/types/confirm.ts` are shared** by TC + APPROVAL + TS-CORE.
These three units must **not** run concurrently on those two files — see §4.

## 4. Shared-file protocol (collision avoidance)

These files are touched by multiple units. Domain agents follow these rules:

- **`app/lib/api/index.ts`** (shared CSR functions + type re-exports): a domain agent edits
  **only the lines for its own endpoints/types** (find by the endpoint path / type name),
  and must not reorder or touch other domains' lines. Re-export blocks: add/remove only your
  own names.
- **`lib/bff/types.ts`** (barrel): same rule — only your domain's re-export lines.
- **`lib/bff/mock/confirm.ts`, `lib/bff/types/confirm.ts`**: owned **sequentially** by
  TC → APPROVAL → TS-CORE (run these three in series, not parallel). Each removes only its
  own slice.
- **`lib/bff/mock-adapter.ts`, `lib/bff/client.ts`, `lib/bff/http.ts`**: do not edit unless
  your domain's wiring genuinely requires it; if so, edit only your domain's method block and
  flag it in the report.
- Independent units (AWS, AZURE, GCP, IDC, SCAN, ADMIN, USER) share none of the above except
  the two barrels (index.ts, types.ts) — safe to run in parallel with the barrel rule.

## 5. Per-domain checklist (every unit does this)

1. For each response: find the matching `schemas.<Name>` in `lib/generated/install-v1.ts`.
   If a field that is always present is optional in the generated type, add `required:` to
   that schema in the swagger and re-run `npm run gen:api`.
2. Rewrite each `route.ts`: `return NextResponse.json(schemas.<Name>.parse(raw))`. Remove
   `camelCaseKeys` + the hand normalizer import.
3. Retype the CSR function(s) in `app/lib/api/*` to `Promise<z.infer<typeof schemas.<Name>>>`.
4. Update consumers (hooks/components): field access becomes snake for direct reads; where a
   join/reshape/compute exists, route it through a pure CSR **adapter** that outputs a camel
   view (keep/extract one function; unit-test it).
5. Delete the domain's `bff/types/*.ts` wire file and `lib/*-response.ts` normalizer.
6. Migrate the domain's **mock** to emit the wire (snake) shape that `schemas.X.parse()`
   accepts; delete mock-side hand types.
7. Update/move tests: normalizer tests → adapter tests (join/reshape/compute) or delete if the
   function was a pure rename.

## 6. Verification gates (must pass before a unit is "done")

- `npm run gen:api` clean (no diff after commit), generated file `tsc` clean.
- `npx tsc --noEmit` green (whole project).
- `npx vitest run` green.
- `npx eslint <changed files>` green.
- No remaining import of the deleted `*-response.ts` / `bff/types/<domain>.ts`.
- Grep proof: the domain's routes contain `schemas.` and `.parse(`, and contain **no**
  `camelCaseKeys` and **no** `normalize<Domain>`.

## 7. ADR-019 amendment (orchestrator owns, lands with the migration)

Amend `docs/adr/019-bff-casing-boundary-and-runtime-validation.md`:
- **D1/D2 revised:** central `camelCaseKeys`-by-default is dropped. The casing boundary is the
  generated zod schema (snake, verbatim) + per-need CSR adapters. The IDC sanctioned-exception
  (D2.2/D6) is generalized: per-domain reshape adapters are the norm, not the exception.
- **D4 revised:** zod schemas are **codegen'd from swagger (snake)**, validated as
  `schemas.X.parse(raw)` at the route. (Supersedes "camelCase schema + `parse(camelCaseKeys)`".)
- **New D7 — codegen freshness gate:** CI runs `npm run gen:api` and fails if `git diff` is
  non-empty (stale generated file = drift footgun).
- **New D8 — required discipline:** swagger declares `required` for always-present fields;
  loose `.partial()` schemas are a logged gap, not the default.
- **Loud-fail policy:** `ZodError` → `ProblemDetails` (existing pipeline). Volatile enums may
  opt into `.catch(default)`; document each.

## 8. Sequencing

1. **TC reference** (this unit first, alone) — proves the pattern + the confirm.ts protocol.
2. **Parallel wave A:** AWS, AZURE, GCP, IDC, SCAN, ADMIN, USER (independent).
3. **Serial on confirm.ts:** APPROVAL → TS-CORE (after TC).
4. **Orchestrator:** barrel consolidation + ADR amendment + full-suite verify + commit/push.
