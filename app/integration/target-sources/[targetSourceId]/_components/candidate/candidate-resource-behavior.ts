import type { z } from 'zod';
import type { schemas } from '@/lib/generated/install-v1';
import type {
  CandidateBehaviorKey,
  CandidateDraftState,
  CandidateResource,
  CandidateResourceBehavior,
  EndpointConfigDraft,
} from '@/lib/types/resources';

type MetadataFields = z.infer<typeof schemas.TargetSourceResourceMetadataDto>;

const resolveEndpoint = (
  resource: CandidateResource,
  draft: CandidateDraftState,
): EndpointConfigDraft | undefined =>
  draft.endpointDrafts[resource.id] ?? resource.endpointConfig;

const endpointMetadataFields = (endpoint: EndpointConfigDraft): MetadataFields => ({
  database_type: endpoint.databaseType.toLowerCase(),
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

export const CANDIDATE_RESOURCE_BEHAVIORS: Record<CandidateBehaviorKey, CandidateResourceBehavior> = {
  default: defaultBehavior,
  credential: credentialBehavior,
  endpoint: endpointBehavior,
};

export const getCandidateBehavior = (resource: CandidateResource): CandidateResourceBehavior =>
  CANDIDATE_RESOURCE_BEHAVIORS[resource.behaviorKey];
