'use client';

import { useState, type ReactNode } from 'react';
import { ProcessStatus } from '@/lib/types';
import { ChevronDownIcon } from '@/app/components/ui/icons';
import { cn, installStepperStyles as s, projectHeaderStyles } from '@/lib/theme';
import {
  SDU_STEP_TITLES,
  sduStepOf,
} from '@/app/target-sources/[targetSourceId]/_components/sdu/sdu-steps';

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

/**
 * SDU walks four of the seven (1·4·6·7) and names them differently — 4 is an upload, not
 * an install. Keyed by step NUMBER rather than by `ProcessStatus`, because two statuses
 * fold onto one SDU step and this table is about the road, not about where a target is.
 * A Map, not an index into `SDU_STEP_TITLES`: that record's key type is the four SDU steps
 * only, so reading it with an arbitrary loop counter would need a cast to compile.
 */
const SDU_LABELS = new Map<number, string>([
  [1, SDU_STEP_TITLES[1]],
  [4, SDU_STEP_TITLES[4]],
  [6, SDU_STEP_TITLES[6]],
  [7, SDU_STEP_TITLES[7]],
]);

/**
 * The other three, and WHY each is gone — they are struck, never removed. Deleting them
 * would renumber nothing (the numbers are fixed) but it would leave a reader whose road
 * has no 승인 대기 with no way to learn that SDU has no approval at all, as opposed to
 * their target having skipped it. 5 is the subtle one: the connection test still happens,
 * it is just not the owner's to run.
 */
const SDU_SKIPPED = new Map<number, string>([
  [2, '승인 없음'],
  [3, '승인 없음'],
  [5, '연결 테스트는 BDC가 수행'],
]);

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
  /**
   * `'sdu'` re-labels the four steps SDU walks and strikes the three it does not. The
   * road keeps all seven slots and the numbering never shifts — 「4단계」 has to point at
   * the same place for every integration type, or an operator and an owner cannot say
   * 「4단계에서 막혀 있다」 to each other and mean one thing.
   */
  variant?: 'sdu';
}

/**
 * 설치 진행 — one row at rest, the seven-step road behind 「전체 단계」 (오너 14차 지시).
 *
 * The row states the one fact a mid-install reader came for: 전체 7단계 중 어디인지, as a
 * tag. It does not name the step — the card head below owns that. The road that names
 * all seven is what a first-time reader wants exactly once, so it opens on request
 * instead of charging every visit ~60px of header for it.
 *
 * Same three parts as 설치 대상 one block above — `blockHead` carrying the name and
 * one cue, the body underneath — because the header is two named blocks in one
 * grammar, and a block that folded differently from its sibling would read as a
 * different kind of thing.
 */
export const InstallationProcessProgressBar = ({
  currentStep,
  tcTag,
  variant,
}: InstallationProcessProgressBarProps) => {
  const [stepsOpen, setStepsOpen] = useState(false);
  // ProcessStatus is exactly these seven, but the value arrives over the wire —
  // an unknown one drops the position line rather than printing 「0단계」. The row used to
  // hold the matched step for its `.label`; it prints only numbers now, so the index is
  // the whole guard.
  // SDU folds two statuses onto step 4 and two onto step 6, so its position cannot be
  // read off this list — `sduStepOf` owns that mapping. It returns `undefined` for a
  // status outside the seven, which lands on the same -1 the default lookup gives.
  const sduStep = variant === 'sdu' ? sduStepOf(currentStep) : undefined;
  const currentIndex =
    variant === 'sdu'
      ? (sduStep ?? 0) - 1
      : INSTALL_STEPS.findIndex((it) => it.step === currentStep);
  const done = currentIndex === INSTALL_STEPS.length - 1;

  return (
    <section aria-labelledby={PROGRESS_LABEL_ID} className={s.wrap}>
      <div className={projectHeaderStyles.blockHead}>
        <div className={s.head}>
          <span id={PROGRESS_LABEL_ID} className={projectHeaderStyles.blockLabel}>
            설치 진행
          </span>
          {currentIndex >= 0 &&
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
              /* Position only. The step's NAME belongs to the card head 32px below, which
                 prints it at 20px beside its own 「N단계」 tag. Carrying it here as well put
                 one string on the screen three times — this plate, the card title, and the
                 guide panel's heading — and the three did not even agree: the road below
                 says 「완료」 where step 7's card says 「PII 모니터링 모듈 연동」. One fact,
                 one owner: this plate answers 「어디」, the card answers 「무엇을」.
                 The middot that broke position from name (오너 19차 지시) went out with the
                 name — there is nothing left inside the plate for it to separate. */
              <span className={s.stepTag}>
                {/* One span, so both 14px digits baseline-align inside the phrase rather
                    than becoming flex items that have to be aligned against it. */}
                <span>
                  <b className={s.tagCount}>{INSTALL_STEPS.length}</b>단계 중{' '}
                  <b className={s.tagCount}>{currentIndex + 1}</b>단계
                </span>
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
            const stepNumber = index + 1;
            // The reason this slot is struck, or undefined when the type walks it.
            const skippedReason = variant === 'sdu' ? SDU_SKIPPED.get(stepNumber) : undefined;
            const label = (variant === 'sdu' && SDU_LABELS.get(stepNumber)) || it.label;
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
                /* The reason rides the whole slot, not just the label: `title` is the only
                   channel this road has for a sentence, and the slot is what a pointer is
                   over. Absent on a walked step — an empty title is a tooltip that opens
                   on nothing. */
                title={skippedReason}
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
                  {/* A struck step gets no bead. Every dot on this road means a position
                      relative to the reader — walked, here, ahead — and a slot that is
                      none of the three has no honest fill: `dotPending` would say「아직」
                      about something that will never happen. The line runs straight
                      through instead, which is the truth: the road does not stop here. */}
                  {!skippedReason && (
                    <i
                      aria-hidden="true"
                      className={cn(
                        s.dotBase,
                        isCurrent ? s.dotCurrent : isCompleted ? s.dotDone : s.dotPending,
                      )}
                    />
                  )}
                </span>
                <span
                  className={cn(
                    s.labelBase,
                    skippedReason
                      ? s.labelSkipped
                      : isCurrent
                        ? s.labelCurrent
                        : s.labelRest,
                  )}
                  style={{ wordBreak: 'keep-all' }}
                >
                  {label}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
};
