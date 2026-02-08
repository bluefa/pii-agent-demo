'use client';

import { statusColors, cn } from '@/lib/theme';
import type { ProcessGuideStep } from '@/lib/types/process-guide';

export interface ProcessGuideTimelineProps {
  steps: ProcessGuideStep[];
  currentStepNumber: number;
  onStepClick: (stepNumber: number) => void;
}

export const ProcessGuideTimeline = ({ steps, currentStepNumber, onStepClick }: ProcessGuideTimelineProps) => {
  return (
    <nav aria-label="프로세스 단계" className="flex flex-col gap-0">
      {steps.map((step, idx) => {
        const isCompleted = step.stepNumber < currentStepNumber;
        const isCurrent = step.stepNumber === currentStepNumber;
        const isPending = step.stepNumber > currentStepNumber;
        const hasNext = idx < steps.length - 1;

        return (
          <div key={step.stepNumber} className="relative">
            <button
              onClick={() => onStepClick(step.stepNumber)}
              aria-current={isCurrent ? 'step' : undefined}
              aria-label={`Step ${step.stepNumber}: ${step.label} - ${status === 'completed' ? '완료' : status === 'current' ? '진행중' : '대기'}`}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
            >
              {/* 원형 아이콘 */}
              <div className="relative flex-shrink-0">
                {isCompleted && (
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center',
                    statusColors.success.bg,
                    statusColors.success.text
                  )}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
                {isCurrent && (
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center font-semibold ring-2 ring-offset-1',
                    statusColors.info.bg,
                    statusColors.info.text,
                    statusColors.info.border.replace('border-', 'ring-')
                  )}>
                    {step.stepNumber}
                  </div>
                )}
                {isPending && (
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center font-semibold border-2',
                    statusColors.pending.border,
                    statusColors.pending.textDark
                  )}>
                    {step.stepNumber}
                  </div>
                )}
              </div>

              {/* 단계 라벨 */}
              <span className={cn(
                'text-sm font-medium text-left',
                isCurrent ? 'text-gray-900' : 'text-gray-600'
              )}>
                {step.label}
              </span>
            </button>

            {/* 연결선 */}
            {hasNext && (
              <div className={cn(
                'absolute left-8 top-11 w-0.5 h-6 -translate-x-1/2',
                isCompleted ? statusColors.success.dot : 'bg-gray-200'
              )} />
            )}
          </div>
        );
      })}
    </nav>
  );
};

export default ProcessGuideTimeline;
