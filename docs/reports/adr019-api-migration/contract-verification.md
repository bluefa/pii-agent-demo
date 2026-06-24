# ADR-019 Contract Verification Log

Per-endpoint contract review tracker. Source of truth: `docs/swagger/install-v1.yaml`.

**Gate:** an endpoint advances only at **3/3** clean reviews (codex gpt-5.5 xhigh + opus, alternating),
covering: (a) path verbatim, (b) request schema (field/casing/required/enum), (c) response schema,
(d) **Response→Adapter→UI mapping** (no silent drop/rename), (e) mock wire == swagger, (f) ADR-019 D6
(no silent `as T`; opt-outs greppable). Overall ≥10 whole-contract convergence rounds.

Status legend: ⬜ pending · 🔶 in review (n/3) · ✅ 3/3 clean · ⚠ blocked on discrepancy (see PLAN §4).

## Phase 2 — Test Connection
| # | Method | Path | operationId | Req | Resp | Reviews | Status |
|---|--------|------|-------------|-----|------|---------|--------|
| 1 | POST | `…/test-connection/async` | requestTestConnection | — (q `collectorImageTag?`) | `TestConnectionTriggerResponse` | 0/3 | ⬜ |
| 2 | GET | `…/test-connection/latest_version` | getLatestTestConnectionStatus | — | `TestConnectionVersionResult` | 0/3 | ⬜ |
| 3 | GET | `…/test-connection/latest-results` | getLatestTestConnectionResultSummaries | — | `TestConnectionLatestResultSummaryResponse` | 0/3 | ⬜ |
| 4 | GET | `…/test-connection/completion-status` | getTestConnectionCompletionStatus | — | `TestConnectionCompletionStatusResponse` | 0/3 | ⬜ |
| 5 | PUT | `…/test-connection-acknowledgment` | updateTestConnectionConfirmation | `UpdateTestConnectionConfirmationRequest` | `TestConnectionConfirmationResponse` | 0/3 | ⬜ |

## Phase 3 — Logical DB
| # | Method | Path | operationId | Req | Resp | Reviews | Status |
|---|--------|------|-------------|-----|------|---------|--------|
| 6 | GET | `…/tested-logical-databases` | getTestedLogicalDatabases | — | `TestedLogicalDatabasesResponse` | 0/3 | ⬜ |
| 7 | GET | `…/tested-logical-databases/by-resource-id` | getTestedLogicalDatabasesByResourceId | — (q `resourceId`) | `TestedLogicalDatabasesResponse` | 0/3 | ⬜ |
| 8 | GET | `…/excluded-databases` | getExcludedLogicalDatabases | — | `SkipLogicalDatabaseResponse` | 0/3 | ⬜ |
| 9 | PUT | `…/excluded-databases` | updateExcludedLogicalDatabases | `UpdateSkipLogicalDatabaseRequest` | `SkipLogicalDatabaseResponse` | 0/3 | ⬜ |
| 10 | GET | `…/excluded-databases/by-resource-id` | getExcludedLogicalDatabasesByResourceId | — (q `resourceId`) | `SkipLogicalDatabaseResponse` | 0/3 | ⬜ |
| 11 | PUT | `…/excluded-databases/by-resource-id` | updateExcludedLogicalDatabasesByResourceId | `UpdateSkipLogicalDatabaseRequest` | `SkipLogicalDatabaseResponse` | 0/3 | ⬜ |

> ⚠ `skip_reason` enum = `STG | DEV | TEMP` (NOT `TMP`). PLAN §4.1.

## Phase 4 — IDC
| # | Method | Path | operationId | Req | Resp | Reviews | Status |
|---|--------|------|-------------|-----|------|---------|--------|
| 12 | GET | `…/idc/previous-request` | getIdcPreviousRequest | — | `IdcPreviousRequestResponse` | 0/3 | ⬜ |
| 13 | GET | `…/idc/installation-status` | getIdcInstallationStatus | — | `IdcInstallationStatusResponse` | 0/3 | ⬜ |
| 14 | GET | `/idc/nlb/{nlbIndex}/resources` | getOccupiedResources | — | `NlbOccupiedResourceResponse` | 0/3 | ⬜ |
| 15 | GET | `/idc/nlb/table` | getNlbTable | — | `NlbTableResponse` | 0/3 | ⬜ |

> Feature: `installation_status: UNKNOWN` → render "작업중" (PLAN §6). ⚠ `idc/resources` (Step1 save) absent — PLAN §4.2.

## Phase 5 — Approval
| # | Method | Path | operationId | Req | Resp | Reviews | Status |
|---|--------|------|-------------|-----|------|---------|--------|
| 16 | POST | `…/approval-requests` | createApprovalRequest | `ApprovalRequestInputDto` | `ApprovalRequestSummaryDto` | 0/3 | ⬜ |
| 17 | POST | `…/approval-requests/reject` | rejectApprovalRequest | `ApprovalRejectRequestDto` | `ApprovalActionResponseDto` | 0/3 | ⬜ |
| 18 | POST | `…/approval-requests/cancel` | cancelApprovalRequest | — | `ApprovalActionResponseDto` | 0/3 | ⬜ |
| 19 | POST | `…/approval-requests/approve` | approveApprovalRequest | `ApprovalApproveRequestDto` | `ApprovalActionResponseDto` | 0/3 | ⬜ |
| 20 | GET | `…/approval-requests/latest` | getLatestApprovalRequest | — | `ApprovalRequestLatestDto` ⚠ | 0/3 | ⬜ |
| 21 | GET | `…/approval-history` | getApprovalHistory | — | `Page` ⚠ | 0/3 | ⬜ |
| 22 | POST | `…/approval-unavailable` | markApprovalRequestUnavailable | `ApprovalRejectRequestDto` | `ApprovalUnavailableResponseDto` | 0/3 | ⬜ |
| 23 | POST | `…/approval-unavailable/confirm` | confirmApprovalUnavailable | — | `ApprovalUnavailableConfirmResponseDto` | 0/3 | ⬜ |

