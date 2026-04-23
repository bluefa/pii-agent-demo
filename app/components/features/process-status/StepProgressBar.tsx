'use client';

import { ProcessStatus } from '@/lib/types';
import { cn, primaryColors, statusColors } from '@/lib/theme';

export const steps = [
  { step: ProcessStatus.WAITING_TARGET_CONFIRMATION, label: '연동 대상 DB 선택' },
  { step: ProcessStatus.WAITING_APPROVAL, label: '연동 대상 승인 대기' },
  { step: ProcessStatus.APPLYING_APPROVED, label: '연동 대상 반영중' },
  { step: ProcessStatus.INSTALLING, label: 'Agent 설치' },
  { step: ProcessStatus.WAITING_CONNECTION_TEST, label: '연결 테스트' },
  { step: ProcessStatus.CONNECTION_VERIFIED, label: '관리자 승인 대기' },
  { step: ProcessStatus.INSTALLATION_COMPLETE, label: '완료' },
];

const checkIcon = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

interface StepProgressBarProps {
  currentStep?: ProcessStatus;
  customSteps?: ProgressBarStep[];
}

export type ProgressBarStepState = 'completed' | 'current' | 'pending';

export interface ProgressBarStep {
  id: string;
  label: string;
  state: ProgressBarStepState;
}

const toDefaultProgressSteps = (currentStep: ProcessStatus): ProgressBarStep[] =>
  steps.map((item, index) => {
    const isCompleted = currentStep > item.step;
    const isCurrent = currentStep === item.step;
    const isLast = index === steps.length - 1;
    const isCurrentComplete = isCurrent && isLast;

    return {
      id: String(item.step),
      label: item.label,
      state: isCompleted || isCurrentComplete ? 'completed' : isCurrent ? 'current' : 'pending',
    };
  });

export const StepProgressBar = ({ currentStep, customSteps }: StepProgressBarProps) => {
  const progressSteps = currentStep ? toDefaultProgressSteps(currentStep) : [];

  return (
    <div className="flex items-center gap-4 mb-6">
      <div className="flex items-center justify-between flex-1">
        {(customSteps ?? progressSteps).map((item, index, arr) => {
          const isCompleted = item.state === 'completed';
          const isCurrent = item.state === 'current';
          const isLast = index === arr.length - 1;

          return (
            <div key={item.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-200 border-2',
                    isCompleted && cn(statusColors.success.dot, 'text-white border-transparent'),
                    isCurrent && cn(primaryColors.bg, 'text-white border-transparent', primaryColors.haloRing),
                    !isCompleted && !isCurrent && cn(
                      statusColors.pending.bg,
                      statusColors.pending.text,
                      'border-transparent',
                      primaryColors.borderHoverBase,
                      primaryColors.textHoverBase
                    )
                  )}
                >
                  {isCompleted ? checkIcon : String(index + 1).padStart(2, '0')}
                </div>
                <span
                  className={cn(
                    'mt-1.5 text-xs text-center max-w-[120px] leading-tight break-words',
                    isCompleted && cn(statusColors.success.textDark, 'font-medium'),
                    isCurrent && cn(primaryColors.text, 'font-semibold'),
                    !isCompleted && !isCurrent && statusColors.pending.text
                  )}
                >
                  {item.label}
                </span>
              </div>
              {!isLast && (
                <div className="flex-1 mx-1 mt-[-24px]">
                  <div
                    className={cn(
                      'h-[2px] rounded-full',
                      isCompleted ? statusColors.success.dot : statusColors.pending.bg
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
