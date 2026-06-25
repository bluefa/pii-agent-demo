import {
  ServiceCode,
  ProjectSummary,
  CloudProvider,
  TargetSource,
  ProcessStatus,
  DatabaseType,
  IntegrationCategory,
  ConfirmedIntegrationResourceInfo,
  BffConfirmedIntegration,
  ConfirmResourceMetadata,
  EndpointConfigInputData,
  ResourceScanStatus,
  ResourceSnapshot,
  normalizeCloudProvider,
} from '@/lib/types';
import type { SecretKey } from '@/lib/types';
import { fetchInfraCamelJson, fetchInfraJson } from '@/app/lib/api/infra';
import { snakeCaseKeys } from '@/lib/object-case';
import {
  extractTargetSource,
  normalizeTargetSourceProcessStatus,
  type TargetSourceDetailResponse,
} from '@/lib/target-source-response';
import type {
  TargetSourceCloudType,
  TargetSourceCreationCandidate,
  TargetSourceInfo,
} from '@/lib/target-source-creation';
// Re-export the create-flow domain types so create-modal consumers import from
// one place (mirrors the test-connection re-exports below).
export type {
  TargetSourceCloudType,
  TargetSourceCreationCandidate,
  TargetSourceInfo,
};
import { extractConfirmedIntegration, type ConfirmedIntegrationResponsePayload } from '@/lib/confirmed-integration-response';
import type { z } from 'zod';
import type { schemas } from '@/lib/generated/install-v1';
// Re-export test-connection wire types (zod-codegen, snake) so consumers import
// from one place. Field access is snake_case; use adapters for join/reshape/compute.
export type TestConnectionVersionResult = z.infer<typeof schemas.TestConnectionVersionResult>;
export type TestConnectionAgentResult = z.infer<typeof schemas.TestConnectionAgentResult>;
export type TestConnectionLatestResultSummary = z.infer<typeof schemas.TestConnectionLatestResultSummaryResponse>;
export type TestConnectionCompletionStatus = z.infer<typeof schemas.TestConnectionCompletionStatusResponse>;
export type TestConnectionConfirmationResult = z.infer<typeof schemas.TestConnectionConfirmationResponse>;
export type TestConnectionTriggerResult = z.infer<typeof schemas.TestConnectionTriggerResponse>;
export type TestConnectionStatus = TestConnectionVersionResult['connection_status'];
import {
  normalizeApprovedIntegration,
  normalizeProcessStatusResponse,
  type ExcludedResourceInfoDto,
  type ResourceConfigDto,
} from '@/lib/approval-bff';
import type {
  ApprovalRequestStatus,
  ApprovalRequestSummary,
  ApprovalRequestLatest,
  ApprovalHistoryPage,
  ApprovalActionResponse,
  ApprovalUnavailableResponse,
  ApprovalUnavailableConfirmResponse,
} from '@/lib/approval-response';
// Re-export the approval domain types so `@/app/lib/api` consumers (Step2 UI)
// keep importing from one place.
export type {
  ApprovalRequestStatus,
  ApprovalRequestLatest,
  ApprovalHistoryPage,
  ApprovalActionResponse,
  ApprovalUnavailableResponse,
  ApprovalUnavailableConfirmResponse,
} from '@/lib/approval-response';


export interface CurrentUser {
  id: string;
  name: string;
  email: string;
}

export const getCurrentUser = (): Promise<CurrentUser> =>
  fetchInfraCamelJson<CurrentUser>('/user/me');

export interface ServicePageResponse {
  content: ServiceCode[];
  page: { totalElements: number; totalPages: number; number: number; size: number };
}

