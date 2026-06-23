import { fetchInfra, fetchInfraCamelJson } from '@/app/lib/api/infra';
import type { AwsInstallationStatus } from '@/lib/types';

const BASE = '/aws/target-sources';

/**
 * AWS 설치 상태 조회.
 * Refresh is a re-GET of this endpoint (the old POST check-installation is not
 * in install-v1.yaml — REMOVED).
 */
export const getAwsInstallationStatus = (targetSourceId: number): Promise<AwsInstallationStatus> =>
  fetchInfraCamelJson<AwsInstallationStatus>(`${BASE}/${targetSourceId}/installation-status`);

/**
 * TF Script 다운로드 (수동 설치용).
 * swagger getAwsTerraformScript returns a binary download
 * (…/aws/terraform-script/download → application/octet-stream); the internal
 * route streams it. Returns the response Blob for the caller to save.
 */
export const getAwsTerraformScript = async (targetSourceId: number): Promise<Blob> => {
  const res = await fetchInfra(`${BASE}/${targetSourceId}/terraform-script`);
  if (!res.ok) throw new Error(`terraform-script download failed (${res.status})`);
  return res.blob();
};
