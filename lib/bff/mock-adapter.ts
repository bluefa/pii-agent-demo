/**
 * Wraps the in-memory `lib/api-client/mock/*` handlers as `BffClient`.
 *
 * Mock business logic (auth, state transitions, validation) is reused
 * verbatim. The adapter only converts NextResponse → typed data, throwing
 * `BffError` on non-2xx so `withV1` can map it to ProblemDetails.
 *
 * Per ADR-011 §"Cross-cutting decisions" #3, mock-only `authorize()`
 * checks are preserved by default — tests asserting 401/403 from mocks
 * continue to pass via the BffError → ProblemDetails path.
 */
import type { NextResponse } from 'next/server';
import type { BffClient } from '@/lib/bff/types';
import { snakeCaseKeys } from '@/lib/object-case';
import type {
  ApprovalRequestCreateBody,
  BffConfirmedIntegration,
  ResourceCatalogResponse,
} from '@/lib/bff/types/confirm';
import { bffErrorFromBody } from '@/app/api/_lib/problem';
import { mockTargetSources } from '@/lib/bff/mock/target-sources';
import { mockProjects } from '@/lib/bff/mock/projects';
import { mockUsers } from '@/lib/bff/mock/users';
import { mockServices } from '@/lib/bff/mock/services';
import { mockDashboard } from '@/lib/bff/mock/dashboard';
import { mockDev } from '@/lib/bff/mock/dev';
import { mockScan } from '@/lib/bff/mock/scan';
import { mockQueueBoard } from '@/lib/bff/mock/queue-board';
import { mockAws } from '@/lib/bff/mock/aws';
import { mockAzure } from '@/lib/bff/mock/azure';
import { mockGcp } from '@/lib/bff/mock/gcp';
import { mockConfirm } from '@/lib/bff/mock/confirm';
import { mockGuides } from '@/lib/bff/mock/guides';
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
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw bffErrorFromBody(response.status, body);
  }
  return snakeCaseKeys(await response.json()) as T;
}

export const mockBff: BffClient = {
  targetSources: {
    get: async (id) => unwrap(await mockTargetSources.get(String(id))),
    list: async (serviceCode) => unwrap(await mockTargetSources.list(serviceCode)),
    create: async (body) => unwrap(await mockTargetSources.create(body)),
  },

  projects: {
    get: async (id) => unwrap(await mockProjects.get(String(id))),
    delete: async (id) => unwrap(await mockProjects.delete(String(id))),
    create: async (body) => unwrap(await mockProjects.create(body)),
    approve: async (id, body) => unwrap(await mockProjects.approve(String(id), body)),
    reject: async (id, body) => unwrap(await mockProjects.reject(String(id), body)),
    confirmTargets: async (id, body) => unwrap(await mockProjects.confirmTargets(String(id), body)),
    completeInstallation: async (id) => unwrap(await mockProjects.completeInstallation(String(id))),
    confirmCompletion: async (id) => unwrap(await mockProjects.confirmCompletion(String(id))),
    credentials: async (id) => unwrap(await mockProjects.credentials(String(id))),
    history: async (id, query) => unwrap(await mockProjects.history(String(id), {
      type: query.type ?? '',
      limit: query.limit ?? '',
      offset: query.offset ?? '',
    })),
    resourceCredential: async (id, body) => unwrap(await mockProjects.resourceCredential(String(id), body)),
    resourceExclusions: async (id) => unwrap(await mockProjects.resourceExclusions(String(id))),
    resources: async (id) => unwrap(await mockProjects.resources(String(id))),
    scan: async (id) => unwrap(await mockProjects.scan(String(id))),
    terraformStatus: async (id) => unwrap(await mockProjects.terraformStatus(String(id))),
    testConnection: async (id, body) => unwrap(await mockProjects.testConnection(String(id), body)),
  },

  users: {
    search: async (query, excludeIds) => unwrap(await mockUsers.search(query, excludeIds)),
    me: async () => unwrap(await mockUsers.getMe()),
    getServices: async () => unwrap(await mockUsers.getServices()),
    getServicesPage: async (page, size, query) => unwrap(await mockUsers.getServicesPage(page, size, query)),
  },

  services: {
    permissions: {
      list: async (serviceCode) => unwrap(await mockServices.permissions.list(serviceCode)),
      add: async (serviceCode, body) => unwrap(await mockServices.permissions.add(serviceCode, body)),
      remove: async (serviceCode, userId) => unwrap(await mockServices.permissions.remove(serviceCode, userId)),
    },
    settings: {
      aws: {
        get: async (serviceCode) => unwrap(await mockServices.settings.aws.get(serviceCode)),
        update: async (serviceCode, body) => unwrap(await mockServices.settings.aws.update(serviceCode, body)),
        verifyScanRole: async (serviceCode) => unwrap(await mockServices.settings.aws.verifyScanRole(serviceCode)),
      },
    },
  },

  dashboard: {
    summary: async () => unwrap(await mockDashboard.summary()),
    systems: async (params) => unwrap(await mockDashboard.systems(params)),
    systemsExport: async (params) => mockDashboard.systemsExport(params),
  },

  dev: {
    getUsers: async () => unwrap(await mockDev.getUsers()),
    switchUser: async (body) => unwrap(await mockDev.switchUser(body)),
  },

  scan: {
    get: async (id, scanId) => unwrap(await mockScan.get(String(id), scanId)),
    getHistory: async (id, query) => unwrap(await mockScan.getHistory(String(id), query)),
    create: async (id, body) => unwrap(await mockScan.create(String(id), body)),
    getStatus: async (id) => unwrap(await mockScan.getStatus(String(id))),
  },

  taskAdmin: {
    getApprovalRequestQueue: async (params) => unwrap(await mockQueueBoard.getApprovalRequestQueue(params)),
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

    systemResetApprovalRequest: async (id) =>
      unwrap<unknown>(await mockConfirm.systemResetApprovalRequest(String(id))),

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

  guides: {
    get: async (name) => unwrap(await mockGuides.get(name)),
    put: async (name, body) => unwrap(await mockGuides.put(name, body)),
  },
};
