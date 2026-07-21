import type { z } from 'zod';
import type { schemas } from '@/lib/generated/install-v1';
import type { ApprovalRequestResource } from '@/app/components/features/process-status/ApprovalRequestModal';
import type {
  CandidateDraftState,
  CandidateResource,
} from '@/lib/types/resources';
import { cloudProviderToWireProvider, toWireDatabaseType } from '@/lib/types';
import { getCandidateBehavior } from '@/app/target-sources/[targetSourceId]/_components/candidate/candidate-resource-behavior';

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
      // Show the effective DB type in the confirm modal (draft/endpoint wins for VMs).
      databaseType: endpoint?.databaseType ?? candidate.databaseType,
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
 * Input adapter: UI selection (candidates + selected set + endpoint drafts +
 * per-resource exclusion reasons) → contract `ApprovalRequestInputDto`
 * ({ resources: TargetSourceResourceItemDto[] }). Every item carries its identity
 * (resource_name, integration_category) and the candidate's intrinsic metadata
 * (provider/region/database_type); selected items additionally carry the behavior's
 * endpoint fields (VM db_type/host/port) from user drafts; excluded items carry the
 * reason the user picked. This is the ONLY shape sent on the wire.
 */
export const toApprovalRequestInput = (
  candidates: readonly CandidateResource[],
  selectedIds: ReadonlySet<string>,
  drafts: CandidateDraftState,
  exclusionReasons: Readonly<Record<string, string>>,
): ApprovalRequestInput => ({
  resources: buildResourceInputs(candidates, selectedIds, drafts, exclusionReasons),
});

const buildResourceInputs = (
  candidates: readonly CandidateResource[],
  selectedIds: ReadonlySet<string>,
  drafts: CandidateDraftState,
  exclusionReasons: Readonly<Record<string, string>>,
): ResourceItem[] =>
  candidates.map((candidate): ResourceItem => {
    // Contract: provider/region/database_type live under metadata
    // (TargetSourceResourceMetadataDto). Carry them from the candidate so a
    // backend echoing the payload keeps them through Step2/Step3.
    const intrinsicMetadata: ResourceItem['metadata'] = {
      ...(candidate.metadata.provider
        ? { provider: cloudProviderToWireProvider(candidate.metadata.provider) }
        : {}),
      ...(candidate.metadata.region ? { region: candidate.metadata.region } : {}),
      ...(candidate.databaseType ? { database_type: toWireDatabaseType(candidate.databaseType) } : {}),
    };

    if (selectedIds.has(candidate.id)) {
      const behavior = getCandidateBehavior(candidate);
      return {
        resource_id: candidate.id,
        resource_name: candidate.resourceName,
        selected: true,
        integration_category: candidate.integrationCategory as ResourceItem['integration_category'],
        // The behavior's endpoint fields (VM db_type/host/port) override on top.
        metadata: {
          ...intrinsicMetadata,
          ...behavior.buildMetadataFields(candidate, drafts),
        },
      };
    }
    return {
      resource_id: candidate.id,
      resource_name: candidate.resourceName,
      selected: false,
      integration_category: candidate.integrationCategory as ResourceItem['integration_category'],
      ...(exclusionReasons[candidate.id]
        ? { exclusion_reason: exclusionReasons[candidate.id] }
        : {}),
      metadata: intrinsicMetadata,
    };
  });
