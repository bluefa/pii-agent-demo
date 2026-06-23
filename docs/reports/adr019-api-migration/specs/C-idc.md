# C — IDC domain · ADR-019 `/install/v1` contract migration spec

> Domain owner spec for the IDC endpoints of [PLAN.md](../PLAN.md) (Phase **P4**).
> Source of truth: `docs/swagger/install-v1.yaml` (extracted **verbatim** below).
> ADR-019: responses snake → `camelCaseKeys` → camel domain; requests match swagger casing; mocks author the **wire** shape (snake where swagger says snake); D6 = every casing/validation opt-out greppable.
> **IDC-specific carve-out (PLAN §2 D6):** IDC already owns its wire→domain conversion in a single sanctioned mapper file (`app/lib/api/idc.ts`), reached via `fetchInfraJson` (raw, no boundary `camelCaseKeys`). This spec **preserves that pattern** — the mapper stays the only conversion site; we do NOT route IDC GETs through the generic `camelCaseKeys` boundary. See §3.0.

---

## 0. Endpoint summary (this domain)

| # | Method | Path (verbatim) | operationId | 200 schema | Status vs current |
|---|--------|-----------------|-------------|------------|-------------------|
| 1 | GET | `/install/v1/target-sources/{targetSourceId}/idc/previous-request` | `getIdcPreviousRequest` | `IdcPreviousRequestResponse` | path RENAME (`/idc/` segment added) + schema reshape |
| 2 | GET | `/install/v1/target-sources/{targetSourceId}/idc/installation-status` | `getIdcInstallationStatus` | `IdcInstallationStatusResponse` | path RENAME + **full schema replacement** |
| 3 | GET | `/install/v1/idc/nlb/{nlbIndex}/resources` | `getOccupiedResources` | **array of** `NlbOccupiedResourceResponse` | **NEW** (no current code) |
| 4 | GET | `/install/v1/idc/nlb/table` | `getNlbTable` | **array of** `NlbTableResponse` | **NEW** (no current code) |

Plus the **feature**: IDC resource `installation_status: UNKNOWN` → render **"작업중"** (§6).

**Path-param casing (verbatim, do not "fix"):** `{targetSourceId}` (camel), `{nlbIndex}` (camel). `targetSourceId` is `int64`, `nlbIndex` is `int32`.

