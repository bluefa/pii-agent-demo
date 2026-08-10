import type { ReactNode } from 'react';
import { ProcessStatus } from '@/lib/types';
import { cn, installStepperStyles as s, projectHeaderStyles } from '@/lib/theme';

const INSTALL_STEPS = [
  { step: ProcessStatus.WAITING_TARGET_CONFIRMATION, label: '연동 대상 DB 선택' },
  { step: ProcessStatus.WAITING_APPROVAL, label: '연동 대상 승인 대기' },
  { step: ProcessStatus.APPLYING_APPROVED, label: '연동 대상 반영중' },
  { step: ProcessStatus.INSTALLING, label: 'Agent 설치' },
  { step: ProcessStatus.WAITING_CONNECTION_TEST, label: '연결 테스트' },
  { step: ProcessStatus.CONNECTION_VERIFIED, label: '관리자 승인 대기' },
  { step: ProcessStatus.INSTALLATION_COMPLETE, label: '완료' },
] as const;

interface InstallationProcessProgressBarProps {
  currentStep: ProcessStatus;
  /**
   * The latest connection-test verdict, hung under the 연결 테스트 step. The verdict
   * belongs to that step, so it sits under that step — beside the page title you had
   * to scan the stepper to learn what it was about. Renders nothing when absent.
   */
  tcTag?: ReactNode;
}

/**
 * 설치 진행 — the flat page header's quiet stepper. Every step stays visible by
 * name (a first-time reader must see the whole road), and state is carried by
 * the dots + the walked road; labels only separate "here" from "not here".
 */
export const InstallationProcessProgressBar = ({
  currentStep,
  tcTag,
}: InstallationProcessProgressBarProps) => {
  const currentIndex = INSTALL_STEPS.findIndex((it) => it.step === currentStep);

  return (
    <nav aria-label="설치 진행 단계" className={s.wrap}>
      <span className={projectHeaderStyles.blockLabel}>설치 진행</span>
      <ol
        role="list"
        className={s.list}
        style={{ gridTemplateColumns: `repeat(${INSTALL_STEPS.length}, minmax(0, 1fr))` }}
      >
        {INSTALL_STEPS.map((it, index) => {
          const isLast = index === INSTALL_STEPS.length - 1;
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
                    className={cn(s.lineBase, 'left-0 right-1/2', leftWalked ? s.lineDone : s.line)}
                  />
                )}
                {!isLast && (
                  <span
                    aria-hidden="true"
                    className={cn(s.lineBase, 'left-1/2 right-0', rightWalked ? s.lineDone : s.line)}
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
              {/* Absolute, anchored to the BOTTOM of the grid row. In flow the
                  tag is a nowrap box in a ~100px cell, so it spilled sideways
                  into whatever sat beside it: at 960px the neighbouring label
                  wraps to two lines and the two overlapped (codex, 30x10px).
                  Out of flow at `top-full` it clears every label — the row
                  stretches to the tallest one — and it costs no height, so a
                  target that never ran a test gets no dead space either. */}
              {it.step === ProcessStatus.WAITING_CONNECTION_TEST && (
                <span className={s.tagSlot}>{tcTag}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
