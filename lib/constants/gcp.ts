import type { GcpResourceStatus } from '@/app/api/_lib/v1-types';

// ===== GCP TF 상태 라벨 =====

export const GCP_TF_STATUS_LABELS = {
  PENDING: '설치 준비 중',
  IN_PROGRESS: '설치 진행 중',
  COMPLETED: '설치 완료',
  FAILED: '설치 실패',
} as const;

// ===== GCP PSC 상태 라벨 =====

export const GCP_PSC_STATUS_LABELS = {
  NOT_REQUESTED: '확인 대기',
  PENDING_APPROVAL: '승인 대기 중',
  APPROVED: '승인 완료',
  REJECTED: '승인 거부 — 재신청 필요',
} as const;

// ===== GCP 에러 코드 =====

export const GCP_ERROR_CODES = {
  UNAUTHORIZED: {
    code: 'UNAUTHORIZED',
    message: '인증이 필요합니다.',
    status: 401,
  },
  FORBIDDEN: {
    code: 'FORBIDDEN',
    message: '접근 권한이 없습니다.',
    status: 403,
  },
  NOT_FOUND: {
    code: 'NOT_FOUND',
    message: '리소스를 찾을 수 없습니다.',
    status: 404,
  },
  NOT_GCP_PROJECT: {
    code: 'NOT_GCP_PROJECT',
    message: 'GCP 프로젝트가 아닙니다.',
    status: 400,
  },
  SERVICE_NOT_FOUND: {
    code: 'SERVICE_NOT_FOUND',
    message: '서비스를 찾을 수 없습니다.',
    status: 404,
  },
  VALIDATION_FAILED: {
    code: 'VALIDATION_FAILED',
    message: '검증에 실패했습니다.',
    status: 400,
  },
} as const;

// ===== GCP 리소스 타입 =====

export const GCP_RESOURCE_TYPES = {
  DB: ['CLOUD_SQL', 'BIGQUERY'],
} as const;

// ===== GCP 가이드 URL =====

export const GCP_GUIDE_URLS = {
  SCAN_PERMISSION: 'https://docs.example.com/gcp/scan-permission',
  HOST_PROJECT_PERMISSION: 'https://docs.example.com/gcp/host-project-permission',
  SUBNET_CREATION: 'https://docs.example.com/gcp/subnet-creation',
  PSC_APPROVAL: 'https://docs.example.com/gcp/psc-approval',
} as const;

// ===== GCP 통합 상태 =====

export type GcpUnifiedStatus = 'COMPLETED' | 'FAILED' | 'IN_PROGRESS' | 'PENDING' | 'ACTION_REQUIRED';

export const GCP_UNIFIED_STATUS_LABELS: Record<GcpUnifiedStatus, string> = {
  COMPLETED: '설치 완료',
  FAILED: '설치 실패',
  IN_PROGRESS: '설치 진행 중',
  PENDING: '설치 준비 중',
  ACTION_REQUIRED: '조치 필요',
} as const;

export const getGcpUnifiedStatus = (resource: GcpResourceStatus): GcpUnifiedStatus => {
  const { serviceTfStatus, bdcTfStatus, pendingAction } = resource;

  if (serviceTfStatus === 'COMPLETED' && bdcTfStatus === 'COMPLETED') {
    return 'COMPLETED';
  }

  if (serviceTfStatus === 'FAILED' || bdcTfStatus === 'FAILED') {
    return 'FAILED';
  }

  if (pendingAction === 'CREATE_PROXY_SUBNET' || pendingAction === 'APPROVE_PSC_CONNECTION') {
    return 'ACTION_REQUIRED';
  }

  if (
    serviceTfStatus === 'IN_PROGRESS' ||
    bdcTfStatus === 'IN_PROGRESS' ||
    (serviceTfStatus === 'COMPLETED' && bdcTfStatus === 'PENDING') ||
    (serviceTfStatus === 'PENDING' && bdcTfStatus === 'COMPLETED')
  ) {
    return 'IN_PROGRESS';
  }

  return 'PENDING';
};

// ===== GCP 그룹 상태 =====

export type GcpGroupStatus = 'COMPLETED' | 'FAILED' | 'IN_PROGRESS' | 'PENDING';

export const GCP_GROUP_STATUS_LABELS: Record<GcpGroupStatus, string> = {
  COMPLETED: '완료',
  FAILED: '실패',
  IN_PROGRESS: '진행 중',
  PENDING: '대기 중',
} as const;

export const getGcpGroupStatus = (
  resources: GcpResourceStatus[],
  field: 'serviceTfStatus' | 'bdcTfStatus'
): GcpGroupStatus => {
  if (resources.length === 0) return 'PENDING';
  if (resources.every(r => r[field] === 'COMPLETED')) return 'COMPLETED';
  if (resources.some(r => r[field] === 'FAILED')) return 'FAILED';
  if (
    resources.some(r => r[field] === 'IN_PROGRESS') ||
    (resources.some(r => r[field] === 'COMPLETED') && resources.some(r => r[field] === 'PENDING'))
  ) return 'IN_PROGRESS';
  return 'PENDING';
};
