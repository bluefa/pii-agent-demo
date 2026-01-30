// ===== Enums & Constants =====

export enum ProcessStatus {
  WAITING_TARGET_CONFIRMATION = 1,  // 연동 대상 확정 대기
  WAITING_APPROVAL = 2,              // 승인 대기
  INSTALLING = 3,                    // 설치 진행 중
  WAITING_CONNECTION_TEST = 4,       // 연결 테스트 필요
  CONNECTION_VERIFIED = 5,           // 연결 확인 완료 (관리자 확정 대기)
  INSTALLATION_COMPLETE = 6          // 설치 완료
}

export type ConnectionStatus = 'CONNECTED' | 'DISCONNECTED' | 'PENDING';

export type TerraformStatus = 'COMPLETED' | 'FAILED' | 'PENDING';

export type FirewallStatus = 'CONNECTED' | 'CONNECTION_FAIL';

export type UserRole = 'SERVICE_MANAGER' | 'ADMIN';

export type CloudProvider = 'AWS' | 'Azure' | 'GCP' | 'IDC' | 'SDU';

export type DatabaseType = 'MYSQL' | 'POSTGRESQL' | 'MSSQL' | 'DYNAMODB' | 'ATHENA' | 'REDSHIFT' | 'COSMOSDB' | 'BIGQUERY' | 'SPANNER';

export type AwsResourceType = 'RDS' | 'RDS_CLUSTER' | 'DYNAMODB' | 'ATHENA' | 'REDSHIFT' | 'EC2';

export type AzureResourceType = 'AZURE_MSSQL' | 'AZURE_POSTGRESQL' | 'AZURE_MYSQL' | 'AZURE_MARIADB' | 'AZURE_COSMOS_NOSQL' | 'AZURE_SYNAPSE' | 'AZURE_VM';

export type GcpResourceType = 'CLOUD_SQL' | 'BIGQUERY' | 'SPANNER';

export type ResourceType = AwsResourceType | AzureResourceType | GcpResourceType | 'IDC';

export type AwsRegion =
  | 'ap-northeast-2'
  | 'ap-northeast-1'
  | 'us-east-1'
  | 'us-west-2'
  | string;

export type ResourceLifecycleStatus =
  | 'DISCOVERED'        // 스캔됨(기본)
  | 'TARGET'            // 연동 대상으로 선택됨
  | 'PENDING_APPROVAL'  // 승인 요청 진행중
  | 'INSTALLING'        // 설치 진행중
  | 'READY_TO_TEST'     // 연결 테스트 필요 단계 대응
  | 'ACTIVE';           // 설치/연결 완료

// ===== Core Entities =====

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  serviceCodePermissions: string[];
}

export interface ServiceCode {
  code: string;
  name: string;
  description?: string;
}

export interface Resource {
  id: string;
  type: string;
  resourceId: string;
  connectionStatus: ConnectionStatus;
  isSelected: boolean;
  databaseType: DatabaseType;             // DB 종류 (필수)

  // --- AWS 전용 ---
  awsType?: AwsResourceType;              // AWS일 때만
  region?: AwsRegion;                     // AWS일 때만

  // --- 상태/표시 ---
  lifecycleStatus: ResourceLifecycleStatus; // UI 상태(필수)
  isNew?: boolean;                        // NEW 라벨 고정용(선택)
  note?: string;                          // 비고(선택)

  // --- Credential ---
  selectedCredentialId?: string;          // 선택된 credential ID (4단계용)
}

export interface TerraformState {
  // AWS 전용: 서비스 측 Terraform
  serviceTf?: TerraformStatus;
  // 공통: BDC 측 Terraform
  bdcTf: TerraformStatus;
  // IDC 전용: 방화벽 연결 확인
  firewallCheck?: FirewallStatus;
}

export interface Project {
  id: string;
  projectCode: string;
  serviceCode: string;
  cloudProvider: CloudProvider;
  processStatus: ProcessStatus;
  resources: Resource[];
  terraformState: TerraformState;
  createdAt: string;
  updatedAt: string;

  name: string;
  description: string;

  // 반려 관련
  isRejected: boolean;
  rejectionReason?: string;
  rejectedAt?: string;

  // 승인 관련
  approvalComment?: string;
  approvedAt?: string;

  // PII Agent 설치 확정 (최초 1회)
  piiAgentInstalled?: boolean;

  // PII Agent 최초 연결 성공 시간
  piiAgentConnectedAt?: string;

  // 설치 완료 확정 시간 (관리자)
  completionConfirmedAt?: string;

  // Connection Test 이력
  connectionTestHistory?: ConnectionTestHistory[];
}

// ===== API Response Types =====

export interface ProjectSummary {
  id: string;
  projectCode: string;
  processStatus: ProcessStatus;
  cloudProvider: CloudProvider;
  resourceCount: number;
  hasDisconnected: boolean;
  hasNew: boolean;
  description?: string;
  isRejected: boolean;
  rejectionReason?: string;
  connectionTestComplete: boolean; // 연결 테스트 완료 여부 (선택된 리소스 모두 CONNECTED)
}

export interface ErrorResponse {
  error: string;
  message: string;
}

// ===== Connection Test Types =====

// Credential이 필요한 DB 타입 (RDS, IDC)
export type CredentialRequiredDBType = 'MYSQL' | 'POSTGRESQL' | 'REDSHIFT';

// DB Credential
export interface DBCredential {
  id: string;
  name: string;
  databaseType: CredentialRequiredDBType;
  host?: string;
  port?: number;
  username: string;
  maskedPassword: string;
  createdAt: string;
  createdBy: string;
}

// 연결 에러 타입
export type ConnectionErrorType =
  | 'AUTH_FAILED'
  | 'PERMISSION_DENIED'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'UNKNOWN_ERROR';

export interface ConnectionError {
  type: ConnectionErrorType;
  message: string;
}

// 테스트 결과 (동기)
export interface ConnectionTestResult {
  resourceId: string;
  resourceType: string;
  databaseType: DatabaseType;
  credentialName?: string;
  success: boolean;
  error?: ConnectionError;
}

// Test Connection 실행 이력
export type ConnectionTestStatus = 'PENDING' | 'SUCCESS' | 'FAIL';

export interface ConnectionTestHistory {
  id: string;
  executedAt: string;
  status: ConnectionTestStatus;
  successCount: number;
  failCount: number;
  results: ConnectionTestResult[];
}

// Credential이 필요한지 확인하는 헬퍼
export const needsCredential = (databaseType: DatabaseType): boolean => {
  return ['MYSQL', 'POSTGRESQL', 'REDSHIFT'].includes(databaseType);
};

// ===== Scan Types =====

export type ScanStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';

export interface ScanResult {
  totalFound: number;
  newFound: number;
  updated: number;
  removed: number;
  byResourceType: Array<{
    resourceType: ResourceType;
    count: number;
  }>;
}

export interface ScanJob {
  id: string;
  projectId: string;
  provider: CloudProvider;
  status: ScanStatus;
  startedAt: string;
  completedAt?: string;

  // Mock 진행 상태
  progress: number;
  estimatedEndAt: string;

  // 결과
  result?: ScanResult;
  error?: string;
}

export interface ScanHistory {
  id: string;
  projectId: string;
  scanId: string;
  provider: CloudProvider;
  status: 'COMPLETED' | 'FAILED';
  startedAt: string;
  completedAt: string;
  duration: number;
  result: ScanResult | null;
  error?: string;

  // 스냅샷
  resourceCountBefore: number;
  resourceCountAfter: number;
  addedResourceIds: string[];
}
