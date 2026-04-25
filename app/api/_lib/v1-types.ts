// ============================================================
// V1 API Request / Response Types (based on docs/swagger/*.yaml)
// ============================================================

// --- Common ---

export interface LastCheckInfo {
  status: 'NEVER_CHECKED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  checkedAt?: string | null;
  failReason?: string;
}

// --- User API ---

export interface UserMeResponse {
  id: string;
  name: string;
  email: string;
}

export interface UserService {
  serviceCode: string;
  serviceName: string;
}

export interface UserServicesResponse {
  services: UserService[];
}

export interface UserSearchResponse {
  users: { id: string; name: string; email: string }[];
}

// --- Scan API ---

export type ScanStatus = 'SCANNING' | 'SUCCESS' | 'FAIL' | 'CANCELED' | 'TIMEOUT';
export type ScanErrorCode = 'AUTH_PERMISSION_ERROR' | null;

export interface ScanJob {
  id: number;
  scanStatus: ScanStatus;
  targetSourceId: number;
  createdAt: string;
  updatedAt: string;
  scanVersion: number;
  scanProgress: null;
  durationSeconds: number | null;
  resourceCountByResourceType: Record<string, number>;
  scanError: ScanErrorCode;
}

export interface ScanHistoryResponse {
  content: ScanJob[];
  page: {
    totalElements: number;
    totalPages: number;
    number: number;
    size: number;
  };
}

// --- AWS API ---

export type ScriptStatus = 'PENDING' | 'INSTALLING' | 'COMPLETED' | 'FAILED';
export type RoleStatus = 'VALID' | 'INVALID' | 'UNVERIFIED';

export interface ResourceItem {
  resourceId: string;
  resource_id?: string;
  type: string;
  resource_type?: string;
  name: string;
}

export interface ServiceScript {
  scriptName: string;
  status: ScriptStatus;
  region?: string;
  resources?: ResourceItem[];
}

export interface AwsInstallationStatusResponse {
  lastCheck: LastCheckInfo;
  hasExecutionPermission?: boolean;
  serviceScripts: ServiceScript[];
  bdcStatus?: { status: ScriptStatus };
}

export interface AwsRoleInfo {
  roleArn: string;
  status: RoleStatus;
  lastVerifiedAt?: string;
}

export interface AwsSettingsResponse {
  executionRole?: AwsRoleInfo;
  scanRole?: AwsRoleInfo;
}

export interface VerifyRoleResponse {
  valid: boolean;
  message?: string;
}

// --- Azure API ---

export type PrivateEndpointStatus =
  | 'NOT_REQUESTED'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED';

export interface PrivateEndpointDetail {
  id: string;
  name: string;
  status: PrivateEndpointStatus;
}

export interface VmInstallationDetail {
  subnetExists?: boolean;
  loadBalancer?: {
    installed: boolean;
    name: string;
  };
}

export interface AzureResourceStatus {
  resourceId: string;
  resourceType: string;
  resourceName?: string;
  privateEndpoint?: PrivateEndpointDetail;
  vmInstallation?: VmInstallationDetail;
}

export interface AzureInstallationStatusResponse {
  lastCheck: LastCheckInfo;
  resources?: AzureResourceStatus[];
}

// --- GCP API ---

export type GcpStepStatusValue = 'COMPLETED' | 'FAIL' | 'IN_PROGRESS' | 'SKIP';
export type GcpInstallationStatusValue = 'COMPLETED' | 'FAIL' | 'IN_PROGRESS';
export type GcpResourceType = 'CLOUD_SQL' | 'BIGQUERY';
export type GcpResourceSubType = 'PRIVATE_IP_MODE' | 'BDC_PRIVATE_HOST_MODE' | 'PSC_MODE';

export interface GcpStepStatus {
  status: GcpStepStatusValue;
  guide?: string | null;
}

export interface GcpResourceStatus {
  resourceId: string;
  resourceName?: string;
  resourceType: GcpResourceType;
  resourceSubType?: GcpResourceSubType | null;
  installationStatus: GcpInstallationStatusValue;
  serviceSideSubnetCreation: GcpStepStatus;
  serviceSideTerraformApply: GcpStepStatus;
  bdcSideTerraformApply: GcpStepStatus;
}

export interface GcpInstallationSummary {
  totalCount: number;
  completedCount: number;
  allCompleted: boolean;
}

export interface GcpInstallationStatusResponse {
  lastCheck: LastCheckInfo;
  summary: GcpInstallationSummary;
  resources: GcpResourceStatus[];
}

export interface GcpSettingsResponse {
  gcpProjectId: string;
  scanServiceAccount: string;
  terraformExecutionServiceAccount: string;
}

export type GcpServiceAccountStatus = 'VALID' | 'INVALID' | 'UNVERIFIED';

export type GcpServiceAccountFailReason =
  | 'SA_NOT_CONFIGURED'
  | 'SA_KEY_EXPIRED'
  | 'SA_NOT_FOUND'
  | 'SA_INSUFFICIENT_PERMISSIONS'
  | 'SCAN_SA_UNAVAILABLE';

export interface GcpServiceAccountInfo {
  gcpProjectId: string;
  status: GcpServiceAccountStatus;
  failReason?: GcpServiceAccountFailReason | null;
  failMessage?: string | null;
  lastVerifiedAt?: string;
}

// --- Credential API ---

export interface SecretEntry {
  name: string;
  labels?: Record<string, string>;
  createTimeStr: string;
}

export type SecretsResponse = SecretEntry[];
