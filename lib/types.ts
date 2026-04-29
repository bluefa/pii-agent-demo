import type { AzureVmNic } from '@/lib/types/azure';

// ===== Enums & Constants =====

export enum ProcessStatus {
  WAITING_TARGET_CONFIRMATION = 1,  // 연동 대상 확정 대기
  WAITING_APPROVAL = 2,              // 승인 대기
  APPLYING_APPROVED = 3,             // 연동대상 반영 중
  INSTALLING = 4,                    // 설치 진행 중
  WAITING_CONNECTION_TEST = 5,       // 연결 테스트 필요
  CONNECTION_VERIFIED = 6,           // 연결 확인 완료 (관리자 확정 대기)
  INSTALLATION_COMPLETE = 7          // 설치 완료
}

export type ConnectionStatus = 'CONNECTED' | 'DISCONNECTED' | 'PENDING';

export type TerraformStatus = 'COMPLETED' | 'FAILED' | 'PENDING';

export type UserRole = 'SERVICE_MANAGER' | 'ADMIN';

export type AwsInstallationMode = 'AUTO' | 'MANUAL';

export type CloudProvider = 'AWS' | 'Azure' | 'GCP';

const CLOUD_PROVIDER_ALIASES: Record<string, CloudProvider> = {
  AWS: 'AWS',
  AZURE: 'Azure',
  GCP: 'GCP',
};

export const normalizeCloudProvider = (value: unknown): CloudProvider => {
  if (typeof value !== 'string') return 'AWS';
  return CLOUD_PROVIDER_ALIASES[value.trim().toUpperCase()] ?? 'AWS';
};

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

export interface EndpointConfigInputData {
  db_type: VmDatabaseType;
  port: number;
  host: string;
  oracleServiceId?: string;
  selectedNicId?: string;
}

export interface EndpointConfigSnapshot extends EndpointConfigInputData {
  resource_id: string;
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

export type AzureResourceType =
  | 'AZURE_MSSQL'
  | 'AZURE_POSTGRESQL'
  | 'AZURE_MYSQL'
  | 'AZURE_MARIADB'
  | 'AZURE_COSMOS_NOSQL'
  | 'AZURE_SYNAPSE'
  | 'AZURE_VM'
  | 'AZURE_PRIVATE_ENDPOINT'
  | 'AZURE_VIRTUAL_SUBNET'
  | 'AZURE_NETWORK_INTERFACE'
  | 'AZURE_SERVICE_PRINCIPAL';
export type BffAzureResourceType =
  | 'AZURE_SQL_SERVER'
  | 'AZURE_SQL_SERVER_MANAGED_INSTANCE'
  | 'AZURE_MYSQL_FLEXIBLE_SERVER'
  | 'AZURE_MYSQL'
  | 'AZURE_POSTGRESQL'
  | 'AZURE_POSTGRESQL_FLEXIBLE_SERVER'
  | 'AZURE_MARIADB'
  | 'AZURE_COSMOSDB_NOSQL'
  | 'AZURE_SERVICE_PRINCIPAL'
  | 'AZURE_PRIVATE_ENDPOINT'
  | 'AZURE_VIRTUAL_MACHINE'
  | 'AZURE_VIRTUAL_SUBNET'
  | 'AZURE_SYNAPSE_WORKSPACE'
  | 'AZURE_NETWORK_INTERFACE';

// Azure DB 네트워킹 모드 (MySQL, PostgreSQL Flexible Server)
export type AzureNetworkingMode = 'PUBLIC_ACCESS' | 'VNET_INTEGRATION';

export type GcpResourceType = 'CLOUD_SQL' | 'BIGQUERY';

export type ResourceType = AwsResourceType | AzureResourceType | GcpResourceType;

const RESOURCE_TYPE_ALIASES = {
  AWS_ATHENA: 'ATHENA',
  AWS_DB_CLUSTER: 'RDS_CLUSTER',
  AWS_DB_INSTANCE: 'RDS',
  AWS_DYNAMO_DB_GLOBAL_TABLE: 'DYNAMODB',
  AWS_DYNAMO_DB_TABLE: 'DYNAMODB',
  AWS_EC2_INSTANCE: 'EC2',
  AWS_REDSHIFT_CLUSTER: 'REDSHIFT',
  AZURE_COSMOSDB_NOSQL: 'AZURE_COSMOS_NOSQL',
  AZURE_MYSQL_FLEXIBLE_SERVER: 'AZURE_MYSQL',
  AZURE_POSTGRESQL_FLEXIBLE_SERVER: 'AZURE_POSTGRESQL',
  AZURE_SQL_SERVER: 'AZURE_MSSQL',
  AZURE_SQL_SERVER_MANAGED_INSTANCE: 'AZURE_MSSQL',
  AZURE_SYNAPSE_WORKSPACE: 'AZURE_SYNAPSE',
  AZURE_VIRTUAL_MACHINE: 'AZURE_VM',
  GCP_BIGQUERY_DATASET_REGION: 'BIGQUERY',
  GCP_SQL: 'CLOUD_SQL',
} as const satisfies Record<string, string>;

export const normalizeResourceType = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;

