/**
 * 데이터 어댑터 인터페이스 (ADR-005)
 *
 * API Route가 데이터 출처를 모르게 하는 추상화 계층.
 * - 개발: MockAdapter → lib/mock-*.ts
 * - 프로덕션: BffAdapter → fetch(BFF_URL)
 */

import type {
  User,
  Project,
  ServiceCode,
  DBCredential,
  DatabaseType,
  ConnectionTestResult,
  ScanJob,
  ScanHistory,
  ProjectHistory,
  ProjectHistoryActor,
  AwsInstallationStatus,
  CheckInstallationResponse,
  TerraformScriptResponse,
  AwsServiceSettings,
  VerifyTfRoleRequest,
  VerifyTfRoleResponse,
  UpdateAwsSettingsRequest,
  UpdateAwsSettingsResponse,
  VerifyScanRoleResponse,
} from '@/lib/types';
import type {
  AzureInstallationStatus,
  AzureVmInstallationStatus,
  AzureTerraformScript,
  AzureSubnetGuide,
  AzureServiceSettings,
} from '@/lib/types/azure';
import type {
  IdcInstallationStatus,
  IdcServiceSettings,
  SourceIpRecommendation,
  ConfirmFirewallResponse,
  IpType,
  IdcResourceInput,
} from '@/lib/types/idc';
import type {
  SduInstallationStatus,
  S3UploadInfo,
  IamUser,
  IssueAkSkResponse,
  SourceIpManagement,
  SourceIpEntry,
  SduAthenaTable,
  SduServiceSettings,
  SduConnectionTestInfo,
} from '@/lib/types/sdu';
import type {
  GcpInstallationStatus,
  GcpRegionalManagedProxyStatus,
  GcpConnectionType,
  GcpServiceTfResources,
  GcpServiceSettings,
} from '@/lib/types/gcp';
import type { ScanValidationResult } from '@/lib/mock-scan';
import type {
  HistoryFilterType,
  GetProjectHistoryOptions,
  GetProjectHistoryResult,
} from '@/lib/mock-history';

// ===== Provider API 공통 결과 타입 =====

export interface ProviderResult<T> {
  data?: T;
  error?: { code: string; message: string; status: number };
}

// ===== 어댑터 인터페이스 =====

export interface DataAdapter {
  // --- User ---
  getCurrentUser: () => Promise<User | undefined>;
  setCurrentUser: (userId: string) => Promise<void>;
  getUsers: () => Promise<User[]>;
  searchUsers: (query: string) => Promise<User[]>;

  // --- Project ---
  getProjectById: (id: string) => Promise<Project | undefined>;
  getProjectsByServiceCode: (serviceCode: string) => Promise<Project[]>;
  addProject: (project: Project) => Promise<Project>;
  updateProject: (id: string, updates: Partial<Project>) => Promise<Project | undefined>;
  deleteProject: (id: string) => Promise<boolean>;
  generateId: (prefix: string) => Promise<string>;

  // --- ServiceCode ---
  getServiceCodes: () => Promise<ServiceCode[]>;
  getServiceCodeByCode: (code: string) => Promise<ServiceCode | undefined>;

  // --- Credential ---
  getCredentials: () => Promise<DBCredential[]>;
  getCredentialsByDatabaseType: (databaseType: DatabaseType) => Promise<DBCredential[]>;
  getCredentialById: (id: string) => Promise<DBCredential | undefined>;
  simulateConnectionTest: (
    resourceId: string,
    resourceType: string,
    databaseType: DatabaseType,
    credentialId?: string,
    credentialName?: string,
  ) => Promise<ConnectionTestResult>;

  // --- AWS Installation ---
  verifyTfRole: (request: VerifyTfRoleRequest) => Promise<VerifyTfRoleResponse>;
  initializeInstallation: (projectId: string, hasTfPermission: boolean) => Promise<AwsInstallationStatus>;
  getInstallationStatus: (projectId: string) => Promise<AwsInstallationStatus | null>;
  checkInstallation: (projectId: string) => Promise<CheckInstallationResponse | null>;
  getTerraformScript: (projectId: string) => Promise<TerraformScriptResponse | null>;

  // --- AWS Service Settings ---
  getAwsServiceSettings: (serviceCode: string) => Promise<AwsServiceSettings>;
  updateAwsServiceSettings: (serviceCode: string, request: UpdateAwsSettingsRequest) => Promise<UpdateAwsSettingsResponse>;
  verifyScanRole: (serviceCode: string) => Promise<VerifyScanRoleResponse>;

  // --- Scan ---
  validateScanRequest: (project: Project | undefined, force?: boolean) => Promise<ScanValidationResult>;
  createScanJob: (project: Project) => Promise<ScanJob>;
  getScanJob: (scanId: string) => Promise<ScanJob | undefined>;
  getLatestScanForProject: (projectId: string) => Promise<ScanJob | undefined>;
  calculateScanStatus: (scan: ScanJob) => Promise<ScanJob>;
  getScanHistory: (projectId: string, limit?: number, offset?: number) => Promise<{ history: ScanHistory[]; total: number }>;
  canScan: (project: Project) => Promise<{ canScan: boolean; reason?: string; cooldownUntil?: string }>;

