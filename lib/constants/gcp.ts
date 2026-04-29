import type { GcpResourceStatus, GcpStepStatusValue } from '@/app/api/_lib/v1-types';
import type { InstallTaskCardStatus } from '@/app/components/features/process-status/install-task-pipeline/InstallTaskCard';

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

export const GCP_STEP_PIPELINE_LABELS: Record<GcpStepKey, string> = {
  serviceSideSubnetCreation: 'Subnet 생성 진행',
  serviceSideTerraformApply: '서비스 측 리소스 설치 진행',
  bdcSideTerraformApply: 'BDC 측 리소스 설치 진행',
} as const;

export const GCP_STEP_PIPELINE_SUBS: Record<GcpStepKey, string> = {
  serviceSideSubnetCreation: 'Project 내 모니터링용 Subnet (10.30.0.0/22) 생성',
  serviceSideTerraformApply: 'VPC Peering / Firewall / Service Account 권한 위임 구성',
  bdcSideTerraformApply: 'PII Agent GCE 인스턴스 + Service Account + IAM Role 자동 배포',
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

export interface GcpStepSummary {
  status: GcpStepAggregateStatus;
  activeCount: number;
  completedCount: number;
}

export const getGcpStepSummary = (
  resources: GcpResourceStatus[],
  stepKey: GcpStepKey
): GcpStepSummary => {
  let activeCount = 0;
  let completedCount = 0;
  let hasFail = false;
  let hasInProgress = false;

  for (const r of resources) {
    const s = r[stepKey].status;
    if (s === 'SKIP') continue;
    activeCount++;
    if (s === 'COMPLETED') completedCount++;
    else if (s === 'FAIL') hasFail = true;
    else if (s === 'IN_PROGRESS') hasInProgress = true;
  }

  let status: GcpStepAggregateStatus;
  if (activeCount === 0) status = 'PENDING';
  else if (completedCount === activeCount) status = 'COMPLETED';
  else if (hasFail) status = 'FAIL';
  else if (hasInProgress || completedCount > 0) status = 'IN_PROGRESS';
  else status = 'PENDING';

  return { status, activeCount, completedCount };
};

// ===== GCP Pipeline Builder =====

export interface GcpPipelineItem {
  key: GcpStepKey;
  title: string;
  sub: string;
  status: InstallTaskCardStatus;
  completedCount: number;
  activeCount: number;
}

const AGGREGATE_TO_CARD_STATUS: Record<GcpStepAggregateStatus, InstallTaskCardStatus> = {
  COMPLETED: 'done',
  IN_PROGRESS: 'running',
  FAIL: 'failed',
  PENDING: 'pending',
};

export const buildGcpPipelineItems = (
  resources: GcpResourceStatus[]
): GcpPipelineItem[] =>
  GCP_STEP_KEYS.map((stepKey) => {
    const summary = getGcpStepSummary(resources, stepKey);
    return {
      key: stepKey,
      title: GCP_STEP_PIPELINE_LABELS[stepKey],
      sub: GCP_STEP_PIPELINE_SUBS[stepKey],
      status: AGGREGATE_TO_CARD_STATUS[summary.status],
      completedCount: summary.completedCount,
      activeCount: summary.activeCount,
    };
  });

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
