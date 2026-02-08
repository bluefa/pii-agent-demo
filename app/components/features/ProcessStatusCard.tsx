'use client';

import { useState } from 'react';
import { ProcessStatus, Project, TerraformStatus, DBCredential } from '@/lib/types';
import { TerraformStatusModal } from './TerraformStatusModal';
import { approveProject, rejectProject, completeInstallation } from '@/app/lib/api';
import { useModal } from '@/app/hooks/useModal';
import { useApiMutation } from '@/app/hooks/useApiMutation';
import { getProjectCurrentStep } from '@/lib/process';
import {
  StepProgressBar,
  StepGuide,
  ApproveModal,
  RejectModal,
  ConnectionTestPanel,
} from './process-status';
import { AzureInstallationInline } from './process-status/azure';
import { AwsInstallationInline } from './process-status/aws';
import { ProjectHistoryPanel } from './history';
import { ProcessGuideModal } from './process-status/ProcessGuideModal';
import { getProcessGuide } from '@/lib/constants/process-guides';
import { cn, statusColors } from '@/lib/theme';

type ProcessTabType = 'status' | 'history';

interface ProcessStatusCardProps {
  project: Project;
  isAdmin?: boolean;
  onProjectUpdate?: (project: Project) => void;
  onTestConnection?: () => void;
  testLoading?: boolean;
  credentials?: DBCredential[];
  onCredentialChange?: (resourceId: string, credentialId: string | null) => void;
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
  isAdmin,
  onProjectUpdate,
  onTestConnection,
  testLoading,
  credentials = [],
  onCredentialChange,
}: ProcessStatusCardProps) => {
  // Tab state
  const [activeTab, setActiveTab] = useState<ProcessTabType>('status');
  const tabs = [
    { id: 'status' as const, label: '프로세스 진행 상태' },
    { id: 'history' as const, label: '진행 내역' },
  ];

  // Modal states
  const terraformModal = useModal();
  const approveModal = useModal();
  const rejectModal = useModal();
  const guideModal = useModal();

  // Form states
  const [approveComment, setApproveComment] = useState('');
  const [rejectReason, setRejectReason] = useState('');

  // API mutations
  const { mutate: doApprove, loading: approving } = useApiMutation(
    (comment: string) => approveProject(project.id, comment),
    {
      onSuccess: (updated) => {
        onProjectUpdate?.(updated);
        approveModal.close();
        setApproveComment('');
      },
      errorMessage: '승인에 실패했습니다.',
    }
  );

  const { mutate: doReject, loading: rejecting } = useApiMutation(
    (reason: string) => rejectProject(project.id, reason),
    {
      onSuccess: (updated) => {
        onProjectUpdate?.(updated);
        rejectModal.close();
        setRejectReason('');
      },
      errorMessage: '반려에 실패했습니다.',
    }
  );

  const submitting = approving || rejecting;
  // ADR-004: status 필드에서 현재 단계 계산
  const currentStep = getProjectCurrentStep(project);
  const progress = getProgress(project);
  const selectedResources = project.resources.filter((r) => r.isSelected);

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
              <StepGuide currentStep={currentStep} />

              {/* Action Buttons */}
              <div className="mt-auto pt-4">
                {currentStep === ProcessStatus.WAITING_TARGET_CONFIRMATION && (
                  <div className={cn('w-full p-4 rounded-lg', statusColors.info.bg, statusColors.info.border, 'border')}>
                    <p className={cn('text-sm', statusColors.info.textDark)}>
                      리소스 스캔을 진행하시고 리소스 목록에서 연동 대상을 확인해주세요.
                      <br />
                      <span className={statusColors.info.text}>
                        리소스 목록이 조회되지 않는다면 관리자에게 문의해주세요.
                      </span>
                    </p>
                  </div>
                )}

                {currentStep === ProcessStatus.WAITING_APPROVAL && (
                  <div className="flex gap-2">
                    {isAdmin ? (
                      <>
                        <button
                          onClick={() => approveModal.open()}
                          className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors shadow-sm hover:shadow"
                        >
                          승인
                        </button>
                        <button
                          onClick={() => rejectModal.open()}
                          className={cn('flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors border', statusColors.error.bg, statusColors.error.text, statusColors.error.border, 'hover:bg-red-100')}
                        >
                          반려
                        </button>
                      </>
                    ) : (
                      <div className="w-full text-center py-2.5 text-gray-500 text-sm">
                        관리자 승인을 기다리는 중입니다
                      </div>
                    )}
                  </div>
                )}

                {currentStep === ProcessStatus.INSTALLING && (
                  project.cloudProvider === 'Azure' ? (
                    <AzureInstallationInline projectId={project.id} resources={project.resources} />
                  ) : project.cloudProvider === 'AWS' ? (
                    <AwsInstallationInline
                      projectId={project.id}
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

      {/* Approve Modal */}
      <ApproveModal
        isOpen={approveModal.isOpen}
        onClose={() => {
          approveModal.close();
          setApproveComment('');
        }}
        onSubmit={() => doApprove(approveComment)}
        loading={submitting}
        value={approveComment}
        onChange={setApproveComment}
      />

      {/* Reject Modal */}
      <RejectModal
        isOpen={rejectModal.isOpen}
        onClose={() => {
          rejectModal.close();
          setRejectReason('');
        }}
        onSubmit={() => doReject(rejectReason)}
        loading={submitting}
        value={rejectReason}
        onChange={setRejectReason}
      />

      {/* Process Guide Modal */}
      {guide && (
        <ProcessGuideModal
          isOpen={guideModal.isOpen}
          onClose={guideModal.close}
          guide={guide}
          currentStepNumber={currentStep}
        />
      )}
    </div>
  );
};
