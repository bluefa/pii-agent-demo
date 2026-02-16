'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ProcessStatus, Project, TerraformStatus, SecretKey } from '@/lib/types';
import { TerraformStatusModal } from './TerraformStatusModal';
import { completeInstallation, getProcessStatus, getProject } from '@/app/lib/api';
import { useModal } from '@/app/hooks/useModal';
import { getProjectCurrentStep } from '@/lib/process';
import {
  StepProgressBar,
  StepGuide,
  ConnectionTestPanel,
} from './process-status';
import { AzureInstallationInline } from './process-status/azure';
import { AwsInstallationInline } from './process-status/aws';
import { GcpInstallationInline } from './process-status/gcp';
import { ProjectHistoryPanel } from './history';
import { ProcessGuideModal } from './process-status/ProcessGuideModal';
import { getProcessGuide } from '@/lib/constants/process-guides';
import { cn, statusColors } from '@/lib/theme';
import { ApprovalRequestModal } from './process-status/ApprovalRequestModal';
import type { ApprovalRequestFormData } from './process-status/ApprovalRequestModal';

type ProcessTabType = 'status' | 'history';

interface ProcessStatusCardProps {
  project: Project;
  onProjectUpdate?: (project: Project) => void;
  onTestConnection?: () => void;
  testLoading?: boolean;
  credentials?: SecretKey[];
  onCredentialChange?: (resourceId: string, credentialId: string | null) => void;
  approvalModalOpen?: boolean;
  onApprovalModalClose?: () => void;
  onApprovalSubmit?: (data: ApprovalRequestFormData) => void;
  approvalLoading?: boolean;
  approvalError?: string | null;
}

const getProgress = (project: Project) => {
  const items: TerraformStatus[] = [project.terraformState.bdcTf];
  if (project.cloudProvider === 'AWS' && project.terraformState.serviceTf) {
    items.unshift(project.terraformState.serviceTf);
  }
  const completed = items.filter(s => s === 'COMPLETED').length;
  return { completed, total: items.length };
};

