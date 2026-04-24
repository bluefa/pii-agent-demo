import { ProcessStatus } from '@/lib/types';
import { statusColors, primaryColors, cn } from '@/lib/theme';
import { idcSteps } from './constants';

export const IdcStepProgressBar = ({ currentStep }: { currentStep: ProcessStatus }) => {
  const getIdcStepIndex = (step: ProcessStatus): number => {
    if (step === ProcessStatus.WAITING_TARGET_CONFIRMATION) return 0;
    if (step === ProcessStatus.INSTALLING) return 1;
    if (step === ProcessStatus.WAITING_CONNECTION_TEST || step === ProcessStatus.CONNECTION_VERIFIED) return 2;
    if (step === ProcessStatus.INSTALLATION_COMPLETE) return 3;
    return 0;
  };

  const currentIndex = getIdcStepIndex(currentStep);

  return (
    <div className="flex items-center justify-between mb-6">
      {idcSteps.map((item, index) => {
        const isCompleted = currentIndex > index;
        const isCurrent = currentIndex === index;
        const isLast = index === idcSteps.length - 1;

        return (
          <div key={item.step} className="flex items-center flex-1">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-200',
                  isCompleted
                    ? 'bg-green-500 text-white'
                    : isCurrent
                    ? cn(statusColors.info.dot, 'text-white ring-2', statusColors.info.ring)
                    : 'bg-gray-100 text-gray-400',
                )}
              >
                {isCompleted ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  index + 1
                )}
              </div>
              <span
                className={cn(
                  'mt-1.5 text-xs text-center max-w-[70px] leading-tight',
                  isCompleted
                    ? 'text-green-600 font-medium'
                    : isCurrent
                    ? cn(primaryColors.text, 'font-medium')
                    : 'text-gray-400',
                )}
              >
                {item.label}
              </span>
            </div>
            {!isLast && (
              <div className="flex-1 mx-1 mt-[-20px]">
                <div
                  className={cn(
                    'h-0.5 rounded-full',
                    isCompleted ? 'bg-green-500' : 'bg-gray-200',
                  )}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
