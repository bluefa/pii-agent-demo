# E — Target Source Core (detail · install · resources · scan)

> Domain spec for the ADR-019 `/install/v1` migration. Scope = 11 endpoints (target-source core + install confirm + resources + scan).
> Authorities: `docs/swagger/install-v1.yaml` (verbatim), `docs/reports/adr019-api-migration/PLAN.md`, `~/pii-agent-migration-notes/01-target-source-detail-spec.md`.
> Contract rule recap: responses snake → `camelCaseKeys` at the proxy boundary → camel domain (D1/D2); requests match swagger casing (D3); data-keyed maps marked `OpaqueKeys` (D2.3); sanctioned opt-outs greppable, no silent `as T` (D6).

---

## 0. Architecture context (3-hop — read first)

These endpoints are **not** consumed directly off the BFF client. The flow is **three hops**:

```
CSR (app/lib/api/index.ts, app/lib/api/scan.ts)
  → fetchInfraJson / fetchInfraCamelJson         (app/lib/api/infra.ts)
  → Next.js route handler                         (app/integration/api/v1/target-sources/[targetSourceId]/**/route.ts)
      → withV1(...) wrapper                        (app/api/_lib/handler.ts)
      → bff.<domain>.<method>(...)                 (lib/bff/client.ts → httpBff | mockBff)
        → httpBff (lib/bff/http.ts)                real:  GET=camelCaseKeys, POST/PUT=raw passthrough
        | mockBff (lib/bff/mock-adapter.ts)        mock:  unwrap() = response.json(), NO camelCaseKeys
          → mock handler (lib/bff/mock/*.ts)
```

Path mapping (`lib/infra-api.ts`): CSR path `/target-sources/{id}/…` → internal `/integration/api/v1/target-sources/{id}/…` (route) → upstream `/install/v1/target-sources/{id}/…` (swagger). **The swagger `/install/v1` path suffix is what `httpBff` must request; the CSR uses the bare `/target-sources/…` suffix.**

**Route handlers actively re-shape** (this is the real adapter layer, not pass-through):
- scan routes re-map fields and **invent** a `page` envelope (`{content, page:{totalElements,totalPages,number,size}}`) not present in swagger `PageScanJobResponse`.
- `process-status` route overrides `process_status` with the project's own status from `bff.targetSources.get`.
- `secrets` route re-maps credential fields.

Two consequences for this migration:
1. The **upstream wire shape** (httpBff ↔ swagger) is the contract this spec pins. The **route→CSR shape** is an internal 2-hop contract that must be *preserved* (it is what the UI already consumes) unless a field genuinely moved.
2. **Mock parity (P1):** today `mock-adapter.unwrap()` does `response.json()` with **no** `camelCaseKeys` (`lib/bff/mock-adapter.ts:63`), and mock handlers are authored inconsistently (scan mock `getStatus`/`getHistory` emit camel; `create` emits snake). Under the new model, **mocks author swagger wire (snake) and route through `camelCaseKeys`** like httpBff. Each mock below is given in **swagger-snake**.

---

## 1. Current code map (paths + symbols)

| Layer | File | Symbols |
|---|---|---|
| Foundation casing | `lib/object-case.ts` | `camelCaseKeys` / `toCamelCase` — **recurses into every nested plain-object value** (corrupts data-keyed maps) |
| Real client | `lib/bff/http.ts` | `get` (GET→camel, `{raw}` opt-out), `send`/`post`/`put` (raw passthrough); `confirm.*`, `scan.*`, `targetSources.get`, `projects.credentials` |
| Mock client | `lib/bff/mock-adapter.ts` | `unwrap<T>()` (no camel), `confirm.*`, `scan.*`, `targetSources.get`, `projects.credentials` |
| Mock handlers | `lib/bff/mock/confirm.ts` | `getResources`, `getConfirmedIntegration`, `getApprovedIntegration`, `getProcessStatus`, `updateResourceCredential`, `confirmInstallation` |
| | `lib/bff/mock/scan.ts` | `getStatus`, `getHistory`, `create` (+ `toResourceCountMap`) |
| | `lib/bff/mock/target-sources.ts` | `get` (envelope `{targetSource}`), `toBffTargetSourceInfo` |
| Route handlers | `app/integration/api/v1/target-sources/[targetSourceId]/route.ts` | GET detail → `extractTargetSource` |
| | `…/process-status/route.ts` | GET → `normalizeProcessStatusResponse` + project-status override |
| | `…/resources/route.ts` | GET → `bff.confirm.getResources` (pass-through) |
| | `…/confirmed-integration/route.ts` | GET → `normalizeConfirmedIntegration` (404 if empty) |
| | `…/approved-integration/route.ts` | GET → `normalizeApprovedIntegration` (404 mapping) |
| | `…/secrets/route.ts` | GET → re-maps to `{name, createTimeStr, labels?}` |
| | `…/resources/credential/route.ts` | PUT → pass body to `bff.confirm.updateResourceCredential` |
| | `…/scan/route.ts` · `…/scanJob/latest/route.ts` · `…/scan/history/route.ts` | re-map scan fields; history builds `page` envelope |
| | `…/pii-agent-installation/confirm/route.ts` | POST → `bff.confirm.confirmInstallation` (no body) |
| CSR | `app/lib/api/index.ts` | `getProject`(243), `getConfirmResources`(297), `getConfirmedIntegration`(401), `getApprovedIntegration`(427), `getProcessStatus`(628), `getSecrets`(637), `updateResourceCredential`(717), `confirmInstallation`(736) |
| | `app/lib/api/scan.ts` | `startScan`, `getLatestScanJob`, `getScanHistory` |
| Domain normalizers | `lib/target-source-response.ts` | `extractTargetSource`, `normalizeTargetSourceProcessStatus` |
| | `lib/resource-catalog-response.ts` | `extractResourceCatalog`, `ResourceCatalogItemResponse` |
| | `lib/confirmed-integration-response.ts` | `extractConfirmedIntegration` |
| | `lib/approval-bff.ts` | `normalizeApprovedIntegration`(512), `normalizeConfirmedIntegration`(536), `normalizeProcessStatusResponse`(558), `ResourceConfigDto`, `ApprovedIntegrationResponseDto`, `ProcessStatusResponseDto` |
| Wire types | `lib/bff/types/{scan,confirm,target-sources}.ts` | `ScanCreateResult` (`resource_count_by_resource_type` ⇒ `OpaqueKeys` target), `ScanHistoryPageResponse`, `CreateTargetSourceResult`, re-exports |
| Domain types | `lib/types.ts` | `V1ScanJob`(523, `resourceCountByResourceType` ⇒ `OpaqueKeys`), `SecretKey`(366) |

