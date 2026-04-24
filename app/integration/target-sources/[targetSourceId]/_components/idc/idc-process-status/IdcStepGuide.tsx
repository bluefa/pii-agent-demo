import { ProcessStatus } from '@/lib/types';
import { statusColors, primaryColors, cn } from '@/lib/theme';

export const IdcStepGuide = ({ currentStep }: { currentStep: ProcessStatus }) => {
  const getGuideText = (): string => {
    switch (currentStep) {
      case ProcessStatus.WAITING_TARGET_CONFIRMATION:
        return '연결할 데이터베이스 정보를 입력하세요';
      case ProcessStatus.INSTALLING:
        return 'BDC에서 환경을 구성하고 있습니다';
      case ProcessStatus.WAITING_CONNECTION_TEST:
      case ProcessStatus.CONNECTION_VERIFIED:
        return '설치가 완료되었습니다. DB 연결을 테스트하세요';
      case ProcessStatus.INSTALLATION_COMPLETE:
        return 'PII Agent 연동이 완료되었습니다.';
      default:
        return '';
    }
  };

  const guideText = getGuideText();

  return (
    <div className="flex items-start gap-3 mb-4">
      <div className={cn(
        'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
        currentStep === ProcessStatus.INSTALLATION_COMPLETE
          ? 'bg-green-100'
          : currentStep === ProcessStatus.INSTALLING
          ? 'bg-orange-100'
          : statusColors.info.bg,
      )}>
        {currentStep === ProcessStatus.INSTALLATION_COMPLETE ? (
          <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : currentStep === ProcessStatus.INSTALLING ? (
          <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        ) : (
          <svg className={cn('w-4 h-4', primaryColors.text)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
          </svg>
        )}
      </div>
      <div>
        <p className={cn(
          'font-medium',
          currentStep === ProcessStatus.INSTALLATION_COMPLETE
            ? 'text-green-700'
            : 'text-gray-900',
        )}>
          {guideText}
        </p>
      </div>
    </div>
  );
};
