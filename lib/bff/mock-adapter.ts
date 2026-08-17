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
import { bffErrorFromBody } from '@/app/api/_lib/problem';
import { mockTargetSources } from '@/lib/bff/mock/target-sources';
import { mockProjects } from '@/lib/bff/mock/projects';
import { mockUsers } from '@/lib/bff/mock/users';
import { mockServices } from '@/lib/bff/mock/services';
import { mockScan } from '@/lib/bff/mock/scan';
import { mockAws } from '@/lib/bff/mock/aws';
import { mockOps, mockServiceJiraTickets } from '@/lib/bff/mock/ops';
import { mockAccess } from '@/lib/bff/mock/access';
import { mockAzure } from '@/lib/bff/mock/azure';
import { mockGcp } from '@/lib/bff/mock/gcp';
import { mockIdc } from '@/lib/bff/mock/idc';
import { mockLogicalDb } from '@/lib/bff/mock/logical-db';
import { mockConfirm } from '@/lib/bff/mock/confirm';
import { mockTaskQueue } from '@/lib/bff/mock/task-queue';
import { mockGuides } from '@/lib/bff/mock/guides';
import { mockPipeline } from '@/lib/bff/mock/pipeline';
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
  // Pipeline domain (LIN-25): NON-throwing — returns `{ status, body }` verbatim
  // (204 → body null). Business logic lives in `lib/bff/mock/pipeline.ts`.
  pipeline: {
    liveStatistics: async () => mockPipeline.liveStatistics(),
    statistics: async (period) => mockPipeline.statistics(period),
    list: async (query) => mockPipeline.list(query),
    detail: async (pipelineId) => mockPipeline.detail(pipelineId),
    taskDetail: async (pipelineId, taskId) => mockPipeline.taskDetail(pipelineId, taskId),
    jobResult: async (pipelineId, taskId, attemptNumber, jobId) =>
      mockPipeline.jobResult(pipelineId, taskId, attemptNumber, jobId),
    jobState: async (pipelineId, taskId, attemptNumber, jobId) =>
      mockPipeline.jobState(pipelineId, taskId, attemptNumber, jobId),
    cancel: async (pipelineId) => mockPipeline.cancel(pipelineId),
    listByTarget: async (targetSourceId, query) => mockPipeline.listByTarget(targetSourceId, query),
    latestByTarget: async (targetSourceId) => mockPipeline.latestByTarget(targetSourceId),
    preview: async (targetSourceId, type) => mockPipeline.preview(targetSourceId, type),
    create: async (targetSourceId, body) => mockPipeline.create(targetSourceId, body),
    createCustom: async (targetSourceId, body) => mockPipeline.createCustom(targetSourceId, body),
    taskDefinitions: async (provider) => mockPipeline.taskDefinitions(provider),
    restartPreview: async (targetSourceId, pipelineId, fromSequence) =>
      mockPipeline.restartPreview(targetSourceId, pipelineId, fromSequence),
    restart: async (targetSourceId, pipelineId, body) =>
      mockPipeline.restart(targetSourceId, pipelineId, body),
  },

  targetSources: {
    get: async (id) => unwrap(await mockTargetSources.get(String(id))),
    list: async (serviceCode) => unwrap(await mockTargetSources.list(serviceCode)),
    create: async (serviceCode, candidate) =>
      unwrap(await mockTargetSources.create(serviceCode, candidate)),
    getCreationCandidates: async (serviceCode, body) =>
      unwrap(await mockTargetSources.previewRegistration(serviceCode, body)),
    getSecrets: async (id) => unwrap(await mockProjects.credentials(String(id))),
    getJiraTicket: async (id) => unwrap(await mockTargetSources.getJiraTicket(String(id))),
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
    jiraTickets: {
      list: async (serviceCode) => unwrap(await mockServiceJiraTickets.list(serviceCode)),
      attach: async (serviceCode, cloudProvider, issueKey, validate) => {
        // 204 — unwrap() would choke on the empty body, so only surface errors.
        const response = await mockServiceJiraTickets.attach(serviceCode, cloudProvider, issueKey, validate);
        if (!response.ok) await unwrap(response);
      },
      detach: async (serviceCode, cloudProvider) =>
        unwrap(await mockServiceJiraTickets.detach(serviceCode, cloudProvider)),
      addWatcher: async (serviceCode, cloudProvider, userId) => {
        // 204 — unwrap() would choke on the empty body, so only surface errors.
        const response = await mockServiceJiraTickets.addWatcher(serviceCode, cloudProvider, userId);
        if (!response.ok) await unwrap(response);
      },
    },
  },

  scan: {
    get: async (id, scanId) => unwrap(await mockScan.get(String(id), scanId)),
    // The mock module slices with limit/offset; the boundary speaks the swagger's page/size.
    getHistory: async (id, query) =>
      unwrap(await mockScan.getHistory(String(id), { limit: query.size, offset: query.page * query.size })),
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
    // Contract gap (no generated schema) — the route validates with its own zod schema.
    searchEc2Resources: async (id, query, limit) =>
      unwrap<unknown>(await mockAws.searchEc2Resources(String(id), query, limit)),
  },

  // Ops console — ASSUMED contracts (docs/api/ops-assumed-contracts.md).
  ops: {
    getStatusHistory: async (id, page, size) => unwrap(await mockOps.getStatusHistory(id, page, size)),
    putInstallationMode: async (id, grant) => unwrap(await mockOps.putInstallationMode(id, grant)),
    putRole: async (id, kind, roleArn) => unwrap(await mockOps.putRole(id, kind, roleArn)),
    getTargetSourceList: async (query, page, size) =>
      unwrap(await mockOps.getTargetSourceList(query, page, size)),
  },

  // 서비스 접근 권한 — 규칙(승인=부여, 400/멱등, 마지막 관리자)은 mock 모듈에 산다.
  access: {
    listServices: async (query, page, size) =>
      unwrap(await mockAccess.listServices(query, page, size)),
    listServiceOwners: async (code) => unwrap(await mockAccess.listServiceOwners(code)),
    addServiceOwners: async (code, emails) =>
      unwrap(await mockAccess.addServiceOwners(code, emails)),
    removeServiceOwner: async (code, email) =>
      unwrap(await mockAccess.removeServiceOwner(code, email)),
    listAdmins: async () => unwrap(await mockAccess.listAdmins()),
    addAdmin: async (email) => unwrap(await mockAccess.addAdmin(email)),
    removeAdmin: async (email) => {
      await unwrap(await mockAccess.removeAdmin(email));
    },
    listRequests: async (status, page, size) =>
      unwrap(await mockAccess.listRequests(status, page, size)),
    getRequest: async (requestId) => unwrap(await mockAccess.getRequest(requestId)),
    approveRequest: async (requestId, message) => {
      await unwrap(await mockAccess.approveRequest(requestId, message));
    },
    rejectRequest: async (requestId, reason) => {
      await unwrap(await mockAccess.rejectRequest(requestId, reason));
    },
    listHistory: async (query, page, size) =>
      unwrap(await mockAccess.listHistory(query, page, size)),
    createRequest: async (code, reason) => {
      await unwrap(await mockAccess.createRequest(code, reason));
    },
    listMyRequests: async (page, size) => unwrap(await mockAccess.listMyRequests(page, size)),
    listUserServices: async (query, page, size) =>
      unwrap(await mockAccess.listUserServices(query, page, size)),
    listServicesPage: async (query, page, size) =>
      unwrap(await mockAccess.listServicesPage(query, page, size)),
    searchUsers: async (query) => unwrap(await mockAccess.searchUsers(query)),
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

  // Admin Task Queue: mock authors the wire shape; the admin/queue routes own
  // the wire→camel boundary (lib/types/task-queue.ts).
  taskQueue: {
    getDashboardSummary: async () =>
      unwrap<z.infer<typeof schemas.DashboardSummaryResponse>>(await mockTaskQueue.getDashboardSummary()),
    getProcessStatuses: async (query) =>
      unwrap<z.infer<typeof schemas.PageProcessStatusCurrentResponse>>(
        await mockTaskQueue.getProcessStatuses(query),
      ),
    getTargetSourcesPage: async (query) =>
      unwrap<z.infer<typeof schemas.PageTargetSourceInfo>>(
        await mockTaskQueue.getTargetSourcesPage(query),
      ),
    getAlertTargetSources: async (query) =>
      unwrap<z.infer<typeof schemas.PageTargetSourceInfo>>(
        await mockTaskQueue.getAlertTargetSources(query),
      ),
    putNlbIndex: async (id, body) =>
      unwrap<z.infer<typeof schemas.ApprovalRequestDetailDto>>(
        await mockTaskQueue.putNlbIndex(id, body),
      ),
    getTestConnectionPage: async (query) =>
      unwrap<z.infer<typeof schemas.PageTestConnectionRejectStatusResponse>>(
        await mockTaskQueue.getTestConnectionPage(query),
      ),
    getTestConnectionStatus: async (id) =>
      unwrap<z.infer<typeof schemas.TestConnectionRejectStatusResponse>>(
        await mockTaskQueue.getTestConnectionStatus(id),
      ),
    rejectTestConnection: async (id, body) =>
      unwrap<z.infer<typeof schemas.TestConnectionRejectResponse>>(
        await mockTaskQueue.rejectTestConnection(id, body),
      ),
    getApprovalHistory: async (query) =>
      unwrap<z.infer<typeof schemas.Page>>(await mockTaskQueue.getApprovalHistory(query)),
    getNlbIndexMappings: async (id) =>
      unwrap<unknown>(await mockTaskQueue.getNlbIndexMappings(id)),
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

    createApprovalRequest: async (id, body) =>
      unwrap<unknown>(await mockConfirm.createApprovalRequest(String(id), body)),

    getConfirmedIntegration: async (id) =>
      // Mock returns the snake wire shape; the route validates with schemas.X.parse().
      unwrap<z.infer<typeof schemas.ConfirmedIntegrationResponse>>(
        await mockConfirm.getConfirmedIntegration(String(id)),
      ),

    // provider 는 upstream 의 path 만 고른다 — 목의 저장소는 대상 하나에 하나뿐이라
    // 여기서는 쓰이지 않는다.
    createConfirmedResources: async (id, _provider, body) =>
      unwrap<unknown>(await mockConfirm.createConfirmedResources(String(id), body)),

    deleteConfirmedResources: async (id) =>
      unwrap<unknown>(await mockConfirm.deleteConfirmedResources(String(id))),

    getApprovedRecommendations: async (id) =>
      unwrap<unknown>(await mockConfirm.getApprovedRecommendations(String(id))),

    getApprovedIntegration: async (id) =>
      unwrap<z.infer<typeof schemas.ApprovedIntegrationResponseDto>>(
        await mockConfirm.getApprovedIntegration(String(id)),
      ),

    getApprovalHistory: async (id, page, size) =>
      unwrap<unknown>(await mockConfirm.getApprovalHistory(String(id), page, size)),

    getApprovalRequestLatest: async (id) =>
      unwrap<unknown>(await mockConfirm.getApprovalRequestLatest(String(id))),

    getApprovalRequestDetail: async (id, requestId) =>
      unwrap<unknown>(await mockConfirm.getApprovalRequestDetail(String(id), requestId)),

    getProcessStatus: async (id) =>
      unwrap<z.infer<typeof schemas.ProcessStatusResponseDto>>(await mockConfirm.getProcessStatus(String(id))),
    getTerraformStatus: async (id) =>
      unwrap<z.infer<typeof schemas.TerraformStatusResponse>>(await mockConfirm.getTerraformStatus(String(id))),

    approveApprovalRequest: async (id, body) =>
      unwrap<unknown>(await mockConfirm.approveApprovalRequest(String(id), body)),

    rejectApprovalRequest: async (id, body) =>
      unwrap<unknown>(await mockConfirm.rejectApprovalRequest(String(id), body)),

    cancelApprovalRequest: async (id) =>
      unwrap<unknown>(await mockConfirm.cancelApprovalRequest(String(id))),

    resetTargetSource: async (id, body) =>
      unwrap<z.infer<typeof schemas.ApprovalActionResponseDto>>(
        await mockConfirm.resetTargetSource(String(id), body),
      ),

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
        await mockConfirm.updateTestConnectionConfirmation(String(id), {
          confirmed: body.confirmed ?? false,
        }),
      ),

    getTestConnectionHistory: async (id, page, size) =>
      unwrap<z.infer<typeof schemas.PageTestConnectionHistoryItemResponse>>(
        await mockConfirm.getTestConnectionHistory(String(id), page, size),
      ),

    getTestConnectionExecutionHistory: async (id, page, size) =>
      unwrap<z.infer<typeof schemas.PageTestConnectionExecutionHistoryResponse>>(
        await mockConfirm.getTestConnectionExecutionHistory(String(id), page, size),
      ),
  },

  guides: {
    get: async (name) => unwrap(await mockGuides.get(name)),
    put: async (name, body) => unwrap(await mockGuides.put(name, body)),
  },
};
