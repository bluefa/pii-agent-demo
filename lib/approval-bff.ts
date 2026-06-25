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

/** Private shape returned by toResourceConfigDto — used only by toApprovalRequestResourceInput. */
type ResourceConfigDtoLocal = {
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
  idc_host_format?: 'IP' | 'HOST';
  idc_ips?: string[];
  idc_host?: string;
  idc_source_ips?: string[];
};

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

const toScanStatus = (value: unknown): ResourceScanStatus | undefined => {
  if (value === 'UNCHANGED' || value === 'NEW_SCAN') return value;
  return undefined;
};

const toIntegrationStatus = (value: unknown): ResourceIntegrationStatus | undefined => {
  if (value === 'INTEGRATED' || value === 'NOT_INTEGRATED') return value;
  return undefined;
};

const getLegacyApprovalInput = (value: unknown): JsonRecord | null => {
  if (!isRecord(value)) return null;
  if (Array.isArray(value.resource_inputs)) return value;
  return isRecord(value.input_data) ? value.input_data : null;
};

const toIdcHostFormat = (value: unknown): 'IP' | 'HOST' | undefined => {
  if (value === 'IP' || value === 'HOST') return value;
  return undefined;
};

const toStringArray = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const result = value.filter((v): v is string => typeof v === 'string');
  return result.length > 0 ? result : undefined;
};

const toResourceConfigDto = (value: unknown): ResourceConfigDtoLocal => {
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
  const idcHostFormat = toIdcHostFormat(value.idc_host_format);
  const idcIps = toStringArray(value.idc_ips);
  const idcHost = toStringOrUndefined(value.idc_host);
  const idcSourceIps = toStringArray(value.idc_source_ips);

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
    ...(idcHostFormat ? { idc_host_format: idcHostFormat } : {}),
    ...(idcIps ? { idc_ips: idcIps } : {}),
    ...(idcHost ? { idc_host: idcHost } : {}),
    ...(idcSourceIps ? { idc_source_ips: idcSourceIps } : {}),
  };
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

