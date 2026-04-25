/**
 * Typed shapes for `bff.gcp` methods (ADR-011 setup spec adr011-01).
 *
 * Conventions (per adr011-README §"Observable Behavior Invariants" I-3):
 *   - GET responses use camelCase (`proxyGet` runs `camelCaseKeys`).
 *   - POST/PUT/DELETE responses use snake_case (raw passthrough).
 *
 * `LegacyGcpInstallationStatus` currently lives in
 * `app/integration/api/v1/gcp/target-sources/[targetSourceId]/_lib/transform.ts`.
 * The cloud-providers spec (adr011-03) decides whether to move it here or
 * keep the route-local definition while the BFF method imports.
 */

import type { GcpServiceAccountInfo } from '@/app/api/_lib/v1-types';

export type { GcpServiceAccountInfo };
export type { LegacyGcpInstallationStatus } from '@/app/integration/api/v1/gcp/target-sources/[targetSourceId]/_lib/transform';

/** POST /target-sources/{id}/gcp/check-installation (snake_case raw passthrough). */
export interface GcpCheckInstallationResult {
  success?: boolean;
}

/** GET /target-sources/{id}/gcp/installation-status (camelCase). */
export interface GcpInstallationStatusResponse {
  provider: 'GCP';
  resources: Array<{
    resourceId: string;
    resourceName?: string;
    resourceType: 'CLOUD_SQL' | 'BIGQUERY';
    resourceSubType?: string | null;
    installationStatus: 'COMPLETED' | 'FAIL' | 'IN_PROGRESS';
    serviceSideSubnetCreation: { status: string; guide?: string | null };
    serviceSideTerraformApply: { status: string; guide?: string | null };
    bdcSideTerraformApply: { status: string; guide?: string | null };
  }>;
  lastCheckedAt?: string;
  error?: { code: string; message: string };
}

/** GET /target-sources/{id}/gcp/scan-service-account (camelCase). */
export type GcpScanServiceAccountResponse = GcpServiceAccountInfo;

/** GET /target-sources/{id}/gcp/terraform-service-account (camelCase). */
export type GcpTerraformServiceAccountResponse = GcpServiceAccountInfo;
