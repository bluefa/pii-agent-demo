/**
 * Wraps the in-memory `lib/bff/mock/*` handlers as `BffClient`.
 *
 * Mock business logic (auth, state transitions, validation) is reused
 * verbatim. The adapter only converts NextResponse → typed data, throwing
 * `BffError` on non-2xx so `withV1` can map it to ProblemDetails.
 *
 * ADR-019 /install/v1 migration: dispatch only for swagger-backed methods.
 * Mocks author the wire (snake) shape; where a domain owns its own boundary
 * (IDC mapper / logical-DB / test-connection route normalizer) the mock returns
 * the raw wire and the downstream boundary camelizes (PLAN §2 mock-parity).
 */
import type { NextResponse } from 'next/server';
import type { BffClient } from '@/lib/bff/types';
import type {
  ApprovalRequestCreateBody,
  BffConfirmedIntegration,
  ResourceCatalogResponse,
} from '@/lib/bff/types/confirm';
import { bffErrorFromBody } from '@/app/api/_lib/problem';
import { camelCaseKeys } from '@/lib/object-case';
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
import { mockIdc } from '@/lib/bff/mock/idc';
import { mockLogicalDb } from '@/lib/bff/mock/logical-db';
import { mockConfirm } from '@/lib/bff/mock/confirm';
import { mockGuides } from '@/lib/bff/mock/guides';
import type {
  AwsInstallationStatusResponse,
  AwsRoleVerificationResponse,
} from '@/lib/bff/types/aws';
import type {
  AzureHealthCheckResult,
  AzureInstallationStatusResponse,
  AzureScanAppResponse,
  AzureSubnetGuideResponse,
} from '@/lib/bff/types/azure';
import type {
  GcpInstallationStatusResponse,
  GcpScanServiceAccountResponse,
  GcpTerraformServiceAccountResponse,
} from '@/lib/bff/types/gcp';
import type {
  IdcInstallationStatusResponseWire,
  IdcPreviousRequestResponseWire,
  NlbOccupiedResourceResponseWire,
  NlbTableResponseWire,
} from '@/lib/bff/types/idc';
import type {
  SkipLogicalDatabaseResponseWire,
  TestedLogicalDatabasesResponseWire,
} from '@/lib/bff/types/logical-db';
import type { z } from 'zod';
import type { schemas } from '@/lib/generated/install-v1';

async function unwrap<T>(response: NextResponse): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw bffErrorFromBody(response.status, body);
  }
  return await response.json() as T;
}

/**
 * Mock parity for camel-boundary methods (PLAN P1): mocks author the swagger
 * snake wire, so the adapter must `camelCaseKeys` exactly like `httpBff.get`
 * does for real BFF — otherwise the BffClient would return snake keys under a
 * camel type (the bug this migration removes). Used only by the cloud
 * installation-status / role-verify / service-account / health-check methods;
 * snake-passthrough domains (IDC, logical-DB, test-connection, azure scan-app)
 * keep raw `unwrap` because their own downstream boundary owns the conversion.
 */
async function unwrapCamel<T>(response: NextResponse): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw bffErrorFromBody(response.status, body);
  }
  return camelCaseKeys(await response.json()) as T;
}

