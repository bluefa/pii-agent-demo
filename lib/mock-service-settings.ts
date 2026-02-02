/**
 * AWS 서비스 설정 관리 로직
 * - 서비스별 AWS 설정 조회/수정
 * - Scan Role 검증
 */

import { getStore } from '@/lib/mock-store';
import type {
  AwsServiceSettings,
  UpdateAwsSettingsRequest,
  UpdateAwsSettingsResponse,
  VerifyScanRoleResponse,
  ApiGuide,
} from '@/lib/types';

// ===== 상수 =====

const DEFAULT_GUIDE: ApiGuide = {
  title: 'AWS 연동 설정 필요',
  steps: [
    '서비스에 사용할 AWS 계정 ID를 입력하세요.',
    'Scan Role ARN을 입력하세요.',
    'Scan Role은 BDC가 AWS 리소스를 스캔할 때 사용됩니다.',
    '필요한 권한: ReadOnlyAccess 또는 커스텀 정책',
  ],
  documentUrl: 'https://docs.example.com/aws/scan-role-setup',
};

const SCAN_ROLE_GUIDES: Record<string, ApiGuide> = {
  ROLE_NOT_FOUND: {
    title: 'Scan Role을 찾을 수 없음',
    steps: [
      'AWS Console에서 IAM > Roles로 이동',
      '입력한 Role ARN이 정확한지 확인',
      'Role이 존재하지 않으면 새로 생성',
    ],
    documentUrl: 'https://docs.example.com/aws/scan-role-create',
  },
  INSUFFICIENT_PERMISSIONS: {
    title: 'Scan Role 권한 부족',
    steps: [
      'IAM > Roles에서 해당 Role 선택',
      'Permissions 탭에서 필요한 정책 추가',
      '필요 권한: ReadOnlyAccess 또는 커스텀 스캔 정책',
    ],
    documentUrl: 'https://docs.example.com/aws/scan-role-permissions',
  },
  ACCESS_DENIED: {
    title: 'AssumeRole 설정 필요',
    steps: [
      'IAM > Roles에서 해당 Role 선택',
      'Trust relationships 탭 클릭',
      'BDC 계정에서 AssumeRole 할 수 있도록 설정',
    ],
    documentUrl: 'https://docs.example.com/aws/scan-role-trust',
  },
  INVALID_ACCOUNT_ID: {
    title: '잘못된 AWS 계정 ID',
    steps: [
      'AWS 계정 ID는 12자리 숫자입니다.',
      'AWS Console 우측 상단에서 계정 ID 확인 가능',
    ],
  },
};

// ===== 서비스 설정 조회 =====

export const getAwsServiceSettings = (serviceCode: string): AwsServiceSettings => {
  const store = getStore();
  const settings = store.awsServiceSettings.get(serviceCode);

  if (!settings) {
    // 미등록 상태
    return {
      scanRole: {
        registered: false,
      },
      guide: DEFAULT_GUIDE,
    };
  }

  return { ...settings };
};

// ===== 서비스 설정 수정 =====

export const updateAwsServiceSettings = (
  serviceCode: string,
  request: UpdateAwsSettingsRequest
): UpdateAwsSettingsResponse => {
  const store = getStore();
  const { accountId, scanRoleArn } = request;

  // 계정 ID 검증 (12자리 숫자)
  if (!/^\d{12}$/.test(accountId)) {
    return {
      updated: false,
      errorCode: 'INVALID_ACCOUNT_ID',
      errorMessage: 'AWS 계정 ID는 12자리 숫자여야 합니다.',
      guide: SCAN_ROLE_GUIDES.INVALID_ACCOUNT_ID,
    };
  }

  // Role ARN 형식 검증
  if (!scanRoleArn.startsWith('arn:aws:iam::')) {
    return {
      updated: false,
      errorCode: 'ROLE_NOT_FOUND',
      errorMessage: '올바른 Role ARN 형식이 아닙니다.',
      guide: SCAN_ROLE_GUIDES.ROLE_NOT_FOUND,
    };
  }

  // 시뮬레이션: accountId가 '000'으로 끝나면 ROLE_NOT_FOUND
  if (accountId.endsWith('000')) {
    return {
      updated: false,
      errorCode: 'ROLE_NOT_FOUND',
      errorMessage: `Account ${accountId}에서 Scan Role을 찾을 수 없습니다.`,
      guide: SCAN_ROLE_GUIDES.ROLE_NOT_FOUND,
    };
  }

  // 시뮬레이션: accountId가 '111'로 끝나면 INSUFFICIENT_PERMISSIONS
  if (accountId.endsWith('111')) {
    return {
      updated: false,
      errorCode: 'INSUFFICIENT_PERMISSIONS',
      errorMessage: 'Scan Role에 필요한 권한이 부족합니다.',
      guide: SCAN_ROLE_GUIDES.INSUFFICIENT_PERMISSIONS,
    };
  }

  // 시뮬레이션: accountId가 '222'로 끝나면 ACCESS_DENIED
  if (accountId.endsWith('222')) {
    return {
      updated: false,
      errorCode: 'ACCESS_DENIED',
      errorMessage: 'AssumeRole 권한이 설정되지 않았습니다.',
      guide: SCAN_ROLE_GUIDES.ACCESS_DENIED,
    };
  }

  // 성공: 설정 저장
  const now = new Date().toISOString();
  const settings: AwsServiceSettings = {
    accountId,
    scanRole: {
      registered: true,
      roleArn: scanRoleArn,
      lastVerifiedAt: now,
      status: 'VALID',
    },
  };

  store.awsServiceSettings.set(serviceCode, settings);

  return {
    updated: true,
    accountId,
    scanRole: settings.scanRole,
  };
};

// ===== Scan Role 검증 =====

export const verifyScanRole = (serviceCode: string): VerifyScanRoleResponse => {
  const store = getStore();
  const settings = store.awsServiceSettings.get(serviceCode);

  if (!settings || !settings.scanRole.registered) {
    return {
      valid: false,
      errorCode: 'ROLE_NOT_FOUND',
      errorMessage: '등록된 Scan Role이 없습니다.',
      guide: SCAN_ROLE_GUIDES.ROLE_NOT_FOUND,
    };
  }

  const { accountId, scanRole } = settings;

  // 시뮬레이션: accountId가 '333'으로 끝나면 삭제된 Role
  if (accountId?.endsWith('333')) {
    settings.scanRole.status = 'INVALID';
    return {
      valid: false,
      errorCode: 'ROLE_NOT_FOUND',
      errorMessage: 'Scan Role이 삭제되었습니다.',
      guide: SCAN_ROLE_GUIDES.ROLE_NOT_FOUND,
    };
  }

  // 시뮬레이션: accountId가 '444'로 끝나면 권한 변경됨
  if (accountId?.endsWith('444')) {
    settings.scanRole.status = 'INVALID';
    return {
      valid: false,
      errorCode: 'INSUFFICIENT_PERMISSIONS',
      errorMessage: 'Scan Role의 권한이 변경되었습니다.',
      guide: SCAN_ROLE_GUIDES.INSUFFICIENT_PERMISSIONS,
    };
  }

  // 성공
  const now = new Date().toISOString();
  settings.scanRole.lastVerifiedAt = now;
  settings.scanRole.status = 'VALID';

  return {
    valid: true,
    roleArn: scanRole.roleArn!,
    verifiedAt: now,
  };
};
