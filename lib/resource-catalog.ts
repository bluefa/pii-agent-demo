import {
  needsCredential,
  normalizeResourceType,
  type BffConfirmedIntegration,
  type ConfirmResourceMetadata,
  type DatabaseType,
  type IntegrationCategory,
  type RecommendFailReason,
  type ResourceScanStatus,
  type VmDatabaseConfig,
} from '@/lib/types';
import { vmDatabaseTypeByValue } from '@/lib/constants/vm-database';
import { isRdsCluster, type RdsInstanceCandidate } from '@/lib/rds-instances';
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
  rdsInstanceCandidates: RdsInstanceCandidate[];
  selectedRdsInstanceResourceId: string | null;
  metadata: ConfirmResourceMetadata;
}

const VM_RESOURCE_TYPES: ReadonlySet<string> = new Set(['AZURE_VM', 'EC2']);

// The contract spells a VM `AWS_EC2_INSTANCE` / `AZURE_VIRTUAL_MACHINE`; the set above holds
// the internal names those normalize to.
const isVmResourceType = (resourceType: string): boolean =>
  VM_RESOURCE_TYPES.has(normalizeResourceType(resourceType) ?? '');

const toVmDatabaseConfigFromCatalog = (
  item: CatalogItem,
): VmDatabaseConfig | undefined => {
  if (!isVmResourceType(item.resourceType)) return undefined;
  // The wire sends the engine lowercase; the endpoint form's catalog keys off UPPERCASE.
  // Reading the same catalog the form offers means an engine it can submit is one it restores.
  const databaseType = vmDatabaseTypeByValue(item.databaseType.toUpperCase())?.value;
  if (!databaseType || item.port === null) return undefined;
  return {
    databaseType,
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
  if (isVmResourceType(item.resourceType)) return 'endpoint';
  // A cluster the backend sent no instance list for stays a flat row — there is nothing
  // to choose between, so it must not grow a radio group (old data keeps working).
  if (isRdsCluster(item.resourceType) && item.rdsInstanceCandidates.length > 0) return 'rdsInstance';
  if (needsCredential(item.databaseType)) return 'credential';
  return 'default';
};

export const catalogToCandidates = (
  catalog: readonly CatalogItem[],
): CandidateResource[] =>
  catalog.map((item) => {
    const endpointConfig = toEndpointConfigDraft(item);
    // The TYPE decides, not the presence of the array — same gate as `pickBehaviorKey` above
    // and as `readRdsInstanceMetadata` on the approval surfaces. A sibling type that also
    // ships members must not reach the candidate (and from there the payload) carrying the
    // cluster fields, which `CandidateResource` documents as cluster-only.
    const isCluster = isRdsCluster(item.resourceType);
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
      ...(isCluster && item.rdsInstanceCandidates.length > 0
        ? { rdsInstanceCandidates: item.rdsInstanceCandidates }
        : {}),
      ...(isCluster && item.selectedRdsInstanceResourceId
        ? { selectedRdsInstanceResourceId: item.selectedRdsInstanceResourceId }
        : {}),
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
