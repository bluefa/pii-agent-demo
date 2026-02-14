// ============================================================
// V1 API Request / Response Types (based on docs/swagger/*.yaml)
// ============================================================

// --- Common ---

export interface LastCheckInfo {
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  checkedAt: string;
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

export type ScriptStatus = 'PENDING' | 'COMPLETED' | 'FAILED';
export type RoleStatus = 'VALID' | 'INVALID' | 'UNVERIFIED';

export interface ResourceItem {
  resourceId: string;
  type: string;
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
  isVm: boolean;
  resourceName?: string;
  privateEndpoint?: PrivateEndpointDetail;
  vmInstallation?: VmInstallationDetail;
}

export interface AzureInstallationStatusResponse {
  hasVm: boolean;
  lastCheck: LastCheckInfo;
  resources?: AzureResourceStatus[];
}

export interface AzureSettingsResponse {
  scanApp: {
    appId: string;
    status: RoleStatus;
    lastVerifiedAt?: string;
  };
}

// --- GCP API ---

export type GcpTfStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';

export type GcpPendingAction =
  | 'CREATE_PROXY_SUBNET'
  | 'APPROVE_PSC_CONNECTION'
  | null;

export interface PscConnection {
  status: PrivateEndpointStatus;
  connectionId: string;
  serviceAttachmentUri: string;
}

export interface GcpResourceStatus {
  id: string;
  name: string;
  resourceType: 'CLOUD_SQL' | 'BIGQUERY';
  serviceTfStatus: GcpTfStatus;
  bdcTfStatus: GcpTfStatus;
  isInstallCompleted: boolean;
  pendingAction?: GcpPendingAction;
  regionalManagedProxy?: {
    exists: boolean;
    networkProjectId: string;
    vpcName: string;
    cloudSqlRegion: string;
  };
  pscConnection?: PscConnection;
}

export interface GcpInstallationStatusResponse {
  provider: string;
  lastCheck?: LastCheckInfo;
  resources: GcpResourceStatus[];
}

export interface GcpSettingsResponse {
  gcpProjectId: string;
  scanServiceAccount: string;
  terraformExecutionServiceAccount: string;
}

// --- Credential API ---

export interface SecretEntry {
  name: string;
  labels?: Record<string, string>;
  createTimeStr: string;
}

export type SecretsResponse = SecretEntry[];
