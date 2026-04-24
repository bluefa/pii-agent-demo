import {
  ServiceCode,
  ProjectSummary,
  User,
  CloudProvider,
  TargetSource,
  ProcessStatus,
  DatabaseType,
  IntegrationCategory,
  ConfirmedIntegrationResourceInfo,
  BffConfirmedIntegration,
  ConfirmResourceMetadata,
  EndpointConfigInputData,
  ResourceSnapshot,
  normalizeCloudProvider,
} from '@/lib/types';
import type { SecretKey } from '@/lib/types';
import { fetchInfraCamelJson, fetchInfraJson } from '@/app/lib/api/infra';
import {
  extractTargetSource,
  normalizeTargetSourceProcessStatus,
  type TargetSourceDetailResponse,
} from '@/lib/target-source-response';
import { extractConfirmedIntegration, type ConfirmedIntegrationResponsePayload } from '@/lib/confirmed-integration-response';
import {
  normalizeIssue222ApprovalActionResponse,
  normalizeIssue222ApprovalHistoryPage,
  normalizeIssue222ApprovalRequestBody,
  normalizeIssue222ApprovalRequestSummary,
  normalizeIssue222ApprovedIntegration,
  normalizeIssue222ProcessStatusResponse,
  type Issue222ApprovalStatus,
  type Issue222ResourceConfigDto,
} from '@/lib/issue-222-approval';


export interface CurrentUser {
  id: string;
  name: string;
  email: string;
}

export const getCurrentUser = (): Promise<CurrentUser> =>
  fetchInfraCamelJson<CurrentUser>('/user/me');

export const getServices = async (): Promise<ServiceCode[]> => {
  const data = await fetchInfraCamelJson<{
    services: Array<{ serviceCode: string; serviceName: string }>;
  }>('/user/services');
  return data.services.map((service) => ({
    code: service.serviceCode,
    name: service.serviceName,
  }));
};

export interface ServicePageResponse {
  content: ServiceCode[];
  page: { totalElements: number; totalPages: number; number: number; size: number };
}

export const getServicesPage = async (
  page = 0,
  size = 10,
  query?: string,
): Promise<ServicePageResponse> => {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (query) params.set('query', query);
  const data = await fetchInfraCamelJson<{
    content: Array<{ serviceCode: string; serviceName: string }>;
    page: { totalElements: number; totalPages: number; number: number; size: number };
  }>(`/user/services/page?${params}`);
  return {
    content: data.content.map((s) => ({ code: s.serviceCode, name: s.serviceName })),
    page: data.page,
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const parseTargetSourceId = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value);
  return null;
};

const toIssue222CloudProvider = (cloudProvider: CloudProvider): 'AWS' | 'GCP' | 'AZURE' => {
  switch (cloudProvider) {
    case 'Azure':
      return 'AZURE';
    default:
      return cloudProvider;
  }
};

const toProjectSummary = (value: unknown): ProjectSummary | null => {
  if (!isRecord(value)) return null;

  const targetSourceId = parseTargetSourceId(value.targetSourceId ?? value.id);
  if (targetSourceId === null) return null;

  const processStatus = normalizeTargetSourceProcessStatus(value.processStatus);
  const fallbackCode = `TS-${targetSourceId}`;

  return {
    id: typeof value.id === 'string' && value.id ? value.id : fallbackCode,
    targetSourceId,
    projectCode: typeof value.projectCode === 'string' && value.projectCode ? value.projectCode : fallbackCode,
    processStatus,
    cloudProvider: normalizeCloudProvider(value.cloudProvider),
    resourceCount: typeof value.resourceCount === 'number' ? value.resourceCount : 0,
    hasDisconnected: typeof value.hasDisconnected === 'boolean' ? value.hasDisconnected : false,
    hasNew: typeof value.hasNew === 'boolean' ? value.hasNew : false,
    description: typeof value.description === 'string' ? value.description : '',
    isRejected: typeof value.isRejected === 'boolean' ? value.isRejected : false,
    rejectionReason: typeof value.rejectionReason === 'string' ? value.rejectionReason : undefined,
    connectionTestComplete: typeof value.connectionTestComplete === 'boolean'
      ? value.connectionTestComplete
      : processStatus >= ProcessStatus.CONNECTION_VERIFIED,
  };
};

