import type { ApprovalResourceInput } from '@/app/lib/api';
import type { ProjectSummary } from '@/lib/types';

export type ApprovalDetail = {
  project: ProjectSummary;
  approvalRequest: {
    id: string;
    requested_at: string;
    requested_by: string;
    input_data: {
      resource_inputs: ApprovalResourceInput[];
      exclusion_reason_default?: string;
    };
  };
};
