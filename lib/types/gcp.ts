// ===== GCP 연결 유형 (3가지 설치 케이스) =====

export type GcpConnectionType = 'PRIVATE_IP' | 'PSC' | 'BIGQUERY';

// ===== GCP TF 설치 상태 =====

export type GcpTfStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';

// ===== Regional Managed Proxy Subnet 상태 =====

export interface GcpRegionalManagedProxyStatus {
  exists: boolean;
  networkProjectId: string;
  vpcName: string;
  cloudSqlRegion: string;
  subnetName?: string;
  subnetCidr?: string;
}

// ===== PSC Connection 상태 =====

export type GcpPscStatus = 'NOT_REQUESTED' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';

export interface GcpPscConnectionStatus {
  status: GcpPscStatus;
  connectionId?: string;
  serviceAttachmentUri?: string;
  requestedAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
}

// ===== 리소스별 설치 상태 =====

export interface GcpInstallResource {
  id: string;
  name: string;
  resourceType: 'CLOUD_SQL' | 'BIGQUERY';
  connectionType: GcpConnectionType;
  databaseType: string;
  serviceTfStatus: GcpTfStatus;
  bdcTfStatus: GcpTfStatus;
  regionalManagedProxy?: GcpRegionalManagedProxyStatus;
  pscConnection?: GcpPscConnectionStatus;
  isCompleted: boolean;
}

// ===== 전체 설치 상태 =====

export interface GcpInstallationStatus {
  provider: 'GCP';
  resources: GcpInstallResource[];
  lastCheckedAt?: string;
  error?: {
    code: string;
    message: string;
  };
}

// ===== Service TF 리소스 목록 =====

export interface GcpTfResource {
  name: string;
  type: string;
  description: string;
}

export interface GcpServiceTfResources {
  connectionType: GcpConnectionType;
  resources: GcpTfResource[];
  totalCount: number;
}

// ===== GCP 서비스 설정 =====

export interface GcpServiceSettings {
  projectScanPermission: boolean;
  hostProjectPermission: boolean;
  subnetCreationRequired: boolean;
  guide?: {
    description: string;
    documentUrl?: string;
  };
}
