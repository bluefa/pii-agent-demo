import { SDU_STEP_TITLES } from '@/app/target-sources/[targetSourceId]/_components/sdu/sdu-steps';
import type { SduStepProps } from '@/app/target-sources/[targetSourceId]/_components/sdu/types';

/** STUB — Slice A ships the data layer only; the screen lands in a later slice. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function SduStep4Upload(_props: SduStepProps) {
  return <div>{SDU_STEP_TITLES[4]}</div>;
}
