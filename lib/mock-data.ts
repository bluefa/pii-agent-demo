import {
  User,
  ServiceCode,
  Project,
  ProcessStatus,
  DBCredential,
  ConnectionTestResult,
  ConnectionErrorType,
  DatabaseType,
  needsCredential,
} from './types';
import { getStore } from '@/lib/mock-store';

// ===== Mock Users =====
export const mockUsers: User[] = [
  {
    id: 'user-1',
    name: '홍길동',
    email: 'hong@company.com',
    role: 'SERVICE_MANAGER',
    serviceCodePermissions: ['SERVICE-A', 'SERVICE-B'],
  },
  {
    id: 'user-2',
    name: '김철수',
    email: 'kim@company.com',
    role: 'SERVICE_MANAGER',
    serviceCodePermissions: ['SERVICE-A'],
  },
  {
    id: 'admin-1',
    name: '관리자',
    email: 'admin@company.com',
    role: 'ADMIN',
    serviceCodePermissions: [],
  },
];

// ===== Current User (기본: 관리자) =====
let currentUserId = 'admin-1';

export const setCurrentUser = (userId: string) => {
  currentUserId = userId;
};

export const getCurrentUser = (): User | undefined => {
  return mockUsers.find((u) => u.id === currentUserId);
};

// ===== Mock Service Codes =====
export const mockServiceCodes: ServiceCode[] = [
  {
    code: 'SERVICE-A',
    name: '서비스 A',
    description: '고객 데이터 분석 서비스',
  },
  {
    code: 'SERVICE-B',
    name: '서비스 B',
    description: '마케팅 자동화 서비스',
  },
  {
    code: 'SERVICE-C',
    name: '서비스 C',
    description: '내부 운영 시스템',
  },
];

