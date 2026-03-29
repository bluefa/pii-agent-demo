import { extractConfirmedIntegration, type ConfirmedIntegrationResponsePayload } from '@/lib/confirmed-integration-response';

type JsonRecord = Record<string, unknown>;

export type Issue222ApprovalStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'AUTO_APPROVED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'UNAVAILABLE'
  | 'CONFIRMED';

export type Issue222ProcessStatus =
  | 'IDLE'
  | 'PENDING'
  | 'CONFIRMING'
  | 'CONFIRMED'
  | 'INSTALLED'
  | 'CONNECTED'
  | 'COMPLETED';

export type Issue222HealthStatus = 'UNKNOWN' | 'HEALTHY' | 'UNHEALTHY' | 'DEGRADED';

export interface Issue222ActorDto {
  user_id?: string;
}

export interface Issue222ResourceConfigDto {
  resource_id?: string;
  resource_type?: string;
  database_type?: string;
  port?: number;
  host?: string;
  oracle_service_id?: string;
  network_interface_id?: string;
  ip_configuration?: string;
  credential_id?: string;
}

export interface Issue222ExcludedResourceInfo {
  resource_id?: string;
  exclusion_reason?: string;
}

export interface Issue222ApprovalRequestSummaryDto {
  id?: number;
  target_source_id?: number;
  status?: Issue222ApprovalStatus;
  requested_by?: Issue222ActorDto;
  requested_at?: string;
  resource_total_count?: number;
  resource_selected_count?: number;
}

export interface Issue222ApprovalActionResponseDto {
  request_id?: number;
  status?: Issue222ApprovalStatus;
  processed_by?: Issue222ActorDto;
  processed_at?: string;
  reason?: string;
}

export interface Issue222ApprovalHistoryItemDto {
  request: Issue222ApprovalRequestSummaryDto;
  result?: Issue222ApprovalActionResponseDto;
}

export interface Issue222ApprovalHistoryPageDto {
  totalPages: number;
  totalElements: number;
  pageable: {
    paged: boolean;
    pageNumber: number;
    pageSize: number;
    unpaged: boolean;
    offset: number;
    sort: [];
  };
  first: boolean;
  last: boolean;
  size: number;
  content: Issue222ApprovalHistoryItemDto[];
  number: number;
  sort: [];
  numberOfElements: number;
  empty: boolean;
}

export interface Issue222ApprovedIntegrationResponseDto {
  id?: number;
  request_id?: number;
  approved_at?: string;
  approved_by?: Issue222ActorDto;
  resource_infos: Issue222ResourceConfigDto[];
  excluded_resource_infos?: Issue222ExcludedResourceInfo[];
}

export interface Issue222ConfirmedIntegrationResponse {
  resource_infos: Issue222ResourceConfigDto[];
}

export interface Issue222ProcessStatusResponseDto {
  target_source_id: number;
  process_status: Issue222ProcessStatus;
  healthy: Issue222HealthStatus;
  evaluated_at: string;
}

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null;

const toStringOrUndefined = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined;

const toNumberOrUndefined = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const numeric = /^\d+$/.test(value) ? Number(value) : Number(value.match(/\d+/)?.[0] ?? Number.NaN);
    return Number.isFinite(numeric) ? numeric : undefined;
  }
  return undefined;
};

const toBoolean = (value: unknown): boolean => value === true;

const toActorDto = (value: unknown): Issue222ActorDto | undefined => {
  if (typeof value === 'string' && value.length > 0) {
    return { user_id: value };
  }

  if (!isRecord(value)) return undefined;

  const userId = toStringOrUndefined(value.user_id) ?? toStringOrUndefined(value.id);
  return userId ? { user_id: userId } : undefined;
};

const mapApprovalStatus = (value: unknown): Issue222ApprovalStatus | undefined => {
  switch (String(value).toUpperCase()) {
    case 'PENDING':
      return 'PENDING';
    case 'APPROVED':
      return 'APPROVED';
    case 'AUTO_APPROVED':
      return 'AUTO_APPROVED';
    case 'REJECTED':
      return 'REJECTED';
    case 'CANCELLED':
      return 'CANCELLED';
    case 'UNAVAILABLE':
      return 'UNAVAILABLE';
    case 'CONFIRMED':
    case 'COMPLETED':
      return 'CONFIRMED';
    default:
      return undefined;
  }
};

