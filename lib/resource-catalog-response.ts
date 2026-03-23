import type {
  ConfirmResourceMetadata,
  DatabaseType,
  IntegrationCategory,
} from '@/lib/types';

export interface ResourceCatalogItemResponse {
  id: string;
  resource_id: string;
  name: string;
  resource_type: string;
  database_type: DatabaseType;
  integration_category: IntegrationCategory;
  host: string | null;
  port: number | null;
  oracle_service_id: string | null;
  network_interface_id: string | null;
  ip_configuration_name: string | null;
  metadata: ConfirmResourceMetadata;
}

export interface ResourceCatalogResponse {
  resources: ResourceCatalogItemResponse[];
  total_count: number;
}

interface LegacyResourceCatalogItem {
  id: string;
  resource_id?: string;
  resourceId?: string;
  name?: string;
  resource_type?: string;
  resourceType?: string;
  database_type?: DatabaseType | null;
  databaseType?: DatabaseType | null;
  integration_category?: IntegrationCategory;
  integrationCategory?: IntegrationCategory;
  host?: string | null;
  port?: number | null;
  oracle_service_id?: string | null;
  oracleServiceId?: string | null;
  network_interface_id?: string | null;
  networkInterfaceId?: string | null;
  ip_configuration_name?: string | null;
  ipConfigurationName?: string | null;
  selected_credential_id?: string | null;
  selectedCredentialId?: string | null;
  metadata: ConfirmResourceMetadata;
}

interface LegacyResourceCatalogResponse {
  resources: LegacyResourceCatalogItem[];
  total_count?: number;
  totalCount?: number;
  selectedCount?: number;
}

export type ResourceCatalogResponsePayload =
  | ResourceCatalogResponse
  | LegacyResourceCatalogResponse;

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

const normalizeResourceCatalogItem = (
  resource: LegacyResourceCatalogItem,
): ResourceCatalogItemResponse => {
  const resourceType = resource.resource_type ?? resource.resourceType ?? resource.metadata.resourceType;
  const resourceId = resource.resource_id ?? resource.resourceId ?? resource.name ?? resource.id;

  return {
    id: resource.id,
    resource_id: resourceId,
    name: resource.name ?? resourceId,
    resource_type: resourceType,
    database_type:
      resource.database_type
      ?? resource.databaseType
      ?? DATABASE_TYPE_BY_RESOURCE_TYPE[resourceType]
      ?? 'MYSQL',
    integration_category: resource.integration_category ?? resource.integrationCategory ?? 'TARGET',
    host: resource.host ?? null,
    port: resource.port ?? null,
    oracle_service_id: resource.oracle_service_id ?? resource.oracleServiceId ?? null,
    network_interface_id: resource.network_interface_id ?? resource.networkInterfaceId ?? null,
    ip_configuration_name: resource.ip_configuration_name ?? resource.ipConfigurationName ?? null,
    metadata: resource.metadata,
  };
};

export const extractResourceCatalog = (
  payload: ResourceCatalogResponsePayload,
): ResourceCatalogResponse => ({
  resources: payload.resources.map(normalizeResourceCatalogItem),
  total_count:
    payload.total_count
    ?? ('totalCount' in payload ? payload.totalCount : undefined)
    ?? payload.resources.length,
});