> ⚠ `approval-requests/system-reset` (current code) absent in swagger — PLAN §4.4.

## Phase 6 — Target source / scan / resources / install / misc
| # | Method | Path | operationId | Req | Resp | Reviews | Status |
|---|--------|------|-------------|-----|------|---------|--------|
| 24 | GET | `…/{targetSourceId}` | getTargetSourceDetail | — | `TargetSourceDetail` | 0/3 | ⬜ |
| 25 | GET | `…/process-status` | getProcessStatus | — | `ProcessStatusResponseDto` | 0/3 | ⬜ |
| 26 | GET | `…/resources` | getRecommendedResources | — | `CloudResourceResponse` | 0/3 | ⬜ |
| 27 | GET | `…/confirmed-integration` | getConfirmedIntegration | — | `ConfirmedIntegrationResponse` | 0/3 | ⬜ |
| 28 | GET | `…/approved-integration` | getApprovedIntegration | — | `ApprovedIntegrationResponseDto` ⚠ | 0/3 | ⬜ |
| 29 | GET | `…/secrets` | getTargetSourceSecrets | — | `SecretResponse` | 0/3 | ⬜ |
| 30 | PUT | `…/resources/credential` | updateResourceCredential | `UpdateCredentialRequest` (camel) | `UpdateCredentialResponse` | 0/3 | ⬜ |
| 31 | POST | `…/scan` | startScan | — | `ScanJobResponse` | 0/3 | ⬜ |
| 32 | GET | `…/scanJob/latest` | getLatestScan | — | `ScanJobResponse` | 0/3 | ⬜ |
| 33 | GET | `…/scan/history` | getScanHistory | — | `PageScanJobResponse` | 0/3 | ⬜ |
| 34 | POST | `…/pii-agent-installation/confirm` | confirmPiiAgentInstallation | `PiiAgentInstallationConfirmRequest` | `TargetSourceResponse` | 0/3 | ⬜ |
| 35 | POST | `…/services/{serviceCode}/creation-candidates` | getTargetSourceCreationCandidates | `TargetSourceCreationCandidateRequest` | `TargetSourceCreationCandidateResponse` | 0/3 | ⬜ |
| 36 | POST | `…/services/{serviceCode}/target-sources` | createTargetSource | `TargetSourceCreationCandidateResponse` ⚠ | `TargetSourceInfo` | 0/3 | ⬜ |
| 37 | GET | `…/services/{serviceCode}` | getTargetSourcesByServiceCode | — | `TargetSourceDetail` ⚠ | 0/3 | ⬜ |
| 38 | GET | `/services/{serviceCode}/authorized-users` | getServiceAuthorizedUsers | — | `AuthorizedUsersResponse` ⚠ | 0/3 | ⬜ |
| 39 | GET | `…/{target_source_id}/azure/scan-app` | getAzureScanApp | — | `AzureServicePrincipalVerificationResponse` (getSnakeRaw) | 0/3 | ⬜ |
| 40 | GET | `…/azure/installation-status` | getInstallationStatus | — | `AzureInstallationStatusResponse` ⚠ | 0/3 | ⬜ |
| 41 | GET | `…/aws/installation-status` | getAwsInstallationStatus | — | ⚠ verify (parsed as `ErrorMessage`) | 0/3 | ⬜ |
| 42 | GET | `…/aws/verify-scan-role` | verifyAwsScanRole | — | `AwsRoleVerificationResponse` ⚠ | 0/3 | ⬜ |
| 43 | GET | `…/aws/verify-execution-role` | verifyAwsExecutionRole | — | `AwsRoleVerificationResponse` ⚠ | 0/3 | ⬜ |
| 44 | GET | `…/aws/terraform-script/download` | (download) | — | binary (`getRaw`) | 0/3 | ⬜ |
| 45 | GET | `…/gcp/scan-service-account` | getGcpScanServiceAccount | — | `GcpServiceAccountInfoResponse` | 0/3 | ⬜ |
| 46 | GET | `…/gcp/terraform-service-account` | getGcpTerraformServiceAccount | — | `GcpServiceAccountInfoResponse` | 0/3 | ⬜ |
| 47 | GET | `…/gcp/installation-status` | getGcpInstallationStatus | — | `GcpInstallationStatusResponse` | 0/3 | ⬜ |
| 48 | GET | `/users/search` | searchUsers | — | `UserSearchResponse` | 0/3 | ⬜ |
| 49 | GET | `/user/services/page` | getUserServices | — | `PageServiceItem` | 0/3 | ⬜ |
| 50 | GET | `/user/me` | getUserMe | — | `UserMeResponse` | 0/3 | ⬜ |
| 51 | GET/PUT | `/admin/guides/{name}` | getGuide / updateGuide | `GuideUpdateRequest` | `GuideDetail` | 0/3 | ⬜ |
| 52 | GET | `/infra/target-sources/{id}/azure-private-link-health-check` | getAzurePrivateLinkHealthCheck | — | `AzureHealthCheckResult` ⚠ | 0/3 | ⬜ |

(51/52 are grouped guide + infra endpoints; count > 50 because guides is GET+PUT on one path.)

## Whole-contract convergence rounds (≥10)
| Round | Date | Reviewer | Scope | Open findings after |
|-------|------|----------|-------|---------------------|
| 1 | — | — | — | — |