// ===== Mock Projects (각 단계별 1개씩) =====
export const mockProjects: Project[] = [
  // ===== Azure 프로젝트 =====
  {
    id: 'azure-proj-1',
    projectCode: 'AZURE-001',
    name: 'Azure PII Agent - DB 연동',
    description: 'Azure SQL, PostgreSQL, MySQL 리소스에 PII Agent 설치',
    serviceCode: 'SERVICE-A',
    cloudProvider: 'Azure',
    processStatus: ProcessStatus.INSTALLING,
    resources: [
      {
        id: 'azure-res-1',
        type: 'AZURE_MSSQL',
        resourceId: 'mssql-prod-001',
        databaseType: 'MSSQL',
        connectionStatus: 'PENDING',
        isSelected: true,
        lifecycleStatus: 'INSTALLING',
      },
      {
        id: 'azure-res-2',
        type: 'AZURE_POSTGRESQL',
        resourceId: 'pg-analytics-001',
        databaseType: 'POSTGRESQL',
        connectionStatus: 'PENDING',
        isSelected: true,
        lifecycleStatus: 'INSTALLING',
      },
      {
        id: 'azure-res-3',
        type: 'AZURE_MYSQL',
        resourceId: 'mysql-app-001',
        databaseType: 'MYSQL',
        connectionStatus: 'PENDING',
        isSelected: true,
        lifecycleStatus: 'INSTALLING',
      },
    ],
    terraformState: {
      bdcTf: 'PENDING',
    },
    createdAt: '2026-01-20T09:00:00Z',
    updatedAt: '2026-01-25T14:00:00Z',
    isRejected: false,
  },
  {
    id: 'azure-proj-2',
    projectCode: 'AZURE-002',
    name: 'Azure PII Agent - VM 포함',
    description: 'Azure DB + VM 리소스에 PII Agent 설치 (Case 2)',
    serviceCode: 'SERVICE-B',
    cloudProvider: 'Azure',
    processStatus: ProcessStatus.INSTALLING,
    resources: [
      {
        id: 'azure-res-4',
        type: 'AZURE_SYNAPSE',
        resourceId: 'synapse-dw-001',
        databaseType: 'MSSQL',
        connectionStatus: 'PENDING',
        isSelected: true,
        lifecycleStatus: 'INSTALLING',
      },
      {
        id: 'azure-res-5',
        type: 'AZURE_VM',
        resourceId: 'vm-agent-001',
        databaseType: 'MSSQL',
        connectionStatus: 'PENDING',
        isSelected: true,
        lifecycleStatus: 'INSTALLING',
      },
      {
        id: 'azure-res-6',
        type: 'AZURE_VM',
        resourceId: 'vm-agent-002',
        databaseType: 'POSTGRESQL',
        connectionStatus: 'PENDING',
        isSelected: true,
        lifecycleStatus: 'INSTALLING',
      },
    ],
    terraformState: {
      bdcTf: 'PENDING',
    },
    createdAt: '2026-01-22T10:00:00Z',
    updatedAt: '2026-01-26T11:00:00Z',
    isRejected: false,
  },
  // ===== AWS 프로젝트 =====
  {
    id: 'proj-1',
    projectCode: 'N-IRP-001',
    name: 'PII Agent 설치 - 고객 DB',
    description: 'SERVICE-A 고객 DB에 PII Agent를 설치하고 연결 상태를 모니터링합니다.',
    serviceCode: 'SERVICE-A',
    cloudProvider: 'AWS',
    processStatus: ProcessStatus.INSTALLATION_COMPLETE,
    resources: [
      {
        id: 'res-1',
        type: 'RDS',
        resourceId: 'rds-001',
        databaseType: 'MYSQL',
        connectionStatus: 'CONNECTED',
        isSelected: true,
        awsType: 'RDS',
        region: 'ap-northeast-2',
        lifecycleStatus: 'ACTIVE',
      },
      {
        id: 'res-2',
        type: 'ATHENA',
        resourceId: 'ath-001',
        databaseType: 'ATHENA',
        connectionStatus: 'CONNECTED',
        isSelected: true,
        awsType: 'ATHENA',
        region: 'ap-northeast-2',
        lifecycleStatus: 'ACTIVE',
      },
      {
        id: 'res-3',
        type: 'DYNAMODB',
        resourceId: 'ddb-001',
        databaseType: 'DYNAMODB',
        connectionStatus: 'CONNECTED',
        isSelected: true,
        awsType: 'DYNAMODB',
        region: 'ap-northeast-2',
        lifecycleStatus: 'ACTIVE',
      },
      // 스캔된 리소스(연동 대상 아님) 예시
      {
        id: 'res-11',
        type: 'REDSHIFT',
        resourceId: 'rs-001',
        databaseType: 'REDSHIFT',
        connectionStatus: 'PENDING',
        isSelected: false,
        awsType: 'REDSHIFT',
        region: 'us-east-1',
        lifecycleStatus: 'DISCOVERED',
        isNew: true,
        note: 'NEW',
      },
    ],
    terraformState: {
      serviceTf: 'COMPLETED',
      bdcTf: 'COMPLETED',
    },
    createdAt: '2024-01-15T09:00:00Z',
    updatedAt: '2024-01-20T14:30:00Z',
    isRejected: false,
  },
  {
    id: 'proj-2',
    projectCode: 'N-IRP-002',
    name: 'PII Agent 설치 - 로그 분석 계정',
    description: '스캔된 신규 리소스를 연동 대상으로 확정하고 관리자 승인을 대기합니다.',
    serviceCode: 'SERVICE-A',
    cloudProvider: 'AWS',
    processStatus: ProcessStatus.WAITING_APPROVAL,
    resources: [
      {
        id: 'res-4',
        type: 'RDS_CLUSTER',
        resourceId: 'rdscl-001',
        databaseType: 'POSTGRESQL',
        connectionStatus: 'PENDING',
        isSelected: true,
        awsType: 'RDS_CLUSTER',
        region: 'ap-northeast-2',
        lifecycleStatus: 'PENDING_APPROVAL',
        isNew: true,
        note: 'NEW',
      },
      {
        id: 'res-5',
        type: 'ATHENA',
        resourceId: 'ath-002',
        databaseType: 'ATHENA',
        connectionStatus: 'PENDING',
        isSelected: true,
        awsType: 'ATHENA',
        region: 'ap-northeast-2',
        lifecycleStatus: 'PENDING_APPROVAL',
        isNew: true,
        note: 'NEW',
      },
      // 스캔만 된 리소스(연동 대상 아님)
      {
        id: 'res-12',
        type: 'DYNAMODB',
        resourceId: 'ddb-010',
        databaseType: 'DYNAMODB',
        connectionStatus: 'PENDING',
        isSelected: false,
        awsType: 'DYNAMODB',
        region: 'ap-northeast-1',
        lifecycleStatus: 'DISCOVERED',
        isNew: true,
        note: 'NEW',
      },
    ],
    terraformState: {
      serviceTf: 'PENDING',
      bdcTf: 'PENDING',
    },
    createdAt: '2024-01-18T10:00:00Z',
    updatedAt: '2024-01-18T11:00:00Z',
    isRejected: true,
    rejectionReason: 'RDS_CLUSTER 리소스는 현재 지원되지 않습니다. RDS 단일 인스턴스만 선택해주세요.',
    rejectedAt: '2024-01-18T14:00:00Z',
  },
  {
    id: 'proj-3',
    projectCode: 'OTHER-003',
    name: 'PII Agent 설치 - 이벤트 적재 파이프라인',
    description: '승인 완료 후 설치가 진행 중입니다. (데모: 설치중 상태 표시)',
    serviceCode: 'SERVICE-A',
    cloudProvider: 'AWS',
    processStatus: ProcessStatus.INSTALLING,
    resources: [
      {
        id: 'res-6',
        type: 'RDS',
        resourceId: 'rds-003',
        databaseType: 'MYSQL',
        connectionStatus: 'PENDING',
        isSelected: true,
        awsType: 'RDS',
        region: 'us-west-2',
        lifecycleStatus: 'INSTALLING',
        isNew: true,
        note: 'NEW',
      },
      {
        id: 'res-13',
        type: 'REDSHIFT',
        resourceId: 'rs-003',
        databaseType: 'REDSHIFT',
        connectionStatus: 'PENDING',
        isSelected: false,
        awsType: 'REDSHIFT',
        region: 'us-west-2',
        lifecycleStatus: 'DISCOVERED',
        isNew: true,
        note: 'NEW',
      },
    ],
    terraformState: {
      serviceTf: 'COMPLETED',
      bdcTf: 'PENDING',
    },
    createdAt: '2024-01-19T08:00:00Z',
    updatedAt: '2024-01-19T09:00:00Z',
    isRejected: false,
  },
  {
    id: 'proj-4',
    projectCode: 'N-IRP-004',
    name: 'PII Agent 설치 - IDC 운영 DB',
    description: 'IDC 환경: 스캔 기능 없이 연동 대상 확정부터 진행합니다.',
    serviceCode: 'SERVICE-B',
    cloudProvider: 'IDC',
    processStatus: ProcessStatus.WAITING_TARGET_CONFIRMATION,
    resources: [
      {
        id: 'res-7',
        type: 'MySQL',
        resourceId: 'mysql-001',
        databaseType: 'MYSQL',
        connectionStatus: 'PENDING',
        isSelected: false,
        lifecycleStatus: 'DISCOVERED',
        isNew: true,
        note: 'NEW',
      },
      {
        id: 'res-8',
        type: 'PostgreSQL',
        resourceId: 'pg-001',
        databaseType: 'POSTGRESQL',
        connectionStatus: 'PENDING',
        isSelected: false,
        lifecycleStatus: 'DISCOVERED',
        isNew: true,
        note: 'NEW',
      },
    ],
    terraformState: {
      bdcTf: 'PENDING',
      // IDC: firewallCheck는 설치 진행 후 확인
    },
    createdAt: '2024-01-20T10:00:00Z',
    updatedAt: '2024-01-20T10:00:00Z',
    isRejected: false,
  },
  {
    id: 'proj-5',
    projectCode: 'DATA-005',
    name: 'PII Agent 설치 - 데이터 마트',
    description: '설치가 완료되어 연결 테스트가 필요합니다. 끊김/신규 리소스도 함께 표시합니다.',
    serviceCode: 'SERVICE-A',
    cloudProvider: 'AWS',
    processStatus: ProcessStatus.WAITING_CONNECTION_TEST,
    resources: [
      {
        id: 'res-9',
        type: 'RDS',
        resourceId: 'rds-004',
        databaseType: 'POSTGRESQL',
        connectionStatus: 'DISCONNECTED',
        isSelected: true,
        awsType: 'RDS',
        region: 'ap-northeast-2',
        lifecycleStatus: 'READY_TO_TEST',
        note: '끊김',
      },
      {
        id: 'res-10',
        type: 'DYNAMODB',
        resourceId: 'ddb-002',
        databaseType: 'DYNAMODB',
        connectionStatus: 'PENDING',
        isSelected: true,
        awsType: 'DYNAMODB',
        region: 'ap-northeast-2',
        lifecycleStatus: 'READY_TO_TEST',
        isNew: true,
        note: 'NEW',
      },
      // 스캔만 된 신규 리소스(연동 대상 아님)
      {
        id: 'res-14',
        type: 'ATHENA',
        resourceId: 'ath-999',
        databaseType: 'ATHENA',
        connectionStatus: 'PENDING',
        isSelected: false,
        awsType: 'ATHENA',
        region: 'ap-northeast-1',
        lifecycleStatus: 'DISCOVERED',
        isNew: true,
        note: 'NEW',
      },
    ],
    terraformState: {
      serviceTf: 'COMPLETED',
      bdcTf: 'COMPLETED',
    },
    createdAt: '2024-01-21T11:00:00Z',
    updatedAt: '2024-01-21T15:00:00Z',
    isRejected: false,
  },
];
// ===== Helper Functions =====

