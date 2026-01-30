import { CloudProvider, AwsResourceType, AzureResourceType, GcpResourceType, ResourceType } from '@/lib/types';

// 스캔 관련 상수
export const MAX_RESOURCES = 10;
export const SCAN_COOLDOWN_MS = 5 * 60 * 1000; // 5분
export const SCAN_MIN_DURATION_MS = 3000; // 최소 3초
export const SCAN_MAX_DURATION_MS = 10000; // 최대 10초

// Provider별 스캔 정책
export interface ScanPolicy {
  enabled: boolean;
  resourceTypes?: ResourceType[];
  reason?: string;
}

export const SCAN_POLICY: Record<CloudProvider, ScanPolicy> = {
  AWS: {
    enabled: true,
    resourceTypes: ['RDS', 'RDS_CLUSTER', 'DYNAMODB', 'ATHENA', 'REDSHIFT', 'EC2'],
  },
  Azure: {
    enabled: true,
    resourceTypes: ['AZURE_MSSQL', 'AZURE_POSTGRESQL', 'AZURE_MYSQL', 'AZURE_MARIADB', 'AZURE_COSMOS_NOSQL', 'AZURE_SYNAPSE', 'AZURE_VM'],
  },
  GCP: {
    enabled: true,
    resourceTypes: ['CLOUD_SQL', 'BIGQUERY'],
  },
  IDC: {
    enabled: false,
    reason: 'IDC는 스캔을 지원하지 않습니다. 리소스를 직접 입력하세요.',
  },
  SDU: {
    enabled: false,
    reason: 'SDU는 Crawler를 통해 리소스가 수집됩니다.',
  },
};

// Provider별 리소스 타입 가져오기
export const getResourceTypesForProvider = (provider: CloudProvider): ResourceType[] => {
  const policy = SCAN_POLICY[provider];
  return policy.enabled && policy.resourceTypes ? policy.resourceTypes : [];
};

// Provider별 리전 목록
export const AWS_REGIONS = ['ap-northeast-2', 'ap-northeast-1', 'us-east-1', 'us-west-2'] as const;
export const AZURE_REGIONS = ['koreacentral', 'koreasouth', 'eastasia', 'japaneast'] as const;
export const GCP_REGIONS = ['asia-northeast3', 'asia-northeast1', 'us-central1'] as const;

// 에러 코드
export const SCAN_ERROR_CODES = {
  UNAUTHORIZED: { status: 401, message: '로그인이 필요합니다.' },
  FORBIDDEN: { status: 403, message: '해당 프로젝트에 대한 권한이 없습니다.' },
  NOT_FOUND: { status: 404, message: '프로젝트를 찾을 수 없습니다.' },
  SCAN_NOT_FOUND: { status: 404, message: '해당 스캔을 찾을 수 없습니다.' },
  SCAN_NOT_SUPPORTED: { status: 400, message: '스캔을 지원하지 않는 Provider입니다.' },
  SCAN_IN_PROGRESS: { status: 409, message: '이미 스캔이 진행 중입니다.' },
  SCAN_TOO_RECENT: { status: 429, message: '최근 스캔 완료 후 5분이 지나지 않았습니다.' },
  MAX_RESOURCES_REACHED: { status: 400, message: '리소스가 최대 개수(10개)에 도달했습니다.' },
} as const;
