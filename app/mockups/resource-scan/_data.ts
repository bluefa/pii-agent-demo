/**
 * Resource & Scan Mockup v2 - 프로젝트 상세 컨텍스트용 더미 데이터
 *
 * 목업 전용 정적 데이터. AwsProjectPage 구조를 반영.
 * server module 의존 없이 client component에서 안전하게 사용.
 */

// ─── Fluent 2 Design Tokens ─────────────────────────────────────
export const F = {
  // Neutral backgrounds
  bg1: '#ffffff',
  bg2: '#fafafa',
  bg3: '#f5f5f5',
  bg4: '#f0f0f0',
  bg5: '#ebebeb',
  // Neutral foreground
  fg1: '#242424',
  fg2: '#424242',
  fg3: '#616161',
  fg4: '#707070',
  // Neutral stroke
  stroke1: '#d1d1d1',
  stroke2: '#e0e0e0',
  stroke3: '#f0f0f0',
  // Brand
  brand: '#0078D4',
  brandHover: '#106EBE',
  brandPressed: '#005A9E',
  brandBg: '#EBF3FC',
  // Status — Fluent 2 semantic
  success: '#107C10',
  successBg: '#DFF6DD',
  warning: '#797600',
  warningBg: '#FFF4CE',
  error: '#BC2F32',
  errorBg: '#FDE7E9',
  info: '#0078D4',
  infoBg: '#EBF3FC',
  // Typography
  fontBase: "'Segoe UI', -apple-system, BlinkMacSystemFont, 'Roboto', 'Helvetica Neue', sans-serif",
  fontMono: "Consolas, 'Courier New', monospace",
  // Radius — Fluent 2
  radiusSm: '2px',
  radiusMd: '4px',
  radiusLg: '6px',
  radiusXl: '8px',
  // Spacing
  spaceXs: '4px',
  spaceSm: '8px',
  spaceMd: '12px',
  spaceLg: '16px',
  spaceXl: '20px',
  spaceXxl: '24px',
} as const;

// ─── Process Status (AwsProjectPage 기준) ────────────────────────
export const PROCESS_STATUS = {
  WAITING_TARGET_CONFIRMATION: 1,
  WAITING_APPROVAL: 2,
  WAITING_INSTALLATION: 3,
  WAITING_CONNECTION_TEST: 4,
  CONNECTION_VERIFIED: 5,
  INSTALLATION_COMPLETE: 6,
} as const;

export const PROCESS_STEPS = [
  { step: 1, label: '연동 대상 확정 대기', status: 'done' as const },
  { step: 2, label: '승인 대기', status: 'done' as const },
  { step: 3, label: '설치 진행 중', status: 'done' as const },
  { step: 4, label: '연결 테스트 필요', status: 'current' as const },
  { step: 5, label: '연결 확인 완료', status: 'pending' as const },
  { step: 6, label: '설치 완료', status: 'pending' as const },
];

// ─── Project ─────────────────────────────────────────────────────
export const MOCK_PROJECT = {
  id: 'proj-5',
  projectCode: 'DATA-005',
  name: 'PII Agent 설치 - 데이터 마트',
  description: '설치가 완료되어 연결 테스트가 필요합니다.',
  serviceCode: 'SERVICE-A',
  cloudProvider: 'AWS' as const,
  awsInstallationMode: 'AUTO' as const,
  processStatus: 4,
  createdAt: '2026-01-15T09:00:00Z',
  updatedAt: '2026-02-05T14:30:00Z',
};

// ─── Scan ────────────────────────────────────────────────────────
export type ScanUIState = 'IDLE' | 'IN_PROGRESS' | 'COMPLETED' | 'COOLDOWN' | 'FAILED';

export interface ScanResult {
  totalFound: number;
  newFound: number;
  updated: number;
  removed: number;
  byResourceType: Array<{ resourceType: string; count: number }>;
}

export const MOCK_SCAN_RESULT: ScanResult = {
  totalFound: 12,
  newFound: 3,
  updated: 1,
  removed: 0,
  byResourceType: [
    { resourceType: 'RDS', count: 5 },
    { resourceType: 'DynamoDB', count: 3 },
    { resourceType: 'Redshift', count: 2 },
    { resourceType: 'Athena', count: 1 },
    { resourceType: 'EC2', count: 1 },
  ],
};

export interface ScanHistoryEntry {
  id: string;
  startedAt: string;
  completedAt: string;
  status: 'COMPLETED' | 'FAILED';
  duration: number;
  result?: ScanResult;
}

export const MOCK_SCAN_HISTORY: ScanHistoryEntry[] = [
  { id: 's-1', startedAt: '2026-02-05T14:20:00Z', completedAt: '2026-02-05T14:22:30Z', status: 'COMPLETED', duration: 150, result: MOCK_SCAN_RESULT },
  { id: 's-2', startedAt: '2026-02-03T09:10:00Z', completedAt: '2026-02-03T09:11:45Z', status: 'COMPLETED', duration: 105, result: { totalFound: 10, newFound: 0, updated: 2, removed: 1, byResourceType: [{ resourceType: 'RDS', count: 5 }, { resourceType: 'DynamoDB', count: 3 }, { resourceType: 'Redshift', count: 2 }] } },
  { id: 's-3', startedAt: '2026-01-30T16:00:00Z', completedAt: '2026-01-30T16:01:00Z', status: 'FAILED', duration: 60 },
];

// ─── Resources (12개) ────────────────────────────────────────────
export interface MockResource {
  id: string;
  resourceId: string;
  databaseType: string;
  connectionStatus: 'CONNECTED' | 'DISCONNECTED' | 'PENDING';
  isSelected: boolean;
  awsType: string;
  region: string;
  lifecycleStatus: string;
  selectedCredentialId?: string;
  isNew?: boolean;
}

