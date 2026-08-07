import type { z } from 'zod';
import type { schemas } from '@/lib/generated/install-v1';
import type {
  CandidateConfigKind,
  CandidateResource,
  EndpointConfigDraft,
} from '@/lib/types/resources/candidate';

export interface CandidateDraftState {
  endpointDrafts: Record<string, EndpointConfigDraft>;
  /** RDS cluster id → the member instance ARN the user picked. */
  rdsInstanceDrafts: Record<string, string>;
}

type MetadataFields = z.infer<typeof schemas.TargetSourceResourceMetadataDto>;

export interface CandidateResourceBehavior {
  configKind: CandidateConfigKind;
  isConfigured(resource: CandidateResource, draft: CandidateDraftState): boolean;
  buildMetadataFields(
    resource: CandidateResource,
    draft: CandidateDraftState,
  ): MetadataFields;
}
