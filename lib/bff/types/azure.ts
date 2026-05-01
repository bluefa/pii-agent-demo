/**
 * Typed shapes for `bff.azure` methods.
 *
 * Responses are snake_case at the BFF boundary (see ADR-014).
 *   - POST/PUT/DELETE responses are snake_case raw passthrough.
 *   - getScanApp is a documented exception: snake_case raw per Issue #222.
 */

import type {
  AzureSubnetGuide,
  AzureTerraformScript,
} from '@/lib/types/azure';

export interface LegacyPrivateEndpoint {
  id: string | null;
  name: string | null;
  status: string;
  requested_at?: string;
  approved_at?: string;
  rejected_at?: string;
}

export interface LegacyAzureResource {
  resource_id: string;
  resource_name: string;
  resource_type: string;
  private_endpoint: LegacyPrivateEndpoint | null;
}

export interface LegacyInstallationStatus {
  provider: string;
  installed: boolean;
  resources: LegacyAzureResource[];
  last_checked_at?: string;
  error?: { code: string; message: string };
}

export interface LegacyLoadBalancer {
  installed: boolean;
  name: string;
}

export interface LegacyAzureVmStatus {
  vm_id: string;
  vm_name: string;
  subnet_exists: boolean;
  load_balancer: LegacyLoadBalancer;
  private_endpoint?: LegacyPrivateEndpoint;
}

export interface LegacyVmInstallationStatus {
  vms: LegacyAzureVmStatus[];
  last_checked_at?: string;
  error?: { code: string; message: string };
}

/**
 * POST /target-sources/{id}/azure/check-installation.
 * Upstream returns the full DB installation status (snake_case) — composite
 * route merges with vmCheckInstallation via buildV1Response.
 */
export type AzureCheckInstallationResult = LegacyInstallationStatus;

/** GET /target-sources/{id}/azure/installation-status. */
export type AzureInstallationStatusResponse = LegacyInstallationStatus;

/** GET /target-sources/{id}/azure/subnet-guide. */
export type AzureSubnetGuideResponse = AzureSubnetGuide;

/**
 * GET /target-sources/{id}/azure/scan-app.
 * Issue #222 contract: route returns the upstream payload verbatim.
 * (Boundary already produces snake_case per ADR-014, so this is the same
 * shape as everything else.)
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
 * Upstream returns the full VM installation status (snake_case).
 */
export type AzureVmCheckInstallationResult = LegacyVmInstallationStatus;

/** GET /target-sources/{id}/azure/vm/installation-status. */
export type AzureVmInstallationStatusResponse = LegacyVmInstallationStatus;

/** GET /target-sources/{id}/azure/vm/terraform-script. */
export type AzureVmTerraformScriptResponse = AzureTerraformScript;