const mapProcessStatus = (value: unknown): Issue222ProcessStatus | undefined => {
  switch (String(value).toUpperCase()) {
    case 'IDLE':
    case 'REQUEST_REQUIRED':
      return 'IDLE';
    case 'PENDING':
    case 'WAITING_APPROVAL':
      return 'PENDING';
    case 'CONFIRMING':
    case 'APPLYING_APPROVED':
      return 'CONFIRMING';
    case 'CONFIRMED':
    case 'TARGET_CONFIRMED':
      return 'CONFIRMED';
    case 'INSTALLED':
      return 'INSTALLED';
    case 'CONNECTED':
      return 'CONNECTED';
    case 'COMPLETED':
      return 'COMPLETED';
    default:
      return undefined;
  }
};

const mapHealthStatus = (value: unknown): Issue222HealthStatus => {
  switch (String(value).toUpperCase()) {
    case 'HEALTHY':
      return 'HEALTHY';
    case 'UNHEALTHY':
      return 'UNHEALTHY';
    case 'DEGRADED':
      return 'DEGRADED';
    default:
      return 'UNKNOWN';
  }
};

const getLegacyApprovalInput = (value: unknown): JsonRecord | null => {
  if (!isRecord(value)) return null;
  if (Array.isArray(value.resource_inputs)) return value;
  return isRecord(value.input_data) ? value.input_data : null;
};

const countLegacyResourceInputs = (value: unknown): {
  total: number;
  selected: number;
} => {
  const input = getLegacyApprovalInput(value);
  const resourceInputs = Array.isArray(input?.resource_inputs) ? input.resource_inputs : [];
  const selected = resourceInputs.filter((item) => isRecord(item) && item.selected === true).length;

  return {
    total: resourceInputs.length,
    selected,
  };
};

const toIssue222ResourceConfigDto = (value: unknown): Issue222ResourceConfigDto => {
  if (!isRecord(value)) return {};

  const endpointConfig = isRecord(value.endpoint_config) ? value.endpoint_config : null;
  const resourceId = toStringOrUndefined(value.resource_id);
  const resourceType = toStringOrUndefined(value.resource_type);
  const databaseType = toStringOrUndefined(value.database_type) ?? toStringOrUndefined(endpointConfig?.db_type);
  const port = toNumberOrUndefined(value.port) ?? toNumberOrUndefined(endpointConfig?.port);
  const host = toStringOrUndefined(value.host) ?? toStringOrUndefined(endpointConfig?.host);
  const oracleServiceId =
    toStringOrUndefined(value.oracle_service_id) ?? toStringOrUndefined(endpointConfig?.oracleServiceId);
  const networkInterfaceId =
    toStringOrUndefined(value.network_interface_id) ?? toStringOrUndefined(endpointConfig?.selectedNicId);
  const ipConfiguration =
    toStringOrUndefined(value.ip_configuration) ?? toStringOrUndefined(value.ip_configuration_name);
  const credentialId = toStringOrUndefined(value.credential_id);

  return {
    ...(resourceId ? { resource_id: resourceId } : {}),
    ...(resourceType ? { resource_type: resourceType } : {}),
    ...(databaseType ? { database_type: databaseType } : {}),
    ...(port !== undefined ? { port } : {}),
    ...(host ? { host } : {}),
    ...(oracleServiceId ? { oracle_service_id: oracleServiceId } : {}),
    ...(networkInterfaceId ? { network_interface_id: networkInterfaceId } : {}),
    ...(ipConfiguration ? { ip_configuration: ipConfiguration } : {}),
    ...(credentialId ? { credential_id: credentialId } : {}),
  };
};

const toIssue222ExcludedResourceInfos = (value: unknown): Issue222ExcludedResourceInfo[] | undefined => {
  if (!isRecord(value)) return undefined;

  const excludedResourceInfos = Array.isArray(value.excluded_resource_infos)
    ? value.excluded_resource_infos
        .filter(isRecord)
        .map((item) => ({
          ...(toStringOrUndefined(item.resource_id) ? { resource_id: toStringOrUndefined(item.resource_id) } : {}),
          ...(toStringOrUndefined(item.exclusion_reason)
            ? { exclusion_reason: toStringOrUndefined(item.exclusion_reason) }
            : {}),
        }))
    : null;

  if (excludedResourceInfos && excludedResourceInfos.length > 0) return excludedResourceInfos;

  if (!Array.isArray(value.excluded_resource_ids)) return undefined;

  const exclusionReason = toStringOrUndefined(value.exclusion_reason);
  const fallbackInfos = value.excluded_resource_ids
    .map((item) => toStringOrUndefined(item))
    .filter((item): item is string => item !== undefined)
    .map((resourceId) => ({
      resource_id: resourceId,
      ...(exclusionReason ? { exclusion_reason: exclusionReason } : {}),
    }));

  return fallbackInfos.length > 0 ? fallbackInfos : undefined;
};

