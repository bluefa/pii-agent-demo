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
  MockResource,
  TerraformState,
  CloudProvider,
} from '@/lib/types';
import { getStore } from '@/lib/mock-store';
import { createInitialProjectStatus } from '@/lib/process';
import {
  AWS_WIRE_APPROVAL_ACCOUNT_ID,
  AWS_WIRE_CONFIRMED_ACCOUNT_ID,
  awsWireApprovalResources,
  awsWireSampleResources,
} from '@/lib/bff/mock/aws-wire-sample';

/**
 * ProcessStatus에 맞는 ProjectStatus를 생성합니다.
 * Mock 데이터 초기화용 헬퍼 함수입니다.
 */
const createStatusForProcessStatus = (
  processStatus: ProcessStatus,
  options?: {
    isRejected?: boolean;
    unavailableReason?: string;
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
        approval: options?.unavailableReason
          ? { status: 'UNAVAILABLE', rejectionReason: options.unavailableReason }
          : { status: options?.isRejected ? 'REJECTED' : 'PENDING' },
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
    serviceCodePermissions: ['azure', 'aws', 'idc', 'gcp', 'SDU'],
  },
  {
    id: 'user-2',
    name: '김철수',
    email: 'kim@company.com',
    role: 'SERVICE_MANAGER',
    serviceCodePermissions: ['azure', 'aws', 'idc', 'gcp', 'SDU'],
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
  {
    code: 'SDU',
    name: 'SDU',
    description: 'SDU 계정 PII Agent 연동',
  },
  // Test Connection 큐 대상의 서비스 (mockProjects 하단 참조).
  // 이름 길이를 일부러 흩어 둔다 — 전부 "OO서비스" 로 맞추면 목록이 실제보다
  // 균질해 보여, 긴 이름이 레일에서 어떻게 접히는지 화면으로 확인할 수 없다.
  // DLV 는 계약상 상한인 30자 (줄바꿈 3줄 케이스).
  { code: 'DLV', name: '배송 물류 거점 통합 관제 및 실시간 배차 운영 플랫폼', description: '배송 도메인 PII Agent 연동' },
  { code: 'CPN', name: '쿠폰·프로모션 발급 정산', description: '쿠폰/프로모션 도메인 PII Agent 연동' },
  { code: 'RVW', name: '고객 리뷰 및 평점 운영', description: '리뷰 도메인 PII Agent 연동' },
  { code: 'IVT', name: '재고 실시간 동기화 관리', description: '재고 도메인 PII Agent 연동' },
  // 레일이 한 화면에 여러 서비스를 담았을 때를 보기 위한 카탈로그 — 연동 과제
  // (mockProjects)는 없고 서비스 목록·검색·페이지네이션에만 등장한다.
  // 코드는 실제 계약과 같이 3글자로 맞춘다.
  { code: 'PAY', name: '결제 승인 및 정산', description: '결제 도메인 PII Agent 연동' },
  { code: 'MBR', name: '회원 통합 인증', description: '회원 도메인 PII Agent 연동' },
  { code: 'SRC', name: '통합 검색 랭킹', description: '검색 도메인 PII Agent 연동' },
  { code: 'ADS', name: '광고 노출 및 정산 리포팅', description: '광고 도메인 PII Agent 연동' },
  { code: 'NTF', name: '알림 발송 허브', description: '알림 도메인 PII Agent 연동' },
  { code: 'CSC', name: '고객센터 상담 이력', description: 'CS 도메인 PII Agent 연동' },
  { code: 'SEL', name: '셀러 정산 및 입점 심사', description: '셀러 도메인 PII Agent 연동' },
  { code: 'PRD', name: '상품 마스터', description: '상품 도메인 PII Agent 연동' },
  { code: 'ORD', name: '주문 접수 및 취소·반품 처리', description: '주문 도메인 PII Agent 연동' },
  { code: 'MKT', name: '마케팅 캠페인 타겟팅', description: '마케팅 도메인 PII Agent 연동' },
  { code: 'LOG', name: '통합 로그 수집', description: '로그 도메인 PII Agent 연동' },
];

// Step 6/7 의 확정 정보 표는 CONNECTED 리소스만 노출한다. 캡처 seed 는 PENDING 이라
// 해당 단계 대상에만 연결 상태를 올려서 쓴다.
const connectedWireResources: MockResource[] = awsWireSampleResources.map((r) => ({
  ...r,
  connectionStatus: 'CONNECTED',
}));

// Step 1 의 RDS 클러스터 인스턴스 선택 데모용 합성 리소스. 실 BFF 응답 캡처
// (awsWireApprovalResources) 에는 rds_instance_candidates 가 없어서 — 캡처는 그대로 두고 —
// 이 한 건만 따로 붙인다. 인스턴스는 wire 순서를 일부러 어긋나게(Writer 먼저,
// Reader 는 -3 → -2) 두어 화면의 Reader 우선 정렬과 기본 선택(-2)이 눈에 보이게 한다.
// selected_rds_instance_resource_id 은 목이 내리지 않는다: 서버 선택값이 없을 때 클라이언트
// 기본 선택이 도는지가 이 데모의 핵심이다.
const RDS_CLUSTER_DEMO_INSTANCE_ARN_BASE =
  `arn:aws:rds:ap-northeast-2:${AWS_WIRE_APPROVAL_ACCOUNT_ID}:db:demo-aurora-mysql`;
const RDS_CLUSTER_DEMO_ARN =
  `arn:aws:rds:ap-northeast-2:${AWS_WIRE_APPROVAL_ACCOUNT_ID}:cluster:demo-aurora-mysql-cluster`;
const rdsClusterDemoResource: MockResource = {
  id: 'res-wire-cand-rds-cluster',
  type: 'AWS_DB_CLUSTER',
  awsType: 'RDS_CLUSTER',
  resourceId: RDS_CLUSTER_DEMO_ARN,
  resourceName: 'demo-aurora-mysql-cluster',
  databaseType: 'MYSQL',
  connectionStatus: 'PENDING',
  isSelected: true,
  region: 'ap-northeast-2',
  integrationCategory: 'TARGET',
  host: null,
  port: null,
  rdsInstanceCandidates: [
    {
      resource_id: `${RDS_CLUSTER_DEMO_INSTANCE_ARN_BASE}-1`,
      resource_name: 'demo-aurora-mysql-1',
      host: 'demo-aurora-mysql-1.cluster-abcdefghij.ap-northeast-2.rds.amazonaws.com',
      port: 3306,
      availability_zone: 'ap-northeast-2a',
      cluster_member_role: 'WRITER',
    },
    {
      resource_id: `${RDS_CLUSTER_DEMO_INSTANCE_ARN_BASE}-3`,
      resource_name: 'demo-aurora-mysql-3',
      host: 'demo-aurora-mysql-3.cluster-ro-abcdefghij.ap-northeast-2.rds.amazonaws.com',
      port: 3306,
      availability_zone: 'ap-northeast-2c',
      cluster_member_role: 'READER',
    },
    {
      resource_id: `${RDS_CLUSTER_DEMO_INSTANCE_ARN_BASE}-2`,
      resource_name: 'demo-aurora-mysql-2',
      host: 'demo-aurora-mysql-2.cluster-ro-abcdefghij.ap-northeast-2.rds.amazonaws.com',
      port: 3306,
      availability_zone: 'ap-northeast-2b',
      cluster_member_role: 'READER',
    },
  ],
};

// Step 3(승인 반영 중, 2001) 시드용 클러스터. 시드 타깃은 승인 요청 POST 이력이 없어
// confirm.ts 가 `r.selectedRdsInstanceResourceId` 을 그대로 되돌려주므로, 승인이 고른 접속
// 인스턴스(-2 Reader = 정렬 최상단)를 여기 명시해야 2·3단계 '선택됨' 칩이 선다.
// id 는 1006 데모 리소스와 store 에서 충돌하지 않게 분리한다.
const rdsClusterApplyingResource: MockResource = {
  ...rdsClusterDemoResource,
  id: 'res-wire-applying-rds-cluster',
  selectedRdsInstanceResourceId: `${RDS_CLUSTER_DEMO_INSTANCE_ARN_BASE}-2`,
};

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
  {
    // Step 1 carrying both GCP reason codes. The 설치 불가 guide opens only from this
    // step and every other GCP fixture is already past it, so without this project the
    // guide has no reachable case. Separate from 1002, which mock-gcp locks in as the
    // resource-less GCP project.
    id: 'gcp-proj-2',
    targetSourceId: 1017,
    projectCode: 'GCP-002',
    name: 'GCP PII Agent - 대상 선택 (설치 불가 포함)',
    description: '연동 대상 2건, 설치 불가 2건 (공인 IP / 내부 LB 서브넷)',
    serviceCode: 'gcp',
    cloudProvider: 'GCP',
    gcpProjectId: 'pii-agent-prod-12345',
    processStatus: ProcessStatus.WAITING_TARGET_CONFIRMATION,
    status: createStatusForProcessStatus(ProcessStatus.WAITING_TARGET_CONFIRMATION),
    resources: [
      {
        id: 'gcp-res-1', type: 'GCP_SQL',
        resourceId: 'projects/pii-agent-prod-12345/instances/cloudsql-prod-001',
        databaseType: 'MYSQL', connectionStatus: 'PENDING', isSelected: true,
        integrationCategory: 'TARGET',
      },
      {
        id: 'gcp-res-2', type: 'GCP_SQL',
        resourceId: 'projects/pii-agent-prod-12345/instances/cloudsql-prod-002',
        databaseType: 'POSTGRESQL', connectionStatus: 'PENDING', isSelected: false,
        integrationCategory: 'TARGET',
      },
      {
        id: 'gcp-res-3', type: 'GCP_SQL',
        resourceId: 'projects/pii-agent-prod-12345/instances/cloudsql-pubip-003',
        databaseType: 'MYSQL', connectionStatus: 'PENDING', isSelected: false,
        integrationCategory: 'INSTALL_INELIGIBLE',
        recommendFailReason: 'GCP_CLOUD_SQL_HAS_PUBLIC_IP',
      },
      {
        id: 'gcp-res-4', type: 'GCP_SQL',
        resourceId: 'projects/pii-agent-prod-12345/instances/cloudsql-ilb-004',
        databaseType: 'POSTGRESQL', connectionStatus: 'PENDING', isSelected: false,
        integrationCategory: 'INSTALL_INELIGIBLE',
        recommendFailReason: 'GCP_CLOUD_SQL_HAS_INTERNAL_HTTP_LOAD_BALANCER_SUBNET',
      },
    ],
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
    status: createStatusForProcessStatus(ProcessStatus.INSTALLING, { selectedCount: 4, excludedCount: 2 }),
    resources: [
      {
        id: 'azure-res-1',
        type: 'AZURE_MYSQL',
        resourceId: '/subscriptions/2867a4f9-1234-5678-90ab-cdef12345678/resourceGroups/rg-prod-app/providers/Microsoft.DBforMySQL/flexibleServers/mysql-prod-01',
        databaseType: 'MYSQL',
        connectionStatus: 'PENDING',
        isSelected: true,
        integrationCategory: 'TARGET',
      },
      {
        id: 'azure-res-2',
        type: 'AZURE_MYSQL',
        resourceId: '/subscriptions/2867a4f9-1234-5678-90ab-cdef12345678/resourceGroups/rg-prod-app/providers/Microsoft.DBforMySQL/flexibleServers/mysql-stg-02',
        databaseType: 'MYSQL',
        connectionStatus: 'PENDING',
        isSelected: true,
        integrationCategory: 'TARGET',
      },
      {
        id: 'azure-res-3',
        type: 'AZURE_POSTGRESQL',
        resourceId: '/subscriptions/2867a4f9-1234-5678-90ab-cdef12345678/resourceGroups/rg-prod-app/providers/Microsoft.DBforPostgreSQL/flexibleServers/pg-analytics-03',
        databaseType: 'POSTGRESQL',
        connectionStatus: 'PENDING',
        isSelected: true,
        integrationCategory: 'TARGET',
      },
      {
        id: 'azure-res-9',
        type: 'AZURE_MSSQL',
        resourceId: '/subscriptions/2867a4f9-1234-5678-90ab-cdef12345678/resourceGroups/rg-prod-app/providers/Microsoft.Sql/servers/mssql-payments-04',
        databaseType: 'MSSQL',
        connectionStatus: 'PENDING',
        isSelected: true,
        integrationCategory: 'TARGET',
      },
      // 비대상 (excluded) — v15 step2/3 show 비대상 rows with reason chips
      {
        id: 'azure-res-10',
        type: 'AZURE_POSTGRESQL',
        resourceId: '/subscriptions/2867a4f9-1234-5678-90ab-cdef12345678/resourceGroups/rg-stg/providers/Microsoft.DBforPostgreSQL/flexibleServers/pg-stg-05',
        databaseType: 'POSTGRESQL',
        connectionStatus: 'PENDING',
        isSelected: false,
        integrationCategory: 'TARGET',
        exclusion: {
          reason: 'Stg 환경 DB · PII 데이터 미보유',
          excludedAt: '2026-01-20T09:00:00Z',
          excludedBy: { id: 'admin-1', name: '관리자' },
        },
      },
      {
        id: 'azure-res-11',
        type: 'AZURE_MARIADB',
        resourceId: '/subscriptions/2867a4f9-1234-5678-90ab-cdef12345678/resourceGroups/rg-legacy/providers/Microsoft.DBforMariaDB/servers/mariadb-legacy-archive-2019',
        databaseType: 'MYSQL',
        connectionStatus: 'PENDING',
        isSelected: false,
        integrationCategory: 'TARGET',
        exclusion: {
          reason: 'Legacy archive · 2024년 EOL 예정으로 연동 제외',
          excludedAt: '2026-01-20T09:00:00Z',
          excludedBy: { id: 'admin-1', name: '관리자' },
        },
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
        recommendFailReason: 'AZURE_RESOURCE_PRIVATE_ENDPOINT_CONNECTION_FAILED',
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
        recommendFailReason: 'AZURE_RESOURCE_PRIVATE_ENDPOINT_CONNECTION_FAILED',
      },
    ],
    terraformState: {
      bdcTf: 'PENDING',
    },
    createdAt: '2026-02-05T09:00:00Z',
    updatedAt: '2026-02-09T10:00:00Z',
    isRejected: false,
  },
  // Steps 2 and 3 carrying INSTALL_INELIGIBLE resources. Every other fixture holds them at
  // step 1 only, so there was no data to see how they render once the request is submitted.
  // One project covers all four branches: target / user-excluded (with reason) / ineligible
  // (with an enum reason) / ineligible (without one, as AWS and IDC always are).
  ...([
    [1013, ProcessStatus.WAITING_APPROVAL, 'AZURE-004', 'Azure PII Agent - 승인 대기 (연동 불가 포함)'],
    [1014, ProcessStatus.APPLYING_APPROVED, 'AZURE-005', 'Azure PII Agent - 반영 중 (연동 불가 포함)'],
  ] as const).map(([targetSourceId, processStatus, projectCode, name]): Project => ({
    id: `azure-proj-${targetSourceId}`,
    targetSourceId,
    projectCode,
    name,
    description: '연동 대상 2건, 사용자 제외 1건, 연동 불가 2건',
    serviceCode: 'azure',
    cloudProvider: 'Azure',
    tenantId: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
    subscriptionId: '34567890-cdef-0123-4567-89abcdef0123',
    processStatus,
    status: createStatusForProcessStatus(processStatus, { selectedCount: 2, excludedCount: 3 }),
    resources: [
      {
        id: `azure-inel-${targetSourceId}-1`, type: 'AZURE_MYSQL', resourceId: 'mysql-prod-010',
        databaseType: 'MYSQL', connectionStatus: 'PENDING', isSelected: true,
        integrationCategory: 'TARGET',
      },
      {
        id: `azure-inel-${targetSourceId}-2`, type: 'AZURE_POSTGRESQL', resourceId: 'psql-prod-011',
        databaseType: 'POSTGRESQL', connectionStatus: 'PENDING', isSelected: true,
        integrationCategory: 'TARGET',
      },
      {
        id: `azure-inel-${targetSourceId}-3`, type: 'AZURE_MYSQL', resourceId: 'mysql-stg-012',
        databaseType: 'MYSQL', connectionStatus: 'PENDING', isSelected: false,
        integrationCategory: 'TARGET',
        exclusion: {
          reason: '스테이징 DB라 연동 대상에서 제외합니다.',
          excludedBy: { id: 'admin-1', name: '관리자' },
          excludedAt: '2026-03-01T09:00:00Z',
        },
      },
      {
        id: `azure-inel-${targetSourceId}-4`, type: 'AZURE_MYSQL', resourceId: 'mysql-vnet-013',
        databaseType: 'MYSQL', connectionStatus: 'PENDING', isSelected: false,
        integrationCategory: 'INSTALL_INELIGIBLE',
        azureNetworkingMode: 'VNET_INTEGRATION',
        recommendFailReason: 'AZURE_RESOURCE_PRIVATE_ENDPOINT_CONNECTION_FAILED',
      },
      {
        id: `azure-inel-${targetSourceId}-5`, type: 'AZURE_POSTGRESQL', resourceId: 'psql-vnet-014',
        databaseType: 'POSTGRESQL', connectionStatus: 'PENDING', isSelected: false,
        integrationCategory: 'INSTALL_INELIGIBLE',
        azureNetworkingMode: 'VNET_INTEGRATION',
      },
    ],
    terraformState: { bdcTf: 'PENDING' },
    createdAt: '2026-03-01T09:00:00Z',
    updatedAt: '2026-03-02T10:00:00Z',
    isRejected: false,
  })),
  // The same shape on GCP, where both of the CSP's `recommend_fail_reason` values appear in
  // one table. They share their first 18 characters, so the reason column's clamp renders
  // them identically — the two rows below are the case that makes that visible.
  ...([
    [1015, ProcessStatus.WAITING_APPROVAL, 'GCP-004', 'GCP PII Agent - 승인 대기 (연동 불가 포함)'],
    [1016, ProcessStatus.APPLYING_APPROVED, 'GCP-005', 'GCP PII Agent - 반영 중 (연동 불가 포함)'],
  ] as const).map(([targetSourceId, processStatus, projectCode, name]): Project => ({
    id: `gcp-proj-${targetSourceId}`,
    targetSourceId,
    projectCode,
    name,
    description: '연동 대상 2건, 사용자 제외 1건, 연동 불가 2건 (공인 IP / 내부 LB 서브넷)',
    serviceCode: 'gcp',
    cloudProvider: 'GCP',
    gcpProjectId: 'pii-agent-prod-12345',
    processStatus,
    status: createStatusForProcessStatus(processStatus, { selectedCount: 2, excludedCount: 3 }),
    resources: [
      {
        id: `gcp-inel-${targetSourceId}-1`, type: 'GCP_SQL',
        resourceId: 'projects/pii-agent-prod-12345/instances/cloudsql-prod-020',
        databaseType: 'MYSQL', connectionStatus: 'PENDING', isSelected: true,
        integrationCategory: 'TARGET',
      },
      {
        id: `gcp-inel-${targetSourceId}-2`, type: 'GCP_SQL',
        resourceId: 'projects/pii-agent-prod-12345/instances/cloudsql-prod-021',
        databaseType: 'POSTGRESQL', connectionStatus: 'PENDING', isSelected: true,
        integrationCategory: 'TARGET',
      },
      {
        id: `gcp-inel-${targetSourceId}-3`, type: 'GCP_SQL',
        resourceId: 'projects/pii-agent-prod-12345/instances/cloudsql-stg-022',
        databaseType: 'MYSQL', connectionStatus: 'PENDING', isSelected: false,
        integrationCategory: 'TARGET',
        exclusion: {
          reason: '스테이징 DB라 연동 대상에서 제외합니다.',
          excludedBy: { id: 'admin-1', name: '관리자' },
          excludedAt: '2026-03-01T09:00:00Z',
        },
      },
      {
        id: `gcp-inel-${targetSourceId}-4`, type: 'GCP_SQL',
        resourceId: 'projects/pii-agent-prod-12345/instances/cloudsql-pubip-023',
        databaseType: 'MYSQL', connectionStatus: 'PENDING', isSelected: false,
        integrationCategory: 'INSTALL_INELIGIBLE',
        recommendFailReason: 'GCP_CLOUD_SQL_HAS_PUBLIC_IP',
      },
      {
        id: `gcp-inel-${targetSourceId}-5`, type: 'GCP_SQL',
        resourceId: 'projects/pii-agent-prod-12345/instances/cloudsql-ilb-024',
        databaseType: 'POSTGRESQL', connectionStatus: 'PENDING', isSelected: false,
        integrationCategory: 'INSTALL_INELIGIBLE',
        recommendFailReason: 'GCP_CLOUD_SQL_HAS_INTERNAL_HTTP_LOAD_BALANCER_SUBNET',
      },
    ],
    terraformState: { bdcTf: 'PENDING' },
    createdAt: '2026-03-01T09:00:00Z',
    updatedAt: '2026-03-02T10:00:00Z',
    isRejected: false,
  })),
  // ===== AWS 프로젝트 =====
  {
    id: 'proj-1',
    targetSourceId: 1006,
    projectCode: 'N-IRP-001',
    name: 'PII Agent 설치 - 고객 DB',
    description: 'Step 1. 연동 대상 확정 — 실 BFF 응답 캡처의 스캔 후보 9건(엔진 6종)에서 1건만 선택된 상태입니다. TF 실행 권한 미허용이라 이후 설치는 직접 적용 모드로 이어집니다.',
    serviceCode: 'aws',
    cloudProvider: 'AWS',
    awsAccountId: AWS_WIRE_APPROVAL_ACCOUNT_ID,
    awsRegionType: 'global',
    // 데모: TF 실행 권한 미허용 → 수동 설치 모드
    isTerraformExecutionGranted: false,
    processStatus: ProcessStatus.WAITING_TARGET_CONFIRMATION,
    status: createStatusForProcessStatus(ProcessStatus.WAITING_TARGET_CONFIRMATION),
    resources: [...awsWireApprovalResources, rdsClusterDemoResource],
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
    description: 'Step 2. 관리자 승인 반려 — RDS_CLUSTER 미지원 사유로 반려된 상태입니다. 반려 사유 노출과 재신청 흐름을 검증합니다. 리소스는 실 BFF 응답 캡처의 스캔 후보 9건입니다.',
    serviceCode: 'aws',
    cloudProvider: 'AWS',
    awsAccountId: AWS_WIRE_APPROVAL_ACCOUNT_ID,
    awsRegionType: 'global',
    processStatus: ProcessStatus.WAITING_APPROVAL,
    status: createStatusForProcessStatus(ProcessStatus.WAITING_APPROVAL, { isRejected: true, selectedCount: 2, excludedCount: 1 }),
    resources: awsWireApprovalResources,
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
    description: 'Step 4. 자동 설치 진행 중 — 단계별 설치 현황(서비스측/BDC측)을 검증합니다. installation-status 를 실 BFF 응답 캡처 원문으로 서빙하므로 상태는 전부 진행중이고, 빈 Role ARN·Athena 리전 단위 리소스 id 가 그대로 노출됩니다.',
    serviceCode: 'aws',
    cloudProvider: 'AWS',
    awsAccountId: AWS_WIRE_CONFIRMED_ACCOUNT_ID,
    awsRegionType: 'global',
    // 데모: TF 실행 권한 허용 → 자동 설치 모드 (설치중 화면)
    isTerraformExecutionGranted: true,
    processStatus: ProcessStatus.INSTALLING,
    status: createStatusForProcessStatus(ProcessStatus.INSTALLING, { selectedCount: 4, excludedCount: 1 }),
    resources: awsWireSampleResources,
    terraformState: {
      serviceTf: 'PENDING',
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
    description: 'Step 5. 연결 테스트 — 설치 완료 후 연결 테스트 수행을 검증합니다. 확정 정보가 실 BFF 응답 캡처라 Credential 불필요 엔진(Athena)과 필요 엔진(MySQL)이 섞여 있습니다.',
    serviceCode: 'aws',
    cloudProvider: 'AWS',
    awsAccountId: AWS_WIRE_CONFIRMED_ACCOUNT_ID,
    awsRegionType: 'global',
    // SDU 아님 — 이 행은 Step 5 연결 테스트를 보기 위한 것이고, SDU 로 두면 상세가
    // 미지원 안내로 대체돼 그 단계를 아예 볼 수 없다. SDU 표기·미지원 안내는 1099/1100.
    processStatus: ProcessStatus.WAITING_CONNECTION_TEST,
    status: createStatusForProcessStatus(ProcessStatus.WAITING_CONNECTION_TEST, { selectedCount: 2, excludedCount: 1 }),
    resources: awsWireSampleResources,
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
    description: 'Step 6. 최종 관리자 승인 대기 — 연결 테스트 검증까지 끝난 뒤 완료 승인을 기다리는 화면을 검증합니다.',
    serviceCode: 'aws',
    cloudProvider: 'AWS',
    awsAccountId: AWS_WIRE_CONFIRMED_ACCOUNT_ID,
    awsRegionType: 'global',
    processStatus: ProcessStatus.CONNECTION_VERIFIED,
    status: createStatusForProcessStatus(ProcessStatus.CONNECTION_VERIFIED, { selectedCount: 2, excludedCount: 0 }),
    resources: connectedWireResources,
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
    description: 'Step 7. 설치 완료 — 연동이 끝나 PII 모니터링이 실행 중인 최종 화면을 검증합니다.',
    serviceCode: 'aws',
    cloudProvider: 'AWS',
    awsAccountId: AWS_WIRE_CONFIRMED_ACCOUNT_ID,
    awsRegionType: 'global',
    processStatus: ProcessStatus.INSTALLATION_COMPLETE,
    status: createStatusForProcessStatus(ProcessStatus.INSTALLATION_COMPLETE, { selectedCount: 3, excludedCount: 0 }),
    resources: connectedWireResources,
    terraformState: {
      serviceTf: 'COMPLETED',
      bdcTf: 'COMPLETED',
    },
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-25T14:30:00Z',
    isRejected: false,
  },
  {
    /**
     * 중국 리전 AWS 대상 — 중국 표기를 AWS 쪽에서도 화면으로 볼 수 있게 하는 것이
     * 유일한 목적이다. 기존 aws 대상 7건은 전부 실 BFF 응답 캡처 계정
     * (AWS_WIRE_*)에 묶여 있어, 그중 하나를 중국으로 돌리면 IAM ARN partition 이
     * aws-cn 으로 바뀌어 role 등록 화면까지 함께 흔들린다. 그래서 뒤집지 않고 더한다.
     *
     * 계정 id 도 캡처 상수를 쓰지 않는다 — 같은 계정이 global 과 china 로 동시에
     * 존재하는 모양이 되어, 캡처를 읽는 화면들이 서로 다른 partition 을 말하게 된다.
     */
    id: 'proj-8',
    targetSourceId: 1018,
    projectCode: 'DATA-008',
    name: 'PII Agent 설치 - 중국 리전 계정',
    description: '중국 리전 AWS 대상. 리전 표기와 aws-cn partition 처리를 검증합니다.',
    serviceCode: 'aws',
    cloudProvider: 'AWS',
    awsAccountId: '918273645500',
    awsRegionType: 'china',
    isChinaRegion: true,
    processStatus: ProcessStatus.INSTALLATION_COMPLETE,
    status: createStatusForProcessStatus(ProcessStatus.INSTALLATION_COMPLETE, { selectedCount: 1 }),
    resources: [],
    terraformState: {
      serviceTf: 'COMPLETED',
      bdcTf: 'COMPLETED',
    },
    createdAt: '2024-02-02T09:00:00Z',
    updatedAt: '2024-02-02T15:00:00Z',
    isRejected: false,
  },
];

// ===== IDC 데모 프로젝트 (Step 1~7) =====
// Step 2~7 read the STANDARD integration endpoints (approval-requests/latest,
// approved-integration, confirmed-integration), whose mocks derive rows from
// `project.resources` (filter isSelected). So IDC projects carry a seeded
// resource set — 5 integration targets (idcConfig.sourceIps = the PII-Agent
// server IPs surfaced in the Source IP column) + 2 excluded — exactly like the
// cloud demo projects. Step 1 (1020) stays empty (manual input). Installation
// status still comes from idc installation-status (lib/mock-idc.ts).
const IDC_DEMO_RESOURCES: MockResource[] = [
  {
    id: 'idc-res-001', type: 'IDC_RESOURCE', resourceId: 'idc-res-001',
    connectionStatus: 'PENDING', isSelected: true, databaseType: 'MYSQL', integrationCategory: 'TARGET',
    idcConfig: { inputFormat: 'IP', ips: ['10.20.30.40'], domain: '', sourceIps: ['10.10.0.21'], firewallOpen: true },
  },
  {
    id: 'idc-res-002', type: 'IDC_RESOURCE', resourceId: 'idc-res-002',
    connectionStatus: 'PENDING', isSelected: true, databaseType: 'ORACLE', integrationCategory: 'TARGET',
    idcConfig: { inputFormat: 'IP', ips: ['10.20.31.10', '10.20.31.11'], domain: '', oracleSid: 'ORCL', sourceIps: ['10.10.0.21', '10.10.0.22'], firewallOpen: true },
  },
  {
    id: 'idc-res-003', type: 'IDC_RESOURCE', resourceId: 'idc-res-003',
    connectionStatus: 'PENDING', isSelected: true, databaseType: 'MYSQL', integrationCategory: 'TARGET',
    idcConfig: { inputFormat: 'IP', ips: ['10.20.32.7'], domain: '', sourceIps: ['10.10.0.21'], firewallOpen: false },
  },
  {
    id: 'idc-res-004', type: 'IDC_RESOURCE', resourceId: 'idc-res-004',
    connectionStatus: 'PENDING', isSelected: true, databaseType: 'MONGODB', integrationCategory: 'TARGET',
    idcConfig: { inputFormat: 'IP', ips: ['10.20.32.8'], domain: '', sourceIps: ['10.10.0.22'], firewallOpen: true },
  },
  {
    id: 'idc-res-005', type: 'IDC_RESOURCE', resourceId: 'idc-res-005',
    connectionStatus: 'PENDING', isSelected: true, databaseType: 'MSSQL', integrationCategory: 'TARGET',
    idcConfig: { inputFormat: 'IP', ips: ['10.20.33.2'], domain: '', sourceIps: ['10.10.0.22'], firewallOpen: true },
  },
  // Excluded (비대상) — surfaced in Step 2/3 with their reason chips.
  {
    id: 'idc-res-006', type: 'IDC_RESOURCE', resourceId: 'idc-res-006',
    connectionStatus: 'PENDING', isSelected: false, databaseType: 'POSTGRESQL', integrationCategory: 'TARGET',
    idcConfig: { inputFormat: 'HOST', ips: [], domain: 'db.svc-a.io', sourceIps: [], firewallOpen: false },
    exclusion: { reason: 'StageDB', excludedBy: { id: 'admin-1', name: '관리자' }, excludedAt: '2026-03-01T09:00:00Z' },
  },
  {
    id: 'idc-res-007', type: 'IDC_RESOURCE', resourceId: 'idc-res-007',
    connectionStatus: 'PENDING', isSelected: false, databaseType: 'REDIS', integrationCategory: 'TARGET',
    idcConfig: { inputFormat: 'HOST', ips: [], domain: 'cache.svc-a.io', sourceIps: [], firewallOpen: false },
    exclusion: { reason: '캐시 전용 DB로 PII 데이터를 보관하지 않아 제외합니다.', excludedBy: { id: 'admin-1', name: '관리자' }, excludedAt: '2026-03-01T09:00:00Z' },
  },
];

/**
 * Step 별 설명 — 라벨은 상단 스텝퍼의 것을 그대로 쓴다.
 *
 * 여덟 개의 IDC 목 대상이 같은 한 문장을 설명으로 갖고 있어, 목록에서도 상세에서도
 * 어느 단계를 보고 있는지 구분되지 않았다. 이름은 이미 다르므로 설명은 단계를 말한다.
 */
const IDC_STEP_DESCRIPTION: Record<ProcessStatus, string> = {
  [ProcessStatus.WAITING_TARGET_CONFIRMATION]:
    'Step 1 · 연동 대상 DB 선택 — 온프레미스 DB를 직접 입력해 연동을 요청하는 단계',
  [ProcessStatus.WAITING_APPROVAL]:
    'Step 2 · 연동 대상 승인 대기 — 요청한 대상을 관리자가 검토하는 단계',
  [ProcessStatus.APPLYING_APPROVED]:
    'Step 3 · 연동 대상 반영중 — 승인된 대상을 설치 준비에 반영하는 단계',
  [ProcessStatus.INSTALLING]:
    'Step 4 · Agent 설치 — BDC 리소스 생성과 서비스측 방화벽 확인이 함께 진행되는 단계',
  [ProcessStatus.WAITING_CONNECTION_TEST]:
    'Step 5 · 연결 테스트 — 자격 증명으로 실제 접속과 논리 DB를 확인하는 단계',
  [ProcessStatus.CONNECTION_VERIFIED]:
    'Step 6 · 관리자 승인 대기 — 연결 확인 결과를 관리자가 최종 승인하는 단계',
  [ProcessStatus.INSTALLATION_COMPLETE]:
    'Step 7 · 완료 — 연동이 끝나 수집이 시작된 상태',
};

const makeIdcProject = (
  targetSourceId: number,
  step: ProcessStatus,
  name: string,
  resources: MockResource[],
  unavailableReason?: string,
): Project => ({
  id: `idc-proj-${targetSourceId}`,
  targetSourceId,
  projectCode: `IDC-${String(targetSourceId).slice(-3)}`,
  name,
  // 연동 불가 대상도 Step 2 라 설명이 겹친다 — 하위 상태를 덧붙여 갈라 준다.
  description: unavailableReason
    ? 'Step 2 · 연동 불가 — 관리자가 연동할 수 없다고 판정한 하위 상태'
    : IDC_STEP_DESCRIPTION[step],
  serviceCode: 'idc',
  cloudProvider: 'IDC',
  processStatus: step,
  status: createStatusForProcessStatus(step, { selectedCount: 5, excludedCount: 2, unavailableReason }),
  resources,
  terraformState: { bdcTf: step >= ProcessStatus.INSTALLING ? 'COMPLETED' : 'PENDING' },
  createdAt: '2026-03-01T09:00:00Z',
  updatedAt: '2026-03-01T09:00:00Z',
  isRejected: false,
});

// Steps 6/7 render the confirmed table, which only surfaces CONNECTED targets
// (getConfirmedIntegration path-4 requires connection at CONNECTION_VERIFIED /
// INSTALLATION_COMPLETE). Mark selected targets CONNECTED for those steps.
const idcResourcesForStep = (step: ProcessStatus): MockResource[] => {
  const connected =
    step === ProcessStatus.CONNECTION_VERIFIED || step === ProcessStatus.INSTALLATION_COMPLETE;
  return connected
    ? IDC_DEMO_RESOURCES.map((r) =>
        r.isSelected ? { ...r, connectionStatus: 'CONNECTED' as const } : r,
      )
    : IDC_DEMO_RESOURCES;
};

mockProjects.push(
  // Step 1 stays empty (manual input — no seeded targets).
  makeIdcProject(1020, ProcessStatus.WAITING_TARGET_CONFIRMATION, 'IDC PII Agent - 연동 대상 입력', []),
  makeIdcProject(1021, ProcessStatus.WAITING_APPROVAL, 'IDC PII Agent - 승인 대기', idcResourcesForStep(ProcessStatus.WAITING_APPROVAL)),
  makeIdcProject(1022, ProcessStatus.APPLYING_APPROVED, 'IDC PII Agent - 반영 중', idcResourcesForStep(ProcessStatus.APPLYING_APPROVED)),
  makeIdcProject(1023, ProcessStatus.INSTALLING, 'IDC PII Agent - 설치 진행', idcResourcesForStep(ProcessStatus.INSTALLING)),
  makeIdcProject(1024, ProcessStatus.WAITING_CONNECTION_TEST, 'IDC PII Agent - 연결 테스트', idcResourcesForStep(ProcessStatus.WAITING_CONNECTION_TEST)),
  makeIdcProject(1025, ProcessStatus.CONNECTION_VERIFIED, 'IDC PII Agent - 연결 확인', idcResourcesForStep(ProcessStatus.CONNECTION_VERIFIED)),
  makeIdcProject(1026, ProcessStatus.INSTALLATION_COMPLETE, 'IDC PII Agent - 설치 완료', idcResourcesForStep(ProcessStatus.INSTALLATION_COMPLETE)),
  // Step 2, integration-unavailable sub-state — targets judged un-integratable by admin.
  makeIdcProject(
    1027,
    ProcessStatus.WAITING_APPROVAL,
    'IDC PII Agent - 연동 불가',
    idcResourcesForStep(ProcessStatus.WAITING_APPROVAL),
    '요청하신 온프레미스 DB는 현재 연동 대상 네트워크 대역 밖에 있어 연동할 수 없습니다.',
  ),
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
    resourceId: 'projects/sea-bdp-prd/locations/asia-northeast3/services/bigquery/datasets/sea_bdp_prd',
    databaseType: 'MYSQL',
    connectionStatus: 'PENDING',
    isSelected: true,
    integrationCategory: 'TARGET',
  },
  {
    id: 'gcp-res-2',
    type: 'GCP_SQL',
    resourceId: 'projects/sea-bdp-prd/locations/asia-northeast3/instances/sql-analytics-01',
    databaseType: 'MYSQL',
    connectionStatus: 'PENDING',
    isSelected: true,
    integrationCategory: 'TARGET',
  },
  {
    id: 'gcp-res-3',
    type: 'GCP_SQL',
    resourceId: 'projects/sea-bdp-prd/locations/asia-northeast3/instances/cloudsql-main',
    databaseType: 'POSTGRESQL',
    connectionStatus: 'PENDING',
    isSelected: true,
    integrationCategory: 'TARGET',
  },
  // 비대상 (excluded) — v15 step2/3 show 비대상 rows with reason chips
  {
    id: 'gcp-res-4',
    type: 'GCP_SQL',
    resourceId: 'projects/sea-bdp-prd/locations/asia-northeast3/instances/cloudsql-stg-02',
    databaseType: 'POSTGRESQL',
    connectionStatus: 'PENDING',
    isSelected: false,
    integrationCategory: 'TARGET',
    exclusion: {
      reason: 'Stg 환경 DB · PII 데이터 미보유',
      excludedAt: '2026-02-01T09:00:00Z',
      excludedBy: { id: 'admin-1', name: '관리자' },
    },
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
    /** 미지정 시 base 설명을 그대로 상속한다. */
    description?: string;
    resources?: Project['resources'];
    unavailableReason?: string;
  },
): Project => {
  const base = mockProjects.find((p) => p.id === baseId);
  if (!base) throw new Error(`step-coverage base not found: ${baseId}`);
  const sourceResources = over.resources ?? base.resources;
  // Steps 6/7 (CONNECTION_VERIFIED, INSTALLATION_COMPLETE) render the confirmed
  // table, which only surfaces CONNECTED resources. The azure/gcp demo seeds carry
  // PENDING connections, so mark selected targets CONNECTED for those clones to
  // keep the confirmed-integration table populated (matches v15).
  const requiresConnection =
    over.status === ProcessStatus.CONNECTION_VERIFIED ||
    over.status === ProcessStatus.INSTALLATION_COMPLETE;
  const resources = requiresConnection
    ? sourceResources.map((r) =>
        r.isSelected && r.integrationCategory === 'TARGET'
          ? { ...r, connectionStatus: 'CONNECTED' as const }
          : r,
      )
    : sourceResources;
  return {
    ...base,
    id: over.id,
    targetSourceId: over.targetSourceId,
    projectCode: over.projectCode,
    name: over.name,
    description: over.description ?? base.description,
    processStatus: over.status,
    status: createStatusForProcessStatus(over.status, {
      selectedCount: 2,
      unavailableReason: over.unavailableReason,
    }),
    resources,
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
    description: 'Step 3. 승인 반영 중 — 승인 직후 확정 처리(APPLYING_APPROVED)를 기다리는 화면을 검증합니다. 폴링 중 안내 문구와 설치 진입 직전 상태를 확인할 수 있습니다.',
    // RDS 클러스터 인스턴스 목록(선택됨 칩 포함)이 3단계 승인 정보에 그대로 보이는지 검증.
    resources: [...awsWireSampleResources, rdsClusterApplyingResource],
  }),
  // Azure — fills steps 2/3/5/6/7 (base azure-proj-1 carries full resources)
  cloneForStep('azure-proj-1', { id: 'azure-proj-approval', targetSourceId: 2002, projectCode: 'AZURE-APPROVAL', name: 'Azure PII Agent - 승인 대기', status: ProcessStatus.WAITING_APPROVAL }),
  cloneForStep('azure-proj-1', { id: 'azure-proj-applying', targetSourceId: 2003, projectCode: 'AZURE-APPLYING', name: 'Azure PII Agent - 반영 중', status: ProcessStatus.APPLYING_APPROVED }),
  cloneForStep('azure-proj-1', { id: 'azure-proj-test', targetSourceId: 2004, projectCode: 'AZURE-TEST', name: 'Azure PII Agent - 연결 테스트', status: ProcessStatus.WAITING_CONNECTION_TEST }),
  cloneForStep('azure-proj-1', { id: 'azure-proj-verified', targetSourceId: 2005, projectCode: 'AZURE-VERIFIED', name: 'Azure PII Agent - 완료 승인 대기', status: ProcessStatus.CONNECTION_VERIFIED }),
  cloneForStep('azure-proj-1', { id: 'azure-proj-complete', targetSourceId: 2006, projectCode: 'AZURE-COMPLETE', name: 'Azure PII Agent - 연동 완료', status: ProcessStatus.INSTALLATION_COMPLETE }),
  // Step 2, integration-unavailable sub-state — verdict + reason on the cloud approval card.
  cloneForStep('azure-proj-1', { id: 'azure-proj-unavailable', targetSourceId: 2013, projectCode: 'AZURE-UNAVAIL', name: 'Azure PII Agent - 연동 불가', status: ProcessStatus.WAITING_APPROVAL, unavailableReason: '선택하신 리소스는 현재 지원되지 않는 유형이라 연동할 수 없습니다. 지원 대상 DB만 다시 선택해주세요.' }),
  // GCP — fills steps 2/3/4/5/6/7 (gcp-proj-1 has no resources, so inject a demo set)
  cloneForStep('gcp-proj-1', { id: 'gcp-proj-approval', targetSourceId: 2007, projectCode: 'GCP-APPROVAL', name: 'GCP PII Agent - 승인 대기', status: ProcessStatus.WAITING_APPROVAL, resources: gcpDemoResources }),
  cloneForStep('gcp-proj-1', { id: 'gcp-proj-applying', targetSourceId: 2008, projectCode: 'GCP-APPLYING', name: 'GCP PII Agent - 반영 중', status: ProcessStatus.APPLYING_APPROVED, resources: gcpDemoResources }),
  cloneForStep('gcp-proj-1', { id: 'gcp-proj-installing', targetSourceId: 2009, projectCode: 'GCP-INSTALLING', name: 'GCP PII Agent - 설치 진행', status: ProcessStatus.INSTALLING, resources: gcpDemoResources }),
  cloneForStep('gcp-proj-1', { id: 'gcp-proj-test', targetSourceId: 2010, projectCode: 'GCP-TEST', name: 'GCP PII Agent - 연결 테스트', status: ProcessStatus.WAITING_CONNECTION_TEST, resources: gcpDemoResources }),
  cloneForStep('gcp-proj-1', { id: 'gcp-proj-verified', targetSourceId: 2011, projectCode: 'GCP-VERIFIED', name: 'GCP PII Agent - 완료 승인 대기', status: ProcessStatus.CONNECTION_VERIFIED, resources: gcpDemoResources }),
  cloneForStep('gcp-proj-1', { id: 'gcp-proj-complete', targetSourceId: 2012, projectCode: 'GCP-COMPLETE', name: 'GCP PII Agent - 연동 완료', status: ProcessStatus.INSTALLATION_COMPLETE, resources: gcpDemoResources }),
);

