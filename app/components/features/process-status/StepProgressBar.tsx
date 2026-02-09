'use client';

import { ProcessStatus } from '@/lib/types';
import { cn, statusColors, getButtonClass } from '@/lib/theme';

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
  onGuideClick?: () => void;
}

export const StepProgressBar = ({ currentStep, onGuideClick }: StepProgressBarProps) => {
  return (
    <div className="flex items-center gap-4 mb-6">
      <div className="flex items-center justify-between flex-1">
        {steps.map((item, index) => {
          const isCompleted = currentStep > item.step;
          const isCurrent = currentStep === item.step;
          const isLast = index === steps.length - 1;

          return (
            <div key={item.step} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-200',
                    isCompleted && cn(statusColors.success.dot, 'text-white'),
                    isCurrent && cn(statusColors.info.dot, 'text-white ring-2', statusColors.info.border),
                    !isCompleted && !isCurrent && cn(statusColors.pending.bg, statusColors.pending.text)
                  )}
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
                  className={cn(
                    'mt-1.5 text-xs text-center max-w-[70px] leading-tight',
                    isCompleted && cn(statusColors.success.textDark, 'font-medium'),
                    isCurrent && cn(statusColors.info.textDark, 'font-medium'),
                    !isCompleted && !isCurrent && statusColors.pending.text
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
                      isCompleted ? statusColors.success.dot : statusColors.pending.bg
                    )}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {onGuideClick && (
        <button
          onClick={onGuideClick}
          className={cn(
            'flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150',
            statusColors.info.bg, statusColors.info.textDark,
            'hover:ring-1', statusColors.info.border
          )}
          aria-label="전체 프로세스 가이드 보기"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
          전체 가이드
        </button>
      )}
    </div>
  );
};