export const normalizeIssue222ApprovalRequestBody = (body: unknown): JsonRecord => {
  const input = getLegacyApprovalInput(body);
  const resourceInputs = Array.isArray(input?.resource_inputs)
    ? input.resource_inputs
        .filter(isRecord)
        .map((item) => {
          const resourceId = toStringOrUndefined(item.resource_id);
          const selected = toBoolean(item.selected);
          const legacyResourceInput = isRecord(item.resource_input) ? item.resource_input : null;
          const normalizedResourceInput = legacyResourceInput
            ? toIssue222ResourceConfigDto(legacyResourceInput)
            : null;
          const resourceInput = normalizedResourceInput
            ? {
                ...(resourceId ? { resource_id: resourceId } : {}),
                ...normalizedResourceInput,
              }
            : null;

          return {
            ...(resourceId ? { resource_id: resourceId } : {}),
            selected,
            ...(resourceInput && Object.values(resourceInput).some((fieldValue) => fieldValue !== undefined)
              ? {
                  resource_input: Object.fromEntries(
                    Object.entries(resourceInput).filter(([, fieldValue]) => fieldValue !== undefined),
                  ),
                }
              : {}),
            ...(toStringOrUndefined(item.exclusion_reason)
              ? { exclusion_reason: toStringOrUndefined(item.exclusion_reason) }
              : {}),
          };
        })
    : [];

  const exclusionReasonDefault = toStringOrUndefined(input?.exclusion_reason_default);

  return {
    resource_inputs: resourceInputs,
    ...(exclusionReasonDefault ? { exclusion_reason_default: exclusionReasonDefault } : {}),
  };
};

export const normalizeIssue222ApprovalRequestSummary = (
  value: unknown,
  options: {
    targetSourceId?: number;
    fallbackStatus?: Issue222ApprovalStatus;
    fallbackTotalCount?: number;
    fallbackSelectedCount?: number;
  } = {},
): Issue222ApprovalRequestSummaryDto => {
  const payload = isRecord(value) && isRecord(value.approval_request) ? value.approval_request : value;
  const record = isRecord(payload) ? payload : {};
  const counts = countLegacyResourceInputs(record);
  const id = toNumberOrUndefined(record.id);
  const targetSourceId = toNumberOrUndefined(record.target_source_id) ?? options.targetSourceId;
  const status = mapApprovalStatus(record.status) ?? options.fallbackStatus;
  const requestedBy = toActorDto(record.requested_by);
  const requestedAt = toStringOrUndefined(record.requested_at);
  const resourceTotalCount =
    toNumberOrUndefined(record.resource_total_count) ?? options.fallbackTotalCount ?? counts.total;
  const resourceSelectedCount =
    toNumberOrUndefined(record.resource_selected_count) ?? options.fallbackSelectedCount ?? counts.selected;

  return {
    ...(id !== undefined ? { id } : {}),
    ...(targetSourceId !== undefined ? { target_source_id: targetSourceId } : {}),
    ...(status ? { status } : {}),
    ...(requestedBy ? { requested_by: requestedBy } : {}),
    ...(requestedAt ? { requested_at: requestedAt } : {}),
    ...(resourceTotalCount > 0 ? { resource_total_count: resourceTotalCount } : {}),
    ...(resourceSelectedCount > 0 ? { resource_selected_count: resourceSelectedCount } : {}),
  };
};

export const normalizeIssue222ApprovalActionResponse = (
  value: unknown,
  options: {
    fallbackRequestId?: number;
    fallbackStatus?: Issue222ApprovalStatus;
  } = {},
): Issue222ApprovalActionResponseDto => {
  const record = isRecord(value) ? value : {};
  const processInfo = isRecord(record.process_info) ? record.process_info : null;
  const requestId = toNumberOrUndefined(record.request_id) ?? options.fallbackRequestId;
  const status = mapApprovalStatus(record.status) ?? mapApprovalStatus(record.result) ?? options.fallbackStatus;
  const processedBy = toActorDto(record.processed_by) ?? toActorDto(processInfo?.user_id);
  const processedAt = toStringOrUndefined(record.processed_at);
  const reason = toStringOrUndefined(record.reason) ?? toStringOrUndefined(processInfo?.reason);

  return {
    ...(requestId !== undefined ? { request_id: requestId } : {}),
    ...(status ? { status } : {}),
    ...(processedBy ? { processed_by: processedBy } : {}),
    ...(processedAt ? { processed_at: processedAt } : {}),
    ...(reason ? { reason } : {}),
  };
};