---

## 2. Endpoint contracts (verbatim from swagger)

All paths carry the `/install/v1` prefix. Path param is `{targetSourceId}` (int64) **except** `azure/scan-app` which uses `{target_source_id}` — not in this domain.

### E1 · GET `…/{targetSourceId}` — getTargetSourceDetail → `TargetSourceDetail`

**Wire (snake):**
```
TargetSourceDetail {
  description: string
  target_source_id: int64
  service_code: string
  service_name: string
  process_status: enum { IDLE, PENDING, CONFIRMING, CONFIRMED, INSTALLED, CONNECTED, COMPLETED }
  cloud_provider: enum { AWS, GCP, AZURE, IDC, UNKNOWN }
  created_at: date-time
  metadata: TargetSourceMetadata        // (not expanded; opaque object passed to extractTargetSource)
}
```
**Domain (camel, after `camelCaseKeys`):** `{description, targetSourceId, serviceCode, serviceName, processStatus, cloudProvider, createdAt, metadata}`.

Mapping trace: httpBff `targetSources.get` → camel → route `extractTargetSource(data)` (`lib/target-source-response.ts`). `extractTargetSource` reads `value.targetSourceId` (required), `createdAt`, `processStatus` (via `normalizeTargetSourceProcessStatus` — maps `CONFIRMING→APPLYING_APPROVED`, `INSTALLED→WAITING_CONNECTION_TEST`, etc.), `cloudProvider`, `metadata`, plus optional `serviceCode`. **CSR** `getProject` (`index.ts:243`) calls `fetchInfraCamelJson` then `extractTargetSource` again (idempotent).

**vs current:** SAME path. **RESHAPE in mock only:** mock `target-sources.get` returns envelope `{ targetSource: {...} }` (`mock/target-sources.ts:379`); `extractTargetSource` unwraps `.targetSource`, so it still works, but swagger is **flat**. New mock must emit the flat `TargetSourceDetail` snake shape. Note swagger has **no** `name`/`projectCode`/`isRejected` — `extractTargetSource` already defaults these (`name = projectCode || TS-{id}`), so absence is tolerated.

⚠ **Field-name gap:** swagger uses `service_name` (camel `serviceName`); `extractTargetSource` does not read it (only `serviceCode`). Non-blocking (extra field ignored), note for completeness.

---

### E2 · GET `…/process-status` — getProcessStatus → `ProcessStatusResponseDto`

**Wire (snake):**
```
ProcessStatusResponseDto {
  target_source_id: int64
  process_status: enum { IDLE, PENDING, CONFIRMING, CONFIRMED, INSTALLED, CONNECTED, COMPLETED }
  healthy: enum { UNKNOWN, HEALTHY, UNHEALTHY, DEGRADED }
  evaluated_at: date-time
}
```
**Domain (camel):** `{targetSourceId, processStatus, healthy, evaluatedAt}`.

Mapping trace: httpBff `confirm.getProcessStatus` GET → camel → route (`process-status/route.ts`) wraps in `normalizeProcessStatusResponse(data, {target_source_id})`, then **overrides** `process_status` with the project's status (`extractTargetSource(bff.targetSources.get(id)).processStatus → toBffApprovalProcessStatus`). Route emits snake `{target_source_id, process_status, healthy, evaluated_at}`. **CSR** `getProcessStatus` (`index.ts:628`) calls `fetchInfraJson` (raw) then `normalizeProcessStatusResponse` again → domain `ProcessStatusResponse {targetSourceId, processStatus, healthy, evaluatedAt}` (`index.ts:621`).

⚠ **Casing transition note:** `normalizeProcessStatusResponse` (`approval-bff.ts:558`) reads **both** `record.target_source_id` and `record.targetSourceId`, and `record.healthy ?? record.health`. Once httpBff camelizes the snake wire, the snake branch becomes dead but harmless. Keep dual-read (D6: no behavior change), or pin to camel post-`camelCaseKeys`. **Do NOT** add a second transform.