export const getProjectsByServiceCode = (serviceCode: string): Project[] => {
  const store = getStore();
  return store.projects.filter((p) => p.serviceCode === serviceCode);
};

export const getProjectById = (id: string): Project | undefined => {
  const store = getStore();
  return store.projects.find((p) => p.id === id);
};

export const addProject = (project: Project): Project => {
  const store = getStore();
  store.projects.push(project);
  return project;
};

export const updateProject = (id: string, updates: Partial<Project>): Project | undefined => {
  const store = getStore();
  const index = store.projects.findIndex((p) => p.id === id);
  if (index === -1) return undefined;

  store.projects[index] = {
    ...store.projects[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  return store.projects[index];
};

export const deleteProject = (id: string): boolean => {
  const store = getStore();
  const index = store.projects.findIndex((p) => p.id === id);
  if (index === -1) return false;
  store.projects.splice(index, 1);
  return true;
};

export const generateId = (prefix: string): string => {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
};

// ===== Mock DB Credentials =====
export const mockCredentials: DBCredential[] = [
  {
    id: 'cred-1',
    name: '운영DB-MySQL',
    databaseType: 'MYSQL',
    host: 'prod-mysql.example.com',
    port: 3306,
    username: 'pii_agent',
    maskedPassword: '********',
    createdAt: '2024-01-10T09:00:00Z',
    createdBy: 'user-1',
  },
  {
    id: 'cred-2',
    name: '분석DB-PostgreSQL',
    databaseType: 'POSTGRESQL',
    host: 'analytics-pg.example.com',
    port: 5432,
    username: 'analyst',
    maskedPassword: '********',
    createdAt: '2024-01-12T10:00:00Z',
    createdBy: 'user-1',
  },
  {
    id: 'cred-3',
    name: 'DW-Redshift',
    databaseType: 'REDSHIFT',
    host: 'dw-cluster.example.com',
    port: 5439,
    username: 'dw_reader',
    maskedPassword: '********',
    createdAt: '2024-01-15T11:00:00Z',
    createdBy: 'admin-1',
  },
];

// ===== Connection Test Simulation =====
const ERROR_MESSAGES: Record<ConnectionErrorType, string> = {
  AUTH_FAILED: '인증에 실패했습니다. Credential을 확인하세요.',
  PERMISSION_DENIED: '권한이 부족합니다. DB 권한을 확인하세요.',
  NETWORK_ERROR: '네트워크 연결에 실패했습니다. 방화벽 설정을 확인하세요.',
  TIMEOUT: '연결 시간이 초과되었습니다.',
  UNKNOWN_ERROR: '알 수 없는 오류가 발생했습니다.',
};

export const getCredentials = (): DBCredential[] => {
  const store = getStore();
  return store.credentials;
};

export const getCredentialsByDatabaseType = (databaseType: DatabaseType): DBCredential[] => {
  const store = getStore();
  return store.credentials.filter((c) => c.databaseType === databaseType);
};

export const simulateConnectionTest = (
  resourceId: string,
  resourceType: string,
  databaseType: DatabaseType,
  credentialId?: string,
  credentialName?: string
): ConnectionTestResult => {
  // Credential 필요한데 없으면 실패
  if (needsCredential(databaseType) && !credentialId) {
    return {
      resourceId,
      resourceType,
      databaseType,
      credentialName,
      success: false,
      error: {
        type: 'AUTH_FAILED',
        message: 'Credential이 선택되지 않았습니다.',
      },
    };
  }

  // 80% 성공, 10% 인증 문제, 10% 권한 문제
  const rand = Math.random();

  if (rand < 0.8) {
    return { resourceId, resourceType, databaseType, credentialName, success: true };
  }

  const errorType: ConnectionErrorType = rand < 0.9 ? 'AUTH_FAILED' : 'PERMISSION_DENIED';

  return {
    resourceId,
    resourceType,
    databaseType,
    credentialName,
    success: false,
    error: {
      type: errorType,
      message: ERROR_MESSAGES[errorType],
    },
  };
};

export const getCredentialById = (id: string): DBCredential | undefined => {
  const store = getStore();
  return store.credentials.find((c) => c.id === id);
};
