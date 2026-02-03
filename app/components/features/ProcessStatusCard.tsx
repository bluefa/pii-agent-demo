'use client';

import { useState } from 'react';
import { ProcessStatus, Project, TerraformStatus, DBCredential } from '@/lib/types';
import { TerraformStatusModal } from './TerraformStatusModal';
import { approveProject, rejectProject } from '@/app/lib/api';
import { useModal } from '@/app/hooks/useModal';
import { useApiMutation } from '@/app/hooks/useApiMutation';
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
import { cn } from '@/lib/theme';

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
  const currentStep = project.processStatus;
  const progress = getProgress(project);
  const selectedResources = project.resources.filter((r) => r.isSelected);

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
                  ? 'border-blue-500 text-blue-600'
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
            <StepProgressBar currentStep={currentStep} />

            <div className="border-t border-gray-100 my-4" />

            <div className="flex-1 flex flex-col">
              <StepGuide currentStep={currentStep} />

              {/* Action Buttons */}
              <div className="mt-auto pt-4">
                {currentStep === ProcessStatus.WAITING_TARGET_CONFIRMATION && (
                  <button
                    disabled
                    className="w-full px-4 py-2.5 bg-gray-100 text-gray-400 rounded-lg font-medium cursor-not-allowed"
                  >
                    PII Agent 연동 대상 확정 (Phase 3)
                  </button>
                )}

                {currentStep === ProcessStatus.WAITING_APPROVAL && (
                  <div className="flex gap-2">
                    {isAdmin ? (
                      <>
                        <button
                          onClick={() => approveModal.open()}
                          className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
                        >
                          승인
                        </button>
                        <button
                          onClick={() => rejectModal.open()}
                          className="flex-1 px-4 py-2.5 bg-red-50 text-red-600 border border-red-200 rounded-lg font-medium hover:bg-red-100 transition-colors"
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
                    <AwsInstallationInline projectId={project.id} />
                  ) : (
                    <button
                      onClick={() => terraformModal.open()}
                      className="w-full flex items-center justify-between px-4 py-2.5 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                        <span className="font-medium text-orange-600">설치 상태 확인</span>
                      </div>
                      <span className="px-2 py-0.5 bg-orange-100 text-orange-500 text-sm font-medium rounded-full">
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
    </div>
  );
};
