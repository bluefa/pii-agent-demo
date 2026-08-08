'use client';

import {
  WIZARD_STEPS,
  type WizardStep,
} from '@/app/components/features/project-create/wizard-model';
import {
  bgColors,
  borderColors,
  cn,
  primaryColors,
  textColors,
  tossShadow,
} from '@/lib/theme';

interface WizardRailProps {
  current: WizardStep;
  /** Undefined once the rail is frozen (step 5) — completed steps stop being links. */
  onNavigate?: (step: WizardStep) => void;
}

export const WizardRail = ({ current, onNavigate }: WizardRailProps) => (
  <nav
    aria-label="등록 단계"
    className={cn(
      'flex w-[216px] flex-shrink-0 flex-col gap-0.5 border-r px-[18px] py-[22px]',
      borderColors.light,
      bgColors.muted,
    )}
  >
    {WIZARD_STEPS.map(({ step, title, sublabel }) => {
      const isActive = step === current;
      const isDone = step < current;
      const canNavigate = isDone && onNavigate !== undefined;

      return (
        <button
          key={step}
          type="button"
          disabled={!canNavigate}
          aria-current={isActive ? 'step' : undefined}
          onClick={canNavigate ? () => onNavigate(step) : undefined}
          className={cn(
            'flex w-full items-start gap-2.5 rounded-[10px] px-2.5 py-2.5 text-left transition-colors',
            isActive && cn(bgColors.surface, tossShadow.sm),
            canNavigate && cn(bgColors.surfaceHover, 'cursor-pointer'),
            !canNavigate && !isActive && 'cursor-default',
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              'mt-px inline-flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold',
              isActive && cn(primaryColors.bg, primaryColors.border, textColors.inverse),
              isDone && cn(primaryColors.bgLight, 'border-transparent', primaryColors.textOnLight),
              !isActive && !isDone && cn(borderColors.strong, bgColors.surface, textColors.tertiary),
            )}
          >
            {isDone ? '✓' : step}
          </span>
          <span className="flex flex-col gap-px">
            <span
              className={cn(
                'text-sm',
                isActive
                  ? cn('font-bold', textColors.primary)
                  : cn('font-semibold', isDone ? textColors.secondary : textColors.tertiary),
              )}
            >
              {title}
            </span>
            {isActive && <span className={cn('text-xs', textColors.tertiary)}>{sublabel}</span>}
          </span>
        </button>
      );
    })}

    <p
      className={cn(
        'mt-auto border-t border-dashed px-2.5 pt-2.5 text-xs',
        borderColors.strong,
        textColors.tertiary,
      )}
    >
      등록은 최대 2건이에요. 마지막 단계에서 확인할 수 있어요.
    </p>
  </nav>
);