**Two of four return a top-level JSON array, not a wrapper** (#3, #4). This is a contract fact — see §3.3/§3.4.

---

## 1. Current IDC code inventory (read-only; paths + symbols)

| Path | Symbols / role |
|------|----------------|
| `app/lib/api/idc.ts` | **The single wire↔domain mapper file.** Domain models `IdcResourceView`, `IdcResourceInstallView`, `IdcInstallationView`, `IdcFirewallConfirmation`. Mappers `toIdcResourceView`, `toIdcResourceInput`, `toIdcInstallationView`. Clients `getIdcResources`, `getIdcPreviousRequest`, `updateIdcResources`, `getIdcInstallationStatus`, `checkIdcInstallation`, `confirmIdcFirewall`, `getIdcSourceIpRecommendation`. `idcBase(id) = "/idc/target-sources/${id}"`. Uses `fetchInfraJson` (raw, **no** camelCaseKeys). |
| `lib/bff/types/idc.ts` | Wire DTOs (snake). `IdcTfStatus`, `IdcInputFormatWire`, `IdcDatabaseTypeWire` (7 vals), `IdcConnectionStatusWire`, `IdcHealthWire`, `IdcResourceInput`, `IdcResourceWire`, `IdcResourcesResponse`, `IdcResourceInstallStatus`, `IdcInstallationStatus`, `IdcSourceIpRecommendation`, `IdcConfirmFirewallResponse`. |
| `lib/mock-idc.ts` | In-memory mock backend. `IDC_SEED` (3 rows), `IDC_PREV_REQUEST_SEED` (7 rows), `getIdcResources`, `getIdcPreviousRequest`, `updateIdcResources`, `getIdcInstallationStatus`, `confirmIdcFirewall`, `getIdcSourceIpRecommendation`, `resetIdcStore`. Emits **wire snake**. |
| `lib/bff/mock/idc.ts` | `mockIdc` — NextResponse/auth wrapper over `lib/mock-idc.ts`. |
| `lib/bff/mock-adapter.ts` | `idc.*` registration (L188–202) wiring `mockIdc` into `bff.idc`. |
| `app/lib/api/infra.ts` | `fetchInfraJson` (raw), `fetchInfraCamelJson` (boundary camel — **IDC does NOT use this**), `parseInfraCamelJson`. |
| `app/integration/api/v1/idc/target-sources/[targetSourceId]/{previous-request,resources,installation-status,check-installation,confirm-firewall}/route.ts`, `app/integration/api/v1/idc/source-ip-recommendation/route.ts` | Proxy route handlers (Next → upstream BFF). `installation-status/route.ts` = thin `bff.idc.getInstallationStatus`. |
| `app/hooks/useIdcInstallationStatus.ts` | Hook consuming `IdcInstallationView` (DR3/4/5 abort+stale safety). |
| `app/integration/.../idc/steps/IdcStep4Installing.tsx` | Step 4 UI. Maps `IdcTfStatus → InstallTaskStatus` via `BDC_TASK_STATUS`; renders 2-task `InstallTaskPipeline` + `IdcResourceTable cols={['src','fw']}`. **This is where installation-status is consumed.** |
| `app/integration/.../idc/IdcResourceTable.tsx` | Table. Cols `'src'|'excl'|'fw'|'conn'|'health'|'cred'|'credro'|'logical'`. |
| `app/components/features/process-status/install-task-pipeline/InstallTaskCard.tsx` | Card visual buckets: `pending`(대기/#8B95A1) · `done`(완료/#45CB85) · `running`(진행중/#0064FF + halo) · `failed`(실패/#991B1B). **This is the in-progress visual bucket the feature reuses.** |
| `app/components/features/process-status/install-task-pipeline/install-task-detail/step-status-tag.ts` | `STEP_STATUS_TAG: Record<GcpStepStatusValue, …>` — maps `COMPLETED/IN_PROGRESS/FAIL/SKIP`. **No `UNKNOWN` key** (cloud type `GcpStepStatusValue` has no UNKNOWN). |

### 1.1 Current installation-status status mapping / where UNKNOWN lands today

- **Today there is no `installation_status` field at all.** The current IDC installation-status wire (`IdcInstallationStatus`, `lib/bff/types/idc.ts`) is `{ provider, bdc_tf: IdcTfStatus, firewall_opened, resources:[{resource_id, source_ips, firewall_open}], last_checked_at }`. The Step-4 UI maps `bdc_tf` (`PENDING|IN_PROGRESS|COMPLETED|FAILED`) → `InstallTaskStatus` and reads `firewall_opened` as a boolean.
- **There is NO per-resource status enum and NO `UNKNOWN` anywhere in IDC today.** `grep "작업중"` across `app/` + `lib/` = **0 hits** (net-new label). The cloud step tag (`step-status-tag.ts` / `GcpStepStatusValue`) also has **no `UNKNOWN`** — cloud install-task-pipeline does not handle `UNKNOWN` at all (`grep UNKNOWN` in that dir = 0 hits).
- **Consequence:** the new contract's per-resource `installation_status` (with `UNKNOWN`) and the 3 step DTOs are **entirely new domain surface**. The mapper + a new status→label adapter are net-new (§3.2, §6). The existing `toIdcInstallationView`/`IdcInstallationView` shape is **superseded** by the new contract.

---

## 2. Swagger extraction (verbatim schemas)

### 2.1 `IdcPreviousRequestResponse` (#1)
```yaml
IdcPreviousRequestResponse:
  type: object
  properties:
    resources:
      type: array
      items:
        $ref: "#/components/schemas/IdcResourceInput"
```

### 2.2 `IdcResourceInput` (used by #1) — VERBATIM
```yaml
IdcResourceInput:
  type: object
  properties:
    ips:            { type: array, items: { type: string } }
    host:           { type: string }
    port:           { type: integer, format: int32 }
    selected:       { type: boolean }
    input_format:   { type: string, enum: [IP, HOST] }
    database_type:  { type: string }          # NOTE: plain string, NO enum in swagger
    service_id:     { type: string }
    credential_id:  { type: string }
    exclusion_reason: { type: string }
```
⚠ **Drift vs current `lib/bff/types/idc.ts` `IdcResourceInput`** (resolve in §5):
- swagger has **`selected: boolean`** — current type does **not**.
- swagger has **no `name`** — current type has required `name`.
- swagger has **no `resource_id`** on `IdcResourceInput` (and **no `IdcResource`/allOf** read-variant; the current `IdcResourceWire extends …{resource_id}` has no swagger basis).
- swagger `database_type` is **plain `string`** (no enum) — current type is a 7-value union.
- swagger has **none** of the current server-assigned fields: `source_ips`, `firewall_open`, `connection_status`, `health`, `done`.

### 2.3 `IdcInstallationStatusResponse` (#2) + nested DTOs — VERBATIM
```yaml
IdcInstallationStatusResponse:
  type: object
  properties:
    last_check: { $ref: "#/components/schemas/IdcLastCheckDto" }
    resources:
      type: array
      items: { $ref: "#/components/schemas/IdcResourceInstallationStatusDto" }

IdcLastCheckDto:
  type: object
  properties:
    status:      { type: string, enum: [COMPLETED, FAIL, IN_PROGRESS, SKIP, UNKNOWN] }
    checked_at:  { type: string, format: date-time }
    fail_reason: { type: string }

IdcResourceInstallationStatusDto:
  type: object
  properties:
    resource_id:                  { type: string }
    installation_status:          { type: string, enum: [COMPLETED, FAIL, IN_PROGRESS, SKIP, UNKNOWN] }
    bdc_side_cx_terraform_apply:  { $ref: "#/components/schemas/CloudInstallationStepStatusDto" }
    bdc_side_bdp_terraform_apply: { $ref: "#/components/schemas/CloudInstallationStepStatusDto" }
    firewall_check:               { $ref: "#/components/schemas/CloudInstallationStepStatusDto" }

CloudInstallationStepStatusDto:
  type: object
  properties:
    status: { type: string, enum: [COMPLETED, FAIL, IN_PROGRESS, SKIP, UNKNOWN] }
    guide:  { type: string }
```
This is a **complete replacement** of the current installation-status shape: NO `provider`, NO `bdc_tf`, NO `firewall_opened`, NO per-resource `source_ips`/`firewall_open`. Instead: top-level `last_check` + per-resource `installation_status` + three named step DTOs. **The two-task pipeline in `IdcStep4Installing.tsx` maps to these three steps now** (§3.2, §4).

### 2.4 `NlbOccupiedResourceResponse` (#3) — VERBATIM (camelCase wire!)
```yaml
NlbOccupiedResourceResponse:
  type: object
  properties:
    serviceCode:    { type: string }
    serviceName:    { type: string }
    targetSourceId: { type: integer, format: int64 }
    isLatest:       { type: boolean }
    ipSet:          { uniqueItems: true, type: array, items: { type: string } }
    port:           { type: integer, format: int32 }
    databaseType:   { type: string }
    databaseName:   { type: string }
```
Endpoint returns **`type: array` of this** (not wrapped).

### 2.5 `NlbTableResponse` (#4) — VERBATIM (camelCase wire!)
```yaml
NlbTableResponse:
  type: object
  properties:
    nlbIndex:               { type: integer, format: int32 }
    nlbIpList:              { type: array, items: { type: string } }
    occupiedListenerCount:  { type: integer, format: int64 }
```
Endpoint returns **`type: array` of this** (not wrapped).

> ⚠ **Casing landmine.** #1/#2 schemas are **snake** (`installation_status`, `last_check`, `resource_id`). #3/#4 schemas are **camel on the wire** (`serviceCode`, `targetSourceId`, `nlbIndex`, `isLatest`, `ipSet`, `databaseType`). This is per-schema, authored that way in the swagger — see §3.0/§3.3 for how the IDC mapper handles both without a blanket transform.

---

## 3. Per-endpoint: wire type → domain type → Response→Adapter→UI

### 3.0 Casing strategy under the IDC carve-out (D6)

All four IDC GETs go through `fetchInfraJson` (raw, no boundary camelCaseKeys) — **unchanged**. The `app/lib/api/idc.ts` mapper remains the single, greppable conversion site (it IS the D6 "loud" opt-out — the whole file is the documented sanctioned raw passthrough). Concretely:
- **#1/#2 (snake wire):** mapper reads snake fields explicitly (`wire.installation_status`, `wire.last_check?.status`), exactly as `toIdcResourceView` does today. No `camelCaseKeys`.
- **#3/#4 (camel wire):** the wire fields are **already camel**, so the wire type = camel and the mapper is a near-identity copy (rename only `ipSet`→`ips`-style domain ergonomics if desired). **Do NOT run `camelCaseKeys`** on them — it is unnecessary (already camel) and would be a second transform that violates the "mapper owns it" rule. The fact that #3/#4 skip the boundary is self-evident at the call site (they call `fetchInfraJson`, the raw variant), satisfying D6.

> No new `getSnakeRaw` is introduced: IDC's sanctioned raw path is the **existing** `fetchInfraJson` usage inside this mapper file, documented in the file header. Keep that header accurate (it already says "IDC responses are raw snake passthrough"); add a one-line note that NLB responses are raw **camel** passthrough so the mixed casing is greppable/visible.

---

### 3.1 `getIdcPreviousRequest` (#1)

| Layer | Definition |
|-------|-----------|
| **Path** | `GET /idc/target-sources/${targetSourceId}/previous-request` via `fetchInfraJson` → proxied to `/install/v1/target-sources/{targetSourceId}/idc/previous-request`. **Verify the proxy path mapping** (`toInternalInfraApiPath`/`toUpstreamInfraApiPath`) emits `…/idc/previous-request` (swagger puts `/idc/` BEFORE `previous-request`; current `idcBase` = `/idc/target-sources/{id}` already yields `/idc/target-sources/{id}/previous-request` — confirm the upstream rewrite lands the swagger path verbatim). |
| **Wire type** | `interface IdcPreviousRequestResponse { resources: IdcResourceInputWire[] }`. `IdcResourceInputWire` = the §2.2 fields exactly: `{ ips?: string[]; host?: string; port?: number; selected?: boolean; input_format?: 'IP'|'HOST'; database_type?: string; service_id?: string; credential_id?: string; exclusion_reason?: string }`. All optional (swagger marks no `required`). `database_type` typed `string` to match swagger (the 7-value union may stay as a **domain-side** label lookup, not a wire constraint). |
| **Domain type** | Reuse existing `IdcResourceView` (it already models hosts/port/db-type-label/excluded/etc). |
| **Adapter** | `toIdcResourceView(wire, index)` — adapt the existing mapper: drop reliance on `wire.name` (gone); drop `wire.resource_id` (gone from this schema — every previous-request row is therefore **non-persisted**, `persisted=false`, temp id `idc-row-${index}`). Map `selected` if the UI needs a pre-checked state (see open item §8.b). `hosts`, `port`, `databaseTypeLabel`, `excluded`/`exclusionReason` map as today. |
| **UI** | "기존 연동 요청 정보 불러오기" preview in Step 1 (`IdcResourceTable`). Read-only preview; user picks rows to import. No write of these rows directly through this endpoint. |

### 3.2 `getIdcInstallationStatus` (#2)

| Layer | Definition |
|-------|-----------|
| **Path** | `GET /idc/target-sources/${targetSourceId}/installation-status` → `/install/v1/target-sources/{targetSourceId}/idc/installation-status`. Verify upstream rewrite. |
| **Wire type** | New, replacing current `IdcInstallationStatus`:<br>`interface IdcInstallationStatusResponseWire { last_check?: IdcLastCheckWire; resources?: IdcResourceInstallationStatusWire[] }`<br>`IdcLastCheckWire { status?: IdcInstallStatusWire; checked_at?: string; fail_reason?: string }`<br>`IdcResourceInstallationStatusWire { resource_id?: string; installation_status?: IdcInstallStatusWire; bdc_side_cx_terraform_apply?: IdcStepStatusWire; bdc_side_bdp_terraform_apply?: IdcStepStatusWire; firewall_check?: IdcStepStatusWire }`<br>`IdcStepStatusWire { status?: IdcInstallStatusWire; guide?: string }`<br>`type IdcInstallStatusWire = 'COMPLETED' \| 'FAIL' \| 'IN_PROGRESS' \| 'SKIP' \| 'UNKNOWN'` (one shared enum — all 4 status fields use it). |
| **Domain type** | New domain shape (supersedes `IdcInstallationView`):<br>`type IdcInstallStatus = IdcInstallStatusWire` (kept verbatim; UNKNOWN is a real domain state, **not** collapsed at the domain layer — collapse to "작업중" happens in the **UI label adapter** so the data stays faithful).<br>`interface IdcInstallStepView { status: IdcInstallStatus; guide?: string }`<br>`interface IdcResourceInstallView { resourceId: string; installationStatus: IdcInstallStatus; cxTerraform: IdcInstallStepView; bdpTerraform: IdcInstallStepView; firewallCheck: IdcInstallStepView }`<br>`interface IdcInstallationView { lastCheck?: { status: IdcInstallStatus; checkedAt?: string; failReason?: string }; resources: IdcResourceInstallView[] }`. |
| **Adapter** | New `toIdcInstallationView(wire)` in `app/lib/api/idc.ts` reading snake explicitly. Missing `status` → default to `'UNKNOWN'` (faithful: a missing status is "작업중", never silently COMPLETED). |
| **UI** | `IdcStep4Installing.tsx`: the **2-task pipeline** (`BDC 측 리소스 설치 진행`, `방화벽 확인`) now derives from the 3 step DTOs — recommended mapping: card 1 "BDC 측 리소스 설치 진행" ← aggregate of `cxTerraform`+`bdpTerraform`; card 2 "방화벽 확인" ← `firewallCheck`. Each card's `InstallTaskStatus` comes from the status→bucket map (§6). `lastCheck.checkedAt` → "마지막 확인" timestamp. **Note:** the current `BDC_TASK_STATUS` (`IdcTfStatus`→`InstallTaskStatus`) and `firewallOpened` boolean are removed; `bdc_tf`/`firewall_opened` no longer exist. Per-resource `source_ips`/`firewall_open` are **gone** from this contract — see §8.a for the Step-4 `src`/`fw` columns impact (blocker-adjacent). |

### 3.3 `getOccupiedResources` (#3)

| Layer | Definition |
|-------|-----------|
| **Path** | `GET /idc/nlb/${nlbIndex}/resources` → `/install/v1/idc/nlb/{nlbIndex}/resources`. **Not under `/target-sources`** — new `idcNlbBase`/literal. |
| **Wire type** | **Array** return. `type NlbOccupiedResourceResponseWire = { serviceCode?: string; serviceName?: string; targetSourceId?: number; isLatest?: boolean; ipSet?: string[]; port?: number; databaseType?: string; databaseName?: string }`. Client return: `NlbOccupiedResourceResponseWire[]`. Camel wire — no transform. |
| **Domain type** | `interface NlbOccupiedResource { serviceCode: string; serviceName: string; targetSourceId: number; isLatest: boolean; ips: string[]; port: number; databaseType: string; databaseName: string }` (`ipSet`→`ips` rename for domain ergonomics; everything else identity). |
| **Adapter** | `client = (nlbIndex) => fetchInfraJson<NlbOccupiedResourceResponseWire[]>(…).then(a => a.map(toNlbOccupiedResource))`. `toNlbOccupiedResource` = identity except `ips: w.ipSet ?? []`. |
| **UI** | **No current consumer.** Spec the client + types; UI wiring is out of scope until a screen needs it (NLB capacity/diagnostics view — not in the Step1–7 flow per domain doc). Flag as "client added, UI consumer TBD". |

### 3.4 `getNlbTable` (#4)

| Layer | Definition |
|-------|-----------|
| **Path** | `GET /idc/nlb/table` → `/install/v1/idc/nlb/table`. |
| **Wire type** | **Array** return. `type NlbTableResponseWire = { nlbIndex?: number; nlbIpList?: string[]; occupiedListenerCount?: number }`. Client return: `NlbTableResponseWire[]`. Camel wire — no transform. |
| **Domain type** | `interface NlbTableRow { nlbIndex: number; nlbIpList: string[]; occupiedListenerCount: number }`. |
| **Adapter** | `client = () => fetchInfraJson<NlbTableResponseWire[]>(…).then(a => a.map(toNlbTableRow))`. `toNlbTableRow` ≈ identity with `nlbIpList ?? []`, `occupiedListenerCount ?? 0`. |
| **UI** | **No current consumer** (same as #3). Client added, UI consumer TBD. |

---

## 4. Mock — wire (snake/camel) responses

Author each mock to emit the **swagger wire shape** so mock == contract. Add/extend in `lib/mock-idc.ts` (+ wrap in `lib/bff/mock/idc.ts`, register in `lib/bff/mock-adapter.ts`).

### 4.1 `getIdcPreviousRequest` mock (#1)
Reshape `IDC_PREV_REQUEST_SEED` rows to the §2.2 fields only — **remove `name` and `resource_id`** (not in schema), add `selected`. Example row:
```jsonc
{ "ips": ["10.20.30.40"], "port": 3306, "selected": true,
  "input_format": "IP", "database_type": "MYSQL" }
// host-mode row:
{ "host": "db.svc-a.io", "port": 5432, "selected": false,
  "input_format": "HOST", "database_type": "POSTGRESQL", "exclusion_reason": "StageDB" }
```
Return shape: `{ "resources": [ …rows… ] }`.

### 4.2 `getIdcInstallationStatus` mock (#2) — MUST include an `UNKNOWN` resource
Replace the current mock body with the new schema. **At least one resource has `installation_status: "UNKNOWN"`** (and at least one step DTO `UNKNOWN`) to exercise →"작업중":
```jsonc
{
  "last_check": {
    "status": "IN_PROGRESS",
    "checked_at": "2026-06-23T04:00:00Z",
    "fail_reason": null
  },
  "resources": [
    { "resource_id": "idc-r1",
      "installation_status": "COMPLETED",
      "bdc_side_cx_terraform_apply":  { "status": "COMPLETED", "guide": null },
      "bdc_side_bdp_terraform_apply": { "status": "COMPLETED", "guide": null },
      "firewall_check":               { "status": "COMPLETED", "guide": null } },
    { "resource_id": "idc-r2",
      "installation_status": "UNKNOWN",        // ← exercises → "작업중"
      "bdc_side_cx_terraform_apply":  { "status": "IN_PROGRESS", "guide": "..." },
      "bdc_side_bdp_terraform_apply": { "status": "UNKNOWN", "guide": null },  // ← step-level UNKNOWN
      "firewall_check":               { "status": "IN_PROGRESS", "guide": null } }
  ]
}
```
> `checkIdcInstallation` (POST `check-installation`) currently reuses `getIdcInstallationStatus` in the mock — keep that, so refresh returns the same new shape. ⚠ `check-installation` is **not in the swagger** — see §7.5.

### 4.3 `getOccupiedResources` mock (#3) — **array**, camel
```jsonc
[
  { "serviceCode": "svc-a", "serviceName": "Service A", "targetSourceId": 1001,
    "isLatest": true, "ipSet": ["10.20.30.40", "10.20.30.41"], "port": 3306,
    "databaseType": "MYSQL", "databaseName": "orders" }
]
```

### 4.4 `getNlbTable` mock (#4) — **array**, camel
```jsonc
[
  { "nlbIndex": 0, "nlbIpList": ["172.16.10.10", "172.16.10.11"], "occupiedListenerCount": 3 },
  { "nlbIndex": 1, "nlbIpList": ["172.16.10.20"], "occupiedListenerCount": 0 }
]
```
New mock-adapter `bff.idc` entries: `getOccupiedResources(nlbIndex)`, `getNlbTable()`. New proxy route handlers under `app/integration/api/v1/idc/nlb/[nlbIndex]/resources/route.ts` and `app/integration/api/v1/idc/nlb/table/route.ts`.

---

## 5. Discrepancies / blockers (verification targets)

- **⚠ BLOCKER — `idc/resources` GET/PUT absent in swagger (Step 1 SAVE path).** Domain doc §3 says Step 1 loads via `GET /target-sources/{id}/idc/resources` and saves via `PUT /target-sources/{id}/idc/resources` ("이 DB들로 진행"). **Neither exists in `install-v1.yaml`** — only `/idc/previous-request` and `/idc/installation-status` are present under `/idc/`. The current code (`app/lib/api/idc.ts` `getIdcResources`/`updateIdcResources`, route `…/idc/target-sources/{id}/resources`) is therefore **out-of-contract**. Step 1's *write* path has no published endpoint. **How Step 1 saves today:** entirely against the mock `idc/resources` PUT — there is **no generic `/resources` fallback in IDC**; the generic `…/{targetSourceId}/resources` (`getRecommendedResources`, PLAN §3) is a cloud **scan-discovery read** (`CloudResourceResponse`), semantically wrong for IDC manual DB save. **Resolution required before coding the Step-1 write path** (do NOT invent an endpoint): ask the user/BFF whether `idc/resources` GET+PUT is (a) pending publication, (b) renamed, or (c) Step-1 save now rides a different operation (e.g. an approval-request submit). **Until resolved: keep the existing `idc/resources` client/mock as an out-of-contract carry-over and flag it loudly in the verification log** — it cannot be marked contract-clean.

- **⚠ `IdcResourceInput` field drift (§2.2).** swagger adds `selected`, drops `name`/`resource_id`, makes `database_type` a plain string, and drops all server-assigned fields (`source_ips`,`firewall_open`,`connection_status`,`health`,`done`). The current `IdcResourceWire` allOf-with-`resource_id` and the 7-value `database_type` union have **no swagger basis**. Resolution: align the **wire** type to §2.2 verbatim; preserve the 7-value union only as a **domain label lookup** (`idcDbTypeLabel`), not a wire constraint. The dropped server-assigned fields couple to the next blocker.

- **⚠ Step-4 `src`/`fw` columns lose their data source.** New installation-status has **no `source_ips`/`firewall_open` per resource**; `IdcStep4Installing.tsx` currently merges those from installation-status into `IdcResourceTable cols={['src','fw']}`. After migration those columns have no contract field. Resolution: either (a) drop `src`/`fw` from Step-4 IDC table, or (b) source them elsewhere — needs a product/contract decision. Flag; do not silently keep mock-only fields.

- **⚠ `check-installation` (POST) absent in swagger** (`app/.../idc/.../check-installation`, `checkIdcInstallation`). The "새로고침" refresh. Likely folded into a plain re-GET of `installation-status`. Verify; if dropped, refresh should re-call `getIdcInstallationStatus`. (See §7.5.)

- **⚠ `confirm-firewall` (POST) + `source-ip-recommendation` (GET) absent in swagger** (current IDC clients). No `/idc/.../confirm-firewall` or `/idc/source-ip-recommendation` in `install-v1.yaml`. Flag as out-of-contract; verify whether dropped or pending.

- **Note — `last_check` vs `last_checked_at`.** New schema uses `last_check: {status, checked_at, fail_reason}`; current domain exposed flat `lastCheckedAt`. Map `last_check.checked_at → lastCheck.checkedAt`.

- **NLB casing (not a bug).** #3/#4 are camel-on-wire by design (§2.4/§2.5). Do not normalize.

---

## 6. Feature — IDC `installation_status: UNKNOWN` → "작업중"

**Decision (per PLAN §6 + domain doc §12):** map `UNKNOWN` to the **same in-progress visual bucket as `IN_PROGRESS`**, labeled **"작업중"**. `UNKNOWN` is **not** an error/unknown state — it is treated as work-in-progress.

**Scope:**
- **Resource-level (`IdcResourceInstallationStatusDto.installation_status`): REQUIRED.** This is exactly what the user asked for ("IDC쪽에서 UNKNOWN 상태는 리소스에 대해서 나오고") — resource status `UNKNOWN` → "작업중".
- **Step-level (`CloudInstallationStepStatusDto.status`): RECOMMENDED to apply the same mapping, flagged as an OPEN ITEM** (§8.c). Rationale: the 2-task pipeline cards derive from the step DTOs, and the same enum (incl. `UNKNOWN`) is used; rendering a step `UNKNOWN` as anything but in-progress would be inconsistent with the resource-level rule and the cloud pipeline currently has **no `UNKNOWN` handling at all** (a latent gap). Recommend resource-level + step-level both → "작업중"; confirm step-level with the user since they scoped the ask to resources.

**Adapter (single mapping, UI layer — keep domain data faithful):**
```ts
// app/lib/api/idc.ts  (or a co-located idc-install-status-label.ts)
import type { InstallTaskStatus } from '@/lib/constants/install-task';

/** IDC install enum → install-task card visual bucket. UNKNOWN shares IN_PROGRESS. */
export const IDC_INSTALL_TASK_STATUS: Record<IdcInstallStatus, InstallTaskStatus> = {
  COMPLETED:   'done',
  FAIL:        'failed',
  IN_PROGRESS: 'running',   // bucket: #0064FF "진행중" pill
  UNKNOWN:     'running',   // ← same in-progress bucket as IN_PROGRESS
  SKIP:        'done',      // SKIP = step intentionally skipped → treat as resolved/done (confirm; not "작업중")
};

/** Human label for an IDC install status. UNKNOWN renders "작업중". */
export const idcInstallStatusLabel = (s: IdcInstallStatus): string =>
  s === 'UNKNOWN' ? '작업중'
  : s === 'IN_PROGRESS' ? '작업중'   // IN_PROGRESS and UNKNOWN share the "작업중" label
  : s === 'COMPLETED' ? '완료'
  : s === 'FAIL' ? '실패'
  : '제외';                          // SKIP
```
> Label note: `InstallTaskCard`'s built-in `running` pill text is "진행중". The feature wants the IDC-facing label **"작업중"**. Use `idcInstallStatusLabel` for any IDC text that shows the status verbatim (e.g. a resource-status cell / tooltip); the install-task **card** keeps its own "진행중" pill unless the user wants Step-4 cards relabeled to "작업중" (open item §8.c). The load-bearing requirement — `UNKNOWN` reads as in-progress, not error/unknown — is satisfied by both the bucket map (`UNKNOWN: 'running'`) and the label (`UNKNOWN → "작업중"`).

**SKIP caveat:** swagger includes `SKIP` in the enum but the feature only speaks to `UNKNOWN`. Map `SKIP` to a resolved/neutral state (above), **not** "작업중" — verify the intended `SKIP` rendering with the user (open item §8.d).

### 6.1 Unit test (asserting UNKNOWN → "작업중")
New `app/lib/api/__tests__/idc-install-status.test.ts` (co-located with the mapper):
```ts
import { describe, it, expect } from 'vitest';
import {
  IDC_INSTALL_TASK_STATUS,
  idcInstallStatusLabel,
  toIdcInstallationView,
} from '@/app/lib/api/idc';

describe('IDC install status — UNKNOWN → 작업중', () => {
  it('label: UNKNOWN renders "작업중"', () => {
    expect(idcInstallStatusLabel('UNKNOWN')).toBe('작업중');
  });

  it('bucket: UNKNOWN shares the in-progress bucket with IN_PROGRESS', () => {
    expect(IDC_INSTALL_TASK_STATUS.UNKNOWN).toBe('running');
    expect(IDC_INSTALL_TASK_STATUS.UNKNOWN).toBe(IDC_INSTALL_TASK_STATUS.IN_PROGRESS);
  });

  it('adapter: a resource with installation_status UNKNOWN → domain UNKNOWN → "작업중"', () => {
    const view = toIdcInstallationView({
      last_check: { status: 'IN_PROGRESS', checked_at: '2026-06-23T04:00:00Z' },
      resources: [
        { resource_id: 'idc-r2', installation_status: 'UNKNOWN',
          bdc_side_cx_terraform_apply:  { status: 'IN_PROGRESS' },
          bdc_side_bdp_terraform_apply: { status: 'UNKNOWN' },
          firewall_check:               { status: 'IN_PROGRESS' } },
      ],
    });
    const r = view.resources[0];
    expect(r.installationStatus).toBe('UNKNOWN');
    expect(idcInstallStatusLabel(r.installationStatus)).toBe('작업중');
    // step-level (recommended): bdp step UNKNOWN also reads "작업중"
    expect(idcInstallStatusLabel(r.bdpTerraform.status)).toBe('작업중');
  });

  it('missing status defaults to UNKNOWN ("작업중"), never COMPLETED', () => {
    const view = toIdcInstallationView({ resources: [{ resource_id: 'x' }] });
    expect(view.resources[0].installationStatus).toBe('UNKNOWN');
  });
});
```

---

## 7. Implementation checklist (P4)

1. **Wire types** (`lib/bff/types/idc.ts`): align `IdcResourceInput` to §2.2 verbatim (add `selected`, drop `name`/`resource_id`/server-assigned, `database_type: string`); add `IdcPreviousRequestResponse`, the new installation-status DTO set, `NlbOccupiedResourceResponseWire`, `NlbTableResponseWire`, shared `IdcInstallStatusWire`. Remove the superseded `IdcInstallationStatus`/`IdcResourceInstallStatus`/`IdcResourceWire`/`IdcResourcesResponse` **only after** the `idc/resources` blocker (§5) is resolved — until then they remain as the out-of-contract carry-over.
2. **Mapper + clients** (`app/lib/api/idc.ts`): new `toIdcInstallationView`, `IDC_INSTALL_TASK_STATUS`, `idcInstallStatusLabel`; adapt `toIdcResourceView` for the reshaped `IdcResourceInput`; add `getOccupiedResources`, `getNlbTable` + their identity mappers. Keep `fetchInfraJson` (raw) for all; update the file header to note NLB = raw **camel** passthrough.
3. **Mocks** (`lib/mock-idc.ts` + `lib/bff/mock/idc.ts` + `lib/bff/mock-adapter.ts`): reshape previous-request + installation-status (incl. `UNKNOWN` resource & step), add NLB array mocks + `bff.idc.getOccupiedResources/getNlbTable`.
4. **Routes**: add `app/integration/api/v1/idc/nlb/[nlbIndex]/resources/route.ts` + `…/idc/nlb/table/route.ts`. Verify upstream path rewrite for #1/#2 lands the swagger path verbatim.
5. **UI** (`IdcStep4Installing.tsx`): rebuild the 2-task pipeline off the 3 step DTOs (§3.2); resolve §5 `src`/`fw` column data-source blocker; surface `lastCheck.checkedAt`.
6. **Test**: §6.1 unit test green.
7. **Verification log**: one row per endpoint; `idc/resources` blocker marked open (cannot be contract-clean until resolved).

---

## 8. Open items (do not block P4 foundation; resolve in review)

- **a.** Step-4 `src`/`fw` columns — drop or re-source after `source_ips`/`firewall_open` left the contract (§5).
- **b.** `IdcResourceInput.selected` — does Step-1 "기존 요청 불러오기" use it to pre-check rows for import? Wire `selected → view` if so.
- **c.** Apply UNKNOWN→"작업중" to **step-level** rows and relabel Step-4 cards "작업중" (vs the built-in "진행중")? Recommend yes for consistency; confirm scope with user (they scoped to resources).
- **d.** `SKIP` rendering — neutral/resolved (recommended) vs something else; confirm intended IDC SKIP semantics.

---

## 9. Self-review

- **Review 1: clean** — checked all four paths char-for-char against `install-v1.yaml` (L2553/L2621/L3751/L3821); confirmed #3/#4 return top-level `array`; confirmed path params `{targetSourceId}`(int64)/`{nlbIndex}`(int32) verbatim.
- **Review 2: clean** — checked every schema field+casing against L5356–5446 (snake: `installation_status`, `last_check`, `resource_id`, all 4 status enums = `COMPLETED,FAIL,IN_PROGRESS,SKIP,UNKNOWN`) and L5844–5880 (camel: `serviceCode`,`targetSourceId`,`nlbIndex`,`nlbIpList`,`isLatest`,`ipSet`,`databaseType`,`occupiedListenerCount`); confirmed `IdcResourceInput` adds `selected`, has no `name`/`resource_id`, `database_type` plain string; confirmed current code drift (`lib/bff/types/idc.ts`, `app/lib/api/idc.ts`) and the absent `idc/resources`/`check-installation`/`confirm-firewall`/`source-ip-recommendation` endpoints.
- **Review 3: clean** — checked the UNKNOWN→"작업중" mapping is UI-layer only (domain keeps `UNKNOWN` faithful), reuses the existing `running`/#0064FF in-progress bucket (`InstallTaskCard.tsx`), defaults missing status to UNKNOWN (never COMPLETED), and the unit test asserts label+bucket+adapter+default; confirmed D6 is satisfied via the existing `fetchInfraJson` raw path inside the single mapper file (no new silent `as T`), with NLB camel-raw noted in the file header.