export const getServicesPage = async (
  page = 0,
  size = 10,
  query?: string,
  options?: { signal?: AbortSignal },
): Promise<ServicePageResponse> => {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (query) params.set('query', query);
  const data = await fetchInfraCamelJson<{
    content: Array<{ serviceCode: string; serviceName: string }>;
    page: { totalElements: number; totalPages: number; number: number; size: number };
  }>(
    `/user/services/page?${params}`,
    options?.signal ? { signal: options.signal } : undefined,
  );
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

// Lowercase request `cloud_type` enum (35 request — distinct from the UPPERCASE
// response enum). `others` is unused by the UI (only the 4 real providers).
const toRequestCloudType = (cloudProvider: CloudProvider): 'aws' | 'azure' | 'gcp' | 'idc' => {
  switch (cloudProvider) {
    case 'AWS':
      return 'aws';
    case 'Azure':
      return 'azure';
    case 'GCP':
      return 'gcp';
    case 'IDC':
      return 'idc';
  }
};

/** UI-facing form input for the creation-candidates request (35). */
export interface CreationCandidatesInput {
  cloudProvider: CloudProvider;
  awsAccountId?: string;
  isChinaRegion?: boolean;
  isTerraformExecutionGranted?: boolean;
  tenantId?: string;
  subscriptionId?: string;
  gcpProjectId?: string;
  description?: string;
  dbTypes: string[];
}

/**
 * POST creation-candidates (35). Builds the snake `TargetSourceCreationCandidateRequest`
 * (request casing is snake, D3 — no camel intermediate) and returns the camel
 * candidate domain array (the route owns the wire→domain boundary).
 */
export const getCreationCandidates = async (
  serviceCode: string,
  input: CreationCandidatesInput,
): Promise<TargetSourceCreationCandidate[]> => {
  const description = input.description?.trim();
  const body = {
    cloud_type: toRequestCloudType(input.cloudProvider),
    is_china_region: input.isChinaRegion === true,
    database_types: input.dbTypes,
    ...(typeof input.isTerraformExecutionGranted === 'boolean'
      ? { grant_service_terraform_execution_permission: input.isTerraformExecutionGranted }
      : {}),
    metadata: {
      ...(input.awsAccountId ? { aws_account_id: input.awsAccountId } : {}),
      ...(input.tenantId ? { tenant_id: input.tenantId } : {}),
      ...(input.subscriptionId ? { subscription_id: input.subscriptionId } : {}),
      // GCP project id is `project_id` in the candidate request metadata.
      ...(input.gcpProjectId ? { project_id: input.gcpProjectId } : {}),
      ...(description ? { description } : {}),
    },
  };
  return fetchInfraJson<TargetSourceCreationCandidate[]>(
    `/services/${serviceCode}/creation-candidates`,
    { method: 'POST', body },
  );
};

/**
 * POST createTargetSource (36). The selected candidate is posted back verbatim:
 * the camel domain candidate is re-serialized to the snake wire body
 * (`TargetSourceCreationCandidateResponse`) via `snakeCaseKeys`. Returns the
 * created `TargetSourceInfo` (camel, route-normalized).
 */
export const createTargetSource = async (
  serviceCode: string,
  candidate: TargetSourceCreationCandidate,
): Promise<TargetSourceInfo> =>
  fetchInfraJson<TargetSourceInfo>(`/services/${serviceCode}/target-sources`, {
    method: 'POST',
    body: snakeCaseKeys(candidate),
  });

export interface AuthorizedUser {
  id: string;
  name: string;
  email: string;
}

export const getPermissions = async (serviceCode: string): Promise<AuthorizedUser[]> => {
  const data = await fetchInfraCamelJson<{ users?: AuthorizedUser[] }>(
    `/services/${serviceCode}/authorized-users`,
  );
  return data.users ?? [];
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
  scanStatus: ResourceScanStatus | null;
  metadata: ConfirmResourceMetadata;
}

export interface ConfirmResourcesResponse {
  resources: ConfirmResourceItem[];
  totalCount: number;
}

export const getConfirmResources = async (
  targetSourceId: number,
  options?: { signal?: AbortSignal },
): Promise<ConfirmResourcesResponse> =>
  fetchInfraCamelJson<ConfirmResourcesResponse>(
    `${CONFIRM_BASE}/${targetSourceId}/resources`,
    options?.signal ? { signal: options.signal } : undefined,
  );

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
  status: ApprovalRequestStatus;
  requestedAt: string;
  requestedBy: string;
  resourceTotalCount: number;
  resourceSelectedCount: number;
}