export const mockBff: BffClient = {
  targetSources: {
    get: async (id) => unwrap(await mockTargetSources.get(String(id))),
    list: async (serviceCode) => unwrap(await mockTargetSources.list(serviceCode)),
    create: async (serviceCode, candidate) =>
      unwrap(await mockTargetSources.create(serviceCode, candidate)),
    getCreationCandidates: async (serviceCode, body) =>
      unwrap(await mockTargetSources.previewRegistration(serviceCode, body)),
    getSecrets: async (id) => unwrap(await mockProjects.credentials(String(id))),
  },

  users: {
    search: async (query, excludeIds) => unwrap(await mockUsers.search(query, excludeIds)),
    me: async () => unwrap(await mockUsers.getMe()),
    getServicesPage: async (page, size, query) => unwrap(await mockUsers.getServicesPage(page, size, query)),
  },

  services: {
    permissions: {
      list: async (serviceCode) => unwrap(await mockServices.permissions.list(serviceCode)),
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
    // unwrapCamel: mock authors snake wire → camelCaseKeys (matches httpBff.get).
    getInstallationStatus: async (id) =>
      unwrapCamel<AwsInstallationStatusResponse>(await mockAws.getInstallationStatus(String(id))),
    // Binary download — return the raw Response (NextResponse extends Response).
    getTerraformScript: async (id) => mockAws.getTerraformScript(String(id)),
    verifyScanRole: async (id) =>
      unwrapCamel<AwsRoleVerificationResponse>(await mockAws.verifyScanRole(String(id))),
    verifyExecutionRole: async (id) =>
      unwrapCamel<AwsRoleVerificationResponse>(await mockAws.verifyExecutionRole(String(id))),
  },

  azure: {
    getInstallationStatus: async (id) =>
      unwrapCamel<AzureInstallationStatusResponse>(await mockAzure.getInstallationStatus(String(id))),
    getSubnetGuide: async (id) =>
      unwrapCamel<AzureSubnetGuideResponse>(await mockAzure.getSubnetGuide(String(id))),
    // scan-app is sanctioned snake passthrough (Issue #222) — raw unwrap.
    getScanApp: async (id) =>
      unwrap<AzureScanAppResponse>(await mockAzure.getScanApp(String(id))),
    getPrivateLinkHealthCheck: async (id) =>
      unwrapCamel<AzureHealthCheckResult>(await mockAzure.getPrivateLinkHealthCheck(String(id))),
  },

  gcp: {
    getInstallationStatus: async (id) =>
      unwrapCamel<GcpInstallationStatusResponse>(await mockGcp.getInstallationStatus(String(id))),
    getScanServiceAccount: async (id) =>
      unwrapCamel<GcpScanServiceAccountResponse>(await mockGcp.getScanServiceAccount(String(id))),
    getTerraformServiceAccount: async (id) =>
      unwrapCamel<GcpTerraformServiceAccountResponse>(await mockGcp.getTerraformServiceAccount(String(id))),
  },

  idc: {
    getInstallationStatus: async (id) =>
      unwrap<IdcInstallationStatusResponseWire>(await mockIdc.getInstallationStatus(String(id))),
    getPreviousRequest: async (id) =>
      unwrap<IdcPreviousRequestResponseWire>(await mockIdc.getPreviousRequest(String(id))),
    getOccupiedResources: async (nlbIndex) =>
      unwrap<NlbOccupiedResourceResponseWire[]>(await mockIdc.getOccupiedResources(String(nlbIndex))),
    getNlbTable: async () => unwrap<NlbTableResponseWire[]>(await mockIdc.getNlbTable()),
  },

  logicalDb: {
    getTestedByResourceId: async (id, resourceId) =>
      unwrap<TestedLogicalDatabasesResponseWire>(
        await mockLogicalDb.getTestedByResourceId(String(id), resourceId),
      ),
    getExcludedByResourceId: async (id, resourceId) =>
      unwrap<SkipLogicalDatabaseResponseWire>(
        await mockLogicalDb.getExcludedByResourceId(String(id), resourceId),
      ),
    updateExcludedByResourceId: async (id, resourceId, body) =>
      unwrap<SkipLogicalDatabaseResponseWire>(
        await mockLogicalDb.updateExcludedByResourceId(String(id), resourceId, body),
      ),
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

    markApprovalRequestUnavailable: async (id, body) =>
      unwrap<unknown>(await mockConfirm.markApprovalRequestUnavailable(String(id), body)),

    confirmApprovalUnavailable: async (id) =>
      unwrap<unknown>(await mockConfirm.confirmApprovalUnavailable(String(id))),

    confirmInstallation: async (id) =>
      unwrap<unknown>(await mockConfirm.confirmInstallation(String(id))),

    updateResourceCredential: async (id, body) =>
      unwrap<unknown>(await mockConfirm.updateResourceCredential(String(id), body)),

    testConnection: async (id, collectorImageTag) =>
      unwrap<z.infer<typeof schemas.TestConnectionTriggerResponse>>(
        await mockConfirm.testConnection(String(id), collectorImageTag),
      ),

    getTestConnectionLatest: async (id) =>
      unwrap<z.infer<typeof schemas.TestConnectionVersionResult>>(
        await mockConfirm.getTestConnectionLatest(String(id)),
      ),

    getLatestTestConnectionResultSummaries: async (id) =>
      unwrap<z.infer<typeof schemas.TestConnectionLatestResultSummaryResponse>[]>(
        await mockConfirm.getLatestTestConnectionResultSummaries(String(id)),
      ),

    getTestConnectionCompletionStatus: async (id) =>
      unwrap<z.infer<typeof schemas.TestConnectionCompletionStatusResponse>>(
        await mockConfirm.getTestConnectionCompletionStatus(String(id)),
      ),

    updateTestConnectionConfirmation: async (id, body) =>
      unwrap<z.infer<typeof schemas.TestConnectionConfirmationResponse>>(
        await mockConfirm.updateTestConnectionConfirmation(String(id), body),
      ),
  },

  guides: {
    get: async (name) => unwrap(await mockGuides.get(name)),
    put: async (name, body) => unwrap(await mockGuides.put(name, body)),
  },
};
