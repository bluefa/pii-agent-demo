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
 * legacy /projects/* and /aws/projects/*.
 *
 * Casing (ADR-019 D1/D2 revised, zod-codegen amendment):
 *   - Most GET responses are camelCased once at the proxy (`get` runs camelCaseKeys).
 *   - TC domain: BFF methods return the raw snake wire; the route validates with
 *     schemas.X.parse(raw) and the snake type flows to the CSR layer.
 */
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
  TargetSourceCreationCandidateResponseWire,
  TargetSourceDetailResponse,
  TargetSourceInfoWire,
  TargetSourcesByServiceResponseWire,
} from '@/lib/bff/types/target-sources';
import type { z } from 'zod';
import type { schemas } from '@/lib/generated/install-v1';
import type {
  SkipLogicalDatabaseResponseWire,
  TestedLogicalDatabasesResponseWire,
  UpdateSkipLogicalDatabaseRequestWire,
} from '@/lib/bff/types/logical-db';
import type {
  PageServiceItem,
  UserMeResponse,
  UserSearchResponse,
} from '@/lib/bff/types/users';
import type { ServiceAuthorizedUsersResponse } from '@/lib/bff/types/services';
import type {
  DashboardSummaryResponse,
  DashboardSystemsResponse,
} from '@/lib/bff/types/dashboard';
import type {
  DevGetUsersResponse,
  DevSwitchUserResult,
} from '@/lib/bff/types/dev';
import type {
  ScanCreateResult,
  ScanGetResponse,
  ScanHistoryPageResponse,
  ScanLatestStatusResponse,
} from '@/lib/bff/types/scan';
import type { TaskAdminApprovalRequestsResponse } from '@/lib/bff/types/task-admin';
import type { QueueBoardQueryParams } from '@/lib/types/queue-board';
import type {
  ApprovalRequestCreateBody,
  BffConfirmedIntegration,
  ResourceCatalogResponse,
} from '@/lib/bff/types/confirm';
import type { GuideGetResponse, GuidePutResult } from '@/lib/bff/types/guides';
import type {
  IdcInstallationStatusResponseWire,
  IdcPreviousRequestResponseWire,
  NlbOccupiedResourceResponseWire,
  NlbTableResponseWire,
} from '@/lib/bff/types/idc';

export interface BffClient {
  targetSources: {
    get: (id: number) => Promise<TargetSourceDetailResponse>;
    // Wire snake (37) — the route handler owns the casing boundary.
    list: (serviceCode: string) => Promise<TargetSourcesByServiceResponseWire>;
    // 201 TargetSourceInfo (36) — candidate posted back verbatim.
    create: (serviceCode: string, candidate: unknown) => Promise<TargetSourceInfoWire>;
    // 200 bare array of creation candidates (35).
    getCreationCandidates: (
      serviceCode: string,
      body: unknown,
    ) => Promise<TargetSourceCreationCandidateResponseWire[]>;
    getSecrets: (id: number) => Promise<unknown>;
  };

  users: {
    search: (query: string, excludeIds: string[]) => Promise<UserSearchResponse>;
    me: () => Promise<UserMeResponse>;
    getServicesPage: (page: number, size: number, query?: string) => Promise<PageServiceItem>;
  };

  services: {
    permissions: {
      list: (serviceCode: string) => Promise<ServiceAuthorizedUsersResponse>;
    };
  };

  dashboard: {
    summary: () => Promise<DashboardSummaryResponse>;
    systems: (params: URLSearchParams) => Promise<DashboardSystemsResponse>;
    systemsExport: (params: URLSearchParams) => Promise<Response>;
  };

  dev: {
    getUsers: () => Promise<DevGetUsersResponse>;
    switchUser: (body: unknown) => Promise<DevSwitchUserResult>;
  };

  scan: {
    get: (id: number, scanId: string) => Promise<ScanGetResponse>;
    getHistory: (id: number, query: { limit: number; offset: number }) => Promise<ScanHistoryPageResponse>;
    create: (id: number, body: unknown) => Promise<ScanCreateResult>;
    getStatus: (id: number) => Promise<ScanLatestStatusResponse>;
  };

  taskAdmin: {
    getApprovalRequestQueue: (params: QueueBoardQueryParams) => Promise<TaskAdminApprovalRequestsResponse>;
  };

  guides: {
    get: (name: string) => Promise<GuideGetResponse>;
    put: (name: string, body: unknown) => Promise<GuidePutResult>;
  };

  aws: {
    getInstallationStatus: (id: number) => Promise<AwsInstallationStatusResponse>;
    // swagger: GET …/aws/terraform-script/download → application/octet-stream
    // (binary zip). Returns the raw Response; the route streams the body (D6 getRaw).
    getTerraformScript: (id: number) => Promise<Response>;
    verifyScanRole: (id: number) => Promise<AwsRoleVerificationResponse>;
    verifyExecutionRole: (id: number) => Promise<AwsRoleVerificationResponse>;
  };

  azure: {
    getInstallationStatus: (id: number) => Promise<AzureInstallationStatusResponse>;
    getSubnetGuide: (id: number) => Promise<AzureSubnetGuideResponse>;
    getScanApp: (id: number) => Promise<AzureScanAppResponse>;
    // G8 — swagger getAzurePrivateLinkHealthCheck (/infra/ infix; wire camel).
    getPrivateLinkHealthCheck: (id: number) => Promise<AzureHealthCheckResult>;
  };

  gcp: {
    getInstallationStatus: (id: number) => Promise<GcpInstallationStatusResponse>;
    getScanServiceAccount: (id: number) => Promise<GcpScanServiceAccountResponse>;
    getTerraformServiceAccount: (id: number) => Promise<GcpTerraformServiceAccountResponse>;
  };

  idc: {
    getInstallationStatus: (id: number) => Promise<IdcInstallationStatusResponseWire>;
    getPreviousRequest: (id: number) => Promise<IdcPreviousRequestResponseWire>;
    getOccupiedResources: (nlbIndex: number) => Promise<NlbOccupiedResourceResponseWire[]>;
    getNlbTable: () => Promise<NlbTableResponseWire[]>;
  };

  logicalDb: {
    getTestedByResourceId: (
      id: number,
      resourceId: string,
    ) => Promise<TestedLogicalDatabasesResponseWire>;
    getExcludedByResourceId: (
      id: number,
      resourceId: string,
    ) => Promise<SkipLogicalDatabaseResponseWire>;
    updateExcludedByResourceId: (
      id: number,
      resourceId: string,
      body: UpdateSkipLogicalDatabaseRequestWire,
    ) => Promise<SkipLogicalDatabaseResponseWire>;
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