export const buildIssue222ApprovalHistoryPage = (
  content: Issue222ApprovalHistoryItemDto[],
  value: unknown,
): Issue222ApprovalHistoryPageDto => {
  const source = isRecord(value) ? value : {};
  const page = isRecord(source.page) ? source.page : source;
  const number = toNumberOrUndefined(page.number) ?? 0;
  const size = toNumberOrUndefined(page.size) ?? content.length;
  const totalElements = toNumberOrUndefined(page.totalElements) ?? toNumberOrUndefined(page.total_elements) ?? content.length;
  const totalPages = toNumberOrUndefined(page.totalPages) ?? toNumberOrUndefined(page.total_pages) ?? (size > 0 ? Math.ceil(totalElements / size) : 1);

  return {
    totalPages,
    totalElements,
    pageable: {
      paged: true,
      pageNumber: number,
      pageSize: size,
      unpaged: false,
      offset: number * size,
      sort: [],
    },
    first: number === 0,
    last: number >= Math.max(totalPages - 1, 0),
    size,
    content,
    number,
    sort: [],
    numberOfElements: content.length,
    empty: content.length === 0,
  };
};

export const normalizeIssue222ApprovalHistoryPage = (
  value: unknown,
  targetSourceId: number,
): Issue222ApprovalHistoryPageDto => {
  const record = isRecord(value) ? value : {};
  const rawContent = Array.isArray(record.content) ? record.content : [];
  const content = rawContent
    .filter(isRecord)
    .map((item) => {
      const result = isRecord(item.result)
        ? normalizeIssue222ApprovalActionResponse(item.result)
        : undefined;
      const request = normalizeIssue222ApprovalRequestSummary(item.request, {
        targetSourceId,
        fallbackStatus: result?.status ?? 'PENDING',
      });

      return {
        request,
        ...(result ? { result } : {}),
      };
    });

  return buildIssue222ApprovalHistoryPage(content, record);
};

export const normalizeIssue222ApprovedIntegration = (
  value: unknown,
): Issue222ApprovedIntegrationResponseDto => {
  const payload = isRecord(value) && isRecord(value.approved_integration) ? value.approved_integration : value;
  const record = isRecord(payload) ? payload : {};
  const resourceInfos = Array.isArray(record.resource_infos)
    ? record.resource_infos.map(toIssue222ResourceConfigDto)
    : [];
  const id = toNumberOrUndefined(record.id);
  const requestId = toNumberOrUndefined(record.request_id);
  const approvedAt = toStringOrUndefined(record.approved_at);
  const approvedBy = toActorDto(record.approved_by);
  const excludedResourceInfos = toIssue222ExcludedResourceInfos(record);

  return {
    ...(id !== undefined ? { id } : {}),
    ...(requestId !== undefined ? { request_id: requestId } : {}),
    ...(approvedAt ? { approved_at: approvedAt } : {}),
    ...(approvedBy ? { approved_by: approvedBy } : {}),
    resource_infos: resourceInfos,
    ...(excludedResourceInfos ? { excluded_resource_infos: excludedResourceInfos } : {}),
  };
};

export const normalizeIssue222ConfirmedIntegration = (
  value: unknown,
): Issue222ConfirmedIntegrationResponse => {
  const confirmedIntegration = extractConfirmedIntegration(value as ConfirmedIntegrationResponsePayload);

  return {
    resource_infos: confirmedIntegration.resource_infos.map((resource) => ({
      resource_id: resource.resource_id,
      resource_type: resource.resource_type,
      ...(resource.database_type ? { database_type: resource.database_type } : {}),
      ...(resource.port !== null ? { port: resource.port } : {}),
      ...(resource.host !== null ? { host: resource.host } : {}),
      ...(resource.oracle_service_id ? { oracle_service_id: resource.oracle_service_id } : {}),
      ...(resource.network_interface_id ? { network_interface_id: resource.network_interface_id } : {}),
      ...(resource.ip_configuration_name ? { ip_configuration: resource.ip_configuration_name } : {}),
      ...(resource.credential_id ? { credential_id: resource.credential_id } : {}),
    })),
  };
};

export const normalizeIssue222ProcessStatusResponse = (
  value: unknown,
  fallback: Partial<Issue222ProcessStatusResponseDto> = {},
): Issue222ProcessStatusResponseDto => {
  const record = isRecord(value) ? value : {};

  return {
    target_source_id:
      toNumberOrUndefined(record.target_source_id)
      ?? toNumberOrUndefined(record.targetSourceId)
      ?? fallback.target_source_id
      ?? 0,
    process_status: mapProcessStatus(record.process_status) ?? fallback.process_status ?? 'IDLE',
    healthy: mapHealthStatus(record.healthy ?? record.health),
    evaluated_at: toStringOrUndefined(record.evaluated_at) ?? fallback.evaluated_at ?? new Date().toISOString(),
  };
};
