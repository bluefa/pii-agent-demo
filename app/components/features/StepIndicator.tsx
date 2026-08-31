'use client';

import { ProcessStatus } from '@/lib/types';
import { useLocale } from '@/app/components/LocaleProvider';
import { SCAN_COPY, type ScanCopy } from '@/app/components/features/scan/copy';
import { statusColors, primaryColors, cn } from '@/lib/theme';

interface StepIndicatorProps {
  currentStep: ProcessStatus;
}

const stepList = (t: ScanCopy) => [
  { step: ProcessStatus.WAITING_TARGET_CONFIRMATION, label: t.stepTargetConfirmation },
  { step: ProcessStatus.WAITING_APPROVAL, label: t.stepApproval },
  { step: ProcessStatus.APPLYING_APPROVED, label: t.stepApplying },
  { step: ProcessStatus.INSTALLING, label: t.stepInstalling },
  { step: ProcessStatus.WAITING_CONNECTION_TEST, label: t.stepConnectionTest },
  { step: ProcessStatus.INSTALLATION_COMPLETE, label: t.stepComplete },
];

export const StepIndicator = ({ currentStep }: StepIndicatorProps) => {
  const { locale } = useLocale();
  const steps = stepList(SCAN_COPY[locale]);

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
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200',
                    isCompleted
                      ? 'bg-green-500 text-white'
                      : isCurrent
                      ? cn(statusColors.info.dot, 'text-white ring-4', statusColors.info.bg)
                      : 'bg-gray-100 text-gray-400',
                  )}
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
                  className={cn(
                    'mt-2 text-xs font-medium text-center max-w-[100px]',
                    isCompleted
                      ? 'text-green-600'
                      : isCurrent
                      ? primaryColors.text
                      : 'text-gray-400',
                  )}
                >
                  {item.label}
                </span>
              </div>

              {/* Connector Line */}
              {!isLast && (
                <div className="flex-1 mx-2 mt-[-24px]">
                  <div
                    className={cn(
                      'h-1 rounded-full transition-all duration-200',
                      isCompleted ? 'bg-green-500' : 'bg-gray-200',
                    )}
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
