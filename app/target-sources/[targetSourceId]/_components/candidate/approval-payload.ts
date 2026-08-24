import type { z } from 'zod';
import type { schemas } from '@/lib/generated/install-v1';
import type { ApprovalRequestResource } from '@/app/components/features/process-status/ApprovalRequestModal';
import type {
  CandidateDraftState,
  CandidateResource,
} from '@/lib/types/resources';
import type { ApprovalSelection } from '@/lib/approval-selection';
import { getCandidateBehavior } from '@/app/target-sources/[targetSourceId]/_components/candidate/candidate-resource-behavior';

type SelectionRow = ApprovalSelection['resources'][number];
type MetadataFields = z.infer<typeof schemas.TargetSourceResourceMetadataDto>;

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
 * Input adapter: UI selection → the route's `ApprovalSelectionInput`.
 *
 * Sends the CHOICES only — which resource, selected or not, the reason the user typed,
 * the RDS member they picked, and the endpoint fields they filled in. Identity and
 * intrinsic metadata (resource_name/resource_type/integration_category/provider/region/
 * database_type/rds_instance_candidates) are NO LONGER sent: the route re-reads them from
 * the scan and assembles the contract body itself, so a crafted payload cannot describe a
 * resource the scan never saw. See `app/api/_lib/approval-input.ts`.
 *
 * The behavior still decides WHICH endpoint fields apply — that logic is unchanged; only
 * its output is re-addressed from contract metadata into the narrower input shape.
 */
export const toApprovalRequestInput = (
  candidates: readonly CandidateResource[],
  selectedIds: ReadonlySet<string>,
  drafts: CandidateDraftState,
  exclusionReasons: Readonly<Record<string, string>>,
): ApprovalSelection => ({
  resources: candidates.map((candidate): SelectionRow => {
    if (!selectedIds.has(candidate.id)) {
      // The scan's own verdict is NOT sent: the route reads `recommend_fail_reason` from
      // the authoritative row and falls back to it when the user typed nothing.
      const userReason = exclusionReasons[candidate.id]?.trim();
      return {
        resource_id: candidate.id,
        selected: false,
        ...(userReason ? { exclusion_reason: userReason } : {}),
      };
    }
    const fields = getCandidateBehavior(candidate).buildMetadataFields(candidate, drafts);
    const endpoint = toEndpointInput(fields);
    return {
      resource_id: candidate.id,
      selected: true,
      ...(fields.selected_rds_instance_resource_id
        ? { selected_rds_instance_resource_id: fields.selected_rds_instance_resource_id }
        : {}),
      ...(endpoint ? { endpoint } : {}),
    };
  }),
});

/**
 * The behavior emits contract-shaped metadata; the route's input takes the same five
 * user-authored endpoint fields under `endpoint`. Undefined when the behavior emitted
 * none — a resource whose connection info comes from the scan sends nothing here.
 */
const toEndpointInput = (fields: MetadataFields): SelectionRow['endpoint'] => {
  const endpoint = {
    ...(fields.host ? { host: fields.host } : {}),
    ...(typeof fields.port === 'number' ? { port: fields.port } : {}),
    ...(fields.database_type ? { database_type: fields.database_type } : {}),
    ...(fields.oracle_service_id ? { oracle_service_id: fields.oracle_service_id } : {}),
    ...(fields.network_interface_id
      ? { network_interface_id: fields.network_interface_id }
      : {}),
  };
  return Object.keys(endpoint).length > 0 ? endpoint : undefined;
};
