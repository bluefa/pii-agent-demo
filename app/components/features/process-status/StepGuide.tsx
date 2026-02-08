'use client';

import { statusColors, cn } from '@/lib/theme';
import { ProcessStatus } from '@/lib/types';
import type { CloudProvider } from '@/lib/types';

interface StepGuideProps {
  currentStep: ProcessStatus;
  cloudProvider?: CloudProvider;
}

const getStepGuideText = (status: ProcessStatus, provider?: CloudProvider): string => {
  switch (status) {
    case ProcessStatus.WAITING_TARGET_CONFIRMATION:
      if (provider === 'AWS') return 'AWS 계정의 리소스를 스캔하고 연동 대상을 선택하세요';
      return '리소스를 스캔하고 연동 대상을 선택하세요';
    case ProcessStatus.WAITING_APPROVAL:
      return '연동 대상이 확정되었습니다. 관리자 승인을 대기 중입니다';
    case ProcessStatus.INSTALLING:
      return 'PII Agent를 설치하고 있습니다';
    case ProcessStatus.WAITING_CONNECTION_TEST:
      return '설치가 완료되었습니다. DB 연결을 테스트하세요';
    case ProcessStatus.CONNECTION_VERIFIED:
      return 'DB 연결 확인 완료. 관리자 최종 승인 대기 중입니다';
    case ProcessStatus.INSTALLATION_COMPLETE:
      return 'PII Agent 연동이 완료되었습니다';
    default:
      return '';
  }
};

const getStepIcon = (status: ProcessStatus) => {
  const isComplete = status === ProcessStatus.INSTALLATION_COMPLETE;
  const bgClass = isComplete ? statusColors.success.bg : statusColors.info.bg;
  const iconClass = isComplete ? statusColors.success.text : statusColors.info.text;

  const iconPath = (() => {
    switch (status) {
      case ProcessStatus.WAITING_TARGET_CONFIRMATION:
        return 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z';
      case ProcessStatus.WAITING_APPROVAL:
        return 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z';
      case ProcessStatus.CONNECTION_VERIFIED:
      case ProcessStatus.INSTALLATION_COMPLETE:
        return 'M5 13l4 4L19 7';
      default:
        return 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
    }
  })();

  return { bgClass, iconClass, iconPath };
};

export const StepGuide = ({ currentStep, cloudProvider }: StepGuideProps) => {
  if (currentStep === ProcessStatus.INSTALLING ||
      currentStep === ProcessStatus.WAITING_CONNECTION_TEST) {
    return null;
  }

  const guideText = getStepGuideText(currentStep, cloudProvider);
  const { bgClass, iconClass, iconPath } = getStepIcon(currentStep);
  const isComplete = currentStep === ProcessStatus.INSTALLATION_COMPLETE;
  const textClass = isComplete ? statusColors.success.textDark : 'text-gray-900';

  return (
    <div className="flex items-center gap-3 mb-4">
      <div className={cn('w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0', bgClass)}>
        <svg className={cn('w-4 h-4', iconClass)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={iconPath} />
        </svg>
      </div>
      <p className={cn('font-medium text-sm', textClass)}>{guideText}</p>
    </div>
  );
};
