import { ServiceCode, ProjectSummary, User, CloudProvider, Project, UserRole, ConnectionTestResult, ConnectionTestHistory, VmDatabaseConfig } from '@/lib/types';
import type { SecretKey } from '@/lib/types';
import { fetchJson } from '@/lib/fetch-json';

const BASE_URL = '/api';

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
  const res = await fetch(`${BASE_URL}/services/${serviceCode}/projects`);
  if (!res.ok) throw new Error('Failed to fetch projects');
  const data = await res.json();
  return data.projects;
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
  const res = await fetch(`${BASE_URL}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to create project');
};

export const getPermissions = async (serviceCode: string): Promise<User[]> => {
  const res = await fetch(`${BASE_URL}/services/${serviceCode}/permissions`);
  if (!res.ok) throw new Error('Failed to fetch permissions');
  const data = await res.json();
  return data.users;
};

export const addPermission = async (serviceCode: string, userId: string): Promise<void> => {
  const res = await fetch(`${BASE_URL}/services/${serviceCode}/permissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  if (!res.ok) throw new Error('Failed to add permission');
};

export const deletePermission = async (serviceCode: string, userId: string): Promise<void> => {
  const res = await fetch(`${BASE_URL}/services/${serviceCode}/permissions/${userId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete permission');
};

export const getProject = async (id: string): Promise<Project> => {
  const res = await fetch(`${BASE_URL}/projects/${id}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'Failed to fetch project');
  }
  const data = await res.json();
  return data.project;
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

export interface VmConfigInput {
  resourceId: string;
  config: VmDatabaseConfig;
}

// TODO: Confirm v1 migration — replace with v1 endpoint when available
export const confirmTargets = async (
  projectId: string,
  resourceIds: string[],
  vmConfigs?: VmConfigInput[]
): Promise<Project> => {
  const res = await fetch(`${BASE_URL}/projects/${projectId}/confirm-targets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resourceIds, vmConfigs }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'Failed to confirm targets');
  }
  const data = await res.json();
  return data.project;
};

// TODO: Confirm v1 migration — replace with v1 endpoint when available
export const approveProject = async (
  projectId: string,
  comment?: string
): Promise<Project> => {
  const res = await fetch(`${BASE_URL}/projects/${projectId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ comment }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'Failed to approve project');
  }
  const data = await res.json();
  return data.project;
};

// TODO: Confirm v1 migration — replace with v1 endpoint when available
export const rejectProject = async (
  projectId: string,
  reason?: string
): Promise<Project> => {
  const res = await fetch(`${BASE_URL}/projects/${projectId}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'Failed to reject project');
  }
  const data = await res.json();
  return data.project;
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

// ===== Connection Test API =====

export const getSecrets = async (targetSourceId: number): Promise<SecretKey[]> =>
  fetchJson<SecretKey[]>(`/api/v1/target-sources/${targetSourceId}/secrets`);

export interface ResourceCredentialInput {
  resourceId: string;
  credentialId?: string;
}

export interface ConnectionTestResponse {
  success: boolean;
  results: ConnectionTestResult[];
  history: ConnectionTestHistory;
}

// 연결 테스트 — v1
export const runConnectionTest = async (
  targetSourceId: number,
  resourceCredentials: ResourceCredentialInput[]
): Promise<ConnectionTestResponse> =>
  fetchJson<ConnectionTestResponse>(
    `${CONFIRM_BASE}/${targetSourceId}/test-connection`,
    {
      method: 'POST',
      body: { resourceCredentials },
    },
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
