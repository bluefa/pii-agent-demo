/**
 * Process Status Calculator (ADR-004)
 *
 * Backend가 제공하는 상태 데이터(ProjectStatus)를 해석하여
 * 현재 프로세스 단계(ProcessStatus)를 계산합니다.
 *
 * @see docs/adr/004-process-status-refactoring.md
 * @see docs/adr/001-process-state-architecture.md
 */

import {
  ProcessStatus,
  ProjectStatus,
} from '@/lib/types';

/**
 * 현재 프로세스 단계를 계산합니다.
 *
 * @param status - 프로젝트 상태 데이터
 * @returns 계산된 ProcessStatus
 */
export const getCurrentStep = (status: ProjectStatus): ProcessStatus => {
  return getCurrentStepWithApproval(status);
};

const getCurrentStepWithApproval = (status: ProjectStatus): ProcessStatus => {
  // Step 1: waiting for target confirmation.
  // After a rejection (or system-error UNAVAILABLE) the mock preserves targets.confirmed=true,
  // so this falls through to Step 2 naturally. Legacy snapshots can still carry
  // confirmed=false + REJECTED/UNAVAILABLE; those remain on Step 2 until system-reset
  // is explicitly invoked.
  if (!status.targets.confirmed) {
    if (status.approval.status === 'REJECTED' || status.approval.status === 'UNAVAILABLE') {
      return ProcessStatus.WAITING_APPROVAL;
    }
    return ProcessStatus.WAITING_TARGET_CONFIRMATION;
  }

  // Step 2: waiting for approval (PENDING / REJECTED / UNAVAILABLE).
  const approvalStatus = status.approval.status;
  if (approvalStatus === 'PENDING' || approvalStatus === 'REJECTED' || approvalStatus === 'UNAVAILABLE') {
    return ProcessStatus.WAITING_APPROVAL;
  }

  // 3. 연동대상 반영 중 (승인 완료, 설치 시작 전)
  if (status.installation.status === 'PENDING') {
    return ProcessStatus.APPLYING_APPROVED;
  }

  // 4. 설치 진행 중
  if (status.installation.status !== 'COMPLETED') {
    return ProcessStatus.INSTALLING;
  }

  // 5. 연결 테스트 — 한번이라도 성공(passedAt 존재)하면 연결 확인으로 이동
  if (!status.connectionTest.passedAt) {
    return ProcessStatus.WAITING_CONNECTION_TEST;
  }

  // 6. 연결 확인 완료 (운영 확인 대기)
  if (!status.connectionTest.operationConfirmed) {
    return ProcessStatus.CONNECTION_VERIFIED;
  }

  // 7. 설치 완료
  return ProcessStatus.INSTALLATION_COMPLETE;
};

/**
 * 초기 ProjectStatus를 생성합니다.
 * 새 프로젝트 생성 시 사용합니다.
 */
export const createInitialProjectStatus = (): ProjectStatus => ({
  scan: {
    status: 'PENDING',
  },
  targets: {
    confirmed: false,
    selectedCount: 0,
    excludedCount: 0,
  },
  approval: {
    status: 'PENDING',
  },
  installation: {
    status: 'PENDING',
  },
  connectionTest: {
    status: 'NOT_TESTED',
  },
});
