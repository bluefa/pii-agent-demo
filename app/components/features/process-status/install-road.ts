import { ProcessStatus } from '@/lib/types';
import {
  SDU_STEP_TITLES,
  sduStepOf,
} from '@/app/target-sources/[targetSourceId]/_components/sdu/sdu-steps';

export interface InstallRoadStep {
  step: ProcessStatus;
  label: string;
}

/** `'sdu'` swaps the seven-step road for SDU's own four. */
export type InstallRoadVariant = 'sdu';

const INSTALL_STEPS: readonly InstallRoadStep[] = [
  { step: ProcessStatus.WAITING_TARGET_CONFIRMATION, label: '연동 대상 DB 선택' },
  { step: ProcessStatus.WAITING_APPROVAL, label: '연동 대상 승인 대기' },
  { step: ProcessStatus.APPLYING_APPROVED, label: '연동 대상 반영중' },
  { step: ProcessStatus.INSTALLING, label: 'Agent 설치' },
  { step: ProcessStatus.WAITING_CONNECTION_TEST, label: '연결 테스트' },
  { step: ProcessStatus.CONNECTION_VERIFIED, label: '관리자 승인 대기' },
  { step: ProcessStatus.INSTALLATION_COMPLETE, label: '완료' },
];

/**
 * SDU's road is its OWN four steps (오너 2026-08-27), not the seven with three struck
 * through. The owner never walks the missing three, and a road that showed them — struck
 * or not — made the reader hold two numbering schemes at once.
 *
 * The `step` field is only a React key and the 연결 테스트 lookup below; position comes
 * from `sduStepOf`, because several statuses fold onto one entry here.
 */
const SDU_STEPS: readonly InstallRoadStep[] = [
  { step: ProcessStatus.WAITING_TARGET_CONFIRMATION, label: SDU_STEP_TITLES[1] },
  { step: ProcessStatus.INSTALLING, label: SDU_STEP_TITLES[2] },
  { step: ProcessStatus.WAITING_CONNECTION_TEST, label: SDU_STEP_TITLES[3] },
  { step: ProcessStatus.INSTALLATION_COMPLETE, label: SDU_STEP_TITLES[4] },
];

/** The steps a road draws, in order. */
export const installRoadSteps = (variant?: InstallRoadVariant): readonly InstallRoadStep[] =>
  variant === 'sdu' ? SDU_STEPS : INSTALL_STEPS;

export interface InstallRoadPosition {
  /** Zero-based place on the road, `-1` for a status that is not on it. */
  index: number;
  total: number;
  /**
   * The target has reached 연결 테스트 — the first step from which a connection-test
   * verdict can describe THIS configuration. Before it the agent is not installed, so a
   * surviving verdict belongs to a previous cycle.
   */
  reachedConnectionTest: boolean;
}

/**
 * Where a target stands on its road, as numbers.
 *
 * Two components read this: `ProjectPageMeta`, which prints the position tag on the
 * 설치 대상 head row and gates the 연결 테스트 verdict on it, and
 * `InstallationProcessProgressBar`, which draws the road itself. They were one component
 * until the header collapsed to a single block (오너 2026-08-28); splitting the numbers
 * out is what keeps the two from disagreeing about which step the target is on.
 *
 * ProcessStatus is exactly seven values, but it arrives over the wire — an unknown one
 * yields `index: -1` rather than printing 「0단계」. SDU folds several statuses onto one
 * of its steps, so its position cannot be read off the road; `sduStepOf` owns that
 * mapping and returns `undefined` for a status outside the seven, which lands on the
 * same -1 the default lookup gives.
 */
export const installRoadPosition = (
  currentStep: ProcessStatus,
  variant?: InstallRoadVariant,
): InstallRoadPosition => {
  const steps = installRoadSteps(variant);
  const sduStep = variant === 'sdu' ? sduStepOf(currentStep) : undefined;
  const index =
    variant === 'sdu'
      ? (sduStep ?? 0) - 1
      : steps.findIndex((it) => it.step === currentStep);
  const testIndex = steps.findIndex((it) => it.step === ProcessStatus.WAITING_CONNECTION_TEST);

  return { index, total: steps.length, reachedConnectionTest: index >= testIndex };
};
