import { getProjectByTargetSourceId } from '@/lib/mock-data';
import type { Project } from '@/lib/types';
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
import { SDU_ERROR_CODES } from '@/lib/constants/sdu';

// ===== 내부 상태 저장소 (개발용) =====

interface SduStore {
  installationStatus: Record<number, SduInstallationStatus>;
  s3Upload: Record<number, S3UploadInfo>;
  iamUsers: Record<number, IamUser>;
  sourceIps: Record<number, SourceIpManagement>;
  athenaTables: Record<number, SduAthenaTable[]>;
  connectionTest: Record<number, SduConnectionTestInfo>;
}

const sduStore: SduStore = {
  installationStatus: {},
  s3Upload: {},
  iamUsers: {},
  sourceIps: {},
  athenaTables: {},
  connectionTest: {},
};

// ===== 헬퍼 함수 =====

const isSduProject = (project: Project): boolean => {
  return project.cloudProvider === 'SDU';
};

// slice(-8) 입력은 원본 project.id 문자열 유지 — W0 lock-in 값 보존 (기존: 'sdu-user--sdu-001', 'sdu-user-u-proj-1' 등)
const generateIamUser = (projectIdString: string): IamUser => {
  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setFullYear(expiresAt.getFullYear() + 1); // +1년

  return {
    userName: `sdu-user-${projectIdString.slice(-8)}`,
    akSkIssuedAt: now.toISOString(),
    akSkIssuedBy: 'admin@example.com',
    akSkExpiresAt: expiresAt.toISOString(),
  };
};

const generateDefaultSourceIps = (): SourceIpEntry[] => {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  return [
    {
      cidr: '10.0.1.0/24',
      status: 'CONFIRMED',
      registeredBy: 'admin@example.com',
      registeredAt: yesterday.toISOString(),
      confirmedBy: 'bdc-admin@example.com',
      confirmedAt: now.toISOString(),
    },
    {
      cidr: '192.168.1.0/24',
      status: 'PENDING',
      registeredBy: 'admin@example.com',
      registeredAt: now.toISOString(),
    },
  ];
};

const generateAthenaTables = (projectIdString: string): SduAthenaTable[] => {
  const database = `sdu_db_${projectIdString.slice(-8)}`;
  return [
    {
      tableName: 'pii_users',
      database,
      s3Location: `s3://sdu-data-${projectIdString.slice(-8)}/pii_users/`,
    },
    {
      tableName: 'pii_transactions',
      database,
      s3Location: `s3://sdu-data-${projectIdString.slice(-8)}/pii_transactions/`,
    },
  ];
};

// ===== API 함수 =====

/**
 * SDU 설치 상태 조회
 */
export const getSduInstallationStatus = (
  targetSourceId: number
): { data?: SduInstallationStatus; error?: { code: string; message: string; status: number } } => {
  const project = getProjectByTargetSourceId(targetSourceId);

  if (!project) {
    return { error: SDU_ERROR_CODES.NOT_FOUND };
  }

  if (!isSduProject(project)) {
    return { error: SDU_ERROR_CODES.NOT_SDU_PROJECT };
  }

  // 캐시된 상태가 있으면 반환
  if (sduStore.installationStatus[targetSourceId]) {
    return { data: sduStore.installationStatus[targetSourceId] };
  }

  // 초기 설치 상태 생성 — database 이름은 project.id slice 기반으로 W0 lock-in 보존
  const result: SduInstallationStatus = {
    provider: 'SDU',
    crawler: {
      configured: false,
      lastRunStatus: 'NONE',
    },
    athenaTable: {
      status: 'PENDING',
      tableCount: 0,
      database: `sdu_db_${project.id.slice(-8)}`,
    },
    targetConfirmed: false,
    athenaSetup: {
      status: 'PENDING',
    },
    lastCheckedAt: new Date().toISOString(),
  };

  sduStore.installationStatus[targetSourceId] = result;
  return { data: result };
};

/**
 * SDU 설치 상태 새로고침 (상태를 한 단계씩 진행시키는 시뮬레이션)
 */