export const MOCK_RESOURCES: MockResource[] = [
  { id: 'res-1', resourceId: 'rds-prod-001', databaseType: 'MYSQL', connectionStatus: 'CONNECTED', isSelected: true, awsType: 'RDS', region: 'ap-northeast-2', lifecycleStatus: 'ACTIVE', selectedCredentialId: 'cred-1' },
  { id: 'res-2', resourceId: 'rds-analytics-002', databaseType: 'POSTGRESQL', connectionStatus: 'DISCONNECTED', isSelected: true, awsType: 'RDS', region: 'ap-northeast-2', lifecycleStatus: 'READY_TO_TEST', selectedCredentialId: 'cred-2' },
  { id: 'res-3', resourceId: 'rds-staging-003', databaseType: 'MYSQL', connectionStatus: 'CONNECTED', isSelected: true, awsType: 'RDS', region: 'ap-northeast-1', lifecycleStatus: 'ACTIVE', selectedCredentialId: 'cred-1' },
  { id: 'res-4', resourceId: 'rds-backup-004', databaseType: 'MYSQL', connectionStatus: 'PENDING', isSelected: false, awsType: 'RDS', region: 'ap-northeast-2', lifecycleStatus: 'DISCOVERED', isNew: true },
  { id: 'res-5', resourceId: 'rds-archive-005', databaseType: 'POSTGRESQL', connectionStatus: 'PENDING', isSelected: false, awsType: 'RDS', region: 'us-east-1', lifecycleStatus: 'DISCOVERED', isNew: true },
  { id: 'res-6', resourceId: 'ddb-events-001', databaseType: 'DYNAMODB', connectionStatus: 'CONNECTED', isSelected: true, awsType: 'DYNAMODB', region: 'ap-northeast-2', lifecycleStatus: 'ACTIVE' },
  { id: 'res-7', resourceId: 'ddb-logs-002', databaseType: 'DYNAMODB', connectionStatus: 'CONNECTED', isSelected: true, awsType: 'DYNAMODB', region: 'ap-northeast-2', lifecycleStatus: 'ACTIVE' },
  { id: 'res-8', resourceId: 'ddb-sessions-003', databaseType: 'DYNAMODB', connectionStatus: 'PENDING', isSelected: false, awsType: 'DYNAMODB', region: 'ap-northeast-2', lifecycleStatus: 'DISCOVERED', isNew: true },
  { id: 'res-9', resourceId: 'rs-dw-001', databaseType: 'REDSHIFT', connectionStatus: 'CONNECTED', isSelected: true, awsType: 'REDSHIFT', region: 'ap-northeast-2', lifecycleStatus: 'ACTIVE', selectedCredentialId: 'cred-3' },
  { id: 'res-10', resourceId: 'rs-analytics-002', databaseType: 'REDSHIFT', connectionStatus: 'CONNECTED', isSelected: true, awsType: 'REDSHIFT', region: 'ap-northeast-2', lifecycleStatus: 'ACTIVE', selectedCredentialId: 'cred-3' },
  { id: 'res-11', resourceId: 'ath-logs-001', databaseType: 'ATHENA', connectionStatus: 'PENDING', isSelected: false, awsType: 'ATHENA', region: 'us-east-1', lifecycleStatus: 'DISCOVERED' },
  { id: 'res-12', resourceId: 'ec2-app-001', databaseType: 'MYSQL', connectionStatus: 'CONNECTED', isSelected: true, awsType: 'EC2', region: 'ap-northeast-2', lifecycleStatus: 'ACTIVE', selectedCredentialId: 'cred-1' },
];

export const MOCK_CREDENTIALS = [
  { id: 'cred-1', name: '운영DB-MySQL', databaseType: 'MYSQL' },
  { id: 'cred-2', name: '분석DB-PostgreSQL', databaseType: 'POSTGRESQL' },
  { id: 'cred-3', name: 'DW-Redshift', databaseType: 'REDSHIFT' },
] as const;

// ─── Helpers ─────────────────────────────────────────────────────
export const REGION_MAP: Record<string, string> = {
  'ap-northeast-2': '서울',
  'ap-northeast-1': '도쿄',
  'us-east-1': '버지니아',
  'us-west-2': '오레곤',
};

export const AWS_TYPE_META: Record<string, { label: string; icon: string; color: string }> = {
  RDS: { label: 'Amazon RDS', icon: '🗄️', color: '#0078D4' },
  RDS_CLUSTER: { label: 'RDS Cluster', icon: '🔗', color: '#6366F1' },
  DYNAMODB: { label: 'DynamoDB', icon: '⚡', color: '#E97400' },
  ATHENA: { label: 'Athena', icon: '🔍', color: '#8B5CF6' },
  REDSHIFT: { label: 'Redshift', icon: '📊', color: '#BC2F32' },
  EC2: { label: 'EC2 (VM)', icon: '🖥️', color: '#107C10' },
};

export const CONN_STATUS: Record<string, { text: string; color: string; bgColor: string }> = {
  CONNECTED: { text: '연결됨', color: F.success, bgColor: F.successBg },
  DISCONNECTED: { text: '끊김', color: F.error, bgColor: F.errorBg },
  PENDING: { text: '대기', color: F.fg4, bgColor: F.bg3 },
};

export const NEEDS_CREDENTIAL: Record<string, boolean> = {
  MYSQL: true,
  POSTGRESQL: true,
  REDSHIFT: true,
  DYNAMODB: false,
  ATHENA: false,
};