export const getProjects = async (serviceCode: string): Promise<ProjectSummary[]> => {
  const payload = await fetchInfraCamelJson<unknown>(`/services/${serviceCode}/target-sources`);
  const targetSources = Array.isArray(payload)
    ? payload
    : isRecord(payload) && Array.isArray(payload.targetSources)
      ? payload.targetSources
      : [];

  return targetSources
    .map(toProjectSummary)
    .filter((project): project is ProjectSummary => project !== null);
};

export const createProject = async (payload: {
  serviceCode: string;
  cloudProvider: CloudProvider;
  description?: string;
  awsAccountId?: string;
  awsRegionType?: 'global' | 'china';
  tenantId?: string;
  subscriptionId?: string;
  gcpProjectId?: string;
}): Promise<void> => {
  const body = {
    ...(payload.description?.trim() ? { description: payload.description.trim() } : {}),
    cloudProvider: toIssue222CloudProvider(payload.cloudProvider),
    ...(payload.awsAccountId ? { awsAccountId: payload.awsAccountId } : {}),
    ...(payload.awsRegionType ? { awsRegionType: payload.awsRegionType } : {}),
    ...(payload.tenantId ? { tenantId: payload.tenantId } : {}),
    ...(payload.subscriptionId ? { subscriptionId: payload.subscriptionId } : {}),
    ...(payload.gcpProjectId ? { gcpProjectId: payload.gcpProjectId } : {}),
  };

  await fetchInfraJson(`/services/${payload.serviceCode}/target-sources`, {
    method: 'POST',
    body,
  });
};

export const getPermissions = async (serviceCode: string): Promise<User[]> => {
  const data = await fetchInfraCamelJson<{ users: User[] }>(
    `/services/${serviceCode}/authorized-users`,
  );
  return data.users;
};

export const addPermission = async (serviceCode: string, userId: string): Promise<void> => {
  await fetchInfraJson(`/services/${serviceCode}/authorized-users`, {
    method: 'POST',
    body: { userId },
  });
};

export const deletePermission = async (serviceCode: string, userId: string): Promise<void> => {
  await fetchInfraJson(`/services/${serviceCode}/authorized-users/${userId}`, {
    method: 'DELETE',
  });
};

export const getProject = async (targetSourceId: number): Promise<TargetSource> => {
  const data = await fetchInfraCamelJson<TargetSourceDetailResponse>(
    `/target-sources/${targetSourceId}`,
  );
  return extractTargetSource(data);
};

export interface UserSearchResult {
  id: string;
  name: string;
  email: string;
}

export const searchUsers = async (
  query: string,
  excludeIds: string[] = []
): Promise<UserSearchResult[]> => {
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  excludeIds.forEach((excludeId) => params.append('excludeIds', excludeId));

  const queryString = params.toString();
  const data = await fetchInfraCamelJson<{ users: UserSearchResult[] }>(
    queryString ? `/users/search?${queryString}` : '/users/search',
  );
  return data.users;
};


// ===== Confirm v1 API =====

const CONFIRM_BASE = '/target-sources';

export interface ConfirmResourceItem {
  id: string;
  resourceId: string;
  name: string;
  resourceType: string;
  databaseType: DatabaseType;
  integrationCategory: IntegrationCategory;
  host: string | null;
  port: number | null;
  oracleServiceId: string | null;
  networkInterfaceId: string | null;
  ipConfigurationName: string | null;
  metadata: ConfirmResourceMetadata;
}

export interface ConfirmResourcesResponse {
  resources: ConfirmResourceItem[];
  totalCount: number;
}

export const getConfirmResources = async (
  targetSourceId: number
): Promise<ConfirmResourcesResponse> =>
  fetchInfraCamelJson<ConfirmResourcesResponse>(`${CONFIRM_BASE}/${targetSourceId}/resources`);

export interface ApprovalResourceInputData {
  credential_id?: string;
  endpoint_config?: EndpointConfigInputData;
  resource_id?: string;
  resource_type?: string;
  database_type?: DatabaseType;
  port?: number;
  host?: string;
  oracle_service_id?: string;
  network_interface_id?: string;
  ip_configuration?: string;
}

export interface ApprovalResourceInput {
  resource_id: string;
  selected: boolean;
  resource_input?: ApprovalResourceInputData;
  exclusion_reason?: string;
}