**vs current:** SAME path/shape at contract level. **RESHAPE in mock:** mock `getProcessStatus` (`mock/confirm.ts:999`) emits `{ target_source_id, process_status, status_inputs:{has_confirmed_integration,…}, evaluated_at }` — it has **`status_inputs`** and **no `healthy`**. New mock must emit swagger `healthy` enum and drop `status_inputs` (or the route/normalizer must stop depending on it — verify no consumer reads `status_inputs`/`statusInputs`). FLAG D-1.

---

### E3 · GET `…/resources` — getRecommendedResources → `CloudResourceResponse`

**Wire (snake):**
```
CloudResourceResponse {
  resources: TargetSourceResourceItemDto[]
  total_count: int32
}
TargetSourceResourceItemDto {
  selected: boolean
  metadata: TargetSourceResourceMetadataDto      // required
  resource_id: string
  resource_name: string
  resource_type: enum  // 48 values: AWS_ATHENA … IDC_RESOURCE (see §App-A)
  integration_category: enum { TARGET, NO_INSTALL_NEEDED, INSTALL_INELIGIBLE }
  recommend_fail_reason: enum { GCP_CLOUD_SQL_HAS_PUBLIC_IP, GCP_CLOUD_SQL_HAS_INTERNAL_HTTP_LOAD_BALANCER_SUBNET, AZURE_RESOURCE_PRIVATE_ENDPOINT_CONNECTION_FAILED }
  exclusion_reason: string
}
TargetSourceResourceMetadataDto {
  provider: enum { AWS, GCP, AZURE, IDC, UNKNOWN }
  region: string
  host: string
  port: int32
  networkInterfaces: NetworkInterfaceDto[]        // ⚠ CAMEL key inside a snake DTO
  resource_type: enum  // same 48
  database_type: string
  oracle_service_id, credential_id, network_interface_id, ip_configuration: string
  project_id, instance_name, host_network, host_project, cloud_sql_type: string
  subscription_id, resource_group, server_name: string
  idc_host_format: enum { IP, HOST }
  idc_ips: string[]
  idc_host: string
  idc_source_ips: string[]
  nlb_index: int32
}
NetworkInterfaceDto {
  networkInterfaceId: string                      // ⚠ CAMEL
  ipConfigurationName: string[]                   // ⚠ CAMEL
}
```
**Domain (camel):** `ResourceCatalogResponse {resources: ResourceCatalogItemResponse[], totalCount}` — note CSR uses `totalCount` (camel), wire is `total_count`.

Mapping trace: httpBff `confirm.getResources` (`http.ts:234`) does `extractResourceCatalog(get<…>(…))` — the GET is camelized first, then `extractResourceCatalog` (`lib/resource-catalog-response.ts`) normalizes. `extractResourceCatalog` is **shape-tolerant**: it reads both snake+camel keys, infers provider from resource_type, maps `database_type` via `DATABASE_TYPE_BY_RESOURCE_TYPE`, and re-camelizes `metadata` internally (`normalizeMetadata` calls `camelCaseKeys(metadata)`). Produces `{id, resource_id, name, resource_type, database_type, integration_category, host, port, oracle_service_id, network_interface_id, ip_configuration_name, scan_status, metadata}` (snake field names in this internal type). Route `resources/route.ts` passes it straight through. **CSR** `getConfirmResources` (`index.ts:297`) `fetchInfraCamelJson` → `ConfirmResourcesResponse {resources: ConfirmResourceItem[], totalCount}` (camel — `resourceId`, `resourceType`, `databaseType`, `integrationCategory`, `scanStatus`, etc.).

⚠ **Casing islands (D2/D6 note):** `networkInterfaces`, `NetworkInterfaceDto.networkInterfaceId`, `ipConfigurationName` are **already camelCase in the wire**. `camelCaseKeys` is idempotent on them (no `_` → unchanged). No `OpaqueKeys` needed, but the mock must author them **camel** to match swagger verbatim.

**vs current:** SAME path. **Field mapping note:** `extractResourceCatalog` produces a richer domain item than `ResourceConfigDto`; it does not 1:1 mirror `TargetSourceResourceItemDto` (e.g. swagger `recommend_fail_reason`/`exclusion_reason`/`selected` are not surfaced in `ResourceCatalogItemResponse`). Confirm whether the recommend/exclusion fields are needed by Step-1/Step-2 UI (Explore: catalog consumer). If not consumed, leave unmapped (D-2, low). Mock = swagger snake (+ camel NIC island), route through `camelCaseKeys`.

---

### E4 · GET `…/confirmed-integration` — getConfirmedIntegration → `ConfirmedIntegrationResponse`

**Wire (snake):**
```
ConfirmedIntegrationResponse { resource_infos: ResourceConfigDto[] }
ResourceConfigDto {
  resource_id, resource_type, database_type: string
  port: int32
  host, oracle_service_id, network_interface_id, ip_configuration, credential_id, database_region, resource_name: string
  agent_id, athena_region_resource_id, protocol, secret_info: string
  db_target_ip_list: string[]
  public_domain_name_list: string[]
  private_domain_name_list: string[]
  idc_host_format: enum { IP, HOST }
  idc_ips: string[]
  idc_host: string
  idc_source_ips: string[]
  nlb_index: int32
}
```
**Domain:** `BffConfirmedIntegration { resource_infos: ConfirmedIntegrationResourceInfo[] }` (snake field names internally).

