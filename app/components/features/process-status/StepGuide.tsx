'use client';

import { statusColors, textColors, borderColors, cn } from '@/lib/theme';
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
    case ProcessStatus.APPLYING_APPROVED:
      return '승인이 완료되어 연동 대상을 반영하고 있습니다';
    case ProcessStatus.INSTALLING:
      return 'PII Agent를 설치하고 있습니다';
    case ProcessStatus.WAITING_CONNECTION_TEST:
      return '설치가 완료되었습니다. 연결 테스트를 실행해 주세요';
    case ProcessStatus.CONNECTION_VERIFIED:
      return '연결이 확인되었습니다. 운영 인력이 최종 확인 중입니다';
    default:
      return '';
  }
};

const ICON_PATHS: Partial<Record<ProcessStatus, string>> = {
  [ProcessStatus.WAITING_TARGET_CONFIRMATION]: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  [ProcessStatus.WAITING_APPROVAL]: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  [ProcessStatus.WAITING_CONNECTION_TEST]: 'M13 10V3L4 14h7v7l9-11h-7z',
  [ProcessStatus.CONNECTION_VERIFIED]: 'M5 13l4 4L19 7',
};
const DEFAULT_ICON_PATH = 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z';

// --- Step 6 전용: 연결 확인 안내 카드 ---

const ConnectionVerifiedGuide = () => (
  <div className={cn('mb-4 rounded-lg border bg-white p-4', borderColors.default)}>
    <div className="flex items-start gap-3">
      <div className={cn('w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0', statusColors.info.bg)}>
        <svg className={cn('w-4 h-4', statusColors.info.text)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <div className="space-y-2">
        <p className={cn('text-sm font-medium', textColors.primary)}>
          연결이 확인되었습니다
        </p>
        <div className={cn('text-sm space-y-1', textColors.tertiary)}>
          <p>운영 인력이 PII Agent 연동이 마무리되었는지 확인하고 있습니다.</p>
          <p>필요한 작업이 있다면 추후에 공유드리도록 하겠습니다.</p>
        </div>
      </div>
    </div>
  </div>
);

// --- 기본 Step 가이드 ---

export const StepGuide = ({ currentStep, cloudProvider }: StepGuideProps) => {
  if (currentStep === ProcessStatus.APPLYING_APPROVED ||
      currentStep === ProcessStatus.INSTALLING) {
    return null;
  }

  if (currentStep === ProcessStatus.CONNECTION_VERIFIED) {
    return <ConnectionVerifiedGuide />;
  }

  if (currentStep === ProcessStatus.INSTALLATION_COMPLETE) {
    return (
      <div className="flex items-center gap-3 mb-4">
        <div className={cn('w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0', statusColors.success.bg)}>
          <svg className={cn('w-4 h-4', statusColors.success.text)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className={cn('font-medium text-sm', textColors.primary)}>PII Agent 연동이 완료되었습니다</p>
      </div>
    );
  }

  const guideText = getStepGuideText(currentStep, cloudProvider);
  const iconPath = ICON_PATHS[currentStep] ?? DEFAULT_ICON_PATH;

  return (
    <div className="flex items-center gap-3 mb-4">
      <div className={cn('w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0', statusColors.info.bg)}>
        <svg className={cn('w-4 h-4', statusColors.info.text)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={iconPath} />
        </svg>
      </div>
      <p className={cn('font-medium text-sm', textColors.primary)}>{guideText}</p>
    </div>
  );
};
