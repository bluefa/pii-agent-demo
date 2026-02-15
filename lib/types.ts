import type { AzureVmNic } from '@/lib/types/azure';

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

export type AwsInstallationMode = 'AUTO' | 'MANUAL';

export type CloudProvider = 'AWS' | 'Azure' | 'GCP' | 'IDC' | 'SDU';

export type DatabaseType = 'MYSQL' | 'POSTGRESQL' | 'MSSQL' | 'DYNAMODB' | 'ATHENA' | 'REDSHIFT' | 'COSMOSDB' | 'BIGQUERY' | 'MONGODB' | 'ORACLE';

// VM 전용 데이터베이스 타입
export type VmDatabaseType = 'MYSQL' | 'POSTGRESQL' | 'MSSQL' | 'MONGODB' | 'ORACLE';

// VM 데이터베이스 설정
export interface VmDatabaseConfig {
  host?: string;               // EC2 전용: Private DNS Name
  databaseType: VmDatabaseType;
  port: number;
  oracleServiceId?: string;  // Oracle인 경우만
  selectedNicId?: string;    // Azure VM 전용: 선택된 NIC ID
}

export type AwsResourceType = 'RDS' | 'RDS_CLUSTER' | 'DOCUMENTDB' | 'DYNAMODB' | 'ATHENA' | 'REDSHIFT' | 'EC2';

// RDS Cluster 전용 타입
export type RdsClusterType = 'REGIONAL' | 'GLOBAL';

export interface ClusterInstance {
  instanceId: string;
  role: 'READER' | 'WRITER';
  availabilityZone: string;
  isSelected: boolean;
}

export type AzureResourceType = 'AZURE_MSSQL' | 'AZURE_POSTGRESQL' | 'AZURE_MYSQL' | 'AZURE_MARIADB' | 'AZURE_COSMOS_NOSQL' | 'AZURE_SYNAPSE' | 'AZURE_VM';

// Azure DB 네트워킹 모드 (MySQL, PostgreSQL Flexible Server)
export type AzureNetworkingMode = 'PUBLIC_ACCESS' | 'VNET_INTEGRATION';

export type GcpResourceType = 'CLOUD_SQL' | 'BIGQUERY';

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

export interface ResourceExclusion {
  reason: string;
  excludedAt: string;
  excludedBy: { id: string; name: string };
}

export type IntegrationCategory = 'TARGET' | 'NO_INSTALL_NEEDED' | 'INSTALL_INELIGIBLE';

export interface Resource {
  id: string;
  type: string;
  resourceId: string;
  connectionStatus: ConnectionStatus;
  isSelected: boolean;
  databaseType: DatabaseType;             // DB 종류 (필수)
  integrationCategory: IntegrationCategory; // 연동 분류

  // --- AWS 전용 ---
  awsType?: AwsResourceType;              // AWS일 때만
  region?: AwsRegion;                     // AWS일 때만
  vpcId?: string;                         // AWS VPC 리소스 전용

  // --- 상태/표시 ---
  lifecycleStatus: ResourceLifecycleStatus; // UI 상태(필수)
  isNew?: boolean;                        // NEW 라벨 고정용(선택)
  note?: string;                          // 비고(선택)

  // --- Credential ---
  selectedCredentialId?: string;          // 선택된 credential ID (4단계용)

  // --- 연동 제외 정보 ---
  exclusion?: ResourceExclusion;          // 제외된 리소스만

  // --- Azure 전용: 네트워킹 모드 ---
  azureNetworkingMode?: AzureNetworkingMode;  // AZURE_MYSQL, AZURE_POSTGRESQL만

  // --- VM 전용 설정 ---
  vmDatabaseConfig?: VmDatabaseConfig;    // VM 리소스(EC2, AZURE_VM)만
  nics?: AzureVmNic[];  // Azure VM 전용: NIC 목록

  // --- RDS_CLUSTER 전용 ---
  clusterType?: RdsClusterType;
  clusterInstances?: ClusterInstance[];
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
  targetSourceId: number;
  projectCode: string;
  serviceCode: string;
  cloudProvider: CloudProvider;
  processStatus: ProcessStatus;  // deprecated: status 필드에서 계산됨 (ADR-004)
  status: ProjectStatus;         // 비즈니스 상태 데이터 (ADR-004)
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

