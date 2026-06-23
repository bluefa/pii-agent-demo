import { extractConfirmedIntegration, type ConfirmedIntegrationResponsePayload } from '@/lib/confirmed-integration-response';
import type {
  EndpointConfigInputData,
  ResourceScanStatus,
  ResourceIntegrationStatus,
} from '@/lib/types';

type JsonRecord = Record<string, unknown>;

export type ApprovalRequestResourceInput =
  | {
      resource_id: string;
      selected: true;
      resource_input?: {
        credential_id?: string;
        endpoint_config?: EndpointConfigInputData;
        resource_id?: string;
        database_type?: string;
        port?: number;
        host?: string;
        oracle_service_id?: string;
        network_interface_id?: string;
      };
    }
  | { resource_id: string; selected: false; exclusion_reason?: string };

export interface ApprovalRequestCreateBody {
  resource_inputs: ApprovalRequestResourceInput[];
  exclusion_reason_default?: string;
}

export type BffApprovalProcessStatus =
  | 'IDLE'
  | 'PENDING'
  | 'CONFIRMING'
  | 'CONFIRMED'
  | 'INSTALLED'
  | 'CONNECTED'
  | 'COMPLETED';

export type ApprovalHealthStatus = 'UNKNOWN' | 'HEALTHY' | 'UNHEALTHY' | 'DEGRADED';

export interface ApprovalActorDto {
  user_id?: string;
}

export interface ResourceConfigDto {
  resource_id?: string;
  resource_type?: string;
  database_type?: string;
  port?: number;
  host?: string;
  oracle_service_id?: string;
  network_interface_id?: string;
  ip_configuration?: string;
  credential_id?: string;
  database_region?: string | null;
  resource_name?: string | null;
  scan_status?: ResourceScanStatus | null;
  integration_status?: ResourceIntegrationStatus | null;
}

export interface ExcludedResourceInfoDto {
  resource_id?: string;
  exclusion_reason?: string;
  resource_name?: string | null;
  database_type?: string | null;
  database_region?: string | null;
  scan_status?: ResourceScanStatus | null;
  integration_status?: ResourceIntegrationStatus | null;
}

export interface ApprovedIntegrationResponseDto {
  id?: number;
  request_id?: number;
  approved_at?: string;
  approved_by?: ApprovalActorDto;
  resource_infos: ResourceConfigDto[];
  excluded_resource_infos?: ExcludedResourceInfoDto[];
}

export interface ConfirmedIntegrationApprovalResponse {
  resource_infos: ResourceConfigDto[];
}

