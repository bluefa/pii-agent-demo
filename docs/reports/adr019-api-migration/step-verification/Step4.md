# Step 4 (Agent 설치) — API Verification

Step 4 installs the PII Agent and monitors installation. Per the intended-API spec
(`01-target-source-detail-spec.md` §6) the screen, per cloud, calls a **cloud-specific
`…/installation-status`** (status + per-resource steps), the **shared
`…/confirmed-integration`** (the install resource list), and a user-refresh
**`POST …/check-installation`**. Plus two requirements: the IDC response carries a
`firewall_check`/firewall signal, and IDC resource `installation_status: UNKNOWN`
must render **"작업중"**.

Contract: `docs/swagger/install-v1.yaml`
Intended source: `pii-agent-migration-notes/01-target-source-detail-spec.md` §6 + §12
Domain specs already written: IDC = [specs/C-idc.md](../specs/C-idc.md) §3.2/§5/§6;
AWS/Azure/GCP = [specs/G-cloud-status.md](../specs/G-cloud-status.md) §G1–G3. This file
is the per-step verification matrix; the specs hold the full field-by-field reshape.

> **Path-layer note.** This matrix compares the **CSR client** path
> (`app/lib/api/{idc,aws,gcp,azure}.ts`, the `…/installation-status` literal the
> team-lead cited) against the swagger path. The `/install/v1` vs internal
> `/integration/api/v1` prefix is added by `toUpstreamInfraApiPath` /
> `toInternalInfraApiPath` (`lib/infra-api.ts:7-11`) and resolved by the proxy — not a
> Step-4 gap. The separate **upstream `httpBff`** path divergence (AWS uses
> `/aws/projects/{id}/…`) is catalogued in spec-G §3 and not re-litigated here.

## Verification matrix