// 데모: SDU 계정 대상 — cloud_provider 는 AWS 지만 metadata.is_sdu_type=true 라
// 파이프라인 목록·상세·대상 상세 어디서든 하위 CSP 대신 "SDU"로 노출된다.
mockProjects.push({
  id: 'aws-proj-sdu',
  targetSourceId: 1099,
  projectCode: 'SDU-001',
  name: 'SDU PII Agent - 데모 대상',
  description: 'SDU 계정 대상(중국 리전). 하위 CSP(AWS)와 무관하게 SDU 로 표기됩니다.',
  serviceCode: 'SDU',
  cloudProvider: 'AWS',
  awsAccountId: '210987654321',
  // 중국 리전 SDU — 두 표기가 겹치는 경우가 목에 하나도 없어, 중국 칩이 SDU 행에서
  // 도는지 화면으로 볼 수가 없었다. 나머지 SDU 대상(1100)은 global 로 남긴다.
  awsRegionType: 'china',
  isChinaRegion: true,
  isSduType: true,
  processStatus: ProcessStatus.INSTALLATION_COMPLETE,
  status: createStatusForProcessStatus(ProcessStatus.INSTALLATION_COMPLETE, { selectedCount: 1 }),
  resources: [
    {
      id: 'res-sdu-1',
      type: 'RDS',
      resourceId: 'rds-sdu-01',
      databaseType: 'POSTGRESQL',
      connectionStatus: 'CONNECTED',
      isSelected: true,
      awsType: 'RDS',
      region: 'ap-northeast-2',
      vpcId: 'vpc-sdu-001',
      integrationCategory: 'TARGET',
      note: '',
    },
  ],
  terraformState: { serviceTf: 'COMPLETED', bdcTf: 'COMPLETED' },
  createdAt: '2024-02-01T09:00:00Z',
  updatedAt: '2024-02-01T12:00:00Z',
  isRejected: false,
});