export const checkSduInstallation = (
  targetSourceId: number
): { data?: SduInstallationStatus; error?: { code: string; message: string; status: number } } => {
  const project = getProjectByTargetSourceId(targetSourceId);

  if (!project) {
    return { error: SDU_ERROR_CODES.NOT_FOUND };
  }

  if (!isSduProject(project)) {
    return { error: SDU_ERROR_CODES.NOT_SDU_PROJECT };
  }

  // 현재 상태 조회
  const currentResult = getSduInstallationStatus(targetSourceId);
  if (currentResult.error || !currentResult.data) {
    return currentResult;
  }

  const status = currentResult.data;

  // 상태 진행 시뮬레이션
  // 1. Crawler 구성 (30% 확률)
  if (!status.crawler.configured && Math.random() < 0.3) {
    status.crawler.configured = true;
    status.crawler.lastRunStatus = 'SUCCESS';
    status.crawler.lastRunAt = new Date().toISOString();
  }

  // 2. Athena Table 생성 (Crawler 구성 완료 후, 40% 확률)
  if (status.crawler.configured && status.athenaTable.status === 'PENDING' && Math.random() < 0.4) {
    status.athenaTable.status = 'CREATED';
    status.athenaTable.tableCount = 2;
  }

  // 3. Athena Setup 진행 (Table 생성 완료 후)
  if (status.athenaTable.status === 'CREATED') {
    if (status.athenaSetup.status === 'PENDING' && Math.random() < 0.4) {
      status.athenaSetup.status = 'IN_PROGRESS';
    } else if (status.athenaSetup.status === 'IN_PROGRESS' && Math.random() < 0.3) {
      status.athenaSetup.status = 'COMPLETED';
    }
  }

  status.lastCheckedAt = new Date().toISOString();
  sduStore.installationStatus[targetSourceId] = status;

  return { data: status };
};

/**
 * S3 업로드 상태 조회
 */
export const getS3UploadStatus = (
  targetSourceId: number
): { data?: S3UploadInfo; error?: { code: string; message: string; status: number } } => {
  const project = getProjectByTargetSourceId(targetSourceId);

  if (!project) {
    return { error: SDU_ERROR_CODES.NOT_FOUND };
  }

  if (!isSduProject(project)) {
    return { error: SDU_ERROR_CODES.NOT_SDU_PROJECT };
  }

  // 캐시된 상태가 있으면 반환
  if (sduStore.s3Upload[targetSourceId]) {
    return { data: sduStore.s3Upload[targetSourceId] };
  }

  // 초기 상태: PENDING
  const result: S3UploadInfo = {
    status: 'PENDING',
  };

  sduStore.s3Upload[targetSourceId] = result;
  return { data: result };
};

/**
 * S3 업로드 상태 진단 (시스템이 S3 버킷을 확인하여 업로드 여부를 판별)
 */
export const checkS3Upload = (
  targetSourceId: number
): { data?: S3UploadInfo; error?: { code: string; message: string; status: number } } => {
  const project = getProjectByTargetSourceId(targetSourceId);

  if (!project) {
    return { error: SDU_ERROR_CODES.NOT_FOUND };
  }

  if (!isSduProject(project)) {
    return { error: SDU_ERROR_CODES.NOT_SDU_PROJECT };
  }

  const currentResult = getS3UploadStatus(targetSourceId);
  if (currentResult.error || !currentResult.data) {
    return { error: currentResult.error || SDU_ERROR_CODES.VALIDATION_FAILED };
  }

  // 이미 CONFIRMED면 그대로 반환
  if (currentResult.data.status === 'CONFIRMED') {
    return { data: currentResult.data };
  }

  // 시뮬레이션: 40% 확률로 S3 업로드 감지
  if (Math.random() < 0.4) {
    const now = new Date().toISOString();
    sduStore.s3Upload[targetSourceId] = {
      status: 'CONFIRMED',
      confirmedAt: now,
    };
    return { data: sduStore.s3Upload[targetSourceId] };
  }

  return { data: currentResult.data };
};

/**
 * IAM USER 조회
 */
export const getIamUser = (
  targetSourceId: number
): { data?: IamUser; error?: { code: string; message: string; status: number } } => {
  const project = getProjectByTargetSourceId(targetSourceId);

  if (!project) {
    return { error: SDU_ERROR_CODES.NOT_FOUND };
  }

  if (!isSduProject(project)) {
    return { error: SDU_ERROR_CODES.NOT_SDU_PROJECT };
  }

  // 캐시된 IAM USER가 있으면 반환
  if (sduStore.iamUsers[targetSourceId]) {
    return { data: sduStore.iamUsers[targetSourceId] };
  }

  // 초기 IAM USER 생성
  const user = generateIamUser(project.id);
  sduStore.iamUsers[targetSourceId] = user;

  return { data: user };
};

/**
 * AK/SK 재발급
 */
