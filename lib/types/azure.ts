// ===== Azure Private Endpoint 상태 =====

export type PrivateEndpointStatus =
  | 'NOT_REQUESTED'      // BDC측 확인 필요
  | 'PENDING_APPROVAL'   // 승인 대기
  | 'APPROVED'           // 승인 완료
  | 'REJECTED';          // 거부됨

// ===== Azure 설치 상태 (DB 리소스) =====

export interface AzurePrivateEndpoint {
  id: string;
  name: string;
  status: PrivateEndpointStatus;
  requestedAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
}

export interface AzureResourceStatus {
  resourceId: string;
  resourceName: string;
  resourceType: string;
  // TF 완료 여부는 privateEndpoint.status로 판단
  // - NOT_REQUESTED: TF 미완료
  // - PENDING_APPROVAL 이상: TF 완료
  privateEndpoint: AzurePrivateEndpoint;
}

export interface AzureInstallationStatus {
  provider: 'Azure';
  // 전체 설치 완료 여부 (모든 리소스가 APPROVED일 때 true)
  installed: boolean;
  resources: AzureResourceStatus[];
  lastCheckedAt?: string;
  error?: {
    code: string;
    message: string;
  };
}

// ===== Azure VM 설치 상태 =====

export interface AzureVmStatus {
  vmId: string;
  vmName: string;
  // 설치 단계: 1. Subnet → 2. Terraform → 3. Private Endpoint
  subnetExists: boolean;
  terraformInstalled: boolean;
  privateEndpoint?: AzurePrivateEndpoint;
}

export interface AzureVmInstallationStatus {
  vms: AzureVmStatus[];
  lastCheckedAt?: string;
  error?: {
    code: string;
    message: string;
  };
}

// ===== Azure 서비스 설정 =====

export type ScanAppStatus = 'VALID' | 'INVALID' | 'NOT_VERIFIED';

export interface AzureScanApp {
  registered: boolean;
  appId?: string;
  lastVerifiedAt?: string;
  status?: ScanAppStatus;
}

export interface AzureServiceSettings {
  scanApp: AzureScanApp;
  guide?: {
    description: string;
    documentUrl?: string;
  };
}

// ===== Azure TF Script =====

export interface AzureTerraformScript {
  downloadUrl: string;
  fileName: string;
  generatedAt: string;
}

// ===== Azure Subnet 가이드 =====

export interface AzureSubnetGuide {
  description: string;
  documentUrl?: string;
}
