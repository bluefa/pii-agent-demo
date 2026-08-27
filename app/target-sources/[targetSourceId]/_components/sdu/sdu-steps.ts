import { ProcessStatus } from '@/lib/types';

/**
 * The four screens the SDU owner sees. The 7-step ProcessStatus lattice is shared with
 * every other provider — SDU does not get its own status enum, it rides this one and
 * folds the steps it has no screen for.
 *
 * 2·3 (승인 대기 · 연동대상 반영 중) fold into 4 because SDU has no approval step: the
 * definition is submitted and the owner is on 데이터 업로드. 5 folds into 6 because the
 * admin's scan → Terraform → 연결 테스트 → Airflow run is one sentence to the owner
 * ("BDC 측에서 데이터를 확인하고 있습니다"), not four screens.
 */
export type SduStep = 1 | 4 | 6 | 7;

const STEP_BY_STATUS: Record<ProcessStatus, SduStep> = {
  [ProcessStatus.WAITING_TARGET_CONFIRMATION]: 1,
  [ProcessStatus.WAITING_APPROVAL]: 4,
  [ProcessStatus.APPLYING_APPROVED]: 4,
  [ProcessStatus.INSTALLING]: 4,
  [ProcessStatus.WAITING_CONNECTION_TEST]: 6,
  [ProcessStatus.CONNECTION_VERIFIED]: 6,
  [ProcessStatus.INSTALLATION_COMPLETE]: 7,
};

export const sduStepOf = (status: ProcessStatus): SduStep => STEP_BY_STATUS[status];

export const SDU_STEP_TITLES: Record<SduStep, string> = {
  1: '연동 대상 정의',
  4: '데이터 업로드',
  6: 'SDU 연동중',
  7: '완료',
};
