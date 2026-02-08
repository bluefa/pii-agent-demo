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
          className={cn(getButtonClass('ghost', 'sm'), 'flex items-center gap-1.5 shrink-0')}
          aria-label="전체 프로세스 가이드 보기"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <span className="text-xs">전체 가이드</span>
        </button>
      )}
    </div>
  );
};
