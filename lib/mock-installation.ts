/**
 * AWS 설치 상태 관리 로직
 * - TF Role 검증
 * - 설치 상태 조회/확인
 * - TF Script 다운로드
 */

import { getStore } from '@/lib/mock-store';
import type {
  AwsInstallationStatus,
  VerifyTfRoleRequest,
  VerifyTfRoleResponse,
  CheckInstallationResponse,
  TerraformScriptResponse,
  ApiGuide,
} from '@/lib/types';

// ===== 상수 =====

const TF_ROLE_GUIDES: Record<string, ApiGuide> = {
  ROLE_NOT_FOUND: {
    title: 'TerraformExecutionRole 생성 필요',
    steps: [
      'AWS Console에서 IAM > Roles로 이동',
      'Create role 클릭',
      'Trusted entity로 AWS account 선택',
      'Role 이름을 TerraformExecutionRole로 지정',
      '필요한 정책 연결 (AdministratorAccess 또는 커스텀)',
    ],
    documentUrl: 'https://docs.example.com/aws/tf-role-setup',
  },
  INSUFFICIENT_PERMISSIONS: {
    title: '권한 부족',
    steps: [
      'IAM > Roles에서 TerraformExecutionRole 선택',
      'Permissions 탭에서 Add permissions 클릭',
      '필요한 정책 추가: AmazonRDSFullAccess, AmazonS3FullAccess 등',
    ],
    documentUrl: 'https://docs.example.com/aws/tf-role-permissions',
  },
  ACCESS_DENIED: {
    title: 'AssumeRole 설정 필요',
    steps: [
      'IAM > Roles에서 TerraformExecutionRole 선택',
      'Trust relationships 탭 클릭',
      'Edit trust policy 클릭',
      'BDC 계정의 AssumeRole 권한 추가',
    ],
    documentUrl: 'https://docs.example.com/aws/assume-role-setup',
  },
};

const CHECK_INSTALLATION_GUIDES: Record<string, ApiGuide> = {
  VALIDATION_FAILED: {
    title: 'Terraform 리소스 검증 실패',
    steps: [
      'Terraform Script를 AWS 계정에서 실행했는지 확인',
      'terraform apply 명령이 성공적으로 완료되었는지 확인',
      '생성된 리소스가 삭제되지 않았는지 확인',
    ],
  },
  ACCESS_DENIED: {
    title: '검증 권한 없음',
    steps: [
      'ScanRole이 올바르게 설정되어 있는지 확인',
      'ScanRole에 필요한 읽기 권한이 있는지 확인',
    ],
  },
};

// ===== 시뮬레이션 설정 =====

// 자동 설치 시뮬레이션: Service TF 완료까지 걸리는 시간 (ms)
const SERVICE_TF_DURATION = 10000; // 10초
// BDC TF 완료까지 걸리는 시간 (ms)
const BDC_TF_DURATION = 5000; // 5초

// ===== TF Role 검증 =====

export const verifyTfRole = (request: VerifyTfRoleRequest): VerifyTfRoleResponse => {
  const { accountId, roleArn } = request;

  // 시뮬레이션: accountId가 '000'으로 끝나면 ROLE_NOT_FOUND
  if (accountId.endsWith('000')) {
    return {
      valid: false,
      errorCode: 'ROLE_NOT_FOUND',
      errorMessage: `Account ${accountId}에서 TerraformExecutionRole을 찾을 수 없습니다.`,
      guide: TF_ROLE_GUIDES.ROLE_NOT_FOUND,
    };
  }

  // 시뮬레이션: accountId가 '111'으로 끝나면 INSUFFICIENT_PERMISSIONS
  if (accountId.endsWith('111')) {
    return {
      valid: false,
      errorCode: 'INSUFFICIENT_PERMISSIONS',
      errorMessage: 'TerraformExecutionRole에 필요한 권한이 부족합니다.',
      guide: TF_ROLE_GUIDES.INSUFFICIENT_PERMISSIONS,
    };
  }

  // 시뮬레이션: accountId가 '222'로 끝나면 ACCESS_DENIED
  if (accountId.endsWith('222')) {
    return {
      valid: false,
      errorCode: 'ACCESS_DENIED',
      errorMessage: 'AssumeRole 권한이 설정되지 않았습니다.',
      guide: TF_ROLE_GUIDES.ACCESS_DENIED,
    };
  }

  // 성공
  const resolvedRoleArn = roleArn || `arn:aws:iam::${accountId}:role/TerraformExecutionRole`;
  return {
    valid: true,
    roleArn: resolvedRoleArn,
    permissions: {
      canCreateResources: true,
      canManageIam: true,
      canAccessS3: true,
    },
  };
};

// ===== 설치 상태 관리 =====

