import type { GcpInstallationStatusResponse, GcpServiceAccountInfo } from '@/app/api/_lib/v1-types';
import { fetchInfraCamelJson } from '@/app/lib/api/infra';

const BASE_URL = '/gcp/target-sources';

/**
 * GCP 설치 상태 조회.
 * Refresh is a re-GET of this endpoint (the old POST check-installation is not
 * in install-v1.yaml — REMOVED).
 */
export const getGcpInstallationStatus = async (
  targetSourceId: number
): Promise<GcpInstallationStatusResponse> =>
  fetchInfraCamelJson<GcpInstallationStatusResponse>(`${BASE_URL}/${targetSourceId}/installation-status`);

export const getGcpScanServiceAccount = async (
  targetSourceId: number
): Promise<GcpServiceAccountInfo> =>
  fetchInfraCamelJson<GcpServiceAccountInfo>(`${BASE_URL}/${targetSourceId}/scan-service-account`);

export const getGcpTerraformServiceAccount = async (
  targetSourceId: number
): Promise<GcpServiceAccountInfo> =>
  fetchInfraCamelJson<GcpServiceAccountInfo>(`${BASE_URL}/${targetSourceId}/terraform-service-account`);
