import { ServiceCode, ProjectSummary, User, CloudProvider, Project, UserRole, ConnectionStatusResponse } from '@/lib/types';
import type { SecretKey } from '@/lib/types';
import { fetchJson } from '@/lib/fetch-json';


export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  serviceCodePermissions: string[];
}

export const getCurrentUser = async (): Promise<CurrentUser> => {
  const res = await fetch('/api/v1/user/me');
  if (!res.ok) throw new Error('Failed to fetch current user');
  const data = await res.json();
  return data.user;
};

export const getServices = async (): Promise<ServiceCode[]> => {
  const res = await fetch('/api/v1/user/services');
  if (!res.ok) throw new Error('Failed to fetch services');
  const data = await res.json() as {
    services: Array<{ serviceCode: string; serviceName: string }>;
  };
  return data.services.map((service) => ({
    code: service.serviceCode,
    name: service.serviceName,
  }));
};

export const getProjects = async (serviceCode: string): Promise<ProjectSummary[]> => {
  const data = await fetchJson<{ targetSources: ProjectSummary[] }>(`/api/v1/services/${serviceCode}/target-sources`);
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
  await fetchJson(`/api/v1/services/${payload.serviceCode}/target-sources`, {
    method: 'POST',
    body: payload,
  });
};

export const getPermissions = async (serviceCode: string): Promise<User[]> => {
  const data = await fetchJson<{ users: User[] }>(`/api/v1/services/${serviceCode}/authorized-users`);
  return data.users;
};

export const addPermission = async (serviceCode: string, userId: string): Promise<void> => {
  await fetchJson(`/api/v1/services/${serviceCode}/authorized-users`, {
    method: 'POST',
    body: { userId },
  });
};

export const deletePermission = async (serviceCode: string, userId: string): Promise<void> => {
  await fetchJson(`/api/v1/services/${serviceCode}/authorized-users/${userId}`, {
    method: 'DELETE',
  });
};

export const getProject = async (targetSourceId: number): Promise<Project> => {
  const data = await fetchJson<{ targetSource: Project }>(`/api/v1/target-sources/${targetSourceId}`);
  return data.targetSource;
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
  const endpoint = queryString
    ? `/api/v1/users/search?${queryString}`
    : '/api/v1/users/search';

  const res = await fetch(endpoint);
  if (!res.ok) throw new Error('Failed to search users');
  const data = await res.json();
  return data.users;
};


// ===== Confirm v1 API =====

const CONFIRM_BASE = '/api/v1/target-sources';

export interface ConfirmResourceItem {
  id: string;
  resourceId: string;
  name: string;
  resourceType: string;
  integrationCategory: 'TARGET' | 'NO_INSTALL_NEEDED' | 'INSTALL_INELIGIBLE';
  selectedCredentialId: string | null;
  metadata: Record<string, unknown>;
}

export interface ConfirmResourcesResponse {
  resources: ConfirmResourceItem[];
  totalCount: number;
}

export const getConfirmResources = async (
  targetSourceId: number
): Promise<ConfirmResourcesResponse> =>
  fetchJson<ConfirmResourcesResponse>(`${CONFIRM_BASE}/${targetSourceId}/resources`);

export interface ApprovalResourceInput {
  resource_id: string;
  selected: boolean;
  resource_input?: {
    credential_id?: string;
    endpoint_config?: {
      db_type: string;
      port: number;
      host: string;
      oracleServiceId?: string;
      selectedNicId?: string;
    };
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
  fetchJson<ApprovalRequestResult>(`${CONFIRM_BASE}/${targetSourceId}/approval-requests`, {
    method: 'POST',
    body: input,
  });

export interface ResourceSnapshotItem {
  resource_id: string;
  resource_type: string;
  endpoint_config: Record<string, unknown> | null;
  credential_id: string | null;
}

export interface ConfirmedIntegrationResponse {
  confirmed_integration: {
    resource_infos: ResourceSnapshotItem[];
  } | null;
}

export const getConfirmedIntegration = async (
  targetSourceId: number
): Promise<ConfirmedIntegrationResponse> =>
  fetchJson<ConfirmedIntegrationResponse>(`${CONFIRM_BASE}/${targetSourceId}/confirmed-integration`);

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
  fetchJson<ApprovedIntegrationResponse>(`${CONFIRM_BASE}/${targetSourceId}/approved-integration`);

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
): Promise<ApprovalHistoryResponse> =>
  fetchJson<ApprovalHistoryResponse>(
    `${CONFIRM_BASE}/${targetSourceId}/approval-history?page=${page}&size=${size}`
  );

export const approveApprovalRequestV1 = async (
  targetSourceId: number,
  comment?: string
): Promise<{ success: boolean; result: string; processed_at: string }> =>
  fetchJson(`${CONFIRM_BASE}/${targetSourceId}/approval-requests/approve`, {
    method: 'POST',
    body: { comment },
  });

export const rejectApprovalRequestV1 = async (
  targetSourceId: number,
  reason: string
): Promise<{ success: boolean; result: string; processed_at: string; reason: string }> =>
  fetchJson(`${CONFIRM_BASE}/${targetSourceId}/approval-requests/reject`, {
    method: 'POST',
    body: { reason },
  });

export const cancelApprovalRequest = async (
  targetSourceId: number
): Promise<{ success: boolean }> =>
  fetchJson<{ success: boolean }>(`${CONFIRM_BASE}/${targetSourceId}/approval-requests/cancel`, {
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
  fetchJson<ProcessStatusResponse>(`${CONFIRM_BASE}/${targetSourceId}/process-status`);

// ===== Connection Test API (Async) =====

export const getSecrets = async (targetSourceId: number): Promise<SecretKey[]> =>
  fetchJson<SecretKey[]>(`/api/v1/target-sources/${targetSourceId}/secrets`);

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
  fetchJson<TestConnectionTriggerResponse>(
    `${CONFIRM_BASE}/${targetSourceId}/test-connection`,
    { method: 'POST' },
  );

// 최근 연결 테스트 결과 (polling용) — 404 if none
export const getTestConnectionLatest = async (
  targetSourceId: number
): Promise<TestConnectionJob> =>
  fetchJson<TestConnectionJob>(
    `${CONFIRM_BASE}/${targetSourceId}/test-connection/latest`,
  );

// 연결 테스트 이력 (pagination)
export const getTestConnectionResults = async (
  targetSourceId: number,
  page = 0,
  size = 10,
): Promise<TestConnectionResultsResponse> =>
  fetchJson<TestConnectionResultsResponse>(
    `${CONFIRM_BASE}/${targetSourceId}/test-connection/results?page=${page}&size=${size}`,
  );

// Credential 갱신 — v1
export const updateResourceCredential = async (
  targetSourceId: number,
  resourceId: string,
  credentialId: string | null
): Promise<{ success: boolean }> =>
  fetchJson<{ success: boolean }>(
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
  fetchJson<InstallationConfirmResult>(
    `${CONFIRM_BASE}/${targetSourceId}/pii-agent-installation/confirm`,
    { method: 'POST' },
  );

// ===== Connection Status API =====

export const getConnectionStatus = async (
  targetSourceId: number
): Promise<ConnectionStatusResponse> =>
  fetchJson<ConnectionStatusResponse>(
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