export const ProcessStatusCard = ({
  project,
  onProjectUpdate,
  onTestConnection,
  testLoading,
  credentials = [],
  onCredentialChange,
  approvalModalOpen = false,
  onApprovalModalClose,
  onApprovalSubmit,
  approvalLoading = false,
  approvalError,
}: ProcessStatusCardProps) => {
  // Tab state
  const [activeTab, setActiveTab] = useState<ProcessTabType>('status');
  const tabs = [
    { id: 'status' as const, label: '프로세스 진행 상태' },
    { id: 'history' as const, label: '진행 내역' },
  ];

  // Modal states
  const terraformModal = useModal();
  const guideModal = useModal();
  // ADR-004: status 필드에서 현재 단계 계산
  const currentStep = getProjectCurrentStep(project);
  const progress = getProgress(project);
  const selectedResources = project.resources.filter((r) => r.isSelected);

  // Process-status polling for WAITING_APPROVAL and APPLYING_APPROVED
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stableOnProjectUpdate = useCallback(
    (p: Project) => onProjectUpdate?.(p),
    [onProjectUpdate],
  );

  useEffect(() => {
    const shouldPoll =
      currentStep === ProcessStatus.WAITING_APPROVAL ||
      currentStep === ProcessStatus.INSTALLING;

    if (!shouldPoll || !project.targetSourceId) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    const expectedBff =
      currentStep === ProcessStatus.WAITING_APPROVAL
        ? 'WAITING_APPROVAL'
        : 'APPLYING_APPROVED';

    const poll = async () => {
      try {
        const status = await getProcessStatus(project.targetSourceId);
        if (status.process_status !== expectedBff) {
          const updated = await getProject(project.id);
          stableOnProjectUpdate(updated);
        }
      } catch {
        // polling failure ignored
      }
    };

    pollRef.current = setInterval(poll, 10_000);
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [currentStep, project.targetSourceId, project.id, stableOnProjectUpdate]);

  // Process Guide
  const guideVariant = project.cloudProvider === 'AWS'
    ? project.awsInstallationMode === 'AUTO' ? 'auto' : 'manual'
    : undefined;
  const guide = getProcessGuide(project.cloudProvider, guideVariant);

  // 설치 완료 핸들러
  const handleInstallComplete = async () => {
    try {
      const updatedProject = await completeInstallation(project.id);
      if (updatedProject) {
        onProjectUpdate?.(updatedProject);
      }
    } catch (err) {
      console.error('설치 완료 처리 실패:', err);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden flex flex-col">
      {/* 탭 헤더 */}
      <div className="border-b border-gray-200">
        <nav className="flex">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'px-6 py-4 text-sm font-medium border-b-2 transition-colors',
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* 탭 콘텐츠 */}
      <div className="p-6 flex-1 flex flex-col">
        {activeTab === 'status' && (
          <>
            <StepProgressBar
              currentStep={currentStep}
              onGuideClick={guide ? guideModal.open : undefined}
            />

            <div className="border-t border-gray-100 my-4" />

            <div className="flex-1 flex flex-col">
              <StepGuide currentStep={currentStep} cloudProvider={project.cloudProvider} />

              {/* Action Buttons */}
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

                {currentStep === ProcessStatus.WAITING_APPROVAL && (
                  <div className="w-full text-center py-2.5 text-gray-500 text-sm">
                    관리자 승인을 기다리는 중입니다
                  </div>
                )}

                {currentStep === ProcessStatus.INSTALLING && (
                  project.cloudProvider === 'Azure' ? (
                    <AzureInstallationInline
                      targetSourceId={project.targetSourceId}
                      resources={project.resources}
                      onInstallComplete={handleInstallComplete}
                    />
                  ) : project.cloudProvider === 'AWS' ? (
                    <AwsInstallationInline
                      targetSourceId={project.targetSourceId}
                      onInstallComplete={handleInstallComplete}
                    />
                  ) : project.cloudProvider === 'GCP' ? (
                    <GcpInstallationInline
                      targetSourceId={project.targetSourceId}
                      onInstallComplete={handleInstallComplete}
                    />
                  ) : (
                    <button
                      onClick={() => terraformModal.open()}
                      className={cn('w-full flex items-center justify-between px-4 py-2.5 rounded-lg transition-colors border', statusColors.warning.bg, statusColors.warning.border, 'hover:bg-orange-100')}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                        <span className={cn('font-medium', statusColors.warning.text)}>설치 상태 확인</span>
                      </div>
                      <span className={cn('px-2 py-0.5 text-sm font-medium rounded-full', statusColors.warning.bg, statusColors.warning.text)}>
                        {progress.completed}/{progress.total}
                      </span>
                    </button>
                  )
                )}

                {(currentStep === ProcessStatus.WAITING_CONNECTION_TEST ||
                  currentStep === ProcessStatus.CONNECTION_VERIFIED ||
                  currentStep === ProcessStatus.INSTALLATION_COMPLETE) && (
                  <ConnectionTestPanel
                    connectionTestHistory={project.connectionTestHistory || []}
                    credentials={credentials}
                    selectedResources={selectedResources}
                    onTestConnection={onTestConnection}
                    testLoading={testLoading}
                    onCredentialChange={onCredentialChange}
                  />
                )}
              </div>
            </div>
          </>
        )}

        {activeTab === 'history' && (
          <ProjectHistoryPanel projectId={project.id} embedded />
        )}
      </div>

      {/* Terraform Status Modal (AWS/GCP only) */}
      {terraformModal.isOpen && project.cloudProvider !== 'Azure' && (
        <TerraformStatusModal
          terraformState={project.terraformState}
          cloudProvider={project.cloudProvider}
          onClose={() => terraformModal.close()}
        />
      )}

      {/* Process Guide Modal */}
      {guide && (
        <ProcessGuideModal
          isOpen={guideModal.isOpen}
          onClose={guideModal.close}
          guide={guide}
          currentStepNumber={currentStep}
        />
      )}

      {/* Approval Request Modal */}
      {onApprovalSubmit && onApprovalModalClose && (
        <ApprovalRequestModal
          isOpen={approvalModalOpen}
          onClose={onApprovalModalClose}
          onSubmit={onApprovalSubmit}
          resources={project.resources}
          loading={approvalLoading}
          error={approvalError}
        />
      )}
    </div>
  );
};