// 데모: 두 번째 SDU 대상 — 승인 대기 단계(설치 전)로, SDU 서비스에 대상이
// 하나가 아님을 보이고 파이프라인 시작 흐름을 시연할 수 있게 한다.
mockProjects.push({
  id: 'aws-proj-sdu-2',
  targetSourceId: 1100,
  projectCode: 'SDU-002',
  name: 'SDU PII Agent - 데이터 레이크',
  description: 'SDU 계정 대상(승인 대기). 하위 CSP(AWS)와 무관하게 SDU 로 표기됩니다.',
  serviceCode: 'SDU',
  cloudProvider: 'AWS',
  awsAccountId: '345678901234',
  awsRegionType: 'global',
  isSduType: true,
  processStatus: ProcessStatus.WAITING_APPROVAL,
  status: createStatusForProcessStatus(ProcessStatus.WAITING_APPROVAL, { selectedCount: 2, excludedCount: 1 }),
  resources: [
    {
      id: 'res-sdu-2',
      type: 'RDS',
      resourceId: 'rds-sdu-02',
      databaseType: 'MYSQL',
      connectionStatus: 'PENDING',
      isSelected: true,
      awsType: 'RDS',
      region: 'ap-northeast-2',
      vpcId: 'vpc-sdu-002',
      integrationCategory: 'TARGET',
      note: 'NEW',
    },
    {
      id: 'res-sdu-3',
      type: 'DYNAMODB',
      resourceId: 'ddb-sdu-01',
      databaseType: 'DYNAMODB',
      connectionStatus: 'PENDING',
      isSelected: true,
      awsType: 'DYNAMODB',
      region: 'ap-northeast-2',
      integrationCategory: 'TARGET',
      note: 'NEW',
    },
  ],
  terraformState: { serviceTf: 'PENDING', bdcTf: 'PENDING' },
  createdAt: '2024-02-02T09:00:00Z',
  updatedAt: '2024-02-02T10:00:00Z',
  isRejected: false,
});

