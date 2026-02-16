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
  const res = await fetch(`${BASE_URL}/user/me`);
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

// TODO: Confirm v1 migration — replace with v1 endpoint when available
export const completeInstallation = async (
  projectId: string
): Promise<Project> => {
  const res = await fetch(`${BASE_URL}/projects/${projectId}/complete-installation`, {
    method: 'POST',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'Failed to complete installation');
  }
  const data = await res.json();
  return data.project;
};

// TODO: Confirm v1 migration — replace with v1 endpoint when available
export const confirmPiiAgent = async (
  projectId: string
): Promise<Project> => {
  const res = await fetch(`${BASE_URL}/projects/${projectId}/confirm-pii-agent`, {
    method: 'POST',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'Failed to confirm PII Agent');
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

export interface ApprovalRequestInput {
  target_resource_ids: string[];
  excluded_resource_ids?: string[];
  exclusion_reason?: string;
  vm_configs?: Array<{
    resource_id: string;
    db_type: string;
    port: number;
    host: string;
    oracleServiceId?: string;
    selectedNicId?: string;
  }>;
}

export interface ApprovalRequestResult {
  success: boolean;
  approval_request: {
    id: string;
    requested_at: string;
    requested_by: string;
    target_resource_ids: string[];
    excluded_resource_ids: string[];
    exclusion_reason?: string;
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

export interface ConfirmedIntegrationResponse {
  confirmed_integration: {
    id: string;
    confirmed_at: string;
    resource_infos: Array<{
      resource_id: string;
      resource_type: string;
      vm_config: Record<string, unknown> | null;
      selectedCredentialId: string | null;
    }>;
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
    resource_infos: Array<{
      resource_id: string;
      resource_type: string;
      vm_config: Record<string, unknown> | null;
      selectedCredentialId: string | null;
    }>;
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
      target_resource_ids: string[];
      excluded_resource_ids: string[];
      exclusion_reason?: string;
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

export interface ProcessStatusResponse {
  process_status: string;
  status_inputs: {
    last_rejection_reason: string | null;
  };
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
  project: Project;
  history: ConnectionTestHistory;
}

// TODO: Confirm v1 migration — replace with v1 endpoint when available
export const runConnectionTest = async (
  projectId: string,
  resourceCredentials: ResourceCredentialInput[]
): Promise<ConnectionTestResponse> => {
  const res = await fetch(`${BASE_URL}/projects/${projectId}/test-connection`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resourceCredentials }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'Failed to run connection test');
  }
  return await res.json();
};

export const updateResourceCredential = async (
  projectId: string,
  resourceId: string,
  credentialId: string | null
): Promise<Project> => {
  const res = await fetch(`${BASE_URL}/projects/${projectId}/resources/credential`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resourceId, credentialId }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'Failed to update resource credential');
  }
  const data = await res.json();
  return data.project;
};

// 설치 완료 확정 (관리자)
export const confirmCompletion = async (
  projectId: string
): Promise<Project> => {
  const res = await fetch(`${BASE_URL}/projects/${projectId}/confirm-completion`, {
    method: 'POST',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'Failed to confirm completion');
  }
  const data = await res.json();
  return data.project;
};

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
