/**
 * Resource & Scan Mockup - Dummy Data
 *
 * 목업 전용 정적 데이터. 기존 mock-data.ts 값 기반.
 * server module(mock-store) 의존 없이 client component에서 안전하게 사용.
 */

// ─── Scan Status ─────────────────────────────────────────────────
export type ScanUIState = 'IDLE' | 'IN_PROGRESS' | 'COMPLETED' | 'COOLDOWN' | 'FAILED';

export interface ScanResult {
  totalFound: number;
  newFound: number;
  updated: number;
  removed: number;
  byResourceType: Array<{ resourceType: string; count: number }>;
}

export interface ScanHistoryEntry {
  id: string;
  startedAt: string;
  completedAt: string;
  status: 'COMPLETED' | 'FAILED';
  duration: number;
  result?: ScanResult;
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

export const MOCK_SCAN_HISTORY: ScanHistoryEntry[] = [
  { id: 's-1', startedAt: '2026-02-05T14:20:00Z', completedAt: '2026-02-05T14:22:30Z', status: 'COMPLETED', duration: 150, result: MOCK_SCAN_RESULT },
  { id: 's-2', startedAt: '2026-02-03T09:10:00Z', completedAt: '2026-02-03T09:11:45Z', status: 'COMPLETED', duration: 105, result: { totalFound: 10, newFound: 0, updated: 2, removed: 1, byResourceType: [{ resourceType: 'RDS', count: 5 }, { resourceType: 'DynamoDB', count: 3 }, { resourceType: 'Redshift', count: 2 }] } },
  { id: 's-3', startedAt: '2026-01-30T16:00:00Z', completedAt: '2026-01-30T16:01:00Z', status: 'FAILED', duration: 60 },
  { id: 's-4', startedAt: '2026-01-28T10:00:00Z', completedAt: '2026-01-28T10:03:00Z', status: 'COMPLETED', duration: 180, result: { totalFound: 9, newFound: 2, updated: 0, removed: 0, byResourceType: [{ resourceType: 'RDS', count: 4 }, { resourceType: 'DynamoDB', count: 3 }, { resourceType: 'Redshift', count: 2 }] } },
];

// ─── Resources (12개, 다양한 상태) ────────────────────────────────
export interface MockResource {
  id: string;
  type: string;
  resourceId: string;
  databaseType: string;
  connectionStatus: 'CONNECTED' | 'DISCONNECTED' | 'PENDING';
  isSelected: boolean;
  awsType: string;
  region: string;
  lifecycleStatus: string;
  selectedCredentialId?: string;
  note?: string;
  isNew?: boolean;
  exclusion?: { reason: string; excludedAt: string; excludedBy: string };
}

export const MOCK_RESOURCES: MockResource[] = [
  { id: 'res-1', type: 'RDS', resourceId: 'rds-prod-001', databaseType: 'MYSQL', connectionStatus: 'CONNECTED', isSelected: true, awsType: 'RDS', region: 'ap-northeast-2', lifecycleStatus: 'ACTIVE', selectedCredentialId: 'cred-1' },
  { id: 'res-2', type: 'RDS', resourceId: 'rds-analytics-002', databaseType: 'POSTGRESQL', connectionStatus: 'DISCONNECTED', isSelected: true, awsType: 'RDS', region: 'ap-northeast-2', lifecycleStatus: 'READY_TO_TEST', note: '끊김', selectedCredentialId: 'cred-2' },
  { id: 'res-3', type: 'RDS', resourceId: 'rds-staging-003', databaseType: 'MYSQL', connectionStatus: 'CONNECTED', isSelected: true, awsType: 'RDS', region: 'ap-northeast-1', lifecycleStatus: 'ACTIVE', selectedCredentialId: 'cred-1' },
  { id: 'res-4', type: 'RDS', resourceId: 'rds-backup-004', databaseType: 'MYSQL', connectionStatus: 'PENDING', isSelected: false, awsType: 'RDS', region: 'ap-northeast-2', lifecycleStatus: 'DISCOVERED', isNew: true },
  { id: 'res-5', type: 'RDS', resourceId: 'rds-archive-005', databaseType: 'POSTGRESQL', connectionStatus: 'PENDING', isSelected: false, awsType: 'RDS', region: 'us-east-1', lifecycleStatus: 'DISCOVERED', isNew: true },
  { id: 'res-6', type: 'DYNAMODB', resourceId: 'ddb-events-001', databaseType: 'DYNAMODB', connectionStatus: 'CONNECTED', isSelected: true, awsType: 'DYNAMODB', region: 'ap-northeast-2', lifecycleStatus: 'ACTIVE' },
  { id: 'res-7', type: 'DYNAMODB', resourceId: 'ddb-logs-002', databaseType: 'DYNAMODB', connectionStatus: 'CONNECTED', isSelected: true, awsType: 'DYNAMODB', region: 'ap-northeast-2', lifecycleStatus: 'ACTIVE' },
  { id: 'res-8', type: 'DYNAMODB', resourceId: 'ddb-sessions-003', databaseType: 'DYNAMODB', connectionStatus: 'PENDING', isSelected: false, awsType: 'DYNAMODB', region: 'ap-northeast-2', lifecycleStatus: 'DISCOVERED', isNew: true },
  { id: 'res-9', type: 'REDSHIFT', resourceId: 'rs-dw-001', databaseType: 'REDSHIFT', connectionStatus: 'CONNECTED', isSelected: true, awsType: 'REDSHIFT', region: 'ap-northeast-2', lifecycleStatus: 'ACTIVE', selectedCredentialId: 'cred-3' },
  { id: 'res-10', type: 'REDSHIFT', resourceId: 'rs-analytics-002', databaseType: 'REDSHIFT', connectionStatus: 'CONNECTED', isSelected: true, awsType: 'REDSHIFT', region: 'ap-northeast-2', lifecycleStatus: 'ACTIVE', selectedCredentialId: 'cred-3' },
  { id: 'res-11', type: 'ATHENA', resourceId: 'ath-logs-001', databaseType: 'ATHENA', connectionStatus: 'PENDING', isSelected: false, awsType: 'ATHENA', region: 'us-east-1', lifecycleStatus: 'DISCOVERED' },
  { id: 'res-12', type: 'EC2', resourceId: 'ec2-app-001', databaseType: 'MYSQL', connectionStatus: 'CONNECTED', isSelected: true, awsType: 'EC2', region: 'ap-northeast-2', lifecycleStatus: 'ACTIVE', selectedCredentialId: 'cred-1' },
];

export const MOCK_CREDENTIALS = [
  { id: 'cred-1', name: '운영DB-MySQL', databaseType: 'MYSQL', host: 'prod-mysql.example.com', port: 3306, username: 'pii_agent' },
  { id: 'cred-2', name: '분석DB-PostgreSQL', databaseType: 'POSTGRESQL', host: 'analytics-pg.example.com', port: 5432, username: 'analyst' },
  { id: 'cred-3', name: 'DW-Redshift', databaseType: 'REDSHIFT', host: 'dw-cluster.example.com', port: 5439, username: 'dw_reader' },
] as const;

// ─── Region Labels ───────────────────────────────────────────────
export const REGION_MAP: Record<string, string> = {
  'ap-northeast-2': '서울',
  'ap-northeast-1': '도쿄',
  'us-east-1': '버지니아',
  'us-west-2': '오레곤',
};

// ─── AWS Resource Type Info ──────────────────────────────────────
export const AWS_TYPE_INFO: Record<string, { label: string; icon: string; color: string }> = {
  RDS: { label: 'Amazon RDS', icon: '🗄️', color: '#3B82F6' },
  RDS_CLUSTER: { label: 'RDS Cluster', icon: '🔗', color: '#6366F1' },
  DYNAMODB: { label: 'DynamoDB', icon: '⚡', color: '#F59E0B' },
  ATHENA: { label: 'Athena', icon: '🔍', color: '#8B5CF6' },
  REDSHIFT: { label: 'Redshift', icon: '📊', color: '#EF4444' },
  EC2: { label: 'EC2 (VM)', icon: '🖥️', color: '#10B981' },
};

// ─── Connection Labels ───────────────────────────────────────────
export const CONNECTION_LABEL: Record<string, { text: string; color: string }> = {
  CONNECTED: { text: '연결됨', color: '#16a34a' },
  DISCONNECTED: { text: '끊김', color: '#dc2626' },
  PENDING: { text: '대기', color: '#9ca3af' },
};
