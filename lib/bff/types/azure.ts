/**
 * Typed shapes for `bff.azure` methods (ADR-011 setup spec adr011-01).
 *
 * Conventions (per adr011-README §"Observable Behavior Invariants" I-3):
 *   - GET responses use camelCase (`proxyGet` runs `camelCaseKeys`).
 *   - POST/PUT/DELETE responses use snake_case (raw passthrough).
 *
 * `LegacyInstallationStatus` and `LegacyVmInstallationStatus` currently live
 * in `app/integration/api/v1/azure/target-sources/[targetSourceId]/_lib/transform.ts`
 * (route-local). The cloud-providers spec (adr011-03) decides whether to move
 * them here or keep the route-local definition while the BFF method imports.
 */

import type {
  AzureSubnetGuide,
  AzureScanApp,
  AzureTerraformScript,
} from '@/lib/types/azure';

export type { LegacyAzureSettings } from '@/app/integration/api/v1/azure/target-sources/[targetSourceId]/_lib/settings-transform';
export type {
  LegacyInstallationStatus,
  LegacyVmInstallationStatus,
} from '@/app/integration/api/v1/azure/target-sources/[targetSourceId]/_lib/transform';

/** POST /target-sources/{id}/azure/check-installation (snake_case raw passthrough). */
export interface AzureCheckInstallationResult {
  success?: boolean;
  installed?: boolean;
}

/** GET /target-sources/{id}/azure/installation-status (camelCase). */
export interface AzureInstallationStatusResponse {
  provider: 'Azure';
  installed: boolean;
  resources: Array<Record<string, unknown>>;
  lastCheckedAt?: string;
  error?: { code: string; message: string };
}

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
export interface AzureVmInstallationStatusResponse {
  vms: Array<{
    vmId: string;
    vmName: string;
    subnetExists: boolean;
    loadBalancer: { installed: boolean; name: string };
    privateEndpoint?: { id: string | null; name: string | null; status: string };
  }>;
  lastCheckedAt?: string;
  error?: { code: string; message: string };
}

/** GET /target-sources/{id}/azure/vm/terraform-script (camelCase). */
export type AzureVmTerraformScriptResponse = AzureTerraformScript;
