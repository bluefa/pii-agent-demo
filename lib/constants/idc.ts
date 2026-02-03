// ===== IDC Database Type 라벨 =====

export const IDC_DATABASE_TYPE_LABELS = {
  ORACLE: 'Oracle',
  MYSQL: 'MySQL',
  POSTGRESQL: 'PostgreSQL',
  MSSQL: 'MS SQL Server',
} as const;

// ===== IDC TF 상태 라벨 =====

export const IDC_TF_STATUS_LABELS = {
  PENDING: 'TF 설치 대기',
  IN_PROGRESS: 'TF 설치 중',
  COMPLETED: 'TF 설치 완료',
  FAILED: 'TF 설치 실패',
} as const;

// ===== IDC 에러 코드 =====

export const IDC_ERROR_CODES = {
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
  NOT_IDC_PROJECT: {
    code: 'NOT_IDC_PROJECT',
    message: 'IDC 프로젝트가 아닙니다.',
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
  INVALID_IP_TYPE: {
    code: 'INVALID_IP_TYPE',
    message: '유효하지 않은 IP 타입입니다.',
    status: 400,
  },
  ORACLE_REQUIRES_SERVICE_ID: {
    code: 'ORACLE_REQUIRES_SERVICE_ID',
    message: 'Oracle DB는 ServiceId가 필수입니다.',
    status: 400,
  },
  FIREWALL_NOT_OPENED: {
    code: 'FIREWALL_NOT_OPENED',
    message: '방화벽이 아직 오픈되지 않았습니다.',
    status: 400,
  },
} as const;

// ===== IDC 기본 포트 =====

export const IDC_DEFAULT_PORTS = {
  ORACLE: 1521,
  MYSQL: 3306,
  POSTGRESQL: 5432,
  MSSQL: 1433,
} as const;

// ===== IDC 가이드 URL =====

export const IDC_GUIDE_URLS = {
  FIREWALL_CONFIGURATION: 'https://docs.example.com/idc/firewall-configuration',
  BDC_TF_INSTALLATION: 'https://docs.example.com/idc/bdc-tf-installation',
} as const;

// ===== Source IP 추천 =====

export const IDC_SOURCE_IP_RECOMMENDATIONS = {
  public: {
    sourceIps: ['203.252.111.10', '203.252.111.11', '203.252.111.12'],
    port: 22,
    description: 'Public IP 환경에서 사용하는 BDC 서버 IP입니다.',
  },
  private: {
    sourceIps: ['10.100.50.10', '10.100.50.11', '10.100.50.12'],
    port: 22,
    description: 'Private IP (사내망) 환경에서 사용하는 BDC 서버 IP입니다.',
  },
  vpc: {
    sourceIps: ['172.31.0.10', '172.31.0.11', '172.31.0.12'],
    port: 22,
    description: 'VPC 연동 환경에서 사용하는 BDC 서버 IP입니다.',
  },
} as const;

// ===== IDC 유효성 검증 =====

export const IDC_VALIDATION = {
  MAX_IPS: 3,
  MAX_HOST_LENGTH: 100,
  IP_REGEX: /^((25[0-5]|(2[0-4]|1\d|[1-9]|)\d)\.?\b){4}$/,
} as const;
