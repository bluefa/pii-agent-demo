/**
 * BFF data-access interface (ADR-011 + ADR-019 /install/v1 migration).
 *
 * Implementations:
 *   - mockBff: wraps the in-memory `lib/bff/mock/*` handlers
 *   - httpBff: calls the upstream BFF over HTTP
 *
 * ADR-019 governing rule: `docs/swagger/install-v1.yaml` is the sole authority.
 * Methods that called endpoints absent from the swagger were REMOVED (no stubs):
 * idc resources, {aws,gcp,azure,idc}/check-installation, installation-mode,
 * approval system-reset, services settings/aws/*, authorized-users add/remove,
 * legacy /projects/* and /aws/projects/*; dashboard, dev, taskAdmin (not in
 * install-v1.yaml).
 *
 * Casing (ADR-019 D1/D2 revised, zod-codegen amendment):
 *   - AWS, AZURE, GCP: BFF methods return the raw snake wire; the route validates
 *     with schemas.X.parse(raw); CSR adapters own any snake→camel reshape.
 *   - TC domain: same pattern.
 */
import type { z } from 'zod';
import type { schemas } from '@/lib/generated/install-v1';
import type { OrchestratorRawResponse } from '@/lib/pipeline/types';

/**
 * pipeline-orchestrator proxy domain (LIN-25).
 *
 * CONTRACT DEVIATION FROM THE REST OF BffClient: these methods DO NOT throw on
 * non-2xx. They return the upstream `{ status, body }` VERBATIM (204 →
 * `{ status: 204, body: null }`) so the route wrapper (`withOrchestratorProxy`)
 * can pass the upstream status + snake_case body straight to the browser. Only
 * an unreachable upstream throws (`OrchestratorUnreachableError`). See
 * docs/api/pipeline-orchestrator-bff.md.
 *
 * Query strings pass through raw (repeatable `sort` order/duplicates preserved).
 */
export interface PipelineBffClient {
  /** #1 GET /api/v1/pipelines/statistics/live */
  liveStatistics: () => Promise<OrchestratorRawResponse>;
  /** #2 GET /api/v1/pipelines/statistics?period= */
  statistics: (period: string | undefined) => Promise<OrchestratorRawResponse>;
  /** #3 GET /api/v1/pipelines?<query> — pass the raw search string. */
  list: (query: string) => Promise<OrchestratorRawResponse>;
  /** #4 GET /api/v1/pipelines/{pipelineId} */
  detail: (pipelineId: string) => Promise<OrchestratorRawResponse>;
  /** #5 GET /api/v1/pipelines/{pipelineId}/tasks/{taskId} */
  taskDetail: (pipelineId: string, taskId: string) => Promise<OrchestratorRawResponse>;
  /** #6 POST /api/v1/pipelines/{pipelineId}/cancel */
  cancel: (pipelineId: string) => Promise<OrchestratorRawResponse>;
  /** #7 GET /api/v1/target-sources/{targetSourceId}/pipelines?<query> */
  listByTarget: (targetSourceId: string, query: string) => Promise<OrchestratorRawResponse>;
  /** #8 GET /api/v1/target-sources/{targetSourceId}/pipelines/latest (204 when empty) */
  latestByTarget: (targetSourceId: string) => Promise<OrchestratorRawResponse>;
  /** #9 GET /api/v1/target-sources/{targetSourceId}/pipelines/preview?type= */
  preview: (targetSourceId: string, type: string | undefined) => Promise<OrchestratorRawResponse>;
  /** #10 POST /api/v1/target-sources/{targetSourceId}/pipelines */
  create: (targetSourceId: string, body: unknown) => Promise<OrchestratorRawResponse>;
  /** #11 POST /api/v1/target-sources/{targetSourceId}/pipelines/custom */
  createCustom: (targetSourceId: string, body: unknown) => Promise<OrchestratorRawResponse>;
  /** #12 GET /api/v1/task-definitions?provider= */
  taskDefinitions: (provider: string | undefined) => Promise<OrchestratorRawResponse>;
}

export interface BffClient {
  pipeline: PipelineBffClient;

  targetSources: {
    get: (id: number) => Promise<z.infer<typeof schemas.TargetSourceDetail>>;
    // Wire snake (37) — the route handler owns the casing boundary.
    list: (serviceCode: string) => Promise<z.infer<typeof schemas.TargetSourceDetail>[]>;
    // 201 TargetSourceInfo (36) — candidate posted back verbatim.
    create: (serviceCode: string, candidate: unknown) => Promise<z.infer<typeof schemas.TargetSourceInfo>>;
    // 200 bare array of creation candidates (35).
    getCreationCandidates: (
      serviceCode: string,
      body: unknown,
    ) => Promise<z.infer<typeof schemas.TargetSourceCreationCandidateResponse>[]>;
    getSecrets: (id: number) => Promise<z.infer<typeof schemas.SecretResponse>[]>;
  };

  users: {
    search: (query: string, excludeIds: string[]) => Promise<z.infer<typeof schemas.UserSearchResponse>>;
    me: () => Promise<z.infer<typeof schemas.UserMeResponse>>;
    getServicesPage: (page: number, size: number, query?: string) => Promise<z.infer<typeof schemas.PageServiceItem>>;
  };

  services: {
    permissions: {
      list: (serviceCode: string) => Promise<z.infer<typeof schemas.AuthorizedUsersResponse>>;
    };
  };