// ===== Test Connection 큐 대상 =====
// INVARIANT (docs/api/ops-assumed-contracts.md §7): every row of the Test
// Connection queue is a real target source. 운영 알림 links those rows to the
// target's 운영 화면 (?tab=tc) — the only place the Test Connection detail lives
// — so a queue row without a project here would be a dangling link.
//
// These four used to live only in the task-queue fixture (`SEED_TC`), which made
// that violation representable. They are projects now; the queue reads status
// from its own store and the per-resource 결과/논리 DB fixtures still enrich the
// drill-downs, but identity, service and step come from here.
const makeTcQueueProject = (args: {
  targetSourceId: number;
  serviceCode: string;
  name: string;
  cloudProvider: CloudProvider;
  /** CONNECTION_VERIFIED = 완료(승인 대기), WAITING_CONNECTION_TEST = 재실행 요청 후 되돌아간 단계. */
  processStatus: ProcessStatus;
  updatedAt: string;
  resources: MockResource[];
  extra?: Partial<Project>;
}): Project => ({
  id: `tcq-proj-${args.targetSourceId}`,
  targetSourceId: args.targetSourceId,
  projectCode: `${args.serviceCode}-${String(args.targetSourceId).slice(-3)}`,
  name: args.name,
  description: 'Test Connection 큐 대상 — 연결 테스트 완료/재실행 요청 흐름 시연',
  serviceCode: args.serviceCode,
  cloudProvider: args.cloudProvider,
  processStatus: args.processStatus,
  status: createStatusForProcessStatus(args.processStatus, {
    selectedCount: args.resources.filter((r) => r.isSelected).length,
    excludedCount: args.resources.filter((r) => !r.isSelected).length,
  }),
  resources: args.resources,
  terraformState: { serviceTf: 'COMPLETED', bdcTf: 'COMPLETED' },
  createdAt: '2026-06-28T09:00:00Z',
  updatedAt: args.updatedAt,
  isRejected: false,
  ...args.extra,
});