Mapping trace: httpBff `confirm.getConfirmedIntegration` (`http.ts:242`) does `extractConfirmedIntegration(get<…>(…))` — GET camelized, then `extractConfirmedIntegration` (`lib/confirmed-integration-response.ts`) **unwraps the optional `confirmed_integration` envelope** (`'confirmed_integration' in payload ? payload.confirmed_integration : payload`) and normalizes each `resource_info` (legacy `endpoint_config` branch + flat branch; `ip_configuration` → `ip_configuration_name`). Route `confirmed-integration/route.ts` runs `normalizeConfirmedIntegration` (`approval-bff.ts:536`) → `{resource_infos: ResourceConfigDto[]}` and returns 404 if empty. **CSR** `getConfirmedIntegration` (`index.ts:401`) re-runs `extractConfirmedIntegration`.

**vs current:** SAME path + SAME key (`resource_infos`). Mock `getConfirmedIntegration` (`mock/confirm.ts:687`) already returns flat `{resource_infos:[…]}`. ✅ **No envelope mismatch here** (contrast E5). Mock fields use snake already. **Gap:** swagger `ResourceConfigDto` adds `agent_id, athena_region_resource_id, protocol, secret_info, db_target_ip_list, public_domain_name_list, private_domain_name_list, idc_host_format, idc_ips, idc_host, idc_source_ips, nlb_index` that the domain `ConfirmedIntegrationResourceInfo` / `lib/approval-bff.ts` `ResourceConfigDto` **do not carry**. Step-4/Step-7 IDC + Athena UI may need `athena_region_resource_id`, `idc_*`, `nlb_index` (Explore: confirmed-integration consumer). FLAG D-3: extend domain type + normalizer to surface IDC/Athena fields, else they silently drop. `database_uri_list` is NOT here (that is on `TestConnectionAgentResult`, other domain).

---

### E5 · GET `…/approved-integration` — getApprovedIntegration → `ApprovedIntegrationResponseDto`

**Wire (snake) — RESOLVED (PLAN ⚠):**
```
ApprovedIntegrationResponseDto {
  id: int64
  request_id: int64
  approved_at: date-time
  approved_by: ActorDto { user_id: string }
  resources: TargetSourceResourceItemDto[]      // ⚠ key is `resources`, items are the rich ItemDto (E3), NOT ResourceConfigDto
}
```
404 is a documented response ("No approved integration found").

**Domain (route emits, snake):** `{approved_integration: {id, request_id, approved_at, approved_by, resource_infos, excluded_resource_infos?}}`.

Mapping trace: httpBff `confirm.getApprovedIntegration` (`http.ts:247`) = bare `get<unknown>(…)` (camelized). Route `approved-integration/route.ts` runs `normalizeApprovedIntegration` (`approval-bff.ts:512`), maps `BffError 404 → APPROVED_INTEGRATION_NOT_FOUND` problem. `normalizeApprovedIntegration` **unwraps `approved_integration` envelope** then reads `record.resource_infos` (→ `toResourceConfigDto`), `record.id/request_id/approved_at/approved_by`, and `excluded_resource_infos`. **CSR** `getApprovedIntegration` (`index.ts:427`) re-normalizes and reads `payload.resource_infos`, `payload.approved_by?.user_id`, `payload.excluded_resource_infos`, deriving `excluded_resource_ids`/`exclusion_reason`.

⚠ **MAJOR RESHAPE — D-4 (highest priority discrepancy in this domain):**
- Swagger key is **`resources`**; current normalizer + CSR read **`resource_infos`** → against real swagger wire they get `[]`. Must add `resources` as the source key (keep `resource_infos` only as legacy fallback, D6-greppable).
- Swagger items are **`TargetSourceResourceItemDto`** (E3 rich shape: `selected`, `metadata`, `resource_id`, `resource_name`, `resource_type`, `integration_category`, `recommend_fail_reason`, `exclusion_reason`) — **not** `ResourceConfigDto`. `toResourceConfigDto`/`toApprovedIntegrationResourceSnapshot` (`index.ts:360`) read `endpoint_config`/`port`/`host`/`database_type` which are **absent** from `TargetSourceResourceItemDto` (those live on `metadata.*`). The snapshot mapping must read from `metadata` (host/port/database_type/oracle_service_id) — verify against Step-3 table (`approved-integration` is Step-3 "연동 대상 반영중", reads DB type, Resource ID, Region, name, exclusion reason, scan/integration history).
- Swagger has **no** `excluded_resource_infos`/`excluded_resource_ids`/`exclusion_reason` at the top level — exclusions are represented via per-resource `integration_category` (`NO_INSTALL_NEEDED`/`INSTALL_INELIGIBLE`) + `exclusion_reason`. Current code derives `excluded_*` from a top-level array that **will not exist**. The Step-3 "제외 대상" filter must be re-derived from `integration_category`/`exclusion_reason` per resource. FLAG: re-architect exclusion derivation.

Mock `getApprovedIntegration` (`mock/confirm.ts:691,729`) returns envelope `{approved_integration:{id,request_id,approved_at,approved_by,resource_infos,excluded_resource_infos}}` — wrong on all three counts. New mock must emit **flat** `{id, request_id, approved_at, approved_by:{user_id}, resources:[TargetSourceResourceItemDto]}` snake, with exclusions encoded as `integration_category`/`exclusion_reason` on items.

---

### E6 · GET `…/secrets` — getTargetSourceSecrets → `SecretResponse[]`

