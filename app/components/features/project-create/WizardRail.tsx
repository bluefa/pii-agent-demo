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
  /** The dialog's `aria-labelledby` target — the rail carries the modal's title. */
  titleId: string;
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

export const WizardRail = ({ current, onNavigate, titleId }: WizardRailProps) => (
  // Full height, top to bottom. The title used to sit in a banner above both columns,
  // which put a hairline straight across the dialog and started the gray under it at a
  // T-junction. With the column running the whole way, the only division left is its
  // own edge — and the dialog's title stops competing with the step's heading opposite.
  // No surface and no border of its own: the column sits straight on the dialog's gray
  // ground, and the 8px gutter to the content card is the whole separation. 248/px-14
  // keeps the same 168px text column the old 256/px-18 had, now that the gutter and the
  // card's own padding do the spacing the border used to.
  <div className="flex w-[248px] flex-shrink-0 flex-col px-[14px] pb-[22px] pt-6">
    <div className="px-2.5 pb-5">
      <h2 id={titleId} className={cn('text-lg font-bold', textColors.primary)}>
        인프라 등록
      </h2>
      {/* `break-keep`: at 14px this wraps in the 224px column, and the default rule
          breaks mid-word ("등록해 / 요."). Korean wants word-level breaks. */}
      <p className={cn('mt-1 break-keep text-sm leading-relaxed', textColors.tertiary)}>
        PII 모니터링을 시작할 인프라를 등록해요.
      </p>
    </div>

    <nav aria-label="등록 단계" className="flex flex-1 flex-col">
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
  </div>
);
