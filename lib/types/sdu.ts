// ===== SDU Process Status =====

export type SduProcessStatus =
  | 'S3_UPLOAD_PENDING'
  | 'S3_UPLOAD_CONFIRMED'
  | 'INSTALLING'
  | 'WAITING_CONNECTION_TEST'
  | 'CONNECTION_VERIFIED'
  | 'INSTALLATION_COMPLETE';

// ===== S3 Upload Status =====

export type S3UploadStatus = 'PENDING' | 'CONFIRMED';

export interface S3UploadInfo {
  status: S3UploadStatus;
  confirmedAt?: string;
}

// ===== Crawler Status =====

export type CrawlerRunStatus = 'NONE' | 'SUCCESS' | 'FAILED';

export interface CrawlerStatus {
  configured: boolean;
  lastRunStatus: CrawlerRunStatus;
  lastRunAt?: string;
}

// ===== Athena Table Status =====

export type AthenaTableStatus = 'PENDING' | 'CREATED';

export interface AthenaTableInfo {
  status: AthenaTableStatus;
  tableCount: number;
  database: string;
}

// ===== Athena Setup Status =====

export type AthenaSetupStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';

export interface AthenaSetupInfo {
  status: AthenaSetupStatus;
}

// ===== SDU Installation Status =====

export interface SduInstallationStatus {
  provider: 'SDU';
  crawler: CrawlerStatus;
  athenaTable: AthenaTableInfo;
  targetConfirmed: boolean;
  athenaSetup: AthenaSetupInfo;
}

// ===== Connection Test Status =====

export type SduConnectionTestStatus = 'NOT_TESTED' | 'PASSED' | 'FAILED';

export interface SduConnectionTestInfo {
  status: SduConnectionTestStatus;
}

// ===== SDU Project Status =====

export interface SduProjectStatus {
  s3Upload: S3UploadInfo;
  installation: SduInstallationStatus;
  connectionTest: SduConnectionTestInfo;
}

// ===== IAM User =====

export interface IamUser {
  userName: string;
  akSkIssuedAt?: string;
  akSkIssuedBy?: string;
  akSkExpiresAt?: string;
}

export interface IssueAkSkResponse {
  success: boolean;
  issuedAt: string;
  expiresAt: string;
}

// ===== Source IP Management =====

export type SourceIpStatus = 'REGISTERED' | 'CONFIRMED';

export interface SourceIpEntry {
  cidr: string;
  status: SourceIpStatus;
  registeredAt: string;
  confirmedAt?: string;
}

export interface SourceIpManagement {
  entries: SourceIpEntry[];
}

// ===== SDU Athena Table =====

export interface SduAthenaTable {
  tableName: string;
  database: string;
  s3Location: string;
}

// ===== SDU Service Settings =====

export interface SduServiceSettings {
  iamUser?: IamUser;
  sourceIp: SourceIpManagement;
  guide?: {
    description: string;
    documentUrl?: string;
  };
}
