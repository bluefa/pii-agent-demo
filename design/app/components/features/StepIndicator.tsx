'use client';

import { ProcessStatus } from '@/lib/types';
import { statusColors, primaryColors } from '@/lib/theme';

interface StepIndicatorProps {
  currentStep: ProcessStatus;
}

const steps = [
  { step: ProcessStatus.WAITING_TARGET_CONFIRMATION, label: '연동 대상 확정 대기' },
  { step: ProcessStatus.WAITING_APPROVAL, label: '승인 대기' },
  { step: ProcessStatus.APPLYING_APPROVED, label: '연동대상 반영 중' },
  { step: ProcessStatus.INSTALLING, label: '설치 진행 중' },
  { step: ProcessStatus.WAITING_CONNECTION_TEST, label: '연결 테스트 필요' },
  { step: ProcessStatus.INSTALLATION_COMPLETE, label: '설치 완료' },
];

export const StepIndicator = ({ currentStep }: StepIndicatorProps) => {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between">
        {steps.map((item, index) => {
          const isCompleted = currentStep > item.step;
          const isCurrent = currentStep === item.step;
          const isLast = index === steps.length - 1;

          return (
            <div key={item.step} className="flex items-center flex-1">
              {/* Step Circle & Label */}
              <div className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 ${
                    isCompleted
                      ? 'bg-green-500 text-white'
                      : isCurrent
                      ? `${statusColors.info.dot} text-white ring-4 ${statusColors.info.bg}`
                      : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {isCompleted ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <span className="text-sm font-semibold">{item.step}</span>
                  )}
                </div>
                <span
                  className={`mt-2 text-xs font-medium text-center max-w-[100px] ${
                    isCompleted
                      ? 'text-green-600'
                      : isCurrent
                      ? primaryColors.text
                      : 'text-gray-400'
                  }`}
                >
                  {item.label}
                </span>
              </div>

              {/* Connector Line */}
              {!isLast && (
                <div className="flex-1 mx-2 mt-[-24px]">
                  <div
                    className={`h-1 rounded-full transition-all duration-200 ${
                      isCompleted ? 'bg-green-500' : 'bg-gray-200'
                    }`}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
