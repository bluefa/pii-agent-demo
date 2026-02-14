/**
 * Project Detail Mockup - Dummy Data
 *
 * 목업 전용 정적 데이터. 기존 mock-data.ts 값 기반.
 * server module(mock-store) 의존 없이 client component에서 안전하게 사용.
 */

// ─── Process Steps (legacy, for backward compat) ────────────────
export const PROCESS_STEPS = [
  { step: 1, label: '연동 대상 확정 대기', done: true, current: false },
  { step: 2, label: '승인 대기', done: true, current: false },
  { step: 3, label: '설치 진행 중', done: true, current: false },
  { step: 4, label: '연결 테스트 필요', done: false, current: true },
  { step: 5, label: '연결 확인 완료', done: false, current: false },
  { step: 6, label: '설치 완료', done: false, current: false },
] as const;

// ─── Process Graph (node-edge) ──────────────────────────────────
export type ProcessNodeStatus = 'done' | 'current' | 'pending';

export interface ProcessNode {
  id: string;
  label: string;
  status: ProcessNodeStatus;
}

export interface ProcessEdge {
  from: string;
  to: string;
  type: 'forward' | 'reconnect';
  label?: string;
}

export const PROCESS_NODES: ProcessNode[] = [
  { id: 'target', label: '연동 대상 확정', status: 'done' },
  { id: 'approval', label: '승인 대기', status: 'done' },
  { id: 'install', label: '설치', status: 'done' },
  { id: 'test', label: '연결 테스트', status: 'current' },
  { id: 'verified', label: '연결 확인', status: 'pending' },
  { id: 'complete', label: '설치 완료', status: 'pending' },
];

export const PROCESS_EDGES: ProcessEdge[] = [
  { from: 'target', to: 'approval', type: 'forward' },
  { from: 'approval', to: 'install', type: 'forward' },
  { from: 'install', to: 'test', type: 'forward' },
  { from: 'test', to: 'verified', type: 'forward' },
  { from: 'verified', to: 'complete', type: 'forward' },
  { from: 'complete', to: 'test', type: 'reconnect', label: '재연동' },
];

// ─── Project (based on proj-5, AWS WAITING_CONNECTION_TEST) ──────
export const MOCK_PROJECT = {
  id: 'proj-5',
  projectCode: 'DATA-005',
  name: 'PII Agent 설치 - 데이터 마트',
  description: '설치가 완료되어 연결 테스트가 필요합니다. 끊김/신규 리소스도 함께 표시합니다.',
  serviceCode: 'SERVICE-A',
  cloudProvider: 'AWS' as const,
  awsInstallationMode: 'AUTO' as const,
  processStatus: 4,
  status: {
    scan: { status: 'COMPLETED' as const, lastCompletedAt: '2026-01-28T09:30:00Z' },
    targets: { confirmed: true, selectedCount: 4, excludedCount: 1 },
    approval: { status: 'APPROVED' as const, approvedAt: '2026-01-25T14:00:00Z' },
    installation: { status: 'COMPLETED' as const, completedAt: '2026-01-28T10:00:00Z' },
    connectionTest: { status: 'NOT_TESTED' as const },
  },
  terraformState: {
    serviceTf: 'COMPLETED' as const,
    bdcTf: 'COMPLETED' as const,
  },
  createdAt: '2026-01-15T09:00:00Z',
  updatedAt: '2026-02-01T14:30:00Z',
  isRejected: false,
} as const;

// ─── Resources (5개, 다양한 상태) ────────────────────────────────
interface MockResource {
  id: string;
  type: string;
  resourceId: string;
  databaseType: string;
  connectionStatus: string;
  isSelected: boolean;
  awsType: string;
  region: string;
  lifecycleStatus: string;
  selectedCredentialId?: string;
  note?: string;
  isNew?: boolean;
}

