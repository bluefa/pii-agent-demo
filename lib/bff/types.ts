/**
 * BFF data-access interface (ADR-011).
 *
 * Implementations:
 *   - mockBff: wraps the in-memory `lib/api-client/mock/*` handlers
 *   - httpBff: calls the upstream BFF over HTTP
 *
 * Per ADR-011 §"Cross-cutting decisions" #1 (B-1): v1 transforms
 * (`extractTargetSource`, `normalizeUserMeResponse`, etc.) stay in the
 * route layer. BFF methods return the raw upstream wire shape.
 *
 * Casing per ADR-011 README §"Observable Behavior Invariants" I-3:
 *   - GET responses are camelCase (proxyGet runs camelCaseKeys)
 *   - POST/PUT/DELETE responses are raw passthrough (snake_case)
 */
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
  CreateTargetSourceResult,
  ServicesTargetSourcesResponse,
  TargetSourceDetailResponse,
} from '@/lib/bff/types/target-sources';
import type {
  ProjectApprovalResult,
  ProjectCompleteInstallationResult,
  ProjectConfirmCompletionResult,
  ProjectConfirmTargetsResult,
  ProjectCreateResult,
  ProjectCredentialsResponse,
  ProjectGetResponse,
  ProjectHistoryResponse,
  ProjectMutationResult,
  ProjectRejectionResult,
  ProjectResourceCredentialResult,
  ProjectResourceExclusionsResponse,
  ProjectResourcesResponse,
  ProjectScanTriggerResult,
  ProjectTerraformStatusResponse,
  ProjectTestConnectionResult,
} from '@/lib/bff/types/projects';
import type {
  UserMeResponse,
  UserSearchResponse,
  UserServicesPageResponse,
  UserServicesResponse,
} from '@/lib/bff/types/users';
import type {
  ServiceAuthorizedUsersResponse,
  ServicePermissionAddResult,
  ServicePermissionRemoveResult,
  ServiceSettingsAwsResponse,
  ServiceSettingsAwsUpdateResult,
  ServiceSettingsAwsVerifyScanRoleResult,
  ServiceSettingsAzureResponse,
} from '@/lib/bff/types/services';
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

export interface BffClient {
  targetSources: {
    get: (id: number) => Promise<TargetSourceDetailResponse>;
    list: (serviceCode: string) => Promise<ServicesTargetSourcesResponse>;
    create: (body: { serviceCode?: string; [key: string]: unknown }) => Promise<CreateTargetSourceResult>;
  };

  projects: {
    get: (id: number) => Promise<ProjectGetResponse>;
    delete: (id: number) => Promise<ProjectMutationResult>;
    create: (body: unknown) => Promise<ProjectCreateResult>;
    approve: (id: number, body: unknown) => Promise<ProjectApprovalResult>;
    reject: (id: number, body: unknown) => Promise<ProjectRejectionResult>;
    confirmTargets: (id: number, body: unknown) => Promise<ProjectConfirmTargetsResult>;
    completeInstallation: (id: number) => Promise<ProjectCompleteInstallationResult>;
    confirmCompletion: (id: number) => Promise<ProjectConfirmCompletionResult>;
    credentials: (id: number) => Promise<ProjectCredentialsResponse>;
    history: (id: number, query: { type?: string; limit?: string; offset?: string }) => Promise<ProjectHistoryResponse>;
    resourceCredential: (id: number, body: unknown) => Promise<ProjectResourceCredentialResult>;
    resourceExclusions: (id: number) => Promise<ProjectResourceExclusionsResponse>;
    resources: (id: number) => Promise<ProjectResourcesResponse>;
    scan: (id: number) => Promise<ProjectScanTriggerResult>;
    terraformStatus: (id: number) => Promise<ProjectTerraformStatusResponse>;
    testConnection: (id: number, body: unknown) => Promise<ProjectTestConnectionResult>;
  };

  users: {
    search: (query: string, excludeIds: string[]) => Promise<UserSearchResponse>;
    me: () => Promise<UserMeResponse>;
    getServices: () => Promise<UserServicesResponse>;
    getServicesPage: (page: number, size: number, query?: string) => Promise<UserServicesPageResponse>;
  };

  services: {
    permissions: {
      list: (serviceCode: string) => Promise<ServiceAuthorizedUsersResponse>;
      add: (serviceCode: string, body: unknown) => Promise<ServicePermissionAddResult>;
      remove: (serviceCode: string, userId: string) => Promise<ServicePermissionRemoveResult>;
    };
    settings: {
      aws: {
        get: (serviceCode: string) => Promise<ServiceSettingsAwsResponse>;
        update: (serviceCode: string, body: unknown) => Promise<ServiceSettingsAwsUpdateResult>;
        verifyScanRole: (serviceCode: string) => Promise<ServiceSettingsAwsVerifyScanRoleResult>;
      };
      azure: {
        get: (serviceCode: string) => Promise<ServiceSettingsAzureResponse>;
      };
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