  // --- Project History ---
  getProjectHistory: (options: GetProjectHistoryOptions) => Promise<GetProjectHistoryResult>;
  addTargetConfirmedHistory: (projectId: string, actor: ProjectHistoryActor, resourceCount: number, excludedResourceCount: number) => Promise<ProjectHistory>;
  addAutoApprovedHistory: (projectId: string) => Promise<ProjectHistory>;
  addApprovalHistory: (projectId: string, actor: ProjectHistoryActor) => Promise<ProjectHistory>;
  addRejectionHistory: (projectId: string, actor: ProjectHistoryActor, reason: string) => Promise<ProjectHistory>;
  addDecommissionRequestHistory: (projectId: string, actor: ProjectHistoryActor, reason: string) => Promise<ProjectHistory>;
  addDecommissionApprovedHistory: (projectId: string, actor: ProjectHistoryActor) => Promise<ProjectHistory>;
  addDecommissionRejectedHistory: (projectId: string, actor: ProjectHistoryActor, reason: string) => Promise<ProjectHistory>;

  // --- Azure ---
  getAzureInstallationStatus: (projectId: string) => Promise<ProviderResult<AzureInstallationStatus>>;
  checkAzureInstallation: (projectId: string) => Promise<ProviderResult<AzureInstallationStatus>>;
  getAzureVmInstallationStatus: (projectId: string) => Promise<ProviderResult<AzureVmInstallationStatus>>;
  checkAzureVmInstallation: (projectId: string) => Promise<ProviderResult<AzureVmInstallationStatus>>;
  getAzureVmTerraformScript: (projectId: string) => Promise<ProviderResult<AzureTerraformScript>>;
  getAzureSubnetGuide: (projectId: string) => Promise<ProviderResult<AzureSubnetGuide>>;
  getAzureServiceSettings: (serviceCode: string) => Promise<ProviderResult<AzureServiceSettings>>;

  // --- IDC ---
  getIdcInstallationStatus: (projectId: string) => Promise<ProviderResult<IdcInstallationStatus>>;
  checkIdcInstallation: (projectId: string) => Promise<ProviderResult<IdcInstallationStatus>>;
  confirmFirewall: (projectId: string) => Promise<ProviderResult<ConfirmFirewallResponse>>;
  getSourceIpRecommendation: (ipType: IpType) => Promise<ProviderResult<SourceIpRecommendation>>;
  getIdcServiceSettings: (serviceCode: string) => Promise<ProviderResult<IdcServiceSettings>>;
  updateIdcServiceSettings: (serviceCode: string, firewallPrepared: boolean) => Promise<ProviderResult<IdcServiceSettings>>;
  getIdcResources: (projectId: string) => Promise<ProviderResult<IdcResourceInput[]>>;
  updateIdcResources: (projectId: string, resources: IdcResourceInput[]) => Promise<ProviderResult<IdcResourceInput[]>>;
  confirmIdcTargets: (projectId: string, resources: IdcResourceInput[]) => Promise<ProviderResult<{ confirmed: boolean; confirmedAt: string; project: Project }>>;

  // --- SDU ---
  getSduInstallationStatus: (projectId: string) => Promise<ProviderResult<SduInstallationStatus>>;
  checkSduInstallation: (projectId: string) => Promise<ProviderResult<SduInstallationStatus>>;
  getS3UploadStatus: (projectId: string) => Promise<ProviderResult<S3UploadInfo>>;
  confirmS3Upload: (projectId: string) => Promise<ProviderResult<{ confirmed: boolean; confirmedAt: string }>>;
  getIamUser: (projectId: string) => Promise<ProviderResult<IamUser>>;
  issueAkSk: (projectId: string, issuedBy: string) => Promise<ProviderResult<IssueAkSkResponse>>;
  getSourceIpList: (projectId: string) => Promise<ProviderResult<SourceIpManagement>>;
  registerSourceIp: (projectId: string, cidr: string, registeredBy: string) => Promise<ProviderResult<SourceIpEntry>>;
  confirmSourceIp: (projectId: string, cidr: string, confirmedBy: string) => Promise<ProviderResult<SourceIpEntry>>;
  getAthenaTables: (projectId: string) => Promise<ProviderResult<SduAthenaTable[]>>;
  getSduServiceSettings: (serviceCode: string) => Promise<ProviderResult<SduServiceSettings>>;
  getSduConnectionTest: (projectId: string) => Promise<ProviderResult<SduConnectionTestInfo>>;
  executeSduConnectionTest: (projectId: string) => Promise<ProviderResult<SduConnectionTestInfo>>;

  // --- GCP ---
  getGcpInstallationStatus: (projectId: string) => Promise<ProviderResult<GcpInstallationStatus>>;
  checkGcpInstallation: (projectId: string) => Promise<ProviderResult<GcpInstallationStatus>>;
  getGcpRegionalManagedProxy: (projectId: string, resourceId: string) => Promise<ProviderResult<GcpRegionalManagedProxyStatus>>;
  createGcpProxySubnet: (projectId: string, resourceId: string) => Promise<ProviderResult<{ created: boolean }>>;
  getGcpServiceTfResources: (projectId: string, connectionType: GcpConnectionType) => Promise<ProviderResult<GcpServiceTfResources>>;
  getGcpServiceSettings: (serviceCode: string) => Promise<ProviderResult<GcpServiceSettings>>;
}
