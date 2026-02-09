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
  AwsInstallationStatus,
  AwsServiceSettings,
  ProjectStatus,
} from './types';
import { getStore } from '@/lib/mock-store';
import { createInitialProjectStatus } from '@/lib/process';

/**
 * ProcessStatus에 맞는 ProjectStatus를 생성합니다.
 * Mock 데이터 초기화용 헬퍼 함수입니다.
 */
const createStatusForProcessStatus = (
  processStatus: ProcessStatus,
  options?: {
    isRejected?: boolean;
    selectedCount?: number;
    excludedCount?: number;
  }
): ProjectStatus => {
  const base = createInitialProjectStatus();
  const selectedCount = options?.selectedCount ?? 0;
  const excludedCount = options?.excludedCount ?? 0;

  switch (processStatus) {
    case ProcessStatus.WAITING_TARGET_CONFIRMATION:
      return {
        ...base,
        scan: { status: 'COMPLETED' },
      };

    case ProcessStatus.WAITING_APPROVAL:
      return {
        ...base,
        scan: { status: 'COMPLETED' },
        targets: { confirmed: true, selectedCount, excludedCount },
        approval: { status: options?.isRejected ? 'REJECTED' : 'PENDING' },
      };

    case ProcessStatus.INSTALLING:
      return {
        ...base,
        scan: { status: 'COMPLETED' },
        targets: { confirmed: true, selectedCount, excludedCount },
        approval: { status: 'APPROVED', approvedAt: new Date().toISOString() },
        installation: { status: 'IN_PROGRESS' },
      };

    case ProcessStatus.WAITING_CONNECTION_TEST:
      return {
        ...base,
        scan: { status: 'COMPLETED' },
        targets: { confirmed: true, selectedCount, excludedCount },
        approval: { status: 'APPROVED', approvedAt: new Date().toISOString() },
        installation: { status: 'COMPLETED', completedAt: new Date().toISOString() },
        connectionTest: { status: 'NOT_TESTED' },
      };

    case ProcessStatus.CONNECTION_VERIFIED:
      return {
        ...base,
        scan: { status: 'COMPLETED' },
        targets: { confirmed: true, selectedCount, excludedCount },
        approval: { status: 'APPROVED', approvedAt: new Date().toISOString() },
        installation: { status: 'COMPLETED', completedAt: new Date().toISOString() },
        connectionTest: { status: 'PASSED', passedAt: new Date().toISOString() },
      };

    case ProcessStatus.INSTALLATION_COMPLETE:
      return {
        ...base,
        scan: { status: 'COMPLETED' },
        targets: { confirmed: true, selectedCount, excludedCount },
        approval: { status: 'APPROVED', approvedAt: new Date().toISOString() },
        installation: { status: 'COMPLETED', completedAt: new Date().toISOString() },
        connectionTest: { status: 'PASSED', passedAt: new Date().toISOString() },
      };

    default:
      return base;
  }
};

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
  // ===== GCP 프로젝트 =====
  {
    id: 'gcp-proj-1',
    projectCode: 'GCP-001',
    name: 'GCP PII Agent - Cloud SQL / BigQuery',
    description: 'GCP Cloud SQL, BigQuery 리소스에 PII Agent 설치',
    serviceCode: 'SERVICE-A',
    cloudProvider: 'GCP',
    gcpProjectId: 'pii-agent-prod-12345',
    processStatus: ProcessStatus.WAITING_TARGET_CONFIRMATION,
    status: createStatusForProcessStatus(ProcessStatus.WAITING_TARGET_CONFIRMATION),
    resources: [],
    terraformState: {
      bdcTf: 'PENDING',
    },
    createdAt: '2026-02-01T09:00:00Z',
    updatedAt: '2026-02-01T09:00:00Z',
    isRejected: false,
  },
  // ===== Azure 프로젝트 =====
  {
    id: 'azure-proj-1',
    projectCode: 'AZURE-001',
    name: 'Azure PII Agent - DB 연동',
    description: 'Azure SQL, PostgreSQL, MySQL 리소스에 PII Agent 설치',
    serviceCode: 'SERVICE-A',
    cloudProvider: 'Azure',
    tenantId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    subscriptionId: '12345678-abcd-ef01-2345-6789abcdef01',
    processStatus: ProcessStatus.INSTALLING,
    status: createStatusForProcessStatus(ProcessStatus.INSTALLING, { selectedCount: 3 }),
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
    tenantId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    subscriptionId: '23456789-bcde-f012-3456-789abcdef012',
    processStatus: ProcessStatus.INSTALLING,
    status: createStatusForProcessStatus(ProcessStatus.INSTALLING, { selectedCount: 3 }),
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
    description: '자동 승인 테스트: res-excluded를 제외하고 나머지를 모두 선택하면 자동 승인됩니다.',
    serviceCode: 'SERVICE-A',
    cloudProvider: 'AWS',
    awsAccountId: '123456789012',
    awsRegionType: 'global',
    awsInstallationMode: 'AUTO',
    processStatus: ProcessStatus.WAITING_TARGET_CONFIRMATION,
    status: createStatusForProcessStatus(ProcessStatus.WAITING_TARGET_CONFIRMATION),
    resources: [
      {
        id: 'res-1',
        type: 'RDS',
        resourceId: 'rds-001',
        databaseType: 'MYSQL',
        connectionStatus: 'PENDING',
        isSelected: false,
        awsType: 'RDS',
        region: 'ap-northeast-2',
        lifecycleStatus: 'DISCOVERED',
      },
      {
        id: 'res-2',
        type: 'ATHENA',
        resourceId: 'ath-001',
        databaseType: 'ATHENA',
        connectionStatus: 'PENDING',
        isSelected: false,
        awsType: 'ATHENA',
        region: 'ap-northeast-2',
        lifecycleStatus: 'DISCOVERED',
      },
      {
        id: 'res-3',
        type: 'DYNAMODB',
        resourceId: 'ddb-001',
        databaseType: 'DYNAMODB',
        connectionStatus: 'PENDING',
        isSelected: false,
        awsType: 'DYNAMODB',
        region: 'ap-northeast-2',
        lifecycleStatus: 'DISCOVERED',
      },
      // 신규 스캔된 리소스
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
      // 이전에 제외된 리소스 (자동 승인 테스트용)
      {
        id: 'res-excluded',
        type: 'RDS',
        resourceId: 'rds-legacy-dev',
        databaseType: 'MYSQL',
        connectionStatus: 'PENDING',
        isSelected: false,
        awsType: 'RDS',
        region: 'ap-northeast-2',
        lifecycleStatus: 'DISCOVERED',
        note: '제외됨',
        exclusion: {
          reason: '개발 환경 DB - 연동 불필요',
          excludedAt: '2026-01-10T10:00:00Z',
          excludedBy: { id: 'admin-1', name: '관리자' },
        },
      },
      // RDS Cluster 리소스 — Regional (3 Instances)
      {
        id: 'res-cluster-1',
        type: 'RDS_CLUSTER',
        resourceId: 'aurora-prod-01',
        databaseType: 'POSTGRESQL',
        connectionStatus: 'PENDING',
        isSelected: false,
        awsType: 'RDS_CLUSTER',
        region: 'ap-northeast-2',
        lifecycleStatus: 'DISCOVERED',
        clusterType: 'REGIONAL',
        clusterInstances: [
          { instanceId: 'aurora-prod-01-reader-1', role: 'READER', availabilityZone: 'ap-northeast-2a', isSelected: false },
          { instanceId: 'aurora-prod-01-reader-2', role: 'READER', availabilityZone: 'ap-northeast-2c', isSelected: false },
          { instanceId: 'aurora-prod-01-writer', role: 'WRITER', availabilityZone: 'ap-northeast-2b', isSelected: false },
        ],
      },
      // RDS Cluster 리소스 — Global (7 Instances)
      {
        id: 'res-cluster-2',
        type: 'RDS_CLUSTER',
        resourceId: 'aurora-global-01',
        databaseType: 'MYSQL',
        connectionStatus: 'PENDING',
        isSelected: false,
        awsType: 'RDS_CLUSTER',
        region: 'ap-northeast-2',
        lifecycleStatus: 'DISCOVERED',
        clusterType: 'GLOBAL',
        clusterInstances: [
          { instanceId: 'aurora-global-01-reader-1', role: 'READER', availabilityZone: 'ap-northeast-2a', isSelected: false },
          { instanceId: 'aurora-global-01-reader-2', role: 'READER', availabilityZone: 'ap-northeast-2c', isSelected: false },
          { instanceId: 'aurora-global-01-writer', role: 'WRITER', availabilityZone: 'ap-northeast-2b', isSelected: false },
          { instanceId: 'aurora-global-01-reader-3', role: 'READER', availabilityZone: 'us-east-1a', isSelected: false },
          { instanceId: 'aurora-global-01-reader-4', role: 'READER', availabilityZone: 'us-east-1b', isSelected: false },
          { instanceId: 'aurora-global-01-reader-5', role: 'READER', availabilityZone: 'eu-west-1a', isSelected: false },
          { instanceId: 'aurora-global-01-reader-6', role: 'READER', availabilityZone: 'eu-west-1b', isSelected: false },
        ],
      },
      // EC2 리소스 (선택적 연동 대상)
      {
        id: 'res-ec2-1',
        type: 'EC2',
        resourceId: 'i-0a1b2c3d4e5f67890',
        databaseType: 'MYSQL',
        connectionStatus: 'PENDING',
        isSelected: false,
        awsType: 'EC2',
        region: 'ap-northeast-2',
        lifecycleStatus: 'DISCOVERED',
        vmDatabaseConfig: {
          host: 'ip-10-0-1-100.ap-northeast-2.compute.internal',
          databaseType: 'MYSQL',
          port: 3306,
        },
      },
      {
        id: 'res-ec2-2',
        type: 'EC2',
        resourceId: 'i-0f5e6d7c8b9a01234',
        databaseType: 'POSTGRESQL',
        connectionStatus: 'PENDING',
        isSelected: false,
        awsType: 'EC2',
        region: 'us-east-1',
        lifecycleStatus: 'DISCOVERED',
        vmDatabaseConfig: {
          host: 'ip-10-2-3-45.us-east-1.compute.internal',
          databaseType: 'POSTGRESQL',
          port: 5432,
        },
      },
    ],
    terraformState: {
      serviceTf: 'PENDING',
      bdcTf: 'PENDING',
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
    awsAccountId: '123456789012',
    awsRegionType: 'global',
    processStatus: ProcessStatus.WAITING_APPROVAL,
    status: createStatusForProcessStatus(ProcessStatus.WAITING_APPROVAL, { isRejected: true, selectedCount: 2, excludedCount: 1 }),
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
        clusterType: 'REGIONAL',
        clusterInstances: [
          { instanceId: 'rdscl-001-reader-1', role: 'READER', availabilityZone: 'ap-northeast-2a', isSelected: true },
          { instanceId: 'rdscl-001-writer', role: 'WRITER', availabilityZone: 'ap-northeast-2b', isSelected: false },
        ],
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
    awsAccountId: '123456789012',
    awsRegionType: 'global',
    processStatus: ProcessStatus.INSTALLING,
    status: createStatusForProcessStatus(ProcessStatus.INSTALLING, { selectedCount: 1, excludedCount: 1 }),
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
    status: createStatusForProcessStatus(ProcessStatus.WAITING_TARGET_CONFIRMATION),
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
      {
        id: 'res-excluded-1',
        type: 'Oracle',
        resourceId: 'oracle-legacy-001',
        databaseType: 'ORACLE',
        connectionStatus: 'PENDING',
        isSelected: false,
        lifecycleStatus: 'DISCOVERED',
        note: '제외됨',
        exclusion: {
          reason: '레거시 시스템 - 현재 지원되지 않음',
          excludedAt: '2026-01-15T10:00:00Z',
          excludedBy: { id: 'admin-1', name: '관리자' },
        },
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
    awsAccountId: '123456789012',
    awsRegionType: 'global',
    processStatus: ProcessStatus.WAITING_CONNECTION_TEST,
    status: createStatusForProcessStatus(ProcessStatus.WAITING_CONNECTION_TEST, { selectedCount: 2, excludedCount: 1 }),
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
  // ===== SDU 프로젝트 =====
  {
    id: 'sdu-proj-1',
    projectCode: 'SDU-001',
    name: 'SDU PII Agent - 온프레미스 DB 연동',
    description: 'SDU 환경 데이터베이스에 PII Agent 설치',
    serviceCode: 'SERVICE-C',
    cloudProvider: 'SDU',
    processStatus: ProcessStatus.WAITING_APPROVAL,
    status: createStatusForProcessStatus(ProcessStatus.WAITING_APPROVAL, { selectedCount: 2, excludedCount: 0 }),
    resources: [
      {
        id: 'sdu-res-1',
        type: 'IDC',
        resourceId: 'sdu-mysql-001',
        databaseType: 'MYSQL',
        connectionStatus: 'PENDING',
        isSelected: true,
        lifecycleStatus: 'PENDING_APPROVAL',
      },
      {
        id: 'sdu-res-2',
        type: 'IDC',
        resourceId: 'sdu-oracle-001',
        databaseType: 'ORACLE',
        connectionStatus: 'PENDING',
        isSelected: true,
        lifecycleStatus: 'PENDING_APPROVAL',
      },
    ],
    terraformState: {
      bdcTf: 'PENDING',
    },
    createdAt: '2026-01-28T10:00:00Z',
    updatedAt: '2026-01-28T11:00:00Z',
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

// ===== Mock AWS Installation Status =====
// 기존 AWS 프로젝트들의 설치 상태 초기 데이터
export const mockAwsInstallations: Map<string, AwsInstallationStatus> = new Map([
  // proj-3: 설치 진행 중 (INSTALLING) - Service TF 완료, BDC TF 진행 중
  [
    'proj-3',
    {
      provider: 'AWS',
      hasTfPermission: true,
      serviceTfCompleted: true,
      bdcTfCompleted: false,
      lastCheckedAt: '2024-01-19T09:00:00Z',
    },
  ],
  // proj-5: 연결 테스트 대기 (WAITING_CONNECTION_TEST) - 설치 완료
  [
    'proj-5',
    {
      provider: 'AWS',
      hasTfPermission: true,
      serviceTfCompleted: true,
      bdcTfCompleted: true,
      completedAt: '2024-01-21T14:00:00Z',
      lastCheckedAt: '2024-01-21T15:00:00Z',
    },
  ],
]);

// ===== Mock AWS Service Settings =====
// 서비스별 AWS 연동 설정 초기 데이터
export const mockAwsServiceSettings: Map<string, AwsServiceSettings> = new Map([
  // SERVICE-A: AWS 설정 완료
  [
    'SERVICE-A',
    {
      accountId: '123456789012',
      scanRole: {
        registered: true,
        roleArn: 'arn:aws:iam::123456789012:role/PIIAgentScanRole',
        lastVerifiedAt: '2024-01-15T10:00:00Z',
        status: 'VALID',
      },
    },
  ],
  // SERVICE-B: AWS 설정 미완료 (IDC 프로젝트만 있음)
  [
    'SERVICE-B',
    {
      scanRole: {
        registered: false,
      },
      guide: {
        title: 'AWS 연동 설정 필요',
        steps: [
          '서비스에 사용할 AWS 계정 ID를 입력하세요.',
          'Scan Role ARN을 입력하세요.',
          'Scan Role은 BDC가 AWS 리소스를 스캔할 때 사용됩니다.',
          '필요한 권한: ReadOnlyAccess 또는 커스텀 정책',
        ],
        documentUrl: 'https://docs.example.com/aws/scan-role-setup',
      },
    },
  ],
  // SERVICE-C: AWS 설정 완료되었으나 Role 검증 필요
  [
    'SERVICE-C',
    {
      accountId: '987654321098',
      scanRole: {
        registered: true,
        roleArn: 'arn:aws:iam::987654321098:role/PIIAgentScanRole',
        lastVerifiedAt: '2024-01-10T09:00:00Z',
        status: 'NOT_VERIFIED',
      },
    },
  ],
]);

// ===== AWS Installation Helper Functions =====

export const initializeAwsStoreData = () => {
  const store = getStore();

  // 초기 AWS 설치 상태 로드
  mockAwsInstallations.forEach((status, projectId) => {
    store.awsInstallations.set(projectId, status);
  });

  // 초기 AWS 서비스 설정 로드
  mockAwsServiceSettings.forEach((settings, serviceCode) => {
    store.awsServiceSettings.set(serviceCode, settings);
  });
};
