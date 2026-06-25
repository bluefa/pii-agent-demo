import {
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
import {
  extractTargetSource,
  normalizeTargetSourceProcessStatus,
  type TargetSourceDetailResponse,
} from '@/lib/target-source-response';
import type { TargetSourceCloudType } from '@/lib/target-source-creation';
// Re-export TargetSourceCloudType so consumers keep importing from one place.
export type { TargetSourceCloudType };
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
// Re-export approval wire types (zod-codegen, snake) so consumers import from one place.
export type ApprovalRequestSummaryDto = z.infer<typeof schemas.ApprovalRequestSummaryDto>;
export type ApprovalActionResponseDto = z.infer<typeof schemas.ApprovalActionResponseDto>;
export type ApprovalRequestLatestDto = z.infer<typeof schemas.ApprovalRequestLatestDto>;
export type ApprovalUnavailableResponseDto = z.infer<typeof schemas.ApprovalUnavailableResponseDto>;
export type ApprovalUnavailableConfirmResponseDto = z.infer<typeof schemas.ApprovalUnavailableConfirmResponseDto>;
export type ApprovalRequestLatestResponse = z.infer<typeof schemas.ApprovalRequestLatestDto>;


// Re-export USER/services wire types (zod-codegen, snake) so consumers import
// from one place. Field access is snake_case; use adapters for join/reshape/compute.
export type UserMeResponse = z.infer<typeof schemas.UserMeResponse>;
export type PageServiceItem = z.infer<typeof schemas.PageServiceItem>;
export type UserSearchResponse = z.infer<typeof schemas.UserSearchResponse>;
export type AuthorizedUsersResponse = z.infer<typeof schemas.AuthorizedUsersResponse>;
export type TargetSourceCreationCandidateResponse = z.infer<typeof schemas.TargetSourceCreationCandidateResponse>;
export type TargetSourceDetail = z.infer<typeof schemas.TargetSourceDetail>;
export type TargetSourceInfoWire = z.infer<typeof schemas.TargetSourceInfo>;

export const getCurrentUser = (): Promise<UserMeResponse> =>
  fetchInfraJson<UserMeResponse>('/user/me');

export const getServicesPage = (
  page = 0,
  size = 10,
  query?: string,
  options?: { signal?: AbortSignal },
): Promise<PageServiceItem> => {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (query) params.set('query', query);
  return fetchInfraJson<PageServiceItem>(
    `/user/services/page?${params}`,
    options?.signal ? { signal: options.signal } : undefined,
  );
};

const parseTargetSourceId = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value);
  return null;
};

// Adapter: TargetSourceDetail (snake wire) → ProjectSummary (camel view).
// Computes derived fields (connectionTestComplete, fallback codes) not present
// in the wire contract — genuine join/reshape justifies the adapter (§1.3).
const toProjectSummary = (item: TargetSourceDetail): ProjectSummary | null => {
  const targetSourceId = parseTargetSourceId(item.target_source_id);
  if (targetSourceId === null) return null;

  const processStatus = normalizeTargetSourceProcessStatus(item.process_status);
  const fallbackCode = `TS-${targetSourceId}`;

  return {
    id: fallbackCode,
    targetSourceId,
    projectCode: item.service_code ?? fallbackCode,
    processStatus,
    cloudProvider: normalizeCloudProvider(item.cloud_provider),
    resourceCount: 0,
    hasDisconnected: false,
    hasNew: false,
    description: item.description ?? '',
    isRejected: false,
    connectionTestComplete: processStatus >= ProcessStatus.CONNECTION_VERIFIED,
  };
};

