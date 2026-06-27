import {
  ProjectSummary,
  CloudProvider,
  TargetSource,
  ProcessStatus,
  DatabaseType,
  IntegrationCategory,
  BffConfirmedIntegration,
  ConfirmedIntegrationResourceInfo,
  ConfirmResourceMetadata,
  ResourceScanStatus,
  ResourceIntegrationStatus,
  ResourceSnapshot,
  normalizeCloudProvider,
} from '@/lib/types';
import type { SecretKey } from '@/lib/types';
import { fetchInfraJson } from '@/app/lib/api/infra';
import type { TargetSourceCloudType } from '@/lib/target-source-creation';
// Re-export TargetSourceCloudType so consumers keep importing from one place.
export type { TargetSourceCloudType };
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

// Maps BFF process_status strings to internal ProcessStatus enum.
const normalizeTargetSourceProcessStatus = (value: unknown): ProcessStatus => {
  switch (String(value).trim().toUpperCase()) {
    case 'WAITING_APPROVAL':
    case 'PENDING':
      return ProcessStatus.WAITING_APPROVAL;
    case 'APPLYING_APPROVED':
    case 'CONFIRMING':
      return ProcessStatus.APPLYING_APPROVED;
    case 'CONFIRMED':
      return ProcessStatus.INSTALLING;
    case 'INSTALLED':
      return ProcessStatus.WAITING_CONNECTION_TEST;
    case 'CONNECTED':
      return ProcessStatus.CONNECTION_VERIFIED;
    case 'TARGET_CONFIRMED':
    case 'COMPLETED':
      return ProcessStatus.INSTALLATION_COMPLETE;
    case 'REQUEST_REQUIRED':
    case 'IDLE':
    default:
      return ProcessStatus.WAITING_TARGET_CONFIRMATION;
  }
};

// Adapter: TargetSourceDetail (snake wire, .passthrough()) → TargetSource (camel domain model).
// Reads snake fields, computes derived values (processStatus, fallback codes).
const toTargetSource = (raw: TargetSourceDetail): TargetSource => {
  // .passthrough() means extra fields exist at runtime but are typed `unknown`.
  const item = raw as Record<string, unknown>;
  const asStr = (v: unknown): string | undefined => typeof v === 'string' ? v : undefined;

  const id = typeof item.target_source_id === 'number' ? item.target_source_id : 0;
  const fallbackCode = `TS-${id}`;
  const serviceCode = asStr(item.service_code)?.trim() ?? '';
  const processStatus = normalizeTargetSourceProcessStatus(asStr(item.process_status));
  const metadata = (typeof item.metadata === 'object' && item.metadata !== null)
    ? item.metadata as Record<string, unknown>
    : null;

  const tenantId = asStr(metadata?.tenant_id);
  const subscriptionId = asStr(metadata?.subscription_id);
  const awsAccountId = asStr(metadata?.aws_account_id);
  const gcpProjectId = asStr(metadata?.gcp_project_id);
  const awsInstallationModeRaw = asStr(item.aws_installation_mode);
  const awsInstallationMode =
    awsInstallationModeRaw === 'AUTO' || awsInstallationModeRaw === 'MANUAL'
      ? awsInstallationModeRaw
      : undefined;
  const createdAt = asStr(item.created_at) ?? new Date().toISOString();

  return {
    id: fallbackCode,
    targetSourceId: id,
    projectCode: serviceCode || fallbackCode,
    serviceCode,
    serviceName: asStr(item.service_name)?.trim() || serviceCode,
    processStatus,
    cloudProvider: normalizeCloudProvider(asStr(item.cloud_provider)),
    createdAt,
    updatedAt: asStr(item.updated_at) ?? createdAt,
    name: fallbackCode,
    description: asStr(item.description) ?? '',
    isRejected: false,
    ...(tenantId ? { tenantId } : {}),
    ...(subscriptionId ? { subscriptionId } : {}),
    ...(awsAccountId ? { awsAccountId } : {}),
    ...(gcpProjectId ? { gcpProjectId } : {}),
    ...(awsInstallationMode ? { awsInstallationMode } : {}),
  };
};