**Wire (snake) — note 200 is an ARRAY:**
```
[ SecretResponse { name: string, create_time: int64, create_time_str: string } ]
```
**Domain:** `SecretKey { name, createTimeStr }` (`lib/types.ts:366`).

Mapping trace: httpBff `projects.credentials` (`http.ts:112`) = `get(/target-sources/{id}/secrets)` → **camelized** → `name`, `createTime`, `createTimeStr`. Route `secrets/route.ts` then reads **`c.create_time_str`** (snake) `|| c.createdAt` and emits `{name, createTimeStr, labels?}`. **CSR** `getSecrets` (`index.ts:637`) `fetchInfraCamelJson` → `SecretKey[]`.

⚠ **Latent bug — D-5:** the route reads `c.create_time_str` (snake) but httpBff already camelized it to `createTimeStr`. Against the real BFF, `c.create_time_str` is `undefined`, so `createTimeStr` falls back to `c.createdAt` (also absent in swagger) → empty. Currently masked because mock emits whatever the route's `RawCredential` expects. **Fix:** route should read camel `createTimeStr` (post-`camelCaseKeys`), OR the credential fetch should use the swagger snake field consistently. Pin to camel. `create_time` (int64) is unused by domain — acceptable drop. `labels.databaseType` is route-invented (not in swagger) — preserve only if a consumer reads it (Explore: CredentialSetupModal).

**vs current:** SAME path. Mock (`mock/confirm`/`projects.credentials` source) must emit array of swagger `{name, create_time, create_time_str}` snake.

---

### E7 · PUT `…/resources/credential` — updateResourceCredential → `UpdateCredentialResponse`

**Request body (CAMEL — swagger):** `UpdateCredentialRequest { resourceId: string, credentialId: string }` (no required marker).
**Response (snake — trivial):** `UpdateCredentialResponse { success: boolean }`.

Mapping trace: **CSR** `updateResourceCredential` (`index.ts:717`) builds body `{ resourceId, credentialId }` (camel) via `fetchInfraJson` (no transform). Route `resources/credential/route.ts` passes body straight to `bff.confirm.updateResourceCredential`. httpBff `confirm.updateResourceCredential` (`http.ts:274`) = `put(…, body)` → **raw passthrough**, returns `{success}` un-camelized (already flat). Mock `updateResourceCredential` (`mock/confirm.ts:1483`) reads `{resourceId, credentialId}` (camel) and returns `{success:true}`. 

**vs current:** SAME — request casing already camel and matches swagger; response already `{success}`. ✅ **No change** beyond pinning the body type to `UpdateCredentialRequest`. CSR signature `credentialId: string | null` is wider than swagger `string` — acceptable (clearing a credential); keep, do not narrow. D6: body is a typed camel wire request (D3 pass-through), not blanket-snaked.

---

### E8 · POST `…/scan` — startScan → 202 `ScanJobResponse`

**Wire (snake) — `ScanJobResponse`:**
```
ScanJobResponse {
  id: int64
  scan_status: enum { SCANNING, FAIL, CANCELED, SUCCESS, TIMEOUT }
  target_source_id: int64
  created_at, updated_at: date-time
  scan_version: int32
  scan_progress: int32
  duration_seconds: float
  resource_count_by_resource_type: map<string,int64>      // ⚠⚠ OPAQUE MAP (D2.3) — keys are resource-type names (DATA)
  scan_error: enum { AUTH_PERMISSION_ERROR, RATE_LIMIT, NETWORK_ERROR, SERVICE_ERROR, UNKNOWN }
}
```
**Domain:** `V1ScanJob` (`lib/types.ts:523`) camel: `{id, scanStatus, targetSourceId, createdAt, updatedAt, scanVersion, scanProgress, durationSeconds, resourceCountByResourceType: Record<string,number>, scanError}`.

Mapping trace: **CSR** `startScan` (`scan.ts:18`) `fetchInfraCamelJson<V1ScanJob>(POST /target-sources/{id}/scan)`. Route `scan/route.ts` reads **snake** `data.scan_status`/`data.scan_progress`/`data.resource_count_by_resource_type` (from `bff.scan.create`, which is a **raw passthrough POST** → stays snake) and re-maps to camel `{id, scanStatus, …, resourceCountByResourceType: data.resource_count_by_resource_type || {}}`, 202. **The route IS the camelizer for this POST** (httpBff POST does not camelize). Mock `scan.create` (`mock/scan.ts:110`) emits snake `resource_count_by_resource_type`.

⚠⚠ **OPAQUE MAP — D-6 (the D2.3 case for this domain):** `resource_count_by_resource_type` is a `Record<string,number>` whose **keys are data** (resource-type strings). `camelCaseKeys` (`lib/object-case.ts:18-34`) **recurses into nested plain-object values**, so it WILL transform inner keys (e.g. a key `athena_database` → `athenaDatabase`). Today the **POST path** is safe only because the route reads it before any camelization (raw passthrough). But if any GET path camelizes a `ScanJobResponse` (E9/E10 do — see below) the inner keys are at risk. **Action:** type `resource_count_by_resource_type` as `OpaqueKeys<Record<string, number>>` in `lib/bff/types/scan.ts` (`ScanCreateResult` line 36) and ensure `camelCaseKeys` provably skips it (the D2.3 mechanism, defined in foundation P1). Enum keys like `AWS_DB_INSTANCE` survive `toCamelCase` by luck (uppercase, no `_[a-z]`), but the contract must not rely on luck.

