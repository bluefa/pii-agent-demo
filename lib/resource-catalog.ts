import type {
  BffConfirmedIntegration,
  ConfirmResourceMetadata,
  DatabaseType,
  IntegrationCategory,
  Resource,
  ResourceSnapshot,
  VmDatabaseConfig,
  VmDatabaseType,
} from '@/lib/types';

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

const toVmDatabaseConfigFromConfirmed = (
  info: BffConfirmedIntegration['resource_infos'][number],
): VmDatabaseConfig | undefined => {
  if (!VM_RESOURCE_TYPES.has(info.resource_type)) return undefined;
  if (!info.database_type || !isVmDatabaseType(info.database_type) || info.port === null) {
    return undefined;
  }
  return {
    databaseType: info.database_type,
    port: info.port,
    ...(info.host !== null ? { host: info.host } : {}),
    ...(info.oracle_service_id ? { oracleServiceId: info.oracle_service_id } : {}),
    ...(info.network_interface_id ? { selectedNicId: info.network_interface_id } : {}),
  };
};

export const catalogToResources = (
  catalog: readonly CatalogItem[],
): Resource[] =>
  catalog.map((item) => ({
    id: item.id,
    type: item.resourceType,
    resourceId: item.resourceId,
    connectionStatus: 'PENDING',
    isSelected: false,
    databaseType: item.databaseType,
    integrationCategory: item.integrationCategory,
    vmDatabaseConfig: toVmDatabaseConfigFromCatalog(item),
  }));

export const confirmedIntegrationToResources = (
  confirmedIntegration: BffConfirmedIntegration,
): Resource[] =>
  confirmedIntegration.resource_infos.map((info) => ({
    id: info.resource_id,
    type: info.resource_type,
    resourceId: info.resource_id,
    connectionStatus: 'CONNECTED',
    isSelected: true,
    databaseType: (info.database_type ?? 'MYSQL') as DatabaseType,
    integrationCategory: 'TARGET',
    selectedCredentialId: info.credential_id ?? undefined,
    vmDatabaseConfig: toVmDatabaseConfigFromConfirmed(info),
  }));

// approved-integration snapshot 은 endpoint_config 를 중첩 구조로 실음 —
// confirmed-integration 의 flat 필드와 shape 이 달라 별도 converter 를 유지한다.
export const approvedIntegrationToResources = (
  items: readonly ResourceSnapshot[],
): Resource[] =>
  items.map((item) => {
    const endpoint = item.endpoint_config;
    const databaseType: DatabaseType = (endpoint?.db_type ?? 'MYSQL') as DatabaseType;
    const isAzureVm =
      item.resource_type === 'AZURE_VM'
      && endpoint
      && isVmDatabaseType(databaseType);
    return {
      id: item.resource_id,
      resourceId: item.resource_id,
      type: item.resource_type,
      databaseType,
      connectionStatus: 'CONNECTED',
      isSelected: true,
      integrationCategory: 'TARGET',
      selectedCredentialId: item.credential_id ?? undefined,
      vmDatabaseConfig: isAzureVm && endpoint
        ? {
            databaseType: endpoint.db_type,
            port: endpoint.port,
            ...(endpoint.host ? { host: endpoint.host } : {}),
            ...(endpoint.oracleServiceId ? { oracleServiceId: endpoint.oracleServiceId } : {}),
            ...(endpoint.selectedNicId ? { selectedNicId: endpoint.selectedNicId } : {}),
          }
        : undefined,
    };
  });
