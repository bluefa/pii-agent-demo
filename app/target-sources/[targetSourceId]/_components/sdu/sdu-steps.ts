import { ProcessStatus } from '@/lib/types';

/**
 * The four screens the SDU owner sees, numbered 1·2·3·4 — that IS the SDU flow to its
 * reader (오너 2026-08-27). The shared 7-step `ProcessStatus` lattice is unchanged on the
 * wire; this is the presentation layer folding it, and this file is the only place the
 * fold is written.
 *
 * 승인 대기 · 연동대상 반영 중 fold into 2 because SDU has no approval step: the definition
 * is submitted and the owner is on 데이터 업로드. 연결 테스트 folds into 3 because the
 * admin's scan → Terraform → 연결 테스트 → Airflow run is one sentence to the owner
 * ("BDC 측에서 데이터를 확인하고 있습니다"), not four screens.
 */
export type SduStep = 1 | 2 | 3 | 4;

const STEP_BY_STATUS: Record<ProcessStatus, SduStep> = {
  [ProcessStatus.WAITING_TARGET_CONFIRMATION]: 1,
  [ProcessStatus.WAITING_APPROVAL]: 2,
  [ProcessStatus.APPLYING_APPROVED]: 2,
  [ProcessStatus.INSTALLING]: 2,
  [ProcessStatus.WAITING_CONNECTION_TEST]: 3,
  [ProcessStatus.CONNECTION_VERIFIED]: 3,
  [ProcessStatus.INSTALLATION_COMPLETE]: 4,
};

export const sduStepOf = (status: ProcessStatus): SduStep => STEP_BY_STATUS[status];

export const SDU_STEP_TITLES: Record<SduStep, string> = {
  1: '연동 대상 정의',
  2: '데이터 업로드',
  3: 'SDU 연동중',
  4: '완료',
};