export const getProject = async (targetSourceId: number): Promise<TargetSource> => {
  const data = await fetchInfraJson<TargetSourceDetail>(
    `/target-sources/${targetSourceId}`,
  );
  return toTargetSource(data);
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

// Adapter helpers: snake TargetSourceResourceMetadataDto → camel ConfirmResourceMetadata.
const inferProvider = (resourceType: string): CloudProvider => {
  if (resourceType.startsWith('AZURE_')) return 'Azure';
  if (resourceType.startsWith('GCP_')) return 'GCP';
  return 'AWS';
};

const normalizeIntegrationCategory = (value: unknown): IntegrationCategory => {
  if (value === 'NO_INSTALL_NEEDED' || value === 'INSTALL_INELIGIBLE') return value;
  return 'TARGET';
};

const normalizeCandidateScanStatus = (value: unknown): ResourceScanStatus | null => {
  if (value === 'NEW_SCAN' || value === 'UNCHANGED') return value;
  return null;
};

const toConfirmResourceMetadata = (
  meta: Record<string, unknown>,
  resourceType: string,
): ConfirmResourceMetadata => {
  const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
  const num = (v: unknown) => (typeof v === 'number' ? v : undefined);
  const provider = str(meta.provider)
    ? normalizeCloudProvider(str(meta.provider))
    : inferProvider(resourceType);
  return {
    provider,
    resourceType: str(meta.resource_type) ?? resourceType,
    rawResourceType: str(meta.resource_type) ?? resourceType,
    ...(str(meta.region) ? { region: str(meta.region) } : {}),
    ...(str(meta.vpc_id) ? { vpcId: str(meta.vpc_id) } : {}),
    ...(str(meta.project_id) ? { projectId: str(meta.project_id) } : {}),
    ...(str(meta.subscription_id) ? { subscriptionId: str(meta.subscription_id) } : {}),
    ...(str(meta.resource_group) ? { resourceGroup: str(meta.resource_group) } : {}),
    ...(str(meta.server_name) ? { serverName: str(meta.server_name) } : {}),
    ...(str(meta.host) ? { host: str(meta.host) } : {}),
    ...(num(meta.port) !== undefined ? { port: num(meta.port) } : {}),
  };
};

// Adapter: snake TargetSourceResourceItemDto → camel ConfirmResourceItem.
const toConfirmResourceItem = (item: Record<string, unknown>): ConfirmResourceItem => {
  const meta = (typeof item.metadata === 'object' && item.metadata !== null)
    ? item.metadata as Record<string, unknown>
    : {};
  const resourceId = (item.resource_id as string | undefined) ?? '';
  const resourceType = (item.resource_type as string | undefined) ?? 'UNKNOWN';
  const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
  const num = (v: unknown) => (typeof v === 'number' ? v : undefined);

  return {
    id: resourceId,
    resourceId,
    name: str(item.resource_name) ?? resourceId,
    resourceType,
    databaseType: (str(item.database_type) as DatabaseType | undefined) ?? 'MYSQL',
    integrationCategory: normalizeIntegrationCategory(item.integration_category),
    host: str(meta.host) ?? null,
    port: num(meta.port) ?? null,
    oracleServiceId: str(meta.oracle_service_id) ?? null,
    networkInterfaceId: str(meta.network_interface_id) ?? null,
    ipConfigurationName: null,
    scanStatus: normalizeCandidateScanStatus(item.scan_status),
    metadata: toConfirmResourceMetadata(meta, resourceType),
  };
};

export const getConfirmResources = async (
  targetSourceId: number,
  options?: { signal?: AbortSignal },
): Promise<ConfirmResourcesResponse> => {
  const raw = await fetchInfraJson<z.infer<typeof schemas.CloudResourceResponse>>(
    `${CONFIRM_BASE}/${targetSourceId}/resources`,
    options?.signal ? { signal: options.signal } : undefined,
  );
  const items = Array.isArray(raw.resources) ? raw.resources as Record<string, unknown>[] : [];
  return {
    resources: items.map(toConfirmResourceItem),
    totalCount: typeof raw.total_count === 'number' ? raw.total_count : items.length,
  };
};

export const createApprovalRequest = async (
  targetSourceId: number,
  input: z.infer<typeof schemas.ApprovalRequestInputDto>,
): Promise<ApprovalRequestSummaryDto> =>
  fetchInfraJson<ApprovalRequestSummaryDto>(
    `${CONFIRM_BASE}/${targetSourceId}/approval-requests`,
    { method: 'POST', body: input },
  );

export type ConfirmedIntegrationResourceItem = ConfirmedIntegrationResourceInfo;
export type ApprovedIntegrationResourceItem = ResourceSnapshot;

// ADR-019: route emits snake ConfirmedIntegrationResponse; pass through.
// BffConfirmedIntegration.resource_infos is structurally compatible (both snake).
export type ConfirmedIntegrationResponse = BffConfirmedIntegration;

export const getConfirmedIntegration = async (
  targetSourceId: number,
  options?: { signal?: AbortSignal },
): Promise<ConfirmedIntegrationResponse> =>
  fetchInfraJson<ConfirmedIntegrationResponse>(
    `${CONFIRM_BASE}/${targetSourceId}/confirmed-integration`,
    options?.signal ? { signal: options.signal } : undefined,
  );

// ADR-019: route emits flat ApprovedIntegrationResponseDto (snake, no envelope).
// Reshape to the UI shape: wrap in approved_integration, rename resources→resource_infos,
// excluded fields not in the new schema default to empty.
export type ApprovedIntegrationExcludedResourceItem = {
  resource_id?: string;
  exclusion_reason?: string;
  resource_name?: string | null;
  database_type?: string | null;
  database_region?: string | null;
  scan_status?: ResourceScanStatus | null;
  integration_status?: ResourceIntegrationStatus | null;
};

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
  const raw = await fetchInfraJson<z.infer<typeof schemas.ApprovedIntegrationResponseDto>>(
    `${CONFIRM_BASE}/${targetSourceId}/approved-integration`,
    options?.signal ? { signal: options.signal } : undefined,
  );

  return {
    approved_integration: {
      id: String(raw.id ?? ''),
      request_id: String(raw.request_id ?? ''),
      approved_at: raw.approved_at ?? '',
      approved_by: (raw.approved_by as { user_id?: string } | undefined)?.user_id ?? null,
      // ADR-019: split resources by selected field (selected !== false →연동 대상; selected === false → 비대상).
      ...((): {
        resource_infos: ApprovedIntegrationResourceItem[];
        excluded_resource_ids: string[];
        excluded_resource_infos: ApprovedIntegrationExcludedResourceItem[];
      } => {
        const items = Array.isArray(raw.resources) ? raw.resources : [];
        const excluded = items.filter((i) => i.selected === false);
        const selected = items.filter((i) => i.selected !== false);
        return {
          resource_infos: selected as unknown as ApprovedIntegrationResourceItem[],
          excluded_resource_ids: excluded.map((i) => i.resource_id).filter((id): id is string => !!id),
          excluded_resource_infos: excluded as unknown as ApprovedIntegrationExcludedResourceItem[],
        };
      })(),
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

// ADR-019: route emits snake ProcessStatusResponseDto; pass through directly.
export const getProcessStatus = async (
  targetSourceId: number,
): Promise<ProcessStatusResponse> =>
  fetchInfraJson<ProcessStatusResponse>(`${CONFIRM_BASE}/${targetSourceId}/process-status`);

// ===== Connection Test API (Async) =====

// ADR-019: route emits snake SecretResponse[]; adapter reshapes create_time_str → createTimeStr.
export const getSecrets = async (targetSourceId: number): Promise<SecretKey[]> => {
  const raw = await fetchInfraJson<z.infer<typeof schemas.SecretResponse>[]>(
    `${CONFIRM_BASE}/${targetSourceId}/secrets`,
  );
  return raw.map((s) => ({
    name: s.name ?? '',
    createTime: s.create_time ?? '',
    createTimeStr: s.create_time_str ?? '',
  }));
};

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
  targetSourceId: number,
): Promise<InstallationConfirmResult> =>
  fetchInfraJson<InstallationConfirmResult>(
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
