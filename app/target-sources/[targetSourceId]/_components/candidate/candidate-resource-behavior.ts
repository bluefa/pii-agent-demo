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
import { defaultRdsInstanceResourceId } from '@/lib/rds-instances';

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
export const resolveRdsInstanceResourceId = (
  resource: CandidateResource,
  draft: CandidateDraftState,
): string | undefined => {
  const instances = resource.rdsInstanceCandidates ?? [];
  const drafted = draft.rdsInstanceDrafts[resource.id];
  if (drafted && instances.some((instance) => instance.resource_id === drafted)) return drafted;
  return defaultRdsInstanceResourceId(instances, resource.selectedRdsInstanceResourceId);
};

const rdsInstanceBehavior: CandidateResourceBehavior = {
  configKind: 'rdsInstance',
  // The approval CTA DOES consult this for every selected candidate, but for a cluster it
  // can never be false: `pickBehaviorKey` only assigns this behavior when the candidate list
  // is non-empty, and a non-empty list always resolves to a candidate `resource_id` (the
  // sorted-top default when neither a draft nor a server value applies). Said outright rather
  // than re-derived through `resolveRdsInstanceResourceId`, which read like a gate that could
  // fail.
  isConfigured: () => true,
  // ONLY the chosen `resource_id`. `rds_instance_candidates` belongs to the payload adapter's
  // intrinsic metadata, which puts it on selected and excluded rows alike — emitting it here
  // too gave one field two owners, with the behavior silently winning the spread.
  buildMetadataFields: (resource, draft) => {
    const resourceId = resolveRdsInstanceResourceId(resource, draft);
    return resourceId ? { selected_rds_instance_resource_id: resourceId } : {};
  },
};

/**
 * An EC2 instance the user searched for and added by hand (AWS Step 1). It never came from
 * the scan's candidate list, so its connection info is not a draft to be filled in later —
 * the add modal cannot produce a row without it, which is why `isConfigured` is unconditional.
 * The row carries that info in `endpointConfig`, so the submitted metadata is the same
 * host/port/database_type/oracle_service_id set the VM endpoint behavior sends.
 */
const manualEc2Behavior: CandidateResourceBehavior = {
  configKind: 'manualEc2',
  isConfigured: () => true,
  buildMetadataFields: (resource) =>
    resource.endpointConfig ? endpointMetadataFields(resource.endpointConfig) : {},
};

export const CANDIDATE_RESOURCE_BEHAVIORS: Record<CandidateBehaviorKey, CandidateResourceBehavior> = {
  default: defaultBehavior,
  credential: credentialBehavior,
  endpoint: endpointBehavior,
  rdsInstance: rdsInstanceBehavior,
  manualEc2: manualEc2Behavior,
};

export const getCandidateBehavior = (resource: CandidateResource): CandidateResourceBehavior =>
  CANDIDATE_RESOURCE_BEHAVIORS[resource.behaviorKey];
