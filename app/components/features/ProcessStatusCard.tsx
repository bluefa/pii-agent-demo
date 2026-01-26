'use client';

import { useState } from 'react';
import { ProcessStatus, Project, TerraformStatus } from '../../../lib/types';
import { TerraformStatusModal } from './TerraformStatusModal';

interface ProcessStatusCardProps {
  project: Project;
}

const getProgress = (project: Project) => {
  const items: TerraformStatus[] = [project.terraformState.bdcTf];
  if (project.cloudProvider === 'AWS' && project.terraformState.serviceTf) {
    items.unshift(project.terraformState.serviceTf);
  }
  const completed = items.filter(s => s === 'COMPLETED').length;
  return { completed, total: items.length };
};

const steps = [
  { step: ProcessStatus.WAITING_TARGET_CONFIRMATION, label: '연동 대상 확정' },
  { step: ProcessStatus.WAITING_APPROVAL, label: '승인 대기' },
  { step: ProcessStatus.INSTALLING, label: '설치 진행' },
  { step: ProcessStatus.WAITING_CONNECTION_TEST, label: '연결 테스트' },
  { step: ProcessStatus.INSTALLATION_COMPLETE, label: '완료' },
];

const getStepGuideText = (status: ProcessStatus) => {
  switch (status) {
    case ProcessStatus.WAITING_TARGET_CONFIRMATION:
      return '연결할 리소스를 선택하고 연동 대상을 확정하세요';
    case ProcessStatus.WAITING_APPROVAL:
      return '관리자 승인을 기다리는 중입니다';
    case ProcessStatus.INSTALLING:
      return 'PII Agent를 설치하고 있습니다';
    case ProcessStatus.WAITING_CONNECTION_TEST:
      return '설치가 완료되었습니다. DB 연결을 테스트하세요';
    case ProcessStatus.INSTALLATION_COMPLETE:
      return '설치 및 연결이 완료되었습니다';
    default:
      return '';
  }
};

export const ProcessStatusCard = ({ project }: ProcessStatusCardProps) => {
  const [showTerraformModal, setShowTerraformModal] = useState(false);
  const currentStep = project.processStatus;
  const guideText = getStepGuideText(currentStep);
  const progress = getProgress(project);

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 flex flex-col">
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
        프로세스 진행 상태
      </h3>

      {/* Compact Step Indicator */}
      <div className="flex items-center justify-between mb-6">
        {steps.map((item, index) => {
          const isCompleted = currentStep > item.step;
          const isCurrent = currentStep === item.step;
          const isLast = index === steps.length - 1;

          return (
            <div key={item.step} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-200 ${
                    isCompleted
                      ? 'bg-green-500 text-white'
                      : isCurrent
                      ? 'bg-blue-500 text-white ring-2 ring-blue-200'
                      : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {isCompleted ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    item.step
                  )}
                </div>
                <span
                  className={`mt-1.5 text-xs text-center max-w-[70px] leading-tight ${
                    isCompleted
                      ? 'text-green-600 font-medium'
                      : isCurrent
                      ? 'text-blue-600 font-medium'
                      : 'text-gray-400'
                  }`}
                >
                  {item.label}
                </span>
              </div>
              {!isLast && (
                <div className="flex-1 mx-1 mt-[-20px]">
                  <div
                    className={`h-0.5 rounded-full ${
                      isCompleted ? 'bg-green-500' : 'bg-gray-200'
                    }`}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Divider */}
      <div className="border-t border-gray-100 my-4" />

      {/* Current Step Guide */}
      <div className="flex-1 flex flex-col">
        <div className="flex items-start gap-3 mb-4">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
            currentStep === ProcessStatus.INSTALLATION_COMPLETE
              ? 'bg-green-100'
              : currentStep === ProcessStatus.INSTALLING
              ? 'bg-orange-100'
              : 'bg-blue-100'
          }`}>
            {currentStep === ProcessStatus.INSTALLATION_COMPLETE ? (
              <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : currentStep === ProcessStatus.INSTALLING ? (
              <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            )}
          </div>
          <div>
            <p className={`font-medium ${
              currentStep === ProcessStatus.INSTALLATION_COMPLETE
                ? 'text-green-700'
                : 'text-gray-900'
            }`}>
              {guideText}
            </p>
            {currentStep === ProcessStatus.INSTALLING && (
              <p className="text-sm text-gray-500 mt-1">
                설치가 완료되면 자동으로 다음 단계로 진행됩니다.
              </p>
            )}
          </div>
        </div>

        {/* Action Buttons Placeholder */}
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
              <button
                disabled
                className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-400 rounded-lg font-medium cursor-not-allowed"
              >
                승인 (Phase 3)
              </button>
              <button
                disabled
                className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-400 rounded-lg font-medium cursor-not-allowed"
              >
                반려 (Phase 3)
              </button>
            </div>
          )}
          {currentStep === ProcessStatus.INSTALLING && (
            <button
              onClick={() => setShowTerraformModal(true)}
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
          )}
          {currentStep === ProcessStatus.WAITING_CONNECTION_TEST && (
            <button
              disabled
              className="w-full px-4 py-2.5 bg-gray-100 text-gray-400 rounded-lg font-medium cursor-not-allowed"
            >
              Test Connection (Phase 3)
            </button>
          )}
          {currentStep === ProcessStatus.INSTALLATION_COMPLETE && (
            <div className="flex items-center justify-center gap-2 py-2 text-green-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-medium">모든 설치가 완료되었습니다</span>
            </div>
          )}
        </div>
      </div>

      {/* Terraform Status Modal */}
      {showTerraformModal && (
        <TerraformStatusModal
          terraformState={project.terraformState}
          cloudProvider={project.cloudProvider}
          onClose={() => setShowTerraformModal(false)}
        />
      )}
    </div>
  );
};
