import { ProcessStatus, type ApprovalRequestReadModel, type Project, type TargetSourceProcessStatusReadModel } from '@/lib/types';
import { getProjectCurrentStep } from '@/lib/process';

export interface RejectionAlertReadModel {
  reason: string | null;
  rejectedAt: string | null;
}

export const getProjectCurrentStepFromReadModels = (
  project: Pick<Project, 'cloudProvider' | 'status'>,
  processStatus: TargetSourceProcessStatusReadModel | null,
  latestApprovalRequest: ApprovalRequestReadModel | null,
): ProcessStatus => {
  const fallbackStep = getProjectCurrentStep(project);

  if (!project.status.targets.confirmed) {
    return ProcessStatus.WAITING_TARGET_CONFIRMATION;
  }

  if (latestApprovalRequest?.result === 'REJECTED' || latestApprovalRequest?.result === 'PENDING') {
    return ProcessStatus.WAITING_APPROVAL;
  }

  if (processStatus?.process_status === 'WAITING_APPROVAL') {
    return ProcessStatus.WAITING_APPROVAL;
  }

  if (processStatus?.process_status === 'APPLYING_APPROVED') {
    return ProcessStatus.APPLYING_APPROVED;
  }

  return fallbackStep;
};

export const getRejectionAlertReadModel = (
  project: Pick<Project, 'isRejected' | 'rejectionReason' | 'rejectedAt'>,
  processStatus: TargetSourceProcessStatusReadModel | null,
  latestApprovalRequest: ApprovalRequestReadModel | null,
): RejectionAlertReadModel | null => {
  if (latestApprovalRequest?.result === 'REJECTED') {
    return {
      reason: latestApprovalRequest.process_info.reason ?? processStatus?.status_inputs.last_rejection_reason ?? project.rejectionReason ?? null,
      rejectedAt: latestApprovalRequest.processed_at ?? project.rejectedAt ?? null,
    };
  }

  if (project.isRejected) {
    return {
      reason: project.rejectionReason ?? processStatus?.status_inputs.last_rejection_reason ?? null,
      rejectedAt: project.rejectedAt ?? null,
    };
  }

  return null;
};

export const isRejectedLatestApprovalRequest = (
  latestApprovalRequest: ApprovalRequestReadModel | null,
): boolean => latestApprovalRequest?.result === 'REJECTED';
