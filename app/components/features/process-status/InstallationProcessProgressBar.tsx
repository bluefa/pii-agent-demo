'use client';

import { useState, type ReactNode } from 'react';
import { ProcessStatus } from '@/lib/types';
import { ChevronDownIcon } from '@/app/components/ui/icons';
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

/** The step from which a connection-test verdict can describe THIS configuration. */
const TEST_INDEX = INSTALL_STEPS.findIndex(
  (it) => it.step === ProcessStatus.WAITING_CONNECTION_TEST,
);

/** Names the 설치 진행 region (`aria-labelledby`), like 설치 대상 above it. */
const PROGRESS_LABEL_ID = 'install-progress-label';
/** Ties the disclosure button to the road it opens (`aria-controls`). */
const STEPS_BLOCK_ID = 'install-progress-steps';
/**
 * The verdict is the second thing that press reveals, and it lives up on the head row
 * — outside the road and BEFORE it in the DOM. `aria-controls` takes an ID list, so
 * both go in it; a reader who expands is otherwise pointed at the road alone and the
 * freshest fact on the header arrives with no tie to the control that produced it.
 */
const VERDICT_SLOT_ID = 'install-progress-verdict';

interface InstallationProcessProgressBarProps {
  currentStep: ProcessStatus;
  /**
   * The latest connection-test verdict. It rides the position row rather than a step
   * of the road — but it folds WITH the road (오너 14차 지시 후속), so the press that
   * names the steps is also what reveals it. Renders nothing when absent, nothing
   * before the target reaches 연결 테스트, and nothing while the road is shut.
   */
  tcTag?: ReactNode;
}

/**
 * 설치 진행 — one row at rest, the seven-step road behind 「전체 단계」 (오너 14차 지시).
 *
 * The row states the one fact a mid-install reader came for: 전체 7단계 중, then where
 * they are as a tag. The road that names all seven is what a first-time reader wants
 * exactly once, so it opens on request instead of charging every visit ~60px of
 * header for it.
 *
 * Same three parts as 설치 대상 one block above — `blockHead` carrying the name and
 * one cue, the body underneath — because the header is two named blocks in one
 * grammar, and a block that folded differently from its sibling would read as a
 * different kind of thing.
 */
export const InstallationProcessProgressBar = ({
  currentStep,
  tcTag,
}: InstallationProcessProgressBarProps) => {
  const [stepsOpen, setStepsOpen] = useState(false);
  const currentIndex = INSTALL_STEPS.findIndex((it) => it.step === currentStep);
  // ProcessStatus is exactly these seven, but the value arrives over the wire —
  // an unknown one drops the position line rather than printing 「0단계」.
  const current = INSTALL_STEPS[currentIndex];
  const done = currentIndex === INSTALL_STEPS.length - 1;

  return (
    <section aria-labelledby={PROGRESS_LABEL_ID} className={s.wrap}>
      <div className={projectHeaderStyles.blockHead}>
        <div className={s.head}>
          <span id={PROGRESS_LABEL_ID} className={projectHeaderStyles.blockLabel}>
            설치 진행
          </span>
          {current &&
            (done ? (
              /* 「7단계 중 7단계 완료」 said the same thing three times (오너 18차 지시).
                 Every other label names work in progress, so the fraction answers「how
                 far」— but at the end there is no position left to report, only the
                 sequence that is now behind the reader. 모두 carries that, and the total
                 stays because it is what was completed. */
              <span className={s.stepTag}>
                <span>
                  <b className={s.tagCount}>{INSTALL_STEPS.length}</b>단계 모두 완료
                </span>
              </span>
            ) : (
              <span className={s.stepTag}>
                {/* One span, so both 14px digits baseline-align inside the phrase rather
                    than becoming flex items that have to be aligned against it. */}
                <span>
                  <b className={s.tagCount}>{INSTALL_STEPS.length}</b>단계 중{' '}
                  <b className={s.tagCount}>{currentIndex + 1}</b>단계
                </span>
                <span>{current.label}</span>
              </span>
            ))}
          {/* Two gates, both of which must hold.
              1. The target has REACHED 연결 테스트. A verdict that survives on a target
                 sitting at step 1–4 belongs to a previous cycle — the agent is not
                 installed yet, so nothing can have tested this configuration — and
                 drawing it says the connection is fine about a setup that has never
                 been tested.
              2. The road is open (오너 14차 지시 후속). The verdict is detail about one
                 step, so it belongs to the same press that names the steps.
              Neither gate merely hides the tag: `TcHeaderTag` fetches latest_version on
              mount, so not rendering it is also not fetching. */}
          {stepsOpen && currentIndex >= TEST_INDEX && tcTag && (
            <span id={VERDICT_SLOT_ID} className={s.tagSlot}>
              {tcTag}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setStepsOpen((open) => !open)}
          aria-expanded={stepsOpen}
          aria-controls={`${STEPS_BLOCK_ID} ${VERDICT_SLOT_ID}`}
          className={projectHeaderStyles.metaCue}
        >
          전체 단계
          <ChevronDownIcon
            className={cn(
              projectHeaderStyles.metaToggleIcon,
              stepsOpen && projectHeaderStyles.metaToggleIconOpen,
            )}
            aria-hidden="true"
          />
        </button>
      </div>
      {stepsOpen && (
        <ol
          id={STEPS_BLOCK_ID}
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
              <li key={it.step} aria-current={isCurrent ? 'step' : undefined} className={s.item}>
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
      )}
    </section>
  );
};
