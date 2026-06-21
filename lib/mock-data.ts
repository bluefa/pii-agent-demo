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
  LegacyAwsInstallationStatus,
  LegacyAwsServiceSettings,
  ProjectStatus,
} from '@/lib/types';
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
        connectionTest: { status: 'PASSED', passedAt: new Date().toISOString(), operationConfirmed: true },
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
    serviceCodePermissions: ['azure', 'aws', 'idc', 'gcp'],
  },
  {
    id: 'user-2',
    name: '김철수',
    email: 'kim@company.com',
    role: 'SERVICE_MANAGER',
    serviceCodePermissions: ['azure', 'aws', 'idc', 'gcp'],
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
    code: 'azure',
    name: 'Azure',
    description: 'Azure 클라우드 PII Agent 연동',
  },
  {
    code: 'aws',
    name: 'AWS',
    description: 'AWS 클라우드 PII Agent 연동',
  },
  {
    code: 'idc',
    name: 'IDC',
    description: 'IDC 온프레미스 PII Agent 연동',
  },
  {
    code: 'gcp',
    name: 'GCP',
    description: 'GCP 클라우드 PII Agent 연동',
  },
];

// ===== Mock Projects (각 단계별 1개씩) =====
export const mockProjects: Project[] = [
  // ===== GCP 프로젝트 =====
  {
    id: 'gcp-proj-1',
    targetSourceId: 1002,
    projectCode: 'GCP-001',
    name: 'GCP PII Agent - Cloud SQL / BigQuery',
    description: 'GCP Cloud SQL, BigQuery 리소스에 PII Agent 설치',
    serviceCode: 'gcp',
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
    targetSourceId: 1003,
    projectCode: 'AZURE-001',
    name: 'Azure PII Agent - DB 연동',
    description: 'Azure SQL, PostgreSQL, MySQL 리소스에 PII Agent 설치',
    serviceCode: 'azure',
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
        integrationCategory: 'TARGET',
      },
      {
        id: 'azure-res-2',
        type: 'AZURE_POSTGRESQL',
        resourceId: 'pg-analytics-001',
        databaseType: 'POSTGRESQL',
        connectionStatus: 'PENDING',
        isSelected: true,
        integrationCategory: 'TARGET',
      },
      {
        id: 'azure-res-3',
        type: 'AZURE_MYSQL',
        resourceId: 'mysql-app-001',
        databaseType: 'MYSQL',
        connectionStatus: 'PENDING',
        isSelected: true,
        integrationCategory: 'TARGET',
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
    targetSourceId: 1004,
    projectCode: 'AZURE-002',
    name: 'Azure PII Agent - VM 포함',
    description: 'Azure DB + VM 리소스에 PII Agent 설치 (Case 2)',
    serviceCode: 'azure',
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
        integrationCategory: 'TARGET',
      },
      {
        id: 'azure-res-5',
        type: 'AZURE_VM',
        resourceId: 'vm-agent-001',
        databaseType: 'MSSQL',
        connectionStatus: 'PENDING',
        isSelected: true,
        integrationCategory: 'NO_INSTALL_NEEDED',
        nics: [
          { nicId: 'nic-vm-agent-001-0', name: 'nic-vm-agent-001-0', privateIp: '10.0.1.10' },
        ],
      },
      {
        id: 'azure-res-6',
        type: 'AZURE_VM',
        resourceId: 'vm-agent-002',
        databaseType: 'POSTGRESQL',
        connectionStatus: 'PENDING',
        isSelected: true,
        integrationCategory: 'NO_INSTALL_NEEDED',
        nics: [
          { nicId: 'nic-vm-agent-002-0', name: 'nic-vm-agent-002-0', privateIp: '10.0.2.20' },
          { nicId: 'nic-vm-agent-002-1', name: 'nic-vm-agent-002-1', privateIp: '10.0.2.21' },
          { nicId: 'nic-vm-agent-002-2', name: 'nic-vm-agent-002-2', privateIp: '10.0.2.22' },
        ],
      },
    ],
    terraformState: {
      bdcTf: 'PENDING',
    },
    createdAt: '2026-01-22T10:00:00Z',
    updatedAt: '2026-01-26T11:00:00Z',
    isRejected: false,
  },
  {
    id: 'azure-proj-3',
    targetSourceId: 1005,
    projectCode: 'AZURE-003',
    name: 'Azure PII Agent - VM+MySQL 스캔 완료',
    description: 'VM 1대 + MySQL 1대, 스캔 완료 후 연동 대상 확정 전',
    serviceCode: 'azure',
    cloudProvider: 'Azure',
    tenantId: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
    subscriptionId: '34567890-cdef-0123-4567-89abcdef0123',
    processStatus: ProcessStatus.WAITING_TARGET_CONFIRMATION,
    status: createStatusForProcessStatus(ProcessStatus.WAITING_TARGET_CONFIRMATION),
    resources: [
      {
        id: 'azure-res-7',
        type: 'AZURE_VM',
        resourceId: 'vm-scan-001',
        databaseType: 'MYSQL',
        connectionStatus: 'PENDING',
        isSelected: true,
        integrationCategory: 'NO_INSTALL_NEEDED',
        nics: [
          { nicId: 'nic-vm-scan-001-0', name: 'nic-vm-scan-001-0', privateIp: '10.0.3.30' },
          { nicId: 'nic-vm-scan-001-1', name: 'nic-vm-scan-001-1', privateIp: '10.0.3.31' },
        ],
      },
      {
        id: 'azure-res-8',
        type: 'AZURE_MYSQL',
        resourceId: 'mysql-scan-001',
        databaseType: 'MYSQL',
        connectionStatus: 'PENDING',
        isSelected: true,
        integrationCategory: 'TARGET',
        azureNetworkingMode: 'PUBLIC_ACCESS',
      },
      {
        id: 'azure-res-vnet-1',
        type: 'AZURE_MYSQL',
        resourceId: '/subscriptions/34567890-cdef-0123-4567-89abcdef0123/resourceGroups/rg-prod-app/providers/Microsoft.DBforMySQL/flexibleServers/mysql-vnet-001',
        databaseType: 'MYSQL',
        connectionStatus: 'PENDING',
        isSelected: false,
        integrationCategory: 'INSTALL_INELIGIBLE',
        azureNetworkingMode: 'VNET_INTEGRATION',
      },
      {
        id: 'azure-res-vnet-2',
        type: 'AZURE_POSTGRESQL',
        resourceId: '/subscriptions/34567890-cdef-0123-4567-89abcdef0123/resourceGroups/rg-prod-app/providers/Microsoft.DBforPostgreSQL/flexibleServers/psql-vnet-001',
        databaseType: 'POSTGRESQL',
        connectionStatus: 'PENDING',
        isSelected: false,
        integrationCategory: 'INSTALL_INELIGIBLE',
        azureNetworkingMode: 'VNET_INTEGRATION',
      },
    ],
    terraformState: {
      bdcTf: 'PENDING',
    },
    createdAt: '2026-02-05T09:00:00Z',
    updatedAt: '2026-02-09T10:00:00Z',
    isRejected: false,
  },
  // ===== AWS 프로젝트 =====
  {
    id: 'proj-1',
    targetSourceId: 1006,
    projectCode: 'N-IRP-001',
    name: 'PII Agent 설치 - 고객 DB',
    description: '자동 승인 테스트: res-excluded를 제외하고 나머지를 모두 선택하면 자동 승인됩니다.',
    serviceCode: 'aws',
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
        isSelected: true,
        awsType: 'RDS',
        region: 'ap-northeast-2',
        vpcId: 'vpc-seoul-001',
        integrationCategory: 'TARGET',
      },
      {
        id: 'res-2',
        type: 'ATHENA',
        resourceId: 'ath-001',
        databaseType: 'ATHENA',
        connectionStatus: 'PENDING',
        isSelected: true,
        awsType: 'ATHENA',
        region: 'ap-northeast-2',
        integrationCategory: 'TARGET',
      },
      {
        id: 'res-3',
        type: 'DYNAMODB',
        resourceId: 'ddb-001',
        databaseType: 'DYNAMODB',
        connectionStatus: 'PENDING',
        isSelected: true,
        awsType: 'DYNAMODB',
        region: 'ap-northeast-2',
        integrationCategory: 'TARGET',
      },
      // 신규 스캔된 리소스
      {
        id: 'res-11',
        type: 'REDSHIFT',
        resourceId: 'rs-001',
        databaseType: 'REDSHIFT',
        connectionStatus: 'PENDING',
        isSelected: true,
        awsType: 'REDSHIFT',
        region: 'us-east-1',
        vpcId: 'vpc-useast-001',
        integrationCategory: 'TARGET',
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
        vpcId: 'vpc-seoul-001',
        integrationCategory: 'TARGET',
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
        isSelected: true,
        awsType: 'RDS_CLUSTER',
        region: 'ap-northeast-2',
        vpcId: 'vpc-seoul-001',
        integrationCategory: 'TARGET',
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
        isSelected: true,
        awsType: 'RDS_CLUSTER',
        region: 'ap-northeast-2',
        vpcId: 'vpc-seoul-001',
        integrationCategory: 'TARGET',
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
      // DocumentDB 리소스
      {
        id: 'res-docdb-1',
        type: 'DOCUMENTDB',
        resourceId: 'docdb-prod-01',
        databaseType: 'MONGODB',
        connectionStatus: 'PENDING',
        isSelected: true,
        awsType: 'DOCUMENTDB',
        region: 'ap-northeast-2',
        vpcId: 'vpc-seoul-001',
        integrationCategory: 'TARGET',
      },
      // EC2 리소스 (선택적 연동 대상)
      {
        id: 'res-ec2-1',
        type: 'EC2',
        resourceId: 'i-0a1b2c3d4e5f67890',
        databaseType: 'MYSQL',
        connectionStatus: 'PENDING',
        isSelected: true,
        awsType: 'EC2',
        region: 'ap-northeast-2',
        vpcId: 'vpc-seoul-001',
        integrationCategory: 'NO_INSTALL_NEEDED',
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
        isSelected: true,
        awsType: 'EC2',
        region: 'us-east-1',
        vpcId: 'vpc-useast-001',
        integrationCategory: 'NO_INSTALL_NEEDED',
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
    targetSourceId: 1007,
    projectCode: 'N-IRP-002',
    name: 'PII Agent 설치 - 로그 분석 계정',
    description: '스캔된 신규 리소스를 연동 대상으로 확정하고 관리자 승인을 대기합니다.',
    serviceCode: 'aws',
    cloudProvider: 'AWS',
    awsAccountId: '123456789012',
    awsRegionType: 'global',
    awsInstallationMode: 'AUTO',
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
        vpcId: 'vpc-seoul-001',
        integrationCategory: 'TARGET',
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
        integrationCategory: 'TARGET',
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
        integrationCategory: 'TARGET',
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
    targetSourceId: 1008,
    projectCode: 'OTHER-003',
    name: 'PII Agent 설치 - 이벤트 적재 파이프라인',
    description: '승인 완료 후 설치가 진행 중입니다. (데모: 설치중 상태 표시)',
    serviceCode: 'aws',
    cloudProvider: 'AWS',
    awsAccountId: '123456789012',
    awsRegionType: 'global',
    awsInstallationMode: 'AUTO',
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
        vpcId: 'vpc-uswest-001',
        integrationCategory: 'TARGET',
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
        vpcId: 'vpc-uswest-001',
        integrationCategory: 'TARGET',
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
    id: 'proj-5',
    targetSourceId: 1010,
    projectCode: 'DATA-005',
    name: 'PII Agent 설치 - 데이터 마트',
    description: '설치가 완료되어 연결 테스트가 필요합니다. 끊김/신규 리소스도 함께 표시합니다.',
    serviceCode: 'aws',
    cloudProvider: 'AWS',
    awsAccountId: '123456789012',
    awsRegionType: 'global',
    awsInstallationMode: 'AUTO',
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
        vpcId: 'vpc-seoul-001',
        integrationCategory: 'TARGET',
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
        integrationCategory: 'TARGET',
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
        integrationCategory: 'TARGET',
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
  {
    id: 'proj-6',
    targetSourceId: 1011,
    projectCode: 'DATA-006',
    name: 'PII Agent 설치 - 결제 데이터',
    description: '연결 테스트까지 끝나 최종 관리자 승인 대기 중입니다.',
    serviceCode: 'aws',
    cloudProvider: 'AWS',
    awsAccountId: '123456789012',
    awsRegionType: 'global',
    awsInstallationMode: 'AUTO',
    processStatus: ProcessStatus.CONNECTION_VERIFIED,
    status: createStatusForProcessStatus(ProcessStatus.CONNECTION_VERIFIED, { selectedCount: 2, excludedCount: 0 }),
    resources: [
      {
        id: 'res-15',
        type: 'RDS',
        resourceId: 'rds-005',
        databaseType: 'MYSQL',
        connectionStatus: 'CONNECTED',
        isSelected: true,
        awsType: 'RDS',
        region: 'ap-northeast-2',
        vpcId: 'vpc-seoul-002',
        integrationCategory: 'TARGET',
      },
      {
        id: 'res-16',
        type: 'DYNAMODB',
        resourceId: 'ddb-003',
        databaseType: 'DYNAMODB',
        connectionStatus: 'CONNECTED',
        isSelected: true,
        awsType: 'DYNAMODB',
        region: 'ap-northeast-2',
        integrationCategory: 'TARGET',
      },
    ],
    terraformState: {
      serviceTf: 'COMPLETED',
      bdcTf: 'COMPLETED',
    },
    createdAt: '2024-01-22T09:00:00Z',
    updatedAt: '2024-01-22T16:00:00Z',
    isRejected: false,
  },
  {
    id: 'proj-7',
    targetSourceId: 1012,
    projectCode: 'DATA-007',
    name: 'PII Agent 모니터링 운영',
    description: '연동 설치가 완료되어 PII 모니터링이 실행 중입니다.',
    serviceCode: 'aws',
    cloudProvider: 'AWS',
    awsAccountId: '123456789012',
    awsRegionType: 'global',
    awsInstallationMode: 'AUTO',
    processStatus: ProcessStatus.INSTALLATION_COMPLETE,
    status: createStatusForProcessStatus(ProcessStatus.INSTALLATION_COMPLETE, { selectedCount: 3, excludedCount: 0 }),
    resources: [
      {
        id: 'res-17',
        type: 'RDS',
        resourceId: 'rds-006',
        databaseType: 'MYSQL',
        connectionStatus: 'CONNECTED',
        isSelected: true,
        awsType: 'RDS',
        region: 'ap-northeast-2',
        vpcId: 'vpc-seoul-003',
        integrationCategory: 'TARGET',
      },
      {
        id: 'res-18',
        type: 'RDS',
        resourceId: 'rds-007',
        databaseType: 'POSTGRESQL',
        connectionStatus: 'CONNECTED',
        isSelected: true,
        awsType: 'RDS',
        region: 'ap-northeast-2',
        vpcId: 'vpc-seoul-003',
        integrationCategory: 'TARGET',
      },
      {
        id: 'res-19',
        type: 'DYNAMODB',
        resourceId: 'ddb-004',
        databaseType: 'DYNAMODB',
        connectionStatus: 'CONNECTED',
        isSelected: true,
        awsType: 'DYNAMODB',
        region: 'ap-northeast-2',
        integrationCategory: 'TARGET',
      },
    ],
    terraformState: {
      serviceTf: 'COMPLETED',
      bdcTf: 'COMPLETED',
    },
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-25T14:30:00Z',
    isRejected: false,
  },
];

// ===== IDC 데모 프로젝트 (Step 1~7) =====
// IDC 리소스 데이터는 lib/mock-idc.ts 의 idcStore 가 보유한다. 프로젝트의
// resources 는 비워 두고 processStatus 만 단계별로 시드해 각 화면을 데모한다.
const makeIdcProject = (
  targetSourceId: number,
  step: ProcessStatus,
  name: string,
): Project => ({
  id: `idc-proj-${targetSourceId}`,
  targetSourceId,
  projectCode: `IDC-${String(targetSourceId).slice(-3)}`,
  name,
  description: 'IDC 온프레미스 DB에 PII Agent 연동',
  serviceCode: 'idc',
  cloudProvider: 'IDC',
  processStatus: step,
  status: createStatusForProcessStatus(step, { selectedCount: 2, excludedCount: 1 }),
  resources: [],
  terraformState: { bdcTf: step >= ProcessStatus.INSTALLING ? 'COMPLETED' : 'PENDING' },
  createdAt: '2026-03-01T09:00:00Z',
  updatedAt: '2026-03-01T09:00:00Z',
  isRejected: false,
});

mockProjects.push(
  makeIdcProject(1020, ProcessStatus.WAITING_TARGET_CONFIRMATION, 'IDC PII Agent - 연동 대상 입력'),
  makeIdcProject(1021, ProcessStatus.WAITING_APPROVAL, 'IDC PII Agent - 승인 대기'),
  makeIdcProject(1022, ProcessStatus.APPLYING_APPROVED, 'IDC PII Agent - 반영 중'),
  makeIdcProject(1023, ProcessStatus.INSTALLING, 'IDC PII Agent - 설치 진행'),
  makeIdcProject(1024, ProcessStatus.WAITING_CONNECTION_TEST, 'IDC PII Agent - 연결 테스트'),
  makeIdcProject(1025, ProcessStatus.CONNECTION_VERIFIED, 'IDC PII Agent - 연결 확인'),
  makeIdcProject(1026, ProcessStatus.INSTALLATION_COMPLETE, 'IDC PII Agent - 설치 완료'),
);

// ===== Cloud step-coverage seed (detail page) =====
// One target source per (cloud × processStatus) so every step 1~7 is viewable on
// the target-source detail page for azure / aws / gcp (IDC is seeded above).
// Cloud step screens read `project.resources`, so GCP (whose only seed has none)
// gets a small demo set; azure/aws clones inherit their base's resources.
const gcpDemoResources: Project['resources'] = [
  {
    id: 'gcp-res-1',
    type: 'GCP_SQL',
    resourceId: 'projects/pii-agent-prod-12345/instances/sql-prod-mysql-01',
    databaseType: 'MYSQL',
    connectionStatus: 'PENDING',
    isSelected: true,
    integrationCategory: 'TARGET',
  },
  {
    id: 'gcp-res-2',
    type: 'GCP_SQL',
    resourceId: 'projects/pii-agent-prod-12345/instances/sql-prod-pg-01',
    databaseType: 'POSTGRESQL',
    connectionStatus: 'PENDING',
    isSelected: true,
    integrationCategory: 'TARGET',
  },
];

const cloneForStep = (
  baseId: string,
  over: {
    id: string;
    targetSourceId: number;
    projectCode: string;
    name: string;
    status: ProcessStatus;
    resources?: Project['resources'];
  },
): Project => {
  const base = mockProjects.find((p) => p.id === baseId);
  if (!base) throw new Error(`step-coverage base not found: ${baseId}`);
  return {
    ...base,
    id: over.id,
    targetSourceId: over.targetSourceId,
    projectCode: over.projectCode,
    name: over.name,
    processStatus: over.status,
    status: createStatusForProcessStatus(over.status, { selectedCount: 2 }),
    resources: over.resources ?? base.resources,
    isRejected: false,
  };
};

mockProjects.push(
  // AWS — fills the missing APPLYING_APPROVED step
  cloneForStep('proj-3', {
    id: 'aws-proj-applying',
    targetSourceId: 2001,
    projectCode: 'AWS-APPLYING',
    name: 'AWS PII Agent - 반영 중',
    status: ProcessStatus.APPLYING_APPROVED,
  }),
  // Azure — fills steps 2/3/5/6/7 (base azure-proj-1 carries full resources)
  cloneForStep('azure-proj-1', { id: 'azure-proj-approval', targetSourceId: 2002, projectCode: 'AZURE-APPROVAL', name: 'Azure PII Agent - 승인 대기', status: ProcessStatus.WAITING_APPROVAL }),
  cloneForStep('azure-proj-1', { id: 'azure-proj-applying', targetSourceId: 2003, projectCode: 'AZURE-APPLYING', name: 'Azure PII Agent - 반영 중', status: ProcessStatus.APPLYING_APPROVED }),
  cloneForStep('azure-proj-1', { id: 'azure-proj-test', targetSourceId: 2004, projectCode: 'AZURE-TEST', name: 'Azure PII Agent - 연결 테스트', status: ProcessStatus.WAITING_CONNECTION_TEST }),
  cloneForStep('azure-proj-1', { id: 'azure-proj-verified', targetSourceId: 2005, projectCode: 'AZURE-VERIFIED', name: 'Azure PII Agent - 완료 승인 대기', status: ProcessStatus.CONNECTION_VERIFIED }),
  cloneForStep('azure-proj-1', { id: 'azure-proj-complete', targetSourceId: 2006, projectCode: 'AZURE-COMPLETE', name: 'Azure PII Agent - 연동 완료', status: ProcessStatus.INSTALLATION_COMPLETE }),
  // GCP — fills steps 2/3/4/5/6/7 (gcp-proj-1 has no resources, so inject a demo set)
  cloneForStep('gcp-proj-1', { id: 'gcp-proj-approval', targetSourceId: 2007, projectCode: 'GCP-APPROVAL', name: 'GCP PII Agent - 승인 대기', status: ProcessStatus.WAITING_APPROVAL, resources: gcpDemoResources }),
  cloneForStep('gcp-proj-1', { id: 'gcp-proj-applying', targetSourceId: 2008, projectCode: 'GCP-APPLYING', name: 'GCP PII Agent - 반영 중', status: ProcessStatus.APPLYING_APPROVED, resources: gcpDemoResources }),
  cloneForStep('gcp-proj-1', { id: 'gcp-proj-installing', targetSourceId: 2009, projectCode: 'GCP-INSTALLING', name: 'GCP PII Agent - 설치 진행', status: ProcessStatus.INSTALLING, resources: gcpDemoResources }),
  cloneForStep('gcp-proj-1', { id: 'gcp-proj-test', targetSourceId: 2010, projectCode: 'GCP-TEST', name: 'GCP PII Agent - 연결 테스트', status: ProcessStatus.WAITING_CONNECTION_TEST, resources: gcpDemoResources }),
  cloneForStep('gcp-proj-1', { id: 'gcp-proj-verified', targetSourceId: 2011, projectCode: 'GCP-VERIFIED', name: 'GCP PII Agent - 완료 승인 대기', status: ProcessStatus.CONNECTION_VERIFIED, resources: gcpDemoResources }),
  cloneForStep('gcp-proj-1', { id: 'gcp-proj-complete', targetSourceId: 2012, projectCode: 'GCP-COMPLETE', name: 'GCP PII Agent - 연동 완료', status: ProcessStatus.INSTALLATION_COMPLETE, resources: gcpDemoResources }),
);

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

export const generateTargetSourceId = (): number => {
  const projects = getStore().projects;
  if (projects.length === 0) return 1001;
  return Math.max(...projects.map(p => p.targetSourceId)) + 1;
};

export const getProjectByTargetSourceId = (targetSourceId: number): Project | undefined =>
  getStore().projects.find(p => p.targetSourceId === targetSourceId);

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
// 기존 AWS 프로젝트들의 설치 상태 초기 데이터 (key: targetSourceId)
export const mockAwsInstallations: Map<number, LegacyAwsInstallationStatus> = new Map([
  // targetSourceId 1008 (proj-3): 설치 진행 중 (INSTALLING) - Service TF 완료, BDC TF 진행 중
  [
    1008,
    {
      provider: 'AWS',
      hasTfPermission: true,
      serviceTfScripts: [
        { id: 'vpc_vpc-seoul-001_ap-northeast-2', type: 'VPC_ENDPOINT', status: 'COMPLETED', label: 'vpc_vpc-seoul-001_ap-northeast-2', vpcId: 'vpc-seoul-001', region: 'ap-northeast-2', resources: [{ resourceId: 'rds-003', type: 'RDS', name: 'rds-003' }], completedAt: '2024-01-19T08:30:00Z' },
      ],
      bdcTf: { status: 'IN_PROGRESS' },
      serviceTfCompleted: true,
      bdcTfCompleted: false,
      lastCheckedAt: '2024-01-19T09:00:00Z',
    },
  ],
  // targetSourceId 1010 (proj-5): 연결 테스트 대기 (WAITING_CONNECTION_TEST) - 설치 완료
  [
    1010,
    {
      provider: 'AWS',
      hasTfPermission: true,
      serviceTfScripts: [
        { id: 'vpc_vpc-seoul-001_ap-northeast-2', type: 'VPC_ENDPOINT', status: 'COMPLETED', label: 'vpc_vpc-seoul-001_ap-northeast-2', vpcId: 'vpc-seoul-001', region: 'ap-northeast-2', resources: [{ resourceId: 'rds-005', type: 'RDS', name: 'rds-005' }], completedAt: '2024-01-21T13:30:00Z' },
        { id: 'dynamodb_ap-northeast-2', type: 'DYNAMODB_ROLE', status: 'COMPLETED', label: 'dynamodb_ap-northeast-2', region: 'ap-northeast-2', resources: [{ resourceId: 'ddb-005', type: 'DYNAMODB', name: 'ddb-005' }], completedAt: '2024-01-21T13:35:00Z' },
      ],
      bdcTf: { status: 'COMPLETED', completedAt: '2024-01-21T14:00:00Z' },
      serviceTfCompleted: true,
      bdcTfCompleted: true,
      completedAt: '2024-01-21T14:00:00Z',
      lastCheckedAt: '2024-01-21T15:00:00Z',
    },
  ],
]);

// ===== Mock AWS Service Settings =====
// 서비스별 AWS 연동 설정 초기 데이터
export const mockAwsServiceSettings: Map<string, LegacyAwsServiceSettings> = new Map([
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
  mockAwsInstallations.forEach((status, targetSourceId) => {
    store.awsInstallations.set(targetSourceId, status);
  });

  // 초기 AWS 서비스 설정 로드
  mockAwsServiceSettings.forEach((settings, serviceCode) => {
    store.awsServiceSettings.set(serviceCode, settings);
  });
};
