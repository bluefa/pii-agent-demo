/**
 * Typed shapes for `bff.gcp` methods.
 *
 * ADR-019 /install/v1 migration (Spec G — cloud-status). GET responses are the
 * swagger camel domain (httpBff.get runs camelCaseKeys at the one boundary);
 * mocks author the snake wire so mock == swagger == real BFF.
 *
 * Source of truth: docs/swagger/install-v1.yaml
 *   - GcpInstallationStatusResponse (L5470) — no summary / resource_type
 *   - GcpResourceInstallationStatusDto (L5481) — 5-value installation_status
 *   - GcpServiceAccountInfoResponse (L5447) — 4-value fail_reason (no SA_KEY_EXPIRED)
 */

import type {
  CloudInstallationStepStatus,
  CloudStepStatus,
  LastCheckInfo,
} from '@/lib/bff/types/aws';

/** swagger GcpResourceInstallationStatusDto. */
export interface GcpResourceInstallationStatus {
  resourceId: string;
  resourceName?: string;
  installationStatus: CloudStepStatus;
  serviceSideSubnetCreation: CloudInstallationStepStatus;
  serviceSideTerraformApply: CloudInstallationStepStatus;
  bdcSideTerraformApply: CloudInstallationStepStatus;
}

/** GET …/gcp/installation-status — swagger GcpInstallationStatusResponse (camel domain). */
export interface GcpInstallationStatusResponse {
  lastCheck: LastCheckInfo;
  resources: GcpResourceInstallationStatus[];
}

/** swagger GcpServiceAccountInfoResponse.status. */
export type GcpServiceAccountStatus = 'VALID' | 'INVALID' | 'UNVERIFIED';

/** swagger GcpServiceAccountInfoResponse.fail_reason (4 values, no SA_KEY_EXPIRED). */
export type GcpServiceAccountFailReason =
  | 'SA_NOT_CONFIGURED'
  | 'SA_NOT_FOUND'
  | 'SA_INSUFFICIENT_PERMISSIONS'
  | 'SCAN_SA_UNAVAILABLE';

/** swagger GcpServiceAccountInfoResponse (camel domain). */
export interface GcpServiceAccountInfo {
  gcpProjectId: string;
  status: GcpServiceAccountStatus;
  failReason?: GcpServiceAccountFailReason | null;
  failMessage?: string | null;
  lastVerifiedAt?: string;
}

/** GET …/gcp/scan-service-account — swagger GcpServiceAccountInfoResponse (camel). */
export type GcpScanServiceAccountResponse = GcpServiceAccountInfo;

/** GET …/gcp/terraform-service-account — swagger GcpServiceAccountInfoResponse (camel). */
export type GcpTerraformServiceAccountResponse = GcpServiceAccountInfo;