export interface ApprovalRequestInput {
  resource_inputs: ApprovalResourceInput[];
  exclusion_reason_default?: string;
}

interface LegacyApprovalRequestInput {
  input_data: ApprovalRequestInput;
}

export interface ApprovalRequestResult {
  id: string;
  targetSourceId: number;
  status: Issue222ApprovalStatus;
  requestedAt: string;
  requestedBy: string;
  resourceTotalCount: number;
  resourceSelectedCount: number;
}

const toEndpointConfigSnapshot = (resource: Issue222ResourceConfigDto): ResourceSnapshot['endpoint_config'] => {
  if (!resource.database_type || resource.port === undefined || !resource.host) {
    return null;
  }

  return {
    resource_id: resource.resource_id ?? '',
    db_type: resource.database_type as EndpointConfigInputData['db_type'],
    port: resource.port,
    host: resource.host,
    ...(resource.oracle_service_id ? { oracleServiceId: resource.oracle_service_id } : {}),
    ...(resource.network_interface_id ? { selectedNicId: resource.network_interface_id } : {}),
  };
};

const toApprovedIntegrationResourceSnapshot = (
  resource: Issue222ResourceConfigDto,
): ApprovedIntegrationResourceItem => ({
  resource_id: resource.resource_id ?? '',
  resource_type: resource.resource_type ?? '',
  endpoint_config: toEndpointConfigSnapshot(resource),
  credential_id: resource.credential_id ?? null,
});

export const createApprovalRequest = async (
  targetSourceId: number,
  input: ApprovalRequestInput | LegacyApprovalRequestInput,
): Promise<ApprovalRequestResult> => {
  const payload = normalizeIssue222ApprovalRequestSummary(
    await fetchInfraJson<unknown>(`${CONFIRM_BASE}/${targetSourceId}/approval-requests`, {
      method: 'POST',
      body: normalizeIssue222ApprovalRequestBody(input),
    }),
    { targetSourceId },
  );

  return {
    id: String(payload.id ?? ''),
    targetSourceId: payload.target_source_id ?? targetSourceId,
    status: payload.status ?? 'PENDING',
    requestedAt: payload.requested_at ?? '',
    requestedBy: payload.requested_by?.user_id ?? '',
    resourceTotalCount: payload.resource_total_count ?? 0,
    resourceSelectedCount: payload.resource_selected_count ?? 0,
  };
};

export type ConfirmedIntegrationResourceItem = ConfirmedIntegrationResourceInfo;
export type ApprovedIntegrationResourceItem = ResourceSnapshot;

export type ConfirmedIntegrationResponse = BffConfirmedIntegration;

export const getConfirmedIntegration = async (
  targetSourceId: number
): Promise<ConfirmedIntegrationResponse> =>
  extractConfirmedIntegration(
    await fetchInfraJson<ConfirmedIntegrationResponsePayload>(`${CONFIRM_BASE}/${targetSourceId}/confirmed-integration`),
  );

export interface ApprovedIntegrationResponse {
  approved_integration: {
    id: string;
    request_id: string;
    approved_at: string;
    resource_infos: ApprovedIntegrationResourceItem[];
    excluded_resource_ids: string[];
    exclusion_reason?: string;
  } | null;
}

export const getApprovedIntegration = async (
  targetSourceId: number
): Promise<ApprovedIntegrationResponse> => {
  const payload = normalizeIssue222ApprovedIntegration(
    await fetchInfraJson<unknown>(`${CONFIRM_BASE}/${targetSourceId}/approved-integration`),
  );

  return {
    approved_integration: {
      id: String(payload.id ?? ''),
      request_id: String(payload.request_id ?? ''),
      approved_at: payload.approved_at ?? '',
      resource_infos: payload.resource_infos.map(toApprovedIntegrationResourceSnapshot),
      excluded_resource_ids: payload.excluded_resource_infos
        ?.map((item) => item.resource_id)
        .filter((resourceId): resourceId is string => typeof resourceId === 'string' && resourceId.length > 0)
        ?? [],
      exclusion_reason: payload.excluded_resource_infos
        ?.map((item) => item.exclusion_reason)
        .find((reason): reason is string => typeof reason === 'string' && reason.length > 0),
    },
  };
};

