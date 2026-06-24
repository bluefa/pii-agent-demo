# ADR-019 Migration Spec — Domain B: Logical DB (Step 5 Modal)

> Status: **implementation-ready**. Scope: the 6 Logical-DB endpoints of `/install/v1`
> (3 `agentId`-keyed + 3 `by-resource-id`), the **NEW** client/wire-types/mock/routes that
> replace today's stub, and the modal adapter (Tested left / Excluded right, parent-child, dedup).
>
> Authorities: `docs/swagger/install-v1.yaml` (VERBATIM contract), `docs/reports/adr019-api-migration/PLAN.md`
> (P3, casing D1–D6), `~/pii-agent-migration-notes/01-target-source-detail-spec.md` §1 (domain/UX).
> Swagger wins on every conflict. **`TEMP` not `TMP`.**

---

## 0. TL;DR for the implementer

- **Everything here is NEW.** No logical-DB client, wire type, mock, or route exists. Today's logical-DB
  is a UI-only **stub**: `useLogicalDatabases.ts` returns `buildFakeDatabases()` (a `setTimeout` of deterministic
  fake rows) and both consumers fire a "BFF 연동 후 활성화" toast on save. There is **nothing to migrate** — there is a
  stub to **replace**.
- **6 endpoints, 2 families:**
  - `tested-logical-databases` (GET) — discovered DB/Schema from last Test Connection → left panel.
  - `excluded-databases` (GET + PUT) — the skip policy → right panel; PUT is **full replace**.
  - Each family has a plain variant (query **`agentId`**) and a `**by-resource-id**` variant (query **`resourceId`**).
- **The modal uses the `by-resource-id` variants.** It only ever has a `resourceId`
  (`ConfirmedResource.resourceId`), never an `agentId`. See §6 D-1 (top discrepancy).
- **Casing (ADR-019 D1/D2/D3):** responses are snake on the wire → camel at the **one** CSR boundary
  (`fetchInfraCamelJson`); the PUT request body is authored **snake** (matches swagger). Mocks emit **wire-snake**
  == swagger. No `getSnakeRaw`, no `OpaqueKeys`, no `as T` on the response path (D6 — there is nothing dynamic-keyed
  or opt-out here; if you reach for `as T` on a response you did it wrong).

---

## 1. Endpoints — VERBATIM from `docs/swagger/install-v1.yaml`

All paths carry the `/install/v1` prefix on the wire (the CSR helper prepends it — see §3). `targetSourceId`
is a path param, `type: integer, format: int64`, `required`. Every endpoint declares the same error envelope
(`400/403/404/409/500/501/502/503` → `ErrorMessage`) and `200 → <schema>`; only the success contract is listed.

| # | Method | Path (after `/install/v1`) | operationId | Query param (req) | Request body | 200 response | swagger lines |
|---|--------|----------------------------|-------------|-------------------|--------------|--------------|---------------|
| 1 | GET | `/target-sources/{targetSourceId}/tested-logical-databases` | `getTestedLogicalDatabases` | **`agentId`** (string) | — | `TestedLogicalDatabasesResponse` | 1824–1899 |
| 2 | GET | `/target-sources/{targetSourceId}/tested-logical-databases/by-resource-id` | `getTestedLogicalDatabasesByResourceId` | **`resourceId`** (string) | — | `TestedLogicalDatabasesResponse` | 1900–1975 |
| 3 | GET | `/target-sources/{targetSourceId}/excluded-databases` | `getExcludedLogicalDatabases` | **`agentId`** (string) | — | `SkipLogicalDatabaseResponse` | 202–277 |
| 4 | PUT | `/target-sources/{targetSourceId}/excluded-databases` | `updateExcludedLogicalDatabases` | **`agentId`** (string) | `UpdateSkipLogicalDatabaseRequest` (req) | `SkipLogicalDatabaseResponse` | 278–358 |
| 5 | GET | `/target-sources/{targetSourceId}/excluded-databases/by-resource-id` | `getExcludedLogicalDatabasesByResourceId` | **`resourceId`** (string) | — | `SkipLogicalDatabaseResponse` | 359–434 |
| 6 | PUT | `/target-sources/{targetSourceId}/excluded-databases/by-resource-id` | `updateExcludedLogicalDatabasesByResourceId` | **`resourceId`** (string) | `UpdateSkipLogicalDatabaseRequest` (req) | `SkipLogicalDatabaseResponse` | 435–515 |

