'use client';

import { ProcessStatus } from '@/lib/types';

interface StepGuideProps {
  currentStep: ProcessStatus;
}

const getStepGuideText = (status: ProcessStatus): string => {
  switch (status) {
    case ProcessStatus.WAITING_TARGET_CONFIRMATION:
      return '연결할 리소스를 선택하고 연동 대상을 확정하세요';
    case ProcessStatus.WAITING_APPROVAL:
      return '관리자 승인을 기다리는 중입니다';
    case ProcessStatus.INSTALLING:
      return 'PII Agent를 설치하고 있습니다';
    case ProcessStatus.WAITING_CONNECTION_TEST:
      return '설치가 완료되었습니다. DB 연결을 테스트하세요';
    case ProcessStatus.CONNECTION_VERIFIED:
      return 'PII Agent 연결이 확인되었습니다. 관리자의 최종 확정을 기다리는 중입니다.';
    case ProcessStatus.INSTALLATION_COMPLETE:
      return 'PII Agent 연동이 완료되었습니다.';
    default:
      return '';
  }
};

export const StepGuide = ({ currentStep }: StepGuideProps) => {
  const guideText = getStepGuideText(currentStep);

  // 3단계(INSTALLING), 4단계(WAITING_CONNECTION_TEST)는 별도 패널에서 표시
  if (currentStep === ProcessStatus.INSTALLING ||
      currentStep === ProcessStatus.WAITING_CONNECTION_TEST) {
    return null;
  }

  return (
    <div className="flex items-start gap-3 mb-4">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
        currentStep === ProcessStatus.INSTALLATION_COMPLETE
          ? 'bg-green-100'
          : 'bg-blue-100'
      }`}>
        {currentStep === ProcessStatus.INSTALLATION_COMPLETE ? (
          <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
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
      </div>
    </div>
  );
};
