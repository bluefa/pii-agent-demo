'use client';

import {
  WIZARD_STEPS,
  type WizardStep,
} from '@/app/components/features/project-create/wizard-model';
import { bgColors, borderColors, cn, primaryColors, textColors } from '@/lib/theme';

interface WizardRailProps {
  current: WizardStep;
  /** Undefined once the rail is frozen (step 5) — completed steps stop being links. */
  onNavigate?: (step: WizardStep) => void;
}

/**
 * A connector segment drawn behind the dots. It is what makes the rail's full-height
 * spread mean something: the five rows are far apart because they are points along a
 * path, and the blue portion says how much of that path is behind you.
 *
 * Drawn per row rather than as one bar over the whole rail so the geometry stays exact
 * no matter how tall a row is — each row owns the half-segment above its own dot and
 * the half below it, and the two halves meet on the row boundary. That is also why the
 * rows are contiguous (no gap): a gap would break the line.
 *
 * `left-[21px]` = the button's 10px padding + half the 22px dot.
 */
const SpineSegment = ({ half, traversed }: { half: 'top' | 'bottom'; traversed: boolean }) => (
  <span
    aria-hidden="true"
    className={cn(
      'absolute left-[21px] h-1/2 w-[2px] -translate-x-1/2',
      half === 'top' ? 'top-0' : 'bottom-0',
      traversed ? primaryColors.bg : bgColors.strong,
    )}
  />
);

export const WizardRail = ({ current, onNavigate }: WizardRailProps) => (
  <nav
    aria-label="등록 단계"
    className={cn(
      // 256, not 216: at 216 the text column was 148px and 「사용하는 Database 확인」
      // wrapped onto a second line with the rail's own right margin still empty.
      // The modal grew by the same 40px so the content pane keeps its width.
      'flex w-[256px] flex-shrink-0 flex-col border-r px-[18px] py-[22px]',
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
            // No surface, no shadow: the active step is marked by the filled dot and
            // the weight of its label. A card here would be a 110px box around 58px of
            // text — it read as a mis-sized container rather than as emphasis.
            'group relative flex w-full flex-1 items-center gap-2.5 px-2.5 py-2.5 text-left',
            canNavigate ? 'cursor-pointer' : 'cursor-default',
          )}
        >
          {/* The segment above the dot belongs to the step before it, the one below to
              the step after — hence the two different comparisons. */}
          {step > 1 && <SpineSegment half="top" traversed={step <= current} />}
          {step < WIZARD_STEPS.length && (
            <SpineSegment half="bottom" traversed={step < current} />
          )}

          <span
            aria-hidden="true"
            className={cn(
              // `relative`: the dot's own fill is what masks the line running behind it.
              'relative inline-flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold',
              isActive && cn(primaryColors.bg, primaryColors.border, textColors.inverse),
              isDone && cn(primaryColors.bgLight, 'border-transparent', primaryColors.textOnLight),
              !isActive && !isDone && cn(borderColors.strong, bgColors.surface, textColors.tertiary),
            )}
          >
            {isDone ? '✓' : step}
          </span>
          <span className="relative flex flex-col gap-px">
            {/* The dot is aria-hidden, so without this a completed row announces as
                bare title text with no sign it is done or that it can be revisited. */}
            <span className="sr-only">{isDone ? '완료' : isActive ? '진행 중' : '대기'}</span>
            <span
              className={cn(
                'text-sm transition-colors',
                isActive
                  ? cn('font-bold', textColors.primary)
                  : cn('font-semibold', isDone ? textColors.secondary : textColors.tertiary),
                // The label carries the go-back affordance now that no row background
                // does — a 110px hover block would bring the card problem back.
                canNavigate && primaryColors.groupTextOnLight,
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
