import { camelCaseKeys } from '@/lib/object-case';
import type {
  CloudProvider,
  ConfirmResourceMetadata,
  DatabaseType,
  IntegrationCategory,
} from '@/lib/types';
import {
  normalizeCloudProvider,
  normalizeResourceType,
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
  id?: string;
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
  metadata?: unknown;
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
  ATHENA: 'ATHENA',
  AZURE_COSMOS_NOSQL: 'COSMOSDB',
  AZURE_MARIADB: 'MYSQL',
  AZURE_MSSQL: 'MSSQL',
  AZURE_MYSQL: 'MYSQL',
  AZURE_POSTGRESQL: 'POSTGRESQL',
  AZURE_SYNAPSE: 'MSSQL',
  AZURE_VM: 'MYSQL',
  BIGQUERY: 'BIGQUERY',
  CLOUD_SQL: 'MYSQL',
  DOCUMENTDB: 'MONGODB',
  DYNAMODB: 'DYNAMODB',
  EC2: 'MYSQL',
  IDC: 'MYSQL',
  RDS: 'MYSQL',
  RDS_CLUSTER: 'MYSQL',
  REDSHIFT: 'REDSHIFT',
};

const AWS_RESOURCE_TYPES = new Set([
  'ATHENA',
  'DOCUMENTDB',
  'DYNAMODB',
  'EC2',
  'RDS',
  'RDS_CLUSTER',
  'REDSHIFT',
]);

const GCP_RESOURCE_TYPES = new Set([
  'BIGQUERY',
  'CLOUD_SQL',
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const readString = (record: Record<string, unknown>, key: string): string | undefined =>
  typeof record[key] === 'string' ? record[key] as string : undefined;

const readNumber = (record: Record<string, unknown>, key: string): number | undefined =>
  typeof record[key] === 'number' ? record[key] as number : undefined;

const normalizeIntegrationCategory = (value: unknown): IntegrationCategory => {
  switch (value) {
    case 'NO_INSTALL_NEEDED':
    case 'INSTALL_INELIGIBLE':
      return value;
    case 'TARGET':
    default:
      return 'TARGET';
  }
};

const inferProviderFromResourceType = (resourceType: string): CloudProvider => {
  if (resourceType.startsWith('AZURE_')) return 'Azure';
  if (resourceType.startsWith('AWS_') || AWS_RESOURCE_TYPES.has(resourceType)) return 'AWS';
  if (resourceType.startsWith('GCP_') || GCP_RESOURCE_TYPES.has(resourceType)) return 'GCP';
  return 'AWS';
};

const normalizeMetadata = (
  metadata: unknown,
  resourceType: string,
): ConfirmResourceMetadata => {
  const camelMetadata = camelCaseKeys(metadata);
  const record = isRecord(camelMetadata) ? camelMetadata : {};
  const rawResourceType = readString(record, 'resourceType') ?? resourceType;
  const normalizedResourceType = normalizeResourceType(rawResourceType) ?? rawResourceType;
  const provider = readString(record, 'provider')
    ? normalizeCloudProvider(readString(record, 'provider'))
    : inferProviderFromResourceType(normalizedResourceType);

  return {
    provider,
    resourceType: normalizedResourceType,
    rawResourceType,
    ...(readString(record, 'region') ? { region: readString(record, 'region') } : {}),
    ...(readString(record, 'vpcId') ? { vpcId: readString(record, 'vpcId') } : {}),
    ...(readString(record, 'projectId') ? { projectId: readString(record, 'projectId') } : {}),
    ...(readString(record, 'subscriptionId') ? { subscriptionId: readString(record, 'subscriptionId') } : {}),
    ...(readString(record, 'resourceGroup') ? { resourceGroup: readString(record, 'resourceGroup') } : {}),
    ...(readString(record, 'serverName') ? { serverName: readString(record, 'serverName') } : {}),
    ...(readString(record, 'host') ? { host: readString(record, 'host') } : {}),
    ...(readNumber(record, 'port') !== undefined ? { port: readNumber(record, 'port') } : {}),
    ...(readString(record, 'accountName') ? { accountName: readString(record, 'accountName') } : {}),
    ...(readString(record, 'endpoint') ? { endpoint: readString(record, 'endpoint') } : {}),
    ...(readString(record, 'workspaceName') ? { workspaceName: readString(record, 'workspaceName') } : {}),
    ...(readString(record, 'vmName') ? { vmName: readString(record, 'vmName') } : {}),
    ...(readString(record, 'hostName') ? { hostName: readString(record, 'hostName') } : {}),
    ...(readString(record, 'privateIp') ? { privateIp: readString(record, 'privateIp') } : {}),
  };
};

const normalizeResourceCatalogItem = (
  resource: LegacyResourceCatalogItem,
): ResourceCatalogItemResponse => {
  const resourceRecord = resource as Record<string, unknown>;
  const camelMetadata = camelCaseKeys(resource.metadata);
  const metadataRecord = isRecord(camelMetadata)
    ? camelMetadata as Record<string, unknown>
    : null;
  const rawResourceType = resource.resource_type
    ?? resource.resourceType
    ?? (metadataRecord ? readString(metadataRecord, 'resourceType') : undefined)
    ?? 'UNKNOWN';
  const resourceType = normalizeResourceType(rawResourceType) ?? rawResourceType;
  const resourceId = resource.resource_id
    ?? resource.resourceId
    ?? resource.name
    ?? resource.id
    ?? resourceType;

  return {
    id: resourceId,
    resource_id: resourceId,
    name: resource.name ?? resourceId,
    resource_type: resourceType,
    database_type:
      resource.database_type
      ?? resource.databaseType
      ?? DATABASE_TYPE_BY_RESOURCE_TYPE[resourceType]
      ?? 'MYSQL',
    integration_category: normalizeIntegrationCategory(
      resource.integration_category ?? resource.integrationCategory,
    ),
    host: readString(resourceRecord, 'host') ?? null,
    port: readNumber(resourceRecord, 'port') ?? null,
    oracle_service_id:
      resource.oracle_service_id
      ?? resource.oracleServiceId
      ?? null,
    network_interface_id:
      resource.network_interface_id
      ?? resource.networkInterfaceId
      ?? null,
    ip_configuration_name:
      resource.ip_configuration_name
      ?? resource.ipConfigurationName
      ?? null,
    metadata: normalizeMetadata(resource.metadata, resourceType),
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
