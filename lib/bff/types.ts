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
import type { AlertTargetKind } from '@/lib/types/task-queue';

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
  /** #5a GET …/tasks/{taskId}/attempts/{attemptNumber}/jobs/{jobId}/result */
  jobResult: (
    pipelineId: string,
    taskId: string,
    attemptNumber: string,
    jobId: string,
  ) => Promise<OrchestratorRawResponse>;
  /** #5b GET …/tasks/{taskId}/attempts/{attemptNumber}/jobs/{jobId}/state */
  jobState: (
    pipelineId: string,
    taskId: string,
    attemptNumber: string,
    jobId: string,
  ) => Promise<OrchestratorRawResponse>;
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
  /** #13 GET …/pipelines/{pipelineId}/restart-preview?from_sequence= */
  restartPreview: (
    targetSourceId: string,
    pipelineId: string,
    fromSequence: string | undefined,
  ) => Promise<OrchestratorRawResponse>;
  /** #14 POST …/pipelines/{pipelineId}/restart */
  restart: (targetSourceId: string, pipelineId: string, body: unknown) => Promise<OrchestratorRawResponse>;
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
    // GET …/jira-ticket — camel wire (JiraTicketResponse); upstream 404 = no ticket mapped.
    getJiraTicket: (id: number) => Promise<z.infer<typeof schemas.JiraTicketResponse>>;
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
    /**
     * Jira Tickets tag — CAMEL wire (JiraTicketResponse), keyed by cloudProvider.
     * `detach` removes the service↔ticket MAPPING only; the Jira issue itself is
     * untouched (docs/api/jira-tickets.md §1).
     */
    jiraTickets: {
      list: (serviceCode: string) => Promise<z.infer<typeof schemas.JiraTicketResponse>[]>;
      attach: (
        serviceCode: string,
        cloudProvider: string,
        issueKey: string,
        /** JiraTicketAttachRequest.validate (optional) — undefined = upstream default. */
        validate?: boolean,
      ) => Promise<void>;
      detach: (
        serviceCode: string,
        cloudProvider: string,
      ) => Promise<z.infer<typeof schemas.JiraTicketDetachResponse>>;
      /** POST …/watchers (JiraTicketWatcherRequest { userId }) → 204 — Jira 티켓 watcher 등록. */
      addWatcher: (serviceCode: string, cloudProvider: string, userId: string) => Promise<void>;
    };
  };

  scan: {
    // swagger: GET/POST routes validate with schemas.X.parse(raw); methods return raw snake wire.
    get: (id: number, scanId: string) => Promise<z.infer<typeof schemas.ScanJobResponse>>;
    // swagger declares `page` (0-based) + `size`; a Spring Pageable binds those names
    // and ignores anything else, so limit/offset would pin every request to page 0.
    getHistory: (id: number, query: { page: number; size: number }) => Promise<z.infer<typeof schemas.PageScanJobResponse>>;
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
    /**
     * GET …/ec2-resources/search?query=&limit= — EC2 instances the latest scan found,
     * matched on an instance-id prefix. Items are CloudResourceResponse-shaped.
     *
     * CONTRACT GAP: owner-provided controller, not yet in docs/swagger/install-v1.yaml,
     * so there is no generated schema to type it with. The route owns a local zod schema
     * until the swagger catches up; this method returns the raw snake wire.
     */
    searchEc2Resources: (id: number, query: string, limit: number) => Promise<unknown>;
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

  /**
   * Admin Task Queue (operator monitor + approval/test-connection queues).
   * Only the endpoints NOT already covered by other groups live here; the
   * feature reuses `idc.getNlbTable`, `logicalDb.*`, and `confirm.*` (approval
   * latest/approve/reject, confirmInstallation). Methods return the raw wire
   * shape; the admin/queue routes own the wire→camel boundary (ADR-019,
   * lib/types/task-queue.ts).
   */
  taskQueue: {
    getDashboardSummary: () => Promise<z.infer<typeof schemas.DashboardSummaryResponse>>;
    getProcessStatuses: (query: {
      processStatus?: string;
      targetSourceId?: number;
      page: number;
      size: number;
    }) => Promise<z.infer<typeof schemas.PageProcessStatusCurrentResponse>>;
    getTargetSourcesPage: (query: {
      confirmStatus?: string;
      targetSourceId?: number;
      serviceCode?: string;
      page: number;
      size: number;
    }) => Promise<z.infer<typeof schemas.PageTargetSourceInfo>>;
    // GET /dashboard/target-sources/{kind} — 운영 알림 drill-down. Four sibling
    // endpoints, one per kind; the slug is the path segment.
    getAlertTargetSources: (query: {
      kind: AlertTargetKind;
      page: number;
      size: number;
    }) => Promise<z.infer<typeof schemas.PageTargetSourceInfo>>;
    // PUT …/approval-requests/nlb-indices — single { resource_id, nlb_index };
    // returns the updated approval-request detail (contract).
    putNlbIndex: (
      id: number,
      body: z.infer<typeof schemas.NlbIndexAssignmentDto>,
    ) => Promise<z.infer<typeof schemas.ApprovalRequestDetailDto>>;
    getTestConnectionPage: (query: {
      status: string;
      page: number;
      size: number;
    }) => Promise<z.infer<typeof schemas.PageTestConnectionRejectStatusResponse>>;
    getTestConnectionStatus: (
      id: number,
    ) => Promise<z.infer<typeof schemas.TestConnectionRejectStatusResponse>>;
    rejectTestConnection: (
      id: number,
      body: z.infer<typeof schemas.TestConnectionRejectRequest>,
    ) => Promise<z.infer<typeof schemas.TestConnectionRejectResponse>>;
    // GET /approval-history — global history; 200 is the generic Page (item
    // shape is a documented contract gap, lib/types/task-queue.ts).
    getApprovalHistory: (query: {
      toStatuses?: string[];
      page: number;
      size: number;
    }) => Promise<z.infer<typeof schemas.Page>>;
    // GET …/approval-requests/latest/nlb-index-mappings — NOT in install-v1.yaml
    // (user-provided wire, 2026-07-21): [{ resource_id, nlb_index_mapping_list:
    // [{ service_code, nlb_index }] }]. Raw passthrough; the CSR adapter owns
    // the camel boundary.
    getNlbIndexMappings: (id: number) => Promise<unknown>;
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
    getApprovalRequestDetail: (id: number, requestId: number) => Promise<unknown>;
    getProcessStatus: (id: number) => Promise<z.infer<typeof schemas.ProcessStatusResponseDto>>;
    getTerraformStatus: (id: number) => Promise<z.infer<typeof schemas.TerraformStatusResponse>>;
    approveApprovalRequest: (id: number, body: unknown) => Promise<unknown>;
    rejectApprovalRequest: (id: number, body: unknown) => Promise<unknown>;
    cancelApprovalRequest: (id: number) => Promise<unknown>;
    /** 연동 승인 상태를 IDLE 로 강제 초기화 (Step 7 인프라 변경 → 1단계). */
    resetTargetSource: (
      id: number,
      body: z.infer<typeof schemas.TargetSourceResetRequestDto>,
    ) => Promise<z.infer<typeof schemas.ApprovalActionResponseDto>>;
    markApprovalRequestUnavailable: (id: number, body: unknown) => Promise<unknown>;
    confirmApprovalUnavailable: (id: number) => Promise<unknown>;
    confirmInstallation: (id: number) => Promise<unknown>;
    updateResourceCredential: (id: number, body: unknown) => Promise<unknown>;
    testConnection: (id: number, collectorImageTag?: string) => Promise<z.infer<typeof schemas.TestConnectionTriggerResponse>>;
    getTestConnectionLatest: (id: number) => Promise<z.infer<typeof schemas.TestConnectionVersionResult>>;
    getLatestTestConnectionResultSummaries: (id: number) => Promise<z.infer<typeof schemas.TestConnectionLatestResultSummaryResponse>[]>;
    getTestConnectionCompletionStatus: (id: number) => Promise<z.infer<typeof schemas.TestConnectionCompletionStatusResponse>>;
    updateTestConnectionConfirmation: (
      id: number,
      body: z.infer<typeof schemas.UpdateTestConnectionConfirmationRequest>,
    ) => Promise<z.infer<typeof schemas.TestConnectionConfirmationResponse>>;
    getTestConnectionHistory: (
      id: number,
      page: number,
      size: number,
    ) => Promise<z.infer<typeof schemas.PageTestConnectionHistoryItemResponse>>;
    getTestConnectionExecutionHistory: (
      id: number,
      page: number,
      size: number,
    ) => Promise<z.infer<typeof schemas.PageTestConnectionExecutionHistoryResponse>>;
  };

  /**
   * Ops console — ASSUMED contracts (docs/api/ops-assumed-contracts.md).
   * Deliberate exception to the "swagger is the sole authority" rule above
   * (owner decision 2026-07-26): the Target Source ops page needs these
   * capabilities before the BFF ships them. httpBff targets the assumed paths;
   * delete the doc section when the real endpoint lands in install-v1.yaml.
   * `putRole` graduated to the REAL contract (install-v1 aws scan-role /
   * terraform-execution-role upsert, camel wire both ways).
   */
  ops: {
    getStatusHistory: (id: number, page: number, size: number) => Promise<OpsStatusHistoryPageWire>;
    putInstallationMode: (id: number, grant: boolean) => Promise<OpsInstallationModeWire>;
    putRole: (
      id: number,
      kind: 'scan' | 'execution',
      roleArn: string,
    ) => Promise<z.infer<typeof schemas.AwsAssumeRoleUpsertResponse>>;
    getTargetSourceList: (query: string | undefined, page: number, size: number) => Promise<OpsTargetSourceListPageWire>;
  };
}

