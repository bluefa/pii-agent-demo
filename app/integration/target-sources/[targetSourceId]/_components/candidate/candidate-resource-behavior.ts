import type { ApprovalResourceInputData } from '@/app/lib/api';
import type {
  CandidateBehaviorKey,
  CandidateDraftState,
  CandidateResource,
  CandidateResourceBehavior,
  EndpointConfigDraft,
} from '@/lib/types/resources';

const resolveEndpoint = (
  resource: CandidateResource,
  draft: CandidateDraftState,
): EndpointConfigDraft | undefined =>
  draft.endpointDrafts[resource.id] ?? resource.endpointConfig;

const endpointInputData = (endpoint: EndpointConfigDraft): ApprovalResourceInputData => ({
  endpoint_config: {
    db_type: endpoint.databaseType,
    port: endpoint.port,
    host: endpoint.host ?? '',
    ...(endpoint.oracleServiceId ? { oracleServiceId: endpoint.oracleServiceId } : {}),
    ...(endpoint.selectedNicId ? { selectedNicId: endpoint.selectedNicId } : {}),
  },
});

const defaultBehavior: CandidateResourceBehavior = {
  configKind: 'none',
  isConfigured: () => true,
  buildApprovalInput: () => undefined,
};

const credentialBehavior: CandidateResourceBehavior = {
  configKind: 'credential',
  isConfigured: () => true,
  buildApprovalInput: () => undefined,
};

const endpointBehavior: CandidateResourceBehavior = {
  configKind: 'endpoint',
  isConfigured: (resource, draft) => resolveEndpoint(resource, draft) !== undefined,
  buildApprovalInput: (resource, draft) => {
    const endpoint = resolveEndpoint(resource, draft);
    return endpoint ? endpointInputData(endpoint) : undefined;
  },
};

export const CANDIDATE_RESOURCE_BEHAVIORS: Record<CandidateBehaviorKey, CandidateResourceBehavior> = {
  default: defaultBehavior,
  credential: credentialBehavior,
  endpoint: endpointBehavior,
};

export const getCandidateBehavior = (resource: CandidateResource): CandidateResourceBehavior =>
  CANDIDATE_RESOURCE_BEHAVIORS[resource.behaviorKey];