| Intended API | In swagger? (path + method + 200 schema) | Currently called? (file:line) | Verdict |
|---|---|---|---|
| **IDC** installation-status: `GET …/idc/installation-status` | YES. `install-v1.yaml:2621` `/install/v1/target-sources/{targetSourceId}/idc/installation-status`, `get`, `operationId: getIdcInstallationStatus`; 200 → `IdcInstallationStatusResponse` (`:2688`, schema `:5403`) | YES. `app/lib/api/idc.ts:191` builds `${idcBase(id)}/installation-status` where `idcBase = "/idc/target-sources/${id}"` (`:152`) → `/idc/target-sources/{id}/installation-status`. Hook `app/hooks/useIdcInstallationStatus.ts:47`. UI `IdcStep4Installing.tsx:57` | **PATH RESTRUCTURE** + **full schema replacement** + **UNKNOWN absent**. See F1, F2, F4. |
| **AWS** installation-status: `GET …/aws/installation-status` | YES. `install-v1.yaml:3245` `/install/v1/target-sources/{targetSourceId}/aws/installation-status`, `get`, `operationId: getAwsInstallationStatus`; 200 → `AwsInstallationStatusResponse` (`:3313`, schema `:5639`) | YES. `app/lib/api/aws.ts:20` `${BASE}/${id}/installation-status`, `BASE = '/aws/target-sources'` (`:8`) → `/aws/target-sources/{id}/installation-status`. UI `AwsInstallationInline.tsx:68` via `useInstallationStatus` | CSR path segment order matches swagger ✓. **200 schema mismatch** (script-centric vs resource-centric). See F3. |
| **GCP** installation-status: `GET …/gcp/installation-status` | YES. `install-v1.yaml:2828` `/install/v1/target-sources/{targetSourceId}/gcp/installation-status`, `get`, `operationId: getGcpInstallationStatus`; 200 → `GcpInstallationStatusResponse` (`:2896`, schema `:5470`) | YES. `app/lib/api/gcp.ts:8` `/gcp/target-sources/${id}/installation-status` | CSR path order matches ✓. **enum + shape mismatch** (`summary`/`resourceType` extra; enum 3-value, missing SKIP/UNKNOWN). See F3. |
| **Azure** installation-status: `GET …/azure/installation-status` | YES. `install-v1.yaml:2968` `/install/v1/target-sources/{targetSourceId}/azure/installation-status`, `get`, `operationId: getInstallationStatus`; 200 → `AzureInstallationStatusResponse` (`:3036`, schema `:5587`) | YES. `app/lib/api/azure.ts:18` `${BASE_URL}/${id}/installation-status`, `BASE_URL = '/azure/target-sources'` (`:4`) → `/azure/target-sources/{id}/installation-status` | CSR path order matches ✓. **schema mismatch** (5-value `last_check`, free-string `private_endpoint.status`, missing `resource_type`, opaque `load_balancer`). See F3. |
| **confirmed-integration** (install resource list, all clouds): `GET …/confirmed-integration` | YES. `install-v1.yaml:2897` `/install/v1/target-sources/{targetSourceId}/confirmed-integration`, `get`, `operationId: getConfirmedIntegration`; 200 → `ConfirmedIntegrationResponse` (`:2967`, schema `:5516`) | YES. `app/lib/api/index.ts:421` `getConfirmedIntegration` → `${CONFIRM_BASE}/${id}/confirmed-integration`, `CONFIRM_BASE = '/target-sources'` (`:294`) → matches swagger verbatim. Cloud Step-4 consumes via `useConfirmedIntegration()` DataProvider (`AwsInstallationInline.tsx:58`, joined `joinAwsResources` `:83`). IDC Step-4 uses `getIdcResources` instead (`IdcStep4Installing.tsx:67`) | **PATH/METHOD MATCH (all clouds)**. 200 response-shape parity to be confirmed against `ConfirmedIntegrationResponse.resource_infos[]` (`ResourceConfigDto`); IDC does **not** use this endpoint for Step-4 — see F5. |
| **check-installation** (user refresh): `POST …/check-installation` | **NO.** No `check-installation` path exists anywhere in `install-v1.yaml` (only the four `installation-status` GETs + `confirmed-integration`). | YES. `idc.ts:201` (`POST …/idc/.../check-installation`), `aws.ts:26`, `gcp.ts:16`, `azure.ts:23` — all `checkXInstallation`, `method: POST`. Wired to UI refresh: `useIdcInstallationStatus.ts:68`, `useInstallationStatus` (`AwsInstallationInline.tsx:72` `checkFn`) | **OUT OF CONTRACT (all clouds).** See F6. |
| **firewall_check** field (IDC) | YES, per resource. `IdcResourceInstallationStatusDto.firewall_check` → `CloudInstallationStepStatusDto` (`{status: COMPLETED\|FAIL\|IN_PROGRESS\|SKIP\|UNKNOWN, guide}`) (`:5445`, dto `:5390`) | **NO.** Code has no `firewall_check`. It uses a boolean `firewall_open` per resource + roll-up `firewall_opened` (`lib/bff/types/idc.ts:65,101`; `idc.ts:139,143`; `IdcStep4Installing.tsx:83,93`). `grep firewall_check app/ lib/` = 0 hits | **SCHEMA MISMATCH.** Contract is a step-status DTO (`{status, guide}`), code is a boolean. See F2. |
| **IDC `installation_status: UNKNOWN` → "작업중"** | YES, the enum value exists. `IdcResourceInstallationStatusDto.installation_status` includes `UNKNOWN` (`:5435`); `IdcLastCheckDto.status` + every `CloudInstallationStepStatusDto.status` also include it. | **NOT IMPLEMENTED.** No per-resource `installation_status` field in the IDC domain at all (`IdcInstallationView`/`IdcResourceInstallView`, `idc.ts:71-76`). `grep "작업중" app/ lib/` = 0 hits; `grep UNKNOWN` in the IDC + install-task-pipeline dirs = 0 hits | **MISSING FEATURE.** See F4. |

## Findings

