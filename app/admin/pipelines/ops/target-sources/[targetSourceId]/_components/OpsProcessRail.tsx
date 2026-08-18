'use client';

/**
 * 7-step process rail, Figma 4:2 fidelity — completed steps are PRIMARY blue
 * (check circle + blue connector), the current step is an outlined blue circle
 * with a plain number, pending steps are gray-bordered circles. This exists
 * because the shared ProcessProgressBar is green/zero-padded (house style) and
 * the ops console follows the Figma redesign instead.
 */
import type { ReactElement } from 'react';
import { cn } from '@/lib/theme';
import { STEP, type ProcessStatus } from '@/app/admin/pipelines/queue/_components/StepStack';

const ORDER: readonly ProcessStatus[] = [
  'IDLE', 'PENDING', 'CONFIRMING', 'CONFIRMED', 'INSTALLED', 'CONNECTED', 'COMPLETED',
];

const CheckIcon = (): ReactElement => (
  <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" aria-hidden>
    <path d="M2.5 6.2 4.9 8.6 9.5 3.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export interface OpsProcessRailProps {
  status: ProcessStatus;
}

export function OpsProcessRail({ status }: OpsProcessRailProps): ReactElement {
  const currentIndex = ORDER.indexOf(status);
  return (
    <ol className="flex" aria-label="설치 진행 단계">
      {ORDER.map((step, index) => {
        // The final step has no "current" look — reaching it means done.
        const done = index < currentIndex || (index === currentIndex && index === ORDER.length - 1);
        const current = !done && index === currentIndex;
        return (
          // The rail is the only thing naming the current step in this card, so
          // the marker has to be in the tree, not only in the styling.
          <li
            key={step}
            aria-current={current ? 'step' : undefined}
            className="relative flex-1 text-center"
          >
            {index > 0 && (
              <span
                aria-hidden
                className={cn(
                  'absolute left-[-50%] top-[12px] h-[2px] w-full',
                  done || current ? 'bg-[var(--pl-primary)]' : 'bg-[var(--pl-gray-200)]',
                )}
              />
            )}
            <span
              className={cn(
                'relative z-[1] mx-auto flex h-[26px] w-[26px] items-center justify-center rounded-full text-[12px] font-semibold',
                done && 'bg-[var(--pl-primary)] text-white',
                current
                  && 'border-2 border-[var(--pl-primary)] bg-[var(--pl-bg-card)] text-[var(--pl-primary)]',
                !done && !current
                  && 'border border-[var(--pl-gray-300)] bg-[var(--pl-bg-card)] text-[var(--pl-text-faint)]',
              )}
            >
              {done ? <CheckIcon /> : STEP[step].n}
            </span>
            <span
              className={cn(
                'mt-2 block text-[12px]',
                current
                  ? 'font-semibold text-[var(--pl-primary)]'
                  : done
                    ? 'text-[var(--pl-text-medium)]'
                    : 'text-[var(--pl-text-weak)]',
              )}
            >
              {STEP[step].label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