  const normalized = value.trim().toUpperCase();
  if (!normalized) return null;

  return RESOURCE_TYPE_ALIASES[normalized as keyof typeof RESOURCE_TYPE_ALIASES] ?? normalized;
};

export const normalizeAzureResourceType = (value: unknown): AzureResourceType | null => {
  const normalized = normalizeResourceType(value);

  switch (normalized) {
    case 'AZURE_MSSQL':
    case 'AZURE_POSTGRESQL':
    case 'AZURE_MYSQL':
    case 'AZURE_MARIADB':
    case 'AZURE_COSMOS_NOSQL':
    case 'AZURE_SYNAPSE':
    case 'AZURE_VM':
      return normalized;
    default:
      return null;
  }
};

export type AwsRegion =
  | 'ap-northeast-2'
  | 'ap-northeast-1'
  | 'us-east-1'
  | 'us-west-2'
  | string;


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

export interface MockResource {
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
}

export interface BaseTargetSource {
  id: string;
  targetSourceId: number;
  projectCode: string;
  serviceCode: string;
  processStatus: ProcessStatus;
  createdAt: string;
  updatedAt: string;
  name: string;
  description: string;

  isRejected: boolean;
  rejectionReason?: string;
  rejectedAt?: string;

  approvalComment?: string;
  approvedAt?: string;

  piiAgentInstalled?: boolean;
  piiAgentConnectedAt?: string;
  completionConfirmedAt?: string;

  connectionTestHistory?: ConnectionTestHistory[];
}

export interface CloudTargetSource extends BaseTargetSource {
  cloudProvider: 'AWS' | 'Azure' | 'GCP';

  awsInstallationMode?: AwsInstallationMode;
  awsAccountId?: string;
  awsRegionType?: 'global' | 'china';

  tenantId?: string;
  subscriptionId?: string;

  gcpProjectId?: string;
}

export type TargetSource = CloudTargetSource;

/**
 * @deprecated TargetSource (CloudTargetSource) 으로 마이그레이션 중.
 *   Mock 내부 도메인 모델 전용. 외부 응답 / 페이지 prop 에서는 TargetSource 를 사용.
 */
export type Project = BaseTargetSource & {
  cloudProvider: CloudProvider;
  status: ProjectStatus;
  terraformState: TerraformState;
  resources: MockResource[];
  awsInstallationMode?: AwsInstallationMode;
  awsAccountId?: string;
  awsRegionType?: 'global' | 'china';
  tenantId?: string;
  subscriptionId?: string;
  gcpProjectId?: string;
};

// ===== API Response Types =====

