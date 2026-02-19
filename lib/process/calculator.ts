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
  CloudProvider,
  ProcessStatus,
  ProjectStatus,
} from '@/lib/types';
import type { SduProjectStatus, SduProcessStatus } from '@/lib/types/sdu';

/**
 * 현재 프로세스 단계를 계산합니다.
 *
 * @param cloudProvider - 클라우드 제공자
 * @param status - 프로젝트 상태 데이터
 * @returns 계산된 ProcessStatus
 */
export const getCurrentStep = (
  cloudProvider: CloudProvider,
  status: ProjectStatus
): ProcessStatus => {
  // IDC는 승인 단계가 없음
  if (cloudProvider === 'IDC') {
    return getCurrentStepWithoutApproval(status);
  }

  // AWS, Azure, GCP는 승인 단계 포함
  return getCurrentStepWithApproval(status);
};

/**
 * 승인 단계가 있는 Provider용 (AWS, Azure, GCP)
 */
const getCurrentStepWithApproval = (status: ProjectStatus): ProcessStatus => {
  // 1. 연동 대상 확정 대기
  if (!status.targets.confirmed) {
    return ProcessStatus.WAITING_TARGET_CONFIRMATION;
  }

  // 2. 승인 대기 (PENDING 또는 REJECTED)
  const approvalStatus = status.approval.status;
  if (approvalStatus === 'PENDING' || approvalStatus === 'REJECTED') {
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

  // 4. 연결 테스트 필요
  if (status.connectionTest.status !== 'PASSED') {
    return ProcessStatus.WAITING_CONNECTION_TEST;
  }

  // 5. 연결 확인 완료 (관리자 확정 대기)
  // CONNECTION_VERIFIED는 connectionTest가 PASSED이고 관리자 확정 전
  // 여기서는 INSTALLATION_COMPLETE로 직접 가는 것으로 간주
  // (별도의 adminConfirmed 필드가 필요하면 추후 추가)
  return ProcessStatus.INSTALLATION_COMPLETE;
};

/**
 * 승인 단계가 없는 Provider용 (IDC)
 */
const getCurrentStepWithoutApproval = (status: ProjectStatus): ProcessStatus => {
  // 1. 연동 대상 확정 대기
  if (!status.targets.confirmed) {
    return ProcessStatus.WAITING_TARGET_CONFIRMATION;
  }

  // 2. 설치 진행 중 (승인 단계 스킵)
  if (status.installation.status !== 'COMPLETED') {
    return ProcessStatus.INSTALLING;
  }

  // 3. 연결 테스트 필요
  if (status.connectionTest.status !== 'PASSED') {
    return ProcessStatus.WAITING_CONNECTION_TEST;
  }

  return ProcessStatus.INSTALLATION_COMPLETE;
};

/**
 * SDU 전용 현재 단계 계산
 *
 * @param sduStatus - SDU 프로젝트 상태
 * @returns 계산된 SduProcessStatus
 */
export const getSduCurrentStep = (sduStatus: SduProjectStatus): SduProcessStatus => {
  if (sduStatus.s3Upload.status !== 'CONFIRMED') return 'S3_UPLOAD_PENDING';
  if (sduStatus.installation.athenaSetup.status !== 'COMPLETED') return 'INSTALLING';
  if (sduStatus.connectionTest.status !== 'PASSED') return 'WAITING_CONNECTION_TEST';
  return 'INSTALLATION_COMPLETE';
};

/**
 * Project 객체에서 현재 단계를 계산합니다.
 * 컴포넌트에서 간편하게 사용할 수 있는 헬퍼 함수입니다.
 */
export const getProjectCurrentStep = (project: {
  cloudProvider: CloudProvider;
  status: ProjectStatus;
}): ProcessStatus => {
  return getCurrentStep(project.cloudProvider, project.status);
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
