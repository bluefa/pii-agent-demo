import {
  AwsInstallationStatus,
  AwsServiceSettings,
  CheckInstallationResponse,
  TerraformScriptResponse,
} from '@/lib/types';

const BASE_URL = '/api/aws';

/**
 * AWS 서비스 설정 조회 (스캔 Role 포함)
 */
export const getAwsServiceSettings = async (
  serviceCode: string
): Promise<AwsServiceSettings> => {
  const res = await fetch(`/api/services/${serviceCode}/settings/aws`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'AWS 서비스 설정 조회에 실패했습니다.');
  }
  return await res.json();
};

/**
 * AWS 설치 상태 조회
 */
export const getAwsInstallationStatus = async (
  projectId: string
): Promise<AwsInstallationStatus> => {
  const res = await fetch(`${BASE_URL}/projects/${projectId}/installation-status`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || '설치 상태 조회에 실패했습니다.');
  }
  return await res.json();
};

/**
 * AWS 설치 상태 확인 (새로고침)
 */
export const checkAwsInstallation = async (
  projectId: string
): Promise<CheckInstallationResponse> => {
  const res = await fetch(`${BASE_URL}/projects/${projectId}/check-installation`, {
    method: 'POST',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || '설치 상태 확인에 실패했습니다.');
  }
  return await res.json();
};

/**
 * TF Script 다운로드 URL 조회 (수동 설치용)
 */
export const getAwsTerraformScript = async (
  projectId: string
): Promise<TerraformScriptResponse> => {
  const res = await fetch(`${BASE_URL}/projects/${projectId}/terraform-script`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'TF Script 조회에 실패했습니다.');
  }
  return await res.json();
};
