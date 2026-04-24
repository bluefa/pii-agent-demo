'use client';

import { Project, ProcessStatus } from '@/lib/types';
import { IdcInstallationStatus as IdcInstallationStatusType } from '@/lib/types/idc';
import { ConnectionTestPanel } from '@/app/components/features/process-status/ConnectionTestPanel';
import {
  IdcStepProgressBar,
  IdcStepGuide,
  IdcInstallationStatusDisplay,
} from './idc-process-status';

interface IdcProcessStatusCardProps {
  project: Project;
  idcInstallationStatus: IdcInstallationStatusType | null;
  showResourceInput: boolean;
  idcActionLoading: boolean;
  hasPendingResources?: boolean;
  onShowResourceInput: () => void;
  onConfirmFirewall: () => void;
  onRetry: () => void;
  onResourceUpdate?: () => void;
}

export const IdcProcessStatusCard = ({
  project,
  idcInstallationStatus,
  showResourceInput,
  idcActionLoading,
  hasPendingResources = false,
  onShowResourceInput,
  onConfirmFirewall,
  onRetry,
  onResourceUpdate,
}: IdcProcessStatusCardProps) => {
  const selectedResources = project.resources.filter((r) => r.isSelected);
  return (
    <div className="bg-white rounded-xl shadow-sm p-6 flex flex-col">
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
        프로세스 진행 상태
      </h3>

      <IdcStepProgressBar currentStep={project.processStatus} />

      <div className="border-t border-gray-100 my-4" />

      <div className="flex-1 flex flex-col">
        <IdcStepGuide currentStep={project.processStatus} />

        <div className="mt-auto pt-4">
          {project.processStatus === ProcessStatus.WAITING_TARGET_CONFIRMATION && (
            <p className="text-sm text-gray-500">
              {hasPendingResources
                ? '아래 리소스 목록에서 연동 대상을 확인하고 확정하세요'
                : '아래 리소스 목록에서 연결할 데이터베이스를 등록하세요'}
            </p>
          )}

          {project.processStatus === ProcessStatus.INSTALLING && idcInstallationStatus && (
            <IdcInstallationStatusDisplay
              status={idcInstallationStatus}
              resources={project.resources}
              targetSourceId={project.targetSourceId}
              onRetry={onRetry}
              onResourceUpdate={onResourceUpdate}
            />
          )}

          {(project.processStatus === ProcessStatus.WAITING_CONNECTION_TEST ||
            project.processStatus === ProcessStatus.CONNECTION_VERIFIED ||
            project.processStatus === ProcessStatus.INSTALLATION_COMPLETE) && (
            <ConnectionTestPanel
              targetSourceId={project.targetSourceId}
              selectedResources={selectedResources}
              onResourceUpdate={onResourceUpdate}
            />
          )}
        </div>
      </div>
    </div>
  );
};
