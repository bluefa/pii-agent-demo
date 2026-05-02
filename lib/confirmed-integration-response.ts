import type {
  BffConfirmedIntegration,
  ConfirmedIntegrationResourceInfo,
  DatabaseType,
  ResourceSnapshot,
} from '@/lib/types';

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

/**
 * The runtime endpoint snapshot arrives in snake_case (ADR-014 boundary), but
 * `EndpointConfigInputData` (lib/types.ts) is declared camelCase because it
 * doubles as the frontend form-input shape. Splitting that type is a separate
 * refactor; until then, read the post-boundary snake_case fields through a
 * narrow type guard rather than scattering `Record` casts at call sites.
 */
const readSnakeString = (
  source: unknown,
  key: string,
): string | null => {
  if (source === null || typeof source !== 'object') return null;
  const value = (source as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : null;
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
      oracle_service_id: readSnakeString(endpointConfig, 'oracle_service_id'),
      network_interface_id: readSnakeString(endpointConfig, 'selected_nic_id'),
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
  const integration = 'confirmed_integration' in payload ? payload.confirmed_integration : payload;
  if (!integration) return createEmptyConfirmedIntegration();

  return normalizeConfirmedIntegration(integration);
};
