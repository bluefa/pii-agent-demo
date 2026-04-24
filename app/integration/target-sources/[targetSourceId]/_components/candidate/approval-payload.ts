import type { ApprovalRequestFormData, ApprovalRequestResource } from '@/app/components/features/process-status/ApprovalRequestModal';
import type { ApprovalResourceInput } from '@/app/lib/api';
import type {
  CandidateDraftState,
  CandidateResource,
} from '@/lib/types/resources';
import { getCandidateBehavior } from '@/app/integration/target-sources/[targetSourceId]/_components/candidate/candidate-resource-behavior';

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

export const buildResourceInputs = (
  candidates: readonly CandidateResource[],
  selectedIds: ReadonlySet<string>,
  drafts: CandidateDraftState,
  formData: ApprovalRequestFormData,
): ApprovalResourceInput[] =>
  candidates.map((candidate) => {
    if (selectedIds.has(candidate.id)) {
      const behavior = getCandidateBehavior(candidate);
      const resourceInput = behavior.buildApprovalInput(candidate, drafts);
      return {
        resource_id: candidate.id,
        selected: true,
        ...(resourceInput ? { resource_input: resourceInput } : {}),
      };
    }
    return {
      resource_id: candidate.id,
      selected: false,
      ...(formData.exclusion_reason_default
        ? { exclusion_reason: formData.exclusion_reason_default }
        : {}),
    };
  });
