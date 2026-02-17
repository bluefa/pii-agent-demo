import type { IdcInstallationStatus, IdcResourceInput, ConfirmFirewallResponse, SourceIpRecommendation } from '@/lib/types/idc';

const BASE = '/api/v1/idc';

export const getIdcSourceIpRecommendation = async (ipType: string): Promise<SourceIpRecommendation> => {
  const res = await fetch(`${BASE}/source-ip-recommendation?ipType=${ipType}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error?.message || 'Source IP 추천 조회에 실패했습니다.');
  }
  return await res.json();
};

export const getIdcInstallationStatus = async (targetSourceId: number): Promise<IdcInstallationStatus> => {
  const res = await fetch(`${BASE}/target-sources/${targetSourceId}/installation-status`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error?.message || 'IDC 설치 상태 조회에 실패했습니다.');
  }
  return await res.json();
};

export const checkIdcInstallation = async (targetSourceId: number): Promise<IdcInstallationStatus> => {
  const res = await fetch(`${BASE}/target-sources/${targetSourceId}/check-installation`, {
    method: 'POST',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error?.message || 'IDC 설치 상태 확인에 실패했습니다.');
  }
  return await res.json();
};

export const confirmIdcFirewall = async (targetSourceId: number): Promise<ConfirmFirewallResponse> => {
  const res = await fetch(`${BASE}/target-sources/${targetSourceId}/confirm-firewall`, {
    method: 'POST',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error?.message || '방화벽 확인에 실패했습니다.');
  }
  return await res.json();
};

export const getIdcResources = async (targetSourceId: number): Promise<{ resources: IdcResourceInput[] }> => {
  const res = await fetch(`${BASE}/target-sources/${targetSourceId}/resources`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error?.message || 'IDC 리소스 조회에 실패했습니다.');
  }
  return await res.json();
};

export const updateIdcResources = async (
  targetSourceId: number,
  resources: IdcResourceInput[],
): Promise<{ resources: IdcResourceInput[] }> => {
  const res = await fetch(`${BASE}/target-sources/${targetSourceId}/resources`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resources }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error?.message || 'IDC 리소스 저장에 실패했습니다.');
  }
  return await res.json();
};

export const updateIdcResourcesList = async (
  targetSourceId: number,
  keepResourceIds: string[],
  newResources: IdcResourceInput[],
): Promise<{ project: unknown }> => {
  const res = await fetch(`${BASE}/target-sources/${targetSourceId}/resources/list`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keepResourceIds, newResources }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error?.message || '리소스 업데이트에 실패했습니다.');
  }
  return await res.json();
};

export const confirmIdcTargets = async (
  targetSourceId: number,
  resources: IdcResourceInput[],
): Promise<{ confirmed: boolean; confirmedAt: string; project: unknown }> => {
  const res = await fetch(`${BASE}/target-sources/${targetSourceId}/confirm-targets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resources }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error?.message || '연동 대상 확정에 실패했습니다.');
  }
  return await res.json();
};