export interface ApprovalHistoryResponse {
  content: Array<{
    request: {
      id: string;
      requested_at: string;
      requested_by: string;
      status?: Issue222ApprovalStatus;
      resource_total_count: number;
      resource_selected_count: number;
      input_data: {
        resource_inputs: ApprovalResourceInput[];
        exclusion_reason_default?: string;
      };
    };
    result?: {
      id: string;
      request_id: string;
      result: string;
      processed_at: string;
      process_info: { user_id: string | null; reason: string | null };
    };
  }>;
  page: { totalElements: number; totalPages: number; number: number; size: number };
}

export const getApprovalHistory = async (
  targetSourceId: number,
  page = 0,
  size = 10
): Promise<ApprovalHistoryResponse> => {
  const payload = normalizeIssue222ApprovalHistoryPage(
    await fetchInfraJson<unknown>(`${CONFIRM_BASE}/${targetSourceId}/approval-history?page=${page}&size=${size}`),
    targetSourceId,
  );

  return {
    content: payload.content.map((item) => ({
      request: {
        id: String(item.request.id ?? ''),
        requested_at: item.request.requested_at ?? '',
        requested_by: item.request.requested_by?.user_id ?? '',
        ...(item.request.status ? { status: item.request.status } : {}),
        resource_total_count: item.request.resource_total_count ?? 0,
        resource_selected_count: item.request.resource_selected_count ?? 0,
        input_data: {
          resource_inputs: [],
        },
      },
      ...(item.result
        ? {
            result: {
              id: String(item.result.request_id ?? item.request.id ?? ''),
              request_id: String(item.result.request_id ?? item.request.id ?? ''),
              result: item.result.status ?? 'UNAVAILABLE',
              processed_at: item.result.processed_at ?? '',
              process_info: {
                user_id: item.result.processed_by?.user_id ?? null,
                reason: item.result.reason ?? null,
              },
            },
          }
        : {}),
    })),
    page: {
      totalElements: payload.totalElements,
      totalPages: payload.totalPages,
      number: payload.number,
      size: payload.size,
    },
  };
};

export const approveApprovalRequestV1 = async (
  targetSourceId: number,
  comment?: string
): Promise<{ success: boolean; result: string; processed_at: string }> => {
  const payload = normalizeIssue222ApprovalActionResponse(
    await fetchInfraJson<unknown>(`${CONFIRM_BASE}/${targetSourceId}/approval-requests/approve`, {
      method: 'POST',
      body: { comment },
    }),
  );

  return {
    success: true,
    result: payload.status ?? 'APPROVED',
    processed_at: payload.processed_at ?? '',
  };
};

export const rejectApprovalRequestV1 = async (
  targetSourceId: number,
  reason: string
): Promise<{ success: boolean; result: string; processed_at: string; reason: string }> => {
  const payload = normalizeIssue222ApprovalActionResponse(
    await fetchInfraJson<unknown>(`${CONFIRM_BASE}/${targetSourceId}/approval-requests/reject`, {
      method: 'POST',
      body: { reason },
    }),
  );

  return {
    success: true,
    result: payload.status ?? 'REJECTED',
    processed_at: payload.processed_at ?? '',
    reason: payload.reason ?? reason,
  };
};

// === Approval Request Latest (BFF 실제 응답 구조) ===

export interface ApprovalRequestLatestResponse {
  request: {
    id: number;
    target_source_id: number;
    status: string;
    requested_by: { user_id: string };
    requested_at: string;
    resource_total_count: number;
    resource_selected_count: number;
  };
  result: {
    request_id: number | null;
    status: string;
    processed_by: { user_id: string };
    processed_at: string;
    reason: string | null;
  };
}

export const getApprovalRequestLatest = async (
  targetSourceId: number
): Promise<ApprovalRequestLatestResponse> =>
  fetchInfraJson<ApprovalRequestLatestResponse>(
    `${CONFIRM_BASE}/${targetSourceId}/approval-requests/latest`,
  );

export const cancelApprovalRequest = async (
  targetSourceId: number
): Promise<{ success: boolean }> => {
  await fetchInfraJson<unknown>(`${CONFIRM_BASE}/${targetSourceId}/approval-requests/cancel`, {
    method: 'POST',
  });
  return {
    success: true,
  };
};

export type BffProcessStatus = 'IDLE' | 'PENDING' | 'CONFIRMING' | 'CONFIRMED' | 'INSTALLED' | 'CONNECTED' | 'COMPLETED';

