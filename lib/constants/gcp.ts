// ===== GCP 연결 유형 라벨 =====

export const GCP_CONNECTION_TYPE_LABELS = {
  PRIVATE_IP: 'Private IP',
  PSC: 'PSC (Private Service Connect)',
  BIGQUERY: 'BigQuery',
} as const;

// ===== GCP TF 상태 라벨 =====

export const GCP_TF_STATUS_LABELS = {
  PENDING: 'TF 설치 대기',
  IN_PROGRESS: 'TF 설치 중',
  COMPLETED: 'TF 설치 완료',
  FAILED: 'TF 설치 실패',
} as const;

// ===== GCP PSC 상태 라벨 =====

export const GCP_PSC_STATUS_LABELS = {
  NOT_REQUESTED: 'BDC측 확인 필요',
  PENDING_APPROVAL: 'PSC 승인 대기',
  APPROVED: '승인 완료',
  REJECTED: 'BDC측 재신청 필요',
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

// ===== Service TF 리소스 목록 (케이스별) =====

export const GCP_SERVICE_TF_RESOURCES = {
  PRIVATE_IP: {
    connectionType: 'PRIVATE_IP' as const,
    resources: [
      { name: 'google_compute_network_endpoint_group', type: 'psc_neg', description: 'PSC Network Endpoint Group (NEG)' },
      { name: 'google_compute_region_backend_service', type: 'backend_service', description: 'Regional Backend Service' },
      { name: 'google_compute_region_target_tcp_proxy', type: 'target_tcp_proxy', description: 'Target TCP Proxy' },
      { name: 'google_compute_forwarding_rule', type: 'forwarding_rule', description: 'Internal Proxy NLB Forwarding Rule' },
    ],
    totalCount: 4,
  },
  PSC: {
    connectionType: 'PSC' as const,
    resources: [],
    totalCount: 0,
  },
  BIGQUERY: {
    connectionType: 'BIGQUERY' as const,
    resources: [
      { name: 'google_project_iam_member', type: 'iam_binding', description: 'BigQuery User (roles/bigquery.user)' },
      { name: 'google_project_iam_member', type: 'iam_binding', description: 'BigQuery Data Viewer (roles/bigquery.dataViewer)' },
      { name: 'google_project_iam_member', type: 'iam_binding', description: 'BigQuery Job User (roles/bigquery.jobUser)' },
    ],
    totalCount: 3,
  },
} as const;