const toEndpointConfigSnapshot = (resource: ResourceConfigDto): ResourceSnapshot['endpoint_config'] => {
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
  resource: ResourceConfigDto,
): ApprovedIntegrationResourceItem => ({
  resource_id: resource.resource_id ?? '',
  resource_type: resource.resource_type ?? '',
  endpoint_config: toEndpointConfigSnapshot(resource),
  credential_id: resource.credential_id ?? null,
  database_region: resource.database_region ?? null,
  resource_name: resource.resource_name ?? null,
  scan_status: resource.scan_status ?? null,
  integration_status: resource.integration_status ?? null,
  // Pass IDC fields through — absent for cloud resources.
  ...(resource.idc_host_format ? { idc_host_format: resource.idc_host_format } : {}),
  ...(resource.idc_ips ? { idc_ips: resource.idc_ips } : {}),
  ...(resource.idc_host ? { idc_host: resource.idc_host } : {}),
  ...(resource.idc_source_ips ? { idc_source_ips: resource.idc_source_ips } : {}),
});

export const createApprovalRequest = async (
  targetSourceId: number,
  input: ApprovalRequestInput | LegacyApprovalRequestInput,
): Promise<ApprovalRequestResult> => {
  // Route normalizes both the (out-of-contract) request body and the
  // ApprovalRequestSummaryDto response to camel (ADR-019 D1 boundary).
  const summary = await fetchInfraJson<ApprovalRequestSummary>(
    `${CONFIRM_BASE}/${targetSourceId}/approval-requests`,
    { method: 'POST', body: input },
  );

  return {
    id: String(summary.id || ''),
    targetSourceId: summary.targetSourceId || targetSourceId,
    status: summary.status,
    requestedAt: summary.requestedAt,
    requestedBy: summary.requestedBy?.userId ?? '',
    resourceTotalCount: summary.resourceTotalCount,
    resourceSelectedCount: summary.resourceSelectedCount,
  };
};

export type ConfirmedIntegrationResourceItem = ConfirmedIntegrationResourceInfo;
export type ApprovedIntegrationResourceItem = ResourceSnapshot;

export type ConfirmedIntegrationResponse = BffConfirmedIntegration;

export const getConfirmedIntegration = async (
  targetSourceId: number,
  options?: { signal?: AbortSignal },
): Promise<ConfirmedIntegrationResponse> =>
  extractConfirmedIntegration(
    await fetchInfraJson<ConfirmedIntegrationResponsePayload>(
      `${CONFIRM_BASE}/${targetSourceId}/confirmed-integration`,
      options?.signal ? { signal: options.signal } : undefined,
    ),
  );

export type ApprovedIntegrationExcludedResourceItem = ExcludedResourceInfoDto;

export interface ApprovedIntegrationResponse {
  approved_integration: {
    id: string;
    request_id: string;
    approved_at: string;
    approved_by: string | null;
    resource_infos: ApprovedIntegrationResourceItem[];
    excluded_resource_ids: string[];
    excluded_resource_infos: ApprovedIntegrationExcludedResourceItem[];
    exclusion_reason?: string;
  } | null;
}

