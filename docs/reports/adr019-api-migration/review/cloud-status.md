# Cloud-Status Contract Review — bfb5f5a (adversarial)

VERDICT: **NOT CLEAN — 8 issues.** Paths/methods in `httpBff` are swagger-correct, but the response→domain layer (transforms + mocks) was NOT migrated, so the BffClient interface now lies about its runtime shapes; G8 is missing; verify-role mocks are stubs. tsc=0 only because `unwrap<T>`/`as T` mask it.

## Blocking issues

1. **G1 AWS install-status transform UNMIGRATED (D-G3 unresolved).** `app/integration/api/v1/aws/target-sources/_lib/installation-transform.ts` still maps `LegacyAwsInstallationStatus` (`serviceTfScripts`/`bdcTf`/`hasTfPermission`) → old `AwsInstallationStatus` (`serviceScripts`/`bdcStatus`/`actionSummary`). Swagger `AwsInstallationStatusResponse` (`resources[].installation_status` + 3 step DTOs + `terraform_execution_role_verify`) is never produced. Real BFF would break this transform. **No zod (D4 unmet).** `BffClient.aws.getInstallationStatus` (`lib/bff/types.ts:146`) declares `AwsInstallationStatusResponse` but route returns the legacy shape — type lie.

2. **G3 GCP install-status transform UNMIGRATED (D-G4 unresolved).** `app/integration/api/v1/gcp/target-sources/[targetSourceId]/_lib/transform.ts` still emits `summary` (`buildSummary`) + `resourceType: CLOUD_SQL|BIGQUERY` + `resourceSubType`, all of which the spec says swagger lacks and MUST drop. Enums still 3-value (`COMPLETED|FAIL|IN_PROGRESS`), no `UNKNOWN`. Input type `LegacyGcpInstallationStatus` (`provider:'GCP'`), not swagger wire.

3. **G8 azure-private-link-health-check NOT IMPLEMENTED.** Zero refs (`grep PrivateLinkHealth|AzureHealthCheckResult` = 0). No `httpBff.azure.getPrivateLinkHealthCheck`, no `BffClient` method, no route `app/integration/api/v1/infra/target-sources/[id]/...`, no mock, no types. Entire endpoint missing.

4. **G4a/G4b verify-role mocks are stubs (mock-parity / D-G fail).** `mock-adapter.ts:129-132` aliases BOTH `verifyScanRole`/`verifyExecutionRole` to `mockAws.verifyTfRole` cast `as AwsRoleVerificationResponse`. `verifyTfRole` returns the legacy `VerifyTfRoleResponse` shape, not snake `{status, role_arn, fail_reason, fail_message, last_verified_at}`. Routes (`verify-{scan,execution}-role/route.ts`) pass it through untransformed → mock returns wrong shape. (Routes ARE correctly POST→GET re-pointed; httpBff methods correct.)

5. **G6a/G6b GCP SA mock WRONG SHAPE (D-G9 unresolved).** `lib/bff/mock/gcp.ts:58-78` still returns `{ email, projectId, status:'ACTIVE' }` — none of those exist in `GcpServiceAccountInfoResponse` (`gcp_project_id`/`status:VALID|INVALID|UNVERIFIED`/`fail_reason`/`fail_message`/`last_verified_at`). Cast `as GcpScanServiceAccountResponse` in adapter hides it.

6. **G1/G3 mocks not snake + no UNKNOWN seed (§4 unmet).** `mockAws.getInstallationStatus`→`LegacyAwsInstallationStatus`; `mockGcp.getInstallationStatus`→legacy `provider:'GCP'`+`resourceType:CLOUD_SQL|BIGQUERY`. Neither seeds `installation_status:UNKNOWN`. G2 Azure mock (`lib/mock-azure.ts`) emits camel legacy (`privateEndpoint.status` as `PrivateEndpointStatus` enum, `lastCheckedAt`), not snake `AzureInstallationStatusResponse`; no `resource_type`, `last_check` not 5-value. **P1 broken:** `unwrap()` (`mock-adapter.ts:71-77`) does `json() as T` with NO `camelCaseKeys`, so snake-parity isn't actually in effect — mocks are blind-cast.

7. **G5 terraform-script route still returns JSON, not binary (D-G7 partial).** `httpBff.aws.getTerraformScript` correctly uses `getRaw('…/terraform-script/download')` returning `Response`, BUT the route `…/terraform-script/route.ts` does `NextResponse.json(data)` on a `Response` object (serializes a Response → garbage), and `mock-adapter.ts:128` passes the mock JSON straight through. Route must stream the binary body + headers.

8. **G5/G6/G7 CSR clients UNMIGRATED — orphaned non-swagger paths still wired.** `app/lib/api/aws.ts`: `getAwsTerraformScript` still GETs JSON `…/terraform-script` (no `/download`, no blob); `getAwsSettings` GETs removed `…/settings`. `app/lib/api/gcp.ts:8`/`azure.ts`/`aws.ts` all still build the OLD inverted base (`/aws/target-sources`, `/gcp/target-sources`, `/azure/target-sources`) — fine for internal routes, but combined with the above the AWS/GCP CSR↔domain types are stale.

## Remaining non-swagger calls (governing-rule TODO(L3) deferrals — still have callers, NOT removed)

- `app/lib/api/aws.ts:30` `checkAwsInstallation` → POST `/aws/target-sources/{id}/check-installation` — caller `app/components/features/process-status/aws/AwsInstallationInline.tsx:6,71`
- `app/lib/api/aws.ts:50` `setAwsInstallationMode` → POST `/aws/target-sources/{id}/installation-mode` — caller `app/components/features/process-status/aws/AwsInstallationModeSelector.tsx:6,29`
- `app/lib/api/aws.ts:16` `getAwsSettings` → GET `/aws/target-sources/{id}/settings` — (no live component caller found; orphan to delete)
- `app/lib/api/azure.ts:27` `checkAzureInstallation` → POST `/azure/target-sources/{id}/check-installation` — caller `app/components/features/process-status/azure/AzureInstallationInline.tsx:84`
- `app/lib/api/gcp.ts:20` `checkGcpInstallation` → POST `/gcp/target-sources/{id}/check-installation` — caller `app/components/features/process-status/gcp/GcpInstallationInline.tsx:39`
- `lib/bff/http.ts:200` `azure.vmCheckInstallation` → POST `/target-sources/{id}/azure/vm/check-installation` (+ `vm/installation-status`, `vm/terraform-script`) — Azure VM endpoints absent from cloud-status spec scope; flag for owner.

These are honestly flagged with `TODO(L3)` comments (good), but per the team-lead's governing-rule note they remain live non-swagger calls and must be removed via the cloud Step-4 UI rework.
