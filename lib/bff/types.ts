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
 * 확정 리소스 쓰기 경로가 존재하는 provider — swagger 는 CSP 마다 별도 path 를 두고
 * (`{aws|gcp|azure|idc}-resources`) 같은 조작을 선언한다. SDU 는 그 path 가 없다.
 */
export type ConfirmedResourceProvider = 'AWS' | 'GCP' | 'AZURE' | 'IDC';
import type { AlertTargetKind } from '@/lib/types/task-queue';
import type {
  AdminPost,
  AdminPostCategory,
  AdminPostSummary,
  ImageUploadResponse,
  Post,
  PostCategory,
  PostCategoryCreateRequest,
  PostCreateRequest,
  PostSummary,
  PostType,
  PostUpdateRequest,
} from '@/lib/types/post';

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
    /**
     * PUT …/description — ASSUMED contract (docs/api/ops-assumed-contracts.md §8).
     * The read side is `TargetSourceDetail.description`; there was no writer, so the
     * 연동 대상 계정 목록 could show a description nobody could correct.
     */
    putDescription: (id: number, description: string) => Promise<TargetSourceDescriptionWire>;
    /**
     * PUT …/support-raw-data/{enabled|disabled} — 본문 없는 두 경로가 한 boolean 을
     * 뒤집는다 (BE 확인, install-v1.yaml 에는 아직 없다 — docs/api/ops-assumed-contracts.md §9).
     * 경계 위에서는 값 하나다: 값을 경로로 인코딩하는 것은 업스트림의 표현이고, 그
     * 변환은 http 층이 진다. 응답 본문은 계약에 없어 아무것도 읽지 않는다.
     */
    setDoesSupportRaw: (id: number, enabled: boolean) => Promise<void>;
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

  /**
   * FAQ & Notices (docs/bff-api/tag-guides/faq-notices.md).
   *
   * CONTRACT GAP: the Tag is Draft and not in docs/swagger/install-v1.yaml, so
   * there is no generated schema to type these with. `lib/types/post.ts` mirrors
   * the tag guide and is swapped for `schemas.*` when the swagger catches up.
   */
  posts: {
    list: (type?: PostType, categoryId?: number) => Promise<PostSummary[]>;
    get: (postId: number) => Promise<Post>;
    listCategories: (type?: PostType) => Promise<PostCategory[]>;
    listAdmin: (type?: PostType, hidden?: boolean) => Promise<AdminPostSummary[]>;
    getAdmin: (postId: number) => Promise<AdminPost>;
    create: (body: PostCreateRequest) => Promise<AdminPost>;
    update: (postId: number, body: PostUpdateRequest) => Promise<AdminPost>;
    setHidden: (postId: number, hidden: boolean) => Promise<AdminPost>;
    setPinned: (postId: number, pinned: boolean) => Promise<AdminPost>;
    uploadImage: (file: { bytes: Uint8Array<ArrayBuffer>; contentType: string })
      => Promise<ImageUploadResponse>;
    listAdminCategories: (type?: PostType) => Promise<AdminPostCategory[]>;
    createCategory: (body: PostCategoryCreateRequest) => Promise<AdminPostCategory>;
    deleteCategory: (categoryId: number) => Promise<void>;
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
    /**
     * 확정 정보 등록 — swagger `create{Csp}ConfirmedResource` (POST …/{csp}-resources, 201).
     * The four CSP paths differ only in that one segment, so the provider picks the path
     * rather than the operation. The request body is declared `type: object` with no
     * properties — OPAQUE by contract, so it rides as `unknown` and nothing reshapes it.
     */
    createConfirmedResources: (
      id: number,
      provider: ConfirmedResourceProvider,
      body: unknown,
      /** AWS only — swagger declares `applyNLBSecurityGroup` (query, default false) on this path. */
      applyNlbSecurityGroup?: boolean,
    ) => Promise<unknown>;
    /** 확정 정보 삭제 — swagger `delete{Csp}ConfirmedResource` (DELETE …/{csp}-resources, 200). */
    deleteConfirmedResources: (id: number, provider: ConfirmedResourceProvider) => Promise<unknown>;
    /**
     * 승인 기반 추천 확정 정보 — swagger `get{Csp}ApprovedRecommendations`
     * (GET …/{csp}-resources/approved-recommendations, 200).
     *
     * The 200 body is declared `type: object` with no properties — OPAQUE, exactly like the
     * POST body on the same path. That POST carries BOTH the `Resource Recommendations` and
     * `Confirmed Resources` tags and names the same noun ("the approved agent configuration"),
     * so the editor opens this response as the draft the POST expects. The contract does not
     * assert the two objects are identical, so nothing reshapes it: it rides as `unknown`.
     */
    getApprovedRecommendations: (
      id: number,
      provider: ConfirmedResourceProvider,
    ) => Promise<unknown>;
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

  /**
   * 서비스 접근 권한 관리 — ASSUMED contracts (docs/api/access-assumed-contracts.md).
   * Same deliberate exception as `ops` above: the 접근 권한 menu group needs these
   * before the BFF ships them. `/admin/access/*` is admin-only; `/access/*` is the
   * requester's own surface (a user with no permission still has to be able to ask).
   */
  access: {
    // 서비스 (관리자 목록 · 권한 사용자)
    listServices: (query: string | undefined, page: number, size: number) => Promise<AdminServicePageWire>;
    listServiceOwners: (serviceCode: string) => Promise<ServiceOwnersWire>;
    addServiceOwners: (serviceCode: string, emails: string[]) => Promise<ServiceOwnersWire>;
    removeServiceOwner: (serviceCode: string, email: string) => Promise<ServiceOwnersWire>;
    // 관리자
    listAdmins: () => Promise<AdminListWire>;
    addAdmin: (email: string) => Promise<AccessUserWire>;
    removeAdmin: (email: string) => Promise<void>;
    // 접근 권한 요청 — 승인/반려는 204 라 화면이 다시 읽는다.
    listRequests: (status: string | undefined, page: number, size: number) => Promise<PermissionRequestPageWire>;
    getRequest: (requestId: number) => Promise<PermissionRequestDetailWire>;
    approveRequest: (requestId: number, message: string) => Promise<void>;
    rejectRequest: (requestId: number, reason: string) => Promise<void>;
    // 이력
    listHistory: (
      query: { serviceCode?: string; type?: string },
      page: number,
      size: number,
    ) => Promise<AccessHistoryPageWire>;
    // 사용자 측 — admin 게이트 밖
    createRequest: (serviceCode: string, reason: string) => Promise<void>;
    listMyRequests: (
      status: string | undefined,
      page: number,
      size: number,
    ) => Promise<MyAccessRequestPageWire>;
    listUserServices: (query: string | undefined, page: number, size: number) => Promise<UserServicePageWire>;
    listServicesPage: (query: string | undefined, page: number, size: number) => Promise<ServicePageWire>;
    searchUsers: (query: string | undefined) => Promise<AccessUserSearchWire>;
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

/** PUT …/description echo (assumed §8) — same shape rule as the sibling above. */
export interface TargetSourceDescriptionWire {
  target_source_id: number;
  description: string;
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
 * 서비스 접근 권한 wire shapes (docs/api/access-assumed-contracts.md).
 *
 * 이 도메인은 오너가 준 백엔드 초안 스펙을 **그대로** 따른다 — 경로·필드명·상태코드
 * 전부. 아직 스펙에 없는 것은 두 개뿐이고 문서에 따로 표시해 두었다.
 * snake_case wire, Spring `Page` 페이지네이션 — install-v1 과 같은 규약.
 */

/**
 * `UserSummary` — 계약에 사람 이름이 없다. `knox_id` 가 화면에 찍는 값이고,
 * `email` 이 모든 쓰기의 식별 키다.
 */
export interface AccessUserWire {
  knox_id: string;
  email: string;
  role: string;
}

/** Spring-Page subset the paged access endpoints return. */
export interface AccessPageWire<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

/** `AdminServiceRow` — 관리자 서비스 목록의 행. 계약이 싣는 전부이고, 레일이 쓰는
 *  건 코드·이름뿐이다(`AdminServiceRow` 는 그 둘만 투영한다). */
export interface AdminServiceRowWire {
  service_code: string;
  service_name: string;
  owner_count: number;
  owners: AccessUserWire[];
  last_modified_at: string | null;
}

export type AdminServicePageWire = AccessPageWire<AdminServiceRowWire>;

/**
 * `ServiceOwnersResponse` — **페이지가 아니다.** 한 서비스의 권한 사용자 전체를 한 번에
 * 준다. 부여/해제도 같은 모양을 돌려주므로 쓰기 뒤 재조회가 필요 없다.
 */
export interface ServiceOwnersWire {
  service_code: string;
  service_name: string;
  owners: AccessUserWire[];
}

/** `AdminListResponse` — 여기도 페이지가 아니다. */
export interface AdminListWire {
  admins: AccessUserWire[];
}

export type AccessRequestStatusWire = 'PENDING' | 'APPROVED' | 'REJECTED';

/**
 * `PermissionRequestRow` — 목록의 행.
 *
 * 계약 갭(B3): `reason` 과 `status` 가 없다. 요청 사유는 상세에만 있어서 두 카드가
 * 사유 미리보기를 못 한다. 세 필드(`reason`·`status`·`processed_at`)가 추가되면
 * 열이 되살아난다 — 그때까지 목록은 사유를 말하지 않는다.
 */
export interface PermissionRequestRowWire {
  request_id: number;
  service_code: string;
  service_name: string;
  requester: AccessUserWire;
  requested_at: string;
}

export type PermissionRequestPageWire = AccessPageWire<PermissionRequestRowWire>;

/** `PermissionRequestDetail` — 사유와 판정이 사는 곳. */
export interface PermissionRequestDetailWire {
  request_id: number;
  service_code: string;
  service_name: string;
  requester: AccessUserWire;
  reason: string;
  status: AccessRequestStatusWire;
  requested_at: string;
  processed_at: string | null;
  processed_by: AccessUserWire | null;
  /** 승인 메시지 또는 반려 사유. */
  processed_note: string | null;
}

/**
 * `GET /user/permission-access` 한 줄 — 관리자 상세와 **다른 shape 이다.**
 *
 * 2026-08-14 실구현이 싣는 것은 이 여섯 필드가 전부다. 요청자(`requester`)가 없는 건
 * 자연스럽다 — 호출자 본인 것만 주므로 적을 이유가 없는 값이다. 처리 결과 셋
 * (`processed_at`·`processed_by`·`processed_note`)이 없는 건 **갭이다(B5)**: 요청자가
 * 자기 반려 사유를 볼 길이 이 화면 말고 없다.
 *
 * 그래서 `PermissionRequestDetailWire` 를 이 목록에 재사용하지 않는다. 재사용하면
 * 오지 않는 필드를 코드가 있는 것처럼 읽고(`requester.knox_id` 에서 실제로 터졌다),
 * 화면은 언제나 비어 있는 열을 그린다.
 */
export interface MyAccessRequestWire {
  request_id: number;
  service_code: string;
  service_name: string;
  status: AccessRequestStatusWire;
  reason: string;
  requested_at: string;
}

export type MyAccessRequestPageWire = AccessPageWire<MyAccessRequestWire>;

/**
 * 이력 이벤트 여섯 종 — 2026-08-14 백엔드 실구현 값이다.
 *
 * 앞 넷은 우리가 `GRANTED`·`REVOKED`·`APPROVED`·`REJECTED` 로 짧게 적어 두었던 것이고,
 * 실제 이름은 **무엇을 통해 움직였는지**를 앞에 달고 있다 — 서비스 담당자 자리를 직접
 * 넣고 뺀 것(`OWNER_*`)인지, 요청을 처리한 결과(`REQUEST_*`)인지.
 */
export type AccessHistoryTypeWire =
  | 'OWNER_GRANTED'
  | 'OWNER_REVOKED'
  | 'REQUEST_APPROVED'
  | 'REQUEST_REJECTED'
  | 'ADMIN_GRANTED'
  | 'ADMIN_REVOKED';

/** `AccessHistoryRow` — 권한이 움직인 기록. 부여 경로는 `type` 으로만 갈린다. */
export interface AccessHistoryRowWire {
  history_id: number;
  type: AccessHistoryTypeWire;
  /** null for admin-role entries — they belong to no service. */
  service_code: string | null;
  service_name: string | null;
  target_user: AccessUserWire;
  actor_user: AccessUserWire;
  note: string | null;
  created_at: string;
}

export type AccessHistoryPageWire = AccessPageWire<AccessHistoryRowWire>;

/**
 * `GET /users/search?q=` — 2026-08-14 실구현. 본문은 오너가 `UserSummary`
 * (knox_id·email·role) 로 확정했다. swagger 의 `UserSearchResponse`(id·name·email)는
 * 그 확정 이전 모양이라 이 인터페이스와 다르다 — 갱신은 오너 몫.
 */
export interface AccessUserSearchWire {
  users: AccessUserWire[];
}

/**
 * `access_status` — `/user/services/page` 가 전체 서비스를 돌려주면서 붙는 필드.
 * 요청 가능한 서비스는 이 값이 NONE 이거나 REJECTED 인 것들이다.
 */
export type ServiceAccessStatusWire = 'OWNED' | 'REQUESTED' | 'REJECTED' | 'NONE';

/**
 * `GET /user/services/page` — **내가 담당인 서비스만** (ADMIN 은 전체).
 *
 * 2026-08-14 오너 스펙 변경: 경로 이름과 뜻이 어긋나지 않도록 이 호출은 담당 서비스로
 * 좁혔고, 전체 목록은 `GET /services/page` 로 갈라졌다. 요청 대상을 고르는 목록은
 * 그쪽이다 — 이쪽은 "내가 접근할 수 있는 서비스".
 */
export interface UserServiceRowWire {
  service_code: string;
  service_name: string;
  access_status: ServiceAccessStatusWire;
  /** infra 카탈로그의 EOS 값. 미지정은 "EOS 아님"이 아니라 "모름"이다. */
  is_eos_service: boolean | null;
}

export type UserServicePageWire = AccessPageWire<UserServiceRowWire>;

/**
 * `GET /services/page` — 전체 서비스 + 내 접근 상태 + 담당자. 신청 대상 선택용.
 *
 * `owners` 는 오너 스펙의 "담당자 표시명"이다 — `UserSummary` 가 아니라 문자열 배열로
 * 읽는다. 사람 이름 필드가 계약 어디에도 없으므로 목은 Knox ID 를 싣는다(화면이 사람을
 * 부르는 이름이 그것이다). **실제 원소 모양은 확인 대기** — UserSummary 로 오면
 * `toServiceRow` 한 곳만 바뀐다.
 */
export interface ServicePageRowWire {
  service_code: string;
  service_name: string;
  /** 약어 — infra 카탈로그가 주던 값을 그대로 흘려보낸다. 없으면 null. */
  service_abbr_name: string | null;
  access_status: ServiceAccessStatusWire;
  is_eos_service: boolean | null;
  owners: string[];
  owner_count: number;
}

export type ServicePageWire = AccessPageWire<ServicePageRowWire>;

/**
 * 서비스 운영은 assumed 계약을 쓰지 않는다 — `/admin/ops/services*` 는 install-v1.yaml
 * 에 없어 실 BFF 에서 전부 404 였다. 라우트가 실계약(`/target-sources/page` +
 * `/process-statuses`)을 조합하므로 이 도메인에는 전용 wire 타입도, 전용 client
 * 메서드도 없다.
 */