**vs current:** SAME path. Mock already snake. P1: route the mock through `camelCaseKeys` and keep the route's field re-map (or move re-map into the boundary). Preserve the 202 status.

---

### E9 · GET `…/scanJob/latest` — getLatestScan → `ScanJobResponse`

Same `ScanJobResponse` shape as E8.

Mapping trace: **CSR** `getLatestScanJob` (`scan.ts:25`) `fetchInfraCamelJson<V1ScanJob>(GET /target-sources/{id}/scanJob/latest)`. httpBff `scan.getStatus` (`http.ts:177`) = **GET → camelized** → `data.scanStatus`/`data.resourceCountByResourceType` already camel. Route `scanJob/latest/route.ts` re-reads camel and re-emits `{…, resourceCountByResourceType: data.resourceCountByResourceType || {}}`. **Here the inner-key risk is live** (GET camelizes the whole body). Mock `scan.getStatus` (`mock/scan.ts:169`) currently emits **camel** (`scanStatus`, `resourceCountByResourceType`) — under P1 it must emit **snake** and rely on boundary camelization (+ `OpaqueKeys` for the map).

**vs current:** SAME path; **mock casing flip** (camel→snake) + opaque-map guard. 404 handled by CSR/component (no scan yet).

---

### E10 · GET `…/scan/history` — getScanHistory → `PageScanJobResponse`

**Wire (snake) — Spring Page:**
```
PageScanJobResponse {
  totalPages: int32, totalElements: int64
  pageable: PageableObject
  first, last, empty: boolean
  size, number, numberOfElements: int32
  content: ScanJobResponse[]
  sort: SortObject[]
}
```
(Note: top-level page fields `totalPages/totalElements/pageable/…` are **camelCase in the swagger already** — Spring serializes Page that way; only the nested `ScanJobResponse` items are snake.)

**Domain (route emits):** `{ content: V1ScanJob[], page: { totalElements, totalPages, number, size } }` — **route-invented envelope** (`scan/history/route.ts`). **CSR** `getScanHistory` (`scan.ts:29`) `fetchInfraCamelJson<V1ScanHistoryResponse>` expects exactly `{content, page:{totalElements,totalPages,number,size}}`.

Mapping trace: httpBff `scan.getHistory` (`http.ts:175`) = GET → camelized. Mock `scan.getHistory` (`mock/scan.ts:66`) returns `{content:[…camel…], totalElements}` (NOT a full Spring Page — only `content`+`totalElements`); the route computes `totalPages` and wraps `page`.

⚠ **RESHAPE — D-7:** swagger returns the **full Spring `PageScanJobResponse`** (flat `totalElements`/`totalPages`/`number`/`size` + `pageable`/`sort`/etc.), but the route consumes only `data.totalElements`+`data.content` and **builds its own `page` envelope**. After migration the route must read swagger's flat `totalElements`/`totalPages`/`number`/`size` directly (they already exist on the wire — no need to recompute `totalPages = ceil(...)`), and `content[i]` are snake `ScanJobResponse` → camelized → `V1ScanJob` (apply `OpaqueKeys` to each item's `resource_count_by_resource_type`). The route→CSR `{content, page:{…}}` envelope is the established 2-hop contract → **preserve it** (CSR + history UI depend on it). Mock must emit the full snake-item Spring page (or at minimum `content`(snake items)+`totalElements`+`totalPages`+`number`+`size`).

---

### E11 · POST `…/pii-agent-installation/confirm` — confirmPiiAgentInstallation → `TargetSourceResponse`

**Request body (snake — REQUIRED):** `PiiAgentInstallationConfirmRequest { confirm: boolean }` (`confirm` required).
**Response (CAMEL — swagger authors this DTO camel):**
```
TargetSourceResponse {
  id: int64
  serviceInfo: ServiceInfoRefinedResponse { code, serviceName, abbr, installed, isEosService, createdAt, updatedAt }
  serviceType, division: string
  cloudProvider: enum { AWS, GCP, AZURE, IDC, UNKNOWN }
  state: enum { CREATED, CONFIRMED, PROVISIONING, ACTIVE, CONFIRM_FAILED, PROVISION_FAILED, DESTROY_FAILED }
  supportRawData: boolean
  description: string
  cloudResourceAccessList: array<object>           // free-form objects
  createdAt, updatedAt: date-time
  confirmStatus: enum { IDLE, PENDING, UNAVAILABLE, CONFIRMING, RESOURCE_CLEANING, RESOURCE_CLEAN_FAILED, CONFIRMED }
  piiAgentInstalledAt: date-time
}
```

Mapping trace: **CSR** `confirmInstallation` (`index.ts:736`) `fetchInfraCamelJson<InstallationConfirmResult>(POST …/pii-agent-installation/confirm)` with **no body**, expects `{success, confirmedAt}`. Route `pii-agent-installation/confirm/route.ts` calls `bff.confirm.confirmInstallation` (no body), returns raw. httpBff `confirm.confirmInstallation` (`http.ts:271`) = `post(…, {})` raw passthrough. Mock `confirmInstallation` (`mock/confirm.ts:1415`) returns `{success:true, confirmedAt:now}`.