### F1 — IDC installation-status path is RESTRUCTURED (primary IDC gap)
Swagger places `/idc/` **after** `target-sources/{id}`:
`/install/v1/target-sources/{targetSourceId}/idc/installation-status` (`:2621`).
The CSR client builds it **before**: `idcBase(id) = "/idc/target-sources/${id}"`
(`idc.ts:152`) → `/idc/target-sources/{id}/installation-status`. After the
`/install/v1` prefix this yields `/install/v1/idc/target-sources/{id}/installation-status`
— the `idc` and `target-sources` segments are **swapped** vs the contract. The same
inversion affects **every** IDC endpoint built off `idcBase` (`previous-request`,
`resources`, `check-installation`, `confirm-firewall`). Migration must move `idc/` to
the trailing position. (AWS/GCP/Azure CSR paths already use the swagger order at the
CSR layer — `/{cloud}/target-sources/{id}/…`; only the upstream `httpBff` AWS literal
`/aws/projects/{id}/…` additionally diverges, per spec-G §3.)

### F2 — IDC 200 schema is a full replacement (incl. firewall_check)
Swagger `IdcInstallationStatusResponse` (`:5403`) = `{ last_check: IdcLastCheckDto,
resources: IdcResourceInstallationStatusDto[] }`, where each resource is
`{ resource_id, installation_status (5-enum), bdc_side_cx_terraform_apply,
bdc_side_bdp_terraform_apply, firewall_check }` and the three step fields are each a
`CloudInstallationStepStatusDto` (`{status (5-enum), guide}`, `:5390`).

The code's wire type `IdcInstallationStatus` (`lib/bff/types/idc.ts:96`) is an
**unrelated** shape: `{ provider, bdc_tf, firewall_opened, resources:[{resource_id,
source_ips, firewall_open}], last_checked_at }`. There is **no** `last_check`, **no**
per-resource `installation_status`, and the contract's per-resource `firewall_check`
step DTO is replaced by a **boolean** `firewall_open` (+ roll-up `firewall_opened`).
The mapper `toIdcInstallationView` (`idc.ts:137`) and the Step-4 UI
(`IdcStep4Installing.tsx:82-94`, 2-task pipeline off `bdcTf`/`firewallOpened`) are
built entirely on that non-contract shape. The whole IDC installation-status
wire→domain→UI chain is superseded (spec-C §3.2). **Also note:** spec-C §5 flags that
the per-resource `source_ips`/`firewall_open` powering the Step-4 IDC table's
`src`/`fw` columns (`IdcResourceTable cols={['src','fw']}`) **leave the contract** —
those columns lose their data source and need a product decision.

### F3 — Cloud 200 schemas mismatch (path order is fine; shapes are not)
For AWS/GCP/Azure the CSR path order already matches swagger, but the **200 bodies the
code consumes diverge** from the contract (full field-by-field in spec-G §G1–G3):
- **AWS** — current domain `AwsInstallationStatus` (`lib/types.ts:636`) is
  **script-centric** (`hasExecutionPermission`, `serviceScripts[]`, `bdcStatus`,
  `actionSummary`); the inline reads `status.serviceScripts`/`status.bdcStatus`
  (`AwsInstallationInline.tsx:36-37`). Swagger is **resource-centric**:
  `resources[].installation_status` + three step DTOs (`service_terraform`,
  `bdc_service_terraform`, `bdc_common_terraform`) + `terraform_execution_role_verify`.
  None of the current fields exist in `AwsInstallationStatusResponse`.
- **GCP** — current `GcpInstallationStatusValue = 'COMPLETED'|'FAIL'|'IN_PROGRESS'`
  (`app/api/_lib/v1-types.ts:143`) is **3-value, missing `SKIP` and `UNKNOWN`** that
  swagger declares; current type also adds a `summary` object + `resourceType` not in
  the contract (spec-G §G3).
- **Azure** — swagger `last_check` is 5-value, `private_endpoint.status` is a **free
  string** (not the legacy enum), `resource_type` is added, `vm_installation.load_balancer`
  is an opaque object (spec-G §G2/D-G11).

Cloud `UNKNOWN` rendering stays as the cloud default (no "작업중" relabel — that is
IDC-only); but the GCP enum must still be widened to carry `SKIP`/`UNKNOWN` so the
contract value doesn't break the type.

