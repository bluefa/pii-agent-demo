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
