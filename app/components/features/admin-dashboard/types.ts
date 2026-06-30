import type { ProjectSummary } from '@/lib/types';

// View shape consumed by ApprovalDetailModal. Built from ApprovalRequestLatestDto
// (request summary + resources). ADR-019 removed the old ApprovalResourceInput /
// input_data snapshot; only `.selected` is read for the count fallback.
export type ApprovalDetail = {
  project: ProjectSummary;
  approvalRequest: {
    id: string;
    requested_at: string;
    requested_by: string;
    status?: string;
    resource_total_count?: number;
    resource_selected_count?: number;
    resources?: { selected?: boolean | null }[];
  };
};
