import type { GcpInstallationStatusResponse } from '@/app/api/_lib/v1-types';

const BASE_URL = '/api/v1/gcp/target-sources';

export const getGcpInstallationStatus = async (
  targetSourceId: number
): Promise<GcpInstallationStatusResponse> => {
  const res = await fetch(`${BASE_URL}/${targetSourceId}/installation-status`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'GCP 설치 상태 조회에 실패했습니다.');
  }
  return await res.json();
};

export const checkGcpInstallation = async (
  targetSourceId: number
): Promise<GcpInstallationStatusResponse> => {
  const res = await fetch(`${BASE_URL}/${targetSourceId}/check-installation`, {
    method: 'POST',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'GCP 설치 상태 새로고침에 실패했습니다.');
  }
  return await res.json();
};
