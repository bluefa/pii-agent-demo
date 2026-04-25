/**
 * Wraps existing mock handlers (which return NextResponse) into the
 * BffClient interface. Reuses mock business logic (auth, state transitions,
 * validation) and converts NextResponse → typed domain data, throwing
 * BffError for non-2xx mock responses.
 */
import type { NextResponse } from 'next/server';
import type { BffClient } from '@/lib/bff/types';
import type { SecretKey } from '@/lib/types';
import type { CurrentUser } from '@/app/lib/api';
import type {
  ApprovalRequestCreateBody,
  BffConfirmedIntegration,
  ResourceCatalogResponse,
} from '@/lib/bff/types/confirm';
import { bffErrorFromBody } from '@/app/api/_lib/problem';
import { mockTargetSources } from '@/lib/api-client/mock/target-sources';
import { mockProjects } from '@/lib/api-client/mock/projects';
import { mockUsers } from '@/lib/api-client/mock/users';
import { mockAws } from '@/lib/api-client/mock/aws';
import { mockAzure } from '@/lib/api-client/mock/azure';
import { mockGcp } from '@/lib/api-client/mock/gcp';
import { mockConfirm } from '@/lib/api-client/mock/confirm';
import { extractTargetSource, type TargetSourceDetailResponse } from '@/lib/target-source-response';
import type {
  AwsCheckInstallationResult,
  AwsInstallationStatusResponse,
  AwsSetInstallationModeResult,
  AwsTerraformScriptResponse,
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

async function unwrap<T>(response: NextResponse): Promise<T> {
  const data = await response.json();
  if (!response.ok) throw bffErrorFromBody(response.status, data);
  return data as T;
}

export const mockBff: BffClient = {
  targetSources: {
    get: async (id) => {
      const res = await mockTargetSources.get(String(id));
      const data = await unwrap<TargetSourceDetailResponse>(res);
      return extractTargetSource(data);
    },

    secrets: async (id) => {
      const res = await mockProjects.credentials(String(id));
      const data = await unwrap<{
        credentials: Array<{ name: string; databaseType?: string; createdAt: string }>;
      }>(res);
      return data.credentials.map((c): SecretKey => ({
        name: c.name,
        createTimeStr: c.createdAt,
      }));
    },
  },

  users: {
    me: async () => {
      const res = await mockUsers.getMe();
      const data = await unwrap<{ user: CurrentUser }>(res);
      return data.user;
    },
  },

  aws: {
    checkInstallation: async (id) =>
      unwrap<AwsCheckInstallationResult>(await mockAws.checkInstallation(String(id))),
    setInstallationMode: async (id, body) =>
      unwrap<AwsSetInstallationModeResult>(await mockAws.setInstallationMode(String(id), body)),
    getInstallationStatus: async (id) =>
      unwrap<AwsInstallationStatusResponse>(await mockAws.getInstallationStatus(String(id))),
    getTerraformScript: async (id) =>
      unwrap<AwsTerraformScriptResponse>(await mockAws.getTerraformScript(String(id))),
    verifyTfRole: async (id, body) =>
      unwrap<AwsVerifyTfRoleResult>(await mockAws.verifyTfRole(String(id), body)),
  },

  azure: {
    checkInstallation: async (id) =>
      unwrap<AzureCheckInstallationResult>(await mockAzure.checkInstallation(String(id))),
    getInstallationStatus: async (id) =>
      unwrap<AzureInstallationStatusResponse>(await mockAzure.getInstallationStatus(String(id))),
    getSettings: async (id) =>
      unwrap<AzureSettingsResponse>(await mockAzure.getSettings(String(id))),
    getSubnetGuide: async (id) =>
      unwrap<AzureSubnetGuideResponse>(await mockAzure.getSubnetGuide(String(id))),
    getScanApp: async (id) =>
      unwrap<AzureScanAppResponse>(await mockAzure.getScanApp(String(id))),
    vmCheckInstallation: async (id) =>
      unwrap<AzureVmCheckInstallationResult>(await mockAzure.vmCheckInstallation(String(id))),
    vmGetInstallationStatus: async (id) =>
      unwrap<AzureVmInstallationStatusResponse>(await mockAzure.vmGetInstallationStatus(String(id))),
    vmGetTerraformScript: async (id) =>
      unwrap<AzureVmTerraformScriptResponse>(await mockAzure.vmGetTerraformScript(String(id))),
  },

  gcp: {
    checkInstallation: async (id) =>
      unwrap<GcpCheckInstallationResult>(await mockGcp.checkInstallation(String(id))),
    getInstallationStatus: async (id) =>
      unwrap<GcpInstallationStatusResponse>(await mockGcp.getInstallationStatus(String(id))),
    getScanServiceAccount: async (id) =>
      unwrap<GcpScanServiceAccountResponse>(await mockGcp.getScanServiceAccount(String(id))),
    getTerraformServiceAccount: async (id) =>
      unwrap<GcpTerraformServiceAccountResponse>(await mockGcp.getTerraformServiceAccount(String(id))),
  },

  confirm: {
    getResources: async (id) =>
      unwrap<ResourceCatalogResponse>(await mockConfirm.getResources(String(id))),

    createApprovalRequest: async (id, body: ApprovalRequestCreateBody) =>
      unwrap<unknown>(await mockConfirm.createApprovalRequest(String(id), body)),

    getConfirmedIntegration: async (id): Promise<BffConfirmedIntegration> =>
      // Mock returns the flat shape; httpBff owns envelope unwrapping.
      unwrap<BffConfirmedIntegration>(await mockConfirm.getConfirmedIntegration(String(id))),

    getApprovedIntegration: async (id) =>
      unwrap<unknown>(await mockConfirm.getApprovedIntegration(String(id))),

    getApprovalHistory: async (id, page, size) =>
      unwrap<unknown>(await mockConfirm.getApprovalHistory(String(id), page, size)),

    getApprovalRequestLatest: async (id) =>
      unwrap<unknown>(await mockConfirm.getApprovalRequestLatest(String(id))),

    getProcessStatus: async (id) =>
      unwrap<unknown>(await mockConfirm.getProcessStatus(String(id))),

    approveApprovalRequest: async (id, body) =>
      unwrap<unknown>(await mockConfirm.approveApprovalRequest(String(id), body)),

    rejectApprovalRequest: async (id, body) =>
      unwrap<unknown>(await mockConfirm.rejectApprovalRequest(String(id), body)),

    cancelApprovalRequest: async (id) =>
      unwrap<unknown>(await mockConfirm.cancelApprovalRequest(String(id))),

    confirmInstallation: async (id) =>
      unwrap<unknown>(await mockConfirm.confirmInstallation(String(id))),

    updateResourceCredential: async (id, body) =>
      unwrap<unknown>(await mockConfirm.updateResourceCredential(String(id), body)),

    testConnection: async (id, body) =>
      unwrap<{ id?: string }>(await mockConfirm.testConnection(String(id), body)),

    getTestConnectionResults: async (id, page, size) =>
      unwrap<unknown>(await mockConfirm.getTestConnectionResults(String(id), page, size)),

    getTestConnectionLatest: async (id) =>
      unwrap<unknown>(await mockConfirm.getTestConnectionLatest(String(id))),
  },
};