export interface ProcessStatusResponse {
  target_source_id: number;
  process_status: BffProcessStatus;
  healthy: 'UNKNOWN' | 'HEALTHY' | 'UNHEALTHY' | 'DEGRADED';
  evaluated_at: string;
}

export const getProcessStatus = async (
  targetSourceId: number
): Promise<ProcessStatusResponse> =>
  normalizeIssue222ProcessStatusResponse(
    await fetchInfraJson<unknown>(`${CONFIRM_BASE}/${targetSourceId}/process-status`),
  );

// ===== Connection Test API (Async) =====

export const getSecrets = async (targetSourceId: number): Promise<SecretKey[]> =>
  fetchInfraCamelJson<SecretKey[]>(`${CONFIRM_BASE}/${targetSourceId}/secrets`);

export interface TestConnectionTriggerResponse {
  success: boolean;
  id: string;
}

export type TestConnectionStatus = 'PENDING' | 'SUCCESS' | 'FAIL';
export type TestConnectionErrorStatus = 'AUTH_FAIL' | 'CONNECTION_FAIL' | 'PERMISSION_DENIED';

export interface TestConnectionResourceResult {
  resource_id: string;
  resource_type: string;
  status: TestConnectionStatus;
  error_status: TestConnectionErrorStatus | null;
  guide: string | null;
  agent_id: string | null;
}

export interface TestConnectionJob {
  id: string;
  target_source_id: number;
  status: TestConnectionStatus;
  requested_at: string | null;
  completed_at: string | null;
  requested_by: string;
  resource_results: TestConnectionResourceResult[];
}

export interface TestConnectionResultsResponse {
  content: TestConnectionJob[];
  page: { totalElements: number; totalPages: number; number: number; size: number };
}

// 비동기 연결 테스트 트리거 — 202 Accepted
export const triggerTestConnection = async (
  targetSourceId: number
): Promise<TestConnectionTriggerResponse> =>
  fetchInfraJson<TestConnectionTriggerResponse>(
    `${CONFIRM_BASE}/${targetSourceId}/test-connection`,
    { method: 'POST' },
  );

// 최근 연결 테스트 결과 (polling용) — 404 if none
export const getTestConnectionLatest = async (
  targetSourceId: number
): Promise<TestConnectionJob> =>
  fetchInfraJson<TestConnectionJob>(
    `${CONFIRM_BASE}/${targetSourceId}/test-connection/latest`,
  );

// 연결 테스트 이력 (pagination)
export const getTestConnectionResults = async (
  targetSourceId: number,
  page = 0,
  size = 10,
): Promise<TestConnectionResultsResponse> => {
  const response = await fetchInfraJson<TestConnectionResultsResponse & {
    page: {
      total_elements?: number;
      total_pages?: number;
    };
  }>(`${CONFIRM_BASE}/${targetSourceId}/test-connection/results?page=${page}&size=${size}`);

  return {
    ...response,
    page: {
      ...response.page,
      totalElements: response.page.totalElements ?? response.page.total_elements ?? 0,
      totalPages: response.page.totalPages ?? response.page.total_pages ?? 0,
    },
  };
};

// Credential 갱신 — v1
export const updateResourceCredential = async (
  targetSourceId: number,
  resourceId: string,
  credentialId: string | null
): Promise<{ success: boolean }> =>
  fetchInfraJson<{ success: boolean }>(
    `${CONFIRM_BASE}/${targetSourceId}/resources/credential`,
    {
      method: 'PUT',
      body: { resourceId, credentialId },
    },
  );

// 설치 완료 확정 (관리자) — v1
export interface InstallationConfirmResult {
  success: boolean;
  confirmedAt: string;
}

export const confirmInstallation = async (
  targetSourceId: number
): Promise<InstallationConfirmResult> =>
  fetchInfraCamelJson<InstallationConfirmResult>(
    `${CONFIRM_BASE}/${targetSourceId}/pii-agent-installation/confirm`,
    { method: 'POST' },
  );

// ===== Azure API =====
export * from './azure';

// ===== AWS API =====
export * from './aws';

// ===== GCP API =====
export * from './gcp';

// ===== Scan API =====
export * from './scan';

// ===== Admin Dashboard API =====
export * from './dashboard';
