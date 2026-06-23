# Spec G — Cloud Status (AWS / Azure / GCP) — ADR-019 API Migration

> Domain **G** of the `/install/v1` migration (see [PLAN.md](../PLAN.md)). Cloud **installation-status**, **role/SA/app verification**, **terraform-script download**, and **Azure private-link health-check** endpoints.
> Contract source of truth: `docs/swagger/install-v1.yaml` (line refs below are against that file).
> ADR-019 rules applied: responses snake → `camelCaseKeys` at the boundary → camel domain (D1/D2); requests match swagger casing (D3); mocks author the **wire snake** shape so mock == swagger == real (P1 parity); opt-outs are greppable — `getSnakeRaw`/`getRaw` (D6).

---

## 0. Scope — 8 endpoints (10 operations)

| # | Method | Path (`/install/v1` prefix) | operationId | 200 schema | Casing handling |
|---|--------|------------------------------|-------------|------------|-----------------|
| G1 | GET | `…/target-sources/{targetSourceId}/aws/installation-status` | `getAwsInstallationStatus` | `AwsInstallationStatusResponse` | camel (`get`) + zod (D4) |
| G2 | GET | `…/target-sources/{targetSourceId}/azure/installation-status` | `getInstallationStatus` | `AzureInstallationStatusResponse` | camel (`get`) |
| G3 | GET | `…/target-sources/{targetSourceId}/gcp/installation-status` | `getGcpInstallationStatus` | `GcpInstallationStatusResponse` | camel (`get`) |
| G4a | GET | `…/target-sources/{targetSourceId}/aws/verify-scan-role` | `verifyAwsScanRole` | `AwsRoleVerificationResponse` | camel (`get`) |
| G4b | GET | `…/target-sources/{targetSourceId}/aws/verify-execution-role` | `verifyAwsExecutionRole` | `AwsRoleVerificationResponse` | camel (`get`) |
| G5 | GET | `…/target-sources/{targetSourceId}/aws/terraform-script/download` | `getAwsTerraformScript` | binary (`application/octet-stream`) | **`getRaw`** (no camelCase) |
| G6a | GET | `…/target-sources/{targetSourceId}/gcp/scan-service-account` | `getGcpScanServiceAccount` | `GcpServiceAccountInfoResponse` | camel (`get`) |
| G6b | GET | `…/target-sources/{targetSourceId}/gcp/terraform-service-account` | `getGcpTerraformServiceAccount` | `GcpServiceAccountInfoResponse` | camel (`get`) |
| G7 | GET | `/install/v1/target-sources/{target_source_id}/azure/scan-app` | `getAzureScanApp` | `AzureServicePrincipalVerificationResponse` | **`getSnakeRaw`** (Issue #222, transitional) |
| G8 | GET | `/install/v1/infra/target-sources/{targetSourceId}/azure-private-link-health-check` | `getAzurePrivateLinkHealthCheck` | `AzureHealthCheckResult` | camel (`get`) — **NEW endpoint** |

⚠ **Top-line findings** (full detail in §5):
- **AWS-200 anomaly resolved:** the PLAN flagged `getAwsInstallationStatus`'s 200 as parsed `ErrorMessage`. **It is NOT.** Swagger line **3308–3313** binds the 200 to `AwsInstallationStatusResponse` (a proper schema at line 5639). The `ErrorMessage` appears only on the error statuses (400/403/404/409/500/501/502/503), exactly like every other endpoint. The PLAN note was a scanning/parser artifact — there is no authoring bug here.
- **Path inversion (AWS + GCP):** every current AWS path is `…/aws/target-sources/{id}/…` and every GCP path is `…/gcp/target-sources/{id}/…`. Swagger inverts them to `…/target-sources/{id}/aws/…` and `…/target-sources/{id}/gcp/…`. Both the **internal route tree** and the **`httpBff` upstream paths** must move. (Azure already uses the swagger order for installation-status & scan-app.)
- **verify-scan-role / verify-execution-role are mis-wired today:** current routes are **POST** to *different* upstream endpoints (`/services/{code}/settings/aws/verify-scan-role` and `/aws/verify-tf-role`) returning ad-hoc shapes. Swagger says **GET** `…/aws/verify-{scan,execution}-role` → `AwsRoleVerificationResponse`. Full re-point required.
- **`azure-private-link-health-check` does not exist in code** (zero refs). New client method + wire type + mock + (if used) UI adapter.
- **`AwsRoleVerificationResponse`, `AzureHealthCheckResult` have no current code references** — net-new types.
- **`getAwsTerraformScript` content type confirmed** `application/octet-stream`, `type: string, format: binary` (swagger 3241–3244) → `getRaw`. The *current* terraform-script returns a JSON `{ downloadUrl, fileName, expiresAt }` — a contract mismatch (see §5.5).

---

## 1. Architecture recap (where casing happens)

Two HTTP layers; both must end up swagger-exact:

1. **Proxy boundary — `lib/bff/http.ts` (`httpBff`)** — owns the **upstream** path (`/install/v1/...` via `toUpstreamInfraApiPath`). `get()` runs `camelCaseKeys` unless `{ raw: true }`. This is where ADR-019 D1/D2 lives. Mock parity (`lib/bff/mock-adapter.ts`) wraps mock handlers through `unwrap` — today `unwrap` does **not** `camelCaseKeys` (P1 will fix; see §4 note).
2. **CSR client — `app/lib/api/{aws,azure,gcp}.ts`** — calls the **internal** route (`/integration/api/v1/...` via `toInternalInfraApiPath`) through `fetchInfraCamelJson` (which *also* runs `camelCaseKeys`). The internal route handlers (`app/integration/api/v1/.../route.ts`) call the matching `bff.*` method and frequently run a **transform** before returning.

> Net: a wire response can be camelCased up to **three** times today (httpBff.get, optional route transform, fetchInfraCamelJson). `camelCaseKeys` is idempotent on already-camel keys, so this is safe but redundant. The migration keeps the existing 2-layer flow; the single normative boundary is `httpBff.get` (D1). Do **not** add a second snake→camel transform.

### Current symbols (read-only inventory)

| Layer | AWS | Azure | GCP |
|---|---|---|---|
| `httpBff` method (`lib/bff/http.ts`) | `aws.getInstallationStatus` L196, `aws.getTerraformScript` L197, `aws.verifyTfRole` L198 | `azure.getInstallationStatus` L203, `azure.getScanApp` L206 (`{raw:true}`) | `gcp.getInstallationStatus` L214, `gcp.getScanServiceAccount` L215, `gcp.getTerraformServiceAccount` L216 |
| `BffClient` iface (`lib/bff/types.ts`) | L188–194 | L196–204 | L206–211 |
| CSR client (`app/lib/api/*.ts`) | `aws.ts`: `getAwsInstallationStatus` L19, `getAwsTerraformScript` L31 | `azure.ts`: `getAzureInstallationStatus` L15, `getAzureScanApp` L27, `AzureScanApp` iface L7 | `gcp.ts`: `getGcpInstallationStatus` L5, `getGcpScanServiceAccount` L20, `getGcpTerraformServiceAccount` L26 |
| Internal route(s) | `app/integration/api/v1/aws/target-sources/[targetSourceId]/{installation-status,terraform-script,verify-scan-role,verify-execution-role,installation-mode,check-installation}/route.ts` | `app/integration/api/v1/azure/target-sources/[targetSourceId]/{installation-status,...}/route.ts`; `app/integration/api/v1/target-sources/[targetSourceId]/azure/scan-app/route.ts` | `app/integration/api/v1/gcp/target-sources/[targetSourceId]/{installation-status,scan-service-account,terraform-service-account,...}/route.ts` |
| Route transform | `app/integration/api/v1/aws/target-sources/_lib/installation-transform.ts` → `transformAwsInstallationStatus` | (none for installation-status; passthrough) | `app/integration/api/v1/gcp/target-sources/[targetSourceId]/_lib/transform.ts` → `transformInstallationStatus` |
| `httpBff` wire/domain types | `lib/bff/types/aws.ts` (`LegacyAwsInstallationStatus` etc.) | `lib/bff/types/azure.ts` (`LegacyInstallationStatus`, `AzureScanAppResponse`) | `lib/bff/types/gcp.ts` (`LegacyGcpInstallationStatus`, `GcpServiceAccountInfo`) |
| CSR domain types | `lib/types.ts` `AwsInstallationStatus` L636 | `lib/types/azure.ts` `AzureV1InstallationStatus` L139 | `app/api/_lib/v1-types.ts` `GcpInstallationStatusResponse` L169, `GcpServiceAccountInfo` L190 |
| Mock handler | `lib/bff/mock/aws.ts` `mockAws.getInstallationStatus`/`getTerraformScript`/`verifyTfRole` | `lib/bff/mock/azure.ts` `mockAzure.getInstallationStatus`/`getScanApp` | `lib/bff/mock/gcp.ts` `mockGcp.getInstallationStatus`/`getScanServiceAccount`/`getTerraformServiceAccount` |
| Mock data producers | `lib/mock-installation.ts` | `lib/mock-azure.ts` | `lib/mock-gcp.ts` |

---

## 2. Endpoint-by-endpoint contract (wire snake → camel domain)

For each: the **swagger 200 wire** (verbatim snake), the **camel domain** shape the proxy yields post-`camelCaseKeys`, and the **Response→Adapter→UI** mapping. Enums are reproduced exactly.

### G1 — `getAwsInstallationStatus` → `AwsInstallationStatusResponse`
Swagger path L3245; 200 → `AwsInstallationStatusResponse` (L5639–5649).

**Wire (snake):**
```yaml
AwsInstallationStatusResponse:
  last_check: LastCheckInfoDto
  resources: AwsResourceInstallationStatusDto[]
  terraform_execution_role_verify: AwsTerraformExecutionRoleVerifyDto

AwsResourceInstallationStatusDto:
  resource_id: string
  resource_name: string
  installation_status: COMPLETED | FAIL | IN_PROGRESS | SKIP | UNKNOWN
  service_terraform: CloudInstallationStepStatusDto
  bdc_service_terraform: CloudInstallationStepStatusDto
  bdc_common_terraform: CloudInstallationStepStatusDto

AwsTerraformExecutionRoleVerifyDto:
  status: COMPLETED | FAIL | IN_PROGRESS | SKIP | UNKNOWN
  role_arn: string

LastCheckInfoDto:                       # shared by AWS/Azure/GCP installation-status
  status: NEVER_CHECKED | IN_PROGRESS | COMPLETED | FAILED | SUCCESS
  checked_at: date-time
  fail_reason: string

CloudInstallationStepStatusDto:         # shared step DTO
  status: COMPLETED | FAIL | IN_PROGRESS | SKIP | UNKNOWN
  guide: string
```

**Camel domain (post-boundary) — NEW canonical type** (`lib/bff/types/aws.ts`, also surfaced via `app/api/_lib/v1-types.ts`):
```ts
type CloudStepStatus = 'COMPLETED' | 'FAIL' | 'IN_PROGRESS' | 'SKIP' | 'UNKNOWN';
type LastCheckStatus = 'NEVER_CHECKED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'SUCCESS';

interface CloudInstallationStepStatus { status: CloudStepStatus; guide?: string }
interface LastCheckInfo { status: LastCheckStatus; checkedAt?: string; failReason?: string }

interface AwsResourceInstallationStatus {
  resourceId: string;
  resourceName?: string;
  installationStatus: CloudStepStatus;
  serviceTerraform: CloudInstallationStepStatus;
  bdcServiceTerraform: CloudInstallationStepStatus;
  bdcCommonTerraform: CloudInstallationStepStatus;
}
interface AwsTerraformExecutionRoleVerify { status: CloudStepStatus; roleArn?: string }

interface AwsInstallationStatusResponse {
  lastCheck: LastCheckInfo;
  resources: AwsResourceInstallationStatus[];
  terraformExecutionRoleVerify?: AwsTerraformExecutionRoleVerify;
}
```

**Mapping (Response → Adapter → UI):**
- `last_check` → `lastCheck` (used for refresh timestamp / "마지막 확인" + failure banner).
- each `resources[]` → a Step-4 AWS install table row: `installation_status` drives the row badge; `service_terraform` / `bdc_service_terraform` / `bdc_common_terraform` are the three per-resource step cells (준비중/진행중/완료/실패/SKIP), `guide` powers the per-step guide link.
- `terraform_execution_role_verify` → the AWS "실행 권한(Execution Role)" status block on the install screen (`role_arn` shown, `status` badge).

⚠ **Structural break from current domain.** Today's `AwsInstallationStatus` (`lib/types.ts` L636) is `{ hasExecutionPermission, executionRoleArn?, serviceScripts[], bdcStatus, lastCheck, actionSummary }` — derived by `transformAwsInstallationStatus` from a `LegacyAwsInstallationStatus` (`serviceTfScripts`, `bdcTf`). **None of those fields exist in the swagger.** The swagger is resource-centric (`resources[].installation_status` + 3 named step DTOs), not script-centric. → The route transform must be **rewritten** to map swagger snake (post-camel) → the new `AwsInstallationStatusResponse`, and the AWS Step-4 UI re-bound to `resources[]`/step cells. This is the largest piece of Domain G. (`UNKNOWN` rendering for cloud stays as-is per PLAN §6; the `UNKNOWN`→"작업중" relabel is **IDC-only**.)
- **D4 zod:** add `schema.parse(camelCaseKeys(data))` for this response (high-risk, status-bearing).

---

### G2 — `getInstallationStatus` (Azure) → `AzureInstallationStatusResponse`
Swagger path L2968; 200 → `AzureInstallationStatusResponse` (L5587–5595).

**Wire (snake):**
```yaml
AzureInstallationStatusResponse:
  last_check: LastCheckInfoDto
  resources: AzureResourceStatus[]

AzureResourceStatus:
  resource_id: string
  resource_name: string
  resource_type: string
  private_endpoint: PrivateEndpointDetail
  vm_installation: VmInstallationDetail

PrivateEndpointDetail:
  id: string
  name: string
  status: string                        # free string (not enum)

VmInstallationDetail:
  subnet_exists: boolean
  load_balancer: object                 # opaque object (no declared props)
```

**Camel domain:**
```ts
interface PrivateEndpointDetail { id?: string; name?: string; status?: string }
interface VmInstallationDetail { subnetExists?: boolean; loadBalancer?: Record<string, unknown> }
interface AzureResourceStatus {
  resourceId: string;
  resourceName?: string;
  resourceType?: string;
  privateEndpoint?: PrivateEndpointDetail;
  vmInstallation?: VmInstallationDetail;
}
interface AzureInstallationStatusResponse { lastCheck: LastCheckInfo; resources?: AzureResourceStatus[] }
```

**Mapping:** `resources[]` → Step-4 Azure resource rows. `private_endpoint.status` → the Private Endpoint state pill (currently typed as `PrivateEndpointStatus` enum `NOT_REQUESTED|PENDING_APPROVAL|APPROVED|REJECTED` in `lib/types.ts` L107). ⚠ **swagger types `status` as a free `string`** — do not narrow it to the legacy enum; keep `string` and let the UI map known values, else unknown upstream values would break parse. `vm_installation.subnet_exists` / `load_balancer` → VM install sub-status.

⚠ `vm_installation.load_balancer` is a bare `type: object` (no properties). Per ADR-019 **D2.3**, mark it `OpaqueKeys`-safe — `camelCaseKeys` must **not** rewrite its inner keys (they may be Azure-supplied data keys). Domain type = `Record<string, unknown>` / `OpaqueKeys<...>`.

⚠ Divergence vs current: current `AzureV1InstallationStatus` (`lib/types/azure.ts` L139) lacks `resourceType` on the resource and types `lastCheck.status` as `SUCCESS|IN_PROGRESS|FAILED` (3 values) — swagger's `LastCheckInfoDto` has **5** (`NEVER_CHECKED|IN_PROGRESS|COMPLETED|FAILED|SUCCESS`). Widen the union; add `resourceType`.

---

### G3 — `getGcpInstallationStatus` → `GcpInstallationStatusResponse`
Swagger path L2828; 200 → `GcpInstallationStatusResponse` (L5470–5478).

**Wire (snake):**
```yaml
GcpInstallationStatusResponse:
  last_check: LastCheckInfoDto
  resources: GcpResourceInstallationStatusDto[]

GcpResourceInstallationStatusDto:
  resource_id: string
  resource_name: string
  installation_status: COMPLETED | FAIL | IN_PROGRESS | SKIP | UNKNOWN
  service_side_subnet_creation: CloudInstallationStepStatusDto
  service_side_terraform_apply: CloudInstallationStepStatusDto
  bdc_side_terraform_apply: CloudInstallationStepStatusDto
```

**Camel domain:**
```ts
interface GcpResourceInstallationStatus {
  resourceId: string;
  resourceName?: string;
  installationStatus: CloudStepStatus;            // 5-value enum
  serviceSideSubnetCreation: CloudInstallationStepStatus;
  serviceSideTerraformApply: CloudInstallationStepStatus;
  bdcSideTerraformApply: CloudInstallationStepStatus;
}
interface GcpInstallationStatusResponse { lastCheck: LastCheckInfo; resources: GcpResourceInstallationStatus[] }
```

**Mapping:** `resources[]` → Step-4 GCP rows; `installation_status` → row badge; the three `*_terraform_apply`/`subnet_creation` step DTOs → step cells with `guide` links.

⚠ Divergence vs current (large): present `GcpInstallationStatusResponse` (`app/api/_lib/v1-types.ts` L169) adds a **`summary` object** (`totalCount/completedCount/allCompleted`) computed in `transform.ts` (`buildSummary`) and carries `resourceType: CLOUD_SQL|BIGQUERY` + `resourceSubType` on each resource. **Swagger has none of these** — no `summary`, no `resource_type`, no `resource_sub_type`. Also the current enums are 3-/4-value (`installationStatus: COMPLETED|FAIL|IN_PROGRESS`, step `…|SKIP`); swagger is the **5-value** `COMPLETED|FAIL|IN_PROGRESS|SKIP|UNKNOWN` for both. → The GCP route transform must drop `summary`/`resourceType`/`resourceSubType` (or the UI must compute `summary` client-side from `resources` if still needed — confirm with UI owner), widen enums to 5 values, and add `UNKNOWN`. `last_check` must be carried through (current transform already emits `lastCheck`; field names match after camel).

---

### G4a / G4b — `verifyAwsScanRole` / `verifyAwsExecutionRole` → `AwsRoleVerificationResponse`
Swagger paths L3037 (scan) / L3106 (execution); both 200 → `AwsRoleVerificationResponse` (L5625–5638). **Both GET, no request body.**

**Wire (snake):**
```yaml
AwsRoleVerificationResponse:
  status: string                        # free string (no enum in swagger)
  role_arn: string
  fail_reason: string                   # free string (no enum)
  fail_message: string
  last_verified_at: date-time
```

**Camel domain:**
```ts
interface AwsRoleVerificationResponse {
  status?: string;            // keep string; UI maps VALID/INVALID/UNVERIFIED if it likes
  roleArn?: string;
  failReason?: string;
  failMessage?: string;
  lastVerifiedAt?: string;
}
```

**Mapping:** scan-role result → "Scan 권한(Scan Role)" verification block; execution-role result → "실행 권한(Execution Role)" verification block (AWS Scan & 설치 tab per migration-notes §10). `status` badge, `role_arn` shown, `fail_reason`/`fail_message` on failure, `last_verified_at` as "마지막 검증".

⚠ **Mis-wiring (must fix):**
- Current `verify-scan-role/route.ts` is **POST**, resolves the project's `serviceCode`, and calls `bff.services.settings.aws.verifyScanRole(serviceCode)` → upstream **`POST /services/{code}/settings/aws/verify-scan-role`** returning `ServiceSettingsAwsVerifyScanRoleResult` (ad-hoc). Swagger is **`GET /install/v1/target-sources/{id}/aws/verify-scan-role`** → `AwsRoleVerificationResponse`. Re-point: new `httpBff.aws.verifyScanRole(id)` GET method, route → GET, drop the serviceCode resolution.
- Current `verify-execution-role/route.ts` is **POST** with a `{ roleArn }` body → `bff.aws.verifyTfRole(id, body)` → upstream **`POST /aws/verify-tf-role`** (`AwsVerifyTfRoleResult`). Swagger is **`GET …/aws/verify-execution-role`** no body → `AwsRoleVerificationResponse`. Re-point: new `httpBff.aws.verifyExecutionRole(id)` GET, route → GET, drop the body.
- `AwsRoleVerificationResponse` does not exist in code today → net-new type. The old `verifyScanRole`/`verifyTfRole` paths are out-of-G for the *service-settings admin* screen if still used there — confirm before deleting (they live in `lib/bff/http.ts` `services.settings.aws.verifyScanRole` L151 and `aws.verifyTfRole` L198; the latter's only target-source caller is this route). Flag in verification log.

---

### G5 — `getAwsTerraformScript` → binary (`getRaw`)
Swagger path L3175; 200 (L3238–3244): `application/octet-stream`, `schema: { type: string, format: binary }`.

**Handling:** non-JSON → `httpBff` **`getRaw`** (already exists, L46) — returns the `Response` verbatim, **no `camelCaseKeys`** (D6: a `getRaw` opt-out is greppable). The internal route streams the body + `Content-Disposition`/`Content-Type` through. **Confirmed content type: `application/octet-stream` (zip).**

⚠ **Contract mismatch (must fix):** current `aws.getTerraformScript` (L197) uses plain `get()` (JSON) and the domain type `TerraformScriptResponse` = `{ downloadUrl, fileName, expiresAt }` (`lib/types.ts` L646). The current internal route (`…/terraform-script/route.ts`) returns that JSON. Swagger returns the **zip bytes directly** (path is `…/terraform-script/download`). → Migrate to: `httpBff.aws.getTerraformScript = getRaw('/target-sources/{id}/aws/terraform-script/download')`; internal route returns the streamed binary with download headers; CSR triggers a file download (blob) instead of reading `downloadUrl`. Retire `TerraformScriptResponse` on this path. (Path also moves `…/aws/target-sources/{id}/terraform-script` → `…/target-sources/{id}/aws/terraform-script/download` and adds `/download`.)

---

### G6a / G6b — `getGcpScanServiceAccount` / `getGcpTerraformServiceAccount` → `GcpServiceAccountInfoResponse`
Swagger paths L2759 (scan) / L2689 (terraform); both 200 → `GcpServiceAccountInfoResponse` (L5447–5469).

**Wire (snake):**
```yaml
GcpServiceAccountInfoResponse:
  gcp_project_id: string
  status: VALID | INVALID | UNVERIFIED
  fail_reason: SA_NOT_CONFIGURED | SA_NOT_FOUND | SA_INSUFFICIENT_PERMISSIONS | SCAN_SA_UNAVAILABLE
  fail_message: string
  last_verified_at: date-time
```

**Camel domain** (`GcpServiceAccountInfo`, `app/api/_lib/v1-types.ts` L190 — already mostly correct):
```ts
type GcpServiceAccountStatus = 'VALID' | 'INVALID' | 'UNVERIFIED';
type GcpServiceAccountFailReason =
  'SA_NOT_CONFIGURED' | 'SA_NOT_FOUND' | 'SA_INSUFFICIENT_PERMISSIONS' | 'SCAN_SA_UNAVAILABLE';
interface GcpServiceAccountInfo {
  gcpProjectId: string;
  status: GcpServiceAccountStatus;
  failReason?: GcpServiceAccountFailReason | null;
  failMessage?: string | null;
  lastVerifiedAt?: string;
}
```

**Mapping:** scan-SA → GCP "Scan 권한(Service Account)" block; terraform-SA → GCP Terraform Execution SA block. `gcp_project_id` shown, `status` badge, `fail_reason`/`fail_message` on failure, `last_verified_at` as last-verified.

⚠ **Two issues:**
1. **Enum drift in current type:** `GcpServiceAccountFailReason` (`v1-types.ts` L183) lists **`SA_KEY_EXPIRED`** which is **NOT** in swagger; swagger's 4 values are `SA_NOT_CONFIGURED | SA_NOT_FOUND | SA_INSUFFICIENT_PERMISSIONS | SCAN_SA_UNAVAILABLE`. Remove `SA_KEY_EXPIRED` (or keep only if BFF confirms it emits it — swagger says no).
2. **Mock shape is wrong (see §4):** `mockGcp.getScanServiceAccount`/`getTerraformServiceAccount` currently return `{ email, projectId, status:'ACTIVE' }` — none of these fields/values exist in the contract. Must be rewritten to the snake wire.

---

### G7 — `getAzureScanApp` → `AzureServicePrincipalVerificationResponse` (snake path param + raw passthrough)
Swagger path L1685: `/install/v1/target-sources/{target_source_id}/azure/scan-app` — **path param is `target_source_id` (snake!)**, operationId `getAzureScanApp`; 200 → `AzureServicePrincipalVerificationResponse` (L5126–5139).

**Wire (snake):**
```yaml
AzureServicePrincipalVerificationResponse:
  app_id: string
  status: string                        # free string (no enum)
  fail_reason: string
  fail_message: string
  last_verified_at: date-time
```

**Handling — KEEP as raw snake passthrough (Issue #222, transitional).** Per ADR-019 D6 this opt-out must be **greppable**: rename the current `azure.getScanApp` (uses `get(..., { raw: true })`, L206) to use the sanctioned **`getSnakeRaw<T>()`** helper (introduced in P1) so the snake contract is explicit at the call site, not a `{ raw:true }` flag + comment. Domain type stays snake (`AzureScanAppResponse` in `lib/bff/types/azure.ts` L77). The CSR `app/lib/api/azure.ts` currently maps via `fetchInfraCamelJson<AzureScanApp>` (camel iface L7) — ⚠ **this double-handles**: the proxy returns snake (raw), then CSR camelCases it. Acceptable transitionally (the camel `AzureScanApp` UI type is what the component reads), but document that **G7 migrates to fully-camel alongside D5 / Issue #222 closure** (snake path param `target_source_id` → `targetSourceId`, drop `getSnakeRaw`, response camelCased at boundary). **Out of this spec's required change set; documented as the deferred follow-up.**

⚠ **Path param exactness:** the upstream path literal in `httpBff` must keep `{target_source_id}` substitution but the *segment name* is irrelevant at runtime (it's just `/target-sources/${id}/azure/scan-app`). The snake param matters for the swagger contract + future codegen; preserve the literal path `…/azure/scan-app` exactly. Mapping: `app_id`→appId, `status`→status, etc. → Azure "App 스캔 정보" (Service Principal) verification block.

---

### G8 — `getAzurePrivateLinkHealthCheck` → `AzureHealthCheckResult` (NEW)
Swagger path L3681: `/install/v1/infra/target-sources/{targetSourceId}/azure-private-link-health-check` (note the **`/infra/`** infix), operationId `getAzurePrivateLinkHealthCheck`; 200 → `AzureHealthCheckResult` (L5754–5772).

**Wire — already camelCase in swagger** (unusual; this block is camel, not snake):
```yaml
AzureHealthCheckResult:
  healthCheckStatus: HEALTHY | UPDATING | UNHEALTHY | UNHEALTHY_NEED_SERVICE_ACTION
                   | UNHEALTHY_NEED_BDC_SIDE_ACTION | NEED_TERRAFORM_EXECUTION
                   | NEED_SCAN_PERMISSION | INTERNAL_SERVER_ERROR | EMPTY
  azurePrivateLinkHealthResultList: AzurePrivateLinkHealthResult[]

AzurePrivateLinkHealthResult:
  provisioningState: string
  resourceId: string
  privateLinkId: string
  resourceType: <large enum>            # AWS_*/AZURE_*/GCP_*/IDC_RESOURCE — see swagger L5784–5831
  healthCheckStatus: <same 9-value enum as parent>   # ⚠ duplicated field (see below)
```
`resourceType` enum (verbatim, swagger L5784–5831): `AWS_ATHENA, AWS_ATHENA_DATABASE, AWS_DB_CLUSTER, AWS_DB_INSTANCE, AWS_REDSHIFT_CLUSTER, AWS_DYNAMO_DB_REGION, AWS_DYNAMO_DB_TABLE, AWS_DYNAMO_DB_GLOBAL_TABLE, AWS_NETWORK_INTERFACE, AWS_SUBNET, AWS_RDS_GLOBAL_CLUSTER, AWS_RDS_SUBNET_GROUP, AWS_RDS_PROXY, AWS_RDS_DB_CLUSTER_PARAMETER_GROUP, AWS_RDS_DB_PARAMETER_GROUP, AWS_REDSHIFT_SUBNET_GROUP, AWS_VPC_ENDPOINT_SERVICE, AWS_VPC_ENDPOINT, AWS_VPC_SECURITY_GROUP, AWS_IAM_ROLE, AWS_GLUE_RESOURCE_POLICY, AWS_ECR_POLICY, AWS_S3_BUCKET_POLICY, AWS_GLUE_TABLE, AWS_EC2_INSTANCE, AWS_EC2_REGION, AWS_OPEN_SEARCH_DOMAIN, AWS_KMS, AWS_AUTO_SCALING_GROUP, AZURE_SQL_SERVER, AZURE_SQL_SERVER_MANAGED_INSTANCE, AZURE_MYSQL_FLEXIBLE_SERVER, AZURE_MYSQL, AZURE_POSTGRESQL, AZURE_POSTGRESQL_FLEXIBLE_SERVER, AZURE_MARIADB, AZURE_COSMOSDB_NOSQL, AZURE_SERVICE_PRINCIPAL, AZURE_PRIVATE_ENDPOINT, AZURE_VIRTUAL_MACHINE, AZURE_VIRTUAL_SUBNET, AZURE_SYNAPSE_WORKSPACE, AZURE_NETWORK_INTERFACE, GCP_SQL, GCP_BIGQUERY_DATASET_REGION, GCP_VPC_NETWORK, IDC_RESOURCE`.

**Camel domain (NEW):**
```ts
type AzureHealthCheckStatus =
  | 'HEALTHY' | 'UPDATING' | 'UNHEALTHY' | 'UNHEALTHY_NEED_SERVICE_ACTION'
  | 'UNHEALTHY_NEED_BDC_SIDE_ACTION' | 'NEED_TERRAFORM_EXECUTION'
  | 'NEED_SCAN_PERMISSION' | 'INTERNAL_SERVER_ERROR' | 'EMPTY';
type HealthCheckResourceType = /* the full enum above as a string union */;
interface AzurePrivateLinkHealthResult {
  provisioningState?: string;
  resourceId?: string;
  privateLinkId?: string;
  resourceType?: HealthCheckResourceType;
  healthCheckStatus?: AzureHealthCheckStatus;
}
interface AzureHealthCheckResult {
  healthCheckStatus?: AzureHealthCheckStatus;
  azurePrivateLinkHealthResultList?: AzurePrivateLinkHealthResult[];
}
```

**Handling:** the wire is **already camelCase**, so `camelCaseKeys` is a no-op (idempotent) — still route through the normal `get()` boundary for uniformity (don't special-case). **NEW** `httpBff.azure.getPrivateLinkHealthCheck(id)` GET `'/infra/target-sources/{id}/azure-private-link-health-check'`, new `BffClient.azure` method, new internal route `app/integration/api/v1/infra/target-sources/[targetSourceId]/azure-private-link-health-check/route.ts`, new CSR client `app/lib/api/azure.ts` (or `infra.ts`). **Whether the UI consumes it today is unconfirmed (zero refs)** — wire the client + mock; UI binding only if an existing Step-4/Step-6 Azure health panel needs it (confirm with UI owner; otherwise client-only, no UI change).

⚠ **Swagger authoring quirk:** `AzurePrivateLinkHealthResult` declares `healthCheckStatus` **twice** (L5782 and again L5832, identical enum). Harmless duplicate-key in YAML (last wins); type it once. Note in verification log, no action.

⚠ **Path note:** unlike all other G endpoints, G8's path has the `infra/` infix and lives under `BffClient.azure` (or a new `infra` group). The current `app/lib/api/infra.ts` is generic fetch helpers, **not** an endpoint client — placing G8 there vs `azure.ts` is a judgment call; recommend `azure.ts` for cohesion with the other Azure verification calls.

---

## 3. Path migration table (current → swagger)

| Endpoint | Current internal route | Current `httpBff` upstream | **Swagger upstream (target)** | Change |
|---|---|---|---|---|
| AWS install-status | `…/aws/target-sources/{id}/installation-status` | `/aws/projects/{id}/installation-status` | `/target-sources/{id}/aws/installation-status` | path invert + `projects`→`target-sources` + transform rewrite + zod |
| Azure install-status | `…/azure/target-sources/{id}/installation-status` | `/target-sources/{id}/azure/installation-status` | `/target-sources/{id}/azure/installation-status` | ✅ upstream already correct; widen enums, add `resourceType`, OpaqueKeys on `load_balancer` |
| GCP install-status | `…/gcp/target-sources/{id}/installation-status` | `/target-sources/{id}/gcp/installation-status` | `/target-sources/{id}/gcp/installation-status` | ✅ upstream order matches; drop `summary`/`resourceType`/`subType`, widen enums + `UNKNOWN` |
| AWS verify-scan-role | `…/aws/target-sources/{id}/verify-scan-role` (**POST**) | `/services/{code}/settings/aws/verify-scan-role` (POST) | `/target-sources/{id}/aws/verify-scan-role` (**GET**) | method POST→GET, full re-point, new type |
| AWS verify-exec-role | `…/aws/target-sources/{id}/verify-execution-role` (**POST**) | `/aws/verify-tf-role` (POST) | `/target-sources/{id}/aws/verify-execution-role` (**GET**) | method POST→GET, full re-point, new type |
| AWS terraform-script | `…/aws/target-sources/{id}/terraform-script` (JSON) | `/aws/projects/{id}/terraform-script` (JSON) | `/target-sources/{id}/aws/terraform-script/download` (**binary**) | `get`→`getRaw`, add `/download`, JSON→blob |
| GCP scan-SA | `…/gcp/target-sources/{id}/scan-service-account` | `/target-sources/{id}/gcp/scan-service-account` | `/target-sources/{id}/gcp/scan-service-account` | ✅ upstream matches; fix mock + enum |
| GCP terraform-SA | `…/gcp/target-sources/{id}/terraform-service-account` | `/target-sources/{id}/gcp/terraform-service-account` | `/target-sources/{id}/gcp/terraform-service-account` | ✅ upstream matches; fix mock + enum |
| Azure scan-app | `…/target-sources/{id}/azure/scan-app` | `/target-sources/{id}/azure/scan-app` (`{raw:true}`) | `/target-sources/{target_source_id}/azure/scan-app` | keep snake passthrough → `getSnakeRaw`; defer full camel |
| Azure PL health-check | (none) | (none) | `/infra/target-sources/{id}/azure-private-link-health-check` | **NEW** client+route+mock |

> ⚠ The current `httpBff` AWS upstream uses `/aws/projects/{id}/...` (note **`projects`**, a pre-`target-sources` legacy literal) — double divergence (both the `aws/` prefix position **and** `projects` vs `target-sources`). Swagger uses `target-sources` consistently.

---

## 4. Mock plan (mocks author the **wire snake** == swagger)

Per PLAN P1: mock handlers must emit the **swagger snake wire** and (post-P1) route through the same `camelCaseKeys` boundary as `httpBff`. Today they emit camel/ad-hoc shapes — every one below needs reshaping. Seed at least one resource with `installation_status: UNKNOWN` (PLAN requirement, even though the `UNKNOWN`→"작업중" relabel is IDC-only — the cloud mocks should still exercise the value).

### G1 mock — `mockAws.getInstallationStatus`
Current returns `mockInstallation.getInstallationStatus()` = `LegacyAwsInstallationStatus` (`provider, hasTfPermission, serviceTfScripts[], bdcTf, …`). **Replace** with the snake wire:
```jsonc
{
  "last_check": { "status": "COMPLETED", "checked_at": "2026-06-23T10:00:00Z", "fail_reason": null },
  "resources": [
    { "resource_id": "arn:aws:rds:...:db-1", "resource_name": "prod-mysql",
      "installation_status": "COMPLETED",
      "service_terraform":     { "status": "COMPLETED", "guide": null },
      "bdc_service_terraform": { "status": "COMPLETED", "guide": null },
      "bdc_common_terraform":  { "status": "COMPLETED", "guide": null } },
    { "resource_id": "arn:aws:rds:...:db-2", "resource_name": "stg-postgres",
      "installation_status": "IN_PROGRESS",
      "service_terraform":     { "status": "IN_PROGRESS", "guide": "https://guide/aws/service-tf" },
      "bdc_service_terraform": { "status": "UNKNOWN", "guide": null },
      "bdc_common_terraform":  { "status": "UNKNOWN", "guide": null } }   // ← UNKNOWN seed
  ],
  "terraform_execution_role_verify": { "status": "COMPLETED", "role_arn": "arn:aws:iam::123:role/exec" }
}
```

### G2 mock — `mockAzure.getInstallationStatus`
Reshape `mock-azure.ts` output to snake `AzureInstallationStatusResponse`:
```jsonc
{
  "last_check": { "status": "COMPLETED", "checked_at": "2026-06-23T10:00:00Z" },
  "resources": [
    { "resource_id": "/subscriptions/.../servers/sql-1", "resource_name": "sql-1",
      "resource_type": "AZURE_SQL_SERVER",
      "private_endpoint": { "id": "pe-1", "name": "pe-sql-1", "status": "APPROVED" },
      "vm_installation": { "subnet_exists": true, "load_balancer": { "name": "lb-1", "installed": true } } }
  ]
}
```
(`load_balancer` inner object passes through opaque.)

### G3 mock — `mockGcp.getInstallationStatus`
Reshape `mock-gcp.ts` output to snake `GcpInstallationStatusResponse` (drop `provider`/`summary`/`resource_type`/`resource_sub_type`):
```jsonc
{
  "last_check": { "status": "COMPLETED", "checked_at": "2026-06-23T10:00:00Z" },
  "resources": [
    { "resource_id": "projects/p/instances/sql-1", "resource_name": "sql-1",
      "installation_status": "UNKNOWN",                         // ← UNKNOWN seed
      "service_side_subnet_creation": { "status": "COMPLETED", "guide": null },
      "service_side_terraform_apply": { "status": "IN_PROGRESS", "guide": null },
      "bdc_side_terraform_apply":     { "status": "UNKNOWN", "guide": null } }
  ]
}
```

### G4a/G4b mock — new `mockAws.verifyScanRole` / `verifyExecutionRole`
New handlers returning snake `AwsRoleVerificationResponse`:
```jsonc
{ "status": "VALID", "role_arn": "arn:aws:iam::123:role/scan",
  "fail_reason": null, "fail_message": null, "last_verified_at": "2026-06-23T10:00:00Z" }
```
(execution-role variant with `role/exec`.)

### G5 mock — `mockAws.getTerraformScript`
Change from JSON `{ downloadUrl,… }` to a **binary** mock: return a small zip/octet-stream body with `Content-Type: application/octet-stream` + `Content-Disposition: attachment; filename="terraform.zip"`. (Mock adapter must pass through `getRaw` Responses without JSON-parsing — confirm `mock-adapter` handles raw for this method.)

### G6a/G6b mock — `mockGcp.getScanServiceAccount` / `getTerraformServiceAccount`
**Currently wrong** (`{ email, projectId, status:'ACTIVE' }`). Replace with snake `GcpServiceAccountInfoResponse`:
```jsonc
{ "gcp_project_id": "my-project", "status": "VALID",
  "fail_reason": null, "fail_message": null, "last_verified_at": "2026-06-23T10:00:00Z" }
```
(terraform-SA: same shape; optionally a failing example with `status:"INVALID", fail_reason:"SA_INSUFFICIENT_PERMISSIONS"`.)

### G7 mock — `mockAzure.getScanApp`
Already snake (`app_id, status, fail_reason, fail_message, last_verified_at`) — ✅ shape matches `AzureServicePrincipalVerificationResponse`. ⚠ current emits `status:'HEALTHY'`/`'UNREGISTERED'`; swagger `status` is a free string so this is contract-valid, but the camel UI type `AzureScanApp.status` expects `VALID|INVALID|UNVERIFIED|string`. Align mock to emit `VALID`/`UNVERIFIED` for realism (non-blocking). Keep snake passthrough (`getSnakeRaw`).

### G8 mock — new `mockAzure.getPrivateLinkHealthCheck`
New handler returning camel `AzureHealthCheckResult` (wire is camel):
```jsonc
{ "healthCheckStatus": "HEALTHY",
  "azurePrivateLinkHealthResultList": [
    { "provisioningState": "Succeeded", "resourceId": "/subscriptions/.../pe-1",
      "privateLinkId": "pls-1", "resourceType": "AZURE_PRIVATE_ENDPOINT", "healthCheckStatus": "HEALTHY" } ] }
```

> **P1 dependency:** `lib/bff/mock-adapter.ts` `unwrap()` does **not** currently `camelCaseKeys`. Once P1 makes mock-adapter route through `camelCaseKeys` (matching `httpBff.get`), these snake mocks yield the same camel domain as real. Until then the CSR's `fetchInfraCamelJson` still camelCases at the second layer, so the UI sees camel either way — but author the **mocks in snake now** so they are literal swagger examples (the P1 goal). The `getSnakeRaw` (G7) and `getRaw` (G5) mocks must bypass the camel step in both layers.

---

## 5. Discrepancies & resolutions (verification-log rows)

| # | Endpoint | Discrepancy | Resolution |
|---|---|---|---|
| D-G1 | aws/installation-status | PLAN said 200 parsed as `ErrorMessage` | **Not a bug.** Swagger L3308–3313 binds 200 to `AwsInstallationStatusResponse` (L5639). `ErrorMessage` only on 4xx/5xx. PLAN note = parser artifact. **No action.** |
| D-G2 | aws + gcp paths | current uses `…/{cloud}/target-sources/{id}/…`; AWS upstream even uses `/aws/projects/{id}/…` | Invert to `…/target-sources/{id}/{cloud}/…` per swagger; AWS `projects`→`target-sources`. Move both internal routes and `httpBff` literals. |
| D-G3 | aws installation-status shape | current `serviceScripts`/`bdcStatus`/`actionSummary` vs swagger `resources[].installation_status` + 3 step DTOs + `terraform_execution_role_verify` | Rewrite `transformAwsInstallationStatus`; re-bind AWS Step-4 UI to resource rows + step cells; add `terraformExecutionRoleVerify` block. |
| D-G4 | gcp installation-status shape | current adds `summary`, `resource_type:CLOUD_SQL|BIGQUERY`, `resource_sub_type`; 3-/4-value enums | Swagger has none of `summary`/`resource_type`/`sub_type`; widen enums to 5-value incl. `UNKNOWN`. Compute `summary` client-side only if UI still needs it (confirm UI owner). |
| D-G5 | aws verify-scan-role | current **POST** → `/services/{code}/settings/aws/verify-scan-role` (ad-hoc result) | Swagger **GET** `…/aws/verify-scan-role` → `AwsRoleVerificationResponse`. New GET `httpBff.aws.verifyScanRole(id)`; route POST→GET; new type. Confirm the service-settings POST endpoint still needed elsewhere before deleting. |
| D-G6 | aws verify-execution-role | current **POST** `/aws/verify-tf-role` with `{roleArn}` body | Swagger **GET** `…/aws/verify-execution-role` no body → `AwsRoleVerificationResponse`. New GET method; route POST→GET; drop body. |
| D-G7 | aws terraform-script | current JSON `{downloadUrl,fileName,expiresAt}` via `get` | Swagger binary `application/octet-stream` at `…/terraform-script/**download**`. Switch to `getRaw`, stream blob, drop `TerraformScriptResponse` on this path. |
| D-G8 | gcp service-account fail_reason | current `GcpServiceAccountFailReason` includes `SA_KEY_EXPIRED` not in swagger | Remove `SA_KEY_EXPIRED` (swagger: 4 values). Confirm BFF never emits it. |
| D-G9 | gcp scan/terraform SA mock | mock returns `{email, projectId, status:'ACTIVE'}` — not in contract | Rewrite mock to snake `GcpServiceAccountInfoResponse`. |
| D-G10 | azure/scan-app | snake **path param** `target_source_id`; raw snake passthrough (Issue #222) | Keep snake passthrough via **`getSnakeRaw`** (greppable D6). Preserve path literal. **Document** full-camel migration alongside D5/Issue #222 (out of this spec's required change). |
| D-G11 | azure installation-status | `private_endpoint.status` free string in swagger vs current `PrivateEndpointStatus` enum; `last_check.status` 3 vs 5 values; missing `resource_type`; `vm_installation.load_balancer` opaque object | Keep `status` as `string`; widen `lastCheck.status` to 5; add `resourceType`; mark `load_balancer` `OpaqueKeys` (D2.3). |
| D-G12 | azure-private-link-health-check | endpoint absent in code (zero refs); wire is **camelCase** (not snake); `healthCheckStatus` duplicated in `AzurePrivateLinkHealthResult` | NEW client+route+mock+types. `camelCaseKeys` no-op (still route through `get`). De-dup the field once. UI binding only if an existing panel needs it. |
| D-G13 | AwsRoleVerification / AzureHealthCheckResult `status`/`fail_reason` | swagger types them as free `string` (no enum) | Keep `string` in domain types; let UI map known values. Do not invent enums the contract doesn't declare. |

---

## 6. Build checklist (within PLAN Phase P6, after P1 foundation)

1. **Types** — new canonical camel types: `CloudStepStatus`(5), `CloudInstallationStepStatus`, `LastCheckInfo`(5), `AwsInstallationStatusResponse`(resources+steps+roleVerify), `AwsRoleVerificationResponse`, `AzureInstallationStatusResponse`(widened), `AzureHealthCheckResult`+`AzurePrivateLinkHealthResult`+enums, `GcpInstallationStatusResponse`(no summary/type, 5-enum), `GcpServiceAccountInfo`(drop `SA_KEY_EXPIRED`). Keep `AzureScanAppResponse` snake.
2. **`httpBff` (`lib/bff/http.ts`)** — move AWS/GCP paths to `…/target-sources/{id}/{cloud}/…`; add `aws.verifyScanRole` (GET), `aws.verifyExecutionRole` (GET), switch `aws.getTerraformScript` to `getRaw('…/terraform-script/download')`; rename `azure.getScanApp` to `getSnakeRaw`; add `azure.getPrivateLinkHealthCheck` (GET `/infra/…`). Update `BffClient` iface (`lib/bff/types.ts`).
3. **Routes** — rewrite `transformAwsInstallationStatus`; rewrite GCP `transform.ts` (drop summary/type); verify-scan/exec-role routes POST→GET re-point; terraform-script route → stream binary; new `…/infra/target-sources/[id]/azure-private-link-health-check/route.ts`. Add **zod** parse on G1 (D4).
4. **CSR clients (`app/lib/api/*.ts`)** — repoint AWS/GCP paths; `getAzureScanApp` stays snake-aware (document deferral); new `verifyAwsScanRole`/`verifyAwsExecutionRole`/`getAzurePrivateLinkHealthCheck`; terraform-script → blob download.
5. **Mocks** — reshape all to snake wire per §4; seed `UNKNOWN` in AWS+GCP resources; new role-verify / health-check / scan-SA mocks; binary terraform-script mock; ensure mock-adapter passes `getRaw`/`getSnakeRaw` through.
6. **UI** — re-bind AWS Step-4 to `resources[]`+step cells+execution-role block; GCP to 5-value enums (+`UNKNOWN` per cloud default, **not** the IDC "작업중" relabel); fix GCP SA blocks; health-check panel only if an existing component consumes it (confirm). *(UI component inventory pending the Step-4 component sweep — fill exact component paths before coding.)*
7. **Gate** — `tsc`+`lint`+`test`+`build` green; codex(gpt-5.5 xhigh)+opus ≥3 clean per endpoint; rows D-G1…D-G13 resolved in `contract-verification.md`.

---

## 7. Self-review

- **Review 1: clean** — checked all 8 paths + params verbatim against swagger (incl. snake `target_source_id` on G7 L1693, `/infra/` infix + `targetSourceId` on G8 L3681, `/download` suffix on G5 L3175); confirmed every 200 `$ref` (G1 `AwsInstallationStatusResponse` L3313 — **the anomaly is resolved, not ErrorMessage**; G4a/G4b `AwsRoleVerificationResponse` L3105/L3174; G5 binary L3241; G7 `AzureServicePrincipalVerificationResponse` L1753; G8 `AzureHealthCheckResult` L3750).
- **Review 2: clean** — checked every field + enum spelling against component schemas: `installation_status`/step `status` 5-value `COMPLETED|FAIL|IN_PROGRESS|SKIP|UNKNOWN` (L5395–5400 etc.); `LastCheckInfoDto` 5-value incl. `NEVER_CHECKED`/`SUCCESS` (L5503–5510); GCP SA `fail_reason` 4-value (L5460–5464, **no `SA_KEY_EXPIRED`**); health enums (status 9-value L5759–5768, resourceType full union L5784–5831); AWS role-verify `status`/`fail_reason` are **free strings** (L5628/L5632, no enum) — domain keeps `string`. Caught: GCP current type has extra `SA_KEY_EXPIRED`; current `summary`/`resourceType` absent from swagger; Azure `private_endpoint.status` is free string vs legacy enum; `vm_installation.load_balancer` opaque → D2.3.
- **Review 3: clean** — checked Response→Adapter→UI + mock parity + D6: AWS/GCP path inversion (current `/{cloud}/target-sources` + AWS `/projects/`); verify-scan/exec-role POST→GET re-point off `services.settings`/`verify-tf-role`; terraform-script JSON→binary `getRaw`; scan-app `{raw:true}`→`getSnakeRaw` (greppable) with full-camel deferral noted; G8 net-new (zero refs); all mocks reshaped to snake wire with `UNKNOWN` seed (G1+G3). Cross-checked the deferred `getSnakeRaw` (G7) and `getRaw` (G5) opt-outs are the only non-camel paths in Domain G (ADR-019 D6 satisfied).
