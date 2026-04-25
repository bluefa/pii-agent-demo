/**
 * Typed shapes for `bff.azure` methods (ADR-011 setup spec adr011-01).
 *
 * Conventions (per adr011-README §"Observable Behavior Invariants" I-3):
 *   - GET responses use camelCase (`proxyGet` runs `camelCaseKeys`).
 *   - POST/PUT/DELETE responses use snake_case (raw passthrough).
 *
 * `LegacyAzureSettings`, `LegacyInstallationStatus`, and
 * `LegacyVmInstallationStatus` are duplicated from the route-handler
 * `_lib/*` files. Spec adr011-03 (cloud-providers) will migrate the route
 * handlers to import from this file and remove the local definitions; this
 * setup spec only declares the shapes here.
 */

import type {
  AzureSubnetGuide,
  AzureScanApp,
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

/** POST /target-sources/{id}/azure/check-installation (snake_case raw passthrough). */
export interface AzureCheckInstallationResult {
  success?: boolean;
  installed?: boolean;
}

/** GET /target-sources/{id}/azure/installation-status (camelCase). */
export type AzureInstallationStatusResponse = LegacyInstallationStatus;

/** GET /target-sources/{id}/azure/settings (camelCase). */
export interface AzureSettingsResponse {
  scanApp: AzureScanApp;
  tenantId?: string;
  subscriptionId?: string;
}

/** GET /target-sources/{id}/azure/subnet-guide (camelCase). */
export type AzureSubnetGuideResponse = AzureSubnetGuide;

/** GET /target-sources/{id}/azure/scan-app (camelCase). */
export type AzureScanAppResponse = AzureScanApp;

/** POST /target-sources/{id}/azure/vm/check-installation (snake_case raw passthrough). */
export interface AzureVmCheckInstallationResult {
  success?: boolean;
}

/** GET /target-sources/{id}/azure/vm/installation-status (camelCase). */
export type AzureVmInstallationStatusResponse = LegacyVmInstallationStatus;

/** GET /target-sources/{id}/azure/vm/terraform-script (camelCase). */
export type AzureVmTerraformScriptResponse = AzureTerraformScript;
