import {
  needsCredential,
  type BffConfirmedIntegration,
  type ConfirmResourceMetadata,
  type DatabaseType,
  type IntegrationCategory,
  type RecommendFailReason,
  type ResourceScanStatus,
  type VmDatabaseConfig,
  type VmDatabaseType,
} from '@/lib/types';
import { isRdsCluster, type RdsInstanceWire } from '@/lib/rds-instances';
import type {
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
  selected: boolean;
  exclusionReason: string | null;
  recommendFailReason: RecommendFailReason | null;
  host: string | null;
  port: number | null;
  oracleServiceId: string | null;
  networkInterfaceId: string | null;
  ipConfigurationName: string | null;
  scanStatus: ResourceScanStatus | null;
  rdsInstanceList: RdsInstanceWire[];
  selectedRdsInstanceArn: string | null;
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
  // A cluster the backend sent no instance list for stays a flat row — there is nothing
  // to choose between, so it must not grow a radio group (old data keeps working).
  if (isRdsCluster(item.resourceType) && item.rdsInstanceList.length > 0) return 'rdsInstance';
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
      resourceName: item.name,
      type: item.resourceType,
      databaseType: item.databaseType,
      integrationCategory: item.integrationCategory,
      behaviorKey: pickBehaviorKey(item),
      selected: item.selected,
      exclusionReason: item.exclusionReason,
      recommendFailReason: item.recommendFailReason,
      ...(endpointConfig ? { endpointConfig } : {}),
      ...(item.rdsInstanceList.length > 0 ? { rdsInstanceList: item.rdsInstanceList } : {}),
      ...(item.selectedRdsInstanceArn ? { selectedRdsInstanceArn: item.selectedRdsInstanceArn } : {}),
      ...(item.scanStatus ? { scanStatus: item.scanStatus } : {}),
      metadata: item.metadata,
    };
  });

export const confirmedIntegrationToConfirmed = (
  confirmedIntegration: BffConfirmedIntegration,
): ConfirmedResource[] =>
  confirmedIntegration.resource_infos.map((info) => ({
    resourceId: info.resource_id,
    type: info.resource_type,
    databaseType: info.database_type,
    region: info.database_region,
    resourceName: info.resource_name,
    host: info.host,
    port: info.port,
    oracleServiceId: info.oracle_service_id,
    networkInterfaceId: info.network_interface_id,
    ipConfigurationName: info.ip_configuration,
    credentialId: info.credential_id,
    athenaRegionResourceId: info.athena_region_resource_id ?? null,
    connectionStatus: 'CONNECTED',
  }));
