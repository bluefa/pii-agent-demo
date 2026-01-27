'use client';

import { ProcessStatus } from '../../../../lib/types';

export const steps = [
  { step: ProcessStatus.WAITING_TARGET_CONFIRMATION, label: '연동 대상 확정' },
  { step: ProcessStatus.WAITING_APPROVAL, label: '승인 대기' },
  { step: ProcessStatus.INSTALLING, label: '설치 진행' },
  { step: ProcessStatus.WAITING_CONNECTION_TEST, label: '연결 테스트' },
  { step: ProcessStatus.CONNECTION_VERIFIED, label: '연결 확인' },
  { step: ProcessStatus.INSTALLATION_COMPLETE, label: '완료' },
];

interface StepProgressBarProps {
  currentStep: ProcessStatus;
}

export const StepProgressBar = ({ currentStep }: StepProgressBarProps) => {
  return (
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
  );
};