export interface ProjectSummary {
  id: string;
  targetSourceId: number;
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

// Credential이 필요한 DB 타입
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

// v1 API Secret Key (credential의 v1 표현)
export interface SecretKey {
  name: string;
  createTimeStr: string;
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
export const isInstallIneligible = (resource: MockResource): boolean =>
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

export type ApprovalStatusType =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'AUTO_APPROVED'
  | 'CANCELLED'
  | 'UNAVAILABLE';

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
  operationConfirmed?: boolean;
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
  targetSourceId: number;
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
  targetSourceId: number;
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

// v1 API ScanJob 응답
export interface V1ScanJob {
  id: number;
  scanStatus: ScanStatus;
  targetSourceId: number;
  createdAt: string;
  updatedAt: string;
  scanVersion: number;
  scanProgress: number | null;
  durationSeconds: number;
  resourceCountByResourceType: Record<string, number>;
  scanError: string | null;
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

// ---- v1 AWS 설치 상태 ----

export interface V1LastCheck {
  status: 'SUCCESS' | 'IN_PROGRESS' | 'FAILED';
  checkedAt?: string;
  failReason?: string;
}

export type V1ScriptStatus = 'PENDING' | 'INSTALLING' | 'COMPLETED' | 'FAILED';
export type InstallationDisplayStatus = 'NOT_INSTALLED' | 'COMPLETED';

export interface V1ResourceItem {
  resourceId: string;
  resource_id?: string;
  type: string;
  resource_type?: string;
  name: string;
  installationDisplayStatus?: InstallationDisplayStatus;
}

export interface V1ServiceScript {
  scriptId?: string;
  scriptName: string;
  terraformScriptName?: string;
  status: V1ScriptStatus;
  resourceCount?: number;
  region?: string;
  resources: V1ResourceItem[];
}

export interface AwsInstallationActionSummary {
  serviceActionRequired: boolean;
  bdcInstallationRequired: boolean;
}

export interface AwsInstallationStatus {
  hasExecutionPermission: boolean;
  executionRoleArn?: string;
  serviceScripts: V1ServiceScript[];
  bdcStatus: { status: V1ScriptStatus };
  lastCheck: V1LastCheck;
  actionSummary?: AwsInstallationActionSummary;
}

// TF Script
export interface TerraformScriptResponse {
  downloadUrl: string;
  fileName: string;
  expiresAt: string;
}

// ---- v1 AWS 설정 (Role 정보) ----

export type AwsRoleStatus = 'VALID' | 'INVALID' | 'UNVERIFIED';
export type AwsRoleFailReason = 'ROLE_NOT_CONFIGURED' | 'ROLE_INSUFFICIENT_PERMISSIONS' | 'SCAN_ROLE_UNAVAILABLE';

export interface AwsRoleInfo {
  roleArn: string | null;
  status: AwsRoleStatus;
  failReason?: AwsRoleFailReason | null;
  failMessage?: string | null;
  lastVerifiedAt?: string;
}

export interface AwsSettings {
  executionRole: AwsRoleInfo;
  scanRole: AwsRoleInfo;
}

// ---- 레거시 타입 (서버 사이드 v1 변환용, mock/BFF 응답) ----

export type LegacyScanRoleStatus = 'VALID' | 'INVALID' | 'NOT_VERIFIED';

export interface LegacyScanRoleInfo {
  registered: boolean;
  roleArn?: string;
  lastVerifiedAt?: string;
  status?: LegacyScanRoleStatus;
}

export interface LegacyAwsServiceSettings {
  accountId?: string;
  scanRole: LegacyScanRoleInfo;
  guide?: ApiGuide;
}

export interface LegacyAwsInstallationStatus {
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

export interface LegacyCheckInstallationResponse extends LegacyAwsInstallationStatus {
  lastCheckedAt: string;
  error?: TfScriptError;
}

export interface UpdateAwsSettingsRequest {
  accountId: string;
  scanRoleArn: string;
}

export interface UpdateAwsSettingsSuccessResponse {
  updated: true;
  accountId: string;
  scanRole: LegacyScanRoleInfo;
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
 * - APPROVAL_CANCELLED: 승인 요청 취소 (요청자가 PENDING 상태에서 취소)
 * - DECOMMISSION_*: 폐기 관련
 */
export type ProjectHistoryType =
  | 'TARGET_CONFIRMED'
  | 'AUTO_APPROVED'
  | 'APPROVAL'
  | 'REJECTION'
  | 'APPROVAL_CANCELLED'
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
  inputData?: ApprovalRequestInputSnapshot; // 요청 시점 스냅샷 (approval-history용)
}

/** approval-history에서 사용하는 요청 시점 input_data 스냅샷 */
export interface ApprovalRequestInputSnapshot {
  resource_inputs: Array<
    | {
      resource_id: string;
      selected: true;
      resource_input?: {
        credential_id?: string;
        endpoint_config?: EndpointConfigInputData;
      };
    }
    | { resource_id: string; selected: false; exclusion_reason?: string }
  >;
  exclusion_reason_default?: string;
}

export interface ProjectHistory {
  id: string;
  targetSourceId: number;
  type: ProjectHistoryType;
  actor: ProjectHistoryActor;
  timestamp: string;
  details: ProjectHistoryDetails;
}

// ===== BFF Confirm API Types (ADR-006/009) =====

/** BFF 프로세스 상태 (ADR-009) — 3객체 존재 여부로 계산 */
export type TargetSourceProcessStatus =
  | 'REQUEST_REQUIRED'
  | 'WAITING_APPROVAL'
  | 'APPLYING_APPROVED'
  | 'TARGET_CONFIRMED';

/** 최근 승인 처리 결과 */
export type LastApprovalResultType =
  | 'NONE'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'SYSTEM_ERROR'
  | 'COMPLETED';

/** Swagger ResourceConfigDto.scan_status — 직전 스캔 대비 본 리소스의 변화 */
export type ResourceScanStatus = 'UNCHANGED' | 'NEW_SCAN';

/** Swagger ResourceConfigDto.integration_status — confirmed-integration 등록 여부 */
export type ResourceIntegrationStatus = 'INTEGRATED' | 'NOT_INTEGRATED';

/** 리소스 스냅샷 (Swagger ResourceSnapshot) */
export interface ResourceSnapshot {
  resource_id: string;
  resource_type: string;
  endpoint_config: EndpointConfigSnapshot | null;
  credential_id: string | null;
  // ResourceConfigDto extension fields — preserved through the approved-integration mapping.
  database_region?: string | null;
  resource_name?: string | null;
  scan_status?: ResourceScanStatus | null;
  integration_status?: ResourceIntegrationStatus | null;
}

/** Excluded resource snapshot (Swagger ExcludedResourceInfo). */
export interface BffExcludedResourceInfo {
  resource_id: string;
  exclusion_reason: string;
  resource_name?: string | null;
  database_type?: string | null;
  database_region?: string | null;
  scan_status?: ResourceScanStatus | null;
  integration_status?: ResourceIntegrationStatus | null;
}

/** 연동 확정 리소스 정보 (Swagger ConfirmedResourceInfo) */
export interface ConfirmedIntegrationResourceInfo {
  resource_id: string;
  resource_type: string;
  database_type: DatabaseType | null;
  port: number | null;
  host: string | null;
  oracle_service_id: string | null;
  network_interface_id: string | null;
  ip_configuration_name: string | null;
  credential_id: string | null;
}

export interface ConfirmResourceMetadata {
  provider: CloudProvider;
  resourceType: string;
  region?: string;
  vpcId?: string;
  // GCP Cloud Project ID (외부 계약). legacy 내부 projectId와 다름.
  projectId?: string;
  rawResourceType?: string;
  subscriptionId?: string;
  resourceGroup?: string;
  serverName?: string;
  host?: string;
  port?: number;
  accountName?: string;
  endpoint?: string;
  workspaceName?: string;
  vmName?: string;
  hostName?: string;
  privateIp?: string;
}

/** 승인 완료 정보 — 반영 중 스냅샷 (Swagger ApprovedIntegration) */
export interface BffApprovedIntegration {
  id: string;
  request_id: string;
  approved_at: string;
  resource_infos: ResourceSnapshot[];
  excluded_resource_ids: string[];
  excluded_resource_infos?: BffExcludedResourceInfo[];
  exclusion_reason?: string;
}

/** 연동 확정 정보 — 현재 실제 상태 (Swagger ConfirmedIntegration) */
export interface BffConfirmedIntegration {
  resource_infos: ConfirmedIntegrationResourceInfo[];
}
