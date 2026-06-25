import type { z } from 'zod';
import type { schemas } from '@/lib/generated/install-v1';
import type { ApprovalRequestFormData, ApprovalRequestResource } from '@/app/components/features/process-status/ApprovalRequestModal';
import type {
  CandidateDraftState,
  CandidateResource,
} from '@/lib/types/resources';
import { getCandidateBehavior } from '@/app/integration/target-sources/[targetSourceId]/_components/candidate/candidate-resource-behavior';

type ResourceItem = z.infer<typeof schemas.TargetSourceResourceItemDto>;
type ApprovalRequestInput = z.infer<typeof schemas.ApprovalRequestInputDto>;

export const toModalResources = (
  candidates: readonly CandidateResource[],
  selectedIds: ReadonlySet<string>,
  drafts: CandidateDraftState,
): ApprovalRequestResource[] =>
  candidates.map((candidate) => {
    const endpoint = drafts.endpointDrafts[candidate.id] ?? candidate.endpointConfig;
    return {
      id: candidate.id,
      resourceId: candidate.resourceId,
      type: candidate.type,
      isSelected: selectedIds.has(candidate.id),
      integrationCategory: candidate.integrationCategory,
      ...(endpoint
        ? {
            endpoint: {
              databaseType: endpoint.databaseType,
              port: endpoint.port,
              ...(endpoint.host ? { host: endpoint.host } : {}),
            },
          }
        : {}),
    };
  });

/**
 * Input adapter: UI selection (candidates + selected set + endpoint drafts + form)
 * → contract `ApprovalRequestInputDto` ({ resources: TargetSourceResourceItemDto[] }).
 * Selected items carry their metadata; excluded items carry only the exclusion reason
 * ("select와 같이 선택/미선택 여부"). This is the ONLY shape sent on the wire.
 */
export const toApprovalRequestInput = (
  candidates: readonly CandidateResource[],
  selectedIds: ReadonlySet<string>,
  drafts: CandidateDraftState,
  formData: ApprovalRequestFormData,
): ApprovalRequestInput => ({
  resources: buildResourceInputs(candidates, selectedIds, drafts, formData),
});

const buildResourceInputs = (
  candidates: readonly CandidateResource[],
  selectedIds: ReadonlySet<string>,
  drafts: CandidateDraftState,
  formData: ApprovalRequestFormData,
): ResourceItem[] =>
  candidates.map((candidate): ResourceItem => {
    if (selectedIds.has(candidate.id)) {
      const behavior = getCandidateBehavior(candidate);
      const metadataFields = behavior.buildMetadataFields(candidate, drafts);
      return {
        resource_id: candidate.id,
        resource_name: candidate.resourceId,
        selected: true,
        integration_category: candidate.integrationCategory as ResourceItem['integration_category'],
        metadata: metadataFields,
      };
    }
    return {
      resource_id: candidate.id,
      selected: false,
      ...(formData.exclusion_reason_default
        ? { exclusion_reason: formData.exclusion_reason_default }
        : {}),
      metadata: {},
    };
  });
