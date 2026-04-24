import type {
  BffConfirmedIntegration,
  ConfirmResourceMetadata,
  DatabaseType,
  IntegrationCategory,
  Resource,
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

export interface CatalogSelectionOverlay {
  selectedIds: ReadonlySet<string>;
  vmConfigsByResourceId?: ReadonlyMap<string, VmDatabaseConfig>;
  credentialsByResourceId?: ReadonlyMap<string, string>;
}

export const catalogItemToResource = (
  item: CatalogItem,
  overlay?: CatalogSelectionOverlay,
): Resource => {
  const isSelected = overlay?.selectedIds.has(item.resourceId) ?? false;
  return {
    id: item.id,
    type: item.resourceType,
    resourceId: item.resourceId,
    connectionStatus: isSelected ? 'CONNECTED' : 'PENDING',
    isSelected,
    databaseType: item.databaseType,
    integrationCategory: item.integrationCategory,
    selectedCredentialId: overlay?.credentialsByResourceId?.get(item.resourceId),
    vmDatabaseConfig:
      overlay?.vmConfigsByResourceId?.get(item.resourceId)
      ?? toVmDatabaseConfigFromCatalog(item),
  };
};

export const catalogToResources = (
  catalog: readonly CatalogItem[],
  overlay?: CatalogSelectionOverlay,
): Resource[] => catalog.map((item) => catalogItemToResource(item, overlay));

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
