/**
 * Typed shapes for `bff.gcp` methods.
 *
 * Casing convention (per ADR-011 I-3):
 *   - GET responses are camelCase (httpBff.get runs camelCaseKeys).
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
  resourceId: string;
  resourceName?: string;
  resourceType: LegacyGcpResourceType;
  resourceSubType?: LegacyGcpResourceSubType | null;
  installationStatus: LegacyGcpInstallationStatusValue;
  serviceSideSubnetCreation: LegacyGcpStepStatus;
  serviceSideTerraformApply: LegacyGcpStepStatus;
  bdcSideTerraformApply: LegacyGcpStepStatus;
}

export interface LegacyGcpInstallationStatus {
  provider: 'GCP';
  resources: LegacyGcpResource[];
  lastCheckedAt?: string;
  error?: { code: string; message: string };
}

/**
 * POST /target-sources/{id}/gcp/check-installation.
 * Upstream returns the full installation status (camelCase) — route transforms
 * it via `transformInstallationStatus`.
 */
export type GcpCheckInstallationResult = LegacyGcpInstallationStatus;

/** GET /target-sources/{id}/gcp/installation-status (camelCase). */
export type GcpInstallationStatusResponse = LegacyGcpInstallationStatus;

/** GET /target-sources/{id}/gcp/scan-service-account (camelCase). */
export type GcpScanServiceAccountResponse = GcpServiceAccountInfo;

/** GET /target-sources/{id}/gcp/terraform-service-account (camelCase). */
export type GcpTerraformServiceAccountResponse = GcpServiceAccountInfo;