export const initializeInstallation = (
  projectId: string,
  hasTfPermission: boolean
): AwsInstallationStatus => {
  const store = getStore();

  const status: AwsInstallationStatus = {
    provider: 'AWS',
    hasTfPermission,
    serviceTfCompleted: false,
    bdcTfCompleted: false,
  };

  // hasTfPermission이 true면 자동 설치 시작 시뮬레이션
  if (hasTfPermission) {
    // 시작 시간 기록 (시뮬레이션용)
    (status as AwsInstallationStatus & { _startedAt?: number })._startedAt = Date.now();
  }

  store.awsInstallations.set(projectId, status);
  return status;
};

export const getInstallationStatus = (projectId: string): AwsInstallationStatus | null => {
  const store = getStore();
  const status = store.awsInstallations.get(projectId);

  if (!status) {
    return null;
  }

  // 자동 설치 시뮬레이션: 시간 기반 상태 업데이트
  if (status.hasTfPermission && !status.completedAt) {
    const startedAt = (status as AwsInstallationStatus & { _startedAt?: number })._startedAt;
    if (startedAt) {
      const elapsed = Date.now() - startedAt;

      // Service TF 완료 체크
      if (!status.serviceTfCompleted && elapsed >= SERVICE_TF_DURATION) {
        status.serviceTfCompleted = true;
      }

      // BDC TF 완료 체크 (Service TF 완료 후)
      if (status.serviceTfCompleted && !status.bdcTfCompleted) {
        if (elapsed >= SERVICE_TF_DURATION + BDC_TF_DURATION) {
          status.bdcTfCompleted = true;
          status.completedAt = new Date().toISOString();
        }
      }
    }
  }

  return { ...status };
};

export const checkInstallation = (projectId: string): CheckInstallationResponse | null => {
  const store = getStore();
  const status = store.awsInstallations.get(projectId);

  if (!status) {
    return null;
  }

  const now = new Date().toISOString();

  // 수동 설치 케이스: 검증 시뮬레이션
  if (!status.hasTfPermission) {
    // 시뮬레이션: projectId가 'fail'을 포함하면 검증 실패
    if (projectId.includes('fail')) {
      return {
        ...status,
        lastCheckedAt: now,
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Terraform 리소스를 찾을 수 없습니다.',
          guide: CHECK_INSTALLATION_GUIDES.VALIDATION_FAILED,
        },
      };
    }

    // 검증 성공: Service TF 완료 처리
    if (!status.serviceTfCompleted) {
      status.serviceTfCompleted = true;

      // BDC TF 자동 시작 시뮬레이션
      (status as AwsInstallationStatus & { _bdcStartedAt?: number })._bdcStartedAt = Date.now();
    }

    // BDC TF 완료 체크
    const bdcStartedAt = (status as AwsInstallationStatus & { _bdcStartedAt?: number })._bdcStartedAt;
    if (status.serviceTfCompleted && bdcStartedAt && !status.bdcTfCompleted) {
      const bdcElapsed = Date.now() - bdcStartedAt;
      if (bdcElapsed >= BDC_TF_DURATION) {
        status.bdcTfCompleted = true;
        status.completedAt = new Date().toISOString();
      }
    }
  }

  // 자동 설치 케이스: 상태 업데이트
  if (status.hasTfPermission) {
    getInstallationStatus(projectId); // 시간 기반 업데이트
  }

  status.lastCheckedAt = now;

  return {
    ...status,
    lastCheckedAt: now,
  };
};

// ===== 설치 모드 설정 =====

export const setAwsInstallationMode = (
  projectId: string,
  hasTfPermission: boolean
): AwsInstallationStatus => {
  const store = getStore();

  const existingStatus = store.awsInstallations.get(projectId);

  if (existingStatus) {
    const updatedStatus = {
      ...existingStatus,
      hasTfPermission,
      lastCheckedAt: new Date().toISOString(),
    };
    store.awsInstallations.set(projectId, updatedStatus);
    return updatedStatus;
  }

  // 새로 생성
  const newStatus: AwsInstallationStatus = {
    provider: 'AWS',
    hasTfPermission,
    serviceTfCompleted: false,
    bdcTfCompleted: false,
    lastCheckedAt: new Date().toISOString(),
  };
  store.awsInstallations.set(projectId, newStatus);
  return newStatus;
};

// ===== TF Script =====

export const getTerraformScript = (projectId: string): TerraformScriptResponse | null => {
  const status = getInstallationStatus(projectId);

  if (!status || status.hasTfPermission) {
    // TF 권한이 있는 경우 스크립트 불필요
    return null;
  }

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24시간 후

  return {
    downloadUrl: `https://storage.example.com/tf-scripts/${projectId}/service-tf.zip?token=mock-token`,
    fileName: `service-tf-${projectId}.zip`,
    expiresAt,
  };
};
