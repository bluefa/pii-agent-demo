import {
  ServiceCode,
  ProjectSummary,
  User,
  CloudProvider,
  Project,
  UserRole,
  ResourceSnapshot,
  BffConfirmedIntegration,
  ConnectionStatusResponse,
  ConfirmResourceMetadata,
  EndpointConfigInputData,
} from '@/lib/types';
import type { SecretKey } from '@/lib/types';
import { fetchInfraCamelJson, fetchInfraJson } from '@/app/lib/api/infra';
import { extractTargetSource, type TargetSourceDetailResponse } from '@/lib/target-source-response';


export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  serviceCodePermissions: string[];
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

export const getProjects = async (serviceCode: string): Promise<ProjectSummary[]> => {
  const data = await fetchInfraCamelJson<{ targetSources: ProjectSummary[] }>(
    `/services/${serviceCode}/target-sources`,
  );
  return data.targetSources;
};

export const createProject = async (payload: {
  projectCode: string;
  serviceCode: string;
  cloudProvider: CloudProvider;
  description?: string;
  awsAccountId?: string;
  awsRegionType?: 'global' | 'china';
  tenantId?: string;
  subscriptionId?: string;
  gcpProjectId?: string;
}): Promise<void> => {
  await fetchInfraJson(`/services/${payload.serviceCode}/target-sources`, {
    method: 'POST',
    body: payload,
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

export const getProject = async (targetSourceId: number): Promise<Project> => {
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
  integrationCategory: 'TARGET' | 'NO_INSTALL_NEEDED' | 'INSTALL_INELIGIBLE';
  selectedCredentialId: string | null;
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

export interface ApprovalResourceInput {
  resource_id: string;
  selected: boolean;
  resource_input?: {
    credential_id?: string;
    endpoint_config?: EndpointConfigInputData;
  };
  exclusion_reason?: string;
}

export interface ApprovalRequestInput {
  input_data: {
    resource_inputs: ApprovalResourceInput[];
    exclusion_reason_default?: string;
  };
}

export interface ApprovalRequestResult {
  success: boolean;
  approval_request: {
    id: string;
    requested_at: string;
    requested_by: string;
    input_data: {
      resource_inputs: ApprovalResourceInput[];
      exclusion_reason_default?: string;
    };
  };
}

export const createApprovalRequest = async (
  targetSourceId: number,
  input: ApprovalRequestInput
): Promise<ApprovalRequestResult> =>
  fetchInfraJson<ApprovalRequestResult>(`${CONFIRM_BASE}/${targetSourceId}/approval-requests`, {
    method: 'POST',
    body: input,
  });

export type ResourceSnapshotItem = ResourceSnapshot;

export type ConfirmedIntegrationResponse = BffConfirmedIntegration;

export const getConfirmedIntegration = async (
  targetSourceId: number
): Promise<ConfirmedIntegrationResponse> =>
  fetchInfraJson<ConfirmedIntegrationResponse>(`${CONFIRM_BASE}/${targetSourceId}/confirmed-integration`);

export interface ApprovedIntegrationResponse {
  approved_integration: {
    id: string;
    request_id: string;
    approved_at: string;
    resource_infos: ResourceSnapshotItem[];
    excluded_resource_ids: string[];
    exclusion_reason?: string;
  } | null;
}

export const getApprovedIntegration = async (
  targetSourceId: number
): Promise<ApprovedIntegrationResponse> =>
  fetchInfraJson<ApprovedIntegrationResponse>(`${CONFIRM_BASE}/${targetSourceId}/approved-integration`);

export interface ApprovalHistoryResponse {
  content: Array<{
    request: {
      id: string;
      requested_at: string;
      requested_by: string;
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
  const response = await fetchInfraJson<ApprovalHistoryResponse & {
    page: {
      total_elements?: number;
      total_pages?: number;
    };
  }>(`${CONFIRM_BASE}/${targetSourceId}/approval-history?page=${page}&size=${size}`);

  return {
    ...response,
    page: {
      ...response.page,
      totalElements: response.page.totalElements ?? response.page.total_elements ?? 0,
      totalPages: response.page.totalPages ?? response.page.total_pages ?? 0,
    },
  };
};

export const approveApprovalRequestV1 = async (
  targetSourceId: number,
  comment?: string
): Promise<{ success: boolean; result: string; processed_at: string }> =>
  fetchInfraJson(`${CONFIRM_BASE}/${targetSourceId}/approval-requests/approve`, {
    method: 'POST',
    body: { comment },
  });

export const rejectApprovalRequestV1 = async (
  targetSourceId: number,
  reason: string
): Promise<{ success: boolean; result: string; processed_at: string; reason: string }> =>
  fetchInfraJson(`${CONFIRM_BASE}/${targetSourceId}/approval-requests/reject`, {
    method: 'POST',
    body: { reason },
  });

export const cancelApprovalRequest = async (
  targetSourceId: number
): Promise<{ success: boolean }> =>
  fetchInfraJson<{ success: boolean }>(`${CONFIRM_BASE}/${targetSourceId}/approval-requests/cancel`, {
    method: 'POST',
  });

export type BffProcessStatus = 'REQUEST_REQUIRED' | 'WAITING_APPROVAL' | 'APPLYING_APPROVED' | 'TARGET_CONFIRMED';
export type LastApprovalResult = 'NONE' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'SYSTEM_ERROR' | 'COMPLETED';

export interface ProcessStatusResponse {
  target_source_id: number;
  process_status: BffProcessStatus;
  status_inputs: {
    has_confirmed_integration: boolean;
    has_pending_approval_request: boolean;
    has_approved_integration: boolean;
    last_approval_result: LastApprovalResult;
    last_rejection_reason: string | null;
  };
  evaluated_at: string;
}

export const getProcessStatus = async (
  targetSourceId: number
): Promise<ProcessStatusResponse> =>
  fetchInfraJson<ProcessStatusResponse>(`${CONFIRM_BASE}/${targetSourceId}/process-status`);

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
      method: 'PATCH',
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

// ===== Connection Status API =====

export const getConnectionStatus = async (
  targetSourceId: number
): Promise<ConnectionStatusResponse> =>
  fetchInfraJson<ConnectionStatusResponse>(
    `${CONFIRM_BASE}/${targetSourceId}/logical-db-status`
  );

// ===== Azure API =====
export * from './azure';

// ===== AWS API =====
export * from './aws';

// ===== SDU API =====
export * from './sdu';

// ===== GCP API =====
export * from './gcp';

// ===== Scan API =====
export * from './scan';

// ===== Admin Dashboard API =====
export * from './dashboard';
