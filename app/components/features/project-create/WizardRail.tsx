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
      // 256, not 216: at 216 the text column was 148px and 「사용하는 Database 확인」
      // wrapped onto a second line with the rail's own right margin still empty.
      // The modal grew by the same 40px so the content pane keeps its width.
      'flex w-[256px] flex-shrink-0 flex-col gap-1 border-r px-[18px] py-[22px]',
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
            // `flex-1`: the five rows split the rail's full height instead of stacking
            // at the top over 300px of empty gray.
            'flex w-full flex-1 items-center gap-2.5 rounded-[10px] px-2.5 py-2.5 text-left transition-colors',
            isActive && cn(bgColors.surface, tossShadow.sm),
            canNavigate && cn(bgColors.surfaceHover, 'cursor-pointer'),
            !canNavigate && !isActive && 'cursor-default',
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              'inline-flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold',
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

  </nav>
);