export const getApprovedIntegration = async (
  targetSourceId: number,
  options?: { signal?: AbortSignal },
): Promise<ApprovedIntegrationResponse> => {
  const payload = normalizeApprovedIntegration(
    await fetchInfraJson<unknown>(
      `${CONFIRM_BASE}/${targetSourceId}/approved-integration`,
      options?.signal ? { signal: options.signal } : undefined,
    ),
  );

  const excludedResourceInfos = payload.excluded_resource_infos ?? [];

  return {
    approved_integration: {
      id: String(payload.id ?? ''),
      request_id: String(payload.request_id ?? ''),
      approved_at: payload.approved_at ?? '',
      approved_by: payload.approved_by?.user_id ?? null,
      resource_infos: payload.resource_infos.map(toApprovedIntegrationResourceSnapshot),
      excluded_resource_ids: excludedResourceInfos
        .map((item) => item.resource_id)
        .filter((resourceId): resourceId is string => typeof resourceId === 'string' && resourceId.length > 0),
      excluded_resource_infos: excludedResourceInfos,
      exclusion_reason: excludedResourceInfos
        .map((item) => item.exclusion_reason)
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
      status?: ApprovalRequestStatus;
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
  // Route normalizes the flat Spring Page → camel ApprovalHistoryPage
  // (ADR-019 D1 boundary). Public shape below stays legacy for admin consumers;
  // `input_data` is no longer carried by the contract (swagger Page.content is
  // untyped) so it is left empty (was already `[]`).
  const payload = await fetchInfraJson<ApprovalHistoryPage>(
    `${CONFIRM_BASE}/${targetSourceId}/approval-history?page=${page}&size=${size}`,
  );

  return {
    content: payload.content.map((item) => ({
      request: {
        id: String(item.request.id || ''),
        requested_at: item.request.requestedAt,
        requested_by: item.request.requestedBy?.userId ?? '',
        status: item.request.status,
        resource_total_count: item.request.resourceTotalCount,
        resource_selected_count: item.request.resourceSelectedCount,
        input_data: {
          resource_inputs: [],
        },
      },
      ...(item.result
        ? {
            result: {
              id: String(item.result.requestId || item.request.id || ''),
              request_id: String(item.result.requestId || item.request.id || ''),
              result: item.result.status,
              processed_at: item.result.processedAt,
              process_info: {
                user_id: item.result.processedBy?.userId ?? null,
                reason: item.result.reason || null,
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
  // Route returns camel ApprovalActionResponse (ADR-019 D1 boundary).
  const payload = await fetchInfraJson<ApprovalActionResponse>(
    `${CONFIRM_BASE}/${targetSourceId}/approval-requests/approve`,
    { method: 'POST', body: { comment } },
  );

  return {
    success: true,
    result: payload.status,
    processed_at: payload.processedAt,
  };
};

export const rejectApprovalRequestV1 = async (
  targetSourceId: number,
  reason: string
): Promise<{ success: boolean; result: string; processed_at: string; reason: string }> => {
  // Route returns camel ApprovalActionResponse (ADR-019 D1 boundary).
  const payload = await fetchInfraJson<ApprovalActionResponse>(
    `${CONFIRM_BASE}/${targetSourceId}/approval-requests/reject`,
    { method: 'POST', body: { reason } },
  );

  return {
    success: true,
    result: payload.status,
    processed_at: payload.processedAt,
    reason: payload.reason || reason,
  };
};

// === Approval Request Latest (swagger ApprovalRequestLatestDto, camel @ boundary) ===

// Public alias kept for existing Step2 consumers; the route now returns the
// camel ApprovalRequestLatest domain shape (request/resources/result).
export type ApprovalRequestLatestResponse = ApprovalRequestLatest;

export const getApprovalRequestLatest = async (
  targetSourceId: number,
  options?: { signal?: AbortSignal },
): Promise<ApprovalRequestLatestResponse> =>
  fetchInfraJson<ApprovalRequestLatestResponse>(
    `${CONFIRM_BASE}/${targetSourceId}/approval-requests/latest`,
    options?.signal ? { signal: options.signal } : undefined,
  );

export const cancelApprovalRequest = async (
  targetSourceId: number
): Promise<{ success: boolean }> => {
  // Route returns camel ApprovalActionResponse; callers only need success.
  await fetchInfraJson<ApprovalActionResponse>(
    `${CONFIRM_BASE}/${targetSourceId}/approval-requests/cancel`,
    { method: 'POST' },
  );
  return {
    success: true,
  };
};

// 연동 불가 판정 (swagger approval-unavailable, #7) — body { reason } required.
export const markApprovalRequestUnavailable = async (
  targetSourceId: number,
  reason: string,
): Promise<ApprovalUnavailableResponse> =>
  fetchInfraJson<ApprovalUnavailableResponse>(
    `${CONFIRM_BASE}/${targetSourceId}/approval-unavailable`,
    { method: 'POST', body: { reason } },
  );

// 연동 불가 담당자 확인 (swagger approval-unavailable/confirm, #8) — no body.
export const confirmApprovalUnavailable = async (
  targetSourceId: number,
): Promise<ApprovalUnavailableConfirmResponse> =>
  fetchInfraJson<ApprovalUnavailableConfirmResponse>(
    `${CONFIRM_BASE}/${targetSourceId}/approval-unavailable/confirm`,
    { method: 'POST' },
  );

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
  normalizeProcessStatusResponse(
    await fetchInfraJson<unknown>(`${CONFIRM_BASE}/${targetSourceId}/process-status`),
  );

// ===== Connection Test API (Async) =====

export const getSecrets = async (targetSourceId: number): Promise<SecretKey[]> =>
  fetchInfraCamelJson<SecretKey[]>(`${CONFIRM_BASE}/${targetSourceId}/secrets`);

// Test Connection (Step 5/6) — ADR-019 zod-codegen. Routes validate with
// schemas.X.parse(raw); these CSR funcs return the generated wire type (snake).
// Field access at the call site is snake_case; use adapters for join/reshape/compute.

// 비동기 연결 테스트 트리거 — 202 Accepted, no request body, optional collectorImageTag
export const triggerTestConnection = async (
  targetSourceId: number,
  collectorImageTag?: string,
): Promise<TestConnectionTriggerResult> => {
  const query = collectorImageTag
    ? `?${new URLSearchParams({ collectorImageTag }).toString()}`
    : '';
  return fetchInfraJson<TestConnectionTriggerResult>(
    `${CONFIRM_BASE}/${targetSourceId}/test-connection/async${query}`,
    { method: 'POST' },
  );
};

// 최근 연결 테스트 결과 (polling용) — 404 if none
export const getTestConnectionLatest = async (
  targetSourceId: number,
): Promise<TestConnectionVersionResult> =>
  fetchInfraJson<TestConnectionVersionResult>(
    `${CONFIRM_BASE}/${targetSourceId}/test-connection/latest_version`,
  );

// 최신 성공 run 의 resource/agent 별 논리 DB 요약
export const getLatestTestConnectionResultSummaries = async (
  targetSourceId: number,
  options?: { signal?: AbortSignal },
): Promise<TestConnectionLatestResultSummary[]> =>
  fetchInfraJson<TestConnectionLatestResultSummary[]>(
    `${CONFIRM_BASE}/${targetSourceId}/test-connection/latest-results`,
    options?.signal ? { signal: options.signal } : undefined,
  );

// 완료 상태 (Step 5 배지 + 완료 승인 요청 버튼 게이트)
export const getTestConnectionCompletionStatus = async (
  targetSourceId: number,
): Promise<TestConnectionCompletionStatus> =>
  fetchInfraJson<TestConnectionCompletionStatus>(
    `${CONFIRM_BASE}/${targetSourceId}/test-connection/completion-status`,
  );

// 완료 확인 설정/롤백 — confirmed:true(완료 승인) / false(연결 테스트 재실행)
export const updateTestConnectionConfirmation = async (
  targetSourceId: number,
  confirmed: boolean,
): Promise<TestConnectionConfirmationResult> =>
  fetchInfraJson<TestConnectionConfirmationResult>(
    `${CONFIRM_BASE}/${targetSourceId}/test-connection-acknowledgment`,
    { method: 'PUT', body: { confirmed } },
  );

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
export * from '@/app/lib/api/azure';

// ===== AWS API =====
export * from '@/app/lib/api/aws';

// ===== GCP API =====
export * from '@/app/lib/api/gcp';

// ===== Scan API =====
export * from '@/app/lib/api/scan';

// ===== Admin Dashboard API =====
export * from '@/app/lib/api/dashboard';