  scan: {
    // swagger: GET/POST routes validate with schemas.X.parse(raw); methods return raw snake wire.
    get: (id: number, scanId: string) => Promise<z.infer<typeof schemas.ScanJobResponse>>;
    getHistory: (id: number, query: { limit: number; offset: number }) => Promise<z.infer<typeof schemas.PageScanJobResponse>>;
    create: (id: number, body: unknown) => Promise<z.infer<typeof schemas.ScanJobResponse>>;
    getStatus: (id: number) => Promise<z.infer<typeof schemas.ScanJobResponse>>;
  };

  guides: {
    get: (name: string) => Promise<z.infer<typeof schemas.GuideDetail>>;
    put: (name: string, body: unknown) => Promise<z.infer<typeof schemas.GuideDetail>>;
  };

  aws: {
    getInstallationStatus: (id: number) => Promise<z.infer<typeof schemas.AwsInstallationStatusResponse>>;
    // swagger: GET …/aws/terraform-script/download → application/octet-stream
    // (binary zip). Returns the raw Response; the route streams the body (D6 getRaw).
    getTerraformScript: (id: number) => Promise<Response>;
    verifyScanRole: (id: number) => Promise<z.infer<typeof schemas.AwsRoleVerificationResponse>>;
    verifyExecutionRole: (id: number) => Promise<z.infer<typeof schemas.AwsRoleVerificationResponse>>;
  };

  azure: {
    getInstallationStatus: (id: number) => Promise<z.infer<typeof schemas.AzureInstallationStatusResponse>>;
    getScanApp: (id: number) => Promise<z.infer<typeof schemas.AzureServicePrincipalVerificationResponse>>;
    // G8 — swagger getAzurePrivateLinkHealthCheck (/infra/ infix; wire camelCase).
    getPrivateLinkHealthCheck: (id: number) => Promise<z.infer<typeof schemas.AzureHealthCheckResult>>;
  };

  gcp: {
    getInstallationStatus: (id: number) => Promise<z.infer<typeof schemas.GcpInstallationStatusResponse>>;
    getScanServiceAccount: (id: number) => Promise<z.infer<typeof schemas.GcpServiceAccountInfoResponse>>;
    getTerraformServiceAccount: (id: number) => Promise<z.infer<typeof schemas.GcpServiceAccountInfoResponse>>;
  };

  idc: {
    getInstallationStatus: (id: number) => Promise<z.infer<typeof schemas.IdcInstallationStatusResponse>>;
    getPreviousRequest: (id: number) => Promise<z.infer<typeof schemas.IdcPreviousRequestResponse>>;
    getOccupiedResources: (nlbIndex: number) => Promise<z.infer<typeof schemas.NlbOccupiedResourceResponse>[]>;
    getNlbTable: () => Promise<z.infer<typeof schemas.NlbTableResponse>[]>;
  };

  logicalDb: {
    getTestedByResourceId: (
      id: number,
      resourceId: string,
    ) => Promise<z.infer<typeof schemas.TestedLogicalDatabasesResponse>>;
    getExcludedByResourceId: (
      id: number,
      resourceId: string,
    ) => Promise<z.infer<typeof schemas.SkipLogicalDatabaseResponse>>;
    updateExcludedByResourceId: (
      id: number,
      resourceId: string,
      body: z.infer<typeof schemas.UpdateSkipLogicalDatabaseRequest>,
    ) => Promise<z.infer<typeof schemas.SkipLogicalDatabaseResponse>>;
  };

  confirm: {
    getResources: (id: number) => Promise<z.infer<typeof schemas.CloudResourceResponse>>;
    createApprovalRequest: (id: number, body: z.infer<typeof schemas.ApprovalRequestInputDto>) => Promise<unknown>;
    getConfirmedIntegration: (id: number) => Promise<z.infer<typeof schemas.ConfirmedIntegrationResponse>>;
    getApprovedIntegration: (id: number) => Promise<z.infer<typeof schemas.ApprovedIntegrationResponseDto>>;
    getApprovalHistory: (id: number, page: number, size: number) => Promise<unknown>;
    getApprovalRequestLatest: (id: number) => Promise<unknown>;
    getProcessStatus: (id: number) => Promise<z.infer<typeof schemas.ProcessStatusResponseDto>>;
    approveApprovalRequest: (id: number, body: unknown) => Promise<unknown>;
    rejectApprovalRequest: (id: number, body: unknown) => Promise<unknown>;
    cancelApprovalRequest: (id: number) => Promise<unknown>;
    markApprovalRequestUnavailable: (id: number, body: unknown) => Promise<unknown>;
    confirmApprovalUnavailable: (id: number) => Promise<unknown>;
    confirmInstallation: (id: number, body: unknown) => Promise<unknown>;
    updateResourceCredential: (id: number, body: unknown) => Promise<unknown>;
    testConnection: (id: number, collectorImageTag?: string) => Promise<z.infer<typeof schemas.TestConnectionTriggerResponse>>;
    getTestConnectionLatest: (id: number) => Promise<z.infer<typeof schemas.TestConnectionVersionResult>>;
    getLatestTestConnectionResultSummaries: (id: number) => Promise<z.infer<typeof schemas.TestConnectionLatestResultSummaryResponse>[]>;
    getTestConnectionCompletionStatus: (id: number) => Promise<z.infer<typeof schemas.TestConnectionCompletionStatusResponse>>;
    updateTestConnectionConfirmation: (
      id: number,
      body: z.infer<typeof schemas.UpdateTestConnectionConfirmationRequest>,
    ) => Promise<z.infer<typeof schemas.TestConnectionConfirmationResponse>>;
  };
}
