'use client';

import { useMemo, useRef } from 'react';
import { CheckIcon } from '@/app/components/ui/icons';
import { useIsomorphicLayoutEffect } from '@/lib/hooks/useIsomorphicLayoutEffect';
import { useReducedMotion } from '@/lib/hooks/useReducedMotion';
import { cn } from '@/lib/theme';
import {
  runStepperMotion,
  type StepState,
} from '@/app/components/features/process-status/motion/stepperMotionEngine';

export interface ProgressBarStep {
  id: string;
  label: string;
  state: StepState;
}

interface ProcessProgressBarProps {
  steps: ProgressBarStep[];
  ariaLabel: string;
}

const findActiveIndex = (items: readonly ProgressBarStep[]): number => {
  const cur = items.findIndex((s) => s.state === 'current');
  if (cur >= 0) return cur;
  let last = -1;
  for (let i = 0; i < items.length; i++) {
    if (items[i].state === 'completed') last = i;
  }
  return last;
};

export const ProcessProgressBar = ({
  steps,
  ariaLabel,
}: ProcessProgressBarProps) => {
  const reduced = useReducedMotion();
  const activeIndex = findActiveIndex(steps);

  const fillRefs = useRef<Array<HTMLDivElement | null>>([]);
  const circleRefs = useRef<Array<HTMLDivElement | null>>([]);
  const iconNumberRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const iconCheckRefs = useRef<Array<HTMLSpanElement | null>>([]);

  const prevSnapshotRef = useRef<{
    idx: number;
    ids: string[];
    states: StepState[];
  }>({
    idx: activeIndex,
    ids: steps.map((s) => s.id),
    states: steps.map((s) => s.state),
  });
  const hasMountedRef = useRef(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  const snapshotKey = useMemo(
    () =>
      steps.map((s) => `${s.id}:${s.state}`).join('|') + `:${steps.length}`,
    [steps],
  );

  useIsomorphicLayoutEffect(() => {
    const currentIds = steps.map((s) => s.id);
    const currentStates = steps.map((s) => s.state);

    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      prevSnapshotRef.current = {
        idx: activeIndex,
        ids: currentIds,
        states: currentStates,
      };
      return;
    }

    const prev = prevSnapshotRef.current;
    const sameLen = prev.ids.length === currentIds.length;
    const sameIds = sameLen && prev.ids.every((id, i) => id === currentIds[i]);
    const sameStates =
      sameLen && prev.states.every((s, i) => s === currentStates[i]);
    if (prev.idx === activeIndex && sameIds && sameStates) {
      return;
    }

    cleanupRef.current?.();

    if (reduced) {
      prevSnapshotRef.current = {
        idx: activeIndex,
        ids: currentIds,
        states: currentStates,
      };
      cleanupRef.current = null;
      return;
    }

    cleanupRef.current = runStepperMotion({
      fromIndex: prev.idx,
      toIndex: activeIndex,
      fromStates: prev.states,
      toStates: currentStates,
      fillRefs: fillRefs.current,
      circleRefs: circleRefs.current,
      iconNumberRefs: iconNumberRefs.current,
      iconCheckRefs: iconCheckRefs.current,
      onDone: () => {
        cleanupRef.current = null;
      },
    });

    prevSnapshotRef.current = {
      idx: activeIndex,
      ids: currentIds,
      states: currentStates,
    };

    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [activeIndex, snapshotKey, reduced]);

  return (
    <nav aria-label={ariaLabel} className="mb-6">
      <ol
        role="list"
        className="grid items-start"
        style={{
          gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))`,
        }}
      >
        {steps.map((step, index) => {
          const isCompleted = step.state === 'completed';
          const isCurrent = step.state === 'current';
          const isLast = index === steps.length - 1;
          return (
            <li
              key={step.id}
              aria-current={isCurrent ? 'step' : undefined}
              className="relative flex items-start justify-center min-w-0"
            >
              <div className="flex flex-col items-center w-full relative z-[2]">
                <div
                  ref={(el) => {
                    circleRefs.current[index] = el;
                  }}
                  className={cn(
                    'relative w-10 h-10 rounded-full grid place-items-center font-mono text-xs font-semibold',
                    'transition-shadow duration-200 ease-out',
                    isCurrent &&
                      'bg-[#0064FF] text-white shadow-[0_0_0_6px_rgba(0,100,255,0.10)]',
                    isCompleted && 'bg-[#45CB85] text-white',
                    !isCurrent && !isCompleted && 'bg-[#F3F4F6] text-[#9CA3AF]',
                  )}
                  style={{ willChange: 'transform, background-color' }}
                >
                  <span
                    ref={(el) => {
                      iconNumberRefs.current[index] = el;
                    }}
                    aria-hidden="true"
                    className="absolute inset-0 grid place-items-center"
                    style={{ opacity: isCompleted ? 0 : 1 }}
                  >
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span
                    ref={(el) => {
                      iconCheckRefs.current[index] = el;
                    }}
                    aria-hidden="true"
                    className="absolute inset-0 grid place-items-center"
                    style={{ opacity: isCompleted ? 1 : 0 }}
                  >
                    <CheckIcon className="w-4 h-4" />
                  </span>
                </div>
                <span
                  className={cn(
                    'mt-2.5 text-xs font-medium text-center max-w-[130px] leading-[1.35]',
                    'transition-colors duration-[220ms] ease-out motion-reduce:transition-none',
                    isCurrent && 'text-[#0064FF] font-semibold',
                    isCompleted && 'text-[#2A7D52]',
                    !isCurrent && !isCompleted && 'text-[#9CA3AF]',
                  )}
                  style={{ wordBreak: 'keep-all' }}
                >
                  {step.label}
                </span>
              </div>
              {!isLast && (
                <div
                  className="absolute h-[2px] bg-[#E5E7EB] rounded-[2px] overflow-hidden z-[1]"
                  style={{
                    top: '19px',
                    left: 'calc(50% + 24px)',
                    right: 'calc(-50% + 24px)',
                  }}
                >
                  <div
                    ref={(el) => {
                      fillRefs.current[index] = el;
                    }}
                    className="absolute inset-0 bg-[#45CB85] rounded-[2px]"
                    style={{
                      transform: isCompleted ? 'scaleX(1)' : 'scaleX(0)',
                      transformOrigin: 'left center',
                      willChange: 'transform',
                    }}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
