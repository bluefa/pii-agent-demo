// ===== Private Endpoint 상태 라벨 =====

export const PRIVATE_ENDPOINT_STATUS_LABELS = {
  NOT_REQUESTED: 'BDC측 확인 필요',
  PENDING_APPROVAL: 'Azure Portal에서 승인 필요',
  APPROVED: '승인 완료',
  REJECTED: 'BDC측 재신청 필요',
} as const;

// ===== Azure 에러 코드 =====

export const AZURE_ERROR_CODES = {
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
  NOT_AZURE_PROJECT: {
    code: 'NOT_AZURE_PROJECT',
    message: 'Azure 프로젝트가 아닙니다.',
    status: 400,
  },
  SERVICE_NOT_FOUND: {
    code: 'SERVICE_NOT_FOUND',
    message: '서비스를 찾을 수 없습니다.',
    status: 404,
  },
  NO_VM_RESOURCES: {
    code: 'NO_VM_RESOURCES',
    message: 'VM 리소스가 없습니다.',
    status: 400,
  },
  VALIDATION_FAILED: {
    code: 'VALIDATION_FAILED',
    message: '검증에 실패했습니다.',
    status: 400,
  },
} as const;

// ===== Azure 리소스 타입 =====

export const AZURE_RESOURCE_TYPES = {
  DB: ['AZURE_MSSQL', 'AZURE_POSTGRESQL', 'AZURE_MYSQL', 'AZURE_MARIADB', 'AZURE_COSMOS_NOSQL', 'AZURE_SYNAPSE'],
  VM: ['AZURE_VM'],
} as const;

// ===== Private Endpoint 필요 리소스 타입 =====

export const PRIVATE_ENDPOINT_REQUIRED_TYPES = [
  'AZURE_MSSQL',
  'AZURE_POSTGRESQL',
  'AZURE_MYSQL',
  'AZURE_MARIADB',
  'AZURE_COSMOS_NOSQL',
  'AZURE_SYNAPSE',
] as const;

// ===== VNet Integration 관련 =====

export const VNET_INTEGRATION_AFFECTED_TYPES = ['AZURE_MYSQL', 'AZURE_POSTGRESQL'] as const;

export const AZURE_NETWORKING_MODE_LABELS = {
  PUBLIC_ACCESS: 'Public Access',
  VNET_INTEGRATION: 'VNet Integration (Private Access)',
} as const;

// ===== 가이드 문서 URL =====

export const AZURE_GUIDE_URLS = {
  SCAN_APP_REGISTRATION: 'https://docs.example.com/azure/scan-app-registration',
  SUBNET_CONFIGURATION: 'https://docs.example.com/azure/subnet-configuration',
  PRIVATE_ENDPOINT_APPROVAL: 'https://docs.example.com/azure/private-endpoint-approval',
  VNET_NETWORKING: 'https://learn.microsoft.com/azure/mysql/flexible-server/concepts-networking-vnet',
} as const;
