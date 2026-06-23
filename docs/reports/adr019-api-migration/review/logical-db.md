# Adversarial CONTRACT Review — logical-db domain (commit bfb5f5a)

Authoritative contract: `docs/swagger/install-v1.yaml`. Spec: `specs/B-logical-db.md`.
Pattern reference: test-connection (merged). Scope: tested-logical-databases
[+/by-resource-id], excluded-databases GET/PUT [+/by-resource-id].

## VERDICT: CLEAN (0 confirmed contract issues)

Every checked axis matches swagger verbatim. Details below; no `file:line` defects found.

---

## 1. PATH / METHOD / PARAMS vs swagger — PASS

Modal wires only the `by-resource-id` family (it has `resourceId`, never `agentId` — spec D-1).
Swagger declares `agentId` on 1/3/4 and `resourceId` on 2/5/6; the code keys the wired
endpoints on `resourceId` correctly, so the brief's "all six use resourceId" error is moot for
what was implemented.

| Endpoint | swagger | code | match |
|---|---|---|---|
| GET tested by-resource-id | `/target-sources/{id}/tested-logical-databases/by-resource-id?resourceId=` (1900–1975) | `http.ts:230`, `app/lib/api/logical-db.ts:61`, route `tested-logical-databases/by-resource-id/route.ts` | ✓ |
| GET excluded by-resource-id | `…/excluded-databases/by-resource-id?resourceId=` (359–434) | `http.ts:234`, `logical-db.ts:74`, route GET | ✓ |
| PUT excluded by-resource-id | `…/excluded-databases/by-resource-id?resourceId=` (435–515), `requestBody.required:true` | `http.ts:238` (`put`), `logical-db.ts:95`, route PUT | ✓ |

- `resourceId` is `encodeURIComponent`-escaped in all three CSR + http paths.
- Routes read `searchParams.get('resourceId')`, 400 (`INVALID_PARAMETER`) when missing, forward via `bff.logicalDb.*`. PUT parses `request.json()` and passes through verbatim (no re-casing).
- `agentId` plain variants (1/3/4) intentionally NOT implemented (no caller) — spec D-1; not a gap.

## 2. REQUEST + RESPONSE wire schema vs swagger — PASS

`lib/bff/types/logical-db.ts` is field-for-field with swagger:
- `SkipLogicalDatabaseItem` (4353–4374): required `database_name`/`skip_reason`/`type`, optional `schema_name`; enums `skip_reason ∈ {STG,DEV,TEMP}`, `type ∈ {DATABASE,SCHEMA}`. ✓ (`TEMP`, never `TMP` — grep clean across the whole domain.)
- `TestedLogicalDatabaseItem` (5175–5186): nothing required; all three optional. ✓
- `UpdateSkipLogicalDatabaseRequest` (4375–4383): required `skip_logical_database_list`. ✓
- Wrappers `TestedLogicalDatabasesResponse.logical_database_list` / `SkipLogicalDatabaseResponse.skip_logical_database_list` — both NOT required (optional in wire type). ✓
- **Two list names kept distinct** end-to-end (Tested=`logical_database_list`, Excluded=`skip_logical_database_list`) — never conflated. ✓
- PUT body authored snake in `logical-db.ts:86–93` (omits `schema_name` for DATABASE rows). ✓

## 3. Response → normalizer → domain → modal UI — PASS (lossless)

- `lib/logical-db-response.ts`: hand-written normalizers over the camelCased payload (no `as T`, no zod — mirrors test-connection). Tested drops rows with no `databaseName` (cannot key); Excluded drops rows missing any required field (cannot re-serialize). Out-of-contract enum → row-drop, not throw. ✓
- `logical-db-deny.ts`: single `denyId` join scheme shared both panels; parent-child collapse on the right (`buildVisibleDenyRows`) and in PUT (`draftToExcludedItems` emits one DATABASE item, omits child schemas under an excluded parent); excluded-only items unioned in (the stub's silent-drop bug is fixed). No UI-read field dropped; no read-but-unproduced field.
- Consumers wired for real: `LogicalDbModalLoader` calls `updateExcludedLogicalDatabases`, both call sites (`LogicalDbSlot`, `IdcStep5ConnectionTest`) thread `targetSourceId`, replace the stub toast with success/error, and refetch (`retry()` / `getProject`) per the Domain-A badge seam.

## 4. Mock (`lib/bff/mock/logical-db.ts`) — PASS

Emits wire-snake == swagger. Per-step seed: connection-test steps (5/6/7) get topology + skip policy; other steps empty. Module-local Map makes PUT round-trip (GET-after-PUT). Seed exercises dedup/grey-out (`stg`,`dev`,`prd.temp`), parent-child (`prd ⊃ prd.temp`), excluded-only (`legacy`), all three enums. `deny.test.ts` fixture mirrors this seed and asserts parent-collapse + excluded-only union + reason spelling.

## 5. Governing rule (only install-v1 endpoints) — PASS

Grep of the domain (client, http, routes) finds no call to any endpoint absent from `install-v1.yaml`. http GETs use `getSnakeRaw` (`get(path,{raw:true})`) so casing is owned solely at the CSR `fetchInfraCamelJson` boundary (ADR-019 D1/D8); PUT uses `put` (already raw passthrough).

---

## Observations (NOT defects)

- The spec's §3 `CamelOf<Wire>` literal was implemented instead as `fetchInfraCamelJson<unknown>` → hand-written normalizer. This is **stronger**, not weaker: the explicit field-by-field normalizer can't silently drift the way a mismatched type param could, and it matches the merged test-connection pattern. No contract risk.
- http.ts comment calls `getSnakeRaw` "sanctioned snake passthrough"; spec D-8 stresses it is used here purely for the single-boundary rule, not because the payload is a sanctioned opt-out. Wording only — behavior is correct (raw forward, camel once at CSR).
