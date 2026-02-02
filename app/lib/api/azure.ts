import { AzureInstallationStatus } from '@/lib/types/azure';

const BASE_URL = '/api/azure';

export const getAzureInstallationStatus = async (
  projectId: string
): Promise<AzureInstallationStatus> => {
  const res = await fetch(`${BASE_URL}/projects/${projectId}/installation-status`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'Azure 설치 상태 조회에 실패했습니다.');
  }
  return await res.json();
};

export const checkAzureInstallation = async (
  projectId: string
): Promise<AzureInstallationStatus> => {
  const res = await fetch(`${BASE_URL}/projects/${projectId}/check-installation`, {
    method: 'POST',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'Azure 설치 상태 새로고침에 실패했습니다.');
  }
  return await res.json();
};
