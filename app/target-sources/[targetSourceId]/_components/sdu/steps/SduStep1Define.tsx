import { SDU_STEP_TITLES } from '@/app/target-sources/[targetSourceId]/_components/sdu/sdu-steps';
import type { SduStepProps } from '@/app/target-sources/[targetSourceId]/_components/sdu/types';

export interface SduStep1DefineProps extends SduStepProps {
  /**
   * 'return' is the trip back from 데이터 업로드 via 연동 대상 수정 — the same screen, but
   * it has somewhere to go back to. The gates only block forward.
   */
  mode?: 'initial' | 'return';
  onReturn?: () => void;
}

/** STUB — Slice A ships the data layer only; the screen lands in a later slice. */
// The props are declared but unread on purpose: the signature is the contract the later
// UI slice is written against, so it lands before the body does.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function SduStep1Define(_props: SduStep1DefineProps) {
  return <div>{SDU_STEP_TITLES[1]}</div>;
}
