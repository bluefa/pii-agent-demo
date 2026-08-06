import type { z } from 'zod';
import type { schemas } from '@/lib/generated/install-v1';
import type {
  CandidateBehaviorKey,
  CandidateDraftState,
  CandidateResource,
  CandidateResourceBehavior,
  EndpointConfigDraft,
} from '@/lib/types/resources';
import { toWireDatabaseType } from '@/lib/types';
import { defaultRdsInstanceArn } from '@/lib/rds-instances';

type MetadataFields = z.infer<typeof schemas.TargetSourceResourceMetadataDto>;

const resolveEndpoint = (
  resource: CandidateResource,
  draft: CandidateDraftState,
): EndpointConfigDraft | undefined =>
  draft.endpointDrafts[resource.id] ?? resource.endpointConfig;

const endpointMetadataFields = (endpoint: EndpointConfigDraft): MetadataFields => ({
  database_type: toWireDatabaseType(endpoint.databaseType),
  port: endpoint.port,
  ...(endpoint.host ? { host: endpoint.host } : {}),
  ...(endpoint.oracleServiceId ? { oracle_service_id: endpoint.oracleServiceId } : {}),
  ...(endpoint.selectedNicId ? { network_interface_id: endpoint.selectedNicId } : {}),
});

const defaultBehavior: CandidateResourceBehavior = {
  configKind: 'none',
  isConfigured: () => true,
  buildMetadataFields: () => ({}),
};

const credentialBehavior: CandidateResourceBehavior = {
  configKind: 'credential',
  isConfigured: () => true,
  buildMetadataFields: () => ({}),
};

const endpointBehavior: CandidateResourceBehavior = {
  configKind: 'endpoint',
  isConfigured: (resource, draft) => resolveEndpoint(resource, draft) !== undefined,
  buildMetadataFields: (resource, draft) => {
    const endpoint = resolveEndpoint(resource, draft);
    return endpoint ? endpointMetadataFields(endpoint) : {};
  },
};

/**
 * The member instance an RDS cluster connects through: the user's draft, else the server's
 * choice, else the sorted-top instance. Undefined only when the cluster has no instances,
 * in which case it is not an `rdsInstance` candidate at all.
 */
export const resolveRdsInstanceArn = (
  resource: CandidateResource,
  draft: CandidateDraftState,
): string | undefined => {
  const instances = resource.rdsInstanceList ?? [];
  const drafted = draft.rdsInstanceDrafts[resource.id];
  if (drafted && instances.some((instance) => instance.rds_instance_arn === drafted)) return drafted;
  return defaultRdsInstanceArn(instances, resource.selectedRdsInstanceArn);
};

const rdsInstanceBehavior: CandidateResourceBehavior = {
  configKind: 'rdsInstance',
  isConfigured: (resource, draft) => resolveRdsInstanceArn(resource, draft) !== undefined,
  buildMetadataFields: (resource, draft) => {
    const arn = resolveRdsInstanceArn(resource, draft);
    return {
      // The list rides along verbatim, in wire order — the backend joins on it.
      ...(resource.rdsInstanceList ? { rds_instance_list: resource.rdsInstanceList } : {}),
      ...(arn ? { selected_rds_instance_arn: arn } : {}),
    };
  },
};

export const CANDIDATE_RESOURCE_BEHAVIORS: Record<CandidateBehaviorKey, CandidateResourceBehavior> = {
  default: defaultBehavior,
  credential: credentialBehavior,
  endpoint: endpointBehavior,
  rdsInstance: rdsInstanceBehavior,
};

export const getCandidateBehavior = (resource: CandidateResource): CandidateResourceBehavior =>
  CANDIDATE_RESOURCE_BEHAVIORS[resource.behaviorKey];
