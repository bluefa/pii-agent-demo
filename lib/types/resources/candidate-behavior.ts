import type { ApprovalResourceInputData } from '@/app/lib/api';
import type {
  CandidateConfigKind,
  CandidateResource,
  EndpointConfigDraft,
} from './candidate';

export interface CandidateDraftState {
  endpointDrafts: Record<string, EndpointConfigDraft>;
}

export interface CandidateResourceBehavior {
  configKind: CandidateConfigKind;
  isConfigured(resource: CandidateResource, draft: CandidateDraftState): boolean;
  buildApprovalInput(
    resource: CandidateResource,
    draft: CandidateDraftState,
  ): ApprovalResourceInputData | undefined;
}
