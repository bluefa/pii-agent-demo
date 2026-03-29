import type {
  BffConfirmedIntegration,
  ConfirmedIntegrationResourceInfo,
  DatabaseType,
  ResourceSnapshot,
} from '@/lib/types';

interface LegacyConfirmedIntegration {
  resource_infos: ResourceSnapshot[];
}

interface Issue222ConfirmedIntegrationResourceInfo extends Omit<ConfirmedIntegrationResourceInfo, 'ip_configuration_name'> {
  ip_configuration?: string | null;
}

export interface ConfirmedIntegrationEnvelopeResponse {
  confirmed_integration: BffConfirmedIntegration | LegacyConfirmedIntegration | null;
}

export type ConfirmedIntegrationResponsePayload =
  | BffConfirmedIntegration
  | { resource_infos: Issue222ConfirmedIntegrationResourceInfo[] }
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
  resourceInfo: ConfirmedIntegrationResourceInfo | Issue222ConfirmedIntegrationResourceInfo | ResourceSnapshot,
): resourceInfo is ResourceSnapshot => 'endpoint_config' in resourceInfo;

const normalizeConfirmedResourceInfo = (
  resourceInfo: ConfirmedIntegrationResourceInfo | Issue222ConfirmedIntegrationResourceInfo | ResourceSnapshot,
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
      oracle_service_id: endpointConfig?.oracleServiceId ?? null,
      network_interface_id: endpointConfig?.selectedNicId ?? null,
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
  integration: BffConfirmedIntegration | LegacyConfirmedIntegration | { resource_infos: Issue222ConfirmedIntegrationResourceInfo[] },
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