  // AWS 전용: 설치 모드 (자동/수동)
  awsInstallationMode?: AwsInstallationMode;

  // AWS 전용: Account ID (12자리)
  awsAccountId?: string;
  // AWS 전용: 리전 타입
  awsRegionType?: 'global' | 'china';

  // Azure 전용
  tenantId?: string;
  subscriptionId?: string;

  // GCP 전용
  gcpProjectId?: string;
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

/** 설치 불가 리소스 판별 (integrationCategory 기반) */
export const isInstallIneligible = (resource: Resource): boolean =>
  resource.integrationCategory === 'INSTALL_INELIGIBLE';

// ===== Project Status Types (ADR-004) =====
// processStatus를 계산하기 위한 상태 데이터 구조

export interface ProjectScanStatus {
  /** 프로젝트 프로세스 단계용 스캔 상태 (ScanJob의 실시간 상태와 별개) */
  status: 'PENDING' | 'COMPLETED';
  lastCompletedAt?: string;
}

export interface ProjectTargetsStatus {
  confirmed: boolean;
  selectedCount: number;
  excludedCount: number;
}

export type ApprovalStatusType = 'PENDING' | 'APPROVED' | 'REJECTED' | 'AUTO_APPROVED';

export interface ProjectApprovalStatus {
  status: ApprovalStatusType;
  approvedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
}

export type InstallationStatusType = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';

export interface ProjectInstallationStatus {
  status: InstallationStatusType;
  completedAt?: string;
}

export type ProjectConnectionTestStatusType = 'NOT_TESTED' | 'PASSED' | 'FAILED';

export interface ProjectConnectionTestStatus {
  status: ProjectConnectionTestStatusType;
  lastTestedAt?: string;
  passedAt?: string;
}

/**
 * 프로젝트의 비즈니스 상태 데이터 (ADR-004)
 * - Backend가 제공하는 상태 데이터
 * - Frontend는 이 데이터를 해석하여 현재 단계(ProcessStatus)를 계산
 */
export interface ProjectStatus {
  scan: ProjectScanStatus;
  targets: ProjectTargetsStatus;
  approval: ProjectApprovalStatus;
  installation: ProjectInstallationStatus;
  connectionTest: ProjectConnectionTestStatus;
}

// ===== Scan Types =====

export type ScanStatus = 'SCANNING' | 'SUCCESS' | 'FAIL' | 'CANCELED' | 'TIMEOUT';

export interface ScanResult {
  totalFound: number;
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
  status: 'SUCCESS' | 'FAIL';
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

// ===== AWS API Types =====

// TF Role 검증
export interface VerifyTfRoleRequest {
  accountId: string;
  roleArn?: string;
}

export interface TfRolePermissions {
  canCreateResources: boolean;
  canManageIam: boolean;
  canAccessS3: boolean;
}

export interface VerifyTfRoleSuccessResponse {
  valid: true;
  roleArn: string;
  permissions: TfRolePermissions;
}

export type TfRoleErrorCode = 'ROLE_NOT_FOUND' | 'INSUFFICIENT_PERMISSIONS' | 'ACCESS_DENIED';

export interface ApiGuide {
  title: string;
  steps: string[];
  documentUrl?: string;
}

export interface VerifyTfRoleFailureResponse {
  valid: false;
  errorCode: TfRoleErrorCode;
  errorMessage: string;
  guide: ApiGuide;
}

export type VerifyTfRoleResponse = VerifyTfRoleSuccessResponse | VerifyTfRoleFailureResponse;

// Service TF Script 타입
export type ServiceTfScriptType = 'VPC_ENDPOINT' | 'DYNAMODB_ROLE' | 'ATHENA_GLUE';
export type TfScriptStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';

export interface TfScriptError {
  code: string;
  message: string;
  guide?: ApiGuide;
}

export interface ServiceTfScriptResource {
  resourceId: string;
  type: AwsResourceType;
  name: string;
}

export interface ServiceTfScript {
  id: string;
  type: ServiceTfScriptType;
  status: TfScriptStatus;
  label: string;
  vpcId?: string;
  region?: string;
  resources: ServiceTfScriptResource[];
  completedAt?: string;
  error?: TfScriptError;
}

// 설치 상태
export interface AwsInstallationStatus {
  provider: 'AWS';
  hasTfPermission: boolean;
  tfExecutionRoleArn?: string;
  serviceTfScripts: ServiceTfScript[];
  bdcTf: {
    status: TfScriptStatus;
    completedAt?: string;
    error?: TfScriptError;
  };
  serviceTfCompleted: boolean;
  bdcTfCompleted: boolean;
  completedAt?: string;
  lastCheckedAt?: string;
}

export type CheckInstallationErrorCode = 'VALIDATION_FAILED' | 'ACCESS_DENIED';

export interface CheckInstallationError {
  code: CheckInstallationErrorCode;
  message: string;
  guide?: ApiGuide;
}

export interface CheckInstallationResponse extends AwsInstallationStatus {
  lastCheckedAt: string;
  error?: CheckInstallationError;
}

// TF Script
export interface TerraformScriptResponse {
  downloadUrl: string;
  fileName: string;
  expiresAt: string;
}

// 서비스 AWS 설정
export type ScanRoleStatus = 'VALID' | 'INVALID' | 'NOT_VERIFIED';

export interface ScanRoleInfo {
  registered: boolean;
  roleArn?: string;
  lastVerifiedAt?: string;
  status?: ScanRoleStatus;
}

export interface AwsServiceSettings {
  accountId?: string;
  scanRole: ScanRoleInfo;
  guide?: ApiGuide;
}

export interface UpdateAwsSettingsRequest {
  accountId: string;
  scanRoleArn: string;
}

export interface UpdateAwsSettingsSuccessResponse {
  updated: true;
  accountId: string;
  scanRole: ScanRoleInfo;
}

export type AwsSettingsErrorCode = 'ROLE_NOT_FOUND' | 'INSUFFICIENT_PERMISSIONS' | 'ACCESS_DENIED' | 'INVALID_ACCOUNT_ID';

export interface UpdateAwsSettingsFailureResponse {
  updated: false;
  errorCode: AwsSettingsErrorCode;
  errorMessage: string;
  guide: ApiGuide;
}

export type UpdateAwsSettingsResponse = UpdateAwsSettingsSuccessResponse | UpdateAwsSettingsFailureResponse;

// Scan Role 검증
export interface VerifyScanRoleSuccessResponse {
  valid: true;
  roleArn: string;
  verifiedAt: string;
}

export interface VerifyScanRoleFailureResponse {
  valid: false;
  errorCode: TfRoleErrorCode;
  errorMessage: string;
  guide: ApiGuide;
}

export type VerifyScanRoleResponse = VerifyScanRoleSuccessResponse | VerifyScanRoleFailureResponse;

// ===== Project History Types =====

/**
 * 프로젝트 히스토리 유형
 * - TARGET_CONFIRMED: 연동 대상 확정 (서비스 담당자가 리소스 선택 완료)
 * - AUTO_APPROVED: 자동 승인 (기존 연동 제외 리소스 외 모든 리소스가 연동 대상인 경우)
 * - APPROVAL: 승인 (관리자 수동 승인)
 * - REJECTION: 반려 (관리자 반려, 사유 필수)
 * - DECOMMISSION_*: 폐기 관련
 */
export type ProjectHistoryType =
  | 'TARGET_CONFIRMED'
  | 'AUTO_APPROVED'
  | 'APPROVAL'
  | 'REJECTION'
  | 'DECOMMISSION_REQUEST'
  | 'DECOMMISSION_APPROVED'
  | 'DECOMMISSION_REJECTED';

export interface ProjectHistoryActor {
  id: string;
  name: string;
}

export interface ProjectHistoryDetails {
  reason?: string;                    // 반려/폐기 사유
  resourceCount?: number;             // 연동 확정 시 리소스 개수
  excludedResourceCount?: number;     // 연동 제외된 리소스 개수
}

export interface ProjectHistory {
  id: string;
  projectId: string;
  type: ProjectHistoryType;
  actor: ProjectHistoryActor;
  timestamp: string;
  details: ProjectHistoryDetails;
}