⚠ **MAJOR RESHAPE — D-8:**
- Swagger **requires** request body `{confirm: boolean}` (snake/simple) — current sends **no body**. CSR + route + httpBff/mock signatures must thread `{confirm:true}`.
- Swagger response is the full **camelCase** `TargetSourceResponse`, **not** `{success, confirmedAt}`. This DTO is **already camel in the wire** → `camelCaseKeys` is idempotent (no snake to convert), but httpBff POST is **raw passthrough** today (no camelization) — fine since wire is camel. Domain consumer currently reads `{success, confirmedAt}` which **do not exist** on `TargetSourceResponse`. Decide: (a) map `confirmStatus === 'CONFIRMED'` → `success`, `piiAgentInstalledAt` → `confirmedAt` in a new adapter, or (b) change the domain type to `TargetSourceResponse` and update the caller. Verify the confirm-install caller's UI need (Explore: confirmInstallation caller — likely admin "연동 완료 처리"). Mock must return a full `TargetSourceResponse` (camel) and accept `{confirm}`.
- D6: response is camel wire → no `camelCaseKeys` needed, but if routed through `get`-style helper it stays idempotent; flag the POST-response casing asymmetry (I-3) as the reason this DTO is consumed raw.

---

## 3. Mock changes (P1/P6) — author swagger wire (snake), route through `camelCaseKeys`

| Endpoint | Mock handler | Change |
|---|---|---|
| E1 detail | `mock/target-sources.ts:get` | Drop `{targetSource}` envelope → flat `TargetSourceDetail` snake (`target_source_id, service_code, service_name, process_status, cloud_provider, created_at, metadata`) |
| E2 process-status | `mock/confirm.ts:getProcessStatus` | Replace `status_inputs` with `healthy` enum; keep `target_source_id, process_status, evaluated_at` snake. **D-1** |
| E3 resources | `mock/confirm.ts:getResources` (+ `target-sources` recommend source) | Emit `{resources:[TargetSourceResourceItemDto], total_count}` snake, with **camel** `networkInterfaces`/`networkInterfaceId`/`ipConfigurationName` islands |
| E4 confirmed-integration | `mock/confirm.ts:getConfirmedIntegration` | Already flat `{resource_infos}`; add missing `ResourceConfigDto` fields (`agent_id, athena_region_resource_id, idc_*, nlb_index, protocol, secret_info, *_list`) for IDC/Athena rows. **D-3** |
| E5 approved-integration | `mock/confirm.ts:getApprovedIntegration` | Flatten (remove `approved_integration` envelope) → `{id, request_id, approved_at, approved_by:{user_id}, resources:[TargetSourceResourceItemDto]}`; encode exclusions via `integration_category`/`exclusion_reason`. **D-4** |
| E6 secrets | credential source for `projects.credentials` | Array of `{name, create_time, create_time_str}` snake |
| E7 credential PUT | `mock/confirm.ts:updateResourceCredential` | No change (`{resourceId,credentialId}` in, `{success}` out) |
| E8 scan POST | `mock/scan.ts:create` | Already snake; keep, route via `camelCaseKeys`; mark map `OpaqueKeys`. 202 |
| E9 scan latest | `mock/scan.ts:getStatus` | **Flip camel→snake** (`scan_status, resource_count_by_resource_type, …`) |
| E10 scan history | `mock/scan.ts:getHistory` | Emit full Spring `PageScanJobResponse` (snake items + flat `totalElements/totalPages/number/size`); route preserves `{content, page}` 2-hop envelope |
| E11 confirm install | `mock/confirm.ts:confirmInstallation` | Accept `{confirm}`; return full `TargetSourceResponse` (camel). **D-8** |

Seed: ensure `resource_count_by_resource_type` seeds include at least one **lowercase-containing** data key to prove `OpaqueKeys` (regression bait). Ensure approved-integration seed carries `integration_category` variety (TARGET / NO_INSTALL_NEEDED) so the Step-3 제외 filter still has data after the exclusion re-architecture.

---

## 4. Discrepancies (verification log rows)

| # | Endpoint | Issue | Resolution |
|---|---|---|---|
| D-1 | E2 process-status | mock emits `status_inputs`, swagger has `healthy` enum | mock→`healthy`; verify no consumer reads `status_inputs`/`statusInputs` |
| D-2 | E3 resources | swagger `recommend_fail_reason`/`exclusion_reason`/`selected` not surfaced in domain item | map if Step-1/2 UI needs them; else document drop |
| D-3 | E4 confirmed-integration | `ResourceConfigDto` swagger superset (agent_id, athena_region_resource_id, idc_*, nlb_index, *_list, protocol, secret_info) not in domain | extend `ConfirmedIntegrationResourceInfo` + normalizer for IDC/Athena Step-4/7 |
| D-4 | E5 approved-integration | key `resources` (not `resource_infos`); items `TargetSourceResourceItemDto` (not `ResourceConfigDto`); no top-level `excluded_*` | rewrite `normalizeApprovedIntegration`: read `resources`, map from `metadata.*`, derive exclusions from `integration_category`/`exclusion_reason`; flatten mock |
| D-5 | E6 secrets | route reads snake `create_time_str` after httpBff camelized → undefined | route read camel `createTimeStr`; pin field |
| D-6 | E8/E9/E10 scan | `resource_count_by_resource_type` data-keyed map; `camelCaseKeys` recurses into values | `OpaqueKeys<Record<string,number>>` on `ScanCreateResult.resource_count_by_resource_type` + `V1ScanJob.resourceCountByResourceType`; D2.3 skip |
| D-7 | E10 scan history | swagger = full Spring Page; route recomputes a smaller `{content,page}` | read swagger flat page fields; preserve route→CSR `{content,page}` 2-hop envelope |
| D-8 | E11 confirm install | missing required body `{confirm}`; response is `TargetSourceResponse` not `{success,confirmedAt}` | thread `{confirm:true}`; adapt `TargetSourceResponse`→domain (or change domain type) |
| D-9 | E1/E2/E11 casing | `TargetSourceResponse`/`ServiceInfoRefinedResponse` are camel wire; everything else snake | camel DTOs are `camelCaseKeys`-idempotent; document the per-DTO casing so mocks author correctly; POST-response (I-3) consumed raw |
| D-10 | E5/E1/E2 envelopes | mocks wrap (`{approved_integration}`, `{targetSource}`) shapes swagger does not have | drop envelopes in mocks (swagger flat) |

