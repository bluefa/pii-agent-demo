import type {
  GcpInstallationStatus,
  GcpRegionalManagedProxyStatus,
  GcpConnectionType,
  GcpServiceTfResources,
  GcpServiceSettings,
} from '@/lib/types/gcp';

const BASE_URL = '/api/gcp';

export const getGcpInstallationStatus = async (
  projectId: string
): Promise<GcpInstallationStatus> => {
  const res = await fetch(`${BASE_URL}/projects/${projectId}/installation-status`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'GCP 설치 상태 조회에 실패했습니다.');
  }
  return await res.json();
};

export const checkGcpInstallation = async (
  projectId: string
): Promise<GcpInstallationStatus> => {
  const res = await fetch(`${BASE_URL}/projects/${projectId}/check-installation`, {
    method: 'POST',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'GCP 설치 상태 새로고침에 실패했습니다.');
  }
  return await res.json();
};

export const getGcpRegionalManagedProxy = async (
  projectId: string,
  resourceId: string
): Promise<GcpRegionalManagedProxyStatus> => {
  const res = await fetch(
    `${BASE_URL}/projects/${projectId}/regional-managed-proxy?resourceId=${encodeURIComponent(resourceId)}`
  );
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'Regional Managed Proxy 조회에 실패했습니다.');
  }
  return await res.json();
};

export const createGcpProxySubnet = async (
  projectId: string,
  resourceId: string
): Promise<{ created: boolean }> => {
  const res = await fetch(`${BASE_URL}/projects/${projectId}/regional-managed-proxy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resourceId }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'Proxy Subnet 생성에 실패했습니다.');
  }
  return await res.json();
};

export const getGcpServiceTfResources = async (
  projectId: string,
  connectionType: GcpConnectionType
): Promise<GcpServiceTfResources> => {
  const res = await fetch(
    `${BASE_URL}/projects/${projectId}/service-tf-resources?connectionType=${encodeURIComponent(connectionType)}`
  );
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'Service TF 리소스 조회에 실패했습니다.');
  }
  return await res.json();
};

export const getGcpServiceSettings = async (
  serviceCode: string
): Promise<GcpServiceSettings> => {
  const res = await fetch(`/api/services/${serviceCode}/settings/gcp`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'GCP 서비스 설정 조회에 실패했습니다.');
  }
  return await res.json();
};
