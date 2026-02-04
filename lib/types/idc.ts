// ===== IDC Database Types =====

export type IdcDatabaseType = 'ORACLE' | 'MYSQL' | 'POSTGRESQL' | 'MSSQL';

// ===== IDC TF 상태 =====

export type IdcTfStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';

// ===== IDC 설치 상태 =====

export interface IdcInstallationStatus {
  provider: 'IDC';
  bdcTf: IdcTfStatus;
  firewallOpened: boolean;
  lastCheckedAt?: string;
  error?: {
    code: string;
    message: string;
  };
}

// ===== IDC 리소스 등록 =====

export interface IdcResourceCreateRequest {
  name: string;
  ip: string;
  port: number;
  databaseType: IdcDatabaseType;
  serviceId?: string; // Oracle 필수
}

export interface IdcResourceUpdateRequest {
  name?: string;
  ip?: string;
  port?: number;
  databaseType?: IdcDatabaseType;
  serviceId?: string;
}

// ===== IDC 방화벽 =====

export type IpType = 'public' | 'private' | 'vpc';

export interface SourceIpRecommendation {
  sourceIps: string[];
  port: number;
  description: string;
}

export interface ConfirmFirewallResponse {
  confirmed: boolean;
  confirmedAt: string;
}

// ===== IDC 서비스 설정 =====

export interface IdcServiceSettings {
  firewallPrepared: boolean;
  guide?: {
    description: string;
    documentUrl?: string;
  };
}

export interface UpdateIdcSettingsRequest {
  firewallPrepared: boolean;
}

// ===== IDC 입력 포맷 =====

export type IdcInputFormat = 'IP' | 'HOST';

// ===== IDC 리소스 입력 (UI용) =====

export interface IdcResourceInput {
  name: string;
  inputFormat: IdcInputFormat;
  ips?: string[];           // IP 선택 시: 최대 3개
  host?: string;            // HOST 선택 시: 단일, 100자 이내
  port: number;
  databaseType: IdcDatabaseType;
  serviceId?: string;       // Oracle 필수
  credentialId?: string;    // 선택된 Credential ID (Optional)
}

// ===== IDC Confirm 요청 (API용) =====

export interface IdcConfirmTargetsRequest {
  resources: Array<{
    name: string;
    database_hosts: string[];
    port: number;
    databaseType: IdcDatabaseType;
    serviceId?: string;
  }>;
}

// ===== IDC Credential 입력 =====

export interface IdcCredentialInput {
  username: string;
  password: string;
  description?: string;
}
