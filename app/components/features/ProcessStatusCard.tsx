'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { CloudTargetSource, ProcessStatus } from '@/lib/types';
import type { ConfirmedResource } from '@/lib/types/resources';
import { getProcessStatus, getProject } from '@/app/lib/api';
import {
  StepProgressBar,
  ConnectionTestPanel,
} from './process-status';
import { AzureInstallationInline } from './process-status/azure';
import { AwsInstallationInline } from './process-status/aws';
import { GcpInstallationInline } from './process-status/gcp';
import { ProjectHistoryPanel } from './history';
import { TIMINGS } from '@/lib/constants/timings';
import { cn, statusColors, primaryColors, interactiveColors } from '@/lib/theme';
import { ApprovalWaitingCard } from './process-status/ApprovalWaitingCard';
import { ApprovalApplyingBanner } from './process-status/ApprovalApplyingBanner';

type ProcessTabType = 'status' | 'history';

const TABS: { id: ProcessTabType; label: string }[] = [
  { id: 'status', label: '프로세스 진행 상태' },
  { id: 'history', label: '진행 내역' },
];

interface ProcessStatusCardProps {
  project: CloudTargetSource;
  confirmed: readonly ConfirmedResource[];
  onProjectUpdate?: (project: CloudTargetSource) => void;
}

export const ProcessStatusCard = ({
  project,
  confirmed,
  onProjectUpdate,
}: ProcessStatusCardProps) => {
  const [activeTab, setActiveTab] = useState<ProcessTabType>('status');

  const currentStep = project.processStatus;

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stableOnProjectUpdate = useCallback(
    (p: CloudTargetSource) => onProjectUpdate?.(p),
    [onProjectUpdate],
  );

  useEffect(() => {
    const shouldPoll =
      currentStep === ProcessStatus.WAITING_APPROVAL ||
      currentStep === ProcessStatus.APPLYING_APPROVED;

    if (!shouldPoll || !project.targetSourceId) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    const expectedBff =
      currentStep === ProcessStatus.WAITING_APPROVAL
        ? 'PENDING'
        : 'CONFIRMING';

    const poll = async () => {
      try {
        const status = await getProcessStatus(project.targetSourceId);
        if (status.process_status !== expectedBff) {
          const updated = await getProject(project.targetSourceId);
          stableOnProjectUpdate(updated as CloudTargetSource);
        }
      } catch {
        // polling failure ignored
      }
    };

    poll();

    pollRef.current = setInterval(poll, TIMINGS.PROCESS_STATUS_POLL_MS);
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [currentStep, project.targetSourceId, stableOnProjectUpdate]);

  const refreshProject = useCallback(async () => {
    try {
      const updatedProject = await getProject(project.targetSourceId);
      if (updatedProject) {
        onProjectUpdate?.(updatedProject as CloudTargetSource);
      }
    } catch (err) {
      console.error('설치 완료 상태 갱신 실패:', err);
    }
  }, [onProjectUpdate, project.targetSourceId]);

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden flex flex-col">
      <div className="border-b border-gray-200">
        <nav className="flex">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'px-6 py-4 text-sm font-medium border-b-2 transition-colors',
                activeTab === tab.id
                  ? `${primaryColors.border} ${primaryColors.text}`
                  : interactiveColors.inactiveTab
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="p-6 flex-1 flex flex-col">
        {activeTab === 'status' && (
          <>
            <StepProgressBar currentStep={currentStep} />

            <div className="border-t border-gray-100 my-4" />

            <div className="flex-1 flex flex-col">
              <div className="mt-auto pt-4">
                {currentStep === ProcessStatus.WAITING_TARGET_CONFIRMATION && (
                  <div className={cn('w-full p-4 rounded-lg space-y-2', statusColors.info.bg, statusColors.info.border, 'border')}>
                    <p className={cn('text-sm font-medium', statusColors.info.textDark)}>
                      {project.cloudProvider === 'AWS' ? '수행 절차' : '안내'}
                    </p>
                    <ol className={cn('text-sm list-decimal list-inside space-y-1', statusColors.info.textDark)}>
                      {project.cloudProvider === 'AWS' ? (
                        <>
                          <li>[리소스 스캔] 버튼을 클릭하여 AWS 계정의 RDS, S3 등 리소스를 조회하세요</li>
                          <li>스캔 결과에서 PII Agent를 연동할 리소스를 선택하세요</li>
                          <li>EC2(VM) 포함이 필요한 경우 필터에서 VM 포함을 선택하세요</li>
                          <li>선택 완료 후 [연동 대상 확정] 버튼을 클릭하세요</li>
                        </>
                      ) : (
                        <li>리소스를 스캔하고 연동할 대상을 선택한 뒤 확정해주세요</li>
                      )}
                    </ol>
                    {project.cloudProvider === 'AWS' && (
                      <p className={cn('text-xs mt-2', statusColors.info.text)}>
                        리소스가 조회되지 않으면 AWS Console &gt; IAM에서 스캔 Role이 등록되어 있는지 확인해주세요
                      </p>
                    )}
                  </div>
                )}

                {currentStep === ProcessStatus.WAITING_APPROVAL && !project.isRejected && (
                  <ApprovalWaitingCard
                    targetSourceId={project.targetSourceId}
                    onCancelSuccess={refreshProject}
                  />
                )}

                {currentStep === ProcessStatus.APPLYING_APPROVED && (
                  <ApprovalApplyingBanner
                    targetSourceId={project.targetSourceId}
                  />
                )}

                {currentStep === ProcessStatus.INSTALLING && (
                  project.cloudProvider === 'Azure' ? (
                    <AzureInstallationInline
                      targetSourceId={project.targetSourceId}
                      confirmed={confirmed}
                      onInstallComplete={refreshProject}
                    />
                  ) : project.cloudProvider === 'AWS' ? (
                    <AwsInstallationInline
                      targetSourceId={project.targetSourceId}
                      onInstallComplete={refreshProject}
                    />
                  ) : (
                    <GcpInstallationInline
                      targetSourceId={project.targetSourceId}
                      onInstallComplete={refreshProject}
                    />
                  )
                )}

                {currentStep === ProcessStatus.WAITING_CONNECTION_TEST && (
                  <ConnectionTestPanel
                    targetSourceId={project.targetSourceId}
                    confirmed={confirmed}
                    onResourceUpdate={refreshProject}
                  />
                )}

                {(currentStep === ProcessStatus.CONNECTION_VERIFIED ||
                  currentStep === ProcessStatus.INSTALLATION_COMPLETE) && (
                  <div className="grid grid-cols-1 gap-4">
                    <ConnectionTestPanel
                      targetSourceId={project.targetSourceId}
                      confirmed={confirmed}
                      onResourceUpdate={refreshProject}
                    />
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {activeTab === 'history' && (
          <ProjectHistoryPanel targetSourceId={project.targetSourceId} embedded />
        )}
      </div>
    </div>
  );
};
