'use client';

import { ProcessStatus } from '@/lib/types';
import { cn, installStepperStyles as s } from '@/lib/theme';
import {
  installRoadPosition,
  installRoadSteps,
  type InstallRoadVariant,
} from '@/app/components/features/process-status/install-road';

interface InstallationProcessProgressBarProps {
  currentStep: ProcessStatus;
  /**
   * `'sdu'` swaps the road for SDU's own four steps — 1 연동 대상 정의 · 2 데이터 업로드 ·
   * 3 SDU 연동중 · 4 완료. The wire lattice is untouched; this is what the owner is told.
   */
  variant?: InstallRoadVariant;
}

/**
 * The road, and nothing else — the whole route the target walks, named step by step.
 *
 * It used to be its own named block (「설치 진행」) with its own head row, position tag and
 * 「전체 단계」 cue, standing under a second named block. The header now draws ONE block and
 * ONE cue (오너 2026-08-28, `docs/ux/benchmark/ts-header-aws-grid.md`): the position tag
 * moved onto the 설치 대상 head row where the ops masthead puts its `StepPill`, the 연결
 * 테스트 verdict went with it, and the road became one of the two things behind
 * 「상세 정보」. So this component keeps only the part a line cannot say.
 *
 * It draws no name of its own — the drawer titles nothing but the description
 * (오너 2026-08-28) — but it still carries one for assistive tech: an unnamed list of
 * seven labels says nothing about what the seven are, and `aria-label` costs no pixel.
 *
 * ⛔ Do not give this component a disclosure again. `ProjectPageMeta` owns the one cue,
 * and a road that folded on its own would put two presses back on a header whose whole
 * round was about having one.
 */
export const InstallationProcessProgressBar = ({
  currentStep,
  variant,
}: InstallationProcessProgressBarProps) => {
  const steps = installRoadSteps(variant);
  const { index: currentIndex } = installRoadPosition(currentStep, variant);

  return (
    <ol
      role="list"
      aria-label="설치 진행"
      className={s.list}
      style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
    >
      {steps.map((it, index) => {
        const isLast = index === steps.length - 1;
        const isCurrent = index === currentIndex;
        const isCompleted = currentIndex > index;
        // A segment is "walked" when it leads INTO a step the user has
        // reached — the connector into the current step tints, the one
        // leaving it stays gray.
        const leftWalked = index > 0 && index <= currentIndex;
        const rightWalked = index < currentIndex;
        return (
          <li
            key={it.step}
            aria-current={isCurrent ? 'step' : undefined}
            className={s.item}
          >
            <span className={s.track}>
              {index > 0 && (
                <span
                  aria-hidden="true"
                  className={cn(
                    s.lineBase,
                    'left-0 right-1/2',
                    leftWalked ? s.lineDone : s.line,
                  )}
                />
              )}
              {!isLast && (
                <span
                  aria-hidden="true"
                  className={cn(
                    s.lineBase,
                    'left-1/2 right-0',
                    rightWalked ? s.lineDone : s.line,
                  )}
                />
              )}
              <i
                aria-hidden="true"
                className={cn(
                  s.dotBase,
                  isCurrent ? s.dotCurrent : isCompleted ? s.dotDone : s.dotPending,
                )}
              />
            </span>
            <span
              className={cn(s.labelBase, isCurrent ? s.labelCurrent : s.labelRest)}
              style={{ wordBreak: 'keep-all' }}
            >
              {it.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
};