/** Ops console assumed-contract wire shapes (docs/api/ops-assumed-contracts.md). */
export type OpsProcessStatusWire =
  | 'IDLE' | 'PENDING' | 'CONFIRMING' | 'CONFIRMED' | 'INSTALLED' | 'CONNECTED' | 'COMPLETED';

export interface OpsStatusHistoryItemWire {
  changed_at: string;
  from_status: OpsProcessStatusWire | null;
  to_status: OpsProcessStatusWire;
  actor: string;
}

/** Spring-Page subset the assumed status-history endpoint returns. */
export interface OpsStatusHistoryPageWire {
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  content: OpsStatusHistoryItemWire[];
}

export interface OpsInstallationModeWire {
  target_source_id: number;
  grant_service_terraform_execution_permission: boolean;
}

/**
 * CSP 계정 식별자 (assumed §5). Provider 마다 채워지는 필드가 다르고, IDC·SDU 는
 * CSP 계정 자체가 없어 전 필드 null 이 정상 — 목록은 그때 아무것도 그리지 않는다.
 */
export interface OpsTargetSourceAccountWire {
  aws_account_id: string | null;
  aws_region_type: 'global' | 'china' | null;
  subscription_id: string | null;
  gcp_project_id: string | null;
}

/** Ops console list row (assumed §5) — powers the Target Source 운영 목록. */
export interface OpsTargetSourceListItemWire {
  target_source_id: number;
  service_code: string;
  service_name: string;
  /** TargetSourceInfo.description (install-v1) — 대상이 무엇인지 오너가 적은 한 줄. */
  description: string | null;
  cloud_provider: string;
  is_sdu_type: boolean;
  database_type: string | null;
  process_status: OpsProcessStatusWire;
  last_changed_at: string;
  metadata: OpsTargetSourceAccountWire;
}

export interface OpsTargetSourceListPageWire {
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  content: OpsTargetSourceListItemWire[];
}

/**
 * 서비스 운영은 assumed 계약을 쓰지 않는다 — `/admin/ops/services*` 는 install-v1.yaml
 * 에 없어 실 BFF 에서 전부 404 였다. 라우트가 실계약(`/target-sources/page` +
 * `/process-statuses`)을 조합하므로 이 도메인에는 전용 wire 타입도, 전용 client
 * 메서드도 없다.
 */
