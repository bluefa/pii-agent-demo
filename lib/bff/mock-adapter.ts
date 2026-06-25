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
import type { ApprovalRequestCreateBody } from '@/lib/approval-bff';
import { bffErrorFromBody } from '@/app/api/_lib/problem';
import { mockTargetSources } from '@/lib/bff/mock/target-sources';
import { mockProjects } from '@/lib/bff/mock/projects';
import { mockUsers } from '@/lib/bff/mock/users';
import { mockServices } from '@/lib/bff/mock/services';
import { mockScan } from '@/lib/bff/mock/scan';
import { mockAws } from '@/lib/bff/mock/aws';
import { mockAzure } from '@/lib/bff/mock/azure';
import { mockGcp } from '@/lib/bff/mock/gcp';
import { mockIdc } from '@/lib/bff/mock/idc';
import { mockLogicalDb } from '@/lib/bff/mock/logical-db';
import { mockConfirm } from '@/lib/bff/mock/confirm';
import { mockGuides } from '@/lib/bff/mock/guides';
import type { z } from 'zod';
import type { schemas } from '@/lib/generated/install-v1';

async function unwrap<T>(response: NextResponse): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw bffErrorFromBody(response.status, body);
  }
  return await response.json() as T;
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

  scan: {
    get: async (id, scanId) => unwrap(await mockScan.get(String(id), scanId)),
    getHistory: async (id, query) => unwrap(await mockScan.getHistory(String(id), query)),
    create: async (id, body) => unwrap(await mockScan.create(String(id), body)),
    getStatus: async (id) => unwrap(await mockScan.getStatus(String(id))),
  },

  aws: {
    // ADR-019 zod-codegen: mock authors snake wire; route owns parse boundary.
    getInstallationStatus: async (id) =>
      unwrap<z.infer<typeof schemas.AwsInstallationStatusResponse>>(await mockAws.getInstallationStatus(String(id))),
    // Binary download — return the raw Response (NextResponse extends Response).
    getTerraformScript: async (id) => mockAws.getTerraformScript(String(id)),
    verifyScanRole: async (id) =>
      unwrap<z.infer<typeof schemas.AwsRoleVerificationResponse>>(await mockAws.verifyScanRole(String(id))),
    verifyExecutionRole: async (id) =>
      unwrap<z.infer<typeof schemas.AwsRoleVerificationResponse>>(await mockAws.verifyExecutionRole(String(id))),
  },

  // Azure mock returns raw snake wire; the route validates with schemas.X.parse().
  azure: {
    getInstallationStatus: async (id) =>
      unwrap<z.infer<typeof schemas.AzureInstallationStatusResponse>>(await mockAzure.getInstallationStatus(String(id))),
    // scan-app is sanctioned snake passthrough (Issue #222) — raw unwrap.
    getScanApp: async (id) =>
      unwrap<z.infer<typeof schemas.AzureServicePrincipalVerificationResponse>>(await mockAzure.getScanApp(String(id))),
    getPrivateLinkHealthCheck: async (id) =>
      unwrap<z.infer<typeof schemas.AzureHealthCheckResult>>(await mockAzure.getPrivateLinkHealthCheck(String(id))),
  },

  // GCP mock returns raw snake wire; the route validates with schemas.X.parse().
  gcp: {
    getInstallationStatus: async (id) =>
      unwrap<z.infer<typeof schemas.GcpInstallationStatusResponse>>(await mockGcp.getInstallationStatus(String(id))),
    getScanServiceAccount: async (id) =>
      unwrap<z.infer<typeof schemas.GcpServiceAccountInfoResponse>>(await mockGcp.getScanServiceAccount(String(id))),
    getTerraformServiceAccount: async (id) =>
      unwrap<z.infer<typeof schemas.GcpServiceAccountInfoResponse>>(await mockGcp.getTerraformServiceAccount(String(id))),
  },

  idc: {
    getInstallationStatus: async (id) =>
      unwrap<z.infer<typeof schemas.IdcInstallationStatusResponse>>(await mockIdc.getInstallationStatus(String(id))),
    getPreviousRequest: async (id) =>
      unwrap<z.infer<typeof schemas.IdcPreviousRequestResponse>>(await mockIdc.getPreviousRequest(String(id))),
    getOccupiedResources: async (nlbIndex) =>
      unwrap<z.infer<typeof schemas.NlbOccupiedResourceResponse>[]>(await mockIdc.getOccupiedResources(String(nlbIndex))),
    getNlbTable: async () => unwrap<z.infer<typeof schemas.NlbTableResponse>[]>(await mockIdc.getNlbTable()),
  },

  logicalDb: {
    getTestedByResourceId: async (id, resourceId) =>
      unwrap<z.infer<typeof schemas.TestedLogicalDatabasesResponse>>(
        await mockLogicalDb.getTestedByResourceId(String(id), resourceId),
      ),
    getExcludedByResourceId: async (id, resourceId) =>
      unwrap<z.infer<typeof schemas.SkipLogicalDatabaseResponse>>(
        await mockLogicalDb.getExcludedByResourceId(String(id), resourceId),
      ),
    updateExcludedByResourceId: async (id, resourceId, body) =>
      unwrap<z.infer<typeof schemas.SkipLogicalDatabaseResponse>>(
        await mockLogicalDb.updateExcludedByResourceId(String(id), resourceId, body),
      ),
  },

  confirm: {
    getResources: async (id) =>
      unwrap<z.infer<typeof schemas.CloudResourceResponse>>(await mockConfirm.getResources(String(id))),

    createApprovalRequest: async (id, body: ApprovalRequestCreateBody) =>
      unwrap<unknown>(await mockConfirm.createApprovalRequest(String(id), body)),

    getConfirmedIntegration: async (id) =>
      // Mock returns the snake wire shape; the route validates with schemas.X.parse().
      unwrap<z.infer<typeof schemas.ConfirmedIntegrationResponse>>(
        await mockConfirm.getConfirmedIntegration(String(id)),
      ),

    getApprovedIntegration: async (id) =>
      unwrap<z.infer<typeof schemas.ApprovedIntegrationResponseDto>>(
        await mockConfirm.getApprovedIntegration(String(id)),
      ),

    getApprovalHistory: async (id, page, size) =>
      unwrap<unknown>(await mockConfirm.getApprovalHistory(String(id), page, size)),

    getApprovalRequestLatest: async (id) =>
      unwrap<unknown>(await mockConfirm.getApprovalRequestLatest(String(id))),

    getProcessStatus: async (id) =>
      unwrap<z.infer<typeof schemas.ProcessStatusResponseDto>>(await mockConfirm.getProcessStatus(String(id))),

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
