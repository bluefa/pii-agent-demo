'use client';

/**
 * Guide CMS — admin preview compact timeline.
 *
 * Spec: docs/reports/guide-cms/wave-tasks/W3-c-preview.md §Step 2 +
 * design/guide-cms/components.md §2 ProcessTimelineCompact +
 * W3-d-design-polish.md §Step 9.
 *
 * 7-column grid with a horizontal connector through the dot centers.
 * Done / current dots are filled with the primary color; current
 * additionally gets a soft halo. Labels sit beneath each column with
 * tabular-nums alignment.
 */

import {
  bgColors,
  borderColors,
  cn,
  numericFeatures,
  primaryColors,
  textColors,
} from '@/lib/theme';

interface Props {
  currentStep: number;
  totalSteps: number;
}

export const ProcessTimelineCompact = ({ currentStep, totalSteps }: Props) => {
  const steps = Array.from({ length: totalSteps }, (_, idx) => idx + 1);

  return (
    <div
      role="img"
      aria-label={`${currentStep}단계 / 총 ${totalSteps}단계`}
      className={cn(
        'flex flex-col gap-2 px-1 pt-3 pb-4 mb-3.5 border-b',
        borderColors.light,
      )}
    >
      <div
        className="relative grid items-center"
        style={{ gridTemplateColumns: `repeat(${totalSteps}, minmax(0, 1fr))` }}
      >
        {/* Connector line — sits behind dots, ends at the center of the
            first and last column (1/(2N) on each side). */}
        <span
          aria-hidden="true"
          className={cn('absolute top-1/2 h-px -translate-y-1/2', bgColors.divider)}
          style={{
            left: `calc(100% / ${totalSteps * 2})`,
            right: `calc(100% / ${totalSteps * 2})`,
          }}
        />
        {steps.map((stepNumber) => {
          const isCurrent = stepNumber === currentStep;
          const isCompleted = stepNumber < currentStep;
          return (
            <span key={stepNumber} className="relative z-10 flex items-center justify-center">
              <span
                aria-current={isCurrent ? 'step' : undefined}
                className={cn(
                  'block w-3.5 h-3.5 rounded-full border-2 transition-colors',
                  'motion-reduce:transition-none',
                  isCurrent || isCompleted
                    ? cn(primaryColors.bg, primaryColors.border)
                    : cn(bgColors.surface, borderColors.strong),
                  isCurrent && primaryColors.haloRing,
                )}
              />
            </span>
          );
        })}
      </div>
      <div
        className="grid text-center"
        style={{ gridTemplateColumns: `repeat(${totalSteps}, minmax(0, 1fr))` }}
      >
        {steps.map((stepNumber) => {
          const isCurrent = stepNumber === currentStep;
          return (
            <span
              key={stepNumber}
              className={cn(
                'text-[10.5px]',
                numericFeatures.tabular,
                isCurrent
                  ? cn(primaryColors.text, 'font-semibold')
                  : textColors.tertiary,
              )}
            >
              {stepNumber}
            </span>
          );
        })}
      </div>
    </div>
  );
};