/**
 * 대규모 대상(1801)의 리소스 30개. 리소스 그룹 4개에 나눠 담아 이름이 한 덩어리로
 * 보이지 않게 한다 — 30줄이 같은 접두사로 시작하면 목록이 한 줄도 구분되지 않는다.
 */
const LGS_SUBSCRIPTION = 'b1d4e77c-90a2-4f38-8c15-6e2f0a9b3d41';

const lgsResources: MockResource[] = (
  [
    ['order', 'MYSQL', 8],
    ['wms', 'MYSQL', 6],
    ['track', 'POSTGRESQL', 9],
    ['analytics', 'POSTGRESQL', 7],
  ] as const
).flatMap(([group, databaseType, count]) =>
  Array.from({ length: count }, (_, index): MockResource => {
    const mysql = databaseType === 'MYSQL';
    const name = `${mysql ? 'mysql' : 'pg'}-lgs-${group}-${String(index + 1).padStart(2, '0')}`;
    return {
      id: `lgs-res-${group}-${index + 1}`,
      type: mysql ? 'AZURE_MYSQL' : 'AZURE_POSTGRESQL',
      resourceId: `/subscriptions/${LGS_SUBSCRIPTION}/resourceGroups/rg-lgs-${group}/providers/Microsoft.DBfor${mysql ? 'MySQL' : 'PostgreSQL'}/servers/${name}`,
      databaseType,
      selectedCredentialId: mysql ? 'hgildong-mysql-prod' : 'kimcs-postgres-analytics',
      connectionStatus: 'CONNECTED',
      isSelected: true,
      integrationCategory: 'TARGET',
      azureNetworkingMode: 'VNET_INTEGRATION',
    };
  }),
);