`OpaqueKeys` map: **only** `resource_count_by_resource_type` (E8/E9/E10) in this domain. No other data-keyed maps. Envelope unwrapping currently in `http.ts`/normalizers: confirmed-integration (`confirmed_integration`), approved-integration (`approved_integration`), target-source detail (`targetSource`) — all three are **mock-introduced**; swagger is flat, so post-migration the unwrap branches become legacy fallbacks (keep, D6-greppable, don't silently delete).

---

## App-A · `resource_type` enum (48 values, E3 + E5 items)

`AWS_ATHENA, AWS_ATHENA_DATABASE, AWS_DB_CLUSTER, AWS_DB_INSTANCE, AWS_REDSHIFT_CLUSTER, AWS_DYNAMO_DB_REGION, AWS_DYNAMO_DB_TABLE, AWS_DYNAMO_DB_GLOBAL_TABLE, AWS_NETWORK_INTERFACE, AWS_SUBNET, AWS_RDS_GLOBAL_CLUSTER, AWS_RDS_SUBNET_GROUP, AWS_RDS_PROXY, AWS_RDS_DB_CLUSTER_PARAMETER_GROUP, AWS_RDS_DB_PARAMETER_GROUP, AWS_REDSHIFT_SUBNET_GROUP, AWS_VPC_ENDPOINT_SERVICE, AWS_VPC_ENDPOINT, AWS_VPC_SECURITY_GROUP, AWS_IAM_ROLE, AWS_GLUE_RESOURCE_POLICY, AWS_ECR_POLICY, AWS_S3_BUCKET_POLICY, AWS_GLUE_TABLE, AWS_EC2_INSTANCE, AWS_EC2_REGION, AWS_OPEN_SEARCH_DOMAIN, AWS_KMS, AWS_AUTO_SCALING_GROUP, AZURE_SQL_SERVER, AZURE_SQL_SERVER_MANAGED_INSTANCE, AZURE_MYSQL_FLEXIBLE_SERVER, AZURE_MYSQL, AZURE_POSTGRESQL, AZURE_POSTGRESQL_FLEXIBLE_SERVER, AZURE_MARIADB, AZURE_COSMOSDB_NOSQL, AZURE_SERVICE_PRINCIPAL, AZURE_PRIVATE_ENDPOINT, AZURE_VIRTUAL_MACHINE, AZURE_VIRTUAL_SUBNET, AZURE_SYNAPSE_WORKSPACE, AZURE_NETWORK_INTERFACE, GCP_SQL, GCP_BIGQUERY_DATASET_REGION, GCP_VPC_NETWORK, IDC_RESOURCE`

---

## Review log

- **Review 1: clean** — checked every path literal against swagger (E1–E11), `/install/v1` prefix, `{targetSourceId}` vs `{target_source_id}` (none of my 11 use the snake param; azure scan-app excluded). Verified 202 on E8 + E10 query params `page`/`size`.
- **Review 2: clean** — checked each response schema field-for-field incl. enum spellings: `scan_status{SCANNING,FAIL,CANCELED,SUCCESS,TIMEOUT}`, `scan_error{AUTH_PERMISSION_ERROR,RATE_LIMIT,NETWORK_ERROR,SERVICE_ERROR,UNKNOWN}`, `state`/`confirmStatus`/`cloudProvider` on `TargetSourceResponse`, `healthy{UNKNOWN,HEALTHY,UNHEALTHY,DEGRADED}`, `integration_category{TARGET,NO_INSTALL_NEEDED,INSTALL_INELIGIBLE}`. Confirmed camel DTOs (`TargetSourceResponse`, `ServiceInfoRefinedResponse`, `NetworkInterfaceDto`, `TargetSourceResourceMetadataDto.networkInterfaces`) vs snake elsewhere (D-9). Confirmed `UpdateCredentialRequest` camel (E7) and `PiiAgentInstallationConfirmRequest.confirm` required (E11).
- **Review 3: clean** — traced Response→Adapter→UI for all 11 across the 3 hops (CSR `index.ts`/`scan.ts` → route `app/integration/api/v1/...` → `http.ts`/`mock-adapter.ts` → `mock/*`). Confirmed envelope unwraps are mock-introduced (E1/E4/E5) and swagger is flat (D-10); confirmed the `resource_count_by_resource_type` opaque-map recursion hazard in `lib/object-case.ts:18-34` (D-6); confirmed E5 `resources`-vs-`resource_infos` + item-type mismatch (D-4) and E11 missing body + `TargetSourceResponse` response (D-8) are the two largest reshapes. No `as T` introduced; all opt-outs (`OpaqueKeys`, raw-POST I-3) named.