### F4 — IDC `UNKNOWN` → "작업중" is unimplemented (explicit user requirement)
Spec §12 requires IDC resource status `UNKNOWN` to render **"작업중"**. The contract
exposes it (`installation_status` 5-enum incl. `UNKNOWN`, `:5435`), but the IDC domain
model has **no `installation_status` field** today (the 2-task pipeline maps only
`bdc_tf`→pill + a `firewall_opened` boolean). `grep "작업중"` and `grep UNKNOWN` across
`app/` + `lib/` IDC/install-task code = **0 hits** — net-new surface. spec-C §6
specifies the fix: keep `UNKNOWN` faithful in the domain, map `UNKNOWN`→`'running'`
bucket + "작업중" label in a UI adapter, default missing status to `UNKNOWN` (never
COMPLETED). Recommended scope: resource-level (required) + step-level (for pipeline
cards) — confirm step-level + `SKIP` semantics with the user.

### F5 — confirmed-integration: clouds use it; IDC does not (Step-4)
The "설치 대상 리소스 목록" for cloud Step-4 is `getConfirmedIntegration`
(`app/lib/api/index.ts:421`, path matches swagger verbatim) surfaced via the
`useConfirmedIntegration()` DataProvider and joined into install rows
(`AwsInstallationInline.tsx:58,83` `joinAwsResources`; GCP/Azure analogous via
`join-installation-resources.ts`). **IDC Step-4 instead lists rows from
`getIdcResources`** (`IdcStep4Installing.tsx:67`) — i.e. the IDC `…/idc/resources`
endpoint, which spec-C §5 flags as **absent from swagger** (a separate Step-1 blocker).
So the spec's "confirmed-integration for all clouds incl. IDC" holds for AWS/GCP/Azure
but **not** for the current IDC Step-4, which is wired to a non-contract resources GET.
Verify the `ConfirmedIntegrationResponse` (`resource_infos[]` / `ResourceConfigDto`,
`:5516`) 200 shape against the join logic before cutover.

### F6 — `check-installation` (POST refresh) is not in the contract (all clouds)
The user-refresh "최신 설치 상태 동기화" calls `POST …/check-installation` for all four
clouds (`idc.ts:201`, `aws.ts:26`, `gcp.ts:16`, `azure.ts:23`), wired to the refresh
buttons via the installation-status hooks. **No `check-installation` path exists in
`install-v1.yaml`.** Likely the refresh folds into a plain re-GET of
`installation-status`. Resolution (do not invent the endpoint): confirm with BFF
whether it is pending publication or dropped; if dropped, `refresh()` should re-call
`getXInstallationStatus`. Tracked for IDC in spec-C §5/§7.5; this verification extends
the same gap to AWS/GCP/Azure.

## Verdict

- **IDC** — three blocking gaps: (1) **path restructure** (`/idc/` segment position,
  F1), (2) **full 200-schema replacement** including the `firewall_check` step DTO that
  the code reduces to a boolean (F2), (3) **`UNKNOWN`→"작업중" unimplemented** (F4),
  plus the `src`/`fw` column data-source loss (F2) and the non-contract `…/idc/resources`
  list used in place of `confirmed-integration` (F5). Not contract-clean.
- **AWS / GCP / Azure** — installation-status **CSR path order is correct**, but the
  **200 bodies diverge** (script-centric AWS; GCP missing `SKIP`/`UNKNOWN` + extra
  `summary`/`resourceType`; Azure widened enums / free-string / opaque object) — the
  route transforms + Step-4 UI bindings must be rewritten (spec-G §G1–G3).
- **confirmed-integration** — path + method match for all clouds (F5); IDC Step-4 does
  not consume it.
- **check-installation** — **out of contract for all four clouds** (F6).

Schema alignment (IDC path + full reshape + UNKNOWN feature; cloud transform rewrites +
enum widening; resolve `check-installation`) is required before cutting Step 4 to the
new swagger.