mockProjects.push(
  makeTcQueueProject({
    targetSourceId: 1799,
    serviceCode: 'DLV',
    name: '배송서비스 PII Agent - 연결 테스트 완료',
    cloudProvider: 'Azure',
    processStatus: ProcessStatus.CONNECTION_VERIFIED,
    updatedAt: '2026-07-20T17:19:00Z',
    extra: {
      subscriptionId: '2867a4f9-1e3a-4c8f-bf0a-91c5dd7e2188',
      tenantId: '7f9c1b30-52d4-4a11-9d63-0c1e5a8b7742',
    },
    resources: [
      { id: 'dlv-res-1', type: 'AZURE_MYSQL', resourceId: '/subscriptions/2867a4f9-1e3a-4c8f-bf0a-91c5dd7e2188/resourceGroups/rg-dlv-prod/providers/Microsoft.DBforMySQL/servers/mysql-dlv-01', databaseType: 'MYSQL', selectedCredentialId: 'hgildong-mysql-prod', connectionStatus: 'CONNECTED', isSelected: true, integrationCategory: 'TARGET', azureNetworkingMode: 'VNET_INTEGRATION' },
      { id: 'dlv-res-2', type: 'AZURE_MYSQL', resourceId: '/subscriptions/2867a4f9-1e3a-4c8f-bf0a-91c5dd7e2188/resourceGroups/rg-dlv-prod/providers/Microsoft.DBforMySQL/servers/mysql-dlv-02', databaseType: 'MYSQL', selectedCredentialId: 'hgildong-mysql-prod', connectionStatus: 'CONNECTED', isSelected: true, integrationCategory: 'TARGET', azureNetworkingMode: 'VNET_INTEGRATION' },
      { id: 'dlv-res-3', type: 'AZURE_POSTGRESQL', resourceId: '/subscriptions/2867a4f9-1e3a-4c8f-bf0a-91c5dd7e2188/resourceGroups/rg-dlv-prod/providers/Microsoft.DBforPostgreSQL/servers/pg-dlv-main', databaseType: 'POSTGRESQL', selectedCredentialId: 'kimcs-postgres-analytics', connectionStatus: 'CONNECTED', isSelected: true, integrationCategory: 'TARGET', azureNetworkingMode: 'VNET_INTEGRATION' },
    ],
  }),
  makeTcQueueProject({
    targetSourceId: 1642,
    serviceCode: 'CPN',
    name: '쿠폰서비스 PII Agent - 연결 테스트 완료',
    cloudProvider: 'AWS',
    processStatus: ProcessStatus.CONNECTION_VERIFIED,
    updatedAt: '2026-07-20T06:23:00Z',
    extra: { awsAccountId: '481920374655', awsRegionType: 'global' },
    resources: [
      { id: 'cpn-res-1', type: 'RDS', resourceId: 'rds-cpn-main', databaseType: 'MYSQL', selectedCredentialId: 'hgildong-mysql-prod', connectionStatus: 'CONNECTED', isSelected: true, awsType: 'RDS', region: 'ap-northeast-2', vpcId: 'vpc-cpn-001', integrationCategory: 'TARGET' },
      { id: 'cpn-res-2', type: 'DYNAMODB', resourceId: 'ddb-cpn-issue', databaseType: 'DYNAMODB', selectedCredentialId: 'kimcs-redshift-dw', connectionStatus: 'CONNECTED', isSelected: true, awsType: 'DYNAMODB', region: 'ap-northeast-2', integrationCategory: 'TARGET' },
    ],
  }),
  makeTcQueueProject({
    targetSourceId: 1511,
    serviceCode: 'RVW',
    name: '리뷰서비스 PII Agent - 연결 테스트 완료',
    cloudProvider: 'GCP',
    processStatus: ProcessStatus.CONNECTION_VERIFIED,
    updatedAt: '2026-07-13T19:40:00Z',
    extra: { gcpProjectId: 'sea-rvw-prd' },
    resources: [
      { id: 'rvw-res-1', type: 'GCP_SQL', resourceId: 'projects/sea-rvw-prd/instances/cloudsql-rvw-main', databaseType: 'POSTGRESQL', selectedCredentialId: 'kimcs-postgres-analytics', connectionStatus: 'CONNECTED', isSelected: true, integrationCategory: 'TARGET' },
      { id: 'rvw-res-2', type: 'GCP_SQL', resourceId: 'projects/sea-rvw-prd/instances/cloudsql-rvw-log', databaseType: 'MYSQL', selectedCredentialId: 'hgildong-mysql-prod', connectionStatus: 'CONNECTED', isSelected: true, integrationCategory: 'TARGET' },
    ],
  }),
  // 30개 규모 대상 — 연결 테스트 카드·확정 정보 표가 리소스 수에 흔들리지 않는지
  // 눈으로 확인하려면 실제로 그 크기의 대상이 하나 있어야 한다. Azure ARM id 는 목에
  // 있는 리소스 식별자 중 가장 길어, Resource ID 절단이 가장 먼저 깨지는 자리이기도 하다.
  makeTcQueueProject({
    targetSourceId: 1801,
    serviceCode: 'LGS',
    name: '물류서비스 PII Agent - 대규모 대상',
    cloudProvider: 'Azure',
    processStatus: ProcessStatus.CONNECTION_VERIFIED,
    updatedAt: '2026-08-01T11:05:00Z',
    extra: {
      subscriptionId: 'b1d4e77c-90a2-4f38-8c15-6e2f0a9b3d41',
      tenantId: '7f9c1b30-52d4-4a11-9d63-0c1e5a8b7742',
    },
    resources: lgsResources,
  }),
  // 재실행 요청 상태 — 반려로 되돌아가 어떤 상태 필터에도 걸리지 않는 케이스.
  makeTcQueueProject({
    targetSourceId: 1583,
    serviceCode: 'IVT',
    name: '재고서비스 PII Agent - 재실행 요청',
    cloudProvider: 'IDC',
    processStatus: ProcessStatus.WAITING_CONNECTION_TEST,
    updatedAt: '2026-07-19T14:52:00Z',
    resources: [
      { id: 'ivt-res-1', type: 'IDC_RESOURCE', resourceId: 'idc-ivt-9a01', databaseType: 'MYSQL', selectedCredentialId: 'hgildong-mysql-prod', connectionStatus: 'CONNECTED', isSelected: true, integrationCategory: 'TARGET', idcConfig: { inputFormat: 'HOST', ips: [], domain: 'db-mysql.ivt.prod.internal', sourceIps: ['10.20.9.11'], firewallOpen: true } },
      { id: 'ivt-res-2', type: 'IDC_RESOURCE', resourceId: 'idc-ivt-9a02', databaseType: 'MYSQL', selectedCredentialId: 'hgildong-mysql-prod', connectionStatus: 'CONNECTED', isSelected: true, integrationCategory: 'TARGET', idcConfig: { inputFormat: 'IP', ips: ['10.20.4.11'], domain: '', sourceIps: ['10.20.9.11'], firewallOpen: true } },
      { id: 'ivt-res-3', type: 'IDC_RESOURCE', resourceId: 'idc-ivt-9a03', databaseType: 'ORACLE', selectedCredentialId: 'kimcs-redshift-dw', connectionStatus: 'DISCONNECTED', isSelected: true, integrationCategory: 'TARGET', idcConfig: { inputFormat: 'IP', ips: ['10.20.4.18'], domain: '', oracleSid: 'IVTPDB', sourceIps: ['10.20.9.12'], firewallOpen: false } },
    ],
  }),
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
    name: 'hgildong-mysql-prod',
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
    name: 'kimcs-postgres-analytics',
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
    name: 'kimcs-redshift-dw',
    databaseType: 'REDSHIFT',
    host: 'dw-cluster.example.com',
    port: 5439,
    username: 'dw_reader',
    maskedPassword: '********',
    createdAt: '2024-01-15T11:00:00Z',
    createdBy: 'admin-1',
  },
  // 데모: 실 운영 규모(20+)를 재현해 검색·목록 폭이 개수에 흔들리지 않는지 확인한다.
  // 이름이 서로 닮아 있어야 "생성 시각 / 배정 건수"가 실제로 구분에 쓰이는지도 보인다.
  ...(
    [
      ['hgildong-mysql-prod-replica', 'MYSQL', '2024-01-10T09:04:00Z'],
      ['kimcs-postgres-analytics-readonly', 'POSTGRESQL', '2024-01-12T10:06:00Z'],
      ['jhpark-mssql-payments', 'MSSQL', '2024-02-01T00:12:00Z'],
      ['jhpark-mssql-payments-stg', 'MSSQL', '2024-02-01T00:20:00Z'],
      ['swlee-mysql-orders', 'MYSQL', '2024-02-03T02:40:00Z'],
      ['swlee-mysql-orders-stg', 'MYSQL', '2024-02-03T02:44:00Z'],
      ['swlee-mysql-coupons', 'MYSQL', '2024-02-11T05:05:00Z'],
      ['yjkim-cosmos-notifications', 'MYSQL', '2024-02-14T07:31:00Z'],
      ['yjkim-oracle-inventory', 'ORACLE', '2024-03-02T00:50:00Z'],
      ['yjkim-oracle-inventory-dr', 'ORACLE', '2024-03-02T00:57:00Z'],
      ['mjshin-postgres-reviews', 'POSTGRESQL', '2024-03-08T04:22:00Z'],
      ['mjshin-mysql-delivery', 'MYSQL', '2024-03-15T01:11:00Z'],
      ['mjshin-mysql-delivery-stg', 'MYSQL', '2024-03-15T01:18:00Z'],
      ['dwjung-mssql-settlement', 'MSSQL', '2024-04-01T00:00:00Z'],
      ['dwjung-mysql-members', 'MYSQL', '2024-04-22T03:03:00Z'],
      ['dwjung-mysql-members-readonly', 'MYSQL', '2024-04-22T03:09:00Z'],
      ['sysadmin-athena-logs', 'ATHENA', '2024-06-02T00:38:00Z'],
      // 규칙(`{userId}-{name}`)에 맞지 않는 값 — 하이픈이 없다. 이런 이름이 섞여도 화면이
      // userId 를 지어내지 않고 이름 전체를 그대로 보여주는지 데모에서 바로 보인다.
      ['legacy_shared_account', 'MYSQL', '2023-11-02T02:10:00Z'],
    ] as const
  ).map(([name, databaseType, createdAt], index) => ({
    id: `cred-${index + 4}`,
    name,
    databaseType: databaseType as DBCredential['databaseType'],
    host: `${name.toLowerCase()}.example.com`,
    port: 3306,
    username: 'pii_agent',
    maskedPassword: '********',
    createdAt,
    createdBy: 'admin-1',
  })),
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