export interface ProcessStatusResponseDto {
  target_source_id: number;
  process_status: BffApprovalProcessStatus;
  healthy: ApprovalHealthStatus;
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

const toActorDto = (value: unknown): ApprovalActorDto | undefined => {
  if (typeof value === 'string' && value.length > 0) {
    return { user_id: value };
  }

  if (!isRecord(value)) return undefined;

  const userId = toStringOrUndefined(value.user_id) ?? toStringOrUndefined(value.id);
  return userId ? { user_id: userId } : undefined;
};

const toScanStatus = (value: unknown): ResourceScanStatus | undefined => {
  if (value === 'UNCHANGED' || value === 'NEW_SCAN') return value;
  return undefined;
};

const toIntegrationStatus = (value: unknown): ResourceIntegrationStatus | undefined => {
  if (value === 'INTEGRATED' || value === 'NOT_INTEGRATED') return value;
  return undefined;
};

const mapProcessStatus = (value: unknown): BffApprovalProcessStatus | undefined => {
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

const mapHealthStatus = (value: unknown): ApprovalHealthStatus => {
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

const toResourceConfigDto = (value: unknown): ResourceConfigDto => {
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
  const databaseRegion = toStringOrUndefined(value.database_region);
  const resourceName = toStringOrUndefined(value.resource_name);
  const scanStatus = toScanStatus(value.scan_status);
  const integrationStatus = toIntegrationStatus(value.integration_status);

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
    ...(databaseRegion ? { database_region: databaseRegion } : {}),
    ...(resourceName ? { resource_name: resourceName } : {}),
    ...(scanStatus ? { scan_status: scanStatus } : {}),
    ...(integrationStatus ? { integration_status: integrationStatus } : {}),
  };
};

// ADR-019 E5/D-4: swagger ApprovedIntegrationResponseDto carries `resources`
// (TargetSourceResourceItemDto), not the legacy `resource_infos` (ResourceConfigDto).
// The item's connection fields live under `metadata.*`; the top level only has
// resource_id / resource_name / resource_type / integration_category / exclusion_reason.
// Dual-read snake (mock path, no camelCaseKeys) + camel (real path, get camelizes).
const SWAGGER_EXCLUDED_CATEGORIES = new Set(['NO_INSTALL_NEEDED', 'INSTALL_INELIGIBLE']);

const toResourceConfigFromItem = (value: unknown): ResourceConfigDto => {
  if (!isRecord(value)) return {};

  const metadata = isRecord(value.metadata) ? value.metadata : {};
  const resourceId = toStringOrUndefined(value.resource_id) ?? toStringOrUndefined(value.resourceId);
  const resourceType = toStringOrUndefined(value.resource_type) ?? toStringOrUndefined(value.resourceType);
  const resourceName = toStringOrUndefined(value.resource_name) ?? toStringOrUndefined(value.resourceName);
  const databaseType =
    toStringOrUndefined(metadata.database_type) ?? toStringOrUndefined(metadata.databaseType);
  const port = toNumberOrUndefined(metadata.port);
  const host = toStringOrUndefined(metadata.host);
  const oracleServiceId =
    toStringOrUndefined(metadata.oracle_service_id) ?? toStringOrUndefined(metadata.oracleServiceId);
  const networkInterfaceId =
    toStringOrUndefined(metadata.network_interface_id) ?? toStringOrUndefined(metadata.networkInterfaceId);
  const ipConfiguration =
    toStringOrUndefined(metadata.ip_configuration) ?? toStringOrUndefined(metadata.ipConfiguration);
  const credentialId =
    toStringOrUndefined(metadata.credential_id) ?? toStringOrUndefined(metadata.credentialId);
  const databaseRegion = toStringOrUndefined(metadata.region);

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
    ...(databaseRegion ? { database_region: databaseRegion } : {}),
    ...(resourceName ? { resource_name: resourceName } : {}),
  };
};

const toExcludedInfoFromItem = (value: unknown): ExcludedResourceInfoDto => {
  const record = isRecord(value) ? value : {};
  const metadata = isRecord(record.metadata) ? record.metadata : {};
  const resourceId = toStringOrUndefined(record.resource_id) ?? toStringOrUndefined(record.resourceId);
  const exclusionReason =
    toStringOrUndefined(record.exclusion_reason) ?? toStringOrUndefined(record.exclusionReason);
  const resourceName = toStringOrUndefined(record.resource_name) ?? toStringOrUndefined(record.resourceName);
  const databaseType =
    toStringOrUndefined(metadata.database_type) ?? toStringOrUndefined(metadata.databaseType);
  const databaseRegion = toStringOrUndefined(metadata.region);

  return {
    ...(resourceId ? { resource_id: resourceId } : {}),
    ...(exclusionReason ? { exclusion_reason: exclusionReason } : {}),
    ...(resourceName ? { resource_name: resourceName } : {}),
    ...(databaseType ? { database_type: databaseType } : {}),
    ...(databaseRegion ? { database_region: databaseRegion } : {}),
  };
};

const toExcludedResourceInfos = (value: unknown): ExcludedResourceInfoDto[] | undefined => {
  if (!isRecord(value)) return undefined;

  const excludedResourceInfos = Array.isArray(value.excluded_resource_infos)
    ? value.excluded_resource_infos
        .filter(isRecord)
        .map((item): ExcludedResourceInfoDto => {
          const resourceId = toStringOrUndefined(item.resource_id);
          const exclusionReason = toStringOrUndefined(item.exclusion_reason);
          const resourceName = toStringOrUndefined(item.resource_name);
          const databaseType = toStringOrUndefined(item.database_type);
          const databaseRegion = toStringOrUndefined(item.database_region);
          const scanStatus = toScanStatus(item.scan_status);
          const integrationStatus = toIntegrationStatus(item.integration_status);
          return {
            ...(resourceId ? { resource_id: resourceId } : {}),
            ...(exclusionReason ? { exclusion_reason: exclusionReason } : {}),
            ...(resourceName ? { resource_name: resourceName } : {}),
            ...(databaseType ? { database_type: databaseType } : {}),
            ...(databaseRegion ? { database_region: databaseRegion } : {}),
            ...(scanStatus ? { scan_status: scanStatus } : {}),
            ...(integrationStatus ? { integration_status: integrationStatus } : {}),
          };
        })
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

const toApprovalRequestResourceInput = (item: JsonRecord): ApprovalRequestResourceInput | null => {
  const resourceId = toStringOrUndefined(item.resource_id);
  if (!resourceId) return null;

  if (toBoolean(item.selected)) {
    const legacyResourceInput = isRecord(item.resource_input) ? item.resource_input : null;
    const normalized = legacyResourceInput ? toResourceConfigDto(legacyResourceInput) : null;
    type SelectedResourceInput = Extract<ApprovalRequestResourceInput, { selected: true }>['resource_input'];
    const resourceInput: SelectedResourceInput = normalized
      ? {
          resource_id: resourceId,
          ...(normalized.credential_id ? { credential_id: normalized.credential_id } : {}),
          ...(normalized.database_type ? { database_type: normalized.database_type } : {}),
          ...(normalized.port !== undefined ? { port: normalized.port } : {}),
          ...(normalized.host ? { host: normalized.host } : {}),
          ...(normalized.oracle_service_id ? { oracle_service_id: normalized.oracle_service_id } : {}),
          ...(normalized.network_interface_id ? { network_interface_id: normalized.network_interface_id } : {}),
        }
      : undefined;

    return {
      resource_id: resourceId,
      selected: true,
      ...(resourceInput && Object.keys(resourceInput).length > 1 ? { resource_input: resourceInput } : {}),
    };
  }

  const exclusionReason = toStringOrUndefined(item.exclusion_reason);
  return {
    resource_id: resourceId,
    selected: false,
    ...(exclusionReason ? { exclusion_reason: exclusionReason } : {}),
  };
};

export const normalizeApprovalRequestBody = (body: unknown): ApprovalRequestCreateBody => {
  const input = getLegacyApprovalInput(body);
  const resourceInputs = Array.isArray(input?.resource_inputs)
    ? input.resource_inputs
        .filter(isRecord)
        .map(toApprovalRequestResourceInput)
        .filter((item): item is ApprovalRequestResourceInput => item !== null)
    : [];

  const exclusionReasonDefault = toStringOrUndefined(input?.exclusion_reason_default);

  return {
    resource_inputs: resourceInputs,
    ...(exclusionReasonDefault ? { exclusion_reason_default: exclusionReasonDefault } : {}),
  };
};

export const normalizeApprovedIntegration = (
  value: unknown,
): ApprovedIntegrationResponseDto => {
  // Legacy mock still wraps in `approved_integration`; swagger is flat (D-10).
  const payload = isRecord(value) && isRecord(value.approved_integration) ? value.approved_integration : value;
  const record = isRecord(payload) ? payload : {};
  const id = toNumberOrUndefined(record.id);
  const requestId = toNumberOrUndefined(record.request_id) ?? toNumberOrUndefined(record.requestId);
  const approvedAt = toStringOrUndefined(record.approved_at) ?? toStringOrUndefined(record.approvedAt);
  const approvedBy = toActorDto(record.approved_by ?? record.approvedBy);

  // ADR-019 E5/D-4: swagger key is `resources` (TargetSourceResourceItemDto).
  // Split selected/excluded by per-item `integration_category`; connection fields
  // are mapped from `metadata.*`. Legacy `resource_infos` + top-level
  // `excluded_resource_infos`/`excluded_resource_ids` remain a fallback (D6).
  const resources = Array.isArray(record.resources) ? record.resources : null;
  if (resources) {
    const selected: ResourceConfigDto[] = [];
    const excluded: ExcludedResourceInfoDto[] = [];
    for (const item of resources) {
      const category =
        (isRecord(item) &&
          (toStringOrUndefined(item.integration_category) ??
            toStringOrUndefined(item.integrationCategory))) ||
        undefined;
      if (category && SWAGGER_EXCLUDED_CATEGORIES.has(category)) {
        excluded.push(toExcludedInfoFromItem(item));
      } else {
        selected.push(toResourceConfigFromItem(item));
      }
    }
    return {
      ...(id !== undefined ? { id } : {}),
      ...(requestId !== undefined ? { request_id: requestId } : {}),
      ...(approvedAt ? { approved_at: approvedAt } : {}),
      ...(approvedBy ? { approved_by: approvedBy } : {}),
      resource_infos: selected,
      ...(excluded.length > 0 ? { excluded_resource_infos: excluded } : {}),
    };
  }

  const resourceInfos = Array.isArray(record.resource_infos)
    ? record.resource_infos.map(toResourceConfigDto)
    : [];
  const excludedResourceInfos = toExcludedResourceInfos(record);

  return {
    ...(id !== undefined ? { id } : {}),
    ...(requestId !== undefined ? { request_id: requestId } : {}),
    ...(approvedAt ? { approved_at: approvedAt } : {}),
    ...(approvedBy ? { approved_by: approvedBy } : {}),
    resource_infos: resourceInfos,
    ...(excludedResourceInfos ? { excluded_resource_infos: excludedResourceInfos } : {}),
  };
};

export const normalizeConfirmedIntegration = (
  value: unknown,
): ConfirmedIntegrationApprovalResponse => {
  const confirmedIntegration = extractConfirmedIntegration(value as ConfirmedIntegrationResponsePayload);

  return {
    resource_infos: confirmedIntegration.resource_infos.map((resource) => ({
      resource_id: resource.resource_id,
      resource_type: resource.resource_type,
      ...(resource.database_type ? { database_type: resource.database_type } : {}),
      ...(resource.database_region ? { database_region: resource.database_region } : {}),
      ...(resource.resource_name ? { resource_name: resource.resource_name } : {}),
      ...(resource.port !== null ? { port: resource.port } : {}),
      ...(resource.host !== null ? { host: resource.host } : {}),
      ...(resource.oracle_service_id ? { oracle_service_id: resource.oracle_service_id } : {}),
      ...(resource.network_interface_id ? { network_interface_id: resource.network_interface_id } : {}),
      ...(resource.ip_configuration_name ? { ip_configuration: resource.ip_configuration_name } : {}),
      ...(resource.credential_id ? { credential_id: resource.credential_id } : {}),
    })),
  };
};

export const normalizeProcessStatusResponse = (
  value: unknown,
  fallback: Partial<ProcessStatusResponseDto> = {},
): ProcessStatusResponseDto => {
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
