/**
 * Typed shapes for `bff.gcp` methods.
 *
 * Responses are snake_case at the BFF boundary (see ADR-014).
 *   - POST/PUT/DELETE responses are snake_case raw passthrough.
 */

import type { GcpServiceAccountInfo } from '@/app/api/_lib/v1-types';

export type { GcpServiceAccountInfo };

export type LegacyGcpStepStatusValue = 'COMPLETED' | 'FAIL' | 'IN_PROGRESS' | 'SKIP';
export type LegacyGcpInstallationStatusValue = 'COMPLETED' | 'FAIL' | 'IN_PROGRESS';
export type LegacyGcpResourceType = 'CLOUD_SQL' | 'BIGQUERY';
export type LegacyGcpResourceSubType = 'PRIVATE_IP_MODE' | 'BDC_PRIVATE_HOST_MODE' | 'PSC_MODE';

export interface LegacyGcpStepStatus {
  status: LegacyGcpStepStatusValue;
  guide?: string | null;
}

export interface LegacyGcpResource {
  resource_id: string;
  resource_name?: string;
  resource_type: LegacyGcpResourceType;
  resource_sub_type?: LegacyGcpResourceSubType | null;
  installation_status: LegacyGcpInstallationStatusValue;
  service_side_subnet_creation: LegacyGcpStepStatus;
  service_side_terraform_apply: LegacyGcpStepStatus;
  bdc_side_terraform_apply: LegacyGcpStepStatus;
}

export interface LegacyGcpInstallationStatus {
  provider: 'GCP';
  resources: LegacyGcpResource[];
  last_checked_at?: string;
  error?: { code: string; message: string };
}

/**
 * POST /target-sources/{id}/gcp/check-installation.
 * Upstream returns the full installation status (snake_case) — route transforms
 * it via `transformInstallationStatus`.
 */
export type GcpCheckInstallationResult = LegacyGcpInstallationStatus;

/** GET /target-sources/{id}/gcp/installation-status. */
export type GcpInstallationStatusResponse = LegacyGcpInstallationStatus;

/** GET /target-sources/{id}/gcp/scan-service-account. */
export type GcpScanServiceAccountResponse = GcpServiceAccountInfo;

/** GET /target-sources/{id}/gcp/terraform-service-account. */
export type GcpTerraformServiceAccountResponse = GcpServiceAccountInfo;
