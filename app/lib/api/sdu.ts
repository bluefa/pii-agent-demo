import type {
  SduInstallationStatus,
  S3UploadInfo,
  IamUser,
  IssueAkSkResponse,
  SourceIpManagement,
  SourceIpEntry,
  SduAthenaTable,
  SduConnectionTestInfo,
} from '@/lib/types/sdu';

const BASE_URL = '/api/sdu';

/**
 * SDU 설치 상태 조회
 */
export const getSduInstallationStatus = async (projectId: string): Promise<SduInstallationStatus> => {
  const res = await fetch(`${BASE_URL}/projects/${projectId}/installation-status`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'SDU 설치 상태 조회에 실패했습니다.');
  }
  return await res.json();
};

/**
 * SDU 설치 상태 확인 (새로고침)
 */
export const checkSduInstallation = async (projectId: string): Promise<SduInstallationStatus> => {
  const res = await fetch(`${BASE_URL}/projects/${projectId}/check-installation`, {
    method: 'POST',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'SDU 설치 상태 확인에 실패했습니다.');
  }
  return await res.json();
};

/**
 * S3 업로드 상태 조회
 */
export const getS3UploadStatus = async (projectId: string): Promise<S3UploadInfo> => {
  const res = await fetch(`${BASE_URL}/projects/${projectId}/s3-upload`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'S3 업로드 상태 조회에 실패했습니다.');
  }
  return await res.json();
};

/**
 * S3 업로드 상태 진단 (시스템이 S3를 확인)
 */
export const checkS3Upload = async (projectId: string): Promise<S3UploadInfo> => {
  const res = await fetch(`${BASE_URL}/projects/${projectId}/s3-upload/check`, {
    method: 'POST',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'S3 업로드 상태 확인에 실패했습니다.');
  }
  return await res.json();
};

/**
 * IAM User 조회
 */
export const getIamUser = async (projectId: string): Promise<IamUser> => {
  const res = await fetch(`${BASE_URL}/projects/${projectId}/iam-user`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'IAM User 조회에 실패했습니다.');
  }
  return await res.json();
};

/**
 * AK/SK 발급
 */
export const issueAkSk = async (projectId: string, issuedBy: string): Promise<IssueAkSkResponse> => {
  const res = await fetch(`${BASE_URL}/projects/${projectId}/iam-user/issue-aksk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ issuedBy }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'AK/SK 발급에 실패했습니다.');
  }
  return await res.json();
};

/**
 * Source IP 목록 조회
 */
export const getSourceIpList = async (projectId: string): Promise<SourceIpManagement> => {
  const res = await fetch(`${BASE_URL}/projects/${projectId}/source-ip`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'Source IP 목록 조회에 실패했습니다.');
  }
  return await res.json();
};

/**
 * Source IP 등록
 */
export const registerSourceIp = async (projectId: string, cidr: string): Promise<SourceIpEntry> => {
  const res = await fetch(`${BASE_URL}/projects/${projectId}/source-ip/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cidr }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'Source IP 등록에 실패했습니다.');
  }
  return await res.json();
};

/**
 * Source IP 확정
 */
export const confirmSourceIp = async (projectId: string, cidr: string): Promise<SourceIpEntry> => {
  const res = await fetch(`${BASE_URL}/projects/${projectId}/source-ip/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cidr }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'Source IP 확정에 실패했습니다.');
  }
  return await res.json();
};

/**
 * Athena 테이블 목록 조회
 */
export const getAthenaTables = async (projectId: string): Promise<SduAthenaTable[]> => {
  const res = await fetch(`${BASE_URL}/projects/${projectId}/athena-tables`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'Athena 테이블 목록 조회에 실패했습니다.');
  }
  return await res.json();
};

/**
 * SDU 연결 테스트 상태 조회
 */
export const getSduConnectionTest = async (projectId: string): Promise<SduConnectionTestInfo> => {
  const res = await fetch(`${BASE_URL}/projects/${projectId}/connection-test`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || '연결 테스트 상태 조회에 실패했습니다.');
  }
  return await res.json();
};

/**
 * SDU 연결 테스트 실행
 */
export const executeSduConnectionTest = async (projectId: string): Promise<SduConnectionTestInfo> => {
  const res = await fetch(`${BASE_URL}/projects/${projectId}/connection-test/execute`, {
    method: 'POST',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || '연결 테스트 실행에 실패했습니다.');
  }
  return await res.json();
};
