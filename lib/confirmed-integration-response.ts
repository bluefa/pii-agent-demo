import type {
  BffConfirmedIntegration,
  ConfirmedIntegrationResourceInfo,
  DatabaseType,
  ResourceSnapshot,
} from '@/lib/types';
import { snakeCaseKeys } from '@/lib/object-case';

interface LegacyConfirmedIntegration {
  resource_infos: ResourceSnapshot[];
}

interface ConfirmedIntegrationResourceInfoPayload extends Omit<ConfirmedIntegrationResourceInfo, 'ip_configuration_name'> {
  ip_configuration?: string | null;
}

export interface ConfirmedIntegrationEnvelopeResponse {
  confirmed_integration: BffConfirmedIntegration | LegacyConfirmedIntegration | null;
}

export type ConfirmedIntegrationResponsePayload =
  | BffConfirmedIntegration
  | { resource_infos: ConfirmedIntegrationResourceInfoPayload[] }
  | LegacyConfirmedIntegration
  | ConfirmedIntegrationEnvelopeResponse;

const DATABASE_TYPE_BY_RESOURCE_TYPE: Partial<Record<string, DatabaseType>> = {
  RDS: 'MYSQL',
  RDS_CLUSTER: 'MYSQL',
  DOCUMENTDB: 'MONGODB',
  DYNAMODB: 'DYNAMODB',
  ATHENA: 'ATHENA',
  REDSHIFT: 'REDSHIFT',
  EC2: 'MYSQL',
  AZURE_MSSQL: 'MSSQL',
  AZURE_POSTGRESQL: 'POSTGRESQL',
  AZURE_MYSQL: 'MYSQL',
  AZURE_MARIADB: 'MYSQL',
  AZURE_COSMOS_NOSQL: 'COSMOSDB',
  AZURE_SYNAPSE: 'MSSQL',
  AZURE_VM: 'MYSQL',
  CLOUD_SQL: 'MYSQL',
  BIGQUERY: 'BIGQUERY',
  IDC: 'MYSQL',
};

const isLegacyConfirmedResourceInfo = (
  resourceInfo: ConfirmedIntegrationResourceInfo | ConfirmedIntegrationResourceInfoPayload | ResourceSnapshot,
): resourceInfo is ResourceSnapshot => 'endpoint_config' in resourceInfo;

const pickStringField = (
  source: unknown,
  ...keys: string[]
): string | null => {
  if (source === null || typeof source !== 'object') return null;
  const record = source as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string') return value;
  }
  return null;
};

const normalizeConfirmedResourceInfo = (
  resourceInfo: ConfirmedIntegrationResourceInfo | ConfirmedIntegrationResourceInfoPayload | ResourceSnapshot,
): ConfirmedIntegrationResourceInfo => {
  if (isLegacyConfirmedResourceInfo(resourceInfo)) {
    const endpointConfig = resourceInfo.endpoint_config;

    return {
      resource_id: resourceInfo.resource_id,
      resource_type: resourceInfo.resource_type,
      database_type:
        endpointConfig?.db_type ?? DATABASE_TYPE_BY_RESOURCE_TYPE[resourceInfo.resource_type] ?? null,
      port: endpointConfig?.port ?? null,
      host: endpointConfig?.host ?? null,
      oracle_service_id: pickStringField(endpointConfig, 'oracle_service_id', 'oracleServiceId'),
      network_interface_id: pickStringField(endpointConfig, 'selected_nic_id', 'selectedNicId'),
      ip_configuration_name: null,
      credential_id: resourceInfo.credential_id ?? null,
    };
  }

  return {
    resource_id: resourceInfo.resource_id,
    resource_type: resourceInfo.resource_type,
    database_type:
      resourceInfo.database_type ?? DATABASE_TYPE_BY_RESOURCE_TYPE[resourceInfo.resource_type] ?? null,
    port: resourceInfo.port ?? null,
    host: resourceInfo.host ?? null,
    oracle_service_id: resourceInfo.oracle_service_id ?? null,
    network_interface_id: resourceInfo.network_interface_id ?? null,
    ip_configuration_name:
      ('ip_configuration_name' in resourceInfo ? resourceInfo.ip_configuration_name : resourceInfo.ip_configuration) ?? null,
    credential_id: resourceInfo.credential_id ?? null,
  };
};

const normalizeConfirmedIntegration = (
  integration: BffConfirmedIntegration | LegacyConfirmedIntegration | { resource_infos: ConfirmedIntegrationResourceInfoPayload[] },
): BffConfirmedIntegration => ({
  resource_infos: integration.resource_infos.map(normalizeConfirmedResourceInfo),
});

export const createEmptyConfirmedIntegration = (): BffConfirmedIntegration => ({
  resource_infos: [],
});

export const extractConfirmedIntegration = (
  payload: ConfirmedIntegrationResponsePayload,
): BffConfirmedIntegration => {
  // Upstream BFF and httpBff GET (which camelCases) produce inputs in any
  // casing. Normalize to snake_case once so the extractor can rely on a
  // single shape regardless of input.
  const normalized = snakeCaseKeys(payload) as ConfirmedIntegrationResponsePayload;
  const integration = 'confirmed_integration' in normalized ? normalized.confirmed_integration : normalized;
  if (!integration) return createEmptyConfirmedIntegration();

  return normalizeConfirmedIntegration(integration);
};