> ⚠ **Query-param name is contract-load-bearing.** Endpoints 1/3/4 use **`agentId`**; endpoints 2/5/6 use
> **`resourceId`**. The team-lead brief said all six take `resourceId` — that is wrong for 1/3/4. Swagger is
> authoritative. (PUT #4/#6 declare `requestBody.required: true`.) See §6 D-1.

### 1.1 Schemas — VERBATIM (`components/schemas`)

`SkipLogicalDatabaseItem` (swagger 4353–4374):
```yaml
required: [database_name, skip_reason, type]
properties:
  database_name: { type: string }          # required
  schema_name:   { type: string }          # optional
  skip_reason:   { type: string, enum: [STG, DEV, TEMP] }   # required — TEMP, NOT TMP
  type:          { type: string, enum: [DATABASE, SCHEMA] } # required
```

`UpdateSkipLogicalDatabaseRequest` (swagger 4375–4383):
```yaml
required: [skip_logical_database_list]
properties:
  skip_logical_database_list: { type: array, items: SkipLogicalDatabaseItem }
```

`SkipLogicalDatabaseResponse` (swagger 4384–4390):
```yaml
properties:
  skip_logical_database_list: { type: array, items: SkipLogicalDatabaseItem }   # NOT required
```

`TestedLogicalDatabaseItem` (swagger 5175–5186):
```yaml
properties:                                  # NOTHING is required on this schema
  database_name: { type: string }
  schema_name:   { type: string }
  type:          { type: string, enum: [DATABASE, SCHEMA] }
```

`TestedLogicalDatabasesResponse` (swagger 5187–5193):
```yaml
properties:
  logical_database_list: { type: array, items: TestedLogicalDatabaseItem }   # NOT required
```

> Contract subtleties to honor:
> - The two list fields differ: **Tested** = `logical_database_list`; **Excluded** = `skip_logical_database_list`.
>   Do not unify the field name.
> - Neither response wrapper marks its list `required`, and `TestedLogicalDatabaseItem` marks **no** field required.
>   Treat `logical_database_list`, `skip_logical_database_list`, every `schema_name`, and (defensively on Tested) a
>   missing `type`/`database_name` as possibly-absent. The Excluded item DOES require `database_name`/`skip_reason`/`type`.
> - `skip_reason` lives only on the **Excluded** item. The Tested item has **no reason** field.

---

## 2. Target types

### 2.1 Wire DTOs — NEW file `lib/bff/types/logical-db.ts` (snake, 1:1 with swagger)

These mirror the wire exactly and are the literal shape mocks emit. Enums are exported so CSR code imports
them from the client (`app/lib/api/logical-db.ts` re-exports), never from `@/lib/bff/*` (boundaries.md).

```ts
/**
 * Logical DB (Step 5 modal) — BFF wire DTOs (snake_case).
 * Source of truth: docs/swagger/install-v1.yaml — SkipLogicalDatabaseItem /
 * UpdateSkipLogicalDatabaseRequest / SkipLogicalDatabaseResponse /
 * TestedLogicalDatabaseItem / TestedLogicalDatabasesResponse.
 * snake→camel happens once at the CSR boundary (fetchInfraCamelJson in
 * app/lib/api/logical-db.ts); requests are authored snake to match swagger.
 */
export type LogicalDbTypeWire = 'DATABASE' | 'SCHEMA';
export type SkipReasonWire = 'STG' | 'DEV' | 'TEMP';   // ⚠ TEMP, not TMP

export interface TestedLogicalDatabaseItemWire {
  database_name?: string;       // swagger: not required
  schema_name?: string;         // SCHEMA rows only
  type?: LogicalDbTypeWire;     // swagger: not required on Tested item
}
export interface TestedLogicalDatabasesResponseWire {
  logical_database_list?: TestedLogicalDatabaseItemWire[];
}

export interface SkipLogicalDatabaseItemWire {
  database_name: string;        // required
  schema_name?: string;
  skip_reason: SkipReasonWire;  // required
  type: LogicalDbTypeWire;      // required
}
export interface UpdateSkipLogicalDatabaseRequestWire {
  skip_logical_database_list: SkipLogicalDatabaseItemWire[];
}
export interface SkipLogicalDatabaseResponseWire {
  skip_logical_database_list?: SkipLogicalDatabaseItemWire[];
}
```

> `camelCaseKeys` (lib/object-case.ts) maps `database_name→databaseName`, `schema_name→schemaName`,
> `skip_reason→skipReason`, `logical_database_list→logicalDatabaseList`, `skip_logical_database_list→skipLogicalDatabaseList`.
> Enum string **values** (`TEMP`, `DATABASE`, …) are untouched by camelCaseKeys (it only rewrites keys), so they
> survive verbatim — no `OpaqueKeys` needed.

### 2.2 Domain types — in `app/lib/api/logical-db.ts` (camel; the UI contract)

The camel form of the wire — what `fetchInfraCamelJson<…>` returns. These are the only shapes the modal layer sees.

```ts
export type LogicalDbType = 'DATABASE' | 'SCHEMA';
export type SkipReason = 'STG' | 'DEV' | 'TEMP';

export interface TestedLogicalDatabase {
  databaseName?: string;
  schemaName?: string;
  type?: LogicalDbType;
}
export interface ExcludedLogicalDatabase {   // = "skip" item, camel
  databaseName: string;
  schemaName?: string;
  skipReason: SkipReason;
  type: LogicalDbType;
}
```

> Why a separate camel domain layer (not consume the wire type directly): ADR-019 D1 — the wire snake shape must
> not leak past the boundary; CSR/UI import only these. The client re-exports `LogicalDbType` / `SkipReason` so
> components never import from `@/lib/bff/*`.

### 2.3 Modal types — REPLACE `…/logical-db/logical-db-types.ts`

The stub's `LogicalDatabase` ( `{ id, name, type:'db'|'schema', database, schema?, existingDenyReason? }` ) and
`LogicalDbModalDraft` (`{ excludedIds:Set, reasons:Record }`) are kept as the **modal's render/draft shape** —
the modal UI (`LogicalDbModal.tsx`) already renders these and need not change. What changes is **where the data
comes from** (real fetch + adapter, §4) and **what save does** (build the snake PUT body, §4.4). Two additions to
the modal type to carry the contract through:

```ts
export type LogicalDatabaseType = 'db' | 'schema';   // unchanged (modal render enum)

export interface LogicalDatabase {
  id: string;                 // `${databaseName}` or `${databaseName}.${schemaName}` — stable per resource (see §4.1)
  name: string;               // display: database or `database.schema`
  type: LogicalDatabaseType;  // 'db' | 'schema'  (maps from wire DATABASE/SCHEMA — §4.1)
  database: string;           // databaseName
  schema?: string;            // schemaName (schema rows only)
  existingDenyReason?: SkipReason;   // CHANGED: was `string`; now the typed reason when an existing skip covers this row
}

export interface LogicalDbModalDraft {
  excludedIds: ReadonlySet<string>;        // ids on the deny (right) side
  reasons: Readonly<Record<string, SkipReason>>;   // CHANGED: was Record<string,string>; reason is the typed enum
}
```

> `existingDenyReason`/`reasons` move from free `string` to `SkipReason` because the PUT body requires a valid
> `skip_reason` enum for **every** excluded row. A free-text reason cannot be serialized to the contract. The modal's
> reason editor (out of this domain's scope, but noted) must offer exactly `STG | DEV | TEMP`.

---

## 3. NEW client — `app/lib/api/logical-db.ts`

Pattern: the standard CSR direct-client (mirrors `app/lib/api/index.ts` and `app/lib/api/idc.ts`), using the
**single camel boundary** `fetchInfraCamelJson` for GETs and `fetchInfraJson` for the PUT (which carries a
snake body verbatim). Paths are passed **without** the `/install/v1` prefix — `fetchInfra*` → `toInternalInfraApiPath`
prepends `/integration/api/v1`, and the route layer forwards to upstream `/install/v1` (see §3.1). `targetSourceId`
is a `number`.

```ts
import { fetchInfraCamelJson, fetchInfraJson } from '@/app/lib/api/infra';
import type {
  TestedLogicalDatabasesResponseWire,   // imported only for the camel-of type param
  SkipLogicalDatabaseResponseWire,
  UpdateSkipLogicalDatabaseRequestWire,
} from '@/lib/bff/types/logical-db';

// Re-export enums so components import them here, not from @/lib/bff/* (boundaries.md).
export type { LogicalDbType, SkipReason } from '@/lib/bff/types/logical-db'; // (or define locally per §2.2)

const base = (targetSourceId: number) => `/target-sources/${targetSourceId}`;

// ---- Tested (left panel) ----  uses BY-RESOURCE-ID (modal has resourceId, not agentId)
export const getTestedLogicalDatabases = async (
  targetSourceId: number,
  resourceId: string,
  opts?: { signal?: AbortSignal },
): Promise<TestedLogicalDatabase[]> => {
  const data = await fetchInfraCamelJson<CamelOf<TestedLogicalDatabasesResponseWire>>(
    `${base(targetSourceId)}/tested-logical-databases/by-resource-id?resourceId=${encodeURIComponent(resourceId)}`,
    opts?.signal ? { signal: opts.signal } : undefined,
  );
  return data.logicalDatabaseList ?? [];
};

// ---- Excluded (right panel) ----  GET BY-RESOURCE-ID
export const getExcludedLogicalDatabases = async (
  targetSourceId: number,
  resourceId: string,
  opts?: { signal?: AbortSignal },
): Promise<ExcludedLogicalDatabase[]> => {
  const data = await fetchInfraCamelJson<CamelOf<SkipLogicalDatabaseResponseWire>>(
    `${base(targetSourceId)}/excluded-databases/by-resource-id?resourceId=${encodeURIComponent(resourceId)}`,
    opts?.signal ? { signal: opts.signal } : undefined,
  );
  return data.skipLogicalDatabaseList ?? [];
};

// ---- Save skip policy ----  PUT BY-RESOURCE-ID, body authored SNAKE (matches swagger)
export const updateExcludedLogicalDatabases = async (
  targetSourceId: number,
  resourceId: string,
  items: ExcludedLogicalDatabase[],
): Promise<ExcludedLogicalDatabase[]> => {
  const body: UpdateSkipLogicalDatabaseRequestWire = {
    skip_logical_database_list: items.map((it) => ({
      database_name: it.databaseName,
      schema_name: it.schemaName,            // omit/undefined for DATABASE rows
      skip_reason: it.skipReason,
      type: it.type,
    })),
  };
  const data = await fetchInfraCamelJson<CamelOf<SkipLogicalDatabaseResponseWire>>(
    `${base(targetSourceId)}/excluded-databases/by-resource-id?resourceId=${encodeURIComponent(resourceId)}`,
    { method: 'PUT', body },
  );
  return data.skipLogicalDatabaseList ?? [];
};
```

Notes / decisions:
- **`CamelOf<T>`** denotes "the camel-keyed version of wire `T`" — implement either as the explicit domain interfaces
  from §2.2 wrapped (`{ logicalDatabaseList?: TestedLogicalDatabase[] }` / `{ skipLogicalDatabaseList?: ExcludedLogicalDatabase[] }`)
  or a `CamelKeys<>` mapped type if one already exists in the repo. **Do not** parameterize `fetchInfraCamelJson`
  with the snake wire type — its return is camel; mismatched type params are an ADR-019 D6 silent-drift trap. Prefer
  the explicit `{ logicalDatabaseList?: TestedLogicalDatabase[] }` literal so the field name is checked.
- **PUT casing:** the request must be snake. `fetchInfraJson` does **no** transform, so build the snake body
  yourself (as above) — never pass the camel domain object to a writer. (The example uses `fetchInfraCamelJson` for
  the PUT *response* parse, which is correct because the PUT 200 is snake too and we want camel back. Its `options.body`
  is passed through untransformed by the underlying `fetchJson`; verify `FetchJsonOptions.body` is sent verbatim and
  is JSON-stringified without re-casing — see §3.2. If `fetchInfraCamelJson` does not accept `method/body`, use
  `fetchInfraJson<SkipLogicalDatabaseResponseWire>` for the PUT and `camelCaseKeys` the result via `fetchInfraCamelJson`'s
  helper `parseInfraCamelJson`/`camelCaseKeys`.)
- GET variants accept `AbortSignal` (DR3 — matches `idc.ts`, modal can cancel on close/resource-change).
- The plain (`agentId`) variants are **not implemented** by this client because the modal has no `agentId` (§6 D-1).
  Add them only if a future caller supplies an `agentId`; if added, the query key MUST be `agentId`, not `resourceId`.

### 3.1 NEW route handlers (CSR proxy → BFF)

The proxy is per-endpoint (no catch-all). Four NEW files under `app/integration/api/v1/target-sources/[targetSourceId]/`,
each `withV1` + `parseTargetSourceId` + `bff.logicalDb.*` + `NextResponse.json(data)` (pattern copied from
`test-connection/results/route.ts` and `resources/credential/route.ts`). They forward the required query param.

| File | Methods | Forwards |
|------|---------|----------|
| `tested-logical-databases/by-resource-id/route.ts` | GET | `resourceId` query → `bff.logicalDb.getTestedByResourceId(id, resourceId)` |
| `excluded-databases/by-resource-id/route.ts` | GET + PUT | `resourceId` query; PUT body → `getExcludedByResourceId` / `updateExcludedByResourceId(id, resourceId, body)` |

> Only the `by-resource-id` routes are required for the modal. The plain `tested-logical-databases/route.ts` and
> `excluded-databases/route.ts` (keyed on `agentId`) can be added for contract completeness; if added, they MUST read
> and forward `agentId` (not `resourceId`). Each route reads its query param via
> `new URL(request.url).searchParams.get('resourceId')` (or `'agentId'`), 400 on missing (reuse the `problemResponse`
> pattern). PUT routes parse `await request.json()` and pass through verbatim (snake) — no re-casing in the route.

### 3.2 BffClient surface — add `logicalDb` to `lib/bff/types.ts`, `http.ts`, `mock-adapter.ts`

New block on the `BffClient` interface (alongside `confirm`/`idc`):
```ts
logicalDb: {
  getTestedByResourceId: (id: number, resourceId: string) => Promise<TestedLogicalDatabasesResponseWire>;
  getExcludedByResourceId: (id: number, resourceId: string) => Promise<SkipLogicalDatabaseResponseWire>;
  updateExcludedByResourceId: (
    id: number, resourceId: string, body: UpdateSkipLogicalDatabaseRequestWire,
  ) => Promise<SkipLogicalDatabaseResponseWire>;
  // optional agentId-keyed variants for completeness (same return types)
};
```
- **`httpBff` (http.ts):** real impl. GET via `get(path)` (camelCases by default per I-3 — that is fine; the CSR
  layer camels again, idempotent on already-camel keys). The wire return type on the interface is **snake**, but
  `get()` returns camel at runtime — to keep the contract honest, type these `httpBff` methods' returns as the wire
  snake DTO and rely on the CSR `fetchInfraCamelJson` for the actual camelization in the app, OR (cleaner) have these
  three use `get(path, { raw: true })` so the route forwards snake and the **single** camel boundary stays the CSR
  client. **Decision: use `{ raw: true }` here** so casing is owned in exactly one place (the CSR client) — this is the
  literal ADR-019 D1 "one boundary" rule and avoids the double-camel. (IDC already does this; logical-DB should too,
  but for the D1 single-boundary reason, NOT because it is a sanctioned snake passthrough — it is plain camel-at-CSR.)
  Path: `` get(`/target-sources/${id}/tested-logical-databases/by-resource-id?resourceId=${encodeURIComponent(resourceId)}`, { raw: true }) ``; PUT via `put(path, body)` (already raw passthrough).
- **`mockBff` (mock-adapter.ts):** `unwrap<…Wire>(await mockLogicalDb.getTestedByResourceId(String(id), resourceId))` etc.
- **`bff` client (`lib/bff/client.ts`):** picks httpBff vs mockBff by `USE_MOCK_DATA` — no change needed, just gains the new methods.

> **`FetchJsonOptions.body` check (do before coding the PUT):** confirm `lib/fetch-json.ts` JSON-stringifies
> `options.body` and sets `Content-Type` without applying any case transform (it must send the snake body verbatim).
> The repo's existing writers (`createTargetSource`, `addAuthorizedUser`) pass `body` through `fetchInfraJson`, so the
> contract is "caller pre-shapes the body"; honor that — build snake in the client, never snakeCaseKeys blanket (D3).

---

## 4. Modal adapter — Tested (left) / Excluded (right), parent-child, dedup

Replaces the stub data path. The modal UI (`LogicalDbModal.tsx`) is unchanged; only `useLogicalDatabases.ts` (the
hook) and the save callback in the two consumers change.

### 4.1 Response → row mapping (`databaseName/schemaName/type` → `LogicalDatabase`)

For each Tested item, build a render row:
```
id      = schemaName ? `${databaseName}.${schemaName}` : databaseName     // stable per resource; unique key
name    = schemaName ? `${databaseName}.${schemaName}` : databaseName
type    = wire.type === 'SCHEMA' ? 'schema' : 'db'                         // DATABASE/SCHEMA → db/schema
database = databaseName
schema  = schemaName                                                       // undefined for DATABASE rows
```
Guard the not-required Tested fields: skip a row with no `databaseName`; default a missing `type` to `'db'` only if
`schemaName` is absent (else `'schema'`). The **id scheme is the join key** between Tested rows and Excluded items —
both sides compute the same `database[.schema]` id so set-membership works.

### 4.2 Existing-deny seeding (left panel grey-out + right panel seed)

On open, fetch **both** in parallel (matches domain §1 flow):
```
const [tested, excluded] = await Promise.all([
  getTestedLogicalDatabases(tsId, resourceId, { signal }),
  getExcludedLogicalDatabases(tsId, resourceId, { signal }),
]);
```
Then:
- Seed the draft: `excludedIds = new Set(excluded.map(denyId))`, `reasons = Object.fromEntries(excluded.map(e => [denyId(e), e.skipReason]))`, where `denyId(e) = e.schemaName ? `${e.databaseName}.${e.schemaName}` : e.databaseName` (same scheme as §4.1).
- Stamp `existingDenyReason` on each Tested render row whose id is in `excludedIds` (drives the grey-out / disabled "제외" — `isAlreadyDeny`).
- **Excluded-only items** (in the policy but not in the current Tested list — e.g. a DB excluded last round that no longer appears) must still render on the **right** panel. So the right-panel source is the **union** of Tested-rows-marked-excluded and Excluded-only items (`buildVisibleDenyRows`), not just the filtered Tested list. (Today's stub splits a single `databases` list by an `excludedIds` set, which silently **drops** excluded-only items — that is the bug this fixes.)

### 4.3 Dedup helpers (NEW — the contract the domain doc names)

Define alongside the hook/adapter (e.g. `…/logical-db/logical-db-deny.ts`), pure functions, unit-tested:
```ts
denyId(item): string                         // `${db}` or `${db}.${schema}` — single id scheme, shared
isAlreadyDeny(rowId, excludedIds): boolean   // row id ∈ current excluded set → left "제외" is a no-op (grey)
isParentDeny(row, excludedIds): boolean      // row is a SCHEMA whose parent DATABASE id ∈ excludedIds
buildVisibleDenyRows(tested, excluded, excludedIds): LogicalDatabase[]
   // = (tested rows where isAlreadyDeny) ∪ (excluded items with no matching tested row),
   //   then collapse children hidden under an excluded parent (see §4.3.1). Deduped by id.
```

#### 4.3.1 Parent–child auto-exclude (domain §1 "부모-자식 자동 처리")

- Excluding a **DATABASE** auto-excludes its child **SCHEMA**s (`isParentDeny`): when the user moves a `db` row to deny,
  add the db id to `excludedIds`; child schema rows then read as denied via `isParentDeny(child, excludedIds)` and are
  removed from the left panel.
- The **right** panel shows **only the parent DATABASE** when a database is excluded; child SCHEMAs are **hidden**
  (not listed redundantly). `buildVisibleDenyRows` drops any deny row whose parent database id is also in the deny set.
- **PUT serialization (§4.4):** when a DATABASE is excluded, emit a single `{ type: 'DATABASE', database_name, skip_reason }`
  item — do **not** also emit child SCHEMA items (the parent implies them). Only emit `{ type:'SCHEMA', database_name, schema_name, skip_reason }`
  for schemas excluded **individually** while their parent database is **not** excluded.

### 4.4 Save (draft → snake PUT body)

`onSave(draft)` builds `ExcludedLogicalDatabase[]` from the draft, then calls `updateExcludedLogicalDatabases(tsId, resourceId, items)`:
```
items = visibleDenyRows(draft).map(row => ({
  databaseName: row.database,
  schemaName: row.type === 'schema' ? row.schema : undefined,
  type: row.type === 'schema' ? 'SCHEMA' : 'DATABASE',
  skipReason: draft.reasons[row.id] ?? existingReasonFor(row) ?? /* required → must default; see note */,
}))
```
- **PUT is full-replace** (swagger summaries: "전체 교체(replace)"). Send the **entire** desired skip set, not a delta.
- Every item needs a `skip_reason` (required enum). If the modal's reason UI is not yet built, a row excluded without an
  explicit reason cannot be serialized — **flag**: either (a) default to a sentinel like `TEMP` (matches domain "TMP=임시"
  intent — note swagger spells it `TEMP`), or (b) block save until each excluded row has a reason. Recommend (b) for
  correctness; confirm with product. This is the one behavior the stub never had to handle.
- On success, replace the toast: the two consumers (`LogicalDbSlot.tsx` line 33–36, `IdcStep5ConnectionTest.tsx`
  line 173–175) currently `toast.info('논리 DB 정보 저장은 BFF 연동 후 활성화됩니다.')`. Replace with the real call + success
  toast + `onApplied()` close, and (per domain §7 / spec §7) trigger a completion-status refetch so the badge can
  flip `LATEST_TEST_CONNECTION_SUCCESS → LOGICAL_DATABASE_RECENTLY_UPDATED` (that endpoint is Domain A's; just fire the
  re-fetch callback the parent passes).

### 4.5 Hook rewrite — `useLogicalDatabases.ts`

Replace `buildFakeDatabases` + `setTimeout` with the real parallel fetch (§4.2) wrapped in the existing
loading/ready/error state machine (`LogicalDbDataState`) and `retry`/abort (keep the current `activeKey`/nonce reset
idiom — it is sound). The hook's return shape (`{ state, retry }`) and `LogicalDbDataState` stay; `state.databases`
becomes the **left-panel** Tested rows and the hook additionally surfaces the seeded `initialDraft` (excludedIds +
reasons from §4.2) so the modal opens with the existing policy pre-applied. Pass `targetSourceId` into the hook (the
stub only took `resourceId`; the real fetch needs both — thread `targetSourceId` from `LogicalDbModalLoader`'s caller).

> Consumer wiring: `LogicalDbModalLoader` (line 24) and both call sites (`LogicalDbSlot`, `IdcStep5ConnectionTest`)
> must now pass `targetSourceId`. `LogicalDbSlot` has it via the page params/`ConfirmedIntegrationDataProvider` context;
> `IdcStep5ConnectionTest` already has the target source id in scope. The modal `onSave` becomes async (calls the PUT)
> — handle pending/error in the loader (disable 저장, surface failure toast).

---

## 5. Mock — NEW `lib/bff/mock/logical-db.ts` + seed (wire-snake == swagger)

Mocks author the **swagger wire shape (snake)** so mock output == contract (PLAN P1/§2 parity). Follow the
`lib/bff/mock/idc.ts` structure: `authorize(targetSourceId)` guard, `NextResponse.json(...)`, error envelope. Add a
small stateful seed (per `targetSourceId`+`resourceId`) so the PUT round-trips (GET-after-PUT returns what was saved) —
mirror how `mock-idc.ts` keeps an in-memory resource list.

`mockBff.logicalDb` methods (in mock-adapter.ts) wrap these via `unwrap<…Wire>(...)`.

### 5.1 Seed — exercises dedup + parent-child + excluded-only

**Tested** (`logical_database_list`, for a sample `resourceId`):
```json
{ "logical_database_list": [
  { "database_name": "live",      "type": "DATABASE" },
  { "database_name": "live", "schema_name": "public",    "type": "SCHEMA" },
  { "database_name": "live", "schema_name": "analytics", "type": "SCHEMA" },
  { "database_name": "prd",       "type": "DATABASE" },
  { "database_name": "prd",  "schema_name": "temp",      "type": "SCHEMA" },
  { "database_name": "stg",       "type": "DATABASE" },
  { "database_name": "dev",       "type": "DATABASE" },
  { "database_name": "reporting", "type": "DATABASE" },
  { "database_name": "reporting","schema_name": "public", "type": "SCHEMA" }
]}
```
**Excluded** (`skip_logical_database_list`, initial policy) — chosen to exercise every path:
```json
{ "skip_logical_database_list": [
  { "database_name": "stg",  "skip_reason": "STG", "type": "DATABASE" },
  { "database_name": "dev",  "skip_reason": "DEV", "type": "DATABASE" },
  { "database_name": "prd",  "schema_name": "temp", "skip_reason": "TEMP", "type": "SCHEMA" },
  { "database_name": "legacy", "skip_reason": "TEMP", "type": "DATABASE" }
]}
```
Coverage this seed produces:
- **dedup / grey-out (`isAlreadyDeny`):** `stg`, `dev` (DATABASE) and `prd.temp` (SCHEMA) appear in Tested **and**
  Excluded → left-panel "제외" disabled for them; they render on the right.
- **parent-child (`isParentDeny`):** excluding `prd` (DATABASE) must hide/auto-exclude `prd.temp`; the seed starts with
  the SCHEMA-level exclusion of `prd.temp` so the test can also exercise "promote child→parent" by excluding `prd` and
  confirming the child item collapses under the parent in `buildVisibleDenyRows` and the PUT emits only `prd` DATABASE.
- **excluded-only:** `legacy` is in the policy but **absent** from the Tested list → must still render on the right
  panel (proves `buildVisibleDenyRows` unions excluded-only items; this is the stub's silent-drop bug).
- **enum coverage:** `STG`, `DEV`, `TEMP` all present (confirms `TEMP` spelling end-to-end).
- **PUT round-trip:** after `updateExcludedByResourceId`, the GET returns the new set (stateful seed).

> Keep the seed PII-free (placeholder names only — `feedback_sit_placeholder_pii`). The stub's
> `MOCK_TOPOLOGY` (live/prd/stg/dev/reporting) is reused so existing visual expectations hold.

---

## 6. Discrepancies — each resolved

**D-1 (TOP). Query param `agentId` vs `resourceId`.** Swagger: endpoints 1/3/4 use **`agentId`**; 2/5/6 use
**`resourceId`**. Brief said all six use `resourceId` — incorrect. **Resolution:** the modal uses the **`by-resource-id`**
variants (it only has `ConfirmedResource.resourceId`); the client implements 2/5/6 with the `resourceId` query. The
`agentId` variants are out of the modal's path; implement only if/when a caller has an `agentId`, and then key on
`agentId`. Author the routes/mocks for whichever family you wire (by-resource-id required; agentId optional).

**D-2 (TOP). `TEMP` vs `TMP`.** Domain doc (`01-…-spec.md` lines 64, 76) says `TMP`; swagger enum is `STG|DEV|TEMP`.
**Resolution: `TEMP`.** All wire/domain types, mock seeds, and the reason picker use `TEMP`. Matches PLAN §4.1. Confirm
with BFF that the emitted value is literally `TEMP`.

**D-3. Stub → real (no migration, a replacement).** `useLogicalDatabases` returns fake data; no client/type/mock/route
exists. **Resolution:** build everything NEW (§2–§5); keep the modal UI + draft/render types (§2.3) and the
loading/error/retry state machine; replace only the data source and the save path. Remove `buildFakeDatabases` and
`MOCK_TOPOLOGY` from the hook once the real fetch lands (move the topology into the **mock seed**, §5.1).

**D-4. Tested item under-specified.** `TestedLogicalDatabaseItem` marks **nothing** required (not even
`database_name`/`type`) and the list wrapper is optional. **Resolution:** treat all Tested fields as optional in the
wire type (§2.1), default missing `?? []` for the list, and skip malformed rows in the adapter (§4.1). The Excluded
item DOES require `database_name`/`skip_reason`/`type` — type those non-optional.

**D-5. PUT is full-replace + reason required.** Save must send the entire skip set, and every item needs a
`skip_reason` enum (the stub had free-text/no-reason). **Resolution:** §4.4 — full set, parent collapses to one
DATABASE item, and either block save until each excluded row has a reason (recommended) or default `TEMP`. Decide with
product.

**D-6. Two list field names.** Tested = `logical_database_list`; Excluded/Skip = `skip_logical_database_list`. Easy to
conflate. **Resolution:** distinct wire + domain field names (§2.1/§2.2); the GET parsers read the correct one each.

**D-7. Old (pre-swagger) path shape.** `01-…-spec.md` §7 lists `logical-databases/tested/{resourceId}` etc. (path
segment, not query). **Resolution:** dead — the swagger uses `tested-logical-databases/by-resource-id?resourceId=…`
(query). Use the swagger form only; the old shape never reaches code.

**D-8. ADR-019 D6 / casing single-boundary.** No dynamic-keyed maps and no sanctioned snake passthrough here, so **no**
`getSnakeRaw`/`OpaqueKeys`. Casing is owned in exactly one place: the CSR client (`fetchInfraCamelJson`); to keep that
single boundary, the `httpBff` logical-DB GETs use `{ raw: true }` (§3.2) so the route forwards snake — purely for the
one-boundary rule, not because the payload is a sanctioned opt-out. No `as T` on the response path (the explicit
camel literal type carries it).

---

## 7. Cross-domain seam (note, not in this domain's files)

Saving the skip policy changes completion-status: `LATEST_TEST_CONNECTION_SUCCESS → LOGICAL_DATABASE_RECENTLY_UPDATED`
(domain §7). That endpoint (`test-connection/completion-status`) is **Domain A**. This domain's only obligation is to
fire the parent-provided refetch/`onApplied` after a successful PUT so A's badge re-reads. Do not implement
completion-status here.

---

## 8. Files touched (this domain)

NEW:
- `lib/bff/types/logical-db.ts` — wire DTOs (§2.1)
- `app/lib/api/logical-db.ts` — CSR client + camel domain types (§2.2, §3)
- `app/integration/api/v1/target-sources/[targetSourceId]/tested-logical-databases/by-resource-id/route.ts` (§3.1)
- `app/integration/api/v1/target-sources/[targetSourceId]/excluded-databases/by-resource-id/route.ts` (§3.1)
- `lib/bff/mock/logical-db.ts` + seed (§5)
- `app/integration/target-sources/[targetSourceId]/_components/logical-db/logical-db-deny.ts` — dedup/parent-child helpers (§4.3)
- (optional, for contract completeness) plain `tested-logical-databases/route.ts` + `excluded-databases/route.ts` (agentId)

EDIT:
- `lib/bff/types.ts` — add `logicalDb` to `BffClient` (§3.2)
- `lib/bff/http.ts` — `httpBff.logicalDb` (§3.2)
- `lib/bff/mock-adapter.ts` — `mockBff.logicalDb` (§3.2)
- `…/logical-db/logical-db-types.ts` — `existingDenyReason`/`reasons` → `SkipReason` (§2.3)
- `…/logical-db/useLogicalDatabases.ts` — real fetch + seeded draft; drop fake data (§4.5)
- `…/logical-db/LogicalDbModalLoader.tsx` — thread `targetSourceId`, async `onSave` (§4.5)
- `…/logical-db/LogicalDbSlot.tsx` (l.33–36) + `…/idc/steps/IdcStep5ConnectionTest.tsx` (l.173–175) — real save, drop stub toast (§4.4)

UNCHANGED: `LogicalDbModal.tsx` (render only — drives off the same `LogicalDatabase`/`LogicalDbModalDraft`).

---

## 9. Self-review

- **Review 1: clean** — checked all 6 paths char-for-char against swagger lines 202–515 / 1824–1975 (incl.
  `tested-logical-databases` vs `excluded-databases`, `/by-resource-id` suffix); confirmed query param is `agentId`
  on 1/3/4 and `resourceId` on 2/5/6; confirmed PUT #4/#6 `requestBody.required: true`; confirmed prefix `/install/v1`.
- **Review 2: clean** — checked every schema field + casing + required + enum against swagger 4353–4390 / 5175–5193:
  `SkipLogicalDatabaseItem` requires `database_name|skip_reason|type`, enums `STG|DEV|TEMP` (TEMP) and `DATABASE|SCHEMA`;
  wrappers `skip_logical_database_list` / `logical_database_list` (both NOT required); `TestedLogicalDatabaseItem` has
  no required fields. Domain camel mapping (`database_name→databaseName`, `skip_reason→skipReason`,
  `*_list→*List`) verified against `lib/object-case.ts`.
- **Review 3: clean** — checked Response→Adapter→UI: GET tested → `logicalDatabaseList ?? []` → left rows; GET excluded
  → `skipLogicalDatabaseList ?? []` → seed draft + right panel; PUT body re-snaked verbatim (full replace, parent
  collapses to one DATABASE item); mock seed emits snake == swagger and exercises dedup/parent-child/excluded-only;
  no `as T` on the response path, single camel boundary (D1), no `getSnakeRaw`/`OpaqueKeys` (none warranted, D6).
