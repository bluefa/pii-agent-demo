import type { ReactNode } from 'react';
import { ProcessStatus } from '@/lib/types';
import { installStepperStyles as s, projectHeaderStyles } from '@/lib/theme';

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

interface InstallationProcessProgressBarProps {
  currentStep: ProcessStatus;
  /**
   * The latest connection-test verdict. It rides the position line now that the road
   * is gone — there is no 연결 테스트 step to hang it under any more. Renders nothing
   * when absent, and nothing before the target reaches that step (see below).
   */
  tcTag?: ReactNode;
}

/**
 * 설치 진행 — one sentence: 전체 7단계 중 N단계, then the step's name as a tag
 * (오너 13차 지시).
 *
 * It used to be a seven-dot road with every step named, so that a first-time reader
 * could see the whole route. That is worth showing once and cost ~60px of header on
 * every visit after; a reader who is mid-install wants one fact, which is where they
 * are. The route itself is still on the page — the step cards below walk it.
 *
 * Position is carried by the NUMBERS, so they are the only thing that steps up a
 * size: 14px in a 12px sentence, the same 12/14 pair the block labels and their
 * values already use.
 *
 * Same head as 설치 대상 above (`blockHead`): the header is two named blocks in one
 * grammar, and a rule under only one of them would make them look like two different
 * kinds of thing.
 */
export const InstallationProcessProgressBar = ({
  currentStep,
  tcTag,
}: InstallationProcessProgressBarProps) => {
  const currentIndex = INSTALL_STEPS.findIndex((it) => it.step === currentStep);
  // ProcessStatus is exactly these seven, but the value arrives over the wire —
  // an unknown one drops the position line rather than printing 「0단계」.
  const current = INSTALL_STEPS[currentIndex];

  return (
    <section aria-labelledby={PROGRESS_LABEL_ID} className={s.wrap}>
      <div className={projectHeaderStyles.blockHead}>
        <span id={PROGRESS_LABEL_ID} className={projectHeaderStyles.blockLabel}>
          설치 진행
        </span>
      </div>
      {current && (
        <p className={s.summary}>
          {/* One span, so the 14px counts baseline-align inside the sentence instead
              of becoming flex items that have to be aligned against it. */}
          <span>
            전체 <b className={s.count}>{INSTALL_STEPS.length}</b>단계 중{' '}
            <b className={s.count}>{currentIndex + 1}</b>단계
          </span>
          <span className={s.stepTag}>{current.label}</span>
          {/* Gated on having REACHED the step. A verdict that survives on a target
              sitting at step 1–4 belongs to a previous cycle — the agent is not
              installed yet, so nothing can have tested this configuration — and
              drawing it says the connection is fine about a setup that has never
              been tested. Not rendering it also spares those steps the tag's
              latest_version fetch. */}
          {currentIndex >= TEST_INDEX && tcTag && <span className={s.tagSlot}>{tcTag}</span>}
        </p>
      )}
    </section>
  );
};
