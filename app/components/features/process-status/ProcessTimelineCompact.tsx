'use client';

/**
 * Guide CMS — admin preview compact timeline.
 *
 * Spec: docs/reports/guide-cms/wave-tasks/W3-c-preview.md §Step 2 +
 * design/guide-cms/components.md §2 ProcessTimelineCompact.
 *
 * One-line, 7-dot indicator that mirrors the full provider timeline
 * but in a slot small enough to sit above the GuideCard preview. The
 * existing `ProcessGuideTimeline` is a vertical, click-to-navigate
 * stepper — different concerns, different shape, so a separate file
 * is the simpler choice.
 */

import { borderColors, cn, primaryColors, textColors } from '@/lib/theme';

interface Props {
  currentStep: number;
  totalSteps: number;
}

export const ProcessTimelineCompact = ({ currentStep, totalSteps }: Props) => {
  const steps = Array.from({ length: totalSteps }, (_, idx) => idx + 1);

  return (
    <ol
      aria-label="단계 표시"
      className="flex items-center gap-2 py-2"
    >
      {steps.map((stepNumber, idx) => {
        const isCurrent = stepNumber === currentStep;
        const isCompleted = stepNumber < currentStep;
        const isLast = idx === steps.length - 1;

        return (
          <li key={stepNumber} className="flex items-center gap-2">
            <span
              aria-current={isCurrent ? 'step' : undefined}
              className={cn(
                'flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-semibold transition-colors',
                'motion-reduce:transition-none',
                isCurrent
                  ? cn(primaryColors.bg, textColors.inverse)
                  : isCompleted
                    ? cn(primaryColors.bgLight, primaryColors.text)
                    : cn('border', borderColors.default, textColors.quaternary),
              )}
            >
              {stepNumber}
            </span>
            {!isLast && (
              <span
                aria-hidden="true"
                className={cn(
                  'w-4 h-px',
                  isCompleted ? primaryColors.bg : 'bg-gray-200',
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
};
