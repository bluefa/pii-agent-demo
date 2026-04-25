/**
 * Typed shapes for `bff.azure` methods.
 *
 * Casing convention (per ADR-011 I-3):
 *   - GET responses are camelCase (httpBff.get runs camelCaseKeys).
 *   - POST/PUT/DELETE responses are snake_case raw passthrough.
 *   - getScanApp is a documented exception: snake_case raw per Issue #222.
 */

import type {
  AzureSubnetGuide,
  AzureTerraformScript,
} from '@/lib/types/azure';

export type AzureScanAppStatus = 'VALID' | 'INVALID' | 'UNVERIFIED' | string;

export interface LegacyScanApp {
  registered?: boolean;
  appId?: string;
  app_id?: string;
  status?: AzureScanAppStatus;
  lastVerifiedAt?: string;
  last_verified_at?: string;
  failReason?: string;
  fail_reason?: string;
  failMessage?: string;
  fail_message?: string;
}

export interface LegacyAzureSettings {
  scanApp?: LegacyScanApp;
  scan_app?: LegacyScanApp;
  tenantId?: string;
  tenant_id?: string;
  subscriptionId?: string;
  subscription_id?: string;
}

export interface LegacyPrivateEndpoint {
  id: string | null;
  name: string | null;
  status: string;
  requestedAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
}

export interface LegacyAzureResource {
  resourceId: string;
  resourceName: string;
  resourceType: string;
  privateEndpoint: LegacyPrivateEndpoint | null;
}

export interface LegacyInstallationStatus {
  provider: string;
  installed: boolean;
  resources: LegacyAzureResource[];
  lastCheckedAt?: string;
  error?: { code: string; message: string };
}

export interface LegacyLoadBalancer {
  installed: boolean;
  name: string;
}

export interface LegacyAzureVmStatus {
  vmId: string;
  vmName: string;
  subnetExists: boolean;
  loadBalancer: LegacyLoadBalancer;
  privateEndpoint?: LegacyPrivateEndpoint;
}

export interface LegacyVmInstallationStatus {
  vms: LegacyAzureVmStatus[];
  lastCheckedAt?: string;
  error?: { code: string; message: string };
}

/**
 * POST /target-sources/{id}/azure/check-installation.
 * Upstream returns the full DB installation status (camelCase) — composite
 * route merges with vmCheckInstallation via buildV1Response.
 */
export type AzureCheckInstallationResult = LegacyInstallationStatus;

/** GET /target-sources/{id}/azure/installation-status (camelCase). */
export type AzureInstallationStatusResponse = LegacyInstallationStatus;

/** GET /target-sources/{id}/azure/settings — legacy raw shape (route normalizes camelCase + snake_case). */
export type AzureSettingsResponse = LegacyAzureSettings;

/** GET /target-sources/{id}/azure/subnet-guide (camelCase). */
export type AzureSubnetGuideResponse = AzureSubnetGuide;

/**
 * GET /target-sources/{id}/azure/scan-app.
 * Issue #222 contract: snake_case raw passthrough (route returns the upstream
 * payload verbatim). Exception to the GET-camelCase rule because the upstream
 * BFF returns snake_case for this endpoint.
 */
export interface AzureScanAppResponse {
  app_id: string | null;
  status: string;
  fail_reason?: string | null;
  fail_message?: string | null;
  last_verified_at?: string | null;
}

/**
 * POST /target-sources/{id}/azure/vm/check-installation.
 * Upstream returns the full VM installation status (camelCase).
 */
export type AzureVmCheckInstallationResult = LegacyVmInstallationStatus;

/** GET /target-sources/{id}/azure/vm/installation-status (camelCase). */
export type AzureVmInstallationStatusResponse = LegacyVmInstallationStatus;

/** GET /target-sources/{id}/azure/vm/terraform-script (camelCase). */
export type AzureVmTerraformScriptResponse = AzureTerraformScript;
