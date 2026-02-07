import type {
  SduProcessStatus,
  CrawlerRunStatus,
  AthenaSetupStatus,
  SourceIpStatus,
} from '@/lib/types/sdu';

// ===== SDU 에러 코드 =====

export const SDU_ERROR_CODES = {
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
  NOT_SDU_PROJECT: {
    code: 'NOT_SDU_PROJECT',
    message: 'SDU 프로젝트가 아닙니다.',
    status: 400,
  },
  VALIDATION_FAILED: {
    code: 'VALIDATION_FAILED',
    message: '검증에 실패했습니다.',
    status: 400,
  },
  INVALID_CIDR: {
    code: 'INVALID_CIDR',
    message: '유효하지 않은 CIDR 형식입니다.',
    status: 400,
  },
  S3_NOT_UPLOADED: {
    code: 'S3_NOT_UPLOADED',
    message: 'S3에 데이터가 업로드되지 않았습니다.',
    status: 400,
  },
  IAM_USER_NOT_FOUND: {
    code: 'IAM_USER_NOT_FOUND',
    message: 'IAM USER를 찾을 수 없습니다.',
    status: 404,
  },
  SOURCE_IP_NOT_REGISTERED: {
    code: 'SOURCE_IP_NOT_REGISTERED',
    message: 'SourceIP가 등록되지 않았습니다.',
    status: 400,
  },
} as const;

// ===== SDU 단계 라벨 =====

export const SDU_STEP_LABELS = {
  S3_CONFIRM: 'S3 확인',
  INSTALLATION: '설치',
  CONNECTION_TEST: '테스트',
  COMPLETE: '완료',
} as const;

// ===== SDU Process Status 라벨 =====

export const SDU_PROCESS_STATUS_LABELS: Record<SduProcessStatus, string> = {
  S3_UPLOAD_PENDING: 'S3 업로드 대기',
  S3_UPLOAD_CONFIRMED: 'S3 업로드 확인 완료',
  INSTALLING: '환경 구성 중',
  WAITING_CONNECTION_TEST: '연결 테스트 대기',
  CONNECTION_VERIFIED: '연결 확인 완료',
  INSTALLATION_COMPLETE: '설치 완료',
};

// ===== Crawler Run Status 라벨 =====

export const CRAWLER_RUN_STATUS_LABELS: Record<CrawlerRunStatus, string> = {
  NONE: '미실행',
  SUCCESS: '성공',
  FAILED: '실패',
};

// ===== Athena Setup Status 라벨 =====

export const ATHENA_SETUP_STATUS_LABELS: Record<AthenaSetupStatus, string> = {
  PENDING: '대기',
  IN_PROGRESS: '진행 중',
  COMPLETED: '완료',
};

// ===== Source IP Status 라벨 =====

export const SOURCE_IP_STATUS_LABELS: Record<SourceIpStatus, string> = {
  REGISTERED: '등록 대기',
  CONFIRMED: '확인 완료',
};

// ===== SDU 가이드 URL =====

export const SDU_GUIDE_URLS = {
  ENVIRONMENT_SETUP: 'https://docs.example.com/sdu/environment-setup',
  IAM_USER_MANAGEMENT: 'https://docs.example.com/sdu/iam-user-management',
  SOURCE_IP_CONFIGURATION: 'https://docs.example.com/sdu/source-ip-configuration',
  S3_UPLOAD: 'https://docs.example.com/sdu/s3-upload',
} as const;

// ===== CIDR 유효성 검증 =====

export const SDU_VALIDATION = {
  CIDR_REGEX: /^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])(\/(3[0-2]|[1-2][0-9]|[0-9]))$/,
} as const;
