import type { z } from 'zod';
import type { schemas } from '@/lib/generated/install-v1';
import type { ApprovalRequestResource } from '@/app/components/features/process-status/ApprovalRequestModal';
import type {
  CandidateDraftState,
  CandidateResource,
} from '@/lib/types/resources';
import { cloudProviderToWireProvider, toWireDatabaseType } from '@/lib/types';
import { rdsInstanceLabel } from '@/lib/rds-instances';
import {
  getCandidateBehavior,
  resolveRdsInstanceArn,
} from '@/app/target-sources/[targetSourceId]/_components/candidate/candidate-resource-behavior';

type ResourceItem = z.infer<typeof schemas.TargetSourceResourceItemDto>;
type ApprovalRequestInput = z.infer<typeof schemas.ApprovalRequestInputDto>;

export const toModalResources = (
  candidates: readonly CandidateResource[],
  selectedIds: ReadonlySet<string>,
  drafts: CandidateDraftState,
): ApprovalRequestResource[] =>
  candidates.map((candidate) => {
    const endpoint = drafts.endpointDrafts[candidate.id] ?? candidate.endpointConfig;
    // A cluster row approves ONE member instance — the approver has to see which.
    const instanceArn = candidate.rdsInstanceList
      ? resolveRdsInstanceArn(candidate, drafts)
      : undefined;
    const instance = candidate.rdsInstanceList?.find((i) => i.rds_instance_arn === instanceArn);
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
      ...(instance
        ? {
            rdsInstance: {
              identifier: rdsInstanceLabel(instance),
              ...(instance.member ? { member: instance.member } : {}),
            },
          }
        : {}),
    };
  });

/**
 * Unselected TARGET resources must carry an exclusion reason before the approval
 * request goes out (docs/cloud-provider-states.md: reason is required). Non-TARGET
 * categories (no-install-needed / install-ineligible) are not user exclusions and
 * need no reason. An empty or whitespace-only string counts as missing — this list
 * DISABLES the approval CTA, so a blank that slipped in server-side must not pass.
 */
export const listMissingExclusionReasons = (
  candidates: readonly CandidateResource[],
  selectedIds: ReadonlySet<string>,
  exclusionReasons: Readonly<Record<string, string>>,
): CandidateResource[] =>
  candidates.filter(
    (candidate) =>
      candidate.integrationCategory === 'TARGET'
      && !selectedIds.has(candidate.id)
      && !exclusionReasons[candidate.id]?.trim(),
  );

/**
 * Input adapter: UI selection (candidates + selected set + endpoint drafts +
 * per-resource exclusion reasons) → contract `ApprovalRequestInputDto`
 * ({ resources: TargetSourceResourceItemDto[] }). Every item carries its identity
 * (resource_name, resource_type, integration_category) and the candidate's intrinsic metadata
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
      // An RDS cluster's member list travels with the resource whether or not it was
      // selected: it describes what the cluster IS, and the backend joins the echoed
      // array. Only the CHOICE (selected_rds_instance_arn) is selection-scoped, and the
      // behavior adds that on the selected branch.
      ...(candidate.rdsInstanceList ? { rds_instance_list: candidate.rdsInstanceList } : {}),
    };

    if (selectedIds.has(candidate.id)) {
      const behavior = getCandidateBehavior(candidate);
      return {
        resource_id: candidate.id,
        resource_name: candidate.resourceName,
        resource_type: candidate.type,
        selected: true,
        integration_category: candidate.integrationCategory as ResourceItem['integration_category'],
        // The behavior's endpoint fields (VM db_type/host/port) override on top.
        metadata: {
          ...intrinsicMetadata,
          ...behavior.buildMetadataFields(candidate, drafts),
        },
      };
    }
    // An install-ineligible row has no user reason — its checkbox is disabled, so nobody
    // could have typed one. Send the scan's verdict as the reason instead: every consumer
    // downstream (steps 2·3, the admin request queue, the ops request tab) reads
    // `exclusion_reason` and would otherwise render a blank cell, indistinguishable from a
    // reason the user forgot. `recommend_fail_reason` rides along as itself so the fact
    // stays machine-readable and is not inferred back out of free text.
    const userReason = exclusionReasons[candidate.id];
    const reason = userReason || candidate.recommendFailReason || undefined;
    return {
      resource_id: candidate.id,
      resource_name: candidate.resourceName,
      resource_type: candidate.type,
      selected: false,
      integration_category: candidate.integrationCategory as ResourceItem['integration_category'],
      ...(candidate.recommendFailReason
        ? { recommend_fail_reason: candidate.recommendFailReason }
        : {}),
      ...(reason ? { exclusion_reason: reason } : {}),
      metadata: intrinsicMetadata,
    };
  });
