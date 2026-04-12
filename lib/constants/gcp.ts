import type { GcpResourceStatus, GcpStepStatusValue } from '@/app/api/_lib/v1-types';

// ===== GCP Step Keys =====

export const GCP_STEP_KEYS = [
  'serviceSideSubnetCreation',
  'serviceSideTerraformApply',
  'bdcSideTerraformApply',
] as const;

export type GcpStepKey = typeof GCP_STEP_KEYS[number];

export const GCP_STEP_LABELS: Record<GcpStepKey, string> = {
  serviceSideSubnetCreation: 'Subnet 생성',
  serviceSideTerraformApply: 'Service TF 설치',
  bdcSideTerraformApply: 'BDC TF 설치',
} as const;

// ===== GCP Step Status Labels =====

export const GCP_STEP_STATUS_LABELS: Record<GcpStepStatusValue, string> = {
  COMPLETED: '완료',
  FAIL: '실패',
  IN_PROGRESS: '진행중',
  SKIP: '해당없음',
} as const;

// ===== GCP Installation Status Labels =====

export const GCP_INSTALLATION_STATUS_LABELS = {
  COMPLETED: '설치 완료',
  FAIL: '설치 실패',
  IN_PROGRESS: '설치 진행 중',
} as const;

// ===== GCP Step Aggregate Status =====

export type GcpStepAggregateStatus = 'COMPLETED' | 'FAIL' | 'IN_PROGRESS' | 'PENDING';

export const getGcpStepAggregateStatus = (
  resources: GcpResourceStatus[],
  stepKey: GcpStepKey
): GcpStepAggregateStatus => {
  const active = resources.filter(r => r[stepKey].status !== 'SKIP');
  if (active.length === 0) return 'PENDING';
  if (active.every(r => r[stepKey].status === 'COMPLETED')) return 'COMPLETED';
  if (active.some(r => r[stepKey].status === 'FAIL')) return 'FAIL';
  if (active.some(r => r[stepKey].status === 'IN_PROGRESS' || r[stepKey].status === 'COMPLETED')) return 'IN_PROGRESS';
  return 'PENDING';
};

export const getGcpActiveStepCount = (
  resources: GcpResourceStatus[],
  stepKey: GcpStepKey
): number =>
  resources.filter(r => r[stepKey].status !== 'SKIP').length;

export const getGcpCompletedStepCount = (
  resources: GcpResourceStatus[],
  stepKey: GcpStepKey
): number =>
  resources.filter(r => r[stepKey].status === 'COMPLETED').length;

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
