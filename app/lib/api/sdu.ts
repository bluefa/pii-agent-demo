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

const sduBase = (targetSourceId: number) => `/api/v1/sdu/target-sources/${targetSourceId}`;

export const getSduInstallationStatus = async (targetSourceId: number): Promise<SduInstallationStatus> => {
  const res = await fetch(`${sduBase(targetSourceId)}/installation-status`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error?.message || 'SDU 설치 상태 조회에 실패했습니다.');
  }
  return await res.json();
};

export const checkSduInstallation = async (targetSourceId: number): Promise<SduInstallationStatus> => {
  const res = await fetch(`${sduBase(targetSourceId)}/check-installation`, {
    method: 'POST',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error?.message || 'SDU 설치 상태 확인에 실패했습니다.');
  }
  return await res.json();
};

export const getS3UploadStatus = async (targetSourceId: number): Promise<S3UploadInfo> => {
  const res = await fetch(`${sduBase(targetSourceId)}/s3-upload`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error?.message || 'S3 업로드 상태 조회에 실패했습니다.');
  }
  return await res.json();
};

export const checkS3Upload = async (targetSourceId: number): Promise<S3UploadInfo> => {
  const res = await fetch(`${sduBase(targetSourceId)}/s3-upload/check`, {
    method: 'POST',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error?.message || 'S3 업로드 상태 확인에 실패했습니다.');
  }
  return await res.json();
};

export const getIamUser = async (targetSourceId: number): Promise<IamUser> => {
  const res = await fetch(`${sduBase(targetSourceId)}/iam-user`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error?.message || 'IAM User 조회에 실패했습니다.');
  }
  return await res.json();
};

export const issueAkSk = async (targetSourceId: number, issuedBy: string): Promise<IssueAkSkResponse> => {
  const res = await fetch(`${sduBase(targetSourceId)}/iam-user/issue-aksk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ issuedBy }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error?.message || 'AK/SK 발급에 실패했습니다.');
  }
  return await res.json();
};

export const getSourceIpList = async (targetSourceId: number): Promise<SourceIpManagement> => {
  const res = await fetch(`${sduBase(targetSourceId)}/source-ip`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error?.message || 'Source IP 목록 조회에 실패했습니다.');
  }
  return await res.json();
};

export const registerSourceIp = async (targetSourceId: number, cidr: string): Promise<SourceIpEntry> => {
  const res = await fetch(`${sduBase(targetSourceId)}/source-ip/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cidr }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error?.message || 'Source IP 등록에 실패했습니다.');
  }
  return await res.json();
};

export const confirmSourceIp = async (targetSourceId: number, cidr: string): Promise<SourceIpEntry> => {
  const res = await fetch(`${sduBase(targetSourceId)}/source-ip/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cidr }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error?.message || 'Source IP 확정에 실패했습니다.');
  }
  return await res.json();
};

export const getAthenaTables = async (targetSourceId: number): Promise<SduAthenaTable[]> => {
  const res = await fetch(`${sduBase(targetSourceId)}/athena-tables`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error?.message || 'Athena 테이블 목록 조회에 실패했습니다.');
  }
  return await res.json();
};

export const getSduConnectionTest = async (targetSourceId: number): Promise<SduConnectionTestInfo> => {
  const res = await fetch(`${sduBase(targetSourceId)}/connection-test`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error?.message || '연결 테스트 상태 조회에 실패했습니다.');
  }
  return await res.json();
};

export const executeSduConnectionTest = async (targetSourceId: number): Promise<SduConnectionTestInfo> => {
  const res = await fetch(`${sduBase(targetSourceId)}/connection-test/execute`, {
    method: 'POST',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error?.message || '연결 테스트 실행에 실패했습니다.');
  }
  return await res.json();
};
