import {
  needsCredential,
  type BffConfirmedIntegration,
  type ConfirmResourceMetadata,
  type DatabaseType,
  type IntegrationCategory,
  type ResourceSnapshot,
  type VmDatabaseConfig,
  type VmDatabaseType,
} from '@/lib/types';
import type {
  ApprovedResource,
  CandidateBehaviorKey,
  CandidateResource,
  ConfirmedResource,
  EndpointConfigDraft,
} from '@/lib/types/resources';

export const EMPTY_CONFIRMED_INTEGRATION: BffConfirmedIntegration = {
  resource_infos: [],
};

// `getConfirmResources` 응답의 단일 아이템.
// `app/lib/api` 의 `ConfirmResourceItem` 과 동일 shape 이지만, 레이어링 준수를 위해 재정의.
export interface CatalogItem {
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
  metadata: ConfirmResourceMetadata;
}

const VM_DATABASE_TYPES: readonly VmDatabaseType[] = [
  'MYSQL',
  'POSTGRESQL',
  'MSSQL',
  'MONGODB',
  'ORACLE',
];

const VM_RESOURCE_TYPES: ReadonlySet<string> = new Set(['AZURE_VM', 'EC2']);

const isVmDatabaseType = (databaseType: DatabaseType): databaseType is VmDatabaseType =>
  VM_DATABASE_TYPES.includes(databaseType as VmDatabaseType);

const toVmDatabaseConfigFromCatalog = (
  item: CatalogItem,
): VmDatabaseConfig | undefined => {
  if (!VM_RESOURCE_TYPES.has(item.resourceType)) return undefined;
  if (!isVmDatabaseType(item.databaseType) || item.port === null) return undefined;
  return {
    databaseType: item.databaseType,
    port: item.port,
    ...(item.host !== null ? { host: item.host } : {}),
    ...(item.oracleServiceId ? { oracleServiceId: item.oracleServiceId } : {}),
    ...(item.networkInterfaceId ? { selectedNicId: item.networkInterfaceId } : {}),
  };
};

// Transformers for each resource phase; the behavior registry owns candidate
// type-specific approval payload assembly so raw type strings stay out of the UI.

const toEndpointConfigDraft = (item: CatalogItem): EndpointConfigDraft | undefined =>
  toVmDatabaseConfigFromCatalog(item);

const pickBehaviorKey = (item: CatalogItem): CandidateBehaviorKey => {
  if (VM_RESOURCE_TYPES.has(item.resourceType)) return 'endpoint';
  if (needsCredential(item.databaseType)) return 'credential';
  return 'default';
};

export const catalogToCandidates = (
  catalog: readonly CatalogItem[],
): CandidateResource[] =>
  catalog.map((item) => {
    const endpointConfig = toEndpointConfigDraft(item);
    return {
      id: item.id,
      resourceId: item.resourceId,
      type: item.resourceType,
      databaseType: item.databaseType,
      integrationCategory: item.integrationCategory,
      behaviorKey: pickBehaviorKey(item),
      ...(endpointConfig ? { endpointConfig } : {}),
      metadata: item.metadata,
    };
  });

export const approvedIntegrationToApproved = (
  items: readonly ResourceSnapshot[],
): ApprovedResource[] =>
  items.map((item) => {
    const endpoint = item.endpoint_config;
    return {
      resourceId: item.resource_id,
      type: item.resource_type,
      databaseType: (endpoint?.db_type ?? null) as DatabaseType | null,
      endpointConfig: endpoint,
      credentialId: item.credential_id ?? null,
    };
  });

export const confirmedIntegrationToConfirmed = (
  confirmedIntegration: BffConfirmedIntegration,
): ConfirmedResource[] =>
  confirmedIntegration.resource_infos.map((info) => ({
    resourceId: info.resource_id,
    type: info.resource_type,
    databaseType: info.database_type,
    host: info.host,
    port: info.port,
    oracleServiceId: info.oracle_service_id,
    networkInterfaceId: info.network_interface_id,
    ipConfigurationName: info.ip_configuration_name,
    credentialId: info.credential_id,
    connectionStatus: 'CONNECTED',
  }));