export const getProjects = async (serviceCode: string): Promise<ProjectSummary[]> => {
  const payload = await fetchInfraJson<TargetSourceDetail[]>(
    `/services/${serviceCode}/target-sources`,
  );
  const items = Array.isArray(payload) ? payload : [];
  return items
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
 * (request casing is snake, D3 — no camel intermediate) and returns the snake wire
 * candidate array (zod-codegen). Field access is snake_case on the caller side.
 */
export const getCreationCandidates = async (
  serviceCode: string,
  input: CreationCandidatesInput,
): Promise<TargetSourceCreationCandidateResponse[]> => {
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
  return fetchInfraJson<TargetSourceCreationCandidateResponse[]>(
    `/services/${serviceCode}/creation-candidates`,
    { method: 'POST', body },
  );
};

/**
 * POST createTargetSource (36). The selected snake candidate is posted back verbatim
 * (request authored snake, D3). Returns the created `TargetSourceInfo` (snake wire).
 */
export const createTargetSource = async (
  serviceCode: string,
  candidate: TargetSourceCreationCandidateResponse,
): Promise<TargetSourceInfoWire> =>
  fetchInfraJson<TargetSourceInfoWire>(`/services/${serviceCode}/target-sources`, {
    method: 'POST',
    body: candidate,
  });

export const getPermissions = (serviceCode: string): Promise<AuthorizedUsersResponse> =>
  fetchInfraJson<AuthorizedUsersResponse>(`/services/${serviceCode}/authorized-users`);

export const getProject = async (targetSourceId: number): Promise<TargetSource> => {
  const data = await fetchInfraCamelJson<TargetSourceDetailResponse>(
    `/target-sources/${targetSourceId}`,
  );
  return extractTargetSource(data);
};

export const searchUsers = (
  query: string,
  excludeIds: string[] = [],
): Promise<UserSearchResponse> => {
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  excludeIds.forEach((excludeId) => params.append('excludeIds', excludeId));
  const queryString = params.toString();
  return fetchInfraJson<UserSearchResponse>(
    queryString ? `/users/search?${queryString}` : '/users/search',
  );
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
): Promise<ApprovalRequestSummaryDto> =>
  fetchInfraJson<ApprovalRequestSummaryDto>(
    `${CONFIRM_BASE}/${targetSourceId}/approval-requests`,
    { method: 'POST', body: input },
  );

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

export const getApprovalHistory = async (
  targetSourceId: number,
  page = 0,
  size = 10,
): Promise<z.infer<typeof schemas.Page>> =>
  fetchInfraJson<z.infer<typeof schemas.Page>>(
    `${CONFIRM_BASE}/${targetSourceId}/approval-history?page=${page}&size=${size}`,
  );

export const approveApprovalRequestV1 = async (
  targetSourceId: number,
  comment?: string,
): Promise<ApprovalActionResponseDto> =>
  fetchInfraJson<ApprovalActionResponseDto>(
    `${CONFIRM_BASE}/${targetSourceId}/approval-requests/approve`,
    { method: 'POST', body: { comment } },
  );

export const rejectApprovalRequestV1 = async (
  targetSourceId: number,
  reason: string,
): Promise<ApprovalActionResponseDto> =>
  fetchInfraJson<ApprovalActionResponseDto>(
    `${CONFIRM_BASE}/${targetSourceId}/approval-requests/reject`,
    { method: 'POST', body: { reason } },
  );

export const getApprovalRequestLatest = async (
  targetSourceId: number,
  options?: { signal?: AbortSignal },
): Promise<ApprovalRequestLatestDto> =>
  fetchInfraJson<ApprovalRequestLatestDto>(
    `${CONFIRM_BASE}/${targetSourceId}/approval-requests/latest`,
    options?.signal ? { signal: options.signal } : undefined,
  );

export const cancelApprovalRequest = async (
  targetSourceId: number,
): Promise<{ success: boolean }> => {
  await fetchInfraJson<ApprovalActionResponseDto>(
    `${CONFIRM_BASE}/${targetSourceId}/approval-requests/cancel`,
    { method: 'POST' },
  );
  return { success: true };
};

// 연동 불가 판정 (swagger approval-unavailable, #7) — body { reason } required.
export const markApprovalRequestUnavailable = async (
  targetSourceId: number,
  reason: string,
): Promise<ApprovalUnavailableResponseDto> =>
  fetchInfraJson<ApprovalUnavailableResponseDto>(
    `${CONFIRM_BASE}/${targetSourceId}/approval-unavailable`,
    { method: 'POST', body: { reason } },
  );

// 연동 불가 담당자 확인 (swagger approval-unavailable/confirm, #8) — no body.
export const confirmApprovalUnavailable = async (
  targetSourceId: number,
): Promise<ApprovalUnavailableConfirmResponseDto> =>
  fetchInfraJson<ApprovalUnavailableConfirmResponseDto>(
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