export const issueAkSk = (
  targetSourceId: number,
  issuedBy: string
): { data?: IssueAkSkResponse; error?: { code: string; message: string; status: number } } => {
  const project = getProjectByTargetSourceId(targetSourceId);

  if (!project) {
    return { error: SDU_ERROR_CODES.NOT_FOUND };
  }

  if (!isSduProject(project)) {
    return { error: SDU_ERROR_CODES.NOT_SDU_PROJECT };
  }

  // 현재 IAM USER 조회
  const userResult = getIamUser(targetSourceId);
  if (userResult.error || !userResult.data) {
    return { error: userResult.error || SDU_ERROR_CODES.IAM_USER_NOT_FOUND };
  }

  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setFullYear(expiresAt.getFullYear() + 1);

  // IAM USER 업데이트
  sduStore.iamUsers[targetSourceId] = {
    ...userResult.data,
    akSkIssuedAt: now.toISOString(),
    akSkIssuedBy: issuedBy,
    akSkExpiresAt: expiresAt.toISOString(),
  };

  return {
    data: {
      success: true,
      accessKey: `AKIA${Math.random().toString(36).substring(2, 18).toUpperCase()}`,
      secretKey: `${Math.random().toString(36).substring(2)}${Math.random().toString(36).substring(2)}`.substring(0, 40),
      issuedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    },
  };
};

/**
 * SourceIP 목록 조회
 */
export const getSourceIpList = (
  targetSourceId: number
): { data?: SourceIpManagement; error?: { code: string; message: string; status: number } } => {
  const project = getProjectByTargetSourceId(targetSourceId);

  if (!project) {
    return { error: SDU_ERROR_CODES.NOT_FOUND };
  }

  if (!isSduProject(project)) {
    return { error: SDU_ERROR_CODES.NOT_SDU_PROJECT };
  }

  // 캐시된 SourceIP가 있으면 반환
  if (sduStore.sourceIps[targetSourceId]) {
    return { data: sduStore.sourceIps[targetSourceId] };
  }

  // 초기 SourceIP 생성
  const sourceIps: SourceIpManagement = {
    entries: generateDefaultSourceIps(),
  };

  sduStore.sourceIps[targetSourceId] = sourceIps;
  return { data: sourceIps };
};

/**
 * SourceIP 등록
 */
export const registerSourceIp = (
  targetSourceId: number,
  cidr: string,
  registeredBy: string
): { data?: SourceIpEntry; error?: { code: string; message: string; status: number } } => {
  const project = getProjectByTargetSourceId(targetSourceId);

  if (!project) {
    return { error: SDU_ERROR_CODES.NOT_FOUND };
  }

  if (!isSduProject(project)) {
    return { error: SDU_ERROR_CODES.NOT_SDU_PROJECT };
  }

  // 현재 SourceIP 목록 가져오기
  const currentResult = getSourceIpList(targetSourceId);
  if (currentResult.error || !currentResult.data) {
    return { error: currentResult.error || SDU_ERROR_CODES.VALIDATION_FAILED };
  }

  const newEntry: SourceIpEntry = {
    cidr,
    status: 'PENDING',
    registeredBy,
    registeredAt: new Date().toISOString(),
  };

  // 엔트리 추가
  sduStore.sourceIps[targetSourceId] = {
    entries: [...currentResult.data.entries, newEntry],
  };

  return { data: newEntry };
};

/**
 * SourceIP 확인 (BDC)
 */
export const confirmSourceIp = (
  targetSourceId: number,
  cidr: string,
  confirmedBy: string
): { data?: SourceIpEntry; error?: { code: string; message: string; status: number } } => {
  const project = getProjectByTargetSourceId(targetSourceId);

  if (!project) {
    return { error: SDU_ERROR_CODES.NOT_FOUND };
  }

  if (!isSduProject(project)) {
    return { error: SDU_ERROR_CODES.NOT_SDU_PROJECT };
  }

  // 현재 SourceIP 목록 가져오기
  const currentResult = getSourceIpList(targetSourceId);
  if (currentResult.error || !currentResult.data) {
    return { error: currentResult.error || SDU_ERROR_CODES.VALIDATION_FAILED };
  }

  const entryIndex = currentResult.data.entries.findIndex((e) => e.cidr === cidr);
  if (entryIndex === -1) {
    return { error: SDU_ERROR_CODES.SOURCE_IP_NOT_REGISTERED };
  }

  const now = new Date().toISOString();
  const updatedEntry: SourceIpEntry = {
    ...currentResult.data.entries[entryIndex],
    status: 'CONFIRMED',
    confirmedBy,
    confirmedAt: now,
  };

  // 엔트리 업데이트
  const updatedEntries = [...currentResult.data.entries];
  updatedEntries[entryIndex] = updatedEntry;

  sduStore.sourceIps[targetSourceId] = {
    entries: updatedEntries,
  };

  return { data: updatedEntry };
};