export const MOCK_RESOURCES: MockResource[] = [
  { id: 'res-1', type: 'RDS', resourceId: 'rds-prod-001', databaseType: 'MYSQL', connectionStatus: 'CONNECTED', isSelected: true, awsType: 'RDS', region: 'ap-northeast-2', lifecycleStatus: 'ACTIVE', selectedCredentialId: 'cred-1' },
  { id: 'res-2', type: 'RDS', resourceId: 'rds-analytics-002', databaseType: 'POSTGRESQL', connectionStatus: 'DISCONNECTED', isSelected: true, awsType: 'RDS', region: 'ap-northeast-2', lifecycleStatus: 'READY_TO_TEST', note: '끊김', selectedCredentialId: 'cred-2' },
  { id: 'res-3', type: 'DYNAMODB', resourceId: 'ddb-events-001', databaseType: 'DYNAMODB', connectionStatus: 'CONNECTED', isSelected: true, awsType: 'DYNAMODB', region: 'ap-northeast-2', lifecycleStatus: 'ACTIVE' },
  { id: 'res-4', type: 'ATHENA', resourceId: 'ath-logs-001', databaseType: 'ATHENA', connectionStatus: 'PENDING', isSelected: false, awsType: 'ATHENA', region: 'us-east-1', lifecycleStatus: 'DISCOVERED', isNew: true },
  { id: 'res-5', type: 'REDSHIFT', resourceId: 'rs-dw-001', databaseType: 'REDSHIFT', connectionStatus: 'CONNECTED', isSelected: true, awsType: 'REDSHIFT', region: 'ap-northeast-2', lifecycleStatus: 'ACTIVE', selectedCredentialId: 'cred-3' },
];

// ─── Credentials (based on mockCredentials) ──────────────────────
export const MOCK_CREDENTIALS = [
  { id: 'cred-1', name: '운영DB-MySQL', databaseType: 'MYSQL', host: 'prod-mysql.example.com', port: 3306, username: 'pii_agent' },
  { id: 'cred-2', name: '분석DB-PostgreSQL', databaseType: 'POSTGRESQL', host: 'analytics-pg.example.com', port: 5432, username: 'analyst' },
  { id: 'cred-3', name: 'DW-Redshift', databaseType: 'REDSHIFT', host: 'dw-cluster.example.com', port: 5439, username: 'dw_reader' },
] as const;

// ─── Connection Test History ─────────────────────────────────────
interface MockTestResult {
  resourceId: string;
  resourceType: string;
  databaseType: string;
  success: boolean;
  error?: { type: string; message: string };
}

interface MockTestHistory {
  id: string;
  executedAt: string;
  status: string;
  successCount: number;
  failCount: number;
  results: MockTestResult[];
}

export const MOCK_TEST_HISTORY: MockTestHistory[] = [
  {
    id: 'test-1',
    executedAt: '2026-01-30T10:00:00Z',
    status: 'FAIL',
    successCount: 3,
    failCount: 1,
    results: [
      { resourceId: 'res-1', resourceType: 'RDS', databaseType: 'MYSQL', success: true },
      { resourceId: 'res-2', resourceType: 'RDS', databaseType: 'POSTGRESQL', success: false, error: { type: 'NETWORK_ERROR', message: '네트워크 연결에 실패했습니다. 방화벽 설정을 확인하세요.' } },
      { resourceId: 'res-3', resourceType: 'DYNAMODB', databaseType: 'DYNAMODB', success: true },
      { resourceId: 'res-5', resourceType: 'REDSHIFT', databaseType: 'REDSHIFT', success: true },
    ],
  },
];

// ─── Project History (진행 내역) ─────────────────────────────────
interface MockHistoryEntry {
  id: string;
  type: string;
  actor: string;
  timestamp: string;
  detail: string;
}

export const MOCK_HISTORY: MockHistoryEntry[] = [
  { id: 'h-1', type: 'TARGET_CONFIRMED', actor: '홍길동', timestamp: '2026-01-20T10:00:00Z', detail: '리소스 4건 선택, 1건 제외' },
  { id: 'h-2', type: 'APPROVAL', actor: '관리자', timestamp: '2026-01-25T14:00:00Z', detail: '승인 완료' },
  { id: 'h-3', type: 'TARGET_CONFIRMED', actor: '시스템', timestamp: '2026-01-28T10:00:00Z', detail: 'Terraform 설치 완료 (Service TF + BDC TF)' },
];

// ─── Region Labels ───────────────────────────────────────────────
export const REGION_MAP: Record<string, string> = {
  'ap-northeast-2': '서울',
  'ap-northeast-1': '도쿄',
  'us-east-1': '버지니아',
  'us-west-2': '오레곤',
};

// ─── Connection Status Labels ────────────────────────────────────
export const CONNECTION_LABEL: Record<string, { text: string; color: string }> = {
  CONNECTED: { text: '연결됨', color: 'green' },
  DISCONNECTED: { text: '연결 끊김', color: 'red' },
  PENDING: { text: '대기중', color: 'gray' },
};
