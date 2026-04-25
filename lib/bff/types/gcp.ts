/**
 * Typed shapes for `bff.gcp` methods (ADR-011 setup spec adr011-01).
 *
 * Conventions (per adr011-README §"Observable Behavior Invariants" I-3):
 *   - GET responses use camelCase (`proxyGet` runs `camelCaseKeys`).
 *   - POST/PUT/DELETE responses use snake_case (raw passthrough).
 *
 * `LegacyGcpInstallationStatus` is duplicated from the route-handler
 * `_lib/transform.ts`. Spec adr011-03 (cloud-providers) will migrate the
 * route handler to import from this file and remove the local definition;
 * this setup spec only declares the shape here.
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

/** POST /target-sources/{id}/gcp/check-installation (snake_case raw passthrough). */
export interface GcpCheckInstallationResult {
  success?: boolean;
}

/** GET /target-sources/{id}/gcp/installation-status (camelCase). */
export type GcpInstallationStatusResponse = LegacyGcpInstallationStatus;

/** GET /target-sources/{id}/gcp/scan-service-account (camelCase). */
export type GcpScanServiceAccountResponse = GcpServiceAccountInfo;

/** GET /target-sources/{id}/gcp/terraform-service-account (camelCase). */
export type GcpTerraformServiceAccountResponse = GcpServiceAccountInfo;