/**
 * Athena Table 목록 조회
 */
export const getAthenaTables = (
  targetSourceId: number
): { data?: SduAthenaTable[]; error?: { code: string; message: string; status: number } } => {
  const project = getProjectByTargetSourceId(targetSourceId);

  if (!project) {
    return { error: SDU_ERROR_CODES.NOT_FOUND };
  }

  if (!isSduProject(project)) {
    return { error: SDU_ERROR_CODES.NOT_SDU_PROJECT };
  }

  // 캐시된 테이블 목록이 있으면 반환
  if (sduStore.athenaTables[targetSourceId]) {
    return { data: sduStore.athenaTables[targetSourceId] };
  }

  // 초기 테이블 목록 생성 — table 이름은 project.id slice 기반 (W0 lock-in 보존)
  const tables = generateAthenaTables(project.id);
  sduStore.athenaTables[targetSourceId] = tables;

  return { data: tables };
};

/**
 * SDU 서비스 설정 조회
 */
export const getSduServiceSettings = (
  serviceCode: string
): { data?: SduServiceSettings; error?: { code: string; message: string; status: number } } => {
  // 서비스 코드 해시 기반 시뮬레이션
  const hash = serviceCode.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);

  // 50% 확률로 IAM USER 존재
  const hasIamUser = hash % 2 === 0;

  const settings: SduServiceSettings = {
    iamUser: hasIamUser
      ? {
          userName: `sdu-service-${serviceCode.slice(-4)}`,
          akSkIssuedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30일 전
          akSkIssuedBy: 'admin@example.com',
          akSkExpiresAt: new Date(Date.now() + 335 * 24 * 60 * 60 * 1000).toISOString(), // 335일 후
        }
      : undefined,
    sourceIp: {
      entries: [],
    },
    guide: {
      description: 'SDU 연동을 위한 환경 설정이 필요합니다.',
      documentUrl: 'https://docs.example.com/sdu/environment-setup',
    },
  };

  return { data: settings };
};

/**
 * SDU 연결 테스트 상태 조회
 */
export const getSduConnectionTest = (
  targetSourceId: number
): { data?: SduConnectionTestInfo; error?: { code: string; message: string; status: number } } => {
  const project = getProjectByTargetSourceId(targetSourceId);

  if (!project) {
    return { error: SDU_ERROR_CODES.NOT_FOUND };
  }

  if (!isSduProject(project)) {
    return { error: SDU_ERROR_CODES.NOT_SDU_PROJECT };
  }

  // 캐시된 상태가 있으면 반환
  if (sduStore.connectionTest[targetSourceId]) {
    return { data: sduStore.connectionTest[targetSourceId] };
  }

  // 초기 상태: NOT_TESTED
  const result: SduConnectionTestInfo = {
    status: 'NOT_TESTED',
  };

  sduStore.connectionTest[targetSourceId] = result;
  return { data: result };
};

/**
 * SDU 연결 테스트 실행
 */
export const executeSduConnectionTest = (
  targetSourceId: number
): { data?: SduConnectionTestInfo; error?: { code: string; message: string; status: number } } => {
  const project = getProjectByTargetSourceId(targetSourceId);

  if (!project) {
    return { error: SDU_ERROR_CODES.NOT_FOUND };
  }

  if (!isSduProject(project)) {
    return { error: SDU_ERROR_CODES.NOT_SDU_PROJECT };
  }

  // 시뮬레이션: 80% 확률로 성공
  const passed = Math.random() < 0.8;

  const result: SduConnectionTestInfo = {
    status: passed ? 'PASSED' : 'FAILED',
  };

  sduStore.connectionTest[targetSourceId] = result;
  return { data: result };
};

// ===== 테스트용 유틸리티 =====

export const resetSduStore = (): void => {
  sduStore.installationStatus = {};
  sduStore.s3Upload = {};
  sduStore.iamUsers = {};
  sduStore.sourceIps = {};
  sduStore.athenaTables = {};
  sduStore.connectionTest = {};
};

export const getSduStore = (): SduStore => {
  return { ...sduStore };
};
