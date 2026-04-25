import type { TargetSource, SecretKey } from '@/lib/types';
import type { CurrentUser } from '@/app/lib/api';
import type {
  AwsCheckInstallationResult,
  AwsInstallationStatusResponse,
  AwsSetInstallationModeBody,
  AwsSetInstallationModeResult,
  AwsTerraformScriptResponse,
  AwsVerifyTfRoleBody,
  AwsVerifyTfRoleResult,
} from '@/lib/bff/types/aws';
import type {
  AzureCheckInstallationResult,
  AzureInstallationStatusResponse,
  AzureScanAppResponse,
  AzureSettingsResponse,
  AzureSubnetGuideResponse,
  AzureVmCheckInstallationResult,
  AzureVmInstallationStatusResponse,
  AzureVmTerraformScriptResponse,
} from '@/lib/bff/types/azure';
import type {
  GcpCheckInstallationResult,
  GcpInstallationStatusResponse,
  GcpScanServiceAccountResponse,
  GcpTerraformServiceAccountResponse,
} from '@/lib/bff/types/gcp';
import type {
  ApprovalRequestCreateBody,
  BffConfirmedIntegration,
  ResourceCatalogResponse,
} from '@/lib/bff/types/confirm';

/**
 * BFF data access interface — returns typed domain data (not NextResponse).
 *
 * - mock: wraps existing mock handlers and unwraps payloads to domain data
 * - http: real upstream BFF call
 */
export interface BffClient {
  targetSources: {
    get: (id: number) => Promise<TargetSource>;
    secrets: (id: number) => Promise<SecretKey[]>;
  };
  users: {
    me: () => Promise<CurrentUser>;
  };
  aws: {
    checkInstallation: (id: number) => Promise<AwsCheckInstallationResult>;
    setInstallationMode: (id: number, body: AwsSetInstallationModeBody) => Promise<AwsSetInstallationModeResult>;
    getInstallationStatus: (id: number) => Promise<AwsInstallationStatusResponse>;
    getTerraformScript: (id: number) => Promise<AwsTerraformScriptResponse>;
    verifyTfRole: (id: number, body?: AwsVerifyTfRoleBody) => Promise<AwsVerifyTfRoleResult>;
  };
  azure: {
    checkInstallation: (id: number) => Promise<AzureCheckInstallationResult>;
    getInstallationStatus: (id: number) => Promise<AzureInstallationStatusResponse>;
    getSettings: (id: number) => Promise<AzureSettingsResponse>;
    getSubnetGuide: (id: number) => Promise<AzureSubnetGuideResponse>;
    getScanApp: (id: number) => Promise<AzureScanAppResponse>;
    vmCheckInstallation: (id: number) => Promise<AzureVmCheckInstallationResult>;
    vmGetInstallationStatus: (id: number) => Promise<AzureVmInstallationStatusResponse>;
    vmGetTerraformScript: (id: number) => Promise<AzureVmTerraformScriptResponse>;
  };
  gcp: {
    checkInstallation: (id: number) => Promise<GcpCheckInstallationResult>;
    getInstallationStatus: (id: number) => Promise<GcpInstallationStatusResponse>;
    getScanServiceAccount: (id: number) => Promise<GcpScanServiceAccountResponse>;
    getTerraformServiceAccount: (id: number) => Promise<GcpTerraformServiceAccountResponse>;
  };
  confirm: {
    getResources: (id: number) => Promise<ResourceCatalogResponse>;
    createApprovalRequest: (id: number, body: ApprovalRequestCreateBody) => Promise<unknown>;
    getConfirmedIntegration: (id: number) => Promise<BffConfirmedIntegration>;
    getApprovedIntegration: (id: number) => Promise<unknown>;
    getApprovalHistory: (id: number, page: number, size: number) => Promise<unknown>;
    getApprovalRequestLatest: (id: number) => Promise<unknown>;
    getProcessStatus: (id: number) => Promise<unknown>;
    approveApprovalRequest: (id: number, body: unknown) => Promise<unknown>;
    rejectApprovalRequest: (id: number, body: unknown) => Promise<unknown>;
    cancelApprovalRequest: (id: number) => Promise<unknown>;
    confirmInstallation: (id: number) => Promise<unknown>;
    updateResourceCredential: (id: number, body: unknown) => Promise<unknown>;
    testConnection: (id: number, body: unknown) => Promise<{ id?: string }>;
    getTestConnectionResults: (id: number, page: number, size: number) => Promise<unknown>;
    getTestConnectionLatest: (id: number) => Promise<unknown>;
  };
}
